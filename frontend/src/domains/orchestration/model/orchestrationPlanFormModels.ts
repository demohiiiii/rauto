import {
  cloneJsonValue,
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../../../lib/jsonValue.js";
import { orchestrationObjectExtra } from "./orchestrationTargetFormModels.js";
import type {
  JsonObject,
  OrchestrationActionModel,
  OrchestrationJobModel,
  OrchestrationPlanFormModel,
  OrchestrationPlanParseResult,
  OrchestrationStageModel,
  OrchestrationTxWorkflowActionModel,
} from "./types.js";

const cloneOrchestrationJsonValue = <T>(value: unknown, fallback: T): T =>
  (cloneJsonValue as (source: unknown, fallbackValue: unknown) => unknown)(
    value,
    fallback,
  ) as T;
const orchestrationPlainObject = (value: unknown): value is JsonObject =>
  plainObject(value) === true;
const orchestrationStringValue = (value: unknown, fallback = ""): string =>
  stringValue(value, fallback);
const orchestrationNullableNumberValue = (value: unknown): number | null =>
  nullableNumberValue(value);

const ORCHESTRATION_ACTION_FIELDS = new Set([
  "kind",
  "workflow",
  "workflow_template_name",
  "workflow_vars",
]);

function orchestrationSavedConnectionName(
  value: unknown,
  targetIndex = 0,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(
      `targets[${targetIndex}] must be a non-empty saved connection name`,
    );
  }
  return value.trim();
}

function orchestrationWithoutUnsupportedLabels(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(orchestrationWithoutUnsupportedLabels);
  }
  if (!orchestrationPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.endsWith("_label"))
      .map(([key, entryValue]) => [
        key,
        orchestrationWithoutUnsupportedLabels(entryValue),
      ]),
  );
}

function orchestrationDefaultWorkflow(): JsonObject {
  return {
    name: "workflow",
    blocks: [],
    fail_fast: true,
  };
}

function orchestrationTxWorkflowActionModelFromJson(
  source: unknown = {},
): OrchestrationTxWorkflowActionModel {
  const value = orchestrationPlainObject(source) ? source : {};
  const workflow = cloneOrchestrationJsonValue(value.workflow, null);
  const workflowTemplateName =
    typeof value.workflow_template_name === "string"
      ? value.workflow_template_name
      : null;
  return {
    workflow,
    hasWorkflow: Object.hasOwn(value, "workflow"),
    workflowTemplateName,
    hasWorkflowTemplateName: Object.hasOwn(value, "workflow_template_name"),
    workflowVars: cloneOrchestrationJsonValue(value.workflow_vars, {}),
    hasWorkflowVars: Object.hasOwn(value, "workflow_vars"),
  };
}

function orchestrationValidateActionJson(
  source: unknown,
): asserts source is JsonObject {
  if (!orchestrationPlainObject(source) || source.kind !== "tx_workflow") {
    const kind = orchestrationPlainObject(source) ? source.kind : undefined;
    throw new TypeError(
      `unsupported orchestration action kind: ${orchestrationStringValue(
        kind,
        "missing",
      )}`,
    );
  }
  for (const key of Object.keys(source)) {
    if (!ORCHESTRATION_ACTION_FIELDS.has(key)) {
      throw new TypeError(`unsupported orchestration action field: ${key}`);
    }
  }
  const hasWorkflow = Object.hasOwn(source, "workflow");
  const hasTemplate =
    Object.hasOwn(source, "workflow_template_name") &&
    typeof source.workflow_template_name === "string" &&
    !!source.workflow_template_name.trim();
  if (Number(hasWorkflow) + Number(hasTemplate) !== 1) {
    throw new TypeError(
      "unsupported orchestration action sources: use workflow or workflow_template_name",
    );
  }
  if (
    hasWorkflow &&
    Object.hasOwn(source, "workflow_vars") &&
    source.workflow_vars != null
  ) {
    throw new TypeError(
      "unsupported orchestration action field: workflow_vars requires workflow_template_name",
    );
  }
  if (
    hasTemplate &&
    Object.hasOwn(source, "workflow_vars") &&
    !orchestrationPlainObject(source.workflow_vars)
  ) {
    throw new TypeError(
      "unsupported orchestration action field: workflow_vars must be an object",
    );
  }
}

