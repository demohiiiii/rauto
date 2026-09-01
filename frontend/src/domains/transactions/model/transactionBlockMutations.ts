import {
  cloneJsonValue,
  jsonValueText,
  plainObject,
  stringValue,
} from "../../../lib/jsonValue.js";
import type {
  JsonObject,
  TxBlockFormModel,
  TxCommandInteractionModel,
  TxCommandModel,
  TxFlowModel,
  TxMultilineMode,
  TxOperationKind,
  TxOperationModel,
  TxRuntimePromptModel,
  TxRollbackKind,
  TxStepFormModel,
} from "./types.js";

const cloneTxJsonValue = cloneJsonValue as unknown as {
  (value: unknown): unknown;
  <T>(value: unknown, fallback: T): T;
};
const txPlainObject = plainObject as unknown as (
  value: unknown,
) => value is JsonObject;
const txStringValue = stringValue as unknown as (
  value: unknown,
  fallback?: string,
) => string;
const txJsonValueText = jsonValueText as unknown as (value: unknown) => string;

function txBoolStringValue(value: unknown): boolean {
  return value === "true" || value === true;
}

function txCommandInteractionSource(
  command: Partial<TxCommandModel> = {},
): Partial<TxCommandInteractionModel> {
  return txPlainObject(command?.interaction) ? command.interaction : {};
}

function txPromptExtraSource(
  prompt: Partial<TxRuntimePromptModel> = {},
): JsonObject {
  return prompt && typeof prompt === "object" && txPlainObject(prompt.extra)
    ? prompt.extra
    : {};
}

export function txCommandPromptExtraSource(
  command: Partial<TxCommandModel> = {},
  promptIndex = -1,
): JsonObject {
  const interaction = txCommandInteractionSource(command);
  const prompts = Array.isArray(interaction.prompts) ? interaction.prompts : [];
  return txPromptExtraSource(prompts[promptIndex]);
}

function txCommandDraft(command: Partial<TxCommandModel> = {}): TxCommandModel {
  return {
    mode: command.mode || "User",
    command: command.command || "",
    multilineMode: (command.multilineMode === "whole"
      ? "whole"
      : "split_lines") as TxMultilineMode,
    timeout: command.timeout ?? 30,
    hasTimeout: true,
    dynParams: command.dynParams || {},
    hasDynParams: command.hasDynParams || false,
    interaction: command.interaction || {
      prompts: [],
      hasPrompts: false,
      extra: {},
    },
    hasInteraction: command.hasInteraction || false,
    extra: command.extra || {},
  };
}

export const txBlockCommandDraft = txCommandDraft;

function txOperationDraft(kind: TxOperationKind = "command"): TxOperationModel {
  return {
    kind,
    command: txCommandDraft(),
    flow: {
      steps: [txCommandDraft()],
      stopOnError: true,
      hasStopOnError: true,
      maxSteps: null,
      hasMaxSteps: false,
      extra: {},
    },
  };
}

function txBlockStepDraft(): TxStepFormModel {
  return {
    run: txOperationDraft("command"),
    rollback: null,
    hasRollback: true,
    rollbackOnFailure: false,
    hasRollbackOnFailure: true,
    extra: {},
  };
}

