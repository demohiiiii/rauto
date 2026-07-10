import {
  callbackMappedFormCheckedHandler,
  callbackMappedFormValueHandler,
} from "../lib/events.js";
import {
  txBlockAddTemplatePrompt,
  txBlockAddTemplatePromptPattern,
  txBlockAddTemplateRuntimeVar,
  txBlockAddTemplateStep,
  txBlockAddTemplateVar,
  txBlockAddTemplateVarOption,
  txBlockApplyChange,
  txBlockClearTemplateVarDefault,
  txBlockNullableTextValue,
  txBlockNumberFormValue,
  txBlockPatchTemplateDefinition,
  txBlockPatchTemplateOperationFields,
  txBlockPatchTemplateRuntime,
  txBlockRemoveTemplatePrompt,
  txBlockRemoveTemplatePromptPattern,
  txBlockRemoveTemplateRuntimeVar,
  txBlockRemoveTemplateStep,
  txBlockRemoveTemplateVar,
  txBlockRemoveTemplateVarOption,
  txBlockRenameTemplateRuntimeVar,
  txBlockSetNullableFieldMode,
  txBlockSetTemplateCurrentConnectionAliasPresence,
  txBlockSetTemplateDefinitionCollectionPresence,
  txBlockSetTemplateDefinitionFieldPresence,
  txBlockSetTemplatePromptFieldPresence,
  txBlockSetTemplateRuntimeFieldPresence,
  txBlockSetTemplateRuntimePresence,
  txBlockSetTemplateStepFieldPresence,
  txBlockSetTemplateVarDefault,
  txBlockSetTemplateVarFieldPresence,
  txBlockUpdateTemplatePrompt,
  txBlockUpdateTemplatePromptPattern,
  txBlockUpdateTemplateRuntimeVar,
  txBlockUpdateTemplateStep,
  txBlockUpdateTemplateVar,
  txBlockUpdateTemplateVarOption,
} from "./transactionBlockTemplateMutations.js";
import {
  txExtraStringPresenceChangeHandler,
  txExtraStringValueChangeHandler,
} from "./transactionMetadataFields.js";

export {
  txBlockSetTemplateCurrentConnectionAliasPresence,
  txBlockSetTemplateDefinitionCollectionPresence,
  txBlockSetTemplateDefinitionFieldPresence,
  txBlockSetTemplatePromptFieldPresence,
  txBlockSetTemplateRuntimeFieldPresence,
  txBlockSetTemplateStepFieldPresence,
  txBlockSetTemplateVarFieldPresence,
  txBlockUpdateTemplateVarOption,
} from "./transactionBlockTemplateMutations.js";

export function txBlockTemplateBindings(operation, onChange) {
  return {
    addStep() {
      txBlockApplyChange(onChange, txBlockAddTemplateStep(operation));
    },
    addVar() {
      txBlockApplyChange(onChange, txBlockAddTemplateVar(operation));
    },
    setCollectionPresence(field, enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplateDefinitionCollectionPresence(
          operation,
          field,
          enabled,
        ),
      );
    },
    setExtra(extra) {
      txBlockApplyChange(
        onChange,
        txBlockPatchTemplateOperationFields(operation, { extra }),
      );
    },
    setRuntimePresence(enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplateRuntimePresence(operation, enabled),
      );
    },
  };
}

