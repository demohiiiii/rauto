import {
  executionHistory,
  downloadCommandOutput,
  executionResultOutputText,
  executionResultFailed,
} from "../src/domains/execution/index.js";
import assert from "node:assert/strict";
import test from "node:test";

import { get } from "svelte/store";
import {
  batchShowObjectAvailabilityPresentation,
  batchShowExecutionResultState,
  createBatchShowInputPanelWorkspace,
  createShowPageWorkspace,
  createSingleShowPanelWorkspace,
  executeBatchShowObject,
  executeShowObject,
  loadShowObjects,
  intersectBatchShowObjectPayloads,
  normalizeBatchMaxParallel,
  resolveBatchShowTargetConnections,
  showExecutionResultState,
} from "../src/domains/show/index.js";
import type {
  ShowBatchExecuteResponse,
  ShowBatchTargetResponse,
  ShowExecuteResponse,
  ShowObjectDefinition,
} from "../src/domains/show/index.js";
import type { TaskResultSummary } from "../src/domains/tasks/index.js";
import { CONNECTION_PICKER } from "../src/domains/connections/index.js";
import {
  setBatchShowFields,
  setShowTextfsmFields,
} from "../src/domains/show/application/showExecutionState.js";
import { showApi } from "../src/domains/show/infrastructure/showApi.js";
import { showRuntime } from "../src/domains/show/infrastructure/showRuntime.js";

function resultSummary(success: boolean): TaskResultSummary {
  return {
    operation: "exec",
    outcome: success ? "success" : "failed",
    success,
    summary: success ? "Show command completed" : "Show command failed",
  };
}

function showResponse(
  overrides: Partial<ShowExecuteResponse> = {},
): ShowExecuteResponse {
  const success = overrides.success ?? true;
  const summary = resultSummary(success);
  return {
    all: "show version\nclean output\nRouter#",
    command: "show version",
    execution_response: { error: null, result_summary: summary, success },
    exit_code: success ? 0 : 1,
    mode: "Enable",
    object: "version",
    output: "clean output",
    parse_error: null,
    parsed_output: null,
    platform: "cisco_ios",
    recording_jsonl: null,
    result_summary: summary,
    source: "builtin",
    success,
    textfsm_mapping_command: null,
    textfsm_template_name: null,
    ...overrides,
  };
}

function batchTarget(
  overrides: Partial<ShowBatchTargetResponse> = {},
): ShowBatchTargetResponse {
  const success = overrides.success ?? true;
  return {
    all: "show version\nclean output\nRouter#",
    command: "show version",
    error: null,
    exit_code: success ? 0 : 1,
    host: "192.0.2.1",
    mode: "Enable",
    object: "version",
    output: "clean output",
    parse_error: null,
    parsed_output: null,
    platform: "cisco_ios",
    profile: "cisco_xe",
    source: "builtin",
    success,
    target: "edge-a",
    textfsm_mapping_command: null,
    textfsm_template_name: null,
    ...overrides,
  };
}

function batchResponse(
  results: ShowBatchTargetResponse[],
): ShowBatchExecuteResponse {
  const success = results.every((result) => result.success);
  const summary = resultSummary(success);
  return {
    execution_response: { error: null, result_summary: summary, success },
    object: "version",
    results,
    result_summary: summary,
    targets: [...new Set(results.map((result) => result.target))],
  };
}

function showObject(object: string, command: string): ShowObjectDefinition {
  return {
    command,
    mode: null,
    object,
    source: "builtin",
    textfsm_mapping_command: null,
    textfsm_template_name: null,
  };
}

test("batch show expands selected devices, groups, and labels", () => {
  const connections = [
    {
      name: "edge-a",
      device_profile: "cisco_xe",
      groups: ["edge"],
      labels: ["prod"],
    },
    {
      name: "edge-b",
      device_profile: "h3c_comware",
      groups: ["edge"],
      labels: [],
    },
    {
      name: "core-a",
      device_profile: "juniper_junos",
      groups: ["core"],
      labels: ["prod"],
    },
  ];

  assert.deepEqual(
    resolveBatchShowTargetConnections({
      connections,
      groups: ["edge"],
      labels: ["prod"],
      targets: ["core-a"],
    }).map((connection) => connection.name),
    ["edge-a", "edge-b", "core-a"],
  );
});

