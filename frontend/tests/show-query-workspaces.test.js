import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { get } from "svelte/store";
import {
  batchShowObjectAvailabilityPresentation,
  createBatchShowInputPanelWorkspace,
  createShowPageWorkspace,
  createSingleShowPanelWorkspace,
} from "../src/modules/operations/showQueryWorkspaces.js";
import {
  batchShowExecutionResultState,
  intersectBatchShowObjectPayloads,
  normalizeBatchMaxParallel,
  resolveBatchShowTargetConnections,
  showExecutionResultState,
} from "../src/modules/operations/showQueryState.js";

function read(path) {
  return readFileSync(path, "utf8");
}

test("show query mode tabs render in the card header", () => {
  for (const path of [
    "frontend/src/pages/show/SingleShowPanel.svelte",
    "frontend/src/pages/show/BatchShowInputPanel.svelte",
  ]) {
    const source = read(path);
    const headerIndex = source.indexOf("<WorkspaceActionHeader");
    const tabIndex = source.indexOf("<TabList");
    const contentIndex = source.indexOf("<Card.Content");

    assert.ok(headerIndex >= 0, path);
    assert.ok(tabIndex > headerIndex, path);
    assert.ok(contentIndex > tabIndex, path);
    assert.match(
      source.slice(headerIndex, contentIndex),
      /themeAware=\{true\}/,
      path,
    );
  }
});

test("batch show selects targets before common query objects", () => {
  const source = read("frontend/src/pages/show/BatchShowInputPanel.svelte");
  const contentIndex = source.indexOf("<Card.Content");
  const targetPickerIndex = source.indexOf(
    "<ConnectionPickerField",
    contentIndex,
  );
  const objectPickerIndex = source.indexOf(
    "<ShowObjectSelectionPanel",
    contentIndex,
  );

  assert.ok(targetPickerIndex > contentIndex);
  assert.ok(objectPickerIndex > targetPickerIndex);
  assert.match(source, /onSelectionChange=\{changeBatchTargets\}/);
  assert.match(source, /batchShowPanelDisplay\.objectAvailability\.canSelect/);
});

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
        { object: "arp", command: "show arp" },
        { object: "interfaces", command: "show interfaces" },
        { object: "version", command: "show version" },
      ],
    },
    {
      objects: [
        { object: "arp", command: "display arp" },
        { object: "version", command: "display version" },
      ],
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
  const result = {
    all: rawTranscript,
    command: "show version",
    mode: "Enable",
    object: "version",
    output: "clean output",
    success: true,
  };

  showExecutionResultState().set({
    kind: "result",
    basePayload: {},
    results: [result],
  });
  const singleWorkspace = createSingleShowPanelWorkspace();
  assert.equal(
    get(singleWorkspace.panelDisplayStateStore).resultsDisplay.resultRows[0]
      .outputText,
    "clean output",
  );

  batchShowExecutionResultState().set({
    kind: "result",
    resultPayload: {
      results: [{ ...result, target: "edge-a" }],
    },
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
  const result = {
    all: diagnosticTranscript,
    command: "show version",
    error: "command failed",
    mode: "Enable",
    object: "version",
    output: "ERROR: command failed",
    success: false,
  };

  showExecutionResultState().set({
    kind: "result",
    basePayload: {},
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
    resultPayload: {
      results: [{ ...result, target: "edge-a" }],
    },
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
