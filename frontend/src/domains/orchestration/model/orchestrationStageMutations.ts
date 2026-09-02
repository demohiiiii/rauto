import { nullableNumberValue, stringValue } from "../../../lib/jsonValue.js";
import {
  orchestrationCloneFormModel,
  orchestrationCreateJobModel,
  orchestrationCreateStageModel,
} from "./orchestrationPlanFormModels.js";
import { orchestrationConnectionTextValue } from "./orchestrationTargetFormModels.js";
import type {
  JsonObject,
  OrchestrationJobModel,
  OrchestrationPlanFormModel,
  OrchestrationStageModel,
} from "./types.js";

const orchestrationStringValue = (value: unknown, fallback = ""): string =>
  stringValue(value, fallback);
const orchestrationNullableNumberValue = (value: unknown): number | null =>
  nullableNumberValue(value);

type JobStringListName = "targetGroups" | "targetTags" | "targets";
type JobStringListField = readonly [
  JobStringListName,
  "hasTargetGroups" | "hasTargetTags" | "hasTargets",
];

const JOB_STRING_LIST_FIELDS: Record<JobStringListName, JobStringListField> = {
  targetGroups: ["targetGroups", "hasTargetGroups"],
  targetTags: ["targetTags", "hasTargetTags"],
  targets: ["targets", "hasTargets"],
};

function orchestrationBoolStringValue(value: unknown): boolean {
  return value === "true" || value === true;
}

function orchestrationPresenceFlag(field: string): string {
  return `has${field[0].toUpperCase()}${field.slice(1)}`;
}

function orchestrationUpdateStage(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  updater: (stage: OrchestrationStageModel) => OrchestrationStageModel,
): OrchestrationPlanFormModel {
  const next = orchestrationCloneFormModel(model);
  next.stages = Array.isArray(next.stages) ? next.stages : [];
  next.stages[stageIndex] = updater(
    next.stages[stageIndex] || orchestrationCreateStageModel(),
  );
  next.hasStages = true;
  return next;
}

function orchestrationUpdateJob(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  updater: (job: OrchestrationJobModel) => OrchestrationJobModel,
): OrchestrationPlanFormModel {
  return orchestrationUpdateStage(model, stageIndex, (stage) => {
    const jobs = Array.isArray(stage.jobs) ? stage.jobs : [];
    jobs[jobIndex] = updater(jobs[jobIndex] || orchestrationCreateJobModel());
    return { ...stage, jobs, hasJobs: true };
  });
}

