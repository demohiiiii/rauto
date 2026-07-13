import { derived as deriveStore, get, writable } from "svelte/store";
import { currentLanguageState } from "../lib/i18n.js";
import { plainObject, stringValue } from "../lib/jsonValue.js";
import { createTxProfileModeLoader } from "./transactionProfileModes.js";
import {
  txBlockPromptMetadataFieldDefs,
  txBlockTemplateDefinitionMetadataFieldDefs,
  txBlockTemplateOperationMetadataFieldDefs,
  txBlockTemplateRuntimeMetadataFieldDefs,
  txBlockTemplateStepMetadataFieldDefs,
  txBlockTemplateVarMetadataFieldDefs,
} from "./transactionStructure.js";
import { txExtraStringFieldRows } from "./transactionMetadataFields.js";
import {
  txBlockTemplateBindings,
  txBlockTemplateEditorBindings,
  txBlockTemplateDefinitionEditorBindings,
  txBlockTemplatePromptBindings,
  txBlockTemplatePromptEditorBindings,
  txBlockTemplateRuntimeFieldsEditorBindings,
  txBlockTemplateRuntimeVarsEditorBindings,
  txBlockTemplateStepBindings,
  txBlockTemplateStepsEditorBindings,
  txBlockTemplateStepEditorBindings,
  txBlockTemplateVarBindings,
  txBlockTemplateVarDefaultEditorBindings,
  txBlockTemplateVarsEditorBindings,
  txBlockTemplateVarOptionsEditorBindings,
  txBlockTemplateVarEditorBindings,
} from "./transactionBlockTemplateState.js";
import {
  txBlockTemplateDefinitionFieldsDisplay,
  txBlockTemplateEditorDisplay,
  txBlockTemplateRuntimeFieldsDisplay,
  txBlockTemplateStepFieldsDisplay,
  txBlockTemplateVarFieldsDisplay,
} from "./transactionBlockTemplateDisplayState.js";

export * from "./transactionBlockTemplateDisplayState.js";

const txPlainObject = plainObject;
const txStringValue = stringValue;
export function createTxBlockTemplateDefinitionEditorWorkspace({
  operation = {},
  onChange = null,
} = {}) {
  const operationStateStore = writable(
    txPlainObject(operation) ? operation : {},
  );
  const onChangeStateStore = writable(onChange);
  const templateModeLoader = createTxProfileModeLoader({
    currentMode: () =>
      get(operationStateStore)?.template?.template?.defaultMode ?? "",
    explicitProfile: () =>
      get(operationStateStore)?.template?.runtime?.deviceProfile ?? "",
  });
  const templateDefinitionActionHandlersStateStore = deriveStore(
    [operationStateStore, onChangeStateStore],
    ([$operationStateStore, $onChangeStateStore]) =>
      txBlockTemplateDefinitionEditorBindings(
        $operationStateStore,
        $onChangeStateStore,
      ),
  );
  const templateDefinitionFieldRowsStateStore = deriveStore(
    [operationStateStore, templateModeLoader.state, currentLanguageState],
    ([$operationStateStore, $templateModeStateStore]) =>
      txBlockTemplateDefinitionFieldsDisplay(
        $operationStateStore.template,
        $templateModeStateStore,
      ),
  );
  const templateDefinitionMetadataFieldRowsStateStore = deriveStore(
    [operationStateStore, currentLanguageState],
    ([$operationStateStore]) =>
      txExtraStringFieldRows(
        $operationStateStore.template?.template?.extra,
        txBlockTemplateDefinitionMetadataFieldDefs(),
      ),
  );
  const templateOperationMetadataFieldRowsStateStore = deriveStore(
    [operationStateStore, currentLanguageState],
    ([$operationStateStore]) =>
      txExtraStringFieldRows(
        $operationStateStore.template?.extra,
        txBlockTemplateOperationMetadataFieldDefs(),
      ),
  );
  const templateExtraSourceStateStore = deriveStore(
    operationStateStore,
    ($operationStateStore) =>
      txPlainObject($operationStateStore.template?.template?.extra)
        ? $operationStateStore.template.template.extra
        : {},
  );

  return {
    destroy: templateModeLoader.destroy,
    setTemplateDefinitionContext({
      operation: nextOperation = {},
      onChange: nextOnChange = null,
    } = {}) {
      const operationValue = txPlainObject(nextOperation) ? nextOperation : {};
      operationStateStore.set(operationValue);
      onChangeStateStore.set(nextOnChange);
      void templateModeLoader.refresh();
    },
    templateDefinitionActionHandlersStateStore,
    templateDefinitionFieldRowsStateStore,
    templateDefinitionMetadataFieldRowsStateStore,
    templateExtraSourceStateStore,
    templateOperationMetadataFieldRowsStateStore,
  };
}

