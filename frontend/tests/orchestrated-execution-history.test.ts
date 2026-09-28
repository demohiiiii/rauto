import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import {
  createExecutionHistory,
  executionHistory,
} from "../src/domains/execution/application/executionHistory.js";
import { parseExecutionHistory } from "../src/domains/execution/infrastructure/executionHistoryPersistence.js";
import {
  orchestratedExecutionOperations,
  type OrchestratedExecutionDependencies,
} from "../src/domains/orchestration/application/orchestratedExecutionState.js";
import {
  createTxJsonEditorsHost,
  clearTxJsonEditorsHost,
} from "../src/domains/transactions/index.js";
import {
  createOrchestrationExecutionPanelWorkspace,
  orchestrationExecutionPanelDisplay,
  orchestrationStageExecutionDisplayPresentation,
} from "../src/domains/orchestration/index.js";
import type { OrchestrationExecutionResult } from "../src/domains/orchestration/index.js";
import { orchestrationDetailRuntime } from "../src/domains/orchestration/infrastructure/orchestrationDetailRuntime.js";

function result(): OrchestrationExecutionResult {
  return {
    plan_name: "original plan",
    success: false,
    executed_stages: 1,
    total_stages: 1,
    fail_fast: true,
    stages: [
      {
        name: "deploy",
        status: "failed",
        strategy: "parallel",
        fail_fast: true,
        jobs_total: 1,
        jobs_succeeded: 0,
        jobs_failed: 1,
        jobs_skipped: 0,
        jobs: [
          {
            name: "change",
            action_kind: "tx_workflow",
            action_summary: "deploy",
            status: "failed",
            strategy: "serial",
            fail_fast: true,
            targets_total: 1,
            targets_succeeded: 0,
            targets_failed: 1,
            targets_skipped: 0,
            results: [
              {
                label: "original device",
                host: "192.0.2.1",
                connection_name: "original device",
                duration_ms: 20,
                status: "failed",
                operation: "tx_workflow",
                error: "rejected",
                tx_result: null,
                recording_jsonl: "private session",
                workflow_result: {
                  committed: false,
                  rollback_errors: ["rollback failed"],
                },
                compensation: {
                  attempted: true,
                  success: false,
                  duration_ms: 5,
                  error: "compensation failed",
                  operation: "rollback",
                  reason: "job failed",
                  scope: "stage",
                  recording_jsonl: "private compensation",
                  tx_result: { output: "diagnostics" },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

test("rich history restores rollback and compensation details without session recordings", async (t) => {
  const ledger = createExecutionHistory();
  const workflow = {
    workflow_name: "original workflow",
    committed: false,
    block_results: [
      {
        block_name: "b1",
        recording_jsonl: "private",
        failure_reason: "failed",
      },
    ],
    rollback_errors: ["rollback failed"],
  };
  const workflowId = ledger.start("tx-workflow", "single");
  assert.equal(
    ledger.finishDetail(workflowId, {
      kind: "tx-workflow",
      device: "router",
      result: workflow,
    }),
    false,
  );
  const orchestration = result();
  const orchestrationId = ledger.start("orchestrate", "batch");
  ledger.finishDetail(orchestrationId, {
    kind: "orchestrate",
    result: orchestration,
  });
  workflow.workflow_name = "edited";
  orchestration.plan_name = "edited";
  orchestration.stages[0].jobs[0].results[0].host = "192.0.2.99";
  const saved = JSON.stringify(get(ledger.state));
  assert.equal(saved.includes("private"), false);
  const restored = parseExecutionHistory(saved);
  assert.equal(restored.entries.length, 2);
  assert.ok(restored.entries.every((entry) => entry.status === "error"));
  const wf = restored.entries.find((entry) => entry.id === workflowId)?.detail;
  assert.equal(wf?.kind, "tx-workflow");
  assert.match(JSON.stringify(wf), /original workflow/);
  assert.match(JSON.stringify(wf), /rollback failed/);
  const detail = restored.entries.find(
    (entry) => entry.id === orchestrationId,
  )?.detail;
  assert.ok(detail?.kind === "orchestrate" && detail.result);
  assert.equal(detail.result.plan_name, "original plan");
  assert.equal(
    detail.result.stages[0].jobs[0].results[0].compensation?.error,
    "compensation failed",
  );
  const opened: Parameters<typeof orchestrationDetailRuntime.openDetail>[0][] =
    [];
  t.mock.method(
    orchestrationDetailRuntime,
    "openDetail",
    async (
      payload: Parameters<typeof orchestrationDetailRuntime.openDetail>[0],
    ) => {
      opened.push(payload);
    },
  );
  const panel = createOrchestrationExecutionPanelWorkspace({
    panelDisplay: orchestrationExecutionPanelDisplay(
      orchestrationStageExecutionDisplayPresentation({
        executionPayload: detail.result,
      }),
    ),
  });
  get(panel.executionCallbacksStateStore)
    .stagePanelCallbacks(0)
    .openTargetDetailHandler(0, 0)();
  assert.match(JSON.stringify(opened[0]), /192\.0\.2\.1/);
  assert.doesNotMatch(JSON.stringify(opened[0]), /192\.0\.2\.99/);
  get(panel.executionCallbacksStateStore)
    .stagePanelCallbacks(0)
    .openStageDetail();
  assert.match(JSON.stringify(opened[1]), /original plan/);
  let localDetail = "";
  panel.setExecutionPanelContext({
    panelDisplay: orchestrationExecutionPanelDisplay(
      orchestrationStageExecutionDisplayPresentation({
        executionPayload: detail.result,
      }),
    ),
    onOpenDetail: (entry) => {
      localDetail = JSON.stringify(entry);
    },
  });
  get(panel.executionCallbacksStateStore)
    .stagePanelCallbacks(0)
    .openTargetDetailHandler(0, 0)();
  assert.match(localDetail, /192\.0\.2\.1/);
  assert.equal(
    opened.length,
    2,
    "embedded history details must not open the global modal",
  );
});

test("malformed rich session details cannot reach the result viewer", () => {
  const ledger = createExecutionHistory();
  const id = ledger.start("orchestrate", "batch");
  ledger.finishDetail(id, { kind: "orchestrate", result: result() });
  const valid = get(ledger.state).entries[0];
  const invalid = [
    { ...valid, detail: { kind: "orchestrate", result: { stages: [{}] } } },
    {
      ...valid,
      detail: { kind: "tx-workflow", result: {}, device: "wrong feature" },
    },
    {
      ...valid,
      detail: { kind: "orchestrate", result: { ...result(), stages: [null] } },
    },
  ];
  for (const entry of invalid)
    assert.equal(
      parseExecutionHistory(JSON.stringify({ entries: [entry] })).entries
        .length,
      0,
    );
});

test("workflow completion survives editor teardown and keeps the submitted device", async (t) => {
  const host = createTxJsonEditorsHost();
  host.setTxWorkflowEditorJson({ name: "workflow", blocks: [] });
  let resolve!: (response: Response) => void;
  t.mock.method(
    globalThis,
    "fetch",
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  let connectionName = "original device";
  const toasts: string[] = [];
  const dependencies: OrchestratedExecutionDependencies = {
    connectionPayload: () => ({
      connection_name: connectionName,
      password: "request secret",
    }),
    ensureConnectionTargetSelected: () => true,
    recordLevelPayload: () => "full",
    showToast: (_message, tone) => toasts.push(tone),
  };
  const operations = orchestratedExecutionOperations({ dependencies });
  const pending = operations.executeTxWorkflow();
  const id = get(executionHistory.state).entries.find(
    (entry) => entry.feature === "tx-workflow",
  )!.id;
  assert.equal(
    get(executionHistory.state).entries.find((entry) => entry.id === id)
      ?.status,
    "running",
  );
  connectionName = "another device";
  clearTxJsonEditorsHost(host);
  resolve(
    Response.json({
      success: false,
      error: null,
      result_summary: null,
      data: {
        workflow: {},
        tx_workflow_result: {
          workflow_name: "workflow",
          committed: false,
          rollback_errors: ["rollback failed"],
          block_results: [],
        },
      },
    }),
  );
  await pending;
  const entry = get(executionHistory.state).entries.find(
    (entry) => entry.id === id,
  )!;
  assert.equal(entry.status, "error");
  assert.ok(entry.detail?.kind === "tx-workflow");
  assert.equal(entry.detail.device, "original device");
  assert.doesNotMatch(JSON.stringify(entry), /request secret/);
  assert.deepEqual(toasts, ["error"]);
});

test("orchestration records success and transport failures while previews do not create history", async (t) => {
  const host = createTxJsonEditorsHost();
  t.after(() => clearTxJsonEditorsHost(host));
  host.setOrchestrationEditorJson({ name: "plan", stages: [] });
  const dependencies: OrchestratedExecutionDependencies = {
    connectionPayload: () => ({}),
    ensureConnectionTargetSelected: () => true,
    recordLevelPayload: () => "full",
  };
  const operations = orchestratedExecutionOperations({ dependencies });
  let fail = false;
  t.mock.method(globalThis, "fetch", async () => {
    if (fail) throw new Error("offline");
    return Response.json({
      success: true,
      error: null,
      result_summary: null,
      data: { plan: {}, orchestration_result: { ...result(), success: true } },
    });
  });
  const before = get(executionHistory.state).entries.length;
  await operations.previewOrchestration();
  assert.equal(get(executionHistory.state).entries.length, before);
  await operations.executeOrchestration();
  const completed = get(executionHistory.state).entries.find(
    (entry) => entry.feature === "orchestrate",
  )!;
  assert.equal(completed.status, "success");
  fail = true;
  await operations.executeOrchestration();
  const failed = get(executionHistory.state).entries.find(
    (entry) => entry.feature === "orchestrate" && entry.id !== completed.id,
  )!;
  assert.equal(failed.status, "error");
  assert.equal(failed.message, "offline");
  host.setOrchestrationEditorText("{invalid");
  await operations.executeOrchestration();
  assert.equal(
    get(executionHistory.state).entries.filter(
      (entry) => entry.feature === "orchestrate" && entry.status === "error",
    ).length,
    2,
  );
});
