import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { txWorkflowInlineExecutionPayload } from "../src/modules/orchestratedExecutionState.js";

function read(path) {
  return readFileSync(path, "utf8");
}

test("transaction workflow execution always uses the editable inline snapshot", () => {
  assert.deepEqual(
    txWorkflowInlineExecutionPayload({
      connection: { host: "edge-01" },
      dryRun: false,
      recordLevel: "commands",
      workflowText: '{"name":"deploy","blocks":[]}',
      workflowVars: { site: "dc-a" },
    }),
    {
      connection: { host: "edge-01" },
      dry_run: false,
      record_level: "commands",
      workflow: { name: "deploy", blocks: [] },
      workflow_template_content: null,
      workflow_template_name: null,
      workflow_vars: { site: "dc-a" },
    },
  );
});

test("transaction workflow page merges direct and template execution into one editor", () => {
  const inputPanel = read(
    "frontend/src/pages/orchestrated/TxWorkflowInputPanel.svelte",
  );
  const stage = read("frontend/src/pages/orchestrated/TxWorkflowStage.svelte");

  assert.match(inputPanel, /CommandTemplateSourceField/);
  assert.match(inputPanel, /loadJsonTemplate/);
  assert.match(inputPanel, /TxWorkflowVisualEditor/);
  assert.match(inputPanel, /TxDirectVarsPanel/);
  assert.doesNotMatch(inputPanel, /TabList/);
  assert.doesNotMatch(inputPanel, /TxTemplateRunPanel/);
  assert.doesNotMatch(inputPanel, /activeMode|modeTabs|templatePanelActive/);
  assert.doesNotMatch(stage, /txTemplateModeTabs|onSelectMode|activeMode/);
});