export function txBlockTemplateDefinitionBindings(operation, onChange) {
  return {
    setCurrentConnectionAliasPresence(enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplateCurrentConnectionAliasPresence(operation, enabled),
      );
    },
    setOperationExtra(extra) {
      txBlockApplyChange(
        onChange,
        txBlockPatchTemplateOperationFields(operation, { extra }),
      );
    },
    setOperationNullableField(key, value) {
      txBlockApplyChange(
        onChange,
        txBlockPatchTemplateOperationFields(operation, {
          [key]: txBlockNullableTextValue(value),
          [`has${key[0].toUpperCase()}${key.slice(1)}`]: true,
        }),
      );
    },
    setOperationNullableFieldMode(key, mode) {
      txBlockApplyChange(
        onChange,
        txBlockPatchTemplateOperationFields(
          operation,
          txBlockSetNullableFieldMode(operation.template, key, mode),
        ),
      );
    },
    setTemplateBooleanField(key, value) {
      txBlockApplyChange(
        onChange,
        txBlockPatchTemplateDefinition(operation, {
          [key]: value === "true",
          [`has${key[0].toUpperCase()}${key.slice(1)}`]: true,
        }),
      );
    },
    setTemplateExtra(extra) {
      txBlockApplyChange(
        onChange,
        txBlockPatchTemplateDefinition(operation, { extra }),
      );
    },
    setTemplateField(key, value) {
      txBlockApplyChange(
        onChange,
        txBlockPatchTemplateDefinition(operation, { [key]: value }),
      );
    },
    setTemplateFieldPresence(field, enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplateDefinitionFieldPresence(operation, field, enabled),
      );
    },
    setTemplateNullableField(key, value) {
      txBlockApplyChange(
        onChange,
        txBlockPatchTemplateDefinition(operation, {
          [key]: txBlockNullableTextValue(value),
          [`has${key[0].toUpperCase()}${key.slice(1)}`]: true,
        }),
      );
    },
    setTemplateNullableFieldMode(key, mode) {
      txBlockApplyChange(
        onChange,
        txBlockPatchTemplateDefinition(
          operation,
          txBlockSetNullableFieldMode(operation.template.template, key, mode),
        ),
      );
    },
  };
}

export function txBlockTemplateRuntimeBindings(operation, onChange) {
  return {
    addRuntimeVar() {
      txBlockApplyChange(onChange, txBlockAddTemplateRuntimeVar(operation));
    },
    removeRuntimeVar(key) {
      txBlockApplyChange(
        onChange,
        txBlockRemoveTemplateRuntimeVar(operation, key),
      );
    },
    renameRuntimeVar(oldKey, newKey) {
      txBlockApplyChange(
        onChange,
        txBlockRenameTemplateRuntimeVar(operation, oldKey, newKey),
      );
    },
    setRuntimeExtra(extra) {
      txBlockApplyChange(
        onChange,
        txBlockPatchTemplateRuntime(operation, { extra }),
      );
    },
    setRuntimePresence(enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplateRuntimePresence(operation, enabled),
      );
    },
    setRuntimeFieldPresence(key, enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplateRuntimeFieldPresence(operation, key, enabled),
      );
    },
    setRuntimeNullableField(key, value) {
      txBlockApplyChange(
        onChange,
        txBlockPatchTemplateRuntime(operation, {
          [key]: txBlockNullableTextValue(value),
          [`has${key[0].toUpperCase()}${key.slice(1)}`]: true,
        }),
      );
    },
    setRuntimeNullableFieldMode(key, mode) {
      txBlockApplyChange(
        onChange,
        txBlockPatchTemplateRuntime(
          operation,
          txBlockSetNullableFieldMode(operation.template.runtime, key, mode),
        ),
      );
    },
    setRuntimeVarType(key, typeValue) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplateRuntimeVar(operation, key, { typeValue }),
      );
    },
    setRuntimeVarValue(key, valueText) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplateRuntimeVar(operation, key, { valueText }),
      );
    },
  };
}

export function txBlockTemplateStepBindings(
  operation,
  templateStepIndex,
  onChange,
) {
  return {
    addPrompt() {
      txBlockApplyChange(
        onChange,
        txBlockAddTemplatePrompt(operation, templateStepIndex),
      );
    },
    removeStep() {
      txBlockApplyChange(
        onChange,
        txBlockRemoveTemplateStep(operation, templateStepIndex),
      );
    },
    setExtra(extra) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplateStep(operation, templateStepIndex, { extra }),
      );
    },
    setField(key, value) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplateStep(operation, templateStepIndex, {
          [key]: value,
        }),
      );
    },
    setFieldPresence(field, enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplateStepFieldPresence(
          operation,
          templateStepIndex,
          field,
          enabled,
        ),
      );
    },
    setPromptsPresence(enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplateStepFieldPresence(
          operation,
          templateStepIndex,
          "prompts",
          enabled,
        ),
      );
    },
    setMode(value) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplateStep(operation, templateStepIndex, {
          hasMode: true,
          mode: txBlockNullableTextValue(value),
        }),
      );
    },
    setModeState(mode) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplateStep(
          operation,
          templateStepIndex,
          txBlockSetNullableFieldMode(
            operation.template.template.steps?.[templateStepIndex] || {},
            "mode",
            mode,
          ),
        ),
      );
    },
    setTimeoutSecs(value) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplateStep(operation, templateStepIndex, {
          hasTimeoutSecs: true,
          timeoutSecs: txBlockNumberFormValue(value),
        }),
      );
    },
  };
}