export function createTxBlockTemplateRuntimeFieldsEditorWorkspace({
  operation = {},
  onChange = null,
} = {}) {
  const operationStateStore = writable(
    txPlainObject(operation) ? operation : {},
  );
  const onChangeStateStore = writable(onChange);
  const runtimeModeLoader = createTxProfileModeLoader({
    currentMode: () =>
      get(operationStateStore)?.template?.runtime?.defaultMode ?? "",
    explicitProfile: () =>
      get(operationStateStore)?.template?.runtime?.deviceProfile ?? "",
  });
  const runtimeActionHandlersStateStore = deriveStore(
    [operationStateStore, onChangeStateStore],
    ([$operationStateStore, $onChangeStateStore]) =>
      txBlockTemplateRuntimeFieldsEditorBindings(
        $operationStateStore,
        $onChangeStateStore,
      ),
  );
  const runtimeFieldRowsStateStore = deriveStore(
    [operationStateStore, runtimeModeLoader.state, currentLanguageState],
    ([$operationStateStore, $runtimeModeStateStore]) =>
      txBlockTemplateRuntimeFieldsDisplay(
        $operationStateStore.template?.runtime,
        $runtimeModeStateStore,
      ),
  );
  const runtimeMetadataFieldRowsStateStore = deriveStore(
    [operationStateStore, currentLanguageState],
    ([$operationStateStore]) =>
      txExtraStringFieldRows(
        $operationStateStore.template?.runtime?.extra,
        txBlockTemplateRuntimeMetadataFieldDefs(),
      ),
  );
  const runtimeExtraSourceStateStore = deriveStore(
    operationStateStore,
    ($operationStateStore) =>
      txPlainObject($operationStateStore.template?.runtime?.extra)
        ? $operationStateStore.template.runtime.extra
        : {},
  );

  return {
    destroy: runtimeModeLoader.destroy,
    runtimeActionHandlersStateStore,
    runtimeExtraSourceStateStore,
    runtimeFieldRowsStateStore,
    runtimeMetadataFieldRowsStateStore,
    setTemplateRuntimeFieldsContext({
      operation: nextOperation = {},
      onChange: nextOnChange = null,
    } = {}) {
      const operationValue = txPlainObject(nextOperation) ? nextOperation : {};
      operationStateStore.set(operationValue);
      onChangeStateStore.set(nextOnChange);
      void runtimeModeLoader.refresh();
    },
  };
}

export function createTxBlockTemplateEditorWorkspace({
  operation = {},
  onChange = null,
} = {}) {
  const operationStateStore = writable(
    txPlainObject(operation) ? operation : {},
  );
  const onChangeStateStore = writable(onChange);
  const templateActionHandlersStateStore = deriveStore(
    [operationStateStore, onChangeStateStore],
    ([$operation, $onChange]) => {
      const bindings = txBlockTemplateBindings($operation, $onChange);
      const editorBindings = txBlockTemplateEditorBindings(
        $operation,
        $onChange,
      );
      return {
        ...editorBindings,
        setExtra(extra) {
          bindings.setExtra(extra);
        },
      };
    },
  );
  const templateDisplayStateStore = deriveStore(
    [operationStateStore, currentLanguageState],
    ([$operation]) => txBlockTemplateEditorDisplay($operation.template),
  );

  return {
    setTemplateEditorContext({
      operation: nextOperation = {},
      onChange: nextOnChange = null,
    } = {}) {
      operationStateStore.set(
        txPlainObject(nextOperation) ? nextOperation : {},
      );
      onChangeStateStore.set(nextOnChange);
    },
    templateActionHandlersStateStore,
    templateDisplayStateStore,
  };
}

