import { nullableNumberValue, stringValue } from "../../lib/jsonValue.js";
import {
  orchestrationCloneFormModel,
  orchestrationCreateJobModel,
  orchestrationCreateStageModel,
} from "./orchestrationPlanFormModels.js";
import { orchestrationConnectionTextValue } from "./orchestrationTargetFormModels.js";

const orchestrationStringValue = stringValue;
const orchestrationNullableNumberValue = nullableNumberValue;

const JOB_STRING_LIST_FIELDS = {
  targetGroups: ["targetGroups", "hasTargetGroups"],
  targetTags: ["targetTags", "hasTargetTags"],
  targets: ["targets", "hasTargets"],
};

function orchestrationBoolStringValue(value) {
  return value === "true" || value === true;
}

function orchestrationPresenceFlag(field) {
  return `has${field[0].toUpperCase()}${field.slice(1)}`;
}

function orchestrationUpdateStage(model, stageIndex, updater) {
  const next = orchestrationCloneFormModel(model);
  next.stages = Array.isArray(next.stages) ? next.stages : [];
  next.stages[stageIndex] = updater(
    next.stages[stageIndex] || orchestrationCreateStageModel(),
  );
  next.hasStages = true;
  return next;
}

function orchestrationUpdateJob(model, stageIndex, jobIndex, updater) {
  return orchestrationUpdateStage(model, stageIndex, (stage) => {
    const jobs = Array.isArray(stage.jobs) ? stage.jobs : [];
    jobs[jobIndex] = updater(jobs[jobIndex] || orchestrationCreateJobModel());
    return { ...stage, jobs, hasJobs: true };
  });
}

function orchestrationMoveListItem(items, sourceIndex, targetIndex) {
  if (
    !Array.isArray(items) ||
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= items.length ||
    targetIndex >= items.length ||
    sourceIndex === targetIndex
  ) {
    return false;
  }
  const [item] = items.splice(sourceIndex, 1);
  items.splice(targetIndex, 0, item);
  return true;
}

function orchestrationDuplicateListItem(items, itemIndex) {
  if (!Array.isArray(items) || !items[itemIndex]) return false;
  items.splice(itemIndex + 1, 0, orchestrationCloneFormModel(items[itemIndex]));
  return true;
}

function orchestrationPatchFields(current, patch, normalizers) {
  const next = { ...current, ...patch };
  for (const [field, normalize] of Object.entries(normalizers)) {
    if (!Object.hasOwn(patch, field)) continue;
    next[field] = normalize(patch[field]);
    next[orchestrationPresenceFlag(field)] = true;
  }
  return next;
}

function orchestrationStringListField(listName) {
  return (
    JOB_STRING_LIST_FIELDS[listName] || JOB_STRING_LIST_FIELDS.targetGroups
  );
}

function orchestrationPatchJobStringList(
  model,
  stageIndex,
  jobIndex,
  listName,
  updater,
) {
  const [listKey, hasKey] = orchestrationStringListField(listName);
  return orchestrationUpdateJob(model, stageIndex, jobIndex, (job) => ({
    ...job,
    [listKey]: updater(Array.isArray(job[listKey]) ? [...job[listKey]] : []),
    [hasKey]: true,
  }));
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
  if (!orchestrationDuplicateListItem(next.stages, stageIndex)) return next;
  next.hasStages = true;
  return next;
}

export function orchestrationMoveStage(model, stageIndex, targetIndex) {
  const next = orchestrationCloneFormModel(model);
  if (!orchestrationMoveListItem(next.stages, stageIndex, targetIndex)) {
    return next;
  }
  next.hasStages = true;
  return next;
}

export function orchestrationPatchStage(model, stageIndex, patch = {}) {
  return orchestrationUpdateStage(model, stageIndex, (stage) =>
    orchestrationPatchFields(stage, patch, {
      failFast: orchestrationBoolStringValue,
      maxParallel: orchestrationNullableNumberValue,
    }),
  );
}

export function orchestrationAddJob(model, stageIndex) {
  return orchestrationUpdateStage(model, stageIndex, (stage) => ({
    ...stage,
    jobs: [
      ...(Array.isArray(stage.jobs) ? stage.jobs : []),
      orchestrationCreateJobModel(),
    ],
    hasJobs: true,
  }));
}

export function orchestrationRemoveJob(model, stageIndex, jobIndex) {
  return orchestrationUpdateStage(model, stageIndex, (stage) => {
    const jobs = Array.isArray(stage.jobs) ? [...stage.jobs] : [];
    jobs.splice(jobIndex, 1);
    return { ...stage, jobs, hasJobs: true };
  });
}

export function orchestrationDuplicateJob(model, stageIndex, jobIndex) {
  const next = orchestrationCloneFormModel(model);
  const stage = next.stages?.[stageIndex];
  if (!stage || !orchestrationDuplicateListItem(stage.jobs, jobIndex)) {
    return next;
  }
  stage.hasJobs = true;
  next.hasStages = true;
  return next;
}

export function orchestrationMoveJob(model, stageIndex, jobIndex, targetIndex) {
  const next = orchestrationCloneFormModel(model);
  const stage = next.stages?.[stageIndex];
  if (!stage || !orchestrationMoveListItem(stage.jobs, jobIndex, targetIndex)) {
    return next;
  }
  stage.hasJobs = true;
  next.hasStages = true;
  return next;
}

export function orchestrationPatchJob(model, stageIndex, jobIndex, patch = {}) {
  return orchestrationUpdateJob(model, stageIndex, jobIndex, (job) =>
    orchestrationPatchFields(job, patch, {
      failFast: orchestrationBoolStringValue,
      maxParallel: orchestrationNullableNumberValue,
      name: orchestrationConnectionTextValue,
    }),
  );
}

export function orchestrationReplaceJobStringList(
  model,
  stageIndex,
  jobIndex,
  listName,
  values,
) {
  const normalizedValues = Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => orchestrationStringValue(value).trim())
        .filter(Boolean),
    ),
  );
  return orchestrationPatchJobStringList(
    model,
    stageIndex,
    jobIndex,
    listName,
    () => normalizedValues,
  );
}