export function txBlockTemplateVarBindings(operation, varIndex, onChange) {
  return {
    addDefault() {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplateVarDefault(operation, varIndex, {
          typeValue: "string",
          valueText: "",
        }),
      );
    },
    addOption() {
      txBlockApplyChange(
        onChange,
        txBlockAddTemplateVarOption(operation, varIndex),
      );
    },
    clearDefault() {
      txBlockApplyChange(
        onChange,
        txBlockClearTemplateVarDefault(operation, varIndex),
      );
    },
    removeVar() {
      txBlockApplyChange(
        onChange,
        txBlockRemoveTemplateVar(operation, varIndex),
      );
    },
    removeOption(optionIndex) {
      txBlockApplyChange(
        onChange,
        txBlockRemoveTemplateVarOption(operation, varIndex, optionIndex),
      );
    },
    setDefaultValueText(valueText) {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplateVarDefault(operation, varIndex, { valueText }),
      );
    },
    setDefaultValueType(typeValue) {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplateVarDefault(operation, varIndex, { typeValue }),
      );
    },
    setExtra(extra) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplateVar(operation, varIndex, { extra }),
      );
    },
    setField(key, value) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplateVar(operation, varIndex, {
          [key]: value,
          [`has${key[0].toUpperCase()}${key.slice(1)}`]: true,
        }),
      );
    },
    setFieldPresence(field, enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplateVarFieldPresence(operation, varIndex, field, enabled),
      );
    },
    setNullableField(key, value) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplateVar(operation, varIndex, {
          [key]: txBlockNullableTextValue(value),
          [`has${key[0].toUpperCase()}${key.slice(1)}`]: true,
        }),
      );
    },
    setNullableFieldMode(key, mode) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplateVar(
          operation,
          varIndex,
          txBlockSetNullableFieldMode(
            operation.template.template.vars?.[varIndex] || {},
            key,
            mode,
          ),
        ),
      );
    },
    setOptionsPresence(enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplateVarFieldPresence(
          operation,
          varIndex,
          "options",
          enabled,
        ),
      );
    },
    setOptionValue(optionIndex, valueText) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplateVarOption(operation, varIndex, optionIndex, {
          valueText,
        }),
      );
    },
    setRequired(requiredValue) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplateVar(operation, varIndex, {
          hasRequired: true,
          required: requiredValue === "true",
        }),
      );
    },
  };
}

export function txBlockTemplatePromptBindings(
  operation,
  templateStepIndex,
  promptIndex,
  onChange,
) {
  return {
    addPattern() {
      txBlockApplyChange(
        onChange,
        txBlockAddTemplatePromptPattern(
          operation,
          templateStepIndex,
          promptIndex,
        ),
      );
    },
    removePattern(patternIndex) {
      txBlockApplyChange(
        onChange,
        txBlockRemoveTemplatePromptPattern(
          operation,
          templateStepIndex,
          promptIndex,
          patternIndex,
        ),
      );
    },
    removePrompt() {
      txBlockApplyChange(
        onChange,
        txBlockRemoveTemplatePrompt(operation, templateStepIndex, promptIndex),
      );
    },
    setBooleanField(key, value) {
      const flagKey = `has${key[0].toUpperCase()}${key.slice(1)}`;
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplatePrompt(operation, templateStepIndex, promptIndex, {
          [flagKey]: true,
          [key]: value,
        }),
      );
    },
    setExtra(extra) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplatePrompt(operation, templateStepIndex, promptIndex, {
          extra,
        }),
      );
    },
    setFieldPresence(field, enabled) {
      txBlockApplyChange(
        onChange,
        txBlockSetTemplatePromptFieldPresence(
          operation,
          templateStepIndex,
          promptIndex,
          field,
          enabled,
        ),
      );
    },
    setPatternValue(patternIndex, patternText) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplatePromptPattern(
          operation,
          templateStepIndex,
          promptIndex,
          patternIndex,
          patternText,
        ),
      );
    },
    setResponse(response) {
      txBlockApplyChange(
        onChange,
        txBlockUpdateTemplatePrompt(operation, templateStepIndex, promptIndex, {
          response,
        }),
      );
    },
  };
}

