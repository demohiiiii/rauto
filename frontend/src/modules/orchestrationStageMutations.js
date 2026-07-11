import {
  cloneJsonValue,
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../lib/jsonValue.js";
import {
  orchestrationConnectionTextValue,
  orchestrationCloneFormModel,
  orchestrationCreateJobModel,
  orchestrationCreateStageModel,
  orchestrationCreateTargetInputModel,
  orchestrationCreateTxBlockActionModel,
  orchestrationCreateTxWorkflowActionModel,
  orchestrationDefaultTargetModel,
  orchestrationJsonObjectPatchResult,
  orchestrationNormalizeConnectionPatch,
  orchestrationPatchJobDraft,
  orchestrationToggleTargetFieldPresence,
} from "./orchestrationFormState.js";

const cloneOrchestrationJsonValue = cloneJsonValue;
const orchestrationPlainObject = plainObject;
const orchestrationStringValue = stringValue;
const orchestrationNullableNumberValue = nullableNumberValue;

function orchestrationBoolStringValue(value) {
  return value === "true" || value === true;
}

export function orchestrationAddTarget(model, stageIndex, jobIndex) {
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => ({
    ...job,
    targets: [
      ...(Array.isArray(job.targets) ? job.targets : []),
      orchestrationCreateTargetInputModel("connection"),
    ],
    hasTargets: true,
  }));
}

export function orchestrationRemoveTarget(
  model,
  stageIndex,
  jobIndex,
  targetIndex,
) {
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => {
    const targets = [...(Array.isArray(job.targets) ? job.targets : [])];
    targets.splice(targetIndex, 1);
    return { ...job, targets, hasTargets: true };
  });
}

export function orchestrationPatchTargetInput(
  model,
  stageIndex,
  jobIndex,
  targetIndex,
  patch = {},
) {
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => {
    const targets = [...(Array.isArray(job.targets) ? job.targets : [])];
    const current =
      targets[targetIndex] || orchestrationCreateTargetInputModel("connection");
    const kind =
      patch.kind === "connection" || patch.kind === "detailed"
        ? patch.kind
        : current.kind;
    const normalizedTargetPatch = orchestrationNormalizeConnectionPatch(
      patch.target || {},
    );
    const nextTarget =
      kind === "detailed"
        ? {
            kind: "detailed",
            connection: null,
            hasConnection: false,
            target: {
              ...(current.target || orchestrationDefaultTargetModel()),
              ...(Object.hasOwn(patch, "connection")
                ? {
                    connection: orchestrationConnectionTextValue(
                      patch.connection,
                    ),
                    hasConnection: true,
                  }
                : {}),
              ...normalizedTargetPatch,
            },
          }
        : {
            kind: "connection",
            connection: Object.hasOwn(patch, "connection")
              ? orchestrationStringValue(patch.connection)
              : orchestrationStringValue(current.connection),
            hasConnection: true,
            target: null,
          };
    targets[targetIndex] = nextTarget;
    return { ...job, targets, hasTargets: true };
  });
}

export function orchestrationJobTargetVarsUpdateResult(
  model,
  stageIndex,
  jobIndex,
  targetIndex,
  varsText,
) {
  return orchestrationJsonObjectPatchResult(model, varsText, (parsedVars) =>
    orchestrationPatchTargetInput(model, stageIndex, jobIndex, targetIndex, {
      kind: "detailed",
      target: { vars: parsedVars },
    }),
  );
}

export function orchestrationSetJobTargetFieldPresence(
  model,
  stageIndex,
  jobIndex,
  targetIndex,
  field,
  enabled,
) {
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => {
    const targets = [...(Array.isArray(job.targets) ? job.targets : [])];
    const current =
      targets[targetIndex] || orchestrationCreateTargetInputModel("detailed");
    targets[targetIndex] = {
      kind: "detailed",
      connection: null,
      hasConnection: false,
      target: orchestrationToggleTargetFieldPresence(
        current.target || orchestrationDefaultTargetModel(),
        field,
        enabled,
      ),
    };
    return { ...job, targets, hasTargets: true };
  });
}

export function orchestrationSetJobTargetVarsPresence(
  model,
  stageIndex,
  jobIndex,
  targetIndex,
  enabled,
) {
  return orchestrationSetJobTargetFieldPresence(
    model,
    stageIndex,
    jobIndex,
    targetIndex,
    "vars",
    enabled,
  );
}

function orchestrationPresenceFlag(field) {
  return `has${field[0].toUpperCase()}${field.slice(1)}`;
}

function orchestrationToggleRootFieldPresence(model = {}, field, enabled) {
  const hasKey = orchestrationPresenceFlag(field);
  if (field === "failFast") {
    return {
      ...model,
      failFast: enabled ? (model?.failFast ?? true) : true,
      [hasKey]: enabled,
    };
  }
  if (field === "rollbackOnStageFailure") {
    return {
      ...model,
      rollbackOnStageFailure: enabled
        ? (model?.rollbackOnStageFailure ?? false)
        : false,
      [hasKey]: enabled,
    };
  }
  if (field === "rollbackCompletedStagesOnFailure") {
    return {
      ...model,
      rollbackCompletedStagesOnFailure: enabled
        ? (model?.rollbackCompletedStagesOnFailure ?? false)
        : false,
      [hasKey]: enabled,
    };
  }
  if (field === "inventoryFile") {
    return {
      ...model,
      inventoryFile: enabled ? (model?.inventoryFile ?? null) : null,
      [hasKey]: enabled,
    };
  }
  return model;
}