test("batch show object options are the profile catalog intersection", () => {
  const commonObjects = intersectBatchShowObjectPayloads([
    {
      objects: [
        showObject("arp", "show arp"),
        showObject("interfaces", "show interfaces"),
        showObject("version", "show version"),
      ],
      platform: "cisco_ios",
    },
    {
      objects: [
        showObject("arp", "display arp"),
        showObject("version", "display version"),
      ],
      platform: "hp_comware",
    },
  ]);

  assert.deepEqual(
    commonObjects.map((object) => object.object),
    ["arp", "version"],
  );
  assert.equal(commonObjects[0].command, "show arp");
});

test("batch show object availability blocks selection until ready", () => {
  assert.equal(
    batchShowObjectAvailabilityPresentation({ status: "waiting" }).canSelect,
    false,
  );
  assert.equal(
    batchShowObjectAvailabilityPresentation({
      objectCount: 4,
      status: "ready",
    }).canSelect,
    true,
  );
});

test("single show TextFSM handlers update the panel display", () => {
  const workspace = createSingleShowPanelWorkspace();

  workspace.textfsmActionHandlers.enabledChange(false);
  workspace.textfsmActionHandlers.strictErrorsChange(true);

  assert.deepEqual(
    {
      enabled: get(workspace.panelDisplayStateStore).textfsmFields.enabled,
      strictErrors: get(workspace.panelDisplayStateStore).textfsmFields
        .strictErrors,
    },
    {
      enabled: false,
      strictErrors: true,
    },
  );
});

test("batch show TextFSM handlers update the panel display", () => {
  const workspace = createBatchShowInputPanelWorkspace();

  workspace.textfsmActionHandlers.enabledChange(false);
  workspace.textfsmActionHandlers.autoDownloadExcelChange(true);
  workspace.textfsmActionHandlers.strictErrorsChange(true);

  assert.deepEqual(
    {
      enabled: get(workspace.panelDisplayStateStore).textfsmFields.enabled,
      autoDownloadExcel: get(workspace.panelDisplayStateStore).textfsmFields
        .autoDownloadExcel,
      strictErrors: get(workspace.panelDisplayStateStore).textfsmFields
        .strictErrors,
    },
    { enabled: false, autoDownloadExcel: true, strictErrors: true },
  );
});

test("batch show max parallel handler updates the panel display", () => {
  const workspace = createBatchShowInputPanelWorkspace();

  assert.equal(
    get(workspace.panelDisplayStateStore).selectionFields.maxParallel,
    "",
  );

  workspace.changeBatchMaxParallel(" 8 ");
  assert.equal(
    get(workspace.panelDisplayStateStore).selectionFields.maxParallel,
    "8",
  );
});

test("batch show max parallel payload normalization drops invalid values", () => {
  assert.equal(normalizeBatchMaxParallel("8"), 8);
  assert.equal(normalizeBatchMaxParallel(" 4 "), 4);
  assert.equal(normalizeBatchMaxParallel(""), null);
  assert.equal(normalizeBatchMaxParallel("0"), null);
  assert.equal(normalizeBatchMaxParallel("-3"), null);
  assert.equal(normalizeBatchMaxParallel("abc"), null);
});

