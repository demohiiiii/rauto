import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  orchestrationTxWorkflowActionSourceValue,
  orchestrationTxWorkflowSourceDisplay,
} from "../src/modules/orchestration/orchestrationActionDisplayState.js";

function read(path) {
  return readFileSync(path, "utf8");
}

test("orchestration workflow source offers inline and saved-template editing", () => {
  const source = read(
    "frontend/src/pages/orchestrated/OrchestrationTxWorkflowSourceEditor.svelte",
  );

  assert.match(source, /TxJsonFormSurface/);
  assert.match(source, /TxWorkflowVisualEditor/);
  assert.match(source, /embedded=\{true\}/);
  assert.match(source, /PlainSelectField/);
  assert.match(source, /JsonObjectFieldsEditor/);
  assert.doesNotMatch(source, /workflowFile|templateContent/);
});

test("orchestration workflow source derives the active backend source", () => {
  assert.equal(
    orchestrationTxWorkflowActionSourceValue({ workflow: { blocks: [] } }),
    "workflow_json",
  );
  assert.equal(
    orchestrationTxWorkflowActionSourceValue({
      workflowTemplateName: "edge-upgrade",
    }),
    "workflow_template_name",
  );

  const templateDisplay = orchestrationTxWorkflowSourceDisplay({
    workflowTemplateName: "edge-upgrade",
    workflowVars: { version: "17.9" },
  });
  assert.equal(templateDisplay.primaryField.controlType, "select");
  assert.equal(templateDisplay.varsField.source.version, "17.9");
});
