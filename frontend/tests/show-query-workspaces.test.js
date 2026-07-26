import assert from "node:assert/strict";
import test from "node:test";

import { get } from "svelte/store";
import {
  createBatchShowInputPanelWorkspace,
  createSingleShowPanelWorkspace,
} from "../src/modules/operations/showQueryWorkspaces.js";
import { normalizeBatchMaxParallel } from "../src/modules/operations/showQueryState.js";

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