for (const success of [true, false]) {
  test(`show history displays ${success ? "clean output" : "the diagnostic transcript"} for single and batch results`, async (t) => {
    t.after(() => {
      setShowTextfsmFields();
      setBatchShowFields();
      showExecutionResultState().set({ kind: "empty" });
      batchShowExecutionResultState().set({ kind: "empty" });
    });
    t.mock.method(showRuntime, "ensureConnectionTargetSelected", () => true);
    t.mock.method(showRuntime, "connectionPayload", () => ({
      connection_name: "edge-a",
    }));
    t.mock.method(showRuntime, "pickerValues", (key: string) => {
      if (
        key === CONNECTION_PICKER.showObject ||
        key === CONNECTION_PICKER.batchShowObject
      )
        return ["version"];
      if (key === CONNECTION_PICKER.batchShowTargets) return ["edge-a"];
      return [];
    });
    const result = showResponse({
      success,
      all: "show version\noutput\nRouter#",
      output: "output",
      parsed_output: [{ version: "17.9" }],
    });
    t.mock.method(showApi, "execute", async () => result);
    t.mock.method(showApi, "executeBatch", async () =>
      batchResponse([batchTarget(result)]),
    );
    await executeShowObject();
    await executeBatchShowObject();
    for (const scope of ["single", "batch"]) {
      const entry = get(executionHistory.state).entries.find(
        (row) => row.feature === "show" && row.scope === scope,
      )!;
      const output = entry.outputs[0];
      assert.equal(entry.status, success ? "success" : "error");
      assert.equal(
        executionResultOutputText(output, "output", {
          preferTranscript: executionResultFailed(output),
        }),
        success ? "output" : result.all,
      );
      assert.deepEqual(output.parsed_output, [{ version: "17.9" }]);
    }
  });
}

test("show and batch executions retain every run in their history", async (t) => {
  const previousIds = new Set(
    get(executionHistory.state).entries.map((entry) => entry.id),
  );
  t.mock.method(showRuntime, "ensureConnectionTargetSelected", () => true);
  t.mock.method(showRuntime, "connectionPayload", () => ({
    connection_name: "edge-a",
  }));
  t.mock.method(showRuntime, "pickerValues", (key: string) => {
    if (key === CONNECTION_PICKER.showObject) return ["version"];
    if (key === CONNECTION_PICKER.batchShowObject) return ["version"];
    if (key === CONNECTION_PICKER.batchShowTargets) return ["edge-a"];
    return [];
  });
  let singleRun = 0;
  t.mock.method(showApi, "execute", async () =>
    showResponse({ output: `single-${++singleRun}` }),
  );
  let batchRun = 0;
  t.mock.method(showApi, "executeBatch", async () =>
    batchResponse([batchTarget({ output: `batch-${++batchRun}` })]),
  );

  await executeShowObject();
  await executeShowObject();
  setBatchShowFields({}, { enabled: false });
  await executeBatchShowObject();
  await executeBatchShowObject();

  const runs = get(executionHistory.state).entries.filter(
    (entry) => !previousIds.has(entry.id),
  );
  assert.equal(runs.filter((entry) => entry.scope === "single").length, 2);
  assert.equal(runs.filter((entry) => entry.scope === "batch").length, 2);
  assert.ok(
    runs.every(
      (entry) => entry.feature === "show" && entry.status === "success",
    ),
  );
});

test("show history parsing settings follow the request even when forms change during execution", async (t) => {
  t.after(() => {
    setShowTextfsmFields();
    setBatchShowFields();
    showExecutionResultState().set({ kind: "empty" });
    batchShowExecutionResultState().set({ kind: "empty" });
  });
  t.mock.method(showRuntime, "ensureConnectionTargetSelected", () => true);
  t.mock.method(showRuntime, "connectionPayload", () => ({
    connection_name: "edge-a",
  }));
  t.mock.method(showRuntime, "pickerValues", (key: string) => {
    if (
      key === CONNECTION_PICKER.showObject ||
      key === CONNECTION_PICKER.batchShowObject
    )
      return ["version"];
    if (key === CONNECTION_PICKER.batchShowTargets) return ["edge-a"];
    return [];
  });
  for (const enabled of [false, true]) {
    setShowTextfsmFields({ enabled });
    setBatchShowFields({}, { enabled });
    t.mock.method(
      showApi,
      "execute",
      async (payload: Parameters<typeof showApi.execute>[0]) => {
        assert.equal(payload.no_parse, !enabled);
        setShowTextfsmFields({ enabled: !enabled });
        return showResponse({ parsed_output: null });
      },
    );
    t.mock.method(
      showApi,
      "executeBatch",
      async (payload: Parameters<typeof showApi.executeBatch>[0]) => {
        assert.equal(payload.no_parse, !enabled);
        assert.equal(Object.hasOwn(payload, "textfsm_platform"), false);
        setBatchShowFields({}, { enabled: !enabled });
        return batchResponse([batchTarget({ parsed_output: null })]);
      },
    );
    await executeShowObject();
    await executeBatchShowObject();
    for (const scope of ["single", "batch"]) {
      const entry = get(executionHistory.state).entries.find(
        (row) => row.feature === "show" && row.scope === scope,
      )!;
      assert.equal(entry.textfsmEnabled, enabled);
      assert.equal(entry.outputs[0].parsed_output, null);
    }
  }
});

