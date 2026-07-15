import {
  cloneJsonValue,
  jsonValueText,
  plainObject,
  stringValue,
} from "../lib/jsonValue.js";

const cloneTxJsonValue = cloneJsonValue;
const txPlainObject = plainObject;
const txStringValue = stringValue;
const txJsonValueText = jsonValueText;

function txBoolStringValue(value) {
  return value === "true" || value === true;
}

export function txInteractionExtraSource(command = {}) {
  return command &&
    typeof command === "object" &&
    txPlainObject(command.interaction) &&
    txPlainObject(command.interaction.extra)
    ? command.interaction.extra
    : {};
}

function txPromptExtraSource(prompt = {}) {
  return prompt && typeof prompt === "object" && txPlainObject(prompt.extra)
    ? prompt.extra
    : {};
}

export function txCommandPromptExtraSource(command = {}, promptIndex = -1) {
  if (!command || typeof command !== "object") return {};
  const interaction =
    command.interaction && typeof command.interaction === "object"
      ? command.interaction
      : null;
  const prompts =
    interaction && Array.isArray(interaction.prompts)
      ? interaction.prompts
      : [];
  return txPromptExtraSource(prompts[promptIndex]);
}

function txCommandDraft(command = {}) {
  return {
    mode: command.mode || "User",
    command: command.command || "",
    multilineMode: command.multilineMode === "whole" ? "whole" : "split_lines",
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

function txOperationDraft(kind = "command") {
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
    template: {
      hasRuntime: false,
      template: {
        name: "",
        vars: [],
        stopOnError: true,
        hasStopOnError: true,
        defaultMode: null,
        steps: [],
        extra: {},
      },
      runtime: {
        defaultMode: null,
        connectionName: null,
        host: null,
        username: null,
        deviceProfile: null,
        vars: {},
        extra: {},
      },
      extra: {},
    },
  };
}

function txBlockStepDraft() {
  return {
    run: txOperationDraft("command"),
    rollback: null,
    hasRollback: true,
    rollbackOnFailure: false,
    hasRollbackOnFailure: true,
    extra: {},
  };
}

export function txBlockCommandPromptPatternsFromText(text = "") {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function txBlockCommandPromptPatternList(prompt = {}) {
  return Array.isArray(prompt?.patterns)
    ? prompt.patterns.map((patternValue) => txStringValue(patternValue))
    : [];
}

export function txBlockNumberFormValue(value) {
  return value === "" ? null : Number(value);
}

export function txBlockNullableTextValue(value) {
  return value == null ? null : String(value);
}

function txBlockPresenceFlag(field) {
  return `has${field[0].toUpperCase()}${field.slice(1)}`;
}

function txBlockToggleNullableFieldPresence(
  model = {},
  field,
  enabled,
  fallback,
) {
  const hasKey = txBlockPresenceFlag(field);
  return {
    ...model,
    [field]: enabled ? (model?.[field] ?? fallback ?? null) : null,
    [hasKey]: enabled,
  };
}

function txBlockToggleArrayFieldPresence(model = {}, field, enabled) {
  const hasKey = txBlockPresenceFlag(field);
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

function txBlockToggleObjectFieldPresence(model = {}, field, enabled) {
  const hasKey = txBlockPresenceFlag(field);
  return {
    ...model,
    [field]: enabled
      ? txPlainObject(model?.[field])
        ? cloneTxJsonValue(model[field], {})
        : {}
      : {},
    [hasKey]: enabled,
  };
}

function txBlockToggleBooleanFieldPresence(
  model = {},
  field,
  enabled,
  fallback = false,
) {
  const hasKey = txBlockPresenceFlag(field);
  return {
    ...model,
    [field]: enabled ? !!model?.[field] : fallback,
    [hasKey]: enabled,
  };
}

function txBlockCloneModel(model) {
  return structuredClone(model || {});
}

export function txBlockApplyChange(onChange, nextModel) {
  return typeof onChange === "function" ? onChange(nextModel) : undefined;
}

export function txBlockChangeRoot(model, key, value) {
  const next = txBlockCloneModel(model);
  next[key] = key === "failFast" ? txBoolStringValue(value) : value;
  if (key === "failFast") next.hasFailFast = true;
  return next;
}

export function txBlockChangeRollbackKind(model, kind) {
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

export function txBlockChangeWholeResourceTrigger(model, value) {
  const next = txBlockCloneModel(model);
  next.rollbackPolicy.wholeResource.triggerStepIndex =
    txBlockNumberFormValue(value) ?? 0;
  next.rollbackPolicy.wholeResource.hasTriggerStepIndex = true;
  return next;
}

export function txBlockSetWholeResourceTriggerPresence(model, enabled) {
  const next = txBlockCloneModel(model);
  if (next.rollbackPolicy?.kind !== "whole_resource") return next;
  const wholeResource = next.rollbackPolicy.wholeResource || {};
  next.rollbackPolicy.wholeResource = {
    ...wholeResource,
    triggerStepIndex: enabled ? (wholeResource.triggerStepIndex ?? 0) : null,
    hasTriggerStepIndex: enabled,
  };
  return next;
}

export function txBlockChangeWholeResourceRollback(model, operation) {
  const next = txBlockCloneModel(model);
  next.rollbackPolicy.wholeResource.rollback = operation;
  return next;
}

export function txBlockChangeWholeResourceExtra(model, extra) {
  const next = txBlockCloneModel(model);
  next.rollbackPolicy.wholeResource.extra = extra;
  return next;
}

export function txBlockAddStep(model) {
  const next = txBlockCloneModel(model);
  if (!Array.isArray(next.steps)) next.steps = [];
  next.steps.push(txBlockStepDraft());
  return next;
}

export function txBlockDuplicateStep(model, stepIndex) {
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

export function txBlockMoveStep(model, fromIndex, toIndex) {
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

export function txBlockRemoveStep(model, stepIndex) {
  const next = txBlockCloneModel(model);
  next.steps.splice(stepIndex, 1);
  return next;
}

export function txBlockPatchStep(model, stepIndex, patch) {
  const next = txBlockCloneModel(model);
  next.steps[stepIndex] = { ...next.steps[stepIndex], ...patch };
  return next;
}

export function txBlockPatchStepRollback(model, stepIndex, operation) {
  return txBlockPatchStep(model, stepIndex, {
    rollback: operation,
    hasRollback: true,
  });
}

function txBlockPatchOperation(operation, mutator) {
  const next = txBlockCloneModel(operation);
  mutator(next);
  return next;
}

export function txBlockChangeOperationKind(operation, kind) {
  return txBlockPatchOperation(operation, (next) => {
    next.kind = kind;
  });
}

export function txBlockPatchCommand(operation, patch) {
  return txBlockPatchOperation(operation, (next) => {
    next.command = { ...next.command, ...patch };
  });
}

export function txBlockPatchFlow(operation, patch) {
  return txBlockPatchOperation(operation, (next) => {
    next.flow = { ...next.flow, ...patch };
  });
}

export function txBlockAddFlowStep(operation) {
  return txBlockPatchFlow(operation, {
    steps: [...operation.flow.steps, txCommandDraft()],
  });
}

export function txBlockDuplicateFlowStep(operation, stepIndex) {
  const steps = Array.isArray(operation.flow?.steps)
    ? cloneTxJsonValue(operation.flow.steps, [])
    : [];
  if (stepIndex < 0 || stepIndex >= steps.length) return operation;
  steps.splice(stepIndex + 1, 0, cloneTxJsonValue(steps[stepIndex]));
  return txBlockPatchFlow(operation, { steps });
}

export function txBlockMoveFlowStep(operation, fromIndex, toIndex) {
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

export function txBlockUpdateFlowStep(operation, stepIndex, command) {
  const steps = [...operation.flow.steps];
  steps[stepIndex] = command;
  return txBlockPatchFlow(operation, { steps });
}

export function txBlockRemoveFlowStep(operation, stepIndex) {
  const steps = [...operation.flow.steps];
  steps.splice(stepIndex, 1);
  return txBlockPatchFlow(operation, { steps });
}

function txBlockCommandDynParamFieldValue(command = {}, aliases = []) {
  const dynParams = txPlainObject(command.dynParams) ? command.dynParams : {};
  for (const alias of aliases) {
    if (Object.hasOwn(dynParams, alias)) {
      return txJsonValueText(dynParams[alias]);
    }
  }
  return "";
}

function txBlockNextCommandDynParamKey(command) {
  const dynParams = txPlainObject(command?.dynParams) ? command.dynParams : {};
  let index = 1;
  while (Object.hasOwn(dynParams, `param${index}`)) index += 1;
  return `param${index}`;
}

export function txBlockUpdateCommandDynParam(command, key, value) {
  const nextKey =
    String(key || "").trim() || txBlockNextCommandDynParamKey(command);
  const nextValue =
    value && typeof value === "object" && !Array.isArray(value)
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

export function txBlockRenameCommandDynParam(command, oldKey, newKey) {
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

export function txBlockRemoveCommandDynParam(command, key) {
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

export function txBlockAddCommandPrompt(command) {
  return {
    ...command,
    interaction: {
      extra: txPlainObject(command.interaction?.extra)
        ? cloneTxJsonValue(command.interaction.extra, {})
        : {},
      prompts: [
        ...(Array.isArray(command.interaction?.prompts)
          ? command.interaction.prompts
          : []),
        {
          patterns: [],
          response: "",
          recordInput: false,
          hasRecordInput: true,
          extra: {},
        },
      ],
      hasPrompts: true,
    },
    hasInteraction: true,
  };
}

export function txBlockUpdateCommandPrompt(command, promptIndex, patch) {
  const prompts = [
    ...(Array.isArray(command.interaction?.prompts)
      ? command.interaction.prompts
      : []),
  ];
  prompts[promptIndex] = { ...prompts[promptIndex], ...patch };
  return {
    ...command,
    interaction: {
      extra: txPlainObject(command.interaction?.extra)
        ? cloneTxJsonValue(command.interaction.extra, {})
        : {},
      prompts,
      hasPrompts: true,
    },
    hasInteraction: true,
  };
}

export function txBlockAddCommandPromptPattern(command, promptIndex) {
  const prompt = command.interaction?.prompts?.[promptIndex] || {};
  return txBlockUpdateCommandPrompt(command, promptIndex, {
    patterns: [...txBlockCommandPromptPatternList(prompt), ""],
  });
}

export function txBlockRemoveCommandPromptPattern(
  command,
  promptIndex,
  patternIndex,
) {
  const prompt = command.interaction?.prompts?.[promptIndex] || {};
  const patterns = txBlockCommandPromptPatternList(prompt);
  patterns.splice(patternIndex, 1);
  return txBlockUpdateCommandPrompt(command, promptIndex, { patterns });
}

export function txBlockSetCommandPromptPatternValue(
  command,
  promptIndex,
  patternIndex,
  patternValue,
) {
  const prompt = command.interaction?.prompts?.[promptIndex] || {};
  const patterns = txBlockCommandPromptPatternList(prompt);
  patterns[patternIndex] = txStringValue(patternValue);
  return txBlockUpdateCommandPrompt(command, promptIndex, { patterns });
}

export function txBlockRemoveCommandPrompt(command, promptIndex) {
  const prompts = [
    ...(Array.isArray(command.interaction?.prompts)
      ? command.interaction.prompts
      : []),
  ];
  prompts.splice(promptIndex, 1);
  return {
    ...command,
    interaction: {
      extra: txPlainObject(command.interaction?.extra)
        ? cloneTxJsonValue(command.interaction.extra, {})
        : {},
      prompts,
      hasPrompts: !!command.interaction?.hasPrompts,
    },
    hasInteraction: true,
  };
}

export function txBlockPatchCommandInteractionExtra(command = {}, extra) {
  const interaction = txPlainObject(command?.interaction)
    ? command.interaction
    : { prompts: [], hasPrompts: false, extra: {} };
  return {
    ...command,
    interaction: {
      prompts: Array.isArray(interaction.prompts)
        ? [...interaction.prompts]
        : [],
      hasPrompts: !!interaction.hasPrompts,
      extra: txPlainObject(extra) ? cloneTxJsonValue(extra, {}) : {},
    },
    hasInteraction: true,
  };
}

export function txBlockSetCommandInteractionPromptsPresence(
  command = {},
  enabled,
) {
  const interaction = txPlainObject(command?.interaction)
    ? command.interaction
    : { prompts: [], hasPrompts: false, extra: {} };
  return {
    ...command,
    interaction: {
      prompts: enabled
        ? Array.isArray(interaction.prompts)
          ? [...interaction.prompts]
          : []
        : [],
      hasPrompts: enabled,
      extra: txPlainObject(interaction.extra)
        ? cloneTxJsonValue(interaction.extra, {})
        : {},
    },
    hasInteraction: true,
  };
}

export function txBlockSetRootFieldPresence(model = {}, field, enabled) {
  const next = txBlockCloneModel(model);
  if (field === "failFast") {
    next.failFast = enabled ? !!next.failFast : true;
    next.hasFailFast = enabled;
  }
  return next;
}

export function txBlockSetStepFieldPresence(
  model = {},
  stepIndex,
  field,
  enabled,
) {
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

export function txBlockPatchStepRun(model, stepIndex, operation) {
  return txBlockPatchStep(model, stepIndex, { run: operation });
}

export function txBlockSetStepRollbackEnabled(model, stepIndex, enabled) {
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

export function txBlockSetCommandTimeoutPresence(command = {}, enabled) {
  return txBlockToggleNullableFieldPresence(command, "timeout", enabled, 30);
}

export function txBlockSetCommandDynParamsPresence(command = {}, enabled) {
  return txBlockToggleObjectFieldPresence(command, "dynParams", enabled);
}

export function txBlockSetCommandInteractionPresence(command = {}, enabled) {
  if (!enabled) {
    return txBlockToggleObjectFieldPresence(command, "interaction", false);
  }
  return {
    ...command,
    interaction: txPlainObject(command?.interaction)
      ? {
          prompts: Array.isArray(command.interaction.prompts)
            ? [...command.interaction.prompts]
            : [],
          hasPrompts: !!command.interaction.hasPrompts,
          extra: txPlainObject(command.interaction.extra)
            ? cloneTxJsonValue(command.interaction.extra, {})
            : {},
        }
      : { prompts: [], hasPrompts: false, extra: {} },
    hasInteraction: true,
  };
}

export function txBlockSetFlowMaxStepsPresence(flow = {}, enabled) {
  return txBlockToggleNullableFieldPresence(flow, "maxSteps", enabled);
}

export function txBlockSetFlowFieldPresence(flow = {}, field, enabled) {
  if (field === "stopOnError") {
    return txBlockToggleBooleanFieldPresence(flow, field, enabled, true);
  }
  if (field === "maxSteps") {
    return txBlockToggleNullableFieldPresence(flow, field, enabled);
  }
  return flow;
}

export function txBlockSetCommandPromptFieldPresence(
  command,
  promptIndex,
  field,
  enabled,
) {
  const prompt = command.interaction?.prompts?.[promptIndex] || {};
  return txBlockUpdateCommandPrompt(
    command,
    promptIndex,
    txBlockToggleBooleanFieldPresence(prompt, field, enabled),
  );
}
