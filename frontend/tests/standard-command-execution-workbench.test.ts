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

test("selected templates are read-only and execution keeps the original template and variables", async () => {
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
  assert.equal(
    await workspace.changeContent("restart {{service}} --force"),
    false,
  );
  workspace.changeVars({ service: "sshd" });
  await workspace.execute();

  assert.equal(get(workspace.stateStore).content, "restart {{service}}");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].template_content, "restart {{service}}");
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

test("command auto download uses the execution snapshot and skips destroyed workspaces", async (t) => {
  const { executionResultApi } =
    await import("../src/domains/execution/infrastructure/executionResultApi.js");
  const { executionResultRuntime } =
    await import("../src/domains/execution/infrastructure/executionResultRuntime.js");
  const exported = t.mock.method(
    executionResultApi,
    "exportExcel",
    async () => ({ blob: new Blob(["excel"]) }),
  );
  const downloads = t.mock.method(executionResultRuntime, "download", () => {});
  for (const [enabled, autoDownloadExcel, destroy] of [
    [true, true, false],
    [true, false, false],
    [false, true, false],
    [true, true, true],
  ]) {
    const response = deferred<StandardCommandExecutionResponse>();
    const workspace = createStandardCommandExecutionWorkspace({
      api: commandApi({ executeTemplate: async () => response.promise }),
      inspectionDelay: 0,
      runtime: runtime(),
    });
    t.after(workspace.destroy);
    await workspace.changeContent("show version");
    workspace.changeTextfsm({ enabled, autoDownloadExcel });
    const before = exported.mock.callCount();
    const pending = workspace.execute();
    workspace.changeTextfsm({
      enabled: !enabled,
      autoDownloadExcel: !autoDownloadExcel,
    });
    if (destroy) workspace.destroy();
    assert.equal(exported.mock.callCount(), before);
    response.resolve({
      ...executionResponse(),
      executed: [
        {
          all: "version 1",
          command: "show version",
          error: null,
          exit_code: 0,
          output: "version 1",
          parse_error: null,
          parsed_output: [{ version: "1" }],
          success: true,
        },
      ],
    });
    await pending;
    assert.equal(
      exported.mock.callCount() - before,
      enabled && autoDownloadExcel && !destroy ? 1 : 0,
    );
  }
  assert.equal(downloads.mock.callCount(), 1);
  const exportPayload = exported.mock.calls[0].arguments[0];
  assert.ok(exportPayload);
  assert.match(
    exportPayload.filename ?? "",
    /^textfsm-command-\d{8}-\d{6}\.xlsx$/,
  );
});

test("command text auto and manual downloads use the same original device and work without parsing", async (t) => {
  const { executionResultRuntime } =
    await import("../src/domains/execution/infrastructure/executionResultRuntime.js");
  const download = t.mock.method(executionResultRuntime, "download", () => {});
  const workspace = createStandardCommandExecutionWorkspace({
    api: commandApi({
      executeTemplate: async () => {
        workspace.changeTextfsm({ autoDownloadOutput: false });
        return {
          ...executionResponse(),
          executed: [
            {
              command: "uptime",
              output: "running",
              all: "uptime\nrunning\n$",
              success: true,
              error: null,
              exit_code: 0,
              parsed_output: null,
              parse_error: null,
            },
          ],
        };
      },
    }),
    inspectionDelay: 0,
    runtime: runtime(),
  });
  t.after(workspace.destroy);
  await workspace.changeContent("uptime");
  workspace.changeTextfsm({ enabled: false, autoDownloadOutput: true });
  await workspace.execute();
  await workspace.downloadOutput();
  assert.equal(download.mock.callCount(), 2);
  for (const call of download.mock.calls) {
    const blob = call.arguments[0];
    assert.ok(blob);
    assert.equal(await blob.text(), "=== edge-01 ===\n$ uptime\nrunning");
  }
});

function previewClock() {
  let nextId = 0;
  const callbacks = new Map<number, () => void>();
  return {
    setTimer(callback: () => void) {
      callbacks.set(++nextId, callback);
      return nextId;
    },
    clearTimer(id: number) {
      callbacks.delete(id);
    },
    async flush() {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback());
      await new Promise<void>((resolve) => setImmediate(resolve));
    },
  };
}

test("template rendering is automatic and variable changes debounce to the latest values", async (t) => {
  const clock = previewClock();
  const requests: StandardCommandRenderPayload[] = [];
  const workspace = createStandardCommandExecutionWorkspace({
    api: commandApi({
      getTemplate: async () => templateDetail("echo {{message}}"),
      inspectCommandTemplate: async () => inspection("message"),
      renderTemplate: async (payload) => {
        requests.push(payload);
        return { rendered_commands: `echo ${payload.vars.message}` };
      },
    }),
    runtime: { ...runtime(), ...clock },
  });
  t.after(workspace.destroy);
  await workspace.selectSource("echo");
  assert.equal(get(workspace.stateStore).preview.text, "echo ");
  workspace.changeVars({ message: "first" });
  workspace.changeVars({ message: "second" });
  assert.equal(get(workspace.stateStore).preview.kind, "running");
  assert.equal(get(workspace.stateStore).preview.text, "");
  await clock.flush();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].vars.message, "second");
  assert.equal(get(workspace.stateStore).preview.text, "echo second");
  assert.equal(get(workspace.stateStore).content, "echo {{message}}");
});