export function txBlockTemplateEditorBindings(operation, onChange) {
  const bindings = txBlockTemplateBindings(operation, onChange);
  return {
    runtimePresenceHandler() {
      return callbackMappedFormCheckedHandler(
        bindings.setRuntimePresence,
        (enabled) => enabled,
      );
    },
    setStepsPresence(enabled) {
      bindings.setCollectionPresence("steps", enabled);
    },
    setVarsPresence(enabled) {
      bindings.setCollectionPresence("vars", enabled);
    },
  };
}

export function txBlockTemplateVarsEditorBindings(operation, onChange) {
  const bindings = txBlockTemplateBindings(operation, onChange);
  return {
    addVar() {
      bindings.addVar();
    },
    presenceHandler() {
      return callbackMappedFormCheckedHandler(
        (enabled) => bindings.setCollectionPresence("vars", enabled),
        (enabled) => enabled,
      );
    },
  };
}

export function txBlockTemplateVarsActionHandlers(operation, onChange) {
  return txBlockTemplateVarsEditorBindings(operation, onChange);
}

export function txBlockTemplateStepsEditorBindings(operation, onChange) {
  const bindings = txBlockTemplateBindings(operation, onChange);
  return {
    addStep() {
      bindings.addStep();
    },
    presenceHandler() {
      return callbackMappedFormCheckedHandler(
        (enabled) => bindings.setCollectionPresence("steps", enabled),
        (enabled) => enabled,
      );
    },
  };
}

export function txBlockTemplateStepsActionHandlers(operation, onChange) {
  return txBlockTemplateStepsEditorBindings(operation, onChange);
}

export function txBlockTemplateDefinitionEditorBindings(operation, onChange) {
  const bindings = txBlockTemplateDefinitionBindings(operation, onChange);
  return {
    fieldPresenceHandler(fieldRow = {}) {
      if (!fieldRow.showPresenceToggle) return null;
      if (fieldRow.fieldScope === "operation") {
        return callbackMappedFormCheckedHandler(
          bindings.setCurrentConnectionAliasPresence,
          (enabled) => enabled,
        );
      }
      return callbackMappedFormCheckedHandler(
        (enabled) =>
          bindings.setTemplateFieldPresence(fieldRow.fieldKey, enabled),
        (enabled) => enabled,
      );
    },
    fieldNullableModeHandler(fieldRow = {}) {
      if (!fieldRow.showNullableModeSelect) return null;
      if (fieldRow.fieldScope === "operation") {
        return callbackMappedFormValueHandler(
          (value) =>
            bindings.setOperationNullableFieldMode(fieldRow.fieldKey, value),
          (value) => value,
        );
      }
      return callbackMappedFormValueHandler(
        (value) =>
          bindings.setTemplateNullableFieldMode(fieldRow.fieldKey, value),
        (value) => value,
      );
    },
    fieldValueHandler(fieldRow = {}) {
      if (fieldRow.fieldScope === "operation") {
        return callbackMappedFormValueHandler(
          (value) =>
            bindings.setOperationNullableField(fieldRow.fieldKey, value),
          (value) => value,
        );
      }
      if (fieldRow.fieldKey === "name") {
        return callbackMappedFormValueHandler(
          (value) => bindings.setTemplateField("name", value),
          (value) => value,
        );
      }
      if (fieldRow.fieldKey === "stopOnError") {
        return callbackMappedFormValueHandler(
          (value) => bindings.setTemplateBooleanField("stopOnError", value),
          (value) => value,
        );
      }
      return callbackMappedFormValueHandler(
        (value) => bindings.setTemplateNullableField(fieldRow.fieldKey, value),
        (value) => value,
      );
    },
    operationMetadataPresenceHandler(fieldKey) {
      return txExtraStringPresenceChangeHandler(
        bindings.setOperationExtra,
        () => operation.template.extra,
        fieldKey,
      );
    },
    operationMetadataValueHandler(fieldKey) {
      return txExtraStringValueChangeHandler(
        bindings.setOperationExtra,
        () => operation.template.extra,
        fieldKey,
      );
    },
    setOperationExtra(extra) {
      bindings.setOperationExtra(extra);
    },
    setTemplateExtra(extra) {
      bindings.setTemplateExtra(extra);
    },
    templateMetadataPresenceHandler(fieldKey) {
      return txExtraStringPresenceChangeHandler(
        bindings.setTemplateExtra,
        () => operation.template.template.extra,
        fieldKey,
      );
    },
    templateMetadataValueHandler(fieldKey) {
      return txExtraStringValueChangeHandler(
        bindings.setTemplateExtra,
        () => operation.template.template.extra,
        fieldKey,
      );
    },
  };
}

