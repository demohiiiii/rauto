import assert from "node:assert/strict";
import test from "node:test";

import {
  commandFlowExecutionPayload,
  normalizeCommandFlowExecutionSource,
} from "../src/domains/standard/index.js";
import type { StandardCommandFlowExecutionInput } from "../src/domains/standard/index.js";

const commonPayload = {
  connection: { connection_name: "edge-01" },
  recordLevel: "key-events-only",
  textfsm: {
    parse_textfsm: false,
    textfsm_strict_errors: false,
    textfsm_template: null,
  },
  vars: { destination: "/tmp/config" },
} satisfies StandardCommandFlowExecutionInput;

test("saved command flow execution sends template identity without inline content", () => {
  assert.deepEqual(
    commandFlowExecutionPayload({
      ...commonPayload,
      source: {
        kind: "saved",
        templateSelection: "deploy-config",
      },
    }),
    {
      template_name: "deploy-config",
      builtin_template_name: null,
      vars: { destination: "/tmp/config" },
      parse_textfsm: false,
      textfsm_strict_errors: false,
      textfsm_template: null,
      connection: { connection_name: "edge-01" },
      record_level: "key-events-only",
    },
  );
});

test("temporary command flow execution sends inline content without template identity", () => {
  assert.deepEqual(
    commandFlowExecutionPayload({
      ...commonPayload,
      source: {
        content: 'name = "temporary"\nsteps = []\n',
        kind: "temporary",
      },
    }),
    {
      content: 'name = "temporary"\nsteps = []\n',
      vars: { destination: "/tmp/config" },
      parse_textfsm: false,
      textfsm_strict_errors: false,
      textfsm_template: null,
      connection: { connection_name: "edge-01" },
      record_level: "key-events-only",
    },
  );
});

test("command flow execution source rejects incomplete saved and temporary drafts", () => {
  assert.throws(
    () => normalizeCommandFlowExecutionSource({ kind: "saved" }),
    /template/i,
  );
  assert.throws(
    () => normalizeCommandFlowExecutionSource({ kind: "temporary" }),
    /content/i,
  );
});

test("flow auto download preserves settings captured before template loading", async (t) => {
  const {
    executeCommandFlow,
    setStandardTextfsmFields,
    commandFlowExecutionResultState,
    createFlowExecutionPanelWorkspace,
  } = await import("../src/domains/standard/index.js");
  const { get } = await import("svelte/store");
  const { standardCommandFlowApi } =
    await import("../src/domains/standard/infrastructure/standardCommandFlowApi.js");
  const { standardCommandFlowRuntime } =
    await import("../src/domains/standard/infrastructure/standardCommandFlowRuntime.js");
  const { executionResultApi } =
    await import("../src/domains/execution/infrastructure/executionResultApi.js");
  const { executionResultRuntime } =
    await import("../src/domains/execution/infrastructure/executionResultRuntime.js");
  t.after(() => {
    setStandardTextfsmFields();
    commandFlowExecutionResultState().set({ kind: "empty" });
  });
  t.mock.method(standardCommandFlowRuntime, "ensureTarget", () => true);
  t.mock.method(standardCommandFlowRuntime, "connectionPayload", () => ({}));
  t.mock.method(standardCommandFlowRuntime, "buildVarsPayload", () => null);
  t.mock.method(
    standardCommandFlowRuntime,
    "ensureTemplateDetail",
    async () => {
      setStandardTextfsmFields({ enabled: false, autoDownloadExcel: false });
      return null;
    },
  );
  const flow = t.mock.method(
    standardCommandFlowApi,
    "executeFlow",
    async () => ({
      outputs: [
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
      recording_jsonl: null,
      result_summary: {
        operation: "flow",
        outcome: "success",
        success: true,
        summary: "Completed",
      },
      success: true,
      template_name: "inventory",
    }),
  );
  const exported = t.mock.method(
    executionResultApi,
    "exportExcel",
    async () => ({ blob: new Blob(["excel"]) }),
  );
  const downloads = t.mock.method(executionResultRuntime, "download", () => {});
  const workspace = createFlowExecutionPanelWorkspace();
  workspace.changeFlowAutoDownloadExcel(true);
  assert.equal(
    get(workspace.flowPanelDisplayStateStore).flowTextfsmFields
      .autoDownloadExcel,
    true,
  );
  setStandardTextfsmFields({ enabled: true, autoDownloadExcel: true });
  await executeCommandFlow({ kind: "saved", templateSelection: "inventory" });
  const flowPayload = flow.mock.calls[0].arguments[0];
  assert.ok(flowPayload);
  assert.equal(flowPayload.parse_textfsm, true);
  assert.equal(Object.hasOwn(flowPayload, "autoDownloadExcel"), false);
  assert.equal(exported.mock.callCount(), 1);
  assert.equal(downloads.mock.callCount(), 1);
  const exportPayload = exported.mock.calls[0].arguments[0];
  assert.ok(exportPayload);
  assert.match(
    exportPayload.filename ?? "",
    /^textfsm-flow-\d{8}-\d{6}\.xlsx$/,
  );
  assert.equal(get(commandFlowExecutionResultState()).kind, "result");
});

test("flow text output downloads without TextFSM and preserves original connection after execution", async (t) => {
  const {
    executeCommandFlow,
    setStandardTextfsmFields,
    commandFlowExecutionResultState,
  } = await import("../src/domains/standard/index.js");
  const { downloadCommandFlowOutput } =
    await import("../src/domains/standard/application/standardCommandFlowExecutionState.js");
  const { standardCommandFlowApi } =
    await import("../src/domains/standard/infrastructure/standardCommandFlowApi.js");
  const { standardCommandFlowRuntime } =
    await import("../src/domains/standard/infrastructure/standardCommandFlowRuntime.js");
  const { executionResultRuntime } =
    await import("../src/domains/execution/infrastructure/executionResultRuntime.js");
  t.after(() => {
    setStandardTextfsmFields();
    commandFlowExecutionResultState().set({ kind: "empty" });
  });
  t.mock.method(standardCommandFlowRuntime, "ensureTarget", () => true);
  t.mock.method(standardCommandFlowRuntime, "connectionPayload", () => ({
    connection_name: "edge-original",
  }));
  t.mock.method(standardCommandFlowRuntime, "buildVarsPayload", () => null);
  t.mock.method(
    standardCommandFlowApi,
    "executeFlow",
    async (
      payload: Parameters<typeof standardCommandFlowApi.executeFlow>[0],
    ) => {
      assert.equal(payload.parse_textfsm, false);
      setStandardTextfsmFields({ autoDownloadOutput: false });
      return {
        outputs: [
          {
            command: "uptime",
            output: "running",
            all: null,
            error: null,
            exit_code: 0,
            parsed_output: null,
            parse_error: null,
            success: true,
          },
        ],
        recording_jsonl: null,
        result_summary: {
          operation: "flow",
          outcome: "success",
          success: true,
          summary: "Completed",
        },
        success: true,
        template_name: "temporary",
      };
    },
  );
  const download = t.mock.method(executionResultRuntime, "download", () => {});
  setStandardTextfsmFields({ enabled: false, autoDownloadOutput: true });
  await executeCommandFlow({ kind: "temporary", content: 'name = "test"' });
  t.mock.method(standardCommandFlowRuntime, "connectionPayload", () => ({
    connection_name: "other-device",
  }));
  await downloadCommandFlowOutput();
  assert.equal(download.mock.callCount(), 2);
  const blob = download.mock.calls[1].arguments[0];
  assert.ok(blob);
  assert.equal(await blob.text(), "=== edge-original ===\n$ uptime\nrunning");
});
