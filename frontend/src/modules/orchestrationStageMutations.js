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
  orchestrationPatchJobDraft,
} from "./orchestrationFormState.js";

const cloneOrchestrationJsonValue = cloneJsonValue;
const orchestrationPlainObject = plainObject;
const orchestrationStringValue = stringValue;
const orchestrationNullableNumberValue = nullableNumberValue;

function orchestrationBoolStringValue(value) {
  return value === "true" || value === true;
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
  return next;
}

export function orchestrationSetRootFieldPresence(model, field, enabled) {
  const next = orchestrationCloneFormModel(model);
  return orchestrationToggleRootFieldPresence(next, field, enabled);
}

export function orchestrationAddStage(model) {
  const stageCount = Array.isArray(model?.stages) ? model.stages.length : 0;
  return orchestrationInsertStage(model, stageCount);
}

export function orchestrationInsertStage(model, stageIndex) {
  const next = orchestrationCloneFormModel(model);
  next.stages = Array.isArray(next.stages) ? next.stages : [];
  const insertIndex = Math.min(
    Math.max(Number.isInteger(stageIndex) ? stageIndex : next.stages.length, 0),
    next.stages.length,
  );
  next.stages.splice(insertIndex, 0, orchestrationCreateStageModel());
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

export function orchestrationDuplicateStage(model, stageIndex) {
  const next = orchestrationCloneFormModel(model);
  if (!Array.isArray(next.stages) || !next.stages[stageIndex]) return next;
  next.stages.splice(
    stageIndex + 1,
    0,
    orchestrationCloneFormModel(next.stages[stageIndex]),
  );
  next.hasStages = true;
  return next;
}

export function orchestrationMoveStage(model, stageIndex, targetIndex) {
  const next = orchestrationCloneFormModel(model);
  if (
    !Array.isArray(next.stages) ||
    stageIndex < 0 ||
    targetIndex < 0 ||
    stageIndex >= next.stages.length ||
    targetIndex >= next.stages.length ||
    stageIndex === targetIndex
  ) {
    return next;
  }
  const [stage] = next.stages.splice(stageIndex, 1);
  next.stages.splice(targetIndex, 0, stage);
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

export function orchestrationDuplicateJob(model, stageIndex, jobIndex) {
  const next = orchestrationCloneFormModel(model);
  const stage = next.stages?.[stageIndex];
  if (!stage || !Array.isArray(stage.jobs) || !stage.jobs[jobIndex])
    return next;
  stage.jobs.splice(
    jobIndex + 1,
    0,
    orchestrationCloneFormModel(stage.jobs[jobIndex]),
  );
  stage.hasJobs = true;
  next.hasStages = true;
  return next;
}

export function orchestrationMoveJob(model, stageIndex, jobIndex, targetIndex) {
  const next = orchestrationCloneFormModel(model);
  const stage = next.stages?.[stageIndex];
  if (
    !stage ||
    !Array.isArray(stage.jobs) ||
    jobIndex < 0 ||
    targetIndex < 0 ||
    jobIndex >= stage.jobs.length ||
    targetIndex >= stage.jobs.length ||
    jobIndex === targetIndex
  ) {
    return next;
  }
  const [job] = stage.jobs.splice(jobIndex, 1);
  stage.jobs.splice(targetIndex, 0, job);
  stage.hasJobs = true;
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

function orchestrationStringListKey(listName) {
  if (listName === "targetTags") return "targetTags";
  if (listName === "targets") return "targets";
  return "targetGroups";
}

function orchestrationStringListHasKey(listKey) {
  if (listKey === "targetTags") return "hasTargetTags";
  if (listKey === "targets") return "hasTargets";
  return "hasTargetGroups";
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

export function orchestrationReplaceJobStringList(
  model,
  stageIndex,
  jobIndex,
  listName,
  values,
) {
  const listKey = orchestrationStringListKey(listName);
  const hasKey = orchestrationStringListHasKey(listKey);
  const normalizedValues = Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => orchestrationStringValue(value).trim())
        .filter(Boolean),
    ),
  );
  return orchestrationPatchJobDraft(model, stageIndex, jobIndex, (job) => ({
    ...job,
    [listKey]: normalizedValues,
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