function orchestrationToggleStageFieldPresence(model = {}, field, enabled) {
  const hasKey = orchestrationPresenceFlag(field);
  if (field === "maxParallel") {
    return {
      ...model,
      maxParallel: enabled ? (model?.maxParallel ?? null) : null,
      [hasKey]: enabled,
    };
  }
  if (field === "failFast") {
    return {
      ...model,
      failFast: enabled ? (model?.failFast ?? false) : null,
      [hasKey]: enabled,
    };
  }
  return model;
}

function orchestrationToggleJobFieldPresence(model = {}, field, enabled) {
  const hasKey = orchestrationPresenceFlag(field);
  if (field === "name") {
    return {
      ...model,
      name: enabled ? (model?.name ?? null) : null,
      [hasKey]: enabled,
    };
  }
  if (field === "maxParallel") {
    return {
      ...model,
      maxParallel: enabled ? (model?.maxParallel ?? null) : null,
      [hasKey]: enabled,
    };
  }
  if (field === "failFast") {
    return {
      ...model,
      failFast: enabled ? (model?.failFast ?? false) : null,
      [hasKey]: enabled,
    };
  }
  return model;
}

function orchestrationToggleJobListPresence(model = {}, field, enabled) {
  const hasKey = orchestrationPresenceFlag(field);
  return {
    ...model,
    [field]: enabled
      ? Array.isArray(model?.[field])
        ? [...model[field]]
        : []
      : [],
    [hasKey]: enabled,
  };
}

function orchestrationTextListFromValue(listText = "") {
  return orchestrationStringValue(listText)
    .split(",")
    .map((listEntry) => listEntry.trim())
    .filter(Boolean);
}

export function orchestrationChangeRoot(model, key, fieldValue) {
  const next = orchestrationCloneFormModel(model);
  next[key] =
    key === "failFast" ? orchestrationBoolStringValue(fieldValue) : fieldValue;
  if (key === "failFast") next.hasFailFast = true;
  if (key === "rollbackOnStageFailure") {
    next.rollbackOnStageFailure = orchestrationBoolStringValue(fieldValue);
    next.hasRollbackOnStageFailure = true;
  }
  if (key === "rollbackCompletedStagesOnFailure") {
    next.rollbackCompletedStagesOnFailure =
      orchestrationBoolStringValue(fieldValue);
    next.hasRollbackCompletedStagesOnFailure = true;
  }
  if (key === "inventoryFile") {
    next.inventoryFile = orchestrationConnectionTextValue(fieldValue);
    next.hasInventoryFile = true;
  }
  return next;
}

export function orchestrationSetRootFieldPresence(model, field, enabled) {
  const next = orchestrationCloneFormModel(model);
  return orchestrationToggleRootFieldPresence(next, field, enabled);
}

export function orchestrationAddStage(model) {
  const next = orchestrationCloneFormModel(model);
  next.stages = Array.isArray(next.stages) ? next.stages : [];
  next.stages.push(orchestrationCreateStageModel());
  next.hasStages = true;
  return next;
}

export function orchestrationRemoveStage(model, stageIndex) {
  const next = orchestrationCloneFormModel(model);
  next.stages = Array.isArray(next.stages) ? next.stages : [];
  next.stages.splice(stageIndex, 1);
  next.hasStages = true;
  return next;
}

export function orchestrationPatchStage(model, stageIndex, patch = {}) {
  const next = orchestrationCloneFormModel(model);
  next.stages = Array.isArray(next.stages) ? next.stages : [];
  const stage = next.stages[stageIndex] || orchestrationCreateStageModel();
  next.stages[stageIndex] = {
    ...stage,
    ...patch,
    maxParallel: Object.hasOwn(patch, "maxParallel")
      ? orchestrationNullableNumberValue(patch.maxParallel)
      : stage.maxParallel,
    failFast: Object.hasOwn(patch, "failFast")
      ? orchestrationBoolStringValue(patch.failFast)
      : stage.failFast,
    hasMaxParallel: Object.hasOwn(patch, "maxParallel")
      ? true
      : stage.hasMaxParallel,
    hasFailFast: Object.hasOwn(patch, "failFast") ? true : stage.hasFailFast,
  };
  next.hasStages = true;
  return next;
}

export function orchestrationSetStageFieldPresence(
  model,
  stageIndex,
  field,
  enabled,
) {
  const next = orchestrationCloneFormModel(model);
  const stage = next.stages[stageIndex] || orchestrationCreateStageModel();
  next.stages[stageIndex] = orchestrationToggleStageFieldPresence(
    stage,
    field,
    enabled,
  );
  next.hasStages = true;
  return next;
}

