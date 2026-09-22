import assert from "node:assert/strict";
import test from "node:test";
import {
  orchestrationTxWorkflowActionSourceValue,
  orchestrationTxWorkflowSourceDisplay,
} from "../src/domains/orchestration/index.js";

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
  assert.ok(templateDisplay.varsField);
  assert.equal(templateDisplay.varsField.source.version, "17.9");
});
