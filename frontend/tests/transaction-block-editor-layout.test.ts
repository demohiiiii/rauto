import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";

import {
  createTxBlockRunPanelWorkspace,
  createTxWorkflowBlockResultPanelWorkspace,
  txWorkflowExecutionPresentation,
} from "../src/domains/transactions/index.js";

test("execution panel workspaces expose stable mapped display stores", () => {
  const blockRun = createTxBlockRunPanelWorkspace();
  const blockDisplay = get(blockRun.panelDisplayStateStore);
  blockRun.setPanelDisplay({
    ...blockDisplay,
    execStatusDisplay: {
      ...blockDisplay.execStatusDisplay,
      message: "executed",
    },
    loadingDisplay: { ...blockDisplay.loadingDisplay, execute: true },
    previewDisplay: {
      ...blockDisplay.previewDisplay,
      previewPresentation: {
        ...blockDisplay.previewDisplay.previewPresentation,
        hasSteps: true,
      },
    },
  });
  assert.equal(get(blockRun.execStatusDisplayStateStore).message, "executed");
  assert.equal(get(blockRun.loadingDisplayStateStore).execute, true);
  assert.equal(
    get(blockRun.previewDisplayStateStore).previewPresentation.hasSteps,
    true,
  );
});

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