function orchestrationTxWorkflowActionJsonFromModel(
  model: Partial<OrchestrationTxWorkflowActionModel> = {},
): JsonObject {
  const result: JsonObject = {};
  if (model.hasWorkflow || model.workflow !== null) {
    result.workflow = cloneOrchestrationJsonValue(model.workflow, null);
  }
  if (model.hasWorkflowTemplateName || model.workflowTemplateName !== null) {
    result.workflow_template_name = model.workflowTemplateName ?? null;
  }
  if (
    result.workflow_template_name &&
    (model.hasWorkflowVars ||
      (orchestrationPlainObject(model.workflowVars) &&
        Object.keys(model.workflowVars).length > 0))
  ) {
    result.workflow_vars = cloneOrchestrationJsonValue(model.workflowVars, {});
  }
  return result;
}

function orchestrationActionModelFromJson(
  source: unknown,
): OrchestrationActionModel {
  orchestrationValidateActionJson(source);
  return {
    kind: "tx_workflow",
    txWorkflow: orchestrationTxWorkflowActionModelFromJson(source),
  };
}

function orchestrationActionJsonFromModel(
  model: Partial<OrchestrationActionModel> = {},
): JsonObject {
  return {
    kind: "tx_workflow",
    ...orchestrationTxWorkflowActionJsonFromModel(model.txWorkflow || {}),
  };
}

function orchestrationJobModelFromJson(
  source: unknown = {},
): OrchestrationJobModel {
  const value = orchestrationPlainObject(source) ? source : {};
  return {
    name: value.name ?? null,
    hasName: Object.hasOwn(value, "name"),
    strategy: value.strategy === "parallel" ? "parallel" : "serial",
    maxParallel: orchestrationNullableNumberValue(value.max_parallel),
    hasMaxParallel: Object.hasOwn(value, "max_parallel"),
    failFast: typeof value.fail_fast === "boolean" ? value.fail_fast : null,
    hasFailFast: Object.hasOwn(value, "fail_fast"),
    targetGroups: Array.isArray(value.target_groups)
      ? value.target_groups.map((targetGroup) =>
          orchestrationStringValue(targetGroup),
        )
      : [],
    hasTargetGroups: Object.hasOwn(value, "target_groups"),
    targetTags: Array.isArray(value.target_tags)
      ? value.target_tags.map((targetTag) =>
          orchestrationStringValue(targetTag),
        )
      : [],
    hasTargetTags: Object.hasOwn(value, "target_tags"),
    targets: Array.isArray(value.targets)
      ? value.targets.map((target, targetIndex) =>
          orchestrationSavedConnectionName(target, targetIndex),
        )
      : [],
    hasTargets: Object.hasOwn(value, "targets"),
    action: orchestrationActionModelFromJson(value.action),
    extra: orchestrationObjectExtra(
      value,
      new Set([
        "name",
        "strategy",
        "max_parallel",
        "fail_fast",
        "target_groups",
        "target_tags",
        "targets",
        "action",
      ]),
    ),
  };
}