export function orchestrationAddJob(model, stageIndex) {
  const next = orchestrationCloneFormModel(model);
  const stage = next.stages[stageIndex] || orchestrationCreateStageModel();
  stage.jobs = Array.isArray(stage.jobs) ? stage.jobs : [];
  stage.jobs.push(orchestrationCreateJobModel());
  stage.hasJobs = true;
  next.stages[stageIndex] = stage;
  next.hasStages = true;
  return next;
}

export function orchestrationRemoveJob(model, stageIndex, jobIndex) {
  const next = orchestrationCloneFormModel(model);
  const stage = next.stages[stageIndex] || orchestrationCreateStageModel();
  stage.jobs = Array.isArray(stage.jobs) ? stage.jobs : [];
  stage.jobs.splice(jobIndex, 1);
  stage.hasJobs = true;
  next.stages[stageIndex] = stage;
  next.hasStages = true;
  return next;
}

export function orchestrationPatchJob(model, stageIndex, jobIndex, patch = {}) {
  const next = orchestrationCloneFormModel(model);
  const stage = next.stages[stageIndex] || orchestrationCreateStageModel();
  stage.jobs = Array.isArray(stage.jobs) ? stage.jobs : [];
  const job = stage.jobs[jobIndex] || orchestrationCreateJobModel();
  stage.jobs[jobIndex] = {
    ...job,
    ...patch,
    name: Object.hasOwn(patch, "name")
      ? orchestrationConnectionTextValue(patch.name)
      : job.name,
    maxParallel: Object.hasOwn(patch, "maxParallel")
      ? orchestrationNullableNumberValue(patch.maxParallel)
      : job.maxParallel,
    failFast: Object.hasOwn(patch, "failFast")
      ? orchestrationBoolStringValue(patch.failFast)
      : job.failFast,
    hasName: Object.hasOwn(patch, "name") ? true : job.hasName,
    hasMaxParallel: Object.hasOwn(patch, "maxParallel")
      ? true
      : job.hasMaxParallel,
    hasFailFast: Object.hasOwn(patch, "failFast") ? true : job.hasFailFast,
  };
  stage.hasJobs = true;
  next.stages[stageIndex] = stage;
  next.hasStages = true;
  return next;
}

export function orchestrationSetJobFieldPresence(
  model,
  stageIndex,
  jobIndex,
  field,
  enabled,
) {
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) =>
    orchestrationToggleJobFieldPresence(job, field, enabled),
  );
}

export function orchestrationSetJobListPresence(
  model,
  stageIndex,
  jobIndex,
  field,
  enabled,
) {
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) =>
    orchestrationToggleJobListPresence(job, field, enabled),
  );
}

export function orchestrationPatchActionKind(
  model,
  stageIndex,
  jobIndex,
  kind,
) {
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => ({
    ...job,
    action: {
      kind: kind === "tx_workflow" ? "tx_workflow" : "tx_block",
      txBlock: job.action?.txBlock || orchestrationCreateTxBlockActionModel(),
      txWorkflow:
        job.action?.txWorkflow || orchestrationCreateTxWorkflowActionModel(),
    },
  }));
}

function orchestrationStringListKey(listName) {
  return listName === "targetTags" ? "targetTags" : "targetGroups";
}

function orchestrationStringListHasKey(listKey) {
  return listKey === "targetTags" ? "hasTargetTags" : "hasTargetGroups";
}

function orchestrationPatchJobStringListText(
  model,
  stageIndex,
  jobIndex,
  listName,
  text,
) {
  const listKey = orchestrationStringListKey(listName);
  const hasKey = orchestrationStringListHasKey(listKey);
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => ({
    ...job,
    [listKey]: orchestrationTextListFromValue(text),
    [hasKey]: true,
  }));
}

export function orchestrationAddJobStringListItem(
  model,
  stageIndex,
  jobIndex,
  listName,
) {
  const listKey = orchestrationStringListKey(listName);
  const hasKey = orchestrationStringListHasKey(listKey);
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => ({
    ...job,
    [listKey]: [...(Array.isArray(job[listKey]) ? job[listKey] : []), ""],
    [hasKey]: true,
  }));
}

export function orchestrationUpdateJobStringListItem(
  model,
  stageIndex,
  jobIndex,
  listName,
  itemIndex,
  text,
) {
  const listKey = orchestrationStringListKey(listName);
  const hasKey = orchestrationStringListHasKey(listKey);
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => {
    const items = [...(Array.isArray(job[listKey]) ? job[listKey] : [])];
    items[itemIndex] = orchestrationStringValue(text);
    return {
      ...job,
      [listKey]: items,
      [hasKey]: true,
    };
  });
}

export function orchestrationRemoveJobStringListItem(
  model,
  stageIndex,
  jobIndex,
  listName,
  itemIndex,
) {
  const listKey = orchestrationStringListKey(listName);
  const hasKey = orchestrationStringListHasKey(listKey);
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => {
    const items = [...(Array.isArray(job[listKey]) ? job[listKey] : [])];
    items.splice(itemIndex, 1);
    return {
      ...job,
      [listKey]: items,
      [hasKey]: true,
    };
  });
}
