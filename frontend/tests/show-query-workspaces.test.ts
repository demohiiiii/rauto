import assert from "node:assert/strict";
import test from "node:test";

import { get } from "svelte/store";
import {
  batchShowObjectAvailabilityPresentation,
  batchShowExecutionResultState,
  createBatchShowInputPanelWorkspace,
  createShowPageWorkspace,
  createSingleShowPanelWorkspace,
  intersectBatchShowObjectPayloads,
  normalizeBatchMaxParallel,
  resolveBatchShowTargetConnections,
  showExecutionResultState,
} from "../src/domains/show/index.js";
import type {
  ShowBatchExecuteResponse,
  ShowBatchTargetResponse,
  ShowExecuteBasePayload,
  ShowExecuteResponse,
  ShowObjectDefinition,
} from "../src/domains/show/index.js";
import type { TaskResultSummary } from "../src/domains/tasks/index.js";

function resultSummary(success: boolean): TaskResultSummary {
  return {
    operation: "exec",
    outcome: success ? "success" : "failed",
    success,
    summary: success ? "Show command completed" : "Show command failed",
  };
}

function showBasePayload(): ShowExecuteBasePayload {
  return {
    connection: {},
    mode: null,
    no_parse: false,
    record_level: "key-events-only",
    textfsm_platform: null,
    textfsm_strict_errors: false,
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
  workspace.textfsmActionHandlers.templateChange("show-version.template");

  assert.deepEqual(
    {
      enabled: get(workspace.panelDisplayStateStore).textfsmFields.enabled,
      strictErrors: get(workspace.panelDisplayStateStore).textfsmFields
        .strictErrors,
      template: get(workspace.panelDisplayStateStore).textfsmFields.template,
    },
    {
      enabled: false,
      strictErrors: true,
      template: "show-version.template",
    },
  );
});

test("batch show TextFSM handlers update the panel display", () => {
  const workspace = createBatchShowInputPanelWorkspace();

  workspace.textfsmActionHandlers.enabledChange(false);
  workspace.textfsmActionHandlers.excelNameChange("inventory");
  workspace.textfsmActionHandlers.strictErrorsChange(true);

  assert.deepEqual(
    {
      enabled: get(workspace.panelDisplayStateStore).textfsmFields.enabled,
      excelName: get(workspace.panelDisplayStateStore).textfsmFields.excelName,
      strictErrors: get(workspace.panelDisplayStateStore).textfsmFields
        .strictErrors,
    },
    { enabled: false, excelName: "inventory", strictErrors: true },
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

test("show result presentations omit command echoes and prompts from transcripts", () => {
  const rawTranscript = "show version\nclean output\nRouter#";
  const result = showResponse({
    all: rawTranscript,
    output: "clean output",
    parsed_output: [{ version: "17.9" }],
  });

  showExecutionResultState().set({
    kind: "result",
    basePayload: showBasePayload(),
    results: [result],
  });
  const singleWorkspace = createSingleShowPanelWorkspace();
  assert.equal(
    get(singleWorkspace.panelDisplayStateStore).resultsDisplay.resultRows[0]
      .outputText,
    "clean output",
  );
  assert.equal(
    get(singleWorkspace.panelDisplayStateStore).resultsDisplay
      .parsedResultCount,
    1,
  );

  batchShowExecutionResultState().set({
    kind: "result",
    resultPayload: batchResponse([batchTarget({ ...result })]),
  });
  const pageWorkspace = createShowPageWorkspace();
  assert.equal(
    get(pageWorkspace.batchResultsPresentationStateStore).resultRows[0]
      .outputText,
    "clean output",
  );

  showExecutionResultState().set({ kind: "empty" });
  batchShowExecutionResultState().set({ kind: "empty" });
});

test("failed show result presentations retain the complete diagnostic transcript", () => {
  const diagnosticTranscript = "show version\nERROR: command failed\nRouter#";
  const result = showResponse({
    all: diagnosticTranscript,
    output: "ERROR: command failed",
    success: false,
  });

  showExecutionResultState().set({
    kind: "result",
    basePayload: showBasePayload(),
    results: [result],
  });
  const singleWorkspace = createSingleShowPanelWorkspace();
  assert.equal(
    get(singleWorkspace.panelDisplayStateStore).resultsDisplay.resultRows[0]
      .outputText,
    diagnosticTranscript,
  );

  batchShowExecutionResultState().set({
    kind: "result",
    resultPayload: batchResponse([
      batchTarget({ ...result, error: "command failed" }),
    ]),
  });
  const pageWorkspace = createShowPageWorkspace();
  assert.equal(
    get(pageWorkspace.batchResultsPresentationStateStore).resultRows[0]
      .outputText,
    diagnosticTranscript,
  );

  showExecutionResultState().set({ kind: "empty" });
  batchShowExecutionResultState().set({ kind: "empty" });
});
