import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";

import {
  createTxWorkflowBlockResultPanelWorkspace,
  txWorkflowExecutionPresentation,
} from "../src/domains/transactions/index.js";

test("workflow block results reuse the transaction result presentation", () => {
  const display = txWorkflowExecutionPresentation({
    block_results: [
      {
        block_name: "precheck",
        block_rollback_operation_summary: "undo precheck",
        block_rollback_steps: [
          { all: "restored", operation_summary: "undo", success: true },
        ],
        committed: false,
        executed_steps: 1,
        failure_reason: "failed output='denied'",
        rollback_attempted: true,
        rollback_errors: ["undo warning"],
        rollback_succeeded: false,
        step_results: [],
      },
    ],
    failed_block: 0,
  });
  const [blockRow] = display.blockRows;
  const blockResult = createTxWorkflowBlockResultPanelWorkspace({
    workflowBlockRow: blockRow,
  });

  assert.equal(
    get(blockResult.panelDisplayStateStore).headerDisplay.title,
    blockRow.title,
  );
  assert.equal(blockRow.failureOutput, "denied");
  assert.equal(blockRow.hasRollbackErrors, true);
  assert.equal(blockRow.hasRollbackStepRows, true);
  assert.equal(blockRow.showFailureOutput, true);
  assert.deepEqual(
    blockRow.blockSummaryRows.map((row) => row.valueText),
    ["1", "true", "false"],
  );
});
