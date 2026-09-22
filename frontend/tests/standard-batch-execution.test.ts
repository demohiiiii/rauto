import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import { createBatchDeliveryWorkspace } from "../src/domains/standard/application/createBatchDeliveryWorkspace.js";
import { createStandardCommandExecutionWorkspace } from "../src/domains/standard/application/createStandardCommandExecutionWorkspace.js";
import { createInteractiveExecutionPanelWorkspace } from "../src/domains/standard/application/createStandardExecutionWorkspaces.js";
import { createInteractiveTemplateRuntime } from "../src/domains/templates/index.js";
import { standardBatchApi } from "../src/domains/standard/infrastructure/standardBatchApi.js";
import { standardBatchRuntime } from "../src/domains/standard/infrastructure/standardBatchRuntime.js";
import { executionResultApi } from "../src/domains/execution/infrastructure/executionResultApi.js";
import { executionResultRuntime } from "../src/domains/execution/infrastructure/executionResultRuntime.js";
import {
  normalizeBatchExecMaxParallel,
  buildBatchInteractiveDeliveryPayload,
} from "../src/domains/standard/model/standardBatch.js";
import type {
  StandardBatchExecResponse,
  StandardCommandTextfsmState,
  StandardCommandRenderPayload,
} from "../src/domains/standard/model/types.js";

const selection = {
  targets: ["edge-01"],
  groups: ["branch"],
  labels: ["production"],
};
const settings: StandardCommandTextfsmState = {
  enabled: true,
  autoDownloadExcel: true,
  autoDownloadOutput: true,
  template: "custom",
  strictErrors: true,
};
const response: StandardBatchExecResponse = {
  command: "",
  targets: ["edge-01"],
  result_summary: {
    operation: "exec",
    outcome: "success",
    success: true,
    summary: "Done",
  },
  results: [
    {
      target: "edge-01",
      host: "192.0.2.1",
      profile: "linux",
      command: "uptime",
      mode: "shell",
      output: "up",
      error: null,
      exit_code: 0,
      parsed_output: null,
      parse_error: null,
      outputs: [
        {
          command: "uptime",
          success: true,
          output: "up",
          all: "up",
          error: null,
          exit_code: 0,
          parsed_output: [{ UP: "1" }],
          parse_error: null,
        },
      ],
    },
  ],
};

function mockTargets(t: test.TestContext) {
  t.mock.method(standardBatchRuntime, "batchExecTargets", () => selection);
  t.mock.method(
    standardBatchRuntime,
    "batchInteractiveTargets",
    () => selection,
  );
}

test("parallelism only accepts positive integers", () => {
  assert.equal(normalizeBatchExecMaxParallel(" 4 "), 4);
  for (const value of ["", "0", "-2", "invalid", "1.5", "3foo"])
    assert.equal(normalizeBatchExecMaxParallel(value), null);
});

