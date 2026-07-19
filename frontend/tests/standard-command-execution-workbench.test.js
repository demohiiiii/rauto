import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { get } from "svelte/store";
import {
  MANUAL_COMMAND_SOURCE,
  commandExecutionPayload,
  createStandardCommandExecutionWorkspace,
  reconcileCommandVars,
} from "../src/modules/standard/standardCommandExecutionWorkspace.js";

function read(path) {
  return readFileSync(path, "utf8");
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function runtime() {
  return {
    applyRecording() {},
    connection: () => ({ connection_name: "edge-01" }),
    ensureTarget: () => true,
    recordLevel: () => "key_events",
  };
}

test("client exposes command content inspection", () => {
  const source = read("frontend/src/api/client.js");

  assert.match(source, /inspectCommandTemplate/);
  assert.match(source, /\/api\/templates\/inspect/);
});

test("command vars retain schema order and shared values", () => {
  assert.deepEqual(
    reconcileCommandVars([{ name: "peer" }, { name: "service" }], {
      removed: "x",
      service: "sshd",
      peer: "edge-01",
    }),
    { peer: "edge-01", service: "sshd" },
  );
});

test("unified command payload keeps source text and explicit multiline mode", () => {
  assert.deepEqual(
    commandExecutionPayload({
      content: "echo {{message}}\n",
      vars: { message: "hello" },
      mode: "Shell",
      multilineMode: "whole",
      connection: { connection_name: "linux-01" },
      recordLevel: "key_events",
      textfsm: { parse_textfsm: false },
    }),
    {
      template_content: "echo {{message}}\n",
      vars: { message: "hello" },
      mode: "Shell",
      multiline_mode: "whole",
      connection: { connection_name: "linux-01" },
      record_level: "key_events",
      parse_textfsm: false,
    },
  );
});

test("manual input is the default command source", () => {
  assert.equal(MANUAL_COMMAND_SOURCE, "__manual__");
});

test("selecting a template imports an editable snapshot without saving", async () => {
  const calls = [];
  const workspace = createStandardCommandExecutionWorkspace({
    api: {
      listTemplates: async () => [{ name: "restart" }],
      getTemplate: async () => ({
        name: "restart",
        content: "restart {{service}}",
      }),
      inspectCommandTemplate: async () => ({
        vars_schema: [{ name: "service" }],
      }),
      renderTemplate: async () => ({ rendered_commands: "restart sshd" }),
      executeTemplate: async (payload) => {
        calls.push(payload);
        return { executed: [] };
      },
    },
    confirmReplace: async () => true,
    inspectionDelay: 0,
    runtime: runtime(),
  });

  await workspace.initialize();
  await workspace.selectSource("restart");
  await workspace.changeContent("restart {{service}} --force");
  workspace.changeVars({ service: "sshd" });
  await workspace.execute();

  assert.equal(
    get(workspace.stateStore).content,
    "restart {{service}} --force",
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].template_content, "restart {{service}} --force");
  assert.equal("template" in calls[0], false);
  assert.deepEqual(calls[0].vars, { service: "sshd" });
  assert.equal("save" in workspace, false);
  assert.equal("saveAs" in workspace, false);
  workspace.destroy();
});

test("cancelled dirty replacement leaves the command draft unchanged", async () => {
  let getTemplateCalls = 0;
  const workspace = createStandardCommandExecutionWorkspace({
    api: {
      listTemplates: async () => [{ name: "saved" }],
      getTemplate: async () => {
        getTemplateCalls += 1;
        return { content: "saved" };
      },
      inspectCommandTemplate: async () => ({ vars_schema: [] }),
      renderTemplate: async () => ({}),
      executeTemplate: async () => ({}),
    },
    confirmReplace: async () => false,
    inspectionDelay: 0,
    runtime: runtime(),
  });

  await workspace.changeContent("show version");
  const before = get(workspace.stateStore);
  assert.equal(await workspace.selectSource("saved"), false);
  assert.deepEqual(get(workspace.stateStore), before);
  assert.equal(getTemplateCalls, 0);
  workspace.destroy();
});

test("a stale template load cannot replace newer manual input", async () => {
  const slowLoad = deferred();
  const workspace = createStandardCommandExecutionWorkspace({
    api: {
      listTemplates: async () => [{ name: "slow" }],
      getTemplate: async () => slowLoad.promise,
      inspectCommandTemplate: async () => ({ vars_schema: [] }),
      renderTemplate: async () => ({}),
      executeTemplate: async () => ({}),
    },
    confirmReplace: async () => true,
    inspectionDelay: 0,
    runtime: runtime(),
  });

  const selection = workspace.selectSource("slow");
  await Promise.resolve();
  await workspace.changeContent("show clock");
  slowLoad.resolve({ content: "stale command" });

  assert.equal(await selection, false);
  assert.equal(get(workspace.stateStore).content, "show clock");
  workspace.destroy();
});

