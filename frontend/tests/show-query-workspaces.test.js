import assert from "node:assert/strict";
import test from "node:test";

import { get } from "svelte/store";
import {
  createBatchShowInputPanelWorkspace,
  createShowPageWorkspace,
  createSingleShowPanelWorkspace,
} from "../src/modules/operations/showQueryWorkspaces.js";
import {
  batchShowExecutionResultState,
  normalizeBatchMaxParallel,
  showExecutionResultState,
} from "../src/modules/operations/showQueryState.js";

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
