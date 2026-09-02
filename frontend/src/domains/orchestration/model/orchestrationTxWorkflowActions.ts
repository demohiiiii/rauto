import { cloneJsonValue, plainObject } from "../../../lib/jsonValue.js";
import {
  orchestrationCreateTxWorkflowActionModel,
  orchestrationPatchJobDraft,
} from "./orchestrationPlanFormModels.js";
import { orchestrationJsonPatchResult } from "./orchestrationTargetFormModels.js";
import type {
  JsonObject,
  OrchestrationJsonPatchResult,
  OrchestrationPlanFormModel,
  OrchestrationTxWorkflowActionModel,
  OrchestrationWorkflowSourceMode,
} from "./types.js";

const cloneOrchestrationJsonValue = <T>(value: unknown, fallback: T): T =>
  (cloneJsonValue as (source: unknown, fallbackValue: unknown) => unknown)(
    value,
    fallback,
  ) as T;

export function orchestrationTxWorkflowFieldPatch(
  fieldKey: string = "",
  fieldValue: unknown = null,
): Partial<OrchestrationTxWorkflowActionModel> {
  if (fieldKey === "workflowTemplateName") {
    return {
      workflowTemplateName:
        fieldValue == null ? null : String(fieldValue).trim(),
      hasWorkflowTemplateName: true,
    };
  }
  if (fieldKey === "workflow") {
    if (fieldValue !== null && !plainObject(fieldValue)) {
      throw new TypeError("workflow must be a JSON object");
    }
    return {
      workflow:
        fieldValue === null
          ? null
          : cloneOrchestrationJsonValue(fieldValue, {}),
      hasWorkflow: true,
    };
  }
  if (fieldKey === "workflowVars") {
    if (!plainObject(fieldValue)) {
      throw new TypeError("workflow_vars must be a JSON object");
    }
    return {
      workflowVars: cloneOrchestrationJsonValue(fieldValue, {}),
      hasWorkflowVars: true,
    };
  }
  return {};
}

export function orchestrationPatchTxWorkflowAction(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  patch: Partial<OrchestrationTxWorkflowActionModel> = {},
): OrchestrationPlanFormModel {
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => ({
    ...job,
    action: {
      kind: "tx_workflow",
      txWorkflow: {
        ...(job.action?.txWorkflow ||
          orchestrationCreateTxWorkflowActionModel()),
        ...patch,
      },
    },
  }));
}

export function orchestrationUpdateInlineWorkflow(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  workflow: JsonObject = {},
): OrchestrationPlanFormModel {
  return orchestrationPatchTxWorkflowAction(model, stageIndex, jobIndex, {
    workflow: cloneOrchestrationJsonValue(workflow, {}),
    hasWorkflow: true,
    workflowTemplateName: null,
    hasWorkflowTemplateName: false,
    workflowVars: {},
    hasWorkflowVars: false,
  });
}

export function orchestrationTxWorkflowActionJsonFieldUpdateResult(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  field: string,
  jsonText: string,
): OrchestrationJsonPatchResult<OrchestrationPlanFormModel> {
  return orchestrationJsonPatchResult(model, jsonText, null, (parsedJson) =>
    orchestrationPatchTxWorkflowAction(
      model,
      stageIndex,
      jobIndex,
      orchestrationTxWorkflowFieldPatch(field, parsedJson),
    ),
  );
}

export function orchestrationSelectTxWorkflowActionSource(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  sourceValue: OrchestrationWorkflowSourceMode,
): OrchestrationPlanFormModel {
  const source =
    sourceValue === "workflow_template_name"
      ? "workflow_template_name"
      : "workflow_json";
  const patch: Partial<OrchestrationTxWorkflowActionModel> = {
    workflow: null,
    hasWorkflow: false,
    workflowTemplateName: null,
    hasWorkflowTemplateName: false,
    workflowVars: {},
    hasWorkflowVars: false,
  };
  return orchestrationPatchTxWorkflowAction(
    model,
    stageIndex,
    jobIndex,
    source === "workflow_json"
      ? { ...patch, hasWorkflow: true }
      : { ...patch, hasWorkflowTemplateName: true },
  );
}
