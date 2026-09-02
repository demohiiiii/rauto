import { tr } from "../../../lib/i18n.js";
import type { ConnectionRequestPayload } from "$domains/connections/index.js";
import type { RecordLevel } from "$domains/overlays/index.js";
import type {
  OrchestrationJsonObject,
  OrchestrationJsonValue,
} from "./types.js";

export interface TxBlockInlineExecutionInput {
  connection?: ConnectionRequestPayload;
  dryRun?: boolean;
  recordLevel?: RecordLevel;
  txBlock?: OrchestrationJsonObject;
  txBlockVars?: OrchestrationJsonObject;
}

export interface TxWorkflowInlineExecutionInput {
  connection?: ConnectionRequestPayload;
  dryRun?: boolean;
  recordLevel?: RecordLevel;
  workflowText?: string;
  workflowVars?: OrchestrationJsonObject;
}

export interface OrchestrationInlineExecutionInput {
  connection?: ConnectionRequestPayload;
  dryRun?: boolean;
  planText?: string;
  planVars?: OrchestrationJsonObject;
  recordLevel?: RecordLevel;
}

export interface TxBlockExecutionRequest {
  connection?: ConnectionRequestPayload;
  dry_run?: boolean;
  record_level?: RecordLevel;
  tx_block: OrchestrationJsonObject;
  tx_block_template_content: null;
  tx_block_template_name: null;
  tx_block_template_vars: OrchestrationJsonObject;
}

export interface TxWorkflowExecutionRequest {
  connection?: ConnectionRequestPayload;
  dry_run?: boolean;
  record_level?: RecordLevel;
  workflow: OrchestrationJsonObject;
  workflow_template_content: null;
  workflow_template_name: null;
  workflow_vars: OrchestrationJsonObject;
}

export interface OrchestrationExecutionRequest {
  base_dir: null;
  connection?: ConnectionRequestPayload;
  dry_run?: boolean;
  plan: OrchestrationJsonObject;
  plan_template_content: null;
  plan_template_name: null;
  plan_vars: OrchestrationJsonObject;
  record_level?: RecordLevel;
}

export interface TxBlockExecutionResponse {
  recording_jsonl: string | null;
  result_summary: OrchestrationJsonObject;
  tx_block: OrchestrationJsonValue;
  tx_result: OrchestrationJsonValue | null;
}

export interface TxWorkflowExecutionResponse {
  recording_jsonl: string | null;
  result_summary: OrchestrationJsonObject;
  tx_workflow_result: OrchestrationJsonValue | null;
  workflow: OrchestrationJsonValue;
}

function parseJsonObject(
  text: string,
  requiredMessageKey: string,
  invalidShapeMessageKey: string,
): OrchestrationJsonObject {
  const raw = text.trim();
  if (!raw) throw new Error(tr(requiredMessageKey));
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(tr(invalidShapeMessageKey));
  }
  return parsed as OrchestrationJsonObject;
}

export function defaultOrchestrationTemplatePayload(): OrchestrationJsonObject {
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
}: TxBlockInlineExecutionInput = {}): TxBlockExecutionRequest {
  return {
    connection,
    dry_run: dryRun,
    record_level: recordLevel,
    tx_block: txBlock,
    tx_block_template_content: null,
    tx_block_template_name: null,
    tx_block_template_vars: txBlockVars,
  };
}

export function txWorkflowInlineExecutionPayload({
  connection,
  dryRun,
  recordLevel,
  workflowText = "",
  workflowVars = {},
}: TxWorkflowInlineExecutionInput = {}): TxWorkflowExecutionRequest {
  const workflow = parseJsonObject(
    workflowText,
    "txWorkflowJsonRequired",
    "txWorkflowLoadInvalidJsonShape",
  );
  return {
    connection,
    dry_run: dryRun,
    record_level: recordLevel,
    workflow,
    workflow_template_content: null,
    workflow_template_name: null,
    workflow_vars: workflowVars,
  };
}

export function orchestrationInlineExecutionPayload({
  connection,
  dryRun,
  planText = "",
  planVars = {},
  recordLevel,
}: OrchestrationInlineExecutionInput = {}): OrchestrationExecutionRequest {
  const plan = parseJsonObject(
    planText,
    "orchestrationJsonRequired",
    "orchestrationJsonRequired",
  );
  return {
    base_dir: null,
    connection,
    dry_run: dryRun,
    plan,
    plan_template_content: null,
    plan_template_name: null,
    plan_vars: planVars,
    record_level: recordLevel,
  };
}