function orchestrationJobJsonFromModel(
  model: Partial<OrchestrationJobModel> = {},
): JsonObject {
  const result: JsonObject = {
    strategy: model.strategy === "parallel" ? "parallel" : "serial",
    action: orchestrationActionJsonFromModel(model.action || {}),
  };
  if (model.hasName || model.name !== null) result.name = model.name ?? null;
  if (model.hasMaxParallel || model.maxParallel !== null) {
    result.max_parallel = orchestrationNullableNumberValue(model.maxParallel);
  }
  if (model.hasFailFast || model.failFast !== null) {
    result.fail_fast = !!model.failFast;
  }
  if (
    model.hasTargetGroups ||
    (Array.isArray(model.targetGroups) && model.targetGroups.length > 0)
  ) {
    result.target_groups = Array.isArray(model.targetGroups)
      ? model.targetGroups.map((targetGroup) =>
          orchestrationStringValue(targetGroup),
        )
      : [];
  }
  if (
    model.hasTargetTags ||
    (Array.isArray(model.targetTags) && model.targetTags.length > 0)
  ) {
    result.target_tags = Array.isArray(model.targetTags)
      ? model.targetTags.map((targetTag) => orchestrationStringValue(targetTag))
      : [];
  }
  if (
    model.hasTargets ||
    (Array.isArray(model.targets) && model.targets.length > 0)
  ) {
    result.targets = Array.isArray(model.targets)
      ? model.targets.map((target, targetIndex) =>
          orchestrationSavedConnectionName(target, targetIndex),
        )
      : [];
  }
  return result;
}

function orchestrationStageModelFromJson(
  source: unknown = {},
): OrchestrationStageModel {
  const value = orchestrationPlainObject(source) ? source : {};
  return {
    name: orchestrationStringValue(value.name),
    hasName: Object.hasOwn(value, "name"),
    strategy: value.strategy === "parallel" ? "parallel" : "serial",
    maxParallel: orchestrationNullableNumberValue(value.max_parallel),
    hasMaxParallel: Object.hasOwn(value, "max_parallel"),
    failFast: typeof value.fail_fast === "boolean" ? value.fail_fast : null,
    hasFailFast: Object.hasOwn(value, "fail_fast"),
    jobs: Array.isArray(value.jobs)
      ? value.jobs.map((job) => orchestrationJobModelFromJson(job))
      : [],
    hasJobs: Object.hasOwn(value, "jobs"),
    extra: orchestrationObjectExtra(
      value,
      new Set(["name", "strategy", "max_parallel", "fail_fast", "jobs"]),
    ),
  };
}

export function orchestrationCreateStageModel(): OrchestrationStageModel {
  return orchestrationStageModelFromJson({
    name: "",
    strategy: "serial",
    jobs: [],
  });
}

export function orchestrationCreateTxWorkflowActionModel(): OrchestrationTxWorkflowActionModel {
  return orchestrationTxWorkflowActionModelFromJson({
    workflow: orchestrationDefaultWorkflow(),
  });
}

export function orchestrationCreateJobModel(): OrchestrationJobModel {
  return orchestrationJobModelFromJson({
    name: "",
    strategy: "serial",
    target_groups: [],
    target_tags: [],
    targets: [],
    action: {
      kind: "tx_workflow",
      workflow: orchestrationDefaultWorkflow(),
    },
  });
}

function orchestrationStageJsonFromModel(
  model: Partial<OrchestrationStageModel> = {},
): JsonObject {
  const result: JsonObject = {
    name: orchestrationStringValue(model.name),
    strategy: model.strategy === "parallel" ? "parallel" : "serial",
    jobs: Array.isArray(model.jobs)
      ? model.jobs.map((job) => orchestrationJobJsonFromModel(job))
      : [],
  };
  if (model.hasMaxParallel || model.maxParallel !== null) {
    result.max_parallel = orchestrationNullableNumberValue(model.maxParallel);
  }
  if (model.hasFailFast || model.failFast !== null) {
    result.fail_fast = !!model.failFast;
  }
  return result;
}

function defaultOrchestrationPlanPayload(): JsonObject {
  return {
    name: "campus-rollout",
    fail_fast: true,
    rollback_on_stage_failure: false,
    rollback_completed_stages_on_failure: false,
    stages: [
      {
        name: "phase-1",
        strategy: "serial",
        fail_fast: true,
        jobs: [],
      },
    ],
  };
}

