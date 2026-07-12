import {
  cloneJsonValue,
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../lib/jsonValue.js";
import {
  orchestrationInventoryJsonFromModel,
  orchestrationInventoryModelFromJson,
  orchestrationObjectExtra,
  orchestrationTargetInputJsonFromModel,
  orchestrationTargetInputModelFromJson,
} from "./orchestrationTargetFormModels.js";

const cloneOrchestrationJsonValue = cloneJsonValue;
const orchestrationPlainObject = plainObject;
const orchestrationStringValue = stringValue;
const orchestrationNullableNumberValue = nullableNumberValue;

function orchestrationWithoutUnsupportedLabels(value) {
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

function orchestrationTxBlockActionModelFromJson(source = {}) {
  const value = orchestrationPlainObject(source) ? source : {};
  return {
    name: value.name ?? null,
    hasName: Object.hasOwn(value, "name"),
    template: value.template ?? null,
    hasTemplate: Object.hasOwn(value, "template"),
    txBlockTemplateName: value.tx_block_template_name ?? null,
    hasTxBlockTemplateName: Object.hasOwn(value, "tx_block_template_name"),
    txBlockTemplateContent: value.tx_block_template_content ?? null,
    hasTxBlockTemplateContent: Object.hasOwn(
      value,
      "tx_block_template_content",
    ),
    txBlockTemplateVars: cloneOrchestrationJsonValue(
      value.tx_block_template_vars,
      {},
    ),
    hasTxBlockTemplateVars: Object.hasOwn(value, "tx_block_template_vars"),
    flowTemplateName: value.flow_template_name ?? null,
    hasFlowTemplateName: Object.hasOwn(value, "flow_template_name"),
    flowTemplateContent: value.flow_template_content ?? null,
    hasFlowTemplateContent: Object.hasOwn(value, "flow_template_content"),
    flowVars: cloneOrchestrationJsonValue(value.flow_vars, {}),
    hasFlowVars: Object.hasOwn(value, "flow_vars"),
    vars: cloneOrchestrationJsonValue(value.vars, {}),
    hasVars: Object.hasOwn(value, "vars"),
    commands: Array.isArray(value.commands)
      ? value.commands.map((command) => orchestrationStringValue(command))
      : [],
    hasCommands: Object.hasOwn(value, "commands"),
    rollbackCommands: Array.isArray(value.rollback_commands)
      ? value.rollback_commands.map((command) =>
          orchestrationStringValue(command),
        )
      : [],
    hasRollbackCommands: Object.hasOwn(value, "rollback_commands"),
    rollbackOnFailure: !!value.rollback_on_failure,
    hasRollbackOnFailure: Object.hasOwn(value, "rollback_on_failure"),
    rollbackTriggerStepIndex: orchestrationNullableNumberValue(
      value.rollback_trigger_step_index,
    ),
    hasRollbackTriggerStepIndex: Object.hasOwn(
      value,
      "rollback_trigger_step_index",
    ),
    mode: value.mode ?? null,
    hasMode: Object.hasOwn(value, "mode"),
    timeoutSecs: orchestrationNullableNumberValue(value.timeout_secs),
    hasTimeoutSecs: Object.hasOwn(value, "timeout_secs"),
    resourceRollbackCommand: value.resource_rollback_command ?? null,
    hasResourceRollbackCommand: Object.hasOwn(
      value,
      "resource_rollback_command",
    ),
    extra: orchestrationObjectExtra(
      value,
      new Set([
        "name",
        "template",
        "tx_block_template_name",
        "tx_block_template_content",
        "tx_block_template_vars",
        "flow_template_name",
        "flow_template_content",
        "flow_vars",
        "vars",
        "commands",
        "rollback_commands",
        "rollback_on_failure",
        "rollback_trigger_step_index",
        "mode",
        "timeout_secs",
        "resource_rollback_command",
      ]),
    ),
  };
}

function orchestrationTxBlockActionJsonFromModel(model = {}) {
  const result = {
    ...(orchestrationPlainObject(model.extra)
      ? cloneOrchestrationJsonValue(model.extra, {})
      : {}),
  };
  if (model.hasName || model.name !== null) result.name = model.name ?? null;
  if (model.hasTemplate || model.template !== null) {
    result.template = model.template ?? null;
  }
  if (model.hasTxBlockTemplateName || model.txBlockTemplateName !== null) {
    result.tx_block_template_name = model.txBlockTemplateName ?? null;
  }
  if (
    model.hasTxBlockTemplateContent ||
    model.txBlockTemplateContent !== null
  ) {
    result.tx_block_template_content = model.txBlockTemplateContent ?? null;
  }
  if (
    model.hasTxBlockTemplateVars ||
    (orchestrationPlainObject(model.txBlockTemplateVars) &&
      Object.keys(model.txBlockTemplateVars).length > 0)
  ) {
    result.tx_block_template_vars = cloneOrchestrationJsonValue(
      model.txBlockTemplateVars,
      {},
    );
  }
  if (model.hasFlowTemplateName || model.flowTemplateName !== null) {
    result.flow_template_name = model.flowTemplateName ?? null;
  }
  if (model.hasFlowTemplateContent || model.flowTemplateContent !== null) {
    result.flow_template_content = model.flowTemplateContent ?? null;
  }
  if (
    model.hasFlowVars ||
    (orchestrationPlainObject(model.flowVars) &&
      Object.keys(model.flowVars).length > 0)
  ) {
    result.flow_vars = cloneOrchestrationJsonValue(model.flowVars, {});
  }
  if (
    model.hasVars ||
    (orchestrationPlainObject(model.vars) && Object.keys(model.vars).length > 0)
  ) {
    result.vars = cloneOrchestrationJsonValue(model.vars, {});
  }
  if (
    model.hasCommands ||
    (Array.isArray(model.commands) && model.commands.length > 0)
  ) {
    result.commands = Array.isArray(model.commands)
      ? model.commands.map((command) => orchestrationStringValue(command))
      : [];
  }
  if (
    model.hasRollbackCommands ||
    (Array.isArray(model.rollbackCommands) && model.rollbackCommands.length > 0)
  ) {
    result.rollback_commands = Array.isArray(model.rollbackCommands)
      ? model.rollbackCommands.map((command) =>
          orchestrationStringValue(command),
        )
      : [];
  }
  if (model.hasRollbackOnFailure || model.rollbackOnFailure) {
    result.rollback_on_failure = !!model.rollbackOnFailure;
  }
  if (
    model.hasRollbackTriggerStepIndex ||
    model.rollbackTriggerStepIndex !== null
  ) {
    result.rollback_trigger_step_index = orchestrationNullableNumberValue(
      model.rollbackTriggerStepIndex,
    );
  }
  if (model.hasMode || model.mode !== null) result.mode = model.mode ?? null;
  if (model.hasTimeoutSecs || model.timeoutSecs !== null) {
    result.timeout_secs = orchestrationNullableNumberValue(model.timeoutSecs);
  }
  if (
    model.hasResourceRollbackCommand ||
    model.resourceRollbackCommand !== null
  ) {
    result.resource_rollback_command = model.resourceRollbackCommand ?? null;
  }
  return result;
}

function orchestrationTxWorkflowActionModelFromJson(source = {}) {
  const value = orchestrationPlainObject(source) ? source : {};
  return {
    workflowFile: value.workflow_file ?? null,
    hasWorkflowFile: Object.hasOwn(value, "workflow_file"),
    workflow: cloneOrchestrationJsonValue(value.workflow, null),
    hasWorkflow: Object.hasOwn(value, "workflow"),
    workflowTemplateName: value.workflow_template_name ?? null,
    hasWorkflowTemplateName: Object.hasOwn(value, "workflow_template_name"),
    workflowTemplateContent: value.workflow_template_content ?? null,
    hasWorkflowTemplateContent: Object.hasOwn(
      value,
      "workflow_template_content",
    ),
    workflowVars: cloneOrchestrationJsonValue(value.workflow_vars, {}),
    hasWorkflowVars: Object.hasOwn(value, "workflow_vars"),
    extra: orchestrationObjectExtra(
      value,
      new Set([
        "workflow_file",
        "workflow",
        "workflow_template_name",
        "workflow_template_content",
        "workflow_vars",
      ]),
    ),
  };
}

function orchestrationTxWorkflowActionJsonFromModel(model = {}) {
  const result = {
    ...(orchestrationPlainObject(model.extra)
      ? cloneOrchestrationJsonValue(model.extra, {})
      : {}),
  };
  if (model.hasWorkflowFile || model.workflowFile !== null) {
    result.workflow_file = model.workflowFile ?? null;
  }
  if (model.hasWorkflow || model.workflow !== null) {
    result.workflow = cloneOrchestrationJsonValue(model.workflow, null);
  }
  if (model.hasWorkflowTemplateName || model.workflowTemplateName !== null) {
    result.workflow_template_name = model.workflowTemplateName ?? null;
  }
  if (
    model.hasWorkflowTemplateContent ||
    model.workflowTemplateContent !== null
  ) {
    result.workflow_template_content = model.workflowTemplateContent ?? null;
  }
  if (
    model.hasWorkflowVars ||
    (orchestrationPlainObject(model.workflowVars) &&
      Object.keys(model.workflowVars).length > 0)
  ) {
    result.workflow_vars = cloneOrchestrationJsonValue(model.workflowVars, {});
  }
  return result;
}

function orchestrationActionModelFromJson(source = {}) {
  const value = orchestrationPlainObject(source) ? source : {};
  const kind = value.kind === "tx_workflow" ? "tx_workflow" : "tx_block";
  return {
    kind,
    txBlock: orchestrationTxBlockActionModelFromJson(value),
    txWorkflow: orchestrationTxWorkflowActionModelFromJson(value),
  };
}

function orchestrationActionJsonFromModel(model = {}) {
  if (model.kind === "tx_workflow") {
    return {
      kind: "tx_workflow",
      ...orchestrationTxWorkflowActionJsonFromModel(model.txWorkflow || {}),
    };
  }
  return {
    kind: "tx_block",
    ...orchestrationTxBlockActionJsonFromModel(model.txBlock || {}),
  };
}

function orchestrationJobModelFromJson(source = {}) {
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
      ? value.targets.map((targetInput) =>
          orchestrationTargetInputModelFromJson(targetInput),
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

function orchestrationJobJsonFromModel(model = {}) {
  const result = {
    ...(orchestrationPlainObject(model.extra)
      ? cloneOrchestrationJsonValue(model.extra, {})
      : {}),
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
      ? model.targets.map((targetInput) =>
          orchestrationTargetInputJsonFromModel(targetInput),
        )
      : [];
  }
  return result;
}

function orchestrationStageModelFromJson(source = {}) {
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

export function orchestrationCreateStageModel() {
  return orchestrationStageModelFromJson({
    name: "",
    strategy: "serial",
    jobs: [],
  });
}

export function orchestrationCreateJobModel() {
  return orchestrationJobModelFromJson({
    name: "",
    strategy: "serial",
    target_groups: [],
    target_tags: [],
    targets: [],
    action: { kind: "tx_block", commands: [] },
  });
}

export function orchestrationCreateTxBlockActionModel() {
  return orchestrationTxBlockActionModelFromJson({ commands: [] });
}

export function orchestrationCreateTxWorkflowActionModel() {
  return orchestrationTxWorkflowActionModelFromJson({});
}

function orchestrationStageJsonFromModel(model = {}) {
  const result = {
    ...(orchestrationPlainObject(model.extra)
      ? cloneOrchestrationJsonValue(model.extra, {})
      : {}),
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

function defaultOrchestrationPlanPayload() {
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

export function orchestrationPlanFormModelFromJson(planValue = {}) {
  const source = orchestrationPlainObject(planValue)
    ? planValue
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
    inventoryFile: source.inventory_file ?? null,
    hasInventoryFile: Object.hasOwn(source, "inventory_file"),
    inventory: orchestrationPlainObject(source.inventory)
      ? orchestrationInventoryModelFromJson(source.inventory)
      : null,
    hasInventory: Object.hasOwn(source, "inventory"),
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

export function orchestrationCloneFormModel(model = {}) {
  return structuredClone(model || {});
}

export function orchestrationPatchJobDraft(
  model,
  stageIndex,
  jobIndex,
  updater,
) {
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

function orchestrationPlanJsonFromFormModel(model = {}) {
  const result = {
    ...(orchestrationPlainObject(model.extra)
      ? cloneOrchestrationJsonValue(model.extra, {})
      : {}),
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
  if (model.hasInventoryFile || model.inventoryFile !== null) {
    result.inventory_file = model.inventoryFile ?? null;
  }
  if (model.hasInventory || model.inventory) {
    result.inventory = model.inventory
      ? orchestrationInventoryJsonFromModel(model.inventory)
      : null;
  }
  return result;
}

export function orchestrationPlanFormModelFromJsonText(jsonText = "") {
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

export function orchestrationPlanFormModelToJsonText(model = {}) {
  return JSON.stringify(
    orchestrationWithoutUnsupportedLabels(
      orchestrationPlanJsonFromFormModel(model),
    ),
    null,
    2,
  );
}