test("show queries infer their platform from the device profile", async (t) => {
  t.after(() => {
    showExecutionResultState().set({ kind: "empty" });
  });
  t.mock.method(showRuntime, "currentExecutionProfile", () => "linux");
  t.mock.method(showRuntime, "ensureConnectionTargetSelected", () => true);
  t.mock.method(showRuntime, "connectionPayload", () => ({
    connection_name: "linux-server",
  }));
  t.mock.method(showRuntime, "pickerValues", () => ["version"]);
  t.mock.method(showRuntime, "setObjectPickerOptions", () => true);
  const catalog = t.mock.method(
    showApi,
    "listObjects",
    async (query: Parameters<typeof showApi.listObjects>[0]) => {
      assert.deepEqual(query, { deviceProfile: "linux" });
      return {
        platform: "linux",
        objects: [showObject("version", "cat /etc/os-release")],
      };
    },
  );
  const execute = t.mock.method(
    showApi,
    "execute",
    async (payload: Parameters<typeof showApi.execute>[0]) => {
      assert.equal(Object.hasOwn(payload, "textfsm_platform"), false);
      return showResponse({
        platform: "linux",
        command: "cat /etc/os-release",
      });
    },
  );

  await loadShowObjects();
  await executeShowObject();

  assert.equal(catalog.mock.callCount(), 1);
  assert.equal(execute.mock.callCount(), 1);
});

test("single show automatically downloads one workbook after all commands using the initial switch value", async (t) => {
  const { executionResultApi } =
    await import("../src/domains/execution/infrastructure/executionResultApi.js");
  const { executionResultRuntime } =
    await import("../src/domains/execution/infrastructure/executionResultRuntime.js");
  t.after(() => {
    setShowTextfsmFields();
    showExecutionResultState().set({ kind: "empty" });
  });
  const downloads = t.mock.method(executionResultRuntime, "download", () => {});
  const exported = t.mock.method(
    executionResultApi,
    "exportExcel",
    async () => ({ blob: new Blob(["excel"]) }),
  );
  t.mock.method(showRuntime, "ensureConnectionTargetSelected", () => true);
  t.mock.method(showRuntime, "connectionPayload", () => ({
    connection_name: "edge-a",
  }));
  t.mock.method(showRuntime, "pickerValues", () => ["version", "interfaces"]);
  t.mock.method(
    showApi,
    "execute",
    async ({ object }: Parameters<typeof showApi.execute>[0]) => {
      assert.equal(exported.mock.callCount(), 0);
      setShowTextfsmFields({ enabled: false, autoDownloadExcel: false });
      return showResponse({ object, parsed_output: [{ value: object }] });
    },
  );
  const workspace = createSingleShowPanelWorkspace();
  workspace.textfsmActionHandlers.autoDownloadExcelChange(true);
  workspace.setPanelContext({
    active: true,
    panelDisplay: get(workspace.panelDisplayStateStore),
  });
  await executeShowObject();
  assert.equal(exported.mock.callCount(), 1);
  const payload = exported.mock.calls[0].arguments[0];
  assert.ok(payload);
  assert.deepEqual(
    payload.sheets?.map((sheet) => sheet.name),
    ["version", "interfaces"],
  );
  assert.match(payload.filename ?? "", /^textfsm-show-\d{8}-\d{6}\.xlsx$/);
  assert.equal(downloads.mock.calls[0].arguments[1], payload.filename);
  assert.equal(get(showExecutionResultState()).kind, "result");
});

