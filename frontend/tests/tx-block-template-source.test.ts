import assert from "node:assert/strict";
import test from "node:test";

import { txBlockInlineExecutionPayload } from "../src/domains/orchestration/index.js";

test("transaction block execution wraps the editable snapshot in a workflow", () => {
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
      workflow: {
        name: "precheck",
        blocks: [{ name: "precheck", steps: [] }],
        fail_fast: true,
      },
      workflow_template_content: null,
      workflow_template_name: null,
      workflow_vars: { site: "dc-a" },
    },
  );
});

import { orchestratedExecutionOperations } from "../src/domains/orchestration/application/orchestratedExecutionState.js";
import {
  clearTxJsonEditorsHost,
  createTxJsonEditorsHost,
  TX_OUTPUT,
} from "../src/domains/transactions/index.js";
import type { OrchestrationJsonValue } from "../src/domains/orchestration/model/types.js";

for (const scenario of ["preview", "success", "rollback"] as const) {
  test(`block editor uses workflow execution and displays ${scenario} results`, async (t) => {
    const dryRun = scenario === "preview";
    const success = scenario !== "rollback";
    const host = createTxJsonEditorsHost();
    t.after(() => clearTxJsonEditorsHost());
    const block = {
      name: "precheck",
      rollback_policy: "per_step",
      fail_fast: true,
      steps: [
        {
          run: { kind: "command", mode: "Enable", command: "show clock" },
          rollback: null,
        },
      ],
    };
    host.setTxBlockEditorJson(block);
    const blockResult = {
      block_name: "precheck",
      committed: success,
      rollback_attempted: !success,
      rollback_succeeded: !success,
      step_results: [],
    };
    const requests: Array<{ path: string; body: string }> = [];
    t.mock.method(
      globalThis,
      "fetch",
      async (path: string, init: RequestInit) => {
        requests.push({ path, body: String(init.body) });
        return Response.json({
          success,
          error: success
            ? null
            : { code: "execution_failed", message: "Rolled back" },
          result_summary: {
            operation: "tx_workflow",
            outcome: dryRun ? "dry_run" : success ? "success" : "failed",
            success,
            summary: "Workflow finished",
          },
          data: {
            workflow: { name: block.name, blocks: [block], fail_fast: true },
            tx_workflow_result: dryRun
              ? null
              : { committed: success, block_results: [blockResult] },
            recording_jsonl: null,
          },
        });
      },
    );
    const visuals: Array<
      [OrchestrationJsonValue, OrchestrationJsonValue | null]
    > = [];
    const operations = orchestratedExecutionOperations({
      txJsonEditorsHost: host,
      dependencies: {
        connectionPayload: () => ({ connection_name: "edge-01" }),
        ensureConnectionTargetSelected: () => true,
        recordLevelPayload: () => "key-events-only",
        setTxBlockVisual: (value, result) => visuals.push([value, result]),
      },
    });
    await operations.runTxBlock(
      dryRun,
      dryRun ? TX_OUTPUT.txBlockPlan : TX_OUTPUT.txBlockExec,
    );
    assert.equal(requests.length, 1);
    assert.equal(requests[0].path, "/api/tx/workflow");
    const payload = JSON.parse(requests[0].body);
    assert.deepEqual(payload.workflow.blocks, [block]);
    assert.equal(payload.dry_run, dryRun);
    assert.equal(payload.record_level, "key-events-only");
    assert.deepEqual(payload.connection, { connection_name: "edge-01" });
    assert.deepEqual(visuals, [[block, dryRun ? null : blockResult]]);
  });
}
