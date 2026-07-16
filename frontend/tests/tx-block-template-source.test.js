import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { txBlockInlineExecutionPayload } from "../src/modules/orchestratedExecutionState.js";

function read(path) {
  return readFileSync(path, "utf8");
}

test("transaction block execution always uses the editable inline snapshot", () => {
  assert.deepEqual(
    txBlockInlineExecutionPayload({
      connection: { host: "edge-01" },
      dryRun: false,
      recordLevel: "commands",
      txBlock: { name: "precheck", steps: [] },
      txBlockVars: { site: "dc-a" },
    }),
    {
      connection: { host: "edge-01" },
      dry_run: false,
      record_level: "commands",
      tx_block: { name: "precheck", steps: [] },
      tx_block_template_content: null,
      tx_block_template_name: null,
      tx_block_template_vars: { site: "dc-a" },
    },
  );
});

test("transaction block page merges direct and template execution into one editor", () => {
  const inputPanel = read(
    "frontend/src/pages/orchestrated/TxBlockInputPanel.svelte",
  );
  const stage = read("frontend/src/pages/orchestrated/TxBlockStage.svelte");
  const runPanel = read(
    "frontend/src/pages/orchestrated/TxBlockRunPanel.svelte",
  );

  assert.match(inputPanel, /CommandTemplateSourceField/);
  assert.match(inputPanel, /loadJsonTemplate/);
  assert.match(inputPanel, /TxBlockVisualEditor/);
  assert.match(inputPanel, /TxDirectVarsPanel/);
  assert.doesNotMatch(inputPanel, /TabList|txTemplateModeTabs/);
  assert.doesNotMatch(inputPanel, /TxTemplateRunPanel/);
  assert.doesNotMatch(
    inputPanel,
    /onDirectMode|onTemplateMode|templatePanelActive|templateVarsKey/,
  );
  assert.doesNotMatch(stage, /runTemplateExecute|onTemplateExecute/);
  assert.doesNotMatch(runPanel, /isTemplate|onTemplateExecute/);
});