test("a stale inspection cannot replace the latest variable schema", async () => {
  const firstInspection = deferred();
  let inspectionCalls = 0;
  const workspace = createStandardCommandExecutionWorkspace({
    api: {
      listTemplates: async () => [],
      getTemplate: async () => ({}),
      inspectCommandTemplate: async () => {
        inspectionCalls += 1;
        return inspectionCalls === 1
          ? firstInspection.promise
          : { vars_schema: [{ name: "second" }] };
      },
      renderTemplate: async () => ({}),
      executeTemplate: async () => ({}),
    },
    inspectionDelay: 0,
    runtime: runtime(),
  });

  const firstChange = workspace.changeContent("{{first}}");
  await workspace.changeContent("{{second}}");
  firstInspection.resolve({ vars_schema: [{ name: "first" }] });
  await firstChange;

  assert.deepEqual(get(workspace.stateStore).vars, { second: "" });
  workspace.destroy();
});

test("preview and execute use the same command content and variables", async () => {
  let previewPayload;
  let executePayload;
  const workspace = createStandardCommandExecutionWorkspace({
    api: {
      listTemplates: async () => [],
      getTemplate: async () => ({}),
      inspectCommandTemplate: async () => ({
        vars_schema: [{ name: "message" }],
      }),
      renderTemplate: async (payload) => {
        previewPayload = payload;
        return { rendered_commands: "echo hello" };
      },
      executeTemplate: async (payload) => {
        executePayload = payload;
        return { executed: [] };
      },
    },
    inspectionDelay: 0,
    runtime: runtime(),
  });

  await workspace.changeContent("echo {{message}}");
  workspace.changeVars({ message: "hello" });
  await workspace.preview();
  await workspace.execute();

  assert.equal(
    previewPayload.template_content,
    executePayload.template_content,
  );
  assert.deepEqual(previewPayload.vars, executePayload.vars);
  workspace.destroy();
});

test("manual commands execute as inline content instead of template names", async () => {
  let executePayload;
  const workspace = createStandardCommandExecutionWorkspace({
    api: {
      listTemplates: async () => [],
      getTemplate: async () => ({}),
      inspectCommandTemplate: async () => ({ vars_schema: [] }),
      renderTemplate: async () => ({ rendered_commands: "show version" }),
      executeTemplate: async (payload) => {
        executePayload = payload;
        return { executed: [] };
      },
    },
    inspectionDelay: 0,
    runtime: runtime(),
  });

  await workspace.changeContent("show version");
  await workspace.execute();

  assert.equal(executePayload.template_content, "show version");
  assert.equal("template" in executePayload, false);
  workspace.destroy();
});

test("standard execution exposes command and command-flow tabs only", () => {
  const modes = read("frontend/src/config/dashboardModes.js");
  const page = read("frontend/src/pages/StandardPage.svelte");

  assert.doesNotMatch(modes, /STANDARD_EXEC_MODE\.template/);
  assert.doesNotMatch(page, /TemplateExecutionPanel/);
  assert.match(page, /CommandExecutionPanel/);
  assert.match(page, /WorkspaceActionHeader/);
  assert.match(page, /themeAware=\{true\}/);
  assert.doesNotMatch(page, /CollapsibleGroup/);
});

test("command panel composes the shared command controls", () => {
  const panel = read(
    "frontend/src/pages/standard/CommandExecutionPanel.svelte",
  );

  assert.match(panel, /CommandEditor/);
  assert.match(panel, /JsonObjectFieldsEditor/);
  assert.match(panel, /TextfsmControls/);
  assert.match(panel, /ParsedOutputBlock/);
});

test("standard command workbench has no legacy panel factories", () => {
  const source = [
    read("frontend/src/modules/standard/standardExecutionState.js"),
    read("frontend/src/modules/standard/standardExecutionWorkspaces.js"),
    read("frontend/src/modules/standard/standard.js"),
  ].join("\n");

  assert.doesNotMatch(source, /createDirectExecutionPanelWorkspace/);
  assert.doesNotMatch(source, /createTemplateExecutionPanelWorkspace/);
  assert.doesNotMatch(source, /createTemplateExecutionResultsPanelWorkspace/);
});