function orchestrationMoveListItem<T>(
  items: T[],
  sourceIndex: number,
  targetIndex: number,
): boolean {
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

function orchestrationDuplicateListItem<T>(
  items: T[],
  itemIndex: number,
): boolean {
  if (!Array.isArray(items) || !items[itemIndex]) return false;
  items.splice(itemIndex + 1, 0, orchestrationCloneFormModel(items[itemIndex]));
  return true;
}

function orchestrationPatchFields<T extends JsonObject>(
  current: T,
  patch: JsonObject,
  normalizers: Record<string, (value: unknown) => unknown>,
): T {
  const next: JsonObject = { ...current, ...patch };
  for (const [field, normalize] of Object.entries(normalizers)) {
    if (!Object.hasOwn(patch, field)) continue;
    next[field] = normalize(patch[field]);
    next[orchestrationPresenceFlag(field)] = true;
  }
  return next as T;
}

function orchestrationStringListField(listName: string): JobStringListField {
  return (
    JOB_STRING_LIST_FIELDS[listName as JobStringListName] ||
    JOB_STRING_LIST_FIELDS.targetGroups
  );
}

function orchestrationPatchJobStringList(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  listName: string,
  updater: (values: string[]) => string[],
): OrchestrationPlanFormModel {
  const [listKey, hasKey] = orchestrationStringListField(listName);
  return orchestrationUpdateJob(model, stageIndex, jobIndex, (job) => {
    const values = job[listKey];
    return {
      ...job,
      [listKey]: updater(Array.isArray(values) ? [...values] : []),
      [hasKey]: true,
    } as OrchestrationJobModel;
  });
}

export function orchestrationChangeRoot(
  model: OrchestrationPlanFormModel,
  key: string,
  fieldValue: unknown,
): OrchestrationPlanFormModel {
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

export function orchestrationAddStage(
  model: OrchestrationPlanFormModel,
): OrchestrationPlanFormModel {
  const stageCount = Array.isArray(model?.stages) ? model.stages.length : 0;
  return orchestrationInsertStage(model, stageCount);
}

export function orchestrationInsertStage(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
): OrchestrationPlanFormModel {
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

export function orchestrationRemoveStage(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
): OrchestrationPlanFormModel {
  const next = orchestrationCloneFormModel(model);
  next.stages = Array.isArray(next.stages) ? next.stages : [];
  next.stages.splice(stageIndex, 1);
  next.hasStages = true;
  return next;
}

export function orchestrationDuplicateStage(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
): OrchestrationPlanFormModel {
  const next = orchestrationCloneFormModel(model);
  if (!orchestrationDuplicateListItem(next.stages, stageIndex)) return next;
  next.hasStages = true;
  return next;
}

export function orchestrationMoveStage(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  targetIndex: number,
): OrchestrationPlanFormModel {
  const next = orchestrationCloneFormModel(model);
  if (!orchestrationMoveListItem(next.stages, stageIndex, targetIndex)) {
    return next;
  }
  next.hasStages = true;
  return next;
}

export function orchestrationPatchStage(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  patch: JsonObject = {},
): OrchestrationPlanFormModel {
  return orchestrationUpdateStage(model, stageIndex, (stage) =>
    orchestrationPatchFields(stage, patch, {
      failFast: orchestrationBoolStringValue,
      maxParallel: orchestrationNullableNumberValue,
    }),
  );
}

export function orchestrationAddJob(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
): OrchestrationPlanFormModel {
  return orchestrationUpdateStage(model, stageIndex, (stage) => ({
    ...stage,
    jobs: [
      ...(Array.isArray(stage.jobs) ? stage.jobs : []),
      orchestrationCreateJobModel(),
    ],
    hasJobs: true,
  }));
}

export function orchestrationRemoveJob(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
): OrchestrationPlanFormModel {
  return orchestrationUpdateStage(model, stageIndex, (stage) => {
    const jobs = Array.isArray(stage.jobs) ? [...stage.jobs] : [];
    jobs.splice(jobIndex, 1);
    return { ...stage, jobs, hasJobs: true };
  });
}

export function orchestrationDuplicateJob(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
): OrchestrationPlanFormModel {
  const next = orchestrationCloneFormModel(model);
  const stage = next.stages?.[stageIndex];
  if (!stage || !orchestrationDuplicateListItem(stage.jobs, jobIndex)) {
    return next;
  }
  stage.hasJobs = true;
  next.hasStages = true;
  return next;
}

export function orchestrationMoveJob(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  targetIndex: number,
): OrchestrationPlanFormModel {
  const next = orchestrationCloneFormModel(model);
  const stage = next.stages?.[stageIndex];
  if (!stage || !orchestrationMoveListItem(stage.jobs, jobIndex, targetIndex)) {
    return next;
  }
  stage.hasJobs = true;
  next.hasStages = true;
  return next;
}

export function orchestrationPatchJob(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  patch: JsonObject = {},
): OrchestrationPlanFormModel {
  return orchestrationUpdateJob(model, stageIndex, jobIndex, (job) =>
    orchestrationPatchFields(job, patch, {
      failFast: orchestrationBoolStringValue,
      maxParallel: orchestrationNullableNumberValue,
      name: orchestrationConnectionTextValue,
    }),
  );
}

export function orchestrationReplaceJobStringList(
  model: OrchestrationPlanFormModel,
  stageIndex: number,
  jobIndex: number,
  listName: string,
  values: readonly string[],
): OrchestrationPlanFormModel {
  const normalizedValues = Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
  return orchestrationPatchJobStringList(
    model,
    stageIndex,
    jobIndex,
    listName,
    () => normalizedValues,
  );
}