export function txBlockTemplateRuntimeFieldsEditorBindings(
  operation,
  onChange,
) {
  const bindings = txBlockTemplateRuntimeBindings(operation, onChange);
  return {
    fieldNullableModeHandler(fieldKey) {
      return callbackMappedFormValueHandler(
        (value) => bindings.setRuntimeNullableFieldMode(fieldKey, value),
        (value) => value,
      );
    },
    fieldPresenceHandler(fieldKey) {
      return callbackMappedFormCheckedHandler(
        (enabled) => bindings.setRuntimeFieldPresence(fieldKey, enabled),
        (enabled) => enabled,
      );
    },
    fieldValueHandler(fieldKey) {
      return callbackMappedFormValueHandler(
        (value) => bindings.setRuntimeNullableField(fieldKey, value),
        (value) => value,
      );
    },
    metadataPresenceHandler(fieldKey) {
      return txExtraStringPresenceChangeHandler(
        bindings.setRuntimeExtra,
        () => operation.template.runtime.extra,
        fieldKey,
      );
    },
    metadataValueHandler(fieldKey) {
      return txExtraStringValueChangeHandler(
        bindings.setRuntimeExtra,
        () => operation.template.runtime.extra,
        fieldKey,
      );
    },
    setRuntimeExtra(extra) {
      bindings.setRuntimeExtra(extra);
    },
  };
}

export function txBlockTemplateRuntimeVarsEditorBindings(operation, onChange) {
  const bindings = txBlockTemplateRuntimeBindings(operation, onChange);
  return {
    addRuntimeVar() {
      bindings.addRuntimeVar();
    },
    removeRuntimeVarHandler(key) {
      return () => bindings.removeRuntimeVar(key);
    },
    runtimeVarKeyHandler(key) {
      return callbackMappedFormValueHandler(
        (value) => bindings.renameRuntimeVar(key, value),
        (value) => value,
      );
    },
    runtimeVarTypeHandler(key) {
      return callbackMappedFormValueHandler(
        (value) => bindings.setRuntimeVarType(key, value),
        (value) => value,
      );
    },
    runtimeVarObjectValueHandler(key) {
      return (value) =>
        bindings.setRuntimeVarValue(key, JSON.stringify(value || {}, null, 2));
    },
    runtimeVarValueHandler(key) {
      return callbackMappedFormValueHandler(
        (value) => bindings.setRuntimeVarValue(key, value),
        (value) => value,
      );
    },
    runtimeVarsPresenceHandler() {
      return callbackMappedFormCheckedHandler(
        (enabled) => bindings.setRuntimeFieldPresence("vars", enabled),
        (enabled) => enabled,
      );
    },
  };
}

