import {
  cloneJsonValue,
  jsonValueFromText,
  jsonValueText,
  jsonValueType,
  plainObject,
  stringValue,
} from "../lib/jsonValue.js";

const cloneTxJsonValue = cloneJsonValue;
const txPlainObject = plainObject;
const txStringValue = stringValue;
const txJsonValueFromText = jsonValueFromText;
const txJsonValueType = jsonValueType;
const txJsonValueText = jsonValueText;

export function txBlockNumberFormValue(value) {
  return value === "" ? null : Number(value);
}

export function txBlockNullableTextValue(value) {
  return value == null ? null : String(value);
}

function txBlockNullableModeValue(value = "") {
  return value === "null" ? "null" : "value";
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

export function txBlockSetNullableFieldMode(
  model = {},
  field,
  mode,
  fallback = "",
) {
  const hasKey = txBlockPresenceFlag(field);
  if (txBlockNullableModeValue(mode) === "null") {
    return {
      ...model,
      [field]: null,
      [hasKey]: true,
    };
  }
  return {
    ...model,
    [field]:
      model?.[field] == null ? String(fallback ?? "") : String(model[field]),
    [hasKey]: true,
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

function txBlockPatchOperation(operation, mutator) {
  const next = txBlockCloneModel(operation);
  mutator(next);
  return next;
}

function txBlockPatchTemplateOperation(operation, patch) {
  return txBlockPatchOperation(operation, (next) => {
    next.template = { ...next.template, ...patch };
  });
}

export function txBlockPatchTemplateOperationFields(operation, patch) {
  return txBlockPatchTemplateOperation(operation, patch);
}

export function txBlockSetTemplateCurrentConnectionAliasPresence(
  operation = {},
  enabled,
) {
  return txBlockPatchTemplateOperation(operation, {
    currentConnectionAlias: enabled
      ? (operation.template?.currentConnectionAlias ?? "current")
      : null,
    hasCurrentConnectionAlias: enabled,
  });
}

export function txBlockPatchTemplateDefinition(operation, patch) {
  return txBlockPatchTemplateOperation(operation, {
    template: { ...operation.template.template, ...patch },
  });
}

export function txBlockSetTemplateDefinitionFieldPresence(
  operation = {},
  field,
  enabled,
) {
  if (field === "stopOnError") {
    return txBlockPatchTemplateDefinition(
      operation,
      txBlockToggleBooleanFieldPresence(
        operation.template?.template,
        field,
        enabled,
        true,
      ),
    );
  }
  return txBlockPatchTemplateDefinition(
    operation,
    txBlockToggleNullableFieldPresence(
      operation.template?.template,
      field,
      enabled,
    ),
  );
}

export function txBlockSetTemplateDefinitionCollectionPresence(
  operation = {},
  field,
  enabled,
) {
  return txBlockPatchTemplateDefinition(
    operation,
    txBlockToggleArrayFieldPresence(
      operation.template?.template,
      field,
      enabled,
    ),
  );
}

export function txBlockPatchTemplateRuntime(operation, patch) {
  return txBlockPatchTemplateOperation(operation, {
    hasRuntime: true,
    runtime: { ...operation.template.runtime, ...patch },
  });
}

export function txBlockSetTemplateRuntimeFieldPresence(
  operation = {},
  field,
  enabled,
) {
  const runtime = operation.template?.runtime;
  const runtimePatch =
    field === "vars"
      ? txBlockToggleObjectFieldPresence(runtime, field, enabled)
      : txBlockToggleNullableFieldPresence(runtime, field, enabled);
  return txBlockPatchTemplateRuntime(operation, runtimePatch);
}

export function txBlockSetTemplateRuntimePresence(operation = {}, enabled) {
  if (!enabled) {
    return txBlockPatchTemplateOperation(operation, {
      hasRuntime: false,
      runtime: {
        defaultMode: null,
        hasDefaultMode: false,
        connectionName: null,
        hasConnectionName: false,
        host: null,
        hasHost: false,
        username: null,
        hasUsername: false,
        deviceProfile: null,
        hasDeviceProfile: false,
        vars: {},
        hasVars: false,
        extra: {},
      },
    });
  }
  return txBlockPatchTemplateOperation(operation, {
    hasRuntime: true,
    runtime: {
      defaultMode: operation.template?.runtime?.defaultMode ?? null,
      hasDefaultMode: !!operation.template?.runtime?.hasDefaultMode,
      connectionName: operation.template?.runtime?.connectionName ?? null,
      hasConnectionName: !!operation.template?.runtime?.hasConnectionName,
      host: operation.template?.runtime?.host ?? null,
      hasHost: !!operation.template?.runtime?.hasHost,
      username: operation.template?.runtime?.username ?? null,
      hasUsername: !!operation.template?.runtime?.hasUsername,
      deviceProfile: operation.template?.runtime?.deviceProfile ?? null,
      hasDeviceProfile: !!operation.template?.runtime?.hasDeviceProfile,
      vars: txPlainObject(operation.template?.runtime?.vars)
        ? cloneTxJsonValue(operation.template.runtime.vars, {})
        : {},
      hasVars: !!operation.template?.runtime?.hasVars,
      extra: txPlainObject(operation.template?.runtime?.extra)
        ? cloneTxJsonValue(operation.template.runtime.extra, {})
        : {},
    },
  });
}

export function txBlockAddTemplateVar(operation) {
  return txBlockPatchTemplateDefinition(operation, {
    vars: [
      ...operation.template.template.vars,
      {
        name: "",
        label: null,
        description: null,
        type: "string",
        required: false,
        placeholder: null,
        options: [],
        defaultValue: null,
        hasDefault: false,
        extra: {},
      },
    ],
  });
}

export function txBlockUpdateTemplateVar(operation, varIndex, patch) {
  const vars = [...operation.template.template.vars];
  vars[varIndex] = { ...vars[varIndex], ...patch };
  return txBlockPatchTemplateDefinition(operation, { vars });
}

export function txBlockSetTemplateVarFieldPresence(
  operation,
  varIndex,
  field,
  enabled,
) {
  const variable = operation.template.template.vars[varIndex] || {};
  let patch;
  if (field === "required") {
    patch = txBlockToggleBooleanFieldPresence(variable, field, enabled);
  } else if (field === "type") {
    patch = {
      ...variable,
      type: enabled ? variable.type || "string" : "string",
      hasType: enabled,
    };
  } else if (field === "options") {
    patch = txBlockToggleArrayFieldPresence(variable, field, enabled);
  } else if (field === "default") {
    patch = {
      ...variable,
      defaultValue: enabled ? cloneTxJsonValue(variable.defaultValue) : null,
      hasDefault: enabled,
    };
  } else {
    patch = txBlockToggleNullableFieldPresence(variable, field, enabled);
  }
  return txBlockUpdateTemplateVar(operation, varIndex, patch);
}

export function txBlockAddTemplateVarOption(operation, varIndex) {
  const variable = operation.template.template.vars[varIndex] || {};
  return txBlockUpdateTemplateVar(operation, varIndex, {
    options: [...(Array.isArray(variable.options) ? variable.options : []), ""],
    hasOptions: true,
  });
}

export function txBlockUpdateTemplateVarOption(
  operation,
  varIndex,
  optionIndex,
  patch = {},
) {
  const variable = operation.template.template.vars[varIndex] || {};
  const options = [
    ...(Array.isArray(variable.options) ? variable.options : []),
  ];
  const currentValue = txStringValue(options[optionIndex]);
  options[optionIndex] = txStringValue(
    Object.hasOwn(patch, "valueText") ? patch.valueText : currentValue,
  );
  return txBlockUpdateTemplateVar(operation, varIndex, {
    options,
    hasOptions: true,
  });
}

export function txBlockRemoveTemplateVarOption(
  operation,
  varIndex,
  optionIndex,
) {
  const variable = operation.template.template.vars[varIndex] || {};
  const options = [
    ...(Array.isArray(variable.options) ? variable.options : []),
  ];
  options.splice(optionIndex, 1);
  return txBlockUpdateTemplateVar(operation, varIndex, {
    options,
    hasOptions: true,
  });
}

export function txBlockSetTemplateVarDefault(operation, varIndex, patch = {}) {
  const variable = operation.template.template.vars[varIndex] || {};
  return txBlockUpdateTemplateVar(operation, varIndex, {
    defaultValue: txJsonValueFromText(
      patch.typeValue || txJsonValueType(variable.defaultValue),
      Object.hasOwn(patch, "valueText")
        ? patch.valueText
        : txJsonValueText(variable.defaultValue),
    ),
    hasDefault: true,
  });
}

export function txBlockClearTemplateVarDefault(operation, varIndex) {
  return txBlockUpdateTemplateVar(operation, varIndex, {
    defaultValue: null,
    hasDefault: false,
  });
}

export function txBlockRemoveTemplateVar(operation, varIndex) {
  const vars = [...operation.template.template.vars];
  vars.splice(varIndex, 1);
  return txBlockPatchTemplateDefinition(operation, { vars });
}

export function txBlockAddTemplateStep(operation) {
  return txBlockPatchTemplateDefinition(operation, {
    steps: [
      ...operation.template.template.steps,
      {
        command: "",
        mode: null,
        timeoutSecs: null,
        hasTimeoutSecs: false,
        prompts: [],
        hasPrompts: false,
        extra: {},
      },
    ],
  });
}

export function txBlockUpdateTemplateStep(operation, stepIndex, patch) {
  const steps = [...operation.template.template.steps];
  steps[stepIndex] = { ...steps[stepIndex], ...patch };
  return txBlockPatchTemplateDefinition(operation, { steps });
}

export function txBlockSetTemplateStepFieldPresence(
  operation,
  stepIndex,
  field,
  enabled,
) {
  const step = operation.template.template.steps[stepIndex] || {};
  if (field === "prompts") {
    return txBlockUpdateTemplateStep(
      operation,
      stepIndex,
      txBlockToggleArrayFieldPresence(step, field, enabled),
    );
  }
  const patch = txBlockToggleNullableFieldPresence(step, field, enabled);
  return txBlockUpdateTemplateStep(operation, stepIndex, patch);
}

export function txBlockRemoveTemplateStep(operation, stepIndex) {
  const steps = [...operation.template.template.steps];
  steps.splice(stepIndex, 1);
  return txBlockPatchTemplateDefinition(operation, { steps });
}

export function txBlockAddTemplatePrompt(operation, stepIndex) {
  const step = operation.template.template.steps[stepIndex];
  return txBlockUpdateTemplateStep(operation, stepIndex, {
    prompts: [
      ...(Array.isArray(step?.prompts) ? step.prompts : []),
      {
        patterns: [],
        response: "",
        appendNewline: false,
        hasAppendNewline: true,
        recordInput: false,
        hasRecordInput: true,
        extra: {},
      },
    ],
    hasPrompts: true,
  });
}

export function txBlockAddTemplatePromptPattern(
  operation,
  stepIndex,
  promptIndex,
) {
  const step = operation.template.template.steps[stepIndex];
  const prompt = step?.prompts?.[promptIndex] || {};
  return txBlockUpdateTemplatePrompt(operation, stepIndex, promptIndex, {
    patterns: [...(Array.isArray(prompt.patterns) ? prompt.patterns : []), ""],
  });
}

export function txBlockUpdateTemplatePromptPattern(
  operation,
  stepIndex,
  promptIndex,
  patternIndex,
  patternText,
) {
  const step = operation.template.template.steps[stepIndex];
  const prompt = step?.prompts?.[promptIndex] || {};
  const patterns = [...(Array.isArray(prompt.patterns) ? prompt.patterns : [])];
  patterns[patternIndex] = txStringValue(patternText);
  return txBlockUpdateTemplatePrompt(operation, stepIndex, promptIndex, {
    patterns,
  });
}

export function txBlockRemoveTemplatePromptPattern(
  operation,
  stepIndex,
  promptIndex,
  patternIndex,
) {
  const step = operation.template.template.steps[stepIndex];
  const prompt = step?.prompts?.[promptIndex] || {};
  const patterns = [...(Array.isArray(prompt.patterns) ? prompt.patterns : [])];
  patterns.splice(patternIndex, 1);
  return txBlockUpdateTemplatePrompt(operation, stepIndex, promptIndex, {
    patterns,
  });
}

export function txBlockUpdateTemplatePrompt(
  operation,
  stepIndex,
  promptIndex,
  patch,
) {
  const step = operation.template.template.steps[stepIndex];
  const prompts = [...(Array.isArray(step?.prompts) ? step.prompts : [])];
  prompts[promptIndex] = { ...prompts[promptIndex], ...patch };
  return txBlockUpdateTemplateStep(operation, stepIndex, {
    prompts,
    hasPrompts: true,
  });
}

export function txBlockSetTemplatePromptFieldPresence(
  operation,
  stepIndex,
  promptIndex,
  field,
  enabled,
) {
  const step = operation.template.template.steps[stepIndex];
  const prompt = step?.prompts?.[promptIndex] || {};
  return txBlockUpdateTemplatePrompt(
    operation,
    stepIndex,
    promptIndex,
    txBlockToggleBooleanFieldPresence(prompt, field, enabled),
  );
}

export function txBlockRemoveTemplatePrompt(operation, stepIndex, promptIndex) {
  const step = operation.template.template.steps[stepIndex];
  const prompts = [...(Array.isArray(step?.prompts) ? step.prompts : [])];
  prompts.splice(promptIndex, 1);
  return txBlockUpdateTemplateStep(operation, stepIndex, {
    prompts,
    hasPrompts: !!step?.hasPrompts,
  });
}

function txBlockNextRuntimeVarKey(operation) {
  const vars = txPlainObject(operation?.template?.runtime?.vars)
    ? operation.template.runtime.vars
    : {};
  let index = 1;
  while (Object.hasOwn(vars, `var${index}`)) index += 1;
  return `var${index}`;
}

export function txBlockAddTemplateRuntimeVar(operation) {
  const nextKey = txBlockNextRuntimeVarKey(operation);
  return txBlockPatchTemplateRuntime(operation, {
    vars: {
      ...(txPlainObject(operation.template.runtime.vars)
        ? operation.template.runtime.vars
        : {}),
      [nextKey]: "",
    },
    hasVars: true,
  });
}

export function txBlockRenameTemplateRuntimeVar(operation, oldKey, newKey) {
  const vars = {
    ...(txPlainObject(operation.template.runtime.vars)
      ? operation.template.runtime.vars
      : {}),
  };
  const currentValue = vars[oldKey];
  delete vars[oldKey];
  const key = txStringValue(newKey).trim();
  if (key) vars[key] = currentValue;
  return txBlockPatchTemplateRuntime(operation, {
    vars,
    hasVars: true,
  });
}

export function txBlockUpdateTemplateRuntimeVar(operation, key, patch = {}) {
  const vars = {
    ...(txPlainObject(operation.template.runtime.vars)
      ? operation.template.runtime.vars
      : {}),
  };
  const currentValue = vars[key];
  vars[key] = txJsonValueFromText(
    patch.typeValue || txJsonValueType(currentValue),
    Object.hasOwn(patch, "valueText")
      ? patch.valueText
      : txJsonValueText(currentValue),
  );
  return txBlockPatchTemplateRuntime(operation, {
    vars,
    hasVars: true,
  });
}

export function txBlockRemoveTemplateRuntimeVar(operation, key) {
  const vars = {
    ...(txPlainObject(operation.template.runtime.vars)
      ? operation.template.runtime.vars
      : {}),
  };
  delete vars[key];
  return txBlockPatchTemplateRuntime(operation, {
    vars,
    hasVars: true,
  });
}