test("outdated render successes and errors cannot replace the latest preview or its loading state", async (t) => {
  for (const failOldRequest of [false, true]) {
    const clock = previewClock();
    const old = deferred<{ rendered_commands: string }>();
    const latest = deferred<{ rendered_commands: string }>();
    const workspace = createStandardCommandExecutionWorkspace({
      api: commandApi({
        getTemplate: async () => templateDetail("echo {{message}}"),
        inspectCommandTemplate: async () => inspection("message"),
        renderTemplate: async ({ vars }) =>
          vars.message === "old"
            ? old.promise
            : vars.message === "latest"
              ? latest.promise
              : { rendered_commands: "echo" },
      }),
      runtime: { ...runtime(), ...clock },
    });
    t.after(workspace.destroy);
    await workspace.selectSource("echo");
    workspace.changeVars({ message: "old" });
    await clock.flush();
    workspace.changeVars({ message: "latest" });
    await clock.flush();
    if (failOldRequest) old.reject(new Error("old failure"));
    else old.resolve({ rendered_commands: "outdated" });
    await clock.flush();
    assert.equal(get(workspace.stateStore).preview.kind, "running");
    assert.ok(get(workspace.stateStore).loadingActions.includes("preview"));
    latest.resolve({ rendered_commands: "echo latest" });
    await clock.flush();
    assert.equal(get(workspace.stateStore).preview.text, "echo latest");
    workspace.changeVars({ message: "old" });
    await workspace.selectSource(MANUAL_COMMAND_SOURCE);
    await clock.flush();
    assert.equal(get(workspace.stateStore).preview.kind, "empty");
  }
});

test("a failed current render clears the old commands and later edits recover", async (t) => {
  const clock = previewClock();
  const workspace = createStandardCommandExecutionWorkspace({
    api: commandApi({
      getTemplate: async () => templateDetail("echo {{message}}"),
      inspectCommandTemplate: async () => inspection("message"),
      renderTemplate: async ({ vars }) => {
        if (vars.message === "bad") throw new Error("Invalid variable");
        return { rendered_commands: `echo ${vars.message}` };
      },
    }),
    runtime: { ...runtime(), ...clock },
  });
  t.after(workspace.destroy);
  await workspace.selectSource("echo");
  workspace.changeVars({ message: "bad" });
  await clock.flush();
  assert.deepEqual(get(workspace.stateStore).preview, {
    kind: "error",
    text: "",
    message: "Invalid variable",
  });
  workspace.changeVars({ message: "fixed" });
  await clock.flush();
  assert.equal(get(workspace.stateStore).preview.text, "echo fixed");
});

test("switching templates, returning to manual input, and destroying ignore pending renders", async (t) => {
  for (const next of ["another", MANUAL_COMMAND_SOURCE, "destroy"]) {
    const pending = deferred<{ rendered_commands: string }>();
    const clock = previewClock();
    const workspace = createStandardCommandExecutionWorkspace({
      api: commandApi({
        getTemplate: async (name) => templateDetail(name),
        renderTemplate: async ({ template_content }) =>
          template_content === "slow"
            ? pending.promise
            : { rendered_commands: template_content },
      }),
      runtime: { ...runtime(), ...clock },
    });
    t.after(workspace.destroy);
    const selection = workspace.selectSource("slow");
    await clock.flush();
    if (next === "destroy") workspace.destroy();
    else await workspace.selectSource(next);
    const before = get(workspace.stateStore);
    pending.resolve({ rendered_commands: "stale" });
    assert.equal(await selection, false);
    assert.deepEqual(get(workspace.stateStore), before);
    if (next === MANUAL_COMMAND_SOURCE) {
      const changed = workspace.changeContent("manual command");
      await clock.flush();
      assert.equal(await changed, true);
      assert.equal(get(workspace.stateStore).content, "manual command");
    }
  }
});

test("changing the target refreshes template rendering with the latest connection and unsubscribes on destroy", async (t) => {
  const clock = previewClock();
  let target = "edge-01";
  let onTargetChange = () => {};
  let unsubscribed = false;
  const workspace = createStandardCommandExecutionWorkspace({
    api: commandApi({
      getTemplate: async () => templateDetail("echo target"),
      renderTemplate: async ({ connection }) => ({
        rendered_commands: `echo ${connection?.connection_name}`,
      }),
    }),
    runtime: {
      ...runtime(),
      ...clock,
      connection: () => ({ connection_name: target }),
      subscribeConnectionChange: (listener) => {
        onTargetChange = listener;
        return () => {
          unsubscribed = true;
        };
      },
    },
  });
  t.after(workspace.destroy);
  await workspace.selectSource("target");
  assert.equal(get(workspace.stateStore).preview.text, "echo edge-01");
  target = "edge-02";
  onTargetChange();
  await clock.flush();
  assert.equal(get(workspace.stateStore).preview.text, "echo edge-02");
  workspace.destroy();
  assert.equal(unsubscribed, true);
});