export function createTxBlockTemplateVarsEditorWorkspace({
  operation = {},
  onChange = null,
  present = true,
} = {}) {
  const operationStateStore = writable(
    txPlainObject(operation) ? operation : {},
  );
  const onChangeStateStore = writable(onChange);
  const presentStateStore = writable(!!present);
  const templateVarActionHandlersStateStore = deriveStore(
    [operationStateStore, onChangeStateStore],
    ([$operation, $onChange]) =>
      txBlockTemplateVarsEditorBindings($operation, $onChange),
  );
  const templateDisplayStateStore = deriveStore(
    [operationStateStore, currentLanguageState],
    ([$operation]) => txBlockTemplateEditorDisplay($operation.template),
  );

  return {
    presentStateStore,
    setTemplateVarsContext({
      operation: nextOperation = {},
      onChange: nextOnChange = null,
      present: nextPresent = true,
    } = {}) {
      operationStateStore.set(
        txPlainObject(nextOperation) ? nextOperation : {},
      );
      onChangeStateStore.set(nextOnChange);
      presentStateStore.set(!!nextPresent);
    },
    templateDisplayStateStore,
    templateVarActionHandlersStateStore,
  };
}

export function createTxBlockTemplateStepsEditorWorkspace({
  operation = {},
  onChange = null,
  present = true,
} = {}) {
  const operationStateStore = writable(
    txPlainObject(operation) ? operation : {},
  );
  const onChangeStateStore = writable(onChange);
  const presentStateStore = writable(!!present);
  const templateStepActionHandlersStateStore = deriveStore(
    [operationStateStore, onChangeStateStore],
    ([$operation, $onChange]) =>
      txBlockTemplateStepsEditorBindings($operation, $onChange),
  );
  const templateDisplayStateStore = deriveStore(
    [operationStateStore, currentLanguageState],
    ([$operation]) => txBlockTemplateEditorDisplay($operation.template),
  );

  return {
    presentStateStore,
    setTemplateStepsContext({
      operation: nextOperation = {},
      onChange: nextOnChange = null,
      present: nextPresent = true,
    } = {}) {
      operationStateStore.set(
        txPlainObject(nextOperation) ? nextOperation : {},
      );
      onChangeStateStore.set(nextOnChange);
      presentStateStore.set(!!nextPresent);
    },
    templateDisplayStateStore,
    templateStepActionHandlersStateStore,
  };
}

export function createTxBlockTemplateRuntimeVarsEditorWorkspace({
  operation = {},
  onChange = null,
} = {}) {
  const operationStateStore = writable(
    txPlainObject(operation) ? operation : {},
  );
  const onChangeStateStore = writable(onChange);
  const runtimeVarActionHandlersStateStore = deriveStore(
    [operationStateStore, onChangeStateStore],
    ([$operation, $onChange]) =>
      txBlockTemplateRuntimeVarsEditorBindings($operation, $onChange),
  );
  const runtimeVarRowsStateStore = deriveStore(
    [operationStateStore, currentLanguageState],
    ([$operation]) =>
      txBlockTemplateEditorDisplay($operation.template).runtime.varRows,
  );
  const runtimeVarsPresentStateStore = deriveStore(
    [operationStateStore, runtimeVarRowsStateStore],
    ([$operation, $runtimeVarRows]) =>
      !!$operation?.template?.runtime?.hasVars || $runtimeVarRows.length > 0,
  );

  return {
    runtimeVarActionHandlersStateStore,
    runtimeVarRowsStateStore,
    runtimeVarsPresentStateStore,
    setTemplateRuntimeVarsContext({
      operation: nextOperation = {},
      onChange: nextOnChange = null,
    } = {}) {
      operationStateStore.set(
        txPlainObject(nextOperation) ? nextOperation : {},
      );
      onChangeStateStore.set(nextOnChange);
    },
  };
}