test("batch command uses the shared template workspace and forwards all execution controls", async (t) => {
  mockTargets(t);
  const execute = t.mock.method(
    standardBatchApi,
    "executeCommand",
    async () => response,
  );
  const download = t.mock.method(executionResultRuntime, "download", () => {});
  const excel = t.mock.method(executionResultApi, "exportExcel", async () => ({
    blob: new Blob(["xlsx"]),
  }));
  const batch = createBatchDeliveryWorkspace("command");
  batch.maxParallelStore.set("8");
  const workspace = createStandardCommandExecutionWorkspace({
    batch,
    inspectionDelay: 0,
    runtime: { recordLevel: () => "key-events-only" },
    api: {
      getTemplate: async () => ({ name: "test", content: "show {{item}}" }),
      inspectCommandTemplate: async () => ({ vars_schema: [] }),
      renderTemplate: async () => ({
        rendered_commands: "=== edge-01 ===\nshow version",
      }),
    },
  });
  t.after(workspace.destroy);
  await workspace.selectSource("test");
  assert.equal(await workspace.changeContent("cannot edit"), false);
  workspace.changeVars({ item: "version" });
  workspace.changeMultilineMode("whole");
  workspace.changeMode("enable");
  workspace.changeRetry({
    enabled: true,
    maxRetries: "2",
    initialBackoffMs: "200",
    maxBackoffMs: "2000",
  });
  workspace.changeTextfsm(settings);
  assert.equal(await workspace.execute(), true);
  const payload = execute.mock.calls[0].arguments[0];
  assert.ok(payload);
  assert.equal(payload.template_content, "show {{item}}");
  assert.deepEqual(payload.vars, { item: "version" });
  assert.deepEqual(payload.targets, selection.targets);
  assert.deepEqual(payload.groups, selection.groups);
  assert.deepEqual(payload.labels, selection.labels);
  assert.equal(payload.max_parallel, 8);
  assert.equal(payload.mode, "enable");
  assert.equal(payload.multiline_mode, "whole");
  assert.equal(payload.parse_textfsm, true);
  assert.equal(payload.textfsm_strict_errors, true);
  assert.equal(payload.textfsm_template, "custom");
  assert.equal(payload.retry?.max_retries, 2);
  assert.equal(payload.record_level, "key-events-only");
  assert.equal("connection" in payload, false);
  assert.equal("autoDownloadOutput" in payload, false);
  assert.equal(excel.mock.callCount(), 1);
  assert.equal(download.mock.callCount(), 2);
  workspace.changeTextfsm({ enabled: false, autoDownloadOutput: false });
  await batch.downloadOutput();
  const blob = download.mock.calls[2].arguments[0];
  assert.ok(blob);
  assert.equal(await blob.text(), "=== edge-01 ===\n$ uptime\nup");
});

test("batch preview expands a fresh group inventory and renders each device separately", async (t) => {
  t.mock.method(standardBatchRuntime, "batchExecTargets", () => ({
    targets: ["edge-b"],
    groups: ["new-group"],
    labels: [],
  }));
  const inventory = t.mock.method(
    standardBatchApi,
    "listConnections",
    async () => [
      { name: "edge-a", groups: ["new-group"] },
      { name: "edge-b", groups: ["new-group"] },
    ],
  );
  const render = t.mock.method(
    standardBatchApi,
    "renderTemplate",
    async (payload: StandardCommandRenderPayload) => ({
      rendered_commands: `echo ${payload.connection?.connection_name}`,
    }),
  );
  const workspace = createBatchDeliveryWorkspace("command");
  const preview = await workspace.renderTemplate({
    template_content: "echo {{connection.name}}",
    vars: {},
  });
  assert.equal(inventory.mock.callCount(), 1);
  assert.equal(render.mock.callCount(), 2);
  assert.equal(
    preview.rendered_commands,
    "=== edge-a ===\necho edge-a\n\n=== edge-b ===\necho edge-b",
  );
});

test("batch interactive and single interactive keep drafts, settings, and variables independent", async (t) => {
  mockTargets(t);
  const execute = t.mock.method(
    standardBatchApi,
    "executeInteractive",
    async () => ({
      ...response,
      template_name: "interactive",
      results: [],
    }),
  );
  const single = createInteractiveExecutionPanelWorkspace();
  const batch = createInteractiveExecutionPanelWorkspace(
    createBatchDeliveryWorkspace("interactive"),
  );
  single.authoring.createNewDraft("single");
  batch.authoring.createNewDraft("batch");
  single.authoring.draft.setTomlText('name = "single"\ncommand = ""');
  batch.authoring.draft.setTomlText('name = "batch"\ncommand = ""');
  batch.changeInteractiveTextfsmEnabled(true);
  batch.changeInteractiveTextfsmStrictErrors(true);
  batch.changeInteractiveTextfsmTemplate("custom");
  batch.changeInteractiveRetry({ enabled: true, maxRetries: "3" });
  await batch.executeInteractiveExecution();
  const payload = execute.mock.calls[0].arguments[0];
  assert.ok(payload);
  assert.equal(payload.content, 'name = "batch"\ncommand = ""');
  assert.equal(payload.parse_textfsm, true);
  assert.equal(payload.textfsm_strict_errors, true);
  assert.equal(payload.textfsm_template, "custom");
  assert.equal(payload.retry?.max_retries, 3);
  assert.equal("connection" in payload, false);
  assert.equal(
    get(single.authoring.draft.tomlTextStateStore),
    'name = "single"\ncommand = ""',
  );
  assert.equal(
    get(single.interactivePanelDisplayStateStore).interactiveTextfsmFields
      .enabled,
    false,
  );

  const left = createInteractiveTemplateRuntime();
  const right = createInteractiveTemplateRuntime();
  const schema = {
    vars_schema: [
      {
        name: "vlan",
        label: "VLAN",
        type: "number",
        required: true,
        allow_empty: false,
        default: 10,
        description: null,
        placeholder: null,
        options: [],
      },
    ],
  };
  left.updateInteractiveTemplateVarFields(schema);
  right.updateInteractiveTemplateVarFields(schema);
  left.setInteractiveVarDraftValue("vlan", "20");
  assert.deepEqual(left.buildInteractiveVarsPayload(), { vlan: 20 });
  assert.deepEqual(right.buildInteractiveVarsPayload(), { vlan: 10 });
});