export function txBlockTemplateRuntimeVarsActionHandlers(operation, onChange) {
  return txBlockTemplateRuntimeVarsEditorBindings(operation, onChange);
}

export function txBlockTemplateStepEditorBindings(
  templateStep = {},
  {
    onAddPrompt = null,
    onRemoveStep = null,
    onSetExtra = null,
    onSetField = null,
    onSetFieldPresence = null,
    onSetMode = null,
    onSetModeState = null,
    onSetPromptsPresence = null,
    onSetTimeoutSecs = null,
  } = {},
) {
  return {
    addPrompt() {
      if (typeof onAddPrompt === "function") onAddPrompt();
    },
    fieldPresenceHandler(fieldKey) {
      return callbackMappedFormCheckedHandler(
        (enabled) =>
          typeof onSetFieldPresence === "function"
            ? onSetFieldPresence(fieldKey, enabled)
            : undefined,
        (enabled) => enabled,
      );
    },
    fieldNullableModeHandler(fieldKey) {
      if (fieldKey !== "mode") return null;
      return callbackMappedFormValueHandler(onSetModeState, (value) => value);
    },
    fieldValueHandler(fieldKey) {
      if (fieldKey === "command") {
        return callbackMappedFormValueHandler(
          (value) =>
            typeof onSetField === "function"
              ? onSetField("command", value)
              : undefined,
          (value) => value,
        );
      }
      if (fieldKey === "mode") {
        return callbackMappedFormValueHandler(onSetMode, (value) => value);
      }
      return callbackMappedFormValueHandler(onSetTimeoutSecs, (value) => value);
    },
    metadataPresenceHandler(fieldKey) {
      return txExtraStringPresenceChangeHandler(
        (extra) => {
          if (typeof onSetExtra === "function") onSetExtra(extra);
        },
        () => templateStep.extra,
        fieldKey,
      );
    },
    metadataValueHandler(fieldKey) {
      return txExtraStringValueChangeHandler(
        (extra) => {
          if (typeof onSetExtra === "function") onSetExtra(extra);
        },
        () => templateStep.extra,
        fieldKey,
      );
    },
    promptsPresenceHandler() {
      return callbackMappedFormCheckedHandler(
        onSetPromptsPresence,
        (enabled) => enabled,
      );
    },
    removeStep() {
      if (typeof onRemoveStep === "function") onRemoveStep();
    },
    setExtra(extra) {
      if (typeof onSetExtra === "function") onSetExtra(extra);
    },
  };
}

function txBlockTemplateStepActionHandlers({
  operation,
  templateStep = {},
  templateStepIndex,
  onChange,
}) {
  const bindings = txBlockTemplateStepBindings(
    operation,
    templateStepIndex,
    onChange,
  );
  return txBlockTemplateStepEditorBindings(templateStep, {
    onAddPrompt: () => bindings.addPrompt(),
    onRemoveStep: () => bindings.removeStep(),
    onSetExtra: (extra) => bindings.setExtra(extra),
    onSetField: (field, value) => bindings.setField(field, value),
    onSetFieldPresence: (field, enabled) =>
      bindings.setFieldPresence(field, enabled),
    onSetMode: (value) => bindings.setMode(value),
    onSetModeState: (value) => bindings.setModeState(value),
    onSetPromptsPresence: (enabled) => bindings.setPromptsPresence(enabled),
    onSetTimeoutSecs: (value) => bindings.setTimeoutSecs(value),
  });
}