test("batch show auto download requires parsing and parsed rows and snapshots its switch", async (t) => {
  const { executionResultApi } =
    await import("../src/domains/execution/infrastructure/executionResultApi.js");
  const { executionResultRuntime } =
    await import("../src/domains/execution/infrastructure/executionResultRuntime.js");
  t.after(() => {
    setBatchShowFields();
    batchShowExecutionResultState().set({ kind: "empty" });
  });
  const downloads = t.mock.method(executionResultRuntime, "download", () => {});
  const exported = t.mock.method(
    executionResultApi,
    "exportExcel",
    async () => ({ blob: new Blob(["excel"]) }),
  );
  t.mock.method(showRuntime, "pickerValues", (key: string) => {
    if (key === CONNECTION_PICKER.batchShowObject) return ["version"];
    if (key === CONNECTION_PICKER.batchShowTargets) return ["edge-a", "edge-b"];
    return [];
  });
  for (const [enabled, autoDownloadExcel, parsed] of [
    [true, false, true],
    [false, true, true],
    [true, true, false],
    [true, true, true],
  ]) {
    const before = exported.mock.callCount();
    setBatchShowFields({}, { enabled, autoDownloadExcel });
    t.mock.method(showApi, "executeBatch", async () => {
      setBatchShowFields(
        {},
        { enabled: true, autoDownloadExcel: !autoDownloadExcel },
      );
      return batchResponse([
        batchTarget({ parsed_output: parsed ? [{ version: "1" }] : null }),
        batchTarget({ target: "edge-b", success: false, error: "unreachable" }),
      ]);
    });
    await executeBatchShowObject();
    assert.equal(
      exported.mock.callCount() - before,
      enabled && autoDownloadExcel && parsed ? 1 : 0,
    );
    assert.equal(get(batchShowExecutionResultState()).kind, "result");
  }
  assert.equal(downloads.mock.callCount(), 1);
  const payload = exported.mock.calls[0].arguments[0];
  assert.ok(payload);
  assert.match(
    payload.filename ?? "",
    /^textfsm-batch-show-\d{8}-\d{6}\.xlsx$/,
  );
  assert.deepEqual(payload.sheets?.[0].parsed_output, [
    {
      version: "1",
      device: "edge-a",
      profile: "cisco_xe",
      command: "show version",
      object: "version",
    },
  ]);
});

test("failed automatic Excel export reports an error without discarding show results", async (t) => {
  const { executionResultApi } =
    await import("../src/domains/execution/infrastructure/executionResultApi.js");
  const { executionResultRuntime } =
    await import("../src/domains/execution/infrastructure/executionResultRuntime.js");
  t.after(() => {
    setShowTextfsmFields();
    showExecutionResultState().set({ kind: "empty" });
  });
  t.mock.method(showRuntime, "ensureConnectionTargetSelected", () => true);
  t.mock.method(showRuntime, "connectionPayload", () => ({}));
  t.mock.method(showRuntime, "pickerValues", () => ["version"]);
  t.mock.method(showApi, "execute", async () =>
    showResponse({ parsed_output: [{ version: "1" }] }),
  );
  t.mock.method(executionResultApi, "exportExcel", async () => {
    throw new Error("export unavailable");
  });
  const notify = t.mock.method(
    executionResultRuntime,
    "notifyError",
    async () => {},
  );
  const download = t.mock.method(executionResultRuntime, "download", () => {});
  setShowTextfsmFields({ enabled: true, autoDownloadExcel: true });
  await executeShowObject();
  assert.equal(get(showExecutionResultState()).kind, "result");
  assert.equal(notify.mock.calls[0].arguments[0], "export unavailable");
  assert.equal(download.mock.callCount(), 0);
});

