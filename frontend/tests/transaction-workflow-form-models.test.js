import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultTxWorkflowTemplatePayload,
  txWorkflowEditorFormStateFromJsonText,
  txWorkflowFormModelFromJson,
} from "../src/modules/transactions/transactionWorkflowFormModels.js";

test("workflow parser preserves the model and reports invalid JSON location", () => {
  const currentModel = txWorkflowFormModelFromJson(
    defaultTxWorkflowTemplatePayload(),
  );
  const invalidText = '{\n  "name": "draft",\n}';

  const state = txWorkflowEditorFormStateFromJsonText(
    invalidText,
    currentModel,
  );

  assert.equal(state.formModel, currentModel);
  assert.equal(state.formError.length > 0, true);
  assert.deepEqual(state.formErrorDetail, {
    message: state.formError,
    line: 3,
    column: 1,
  });
});