export function txBlockTemplateVarEditorBindings(
  variable = {},
  {
    onRemoveVar = null,
    onSetExtra = null,
    onSetField = null,
    onSetFieldPresence = null,
    onSetNullableField = null,
    onSetNullableFieldMode = null,
    onSetRequired = null,
  } = {},
) {
  return {
    fieldPresenceHandler(fieldKey) {
      return callbackMappedFormCheckedHandler(
        (enabled) =>
          typeof onSetFieldPresence === "function"
            ? onSetFieldPresence(fieldKey, enabled)
            : undefined,
        (enabled) => enabled,
      );
    },
    fieldNullableModeHandler(fieldKey) {
      return callbackMappedFormValueHandler(
        (value) =>
          typeof onSetNullableFieldMode === "function"
            ? onSetNullableFieldMode(fieldKey, value)
            : undefined,
        (value) => value,
      );
    },
    fieldValueHandler(fieldKey) {
      if (fieldKey === "name" || fieldKey === "type") {
        return callbackMappedFormValueHandler(
          (value) =>
            typeof onSetField === "function"
              ? onSetField(fieldKey, value)
              : undefined,
          (value) => value,
        );
      }
      if (fieldKey === "required") {
        return callbackMappedFormValueHandler(onSetRequired, (value) => value);
      }
      return callbackMappedFormValueHandler(
        (value) =>
          typeof onSetNullableField === "function"
            ? onSetNullableField(fieldKey, value)
            : undefined,
        (value) => value,
      );
    },
    metadataPresenceHandler(fieldKey) {
      return txExtraStringPresenceChangeHandler(
        (extra) => {
          if (typeof onSetExtra === "function") onSetExtra(extra);
        },
        () => variable.extra,
        fieldKey,
      );
    },
    metadataValueHandler(fieldKey) {
      return txExtraStringValueChangeHandler(
        (extra) => {
          if (typeof onSetExtra === "function") onSetExtra(extra);
        },
        () => variable.extra,
        fieldKey,
      );
    },
    removeVar() {
      if (typeof onRemoveVar === "function") onRemoveVar();
    },
    setExtra(extra) {
      if (typeof onSetExtra === "function") onSetExtra(extra);
    },
  };
}

function txBlockTemplateVarActionHandlers({
  operation,
  variable = {},
  varIndex,
  onChange,
}) {
  const bindings = txBlockTemplateVarBindings(operation, varIndex, onChange);
  return txBlockTemplateVarEditorBindings(variable, {
    onRemoveVar: () => bindings.removeVar(),
    onSetExtra: (extra) => bindings.setExtra(extra),
    onSetField: (key, value) => bindings.setField(key, value),
    onSetFieldPresence: (field, enabled) =>
      bindings.setFieldPresence(field, enabled),
    onSetNullableField: (key, value) => bindings.setNullableField(key, value),
    onSetNullableFieldMode: (key, value) =>
      bindings.setNullableFieldMode(key, value),
    onSetRequired: (requiredValue) => bindings.setRequired(requiredValue),
  });
}

export function txBlockTemplateVarDefaultEditorBindings(
  operation,
  varIndex,
  onChange,
) {
  const bindings = txBlockTemplateVarBindings(operation, varIndex, onChange);
  return {
    addDefault() {
      bindings.addDefault();
    },
    clearDefault() {
      bindings.clearDefault();
    },
    defaultPresenceHandler() {
      return callbackMappedFormCheckedHandler(
        (enabled) => bindings.setFieldPresence("default", enabled),
        (enabled) => enabled,
      );
    },
    defaultTypeHandler() {
      return callbackMappedFormValueHandler(
        bindings.setDefaultValueType,
        (value) => value,
      );
    },
    defaultValueHandler() {
      return callbackMappedFormValueHandler(
        bindings.setDefaultValueText,
        (value) => value,
      );
    },
    defaultObjectValueHandler() {
      return (value) =>
        bindings.setDefaultValueText(JSON.stringify(value || {}, null, 2));
    },
  };
}

export function txBlockTemplateVarDefaultActionHandlers(
  operation,
  varIndex,
  onChange,
) {
  return txBlockTemplateVarDefaultEditorBindings(operation, varIndex, onChange);
}

export function txBlockTemplateVarOptionsEditorBindings(
  operation,
  varIndex,
  onChange,
) {
  const bindings = txBlockTemplateVarBindings(operation, varIndex, onChange);
  return {
    addOption() {
      bindings.addOption();
    },
    optionValueHandler(optionIndex) {
      return callbackMappedFormValueHandler(
        (value) => bindings.setOptionValue(optionIndex, value),
        (value) => value,
      );
    },
    optionsPresenceHandler() {
      return callbackMappedFormCheckedHandler(
        (enabled) => bindings.setFieldPresence("options", enabled),
        (enabled) => enabled,
      );
    },
    removeOptionHandler(optionIndex) {
      return () => bindings.removeOption(optionIndex);
    },
  };
}