test("single show text download works without parsing and manual download retains the execution device", async (t) => {
  const { executionResultRuntime } =
    await import("../src/domains/execution/infrastructure/executionResultRuntime.js");
  const download = t.mock.method(executionResultRuntime, "download", () => {});
  t.after(() => {
    setShowTextfsmFields();
    showExecutionResultState().set({ kind: "empty" });
  });
  t.mock.method(showRuntime, "ensureConnectionTargetSelected", () => true);
  t.mock.method(showRuntime, "connectionPayload", () => ({
    connection_name: "original-device",
  }));
  t.mock.method(showRuntime, "pickerValues", () => ["version"]);
  const workspace = createSingleShowPanelWorkspace();
  workspace.textfsmActionHandlers.enabledChange(false);
  workspace.textfsmActionHandlers.autoDownloadOutputChange(true);
  workspace.setPanelContext({
    active: true,
    panelDisplay: get(workspace.panelDisplayStateStore),
  });
  t.mock.method(
    showApi,
    "execute",
    async (payload: Parameters<typeof showApi.execute>[0]) => {
      assert.equal(payload.no_parse, true);
      assert.equal(Object.hasOwn(payload, "autoDownloadOutput"), false);
      setShowTextfsmFields({ autoDownloadOutput: false });
      return showResponse({ output: "version 1\n", parsed_output: null });
    },
  );
  await executeShowObject();
  assert.equal(download.mock.callCount(), 1);
  t.mock.method(showRuntime, "connectionPayload", () => ({
    connection_name: "different-device",
  }));
  await downloadCommandOutput(
    get(executionHistory.state).entries.find(
      (row) => row.feature === "show" && row.scope === "single",
    )!.outputs,
  );
  assert.equal(download.mock.callCount(), 2);
  const first = download.mock.calls[0].arguments[0];
  const second = download.mock.calls[1].arguments[0];
  assert.ok(first);
  assert.ok(second);
  assert.equal(
    await first.text(),
    "=== original-device ===\n$ show version\nversion 1\n",
  );
  assert.equal(await second.text(), await first.text());
});

test("batch text download snapshots the switch and includes failed devices without parsed data", async (t) => {
  const { executionResultRuntime } =
    await import("../src/domains/execution/infrastructure/executionResultRuntime.js");
  const download = t.mock.method(executionResultRuntime, "download", () => {});
  t.after(() => {
    setBatchShowFields();
    batchShowExecutionResultState().set({ kind: "empty" });
  });
  t.mock.method(showRuntime, "pickerValues", (key: string) => {
    if (key === CONNECTION_PICKER.batchShowObject) return ["version"];
    if (key === CONNECTION_PICKER.batchShowTargets) return ["edge-a", "edge-b"];
    return [];
  });
  for (const enabled of [false, true]) {
    setBatchShowFields({}, { enabled: false, autoDownloadOutput: enabled });
    t.mock.method(showApi, "executeBatch", async () => {
      setBatchShowFields({}, { autoDownloadOutput: !enabled });
      return batchResponse([
        batchTarget({ output: "version 1" }),
        batchTarget({
          target: "edge-b",
          all: null,
          output: null,
          success: false,
          error: "unreachable",
        }),
      ]);
    });
    await executeBatchShowObject();
    assert.equal(download.mock.callCount(), enabled ? 1 : 0);
  }
  await downloadCommandOutput(
    get(executionHistory.state).entries.find(
      (row) => row.feature === "show" && row.scope === "batch",
    )!.outputs,
  );
  assert.equal(download.mock.callCount(), 2);
  const blob = download.mock.calls[1].arguments[0];
  assert.ok(blob);
  const text = await blob.text();
  assert.ok(text.includes("=== edge-a ===\n$ show version\nversion 1"));
  assert.ok(text.includes("=== edge-b ===\n$ show version\nunreachable"));
});

for (const missing of ["objects", "targets"] as const) {
  test(`batch show records missing ${missing} as a visible history failure`, async (t) => {
    t.after(() => batchShowExecutionResultState().set({ kind: "empty" }));
    t.mock.method(showRuntime, "pickerValues", (key: string) =>
      missing === "targets" && key === CONNECTION_PICKER.batchShowObject
        ? ["version"]
        : [],
    );
    const request = t.mock.method(showApi, "executeBatch", async () =>
      batchResponse([]),
    );
    const previousIds = new Set(
      get(executionHistory.state).entries.map((entry) => entry.id),
    );
    await executeBatchShowObject();
    const runs = get(executionHistory.state).entries.filter(
      (entry) => !previousIds.has(entry.id),
    );
    assert.equal(request.mock.callCount(), 0);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].scope, "batch");
    assert.equal(runs[0].feature, "show");
    assert.equal(runs[0].status, "error");
    const result = get(batchShowExecutionResultState());
    assert.equal(result.kind, "error");
    if (result.kind === "error") assert.equal(runs[0].message, result.message);
    assert.ok(runs[0].message.length > 0);
  });
}