export function createTxBlockTemplateStepEditorWorkspace({
  operation = {},
  onChange = null,
  templateStepRow = {},
} = {}) {
  const operationStateStore = writable(
    txPlainObject(operation) ? operation : {},
  );
  const onChangeStateStore = writable(onChange);
  const templateStepRowStateStore = writable(
    txPlainObject(templateStepRow) ? templateStepRow : {},
  );
  const templateStepModeLoader = createTxProfileModeLoader({
    currentMode: () => get(templateStepRowStateStore)?.step?.mode ?? "",
    explicitProfile: () =>
      get(operationStateStore)?.template?.runtime?.deviceProfile ?? "",
  });
  const stepActionHandlersStateStore = deriveStore(
    [operationStateStore, onChangeStateStore, templateStepRowStateStore],
    ([
      $operationStateStore,
      $onChangeStateStore,
      $templateStepRowStateStore,
    ]) => {
      const stepIndex = $templateStepRowStateStore?.stepIndex ?? 0;
      const templateStep = txPlainObject($templateStepRowStateStore?.step)
        ? $templateStepRowStateStore.step
        : {};
      const bindings = txBlockTemplateStepBindings(
        $operationStateStore,
        stepIndex,
        $onChangeStateStore,
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
    },
  );
  const templateStepFieldRowsStateStore = deriveStore(
    [
      templateStepRowStateStore,
      templateStepModeLoader.state,
      currentLanguageState,
    ],
    ([$templateStepRowStateStore, $templateStepModeStateStore]) =>
      txBlockTemplateStepFieldsDisplay(
        $templateStepRowStateStore?.step,
        $templateStepModeStateStore,
      ),
  );
  const templateStepMetadataFieldRowsStateStore = deriveStore(
    [templateStepRowStateStore, currentLanguageState],
    ([$templateStepRowStateStore]) =>
      txExtraStringFieldRows(
        $templateStepRowStateStore?.step?.extra,
        txBlockTemplateStepMetadataFieldDefs(),
      ),
  );

  return {
    destroy: templateStepModeLoader.destroy,
    setTemplateStepContext({
      operation: nextOperation = {},
      onChange: nextOnChange = null,
      templateStepRow: nextTemplateStepRow = {},
    } = {}) {
      const operationValue = txPlainObject(nextOperation) ? nextOperation : {};
      const templateStepRowValue = txPlainObject(nextTemplateStepRow)
        ? nextTemplateStepRow
        : {};
      operationStateStore.set(operationValue);
      onChangeStateStore.set(nextOnChange);
      templateStepRowStateStore.set(templateStepRowValue);
      void templateStepModeLoader.refresh();
    },
    stepActionHandlersStateStore,
    templateStepFieldRowsStateStore,
    templateStepMetadataFieldRowsStateStore,
    templateStepRowStateStore,
  };
}

export function createTxBlockTemplateVarEditorWorkspace({
  operation = {},
  onChange = null,
  templateVarTypeRows = [],
  variableRow = {},
} = {}) {
  const operationStateStore = writable(
    txPlainObject(operation) ? operation : {},
  );
  const onChangeStateStore = writable(onChange);
  const templateVarTypeRowsStateStore = writable(
    Array.isArray(templateVarTypeRows) ? templateVarTypeRows : [],
  );
  const variableRowStateStore = writable(
    txPlainObject(variableRow) ? variableRow : {},
  );
  const variableActionHandlersStateStore = deriveStore(
    [operationStateStore, onChangeStateStore, variableRowStateStore],
    ([$operationStateStore, $onChangeStateStore, $variableRowStateStore]) => {
      const varIndex = $variableRowStateStore?.varIndex ?? 0;
      const variable = txPlainObject($variableRowStateStore?.variable)
        ? $variableRowStateStore.variable
        : {};
      const bindings = txBlockTemplateVarBindings(
        $operationStateStore,
        varIndex,
        $onChangeStateStore,
      );
      return txBlockTemplateVarEditorBindings(variable, {
        onRemoveVar: () => bindings.removeVar(),
        onSetExtra: (extra) => bindings.setExtra(extra),
        onSetField: (field, value) => bindings.setField(field, value),
        onSetFieldPresence: (field, enabled) =>
          bindings.setFieldPresence(field, enabled),
        onSetNullableField: (field, value) =>
          bindings.setNullableField(field, value),
        onSetNullableFieldMode: (field, value) =>
          bindings.setNullableFieldMode(field, value),
        onSetRequired: (value) => bindings.setRequired(value),
      });
    },
  );
  const variableFieldRowsStateStore = deriveStore(
    [
      variableRowStateStore,
      templateVarTypeRowsStateStore,
      currentLanguageState,
    ],
    ([$variableRowStateStore, $templateVarTypeRowsStateStore]) =>
      txBlockTemplateVarFieldsDisplay(
        $variableRowStateStore?.variable,
        $templateVarTypeRowsStateStore,
      ),
  );
  const variableMetadataFieldRowsStateStore = deriveStore(
    [variableRowStateStore, currentLanguageState],
    ([$variableRowStateStore]) =>
      txExtraStringFieldRows(
        $variableRowStateStore?.variable?.extra,
        txBlockTemplateVarMetadataFieldDefs(),
      ),
  );

  return {
    setTemplateVarContext({
      operation: nextOperation = {},
      onChange: nextOnChange = null,
      templateVarTypeRows: nextTemplateVarTypeRows = [],
      variableRow: nextVariableRow = {},
    } = {}) {
      operationStateStore.set(
        txPlainObject(nextOperation) ? nextOperation : {},
      );
      onChangeStateStore.set(nextOnChange);
      templateVarTypeRowsStateStore.set(
        Array.isArray(nextTemplateVarTypeRows) ? nextTemplateVarTypeRows : [],
      );
      variableRowStateStore.set(
        txPlainObject(nextVariableRow) ? nextVariableRow : {},
      );
    },
    variableActionHandlersStateStore,
    variableFieldRowsStateStore,
    variableMetadataFieldRowsStateStore,
    variableRowStateStore,
  };
}

export function createTxBlockTemplateVarDefaultEditorWorkspace({
  operation = {},
  onChange = null,
  variableRow = {},
} = {}) {
  const operationStateStore = writable(
    txPlainObject(operation) ? operation : {},
  );
  const onChangeStateStore = writable(onChange);
  const variableRowStateStore = writable(
    txPlainObject(variableRow) ? variableRow : {},
  );
  const defaultActionHandlersStateStore = deriveStore(
    [operationStateStore, onChangeStateStore, variableRowStateStore],
    ([$operationStateStore, $onChangeStateStore, $variableRowStateStore]) =>
      txBlockTemplateVarDefaultEditorBindings(
        $operationStateStore,
        $variableRowStateStore?.varIndex ?? 0,
        $onChangeStateStore,
      ),
  );
  const variableStateStore = deriveStore(
    variableRowStateStore,
    ($variableRowStateStore) =>
      txPlainObject($variableRowStateStore?.variable)
        ? $variableRowStateStore.variable
        : {},
  );
  const defaultRowsStateStore = deriveStore(
    variableRowStateStore,
    ($variableRowStateStore) =>
      Array.isArray($variableRowStateStore?.defaultRows)
        ? $variableRowStateStore.defaultRows
        : [],
  );
  const defaultPresentStateStore = deriveStore(
    [variableStateStore, defaultRowsStateStore],
    ([$variableStateStore, $defaultRowsStateStore]) =>
      !!$variableStateStore?.hasDefault || $defaultRowsStateStore.length > 0,
  );

  return {
    defaultActionHandlersStateStore,
    defaultPresentStateStore,
    defaultRowsStateStore,
    setTemplateVarDefaultContext({
      operation: nextOperation = {},
      onChange: nextOnChange = null,
      variableRow: nextVariableRow = {},
    } = {}) {
      operationStateStore.set(
        txPlainObject(nextOperation) ? nextOperation : {},
      );
      onChangeStateStore.set(nextOnChange);
      variableRowStateStore.set(
        txPlainObject(nextVariableRow) ? nextVariableRow : {},
      );
    },
    variableRowStateStore,
    variableStateStore,
  };
}

export function createTxBlockTemplateVarOptionsEditorWorkspace({
  operation = {},
  onChange = null,
  variableRow = {},
} = {}) {
  const operationStateStore = writable(
    txPlainObject(operation) ? operation : {},
  );
  const onChangeStateStore = writable(onChange);
  const variableRowStateStore = writable(
    txPlainObject(variableRow) ? variableRow : {},
  );
  const optionActionHandlersStateStore = deriveStore(
    [operationStateStore, onChangeStateStore, variableRowStateStore],
    ([$operationStateStore, $onChangeStateStore, $variableRowStateStore]) =>
      txBlockTemplateVarOptionsEditorBindings(
        $operationStateStore,
        $variableRowStateStore?.varIndex ?? 0,
        $onChangeStateStore,
      ),
  );
  const variableStateStore = deriveStore(
    variableRowStateStore,
    ($variableRowStateStore) =>
      txPlainObject($variableRowStateStore?.variable)
        ? $variableRowStateStore.variable
        : {},
  );
  const optionRowsStateStore = deriveStore(
    variableRowStateStore,
    ($variableRowStateStore) =>
      Array.isArray($variableRowStateStore?.optionRows)
        ? $variableRowStateStore.optionRows
        : [],
  );
  const optionsPresentStateStore = deriveStore(
    [variableStateStore, optionRowsStateStore],
    ([$variableStateStore, $optionRowsStateStore]) =>
      !!$variableStateStore?.hasOptions || $optionRowsStateStore.length > 0,
  );

  return {
    optionActionHandlersStateStore,
    optionRowsStateStore,
    optionsPresentStateStore,
    setTemplateVarOptionsContext({
      operation: nextOperation = {},
      onChange: nextOnChange = null,
      variableRow: nextVariableRow = {},
    } = {}) {
      operationStateStore.set(
        txPlainObject(nextOperation) ? nextOperation : {},
      );
      onChangeStateStore.set(nextOnChange);
      variableRowStateStore.set(
        txPlainObject(nextVariableRow) ? nextVariableRow : {},
      );
    },
    variableRowStateStore,
    variableStateStore,
  };
}

export function createTxBlockTemplatePromptEditorWorkspace({
  operation = {},
  onChange = null,
  prompt = {},
  promptRow = {},
  templateStepIndex = 0,
} = {}) {
  const operationStateStore = writable(
    txPlainObject(operation) ? operation : {},
  );
  const onChangeStateStore = writable(onChange);
  const promptStateStore = writable(txPlainObject(prompt) ? prompt : {});
  const promptRowStateStore = writable(
    txPlainObject(promptRow) ? promptRow : {},
  );
  const templateStepIndexStateStore = writable(Number(templateStepIndex) || 0);
  const promptActionHandlersStateStore = deriveStore(
    [
      operationStateStore,
      onChangeStateStore,
      promptStateStore,
      promptRowStateStore,
      templateStepIndexStateStore,
    ],
    ([
      $operationStateStore,
      $onChangeStateStore,
      $promptStateStore,
      $promptRowStateStore,
      $templateStepIndexStateStore,
    ]) => {
      const promptBindings = txBlockTemplatePromptBindings(
        $operationStateStore,
        $templateStepIndexStateStore,
        $promptRowStateStore?.promptIndex ?? 0,
        $onChangeStateStore,
      );
      return txBlockTemplatePromptEditorBindings($promptStateStore, {
        onAddPattern: () => promptBindings.addPattern(),
        onRemovePattern: (patternIndex) =>
          promptBindings.removePattern(patternIndex),
        onRemovePrompt: () => promptBindings.removePrompt(),
        onSetBooleanField: (fieldKey, checked) =>
          promptBindings.setBooleanField(fieldKey, checked),
        onSetExtra: (extra) => promptBindings.setExtra(extra),
        onSetFieldPresence: (fieldKey, enabled) =>
          promptBindings.setFieldPresence(fieldKey, enabled),
        onSetPatternValue: (patternIndex, value) =>
          promptBindings.setPatternValue(patternIndex, value),
        onSetResponse: (value) => promptBindings.setResponse(value),
      });
    },
  );
  const promptMetadataFieldRowsStateStore = deriveStore(
    [promptStateStore, currentLanguageState],
    ([$promptStateStore]) =>
      txExtraStringFieldRows(
        $promptStateStore?.extra,
        txBlockPromptMetadataFieldDefs(),
      ),
  );

  return {
    promptActionHandlersStateStore,
    promptMetadataFieldRowsStateStore,
    promptRowStateStore,
    promptStateStore,
    setTemplatePromptContext({
      operation: nextOperation = {},
      onChange: nextOnChange = null,
      prompt: nextPrompt = {},
      promptRow: nextPromptRow = {},
      templateStepIndex: nextTemplateStepIndex = 0,
    } = {}) {
      operationStateStore.set(
        txPlainObject(nextOperation) ? nextOperation : {},
      );
      onChangeStateStore.set(nextOnChange);
      promptStateStore.set(txPlainObject(nextPrompt) ? nextPrompt : {});
      promptRowStateStore.set(
        txPlainObject(nextPromptRow) ? nextPromptRow : {},
      );
      templateStepIndexStateStore.set(Number(nextTemplateStepIndex) || 0);
    },
    templateStepIndexStateStore,
  };
}