export function orchestrationPlanFormModelFromJson(
  planValue: unknown = {},
): OrchestrationPlanFormModel {
  const normalizedSource = orchestrationPlainObject(planValue)
    ? orchestrationWithoutUnsupportedLabels(planValue)
    : defaultOrchestrationPlanPayload();
  const source = orchestrationPlainObject(normalizedSource)
    ? normalizedSource
    : defaultOrchestrationPlanPayload();
  return {
    name: orchestrationStringValue(source.name, "campus-rollout"),
    failFast: typeof source.fail_fast === "boolean" ? source.fail_fast : true,
    hasFailFast: Object.hasOwn(source, "fail_fast"),
    rollbackOnStageFailure:
      typeof source.rollback_on_stage_failure === "boolean"
        ? source.rollback_on_stage_failure
        : false,
    hasRollbackOnStageFailure: Object.hasOwn(
      source,
      "rollback_on_stage_failure",
    ),
    rollbackCompletedStagesOnFailure:
      typeof source.rollback_completed_stages_on_failure === "boolean"
        ? source.rollback_completed_stages_on_failure
        : false,
    hasRollbackCompletedStagesOnFailure: Object.hasOwn(
      source,
      "rollback_completed_stages_on_failure",
    ),
    stages: Array.isArray(source.stages)
      ? source.stages.map((stage) => orchestrationStageModelFromJson(stage))
      : [],
    hasStages: Object.hasOwn(source, "stages"),
    extra: orchestrationObjectExtra(
      source,
      new Set([
        "name",
        "fail_fast",
        "rollback_on_stage_failure",
        "rollback_completed_stages_on_failure",
        "inventory_file",
        "inventory",
        "stages",
      ]),
    ),
  };
}

export function orchestrationCloneFormModel<T>(model: T): T {
  return structuredClone(model);
}

export function orchestrationPatchJobDraft(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  updater: (job: OrchestrationJobModel) => OrchestrationJobModel,
): OrchestrationPlanFormModel {
  const next = orchestrationCloneFormModel(model);
  const stage = next.stages[stageIndex] || orchestrationCreateStageModel();
  stage.jobs = Array.isArray(stage.jobs) ? stage.jobs : [];
  const job = stage.jobs[jobIndex] || orchestrationCreateJobModel();
  stage.jobs[jobIndex] = updater(job);
  stage.hasJobs = true;
  next.stages[stageIndex] = stage;
  next.hasStages = true;
  return next;
}

function orchestrationPlanJsonFromFormModel(
  model: Partial<OrchestrationPlanFormModel> = {},
): JsonObject {
  const result: JsonObject = {
    name: orchestrationStringValue(model.name, "campus-rollout"),
    stages: Array.isArray(model.stages)
      ? model.stages.map((stage) => orchestrationStageJsonFromModel(stage))
      : [],
  };
  if (model.hasFailFast || model.failFast !== true) {
    result.fail_fast = !!model.failFast;
  }
  if (model.hasRollbackOnStageFailure || model.rollbackOnStageFailure) {
    result.rollback_on_stage_failure = !!model.rollbackOnStageFailure;
  }
  if (
    model.hasRollbackCompletedStagesOnFailure ||
    model.rollbackCompletedStagesOnFailure
  ) {
    result.rollback_completed_stages_on_failure =
      !!model.rollbackCompletedStagesOnFailure;
  }
  return result;
}

export function orchestrationPlanFormModelFromJsonText(
  jsonText: unknown = "",
): OrchestrationPlanParseResult {
  if (typeof jsonText !== "string" || !jsonText.trim()) {
    return { error: "", model: null };
  }
  try {
    return {
      error: "",
      model: orchestrationPlanFormModelFromJson(JSON.parse(jsonText)),
    };
  } catch (error) {
    return {
      error:
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : String(error || ""),
      model: null,
    };
  }
}

export function orchestrationPlanFormModelToJsonText(
  model: Partial<OrchestrationPlanFormModel> = {},
): string {
  return JSON.stringify(
    orchestrationWithoutUnsupportedLabels(
      orchestrationPlanJsonFromFormModel(model),
    ),
    null,
    2,
  );
}