test("batch interactive keeps saved, builtin, and inline sources with variables", () => {
  const common = { vars: { ports: ["Eth1"] }, parse_textfsm: true };
  assert.deepEqual(
    buildBatchInteractiveDeliveryPayload(
      { ...common, template_name: "saved", builtin_template_name: null },
      selection,
    ),
    { ...common, template_name: "saved", ...selection },
  );
  assert.deepEqual(
    buildBatchInteractiveDeliveryPayload(
      { ...common, template_name: null, builtin_template_name: "builtin" },
      selection,
    ),
    { ...common, builtin_template_name: "builtin", ...selection },
  );
  assert.deepEqual(
    buildBatchInteractiveDeliveryPayload(
      { ...common, content: "draft" },
      selection,
    ),
    { ...common, content: "draft", ...selection },
  );
});

test("batch does not execute without targets and retains execution results when downloads fail", async (t) => {
  t.mock.method(standardBatchRuntime, "batchExecTargets", () => ({
    targets: [],
    groups: [],
    labels: [],
  }));
  const execute = t.mock.method(
    standardBatchApi,
    "executeCommand",
    async () => response,
  );
  const workspace = createBatchDeliveryWorkspace("command");
  const payload = {
    template_content: "uptime",
    vars: {},
    mode: null,
    multiline_mode: "split_lines" as const,
  };
  assert.equal(await workspace.executeCommand(payload, settings), false);
  assert.equal(execute.mock.callCount(), 0);
  assert.equal(get(workspace.resultStore).kind, "error");
  t.mock.method(standardBatchRuntime, "batchExecTargets", () => selection);
  // A new workspace captures the now-valid target selection function.
  const next = createBatchDeliveryWorkspace("command");
  t.mock.method(executionResultRuntime, "download", () => {
    throw new Error("download failed");
  });
  const notify = t.mock.method(
    executionResultRuntime,
    "notifyError",
    async () => {},
  );
  assert.equal(
    await next.executeCommand(payload, {
      ...settings,
      autoDownloadExcel: false,
    }),
    true,
  );
  assert.equal(get(next.resultStore).kind, "result");
  assert.equal(notify.mock.calls[0].arguments[0], "download failed");
});

test("an unmounted batch workspace ignores late results and automatic downloads", async (t) => {
  mockTargets(t);
  let resolve!: (value: StandardBatchExecResponse) => void;
  t.mock.method(
    standardBatchApi,
    "executeCommand",
    () =>
      new Promise<StandardBatchExecResponse>((done) => {
        resolve = done;
      }),
  );
  const download = t.mock.method(executionResultRuntime, "download", () => {});
  const workspace = createBatchDeliveryWorkspace("command");
  const payload = {
    template_content: "uptime",
    vars: {},
    mode: null,
    multiline_mode: "split_lines" as const,
  };
  const pending = workspace.executeCommand(payload, settings);
  assert.equal(await workspace.executeCommand(payload, settings), false);
  workspace.destroy();
  resolve(response);
  assert.equal(await pending, false);
  assert.equal(download.mock.callCount(), 0);
  assert.notEqual(get(workspace.resultStore).kind, "result");
});
