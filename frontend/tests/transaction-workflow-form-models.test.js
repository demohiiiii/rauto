import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultTxWorkflowTemplatePayload,
  txWorkflowEditorFormStateFromJsonText,
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
} from "../src/domains/transactions/index.js";

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

test("workflow template variables preserve explicit null through form round trip", () => {
  const model = txWorkflowFormModelFromJson({
    name: "null-vars",
    blocks: [
      {
        tx_block_template_name: "base",
        tx_block_template_vars: null,
      },
    ],
  });

  assert.equal(model.blocks[0].templateRef.txBlockTemplateVars, null);
  assert.equal(
    JSON.parse(txWorkflowFormModelToJsonText(model)).blocks[0]
      .tx_block_template_vars,
    null,
  );
});
