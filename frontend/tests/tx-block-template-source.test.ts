import assert from "node:assert/strict";
import test from "node:test";

import { txBlockInlineExecutionPayload } from "../src/domains/orchestration/index.js";

test("transaction block execution always uses the editable inline snapshot", () => {
  assert.deepEqual(
    txBlockInlineExecutionPayload({
      connection: { host: "edge-01" },
      dryRun: false,
      recordLevel: "key-events-only",
      txBlock: { name: "precheck", steps: [] },
      txBlockVars: { site: "dc-a" },
    }),
    {
      connection: { host: "edge-01" },
      dry_run: false,
      record_level: "key-events-only",
      tx_block: { name: "precheck", steps: [] },
      tx_block_template_content: null,
      tx_block_template_name: null,
      tx_block_template_vars: { site: "dc-a" },
    },
  );
});
