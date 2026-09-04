import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";

import { MANUAL_COMMAND_SOURCE } from "../src/domains/command/index.js";
import {
  commandExecutionPayload,
  createStandardCommandExecutionWorkspace,
  reconcileCommandVars,
} from "../src/domains/standard/index.js";
import type {
  StandardCommandApi,
  StandardCommandExecutionPayload,
  StandardCommandExecutionResponse,
  StandardCommandRenderPayload,
  StandardCommandRuntime,
  StandardCommandTemplateInspection,
  StandardCommandVariableField,
  StandardTemplateDetail,
} from "../src/domains/standard/index.js";

function deferred<T>(): {
  promise: Promise<T>;
  reject: (reason?: Error) => void;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function variableField(name: string): StandardCommandVariableField {
  return {
    allow_empty: false,
    default: null,
    description: null,
    label: name,
    name,
    options: [],
    placeholder: null,
    required: true,
    type: "string",
  };
}

function inspection(...names: string[]): StandardCommandTemplateInspection {
  return { vars_schema: names.map(variableField) };
}

function templateDetail(
  content = "",
  name = "template",
): StandardTemplateDetail {
  return { content, name };
}

function executionResponse(): StandardCommandExecutionResponse {
  return {
    executed: [],
    recording_jsonl: null,
    rendered_commands: "",
    result_summary: {
      operation: "template_execute",
      outcome: "success",
      success: true,
      summary: "Template execution completed",
    },
  };
}

function commandApi(
  overrides: Partial<StandardCommandApi> = {},
): StandardCommandApi {
  return {
    executeTemplate: async () => executionResponse(),
    getTemplate: async (name) => templateDetail("", name),
    inspectCommandTemplate: async () => inspection(),
    listTemplates: async () => [],
    renderTemplate: async () => ({ rendered_commands: "" }),
    ...overrides,
  };
}

function runtime(): Partial<StandardCommandRuntime> {
  return {
    applyRecording() {},
    connection: () => ({ connection_name: "edge-01" }),
    ensureTarget: () => true,
    recordLevel: () => "key-events-only",
  };
}

test("command vars retain schema order and shared values", () => {
  assert.deepEqual(
    reconcileCommandVars([variableField("peer"), variableField("service")], {
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
      recordLevel: "key-events-only",
      textfsm: { parse_textfsm: false },
    }),
    {
      template_content: "echo {{message}}\n",
      vars: { message: "hello" },
      mode: "Shell",
      multiline_mode: "whole",
      connection: { connection_name: "linux-01" },
      record_level: "key-events-only",
      parse_textfsm: false,
    },
  );
});

test("manual input is the default command source", () => {
  assert.equal(MANUAL_COMMAND_SOURCE, "__manual__");
});

test("selecting a template imports an editable snapshot without saving", async () => {
  const calls: StandardCommandExecutionPayload[] = [];
  const workspace = createStandardCommandExecutionWorkspace({
    api: commandApi({
      listTemplates: async () => [{ name: "restart" }],
      getTemplate: async () => templateDetail("restart {{service}}", "restart"),
      inspectCommandTemplate: async () => inspection("service"),
      renderTemplate: async () => ({ rendered_commands: "restart sshd" }),
      executeTemplate: async (payload) => {
        calls.push(payload);
        return executionResponse();
      },
    }),
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
    api: commandApi({
      listTemplates: async () => [{ name: "saved" }],
      getTemplate: async () => {
        getTemplateCalls += 1;
        return templateDetail("saved", "saved");
      },
    }),
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
  const slowLoad = deferred<StandardTemplateDetail>();
  const workspace = createStandardCommandExecutionWorkspace({
    api: commandApi({
      listTemplates: async () => [{ name: "slow" }],
      getTemplate: async () => slowLoad.promise,
    }),
    confirmReplace: async () => true,
    inspectionDelay: 0,
    runtime: runtime(),
  });

  const selection = workspace.selectSource("slow");
  await Promise.resolve();
  await workspace.changeContent("show clock");
  slowLoad.resolve(templateDetail("stale command", "slow"));

  assert.equal(await selection, false);
  assert.equal(get(workspace.stateStore).content, "show clock");
  workspace.destroy();
});

test("a stale inspection cannot replace the latest variable schema", async () => {
  const firstInspection = deferred<StandardCommandTemplateInspection>();
  let inspectionCalls = 0;
  const workspace = createStandardCommandExecutionWorkspace({
    api: commandApi({
      inspectCommandTemplate: async () => {
        inspectionCalls += 1;
        return inspectionCalls === 1
          ? firstInspection.promise
          : inspection("second");
      },
    }),
    inspectionDelay: 0,
    runtime: runtime(),
  });

  const firstChange = workspace.changeContent("{{first}}");
  await workspace.changeContent("{{second}}");
  firstInspection.resolve(inspection("first"));
  await firstChange;

  assert.deepEqual(get(workspace.stateStore).vars, { second: "" });
  workspace.destroy();
});

test("preview and execute use the same command content and variables", async () => {
  const previewPayloads: StandardCommandRenderPayload[] = [];
  const executePayloads: StandardCommandExecutionPayload[] = [];
  const workspace = createStandardCommandExecutionWorkspace({
    api: commandApi({
      inspectCommandTemplate: async () => inspection("message"),
      renderTemplate: async (payload) => {
        previewPayloads.push(payload);
        return { rendered_commands: "echo hello" };
      },
      executeTemplate: async (payload) => {
        executePayloads.push(payload);
        return executionResponse();
      },
    }),
    inspectionDelay: 0,
    runtime: runtime(),
  });

  await workspace.changeContent("echo {{message}}");
  workspace.changeVars({ message: "hello" });
  await workspace.preview();
  await workspace.execute();

  assert.equal(previewPayloads.length, 1);
  assert.equal(executePayloads.length, 1);
  assert.equal(
    previewPayloads[0].template_content,
    executePayloads[0].template_content,
  );
  assert.deepEqual(previewPayloads[0].vars, executePayloads[0].vars);
  workspace.destroy();
});

test("manual commands execute as inline content instead of template names", async () => {
  const executePayloads: StandardCommandExecutionPayload[] = [];
  const workspace = createStandardCommandExecutionWorkspace({
    api: commandApi({
      renderTemplate: async () => ({ rendered_commands: "show version" }),
      executeTemplate: async (payload) => {
        executePayloads.push(payload);
        return executionResponse();
      },
    }),
    inspectionDelay: 0,
    runtime: runtime(),
  });

  await workspace.changeContent("show version");
  await workspace.execute();

  assert.equal(executePayloads.length, 1);
  assert.equal(executePayloads[0].template_content, "show version");
  assert.equal("template" in executePayloads[0], false);
  workspace.destroy();
});
