import assert from "node:assert/strict";
import test from "node:test";

import { txWorkflowInlineExecutionPayload } from "../src/domains/orchestration/index.js";

test("transaction workflow execution always uses the editable inline snapshot", () => {
  assert.deepEqual(
    txWorkflowInlineExecutionPayload({
      connection: { host: "edge-01" },
      dryRun: false,
      recordLevel: "key-events-only",
      workflowText: '{"name":"deploy","blocks":[]}',
      workflowVars: { site: "dc-a" },
    }),
    {
      connection: { host: "edge-01" },
      dry_run: false,
      record_level: "key-events-only",
      workflow: { name: "deploy", blocks: [] },
      workflow_template_content: null,
      workflow_template_name: null,
      workflow_vars: { site: "dc-a" },
    },
  );
});

test("transaction workflow execution rejects non-object JSON roots", () => {
  assert.throws(() => txWorkflowInlineExecutionPayload({ workflowText: "[]" }));
});
