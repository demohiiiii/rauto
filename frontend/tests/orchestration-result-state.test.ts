import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";

import {
  createOrchestrationExecutionPanelWorkspace,
  createOrchestrationJsonSectionWorkspace,
  createOrchestrationPreviewPanelWorkspace,
  orchestrationDetailDisplay,
  orchestrationExecutionDetailAt,
  orchestrationExecutionPanelDisplay,
  orchestrationExecutionPresentation,
  orchestrationStageExecutionDisplayPresentation,
} from "../src/domains/orchestration/index.js";
import type { OrchestrationExecutionResult } from "../src/domains/orchestration/index.js";

function executionResult(): OrchestrationExecutionResult {
  return {
    plan_name: "rollout",
    success: true,
    executed_stages: 1,
    fail_fast: true,
    total_stages: 1,
    stages: [
      {
        name: "prepare",
        fail_fast: true,
        strategy: "parallel",
        status: "success",
        jobs_total: 1,
        jobs_succeeded: 1,
        jobs_failed: 0,
        jobs_skipped: 0,
        jobs: [
          {
            name: "collect",
            status: "success",
            action_kind: "tx_workflow",
            action_summary: "transaction workflow",
            fail_fast: true,
            strategy: "parallel",
            targets_total: 1,
            targets_succeeded: 1,
            targets_failed: 0,
            targets_skipped: 0,
            results: [
              {
                label: "switch-1",
                status: "success",
                connection_name: "switch-1",
                host: "192.0.2.10",
                operation: "tx_workflow",
                duration_ms: 25,
                compensation: null,
                error: null,
                recording_jsonl: null,
                tx_result: null,
                workflow_result: { success: true },
              },
            ],
          },
        ],
      },
    ],
  };
}

test("orchestration execution presentation indexes stage and target details", () => {
  const presentation = orchestrationExecutionPresentation(executionResult());
  const stageDetail = orchestrationExecutionDetailAt(
    presentation.detailIndex,
    0,
  );
  const targetDetail = orchestrationExecutionDetailAt(
    presentation.detailIndex,
    0,
    0,
    0,
  );

  assert.ok(stageDetail);
  assert.ok(targetDetail);
  assert.equal(presentation.stageCountText, "1/1");
  assert.equal(presentation.stageRows[0].jobs[0].targetRows.length, 1);
  assert.equal(stageDetail.detail.kind, "stage");
  assert.equal(targetDetail.detail.kind, "target");
  assert.equal(targetDetail.detail.target.host, "192.0.2.10");
  assert.equal(
    orchestrationExecutionDetailAt(presentation.detailIndex, 3),
    null,
  );
});

test("orchestration target detail exposes structured payload sections", () => {
  const presentation = orchestrationExecutionPresentation(executionResult());
  const targetDetail = orchestrationExecutionDetailAt(
    presentation.detailIndex,
    0,
    0,
    0,
  );
  assert.ok(targetDetail);
  const display = orchestrationDetailDisplay(targetDetail.detail);

  assert.equal(display.host, "192.0.2.10");
  assert.equal(display.hasPayloadSections, true);
  assert.equal(display.payloadSections.length, 1);
  assert.deepEqual(display.payloadSections[0].jsonValue, { success: true });
});

test("orchestration execution display prefers fallback status", () => {
  const executionDisplay = orchestrationStageExecutionDisplayPresentation({
    executionFallback: {
      mode: "status",
      message: "running",
      tone: "running",
    },
    executionPayload: executionResult(),
  });
  const panelDisplay = orchestrationExecutionPanelDisplay(executionDisplay);

  assert.equal(panelDisplay.executionModeDisplay.showStatus, true);
  assert.equal(panelDisplay.resultDisplay.hasResult, false);
  assert.equal(panelDisplay.statusDisplay.message, "running");
});

test("orchestration result workspaces refresh their derived displays", () => {
  const jsonWorkspace = createOrchestrationJsonSectionWorkspace();
  jsonWorkspace.setJsonValue({ result: "ok" });
  assert.match(
    get(jsonWorkspace.orchestrationJsonSectionDisplayStateStore).rawText,
    /"ok"/,
  );

  const previewWorkspace = createOrchestrationPreviewPanelWorkspace();
  previewWorkspace.setPreviewInputs({
    plan: {
      fail_fast: false,
      name: "rollout",
      rollback_completed_stages_on_failure: false,
      rollback_on_stage_failure: false,
      stages: [],
    },
    previewMode: "result",
  });
  assert.equal(
    get(previewWorkspace.previewPresentationStateStore).hasPlan,
    true,
  );
  assert.equal(
    get(previewWorkspace.previewModeDisplayStateStore).showResult,
    true,
  );

  const executionWorkspace = createOrchestrationExecutionPanelWorkspace();
  executionWorkspace.setExecutionPanelContext({
    panelDisplay: orchestrationExecutionPanelDisplay(
      orchestrationStageExecutionDisplayPresentation({
        executionPayload: executionResult(),
      }),
    ),
  });
  assert.equal(get(executionWorkspace.resultDisplayStateStore).hasResult, true);
});
