import { tr } from "../../../lib/i18n.js";
import type { JsonObject } from "./types.js";

interface TxBlockInlineExecutionInput {
  connection?: unknown;
  dryRun?: unknown;
  recordLevel?: unknown;
  txBlock?: unknown;
  txBlockVars?: unknown;
}

interface TxWorkflowInlineExecutionInput {
  connection?: unknown;
  dryRun?: unknown;
  recordLevel?: unknown;
  workflowText?: unknown;
  workflowVars?: unknown;
}

interface OrchestrationInlineExecutionInput {
  connection?: unknown;
  dryRun?: unknown;
  planText?: unknown;
  planVars?: unknown;
  recordLevel?: unknown;
}

const objectValue = (value: unknown): JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};

const textValue = (value: unknown): string =>
  value == null ? "" : typeof value === "string" ? value : String(value);

export function defaultOrchestrationTemplatePayload(): JsonObject {
  return {
    name: "campus-rollout-demo",
    fail_fast: true,
    rollback_on_stage_failure: true,
    rollback_completed_stages_on_failure: false,
    stages: [
      {
        name: "deploy-phase",
        strategy: "parallel",
        max_parallel: 2,
        jobs: [
          {
            name: "transfer-image",
            strategy: "serial",
            target_groups: ["edge_nodes"],
            target_tags: ["edge"],
            action: {
              kind: "tx_block",
              name: "scp-transfer",
              flow_template_name: "scp",
              flow_vars: {
                peer: "edge94",
                local_path: "/tmp/app.tar",
                remote_path: "/tmp/app.tar",
              },
              timeout_secs: 1200,
            },
          },
          {
            name: "precheck",
            strategy: "parallel",
            max_parallel: 4,
            target_groups: ["edge_nodes"],
            action: {
              kind: "tx_block",
              tx_block_template_name: "precheck",
              tx_block_template_vars: {},
            },
          },
          {
            name: "deploy",
            strategy: "parallel",
            max_parallel: 4,
            target_groups: ["edge_nodes"],
            action: {
              kind: "tx_workflow",
              workflow_template_name: "safe-deploy",
              workflow_vars: {},
            },
          },
        ],
      },
    ],
  };
}

export function txBlockInlineExecutionPayload({
  connection,
  dryRun,
  recordLevel,
  txBlock = {},
  txBlockVars = {},
}: TxBlockInlineExecutionInput = {}): JsonObject {
  return {
    connection,
    dry_run: dryRun,
    record_level: recordLevel,
    tx_block: txBlock,
    tx_block_template_content: null,
    tx_block_template_name: null,
    tx_block_template_vars: objectValue(txBlockVars),
  };
}

export function txWorkflowInlineExecutionPayload({
  connection,
  dryRun,
  recordLevel,
  workflowText = "",
  workflowVars = {},
}: TxWorkflowInlineExecutionInput = {}): JsonObject {
  const raw = textValue(workflowText).trim();
  if (!raw) throw new Error(tr("txWorkflowJsonRequired"));
  const workflow: unknown = JSON.parse(raw);
  return {
    connection,
    dry_run: dryRun,
    record_level: recordLevel,
    workflow,
    workflow_template_content: null,
    workflow_template_name: null,
    workflow_vars: objectValue(workflowVars),
  };
}

export function orchestrationInlineExecutionPayload({
  connection,
  dryRun,
  planText = "",
  planVars = {},
  recordLevel,
}: OrchestrationInlineExecutionInput = {}): JsonObject {
  const raw = textValue(planText).trim();
  if (!raw) throw new Error(tr("orchestrationJsonRequired"));
  const plan: unknown = JSON.parse(raw);
  return {
    base_dir: null,
    connection,
    dry_run: dryRun,
    plan,
    plan_template_content: null,
    plan_template_name: null,
    plan_vars: objectValue(planVars),
    record_level: recordLevel,
  };
}
