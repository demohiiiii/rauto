import assert from "node:assert/strict";
import test from "node:test";

import { get } from "svelte/store";
import {
  createBatchShowInputPanelWorkspace,
  createSingleShowPanelWorkspace,
} from "../src/modules/operations/showQueryWorkspaces.js";

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