export function txBlockCommandPromptPatternsFromText(
  text: unknown = "",
): string[] {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function txBlockCommandPromptPatternList(
  prompt: Partial<TxRuntimePromptModel> = {},
): string[] {
  return Array.isArray(prompt?.patterns)
    ? prompt.patterns.map((patternValue) => txStringValue(patternValue))
    : [];
}

export function txBlockNumberFormValue(value: unknown): number | null {
  return value === "" ? null : Number(value);
}

function txBlockPresenceFlag(field: string): string {
  return `has${field[0].toUpperCase()}${field.slice(1)}`;
}

function txBlockToggleNullableFieldPresence<T extends JsonObject>(
  model: T,
  field: string,
  enabled: unknown,
  fallback?: unknown,
): T {
  const hasKey = txBlockPresenceFlag(field);
  return {
    ...model,
    [field]: enabled ? (model?.[field] ?? fallback ?? null) : null,
    [hasKey]: enabled,
  } as T;
}

function txBlockToggleObjectFieldPresence<T extends JsonObject>(
  model: T,
  field: string,
  enabled: unknown,
): T {
  const hasKey = txBlockPresenceFlag(field);
  return {
    ...model,
    [field]: enabled
      ? txPlainObject(model?.[field])
        ? cloneTxJsonValue(model[field], {})
        : {}
      : {},
    [hasKey]: enabled,
  } as T;
}

function txBlockToggleBooleanFieldPresence<T extends JsonObject>(
  model: T,
  field: string,
  enabled: unknown,
  fallback = false,
): T {
  const hasKey = txBlockPresenceFlag(field);
  return {
    ...model,
    [field]: enabled ? !!model?.[field] : fallback,
    [hasKey]: enabled,
  } as T;
}

function txBlockCloneModel<T extends JsonObject>(model: T): T {
  return structuredClone(model);
}

export function txBlockApplyChange<T>(
  onChange: ((nextModel: T) => unknown) | null | undefined,
  nextModel: T,
): unknown {
  return typeof onChange === "function" ? onChange(nextModel) : undefined;
}

export function txBlockChangeRoot(
  model: TxBlockFormModel,
  key: string,
  value: unknown,
): TxBlockFormModel {
  const next = txBlockCloneModel(model);
  const nextFields: JsonObject = next;
  nextFields[key] = key === "failFast" ? txBoolStringValue(value) : value;
  if (key === "failFast") next.hasFailFast = true;
  return next;
}

export function txBlockChangeRollbackKind(
  model: TxBlockFormModel,
  kind: TxRollbackKind,
): TxBlockFormModel {
  const next = txBlockCloneModel(model);
  next.rollbackPolicy = {
    kind,
    wholeResource:
      kind === "whole_resource"
        ? {
            rollback: txOperationDraft("command"),
            triggerStepIndex: 0,
            hasTriggerStepIndex: true,
            extra: {},
          }
        : undefined,
  };
  return next;
}

export function txBlockChangeWholeResourceTrigger(
  model: TxBlockFormModel,
  value: unknown,
): TxBlockFormModel {
  const next = txBlockCloneModel(model);
  const wholeResource = next.rollbackPolicy.wholeResource;
  if (!wholeResource) return next;
  wholeResource.triggerStepIndex = txBlockNumberFormValue(value) ?? 0;
  wholeResource.hasTriggerStepIndex = true;
  return next;
}

export function txBlockSetWholeResourceTriggerPresence(
  model: TxBlockFormModel,
  enabled: unknown,
): TxBlockFormModel {
  const next = txBlockCloneModel(model);
  if (next.rollbackPolicy?.kind !== "whole_resource") return next;
  const wholeResource = next.rollbackPolicy.wholeResource;
  if (!wholeResource) return next;
  next.rollbackPolicy.wholeResource = {
    ...wholeResource,
    triggerStepIndex: enabled ? (wholeResource.triggerStepIndex ?? 0) : null,
    hasTriggerStepIndex: !!enabled,
  };
  return next;
}

export function txBlockChangeWholeResourceRollback(
  model: TxBlockFormModel,
  operation: TxOperationModel,
): TxBlockFormModel {
  const next = txBlockCloneModel(model);
  const wholeResource = next.rollbackPolicy.wholeResource;
  if (!wholeResource) return next;
  wholeResource.rollback = operation;
  return next;
}

export function txBlockChangeWholeResourceExtra(
  model: TxBlockFormModel,
  extra: JsonObject,
): TxBlockFormModel {
  const next = txBlockCloneModel(model);
  const wholeResource = next.rollbackPolicy.wholeResource;
  if (!wholeResource) return next;
  wholeResource.extra = extra;
  return next;
}

export function txBlockAddStep(model: TxBlockFormModel): TxBlockFormModel {
  const next = txBlockCloneModel(model);
  if (!Array.isArray(next.steps)) next.steps = [];
  next.steps.push(txBlockStepDraft());
  return next;
}

export function txBlockDuplicateStep(
  model: TxBlockFormModel,
  stepIndex: number,
): TxBlockFormModel {
  const next = txBlockCloneModel(model);
  if (
    !Array.isArray(next.steps) ||
    !Number.isInteger(stepIndex) ||
    stepIndex < 0 ||
    stepIndex >= next.steps.length
  ) {
    return next;
  }
  next.steps.splice(stepIndex + 1, 0, structuredClone(next.steps[stepIndex]));
  return next;
}

export function txBlockMoveStep(
  model: TxBlockFormModel,
  fromIndex: number,
  toIndex: number,
): TxBlockFormModel {
  const next = txBlockCloneModel(model);
  if (
    !Array.isArray(next.steps) ||
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    fromIndex >= next.steps.length ||
    toIndex < 0 ||
    toIndex >= next.steps.length ||
    fromIndex === toIndex
  ) {
    return next;
  }
  const [step] = next.steps.splice(fromIndex, 1);
  next.steps.splice(toIndex, 0, step);
  return next;
}

export function txBlockRemoveStep(
  model: TxBlockFormModel,
  stepIndex: number,
): TxBlockFormModel {
  const next = txBlockCloneModel(model);
  next.steps.splice(stepIndex, 1);
  return next;
}

export function txBlockPatchStep(
  model: TxBlockFormModel,
  stepIndex: number,
  patch: Partial<TxStepFormModel>,
): TxBlockFormModel {
  const next = txBlockCloneModel(model);
  next.steps[stepIndex] = { ...next.steps[stepIndex], ...patch };
  return next;
}

export function txBlockPatchStepRollback(
  model: TxBlockFormModel,
  stepIndex: number,
  operation: TxOperationModel | null,
): TxBlockFormModel {
  return txBlockPatchStep(model, stepIndex, {
    rollback: operation,
    hasRollback: true,
  });
}

function txBlockPatchOperation(
  operation: TxOperationModel,
  mutator: (operation: TxOperationModel) => void,
): TxOperationModel {
  const next = txBlockCloneModel(operation);
  mutator(next);
  return next;
}

export function txBlockChangeOperationKind(
  operation: TxOperationModel,
  kind: TxOperationKind,
): TxOperationModel {
  return txBlockPatchOperation(operation, (next) => {
    next.kind = kind;
  });
}

export function txBlockPatchCommand(
  operation: TxOperationModel,
  patch: Partial<TxCommandModel>,
): TxOperationModel {
  return txBlockPatchOperation(operation, (next) => {
    next.command = { ...next.command, ...patch };
  });
}

export function txBlockPatchFlow(
  operation: TxOperationModel,
  patch: Partial<TxFlowModel>,
): TxOperationModel {
  return txBlockPatchOperation(operation, (next) => {
    next.flow = { ...next.flow, ...patch };
  });
}

export function txBlockAddFlowStep(
  operation: TxOperationModel,
): TxOperationModel {
  return txBlockPatchFlow(operation, {
    steps: [...operation.flow.steps, txCommandDraft()],
  });
}

export function txBlockDuplicateFlowStep(
  operation: TxOperationModel,
  stepIndex: number,
): TxOperationModel {
  const steps = Array.isArray(operation.flow?.steps)
    ? cloneTxJsonValue<TxCommandModel[]>(operation.flow.steps, [])
    : [];
  if (stepIndex < 0 || stepIndex >= steps.length) return operation;
  steps.splice(
    stepIndex + 1,
    0,
    cloneTxJsonValue(steps[stepIndex], txCommandDraft()),
  );
  return txBlockPatchFlow(operation, { steps });
}

export function txBlockMoveFlowStep(
  operation: TxOperationModel,
  fromIndex: number,
  toIndex: number,
): TxOperationModel {
  const sourceSteps = Array.isArray(operation.flow?.steps)
    ? operation.flow.steps
    : [];
  if (
    fromIndex < 0 ||
    fromIndex >= sourceSteps.length ||
    toIndex < 0 ||
    toIndex >= sourceSteps.length ||
    fromIndex === toIndex
  ) {
    return operation;
  }
  const steps = [...sourceSteps];
  const [step] = steps.splice(fromIndex, 1);
  steps.splice(toIndex, 0, step);
  return txBlockPatchFlow(operation, { steps });
}

export function txBlockUpdateFlowStep(
  operation: TxOperationModel,
  stepIndex: number,
  command: TxCommandModel,
): TxOperationModel {
  const steps = [...operation.flow.steps];
  steps[stepIndex] = command;
  return txBlockPatchFlow(operation, { steps });
}

export function txBlockRemoveFlowStep(
  operation: TxOperationModel,
  stepIndex: number,
): TxOperationModel {
  const steps = [...operation.flow.steps];
  steps.splice(stepIndex, 1);
  return txBlockPatchFlow(operation, { steps });
}

function txBlockNextCommandDynParamKey(command: TxCommandModel): string {
  const dynParams = txPlainObject(command?.dynParams) ? command.dynParams : {};
  let index = 1;
  while (Object.hasOwn(dynParams, `param${index}`)) index += 1;
  return `param${index}`;
}

export function txBlockUpdateCommandDynParam(
  command: TxCommandModel,
  key: unknown,
  value: unknown,
): TxCommandModel {
  const nextKey =
    String(key || "").trim() || txBlockNextCommandDynParamKey(command);
  const nextValue = txPlainObject(value)
    ? txStringValue(
        Object.hasOwn(value, "valueText")
          ? value.valueText
          : txJsonValueText(command?.dynParams?.[nextKey]),
      )
    : txJsonValueText(value);
  return {
    ...command,
    dynParams: {
      ...(txPlainObject(command.dynParams) ? command.dynParams : {}),
      [nextKey]: nextValue,
    },
    hasDynParams: true,
  };
}

export function txBlockRenameCommandDynParam(
  command: TxCommandModel,
  oldKey: string,
  newKey: string,
): TxCommandModel {
  const next = {
    ...(txPlainObject(command.dynParams) ? command.dynParams : {}),
  };
  const currentValue = next[oldKey];
  delete next[oldKey];
  if (String(newKey || "").trim()) {
    next[newKey] = currentValue;
  }
  return {
    ...command,
    dynParams: next,
    hasDynParams: true,
  };
}

export function txBlockRemoveCommandDynParam(
  command: TxCommandModel,
  key: string,
): TxCommandModel {
  const next = {
    ...(txPlainObject(command.dynParams) ? command.dynParams : {}),
  };
  delete next[key];
  return {
    ...command,
    dynParams: next,
    hasDynParams: true,
  };
}

function txBlockPatchCommandInteraction(
  command: TxCommandModel,
  patch: Partial<TxCommandInteractionModel> = {},
): TxCommandModel {
  const interaction = txCommandInteractionSource(command);
  return {
    ...command,
    interaction: {
      prompts: Array.isArray(interaction.prompts)
        ? [...interaction.prompts]
        : [],
      hasPrompts: !!interaction.hasPrompts,
      extra: txPlainObject(interaction.extra)
        ? cloneTxJsonValue(interaction.extra, {})
        : {},
      ...patch,
    },
    hasInteraction: true,
  };
}

export function txBlockAddCommandPrompt(
  command: TxCommandModel,
): TxCommandModel {
  const prompts = txCommandInteractionSource(command).prompts;
  return txBlockPatchCommandInteraction(command, {
    prompts: [
      ...(Array.isArray(prompts) ? prompts : []),
      {
        patterns: [],
        response: "",
        recordInput: false,
        hasRecordInput: true,
        extra: {},
      },
    ],
    hasPrompts: true,
  });
}

export function txBlockUpdateCommandPrompt(
  command: TxCommandModel,
  promptIndex: number,
  patch: Partial<TxRuntimePromptModel>,
): TxCommandModel {
  const sourcePrompts = txCommandInteractionSource(command).prompts;
  const prompts = Array.isArray(sourcePrompts) ? [...sourcePrompts] : [];
  prompts[promptIndex] = { ...prompts[promptIndex], ...patch };
  return txBlockPatchCommandInteraction(command, {
    prompts,
    hasPrompts: true,
  });
}

export function txBlockAddCommandPromptPattern(
  command: TxCommandModel,
  promptIndex: number,
): TxCommandModel {
  const prompt = command.interaction?.prompts?.[promptIndex] || {};
  return txBlockUpdateCommandPrompt(command, promptIndex, {
    patterns: [...txBlockCommandPromptPatternList(prompt), ""],
  });
}

export function txBlockRemoveCommandPromptPattern(
  command: TxCommandModel,
  promptIndex: number,
  patternIndex: number,
): TxCommandModel {
  const prompt = command.interaction?.prompts?.[promptIndex] || {};
  const patterns = txBlockCommandPromptPatternList(prompt);
  patterns.splice(patternIndex, 1);
  return txBlockUpdateCommandPrompt(command, promptIndex, { patterns });
}

export function txBlockSetCommandPromptPatternValue(
  command: TxCommandModel,
  promptIndex: number,
  patternIndex: number,
  patternValue: unknown,
): TxCommandModel {
  const prompt = command.interaction?.prompts?.[promptIndex] || {};
  const patterns = txBlockCommandPromptPatternList(prompt);
  patterns[patternIndex] = txStringValue(patternValue);
  return txBlockUpdateCommandPrompt(command, promptIndex, { patterns });
}

export function txBlockRemoveCommandPrompt(
  command: TxCommandModel,
  promptIndex: number,
): TxCommandModel {
  const interaction = txCommandInteractionSource(command);
  const prompts = Array.isArray(interaction.prompts)
    ? [...interaction.prompts]
    : [];
  prompts.splice(promptIndex, 1);
  return txBlockPatchCommandInteraction(command, { prompts });
}

export function txBlockPatchCommandInteractionExtra(
  command: TxCommandModel,
  extra: unknown,
): TxCommandModel {
  return txBlockPatchCommandInteraction(command, {
    extra: txPlainObject(extra) ? cloneTxJsonValue(extra, {}) : {},
  });
}

export function txBlockSetRootFieldPresence(
  model: TxBlockFormModel,
  field: string,
  enabled: unknown,
): TxBlockFormModel {
  const next = txBlockCloneModel(model);
  if (field === "failFast") {
    next.failFast = enabled ? !!next.failFast : true;
    next.hasFailFast = !!enabled;
  }
  return next;
}

export function txBlockSetStepFieldPresence(
  model: TxBlockFormModel,
  stepIndex: number,
  field: string,
  enabled: unknown,
): TxBlockFormModel {
  const step = model.steps?.[stepIndex] || {};
  if (field === "rollbackOnFailure") {
    return txBlockPatchStep(
      model,
      stepIndex,
      txBlockToggleBooleanFieldPresence(step, field, enabled, false),
    );
  }
  return model;
}

export function txBlockPatchStepRun(
  model: TxBlockFormModel,
  stepIndex: number,
  operation: TxOperationModel,
): TxBlockFormModel {
  return txBlockPatchStep(model, stepIndex, { run: operation });
}

export function txBlockSetStepRollbackEnabled(
  model: TxBlockFormModel,
  stepIndex: number,
  enabled: unknown,
): TxBlockFormModel {
  const step = model.steps?.[stepIndex] || {};
  if (!enabled) {
    return txBlockPatchStep(model, stepIndex, {
      hasRollback: true,
      rollback: null,
      hasRollbackOnFailure: true,
      rollbackOnFailure: false,
    });
  }
  return txBlockPatchStep(model, stepIndex, {
    hasRollback: true,
    rollback: step.rollback || txOperationDraft("command"),
  });
}

export function txBlockSetCommandTimeoutPresence(
  command: TxCommandModel,
  enabled: unknown,
): TxCommandModel {
  return txBlockToggleNullableFieldPresence(command, "timeout", enabled, 30);
}

export function txBlockSetCommandDynParamsPresence(
  command: TxCommandModel,
  enabled: unknown,
): TxCommandModel {
  return txBlockToggleObjectFieldPresence(command, "dynParams", enabled);
}

export function txBlockSetFlowMaxStepsPresence(
  flow: TxFlowModel,
  enabled: unknown,
): TxFlowModel {
  return txBlockToggleNullableFieldPresence(flow, "maxSteps", enabled);
}

export function txBlockSetFlowFieldPresence(
  flow: TxFlowModel,
  field: string,
  enabled: unknown,
): TxFlowModel {
  if (field === "stopOnError") {
    return txBlockToggleBooleanFieldPresence(flow, field, enabled, true);
  }
  if (field === "maxSteps") {
    return txBlockToggleNullableFieldPresence(flow, field, enabled);
  }
  return flow;
}

export function txBlockSetCommandPromptFieldPresence(
  command: TxCommandModel,
  promptIndex: number,
  field: string,
  enabled: unknown,
): TxCommandModel {
  const prompt = command.interaction?.prompts?.[promptIndex] || {};
  return txBlockUpdateCommandPrompt(
    command,
    promptIndex,
    txBlockToggleBooleanFieldPresence(prompt, field, enabled),
  );
}