export function txBlockTemplateVarOptionsActionHandlers(
  operation,
  varIndex,
  onChange,
) {
  return txBlockTemplateVarOptionsEditorBindings(operation, varIndex, onChange);
}

export function txBlockTemplatePromptEditorBindings(
  prompt = {},
  {
    onAddPattern = null,
    onRemovePattern = null,
    onRemovePrompt = null,
    onSetBooleanField = null,
    onSetExtra = null,
    onSetFieldPresence = null,
    onSetPatternValue = null,
    onSetResponse = null,
  } = {},
) {
  return {
    booleanValueHandler(fieldKey) {
      return callbackMappedFormCheckedHandler(
        (checked) =>
          typeof onSetBooleanField === "function"
            ? onSetBooleanField(fieldKey, checked)
            : undefined,
        (checked) => checked,
      );
    },
    booleanPresenceToggle(fieldKey) {
      return callbackMappedFormCheckedHandler(
        (enabled) =>
          typeof onSetFieldPresence === "function"
            ? onSetFieldPresence(fieldKey, enabled)
            : undefined,
        (enabled) => enabled,
      );
    },
    removePromptAction() {
      return () => {
        if (typeof onRemovePrompt === "function") onRemovePrompt();
      };
    },
    extraMetadataPresence(fieldKey) {
      return txExtraStringPresenceChangeHandler(
        (extra) => {
          if (typeof onSetExtra === "function") onSetExtra(extra);
        },
        () => prompt.extra,
        fieldKey,
      );
    },
    extraMetadataValue(fieldKey) {
      return txExtraStringValueChangeHandler(
        (extra) => {
          if (typeof onSetExtra === "function") onSetExtra(extra);
        },
        () => prompt.extra,
        fieldKey,
      );
    },
    addPatternAction() {
      return () => {
        if (typeof onAddPattern === "function") onAddPattern();
      };
    },
    patternValueHandler(patternIndex) {
      return callbackMappedFormValueHandler(
        (value) =>
          typeof onSetPatternValue === "function"
            ? onSetPatternValue(patternIndex, value)
            : undefined,
        (value) => value,
      );
    },
    removePatternAction(patternIndex) {
      return () => {
        if (typeof onRemovePattern === "function") {
          onRemovePattern(patternIndex);
        }
      };
    },
    responseValueHandler() {
      return callbackMappedFormValueHandler(onSetResponse, (value) => value);
    },
    setExtra(extra) {
      if (typeof onSetExtra === "function") onSetExtra(extra);
    },
  };
}

export function txBlockTemplatePromptActionHandlers({
  operation,
  prompt = {},
  templateStepIndex,
  promptIndex,
  onChange,
}) {
  const bindings = txBlockTemplatePromptBindings(
    operation,
    templateStepIndex,
    promptIndex,
    onChange,
  );
  return txBlockTemplatePromptEditorBindings(prompt, {
    onAddPattern: () => bindings.addPattern(),
    onRemovePattern: (patternIndex) => bindings.removePattern(patternIndex),
    onRemovePrompt: () => bindings.removePrompt(),
    onSetBooleanField: (field, value) => bindings.setBooleanField(field, value),
    onSetExtra: (extra) => bindings.setExtra(extra),
    onSetFieldPresence: (field, enabled) =>
      bindings.setFieldPresence(field, enabled),
    onSetPatternValue: (patternIndex, value) =>
      bindings.setPatternValue(patternIndex, value),
    onSetResponse: (value) => bindings.setResponse(value),
  });
}

export function txBlockTemplateActionHandlers(operation, onChange) {
  const bindings = txBlockTemplateBindings(operation, onChange);
  const editorBindings = txBlockTemplateEditorBindings(operation, onChange);
  return {
    ...editorBindings,
    setExtra(extra) {
      bindings.setExtra(extra);
    },
  };
}
