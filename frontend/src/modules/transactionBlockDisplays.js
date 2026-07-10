import { getProfileModes } from "../api/client.js";
import { derived as deriveStore, writable } from "svelte/store";
import { createLatestAsyncValueLoader } from "../lib/svelte.js";
import { currentLanguageState, t } from "../lib/i18n.js";
import { plainObject, stringValue } from "../lib/jsonValue.js";
import { currentExecutionConnectionProfile } from "./connections.js";
import {
  txBlockCommandEditorBindings,
  txBlockCommandDynParamsEditorBindings,
  txBlockCommandInteractionEditorBindings,
  txBlockFlowEditorBindings,
  txBlockOperationBindings,
  txBlockStepEditorBindings,
  txBlockVisualEditorBindings,
} from "./transactionBlockBindingState.js";
import { txExtraStringFieldRows } from "./transactionMetadataFields.js";
import {
  TX_BLOCK_BOOLEAN_ROWS,
  TX_BLOCK_JSON_VALUE_TYPE_ROWS,
  TX_BLOCK_OPERATION_KIND_ROWS,
  TX_BLOCK_ROLLBACK_KIND_ROWS,
  TX_BLOCK_STEP_ROLLBACK_STATE_ROWS,
  TX_BLOCK_TEMPLATE_VAR_TYPE_ROWS,
  txBlockCommandInteractionDisplay,
  txBlockCommandDynParamsDisplay,
  txBlockCommandEditorDisplay,
  txBlockFlowFieldsDisplay,
  txBlockFlowMetadataFieldRows,
  txBlockOperationFieldsDisplay,
  txBlockRollbackPolicyPanelDisplay,
  txBlockRootPanelDisplay,
  txBlockStepFieldsDisplay,
  txBlockStepMetadataFieldRows,
  txBlockStepsPanelDisplay,
  txBlockInteractionMetadataFieldRows,
} from "./transactionBlockDisplayState.js";

export * from "./transactionBlockDisplayState.js";

const txPlainObject = plainObject;
const txStringValue = stringValue;
let txProfileModesCache = new Map();

const TX_BLOCK_VISUAL_EDITOR_COVERAGE = Object.freeze({
  root: Object.freeze({
    component: "TxBlockRootSettingsEditor",
    scopes: Object.freeze(["root"]),
  }),
  rollbackPolicy: Object.freeze({
    component: "TxBlockRollbackPolicyEditor",
    scopes: Object.freeze([
      "rollback_policy",
      "rollback_policy.whole_resource",
      "rollback_policy.whole_resource.rollback",
      "rollback_policy.whole_resource.rollback.command",
      "rollback_policy.whole_resource.rollback.command.interaction",
      "rollback_policy.whole_resource.rollback.command.prompt",
      "rollback_policy.whole_resource.rollback.flow",
      "rollback_policy.whole_resource.rollback.flow.step",
      "rollback_policy.whole_resource.rollback.template",
      "rollback_policy.whole_resource.rollback.template.definition",
      "rollback_policy.whole_resource.rollback.template.var",
      "rollback_policy.whole_resource.rollback.template.step",
      "rollback_policy.whole_resource.rollback.template.prompt",
      "rollback_policy.whole_resource.rollback.template.runtime",
    ]),
  }),
  rootExtra: Object.freeze({
    component: "JsonObjectFieldsEditor",
    scopes: Object.freeze(["root"]),
  }),
  steps: Object.freeze({
    component: "TxBlockStepEditor",
    scopes: Object.freeze([
      "step",
      "step.rollback",
      "step.operation.command",
      "step.operation.command.interaction",
      "step.operation.command.prompt",
      "step.operation.flow",
      "step.operation.flow.step",
      "step.operation.template",
      "step.operation.template.definition",
      "step.operation.template.var",
      "step.operation.template.step",
      "step.operation.template.prompt",
      "step.operation.template.runtime",
    ]),
  }),
});

function txProfileModeFallback(profileName = "", currentValue = "") {
  const normalizedProfile = txStringValue(profileName).trim();
  const fallbackMode = txStringValue(currentValue).trim();
  if (normalizedProfile === "autodetect") {
    return {
      defaultMode: fallbackMode || "Root",
      modes: fallbackMode ? [fallbackMode] : ["Root"],
      name: normalizedProfile || "autodetect",
    };
  }
  return {
    defaultMode: fallbackMode,
    modes: fallbackMode ? [fallbackMode] : [],
    name: normalizedProfile,
  };
}

async function loadTxProfileModes(profileName = "", currentValue = "") {
  const normalizedProfile = txStringValue(profileName).trim();
  if (!normalizedProfile) {
    return txProfileModeFallback("", currentValue);
  }
  if (txProfileModesCache.has(normalizedProfile)) {
    return txProfileModesCache.get(normalizedProfile);
  }
  try {
    const modePayload = await getProfileModes(normalizedProfile);
    const modeOptions = Array.isArray(modePayload?.modes)
      ? modePayload.modes.filter(Boolean)
      : [];
    const defaultMode =
      txStringValue(modePayload?.default_mode).trim() ||
      modeOptions[0] ||
      txStringValue(currentValue).trim();
    const resolved = {
      defaultMode,
      modes:
        modeOptions.length > 0 ? modeOptions : defaultMode ? [defaultMode] : [],
      name: txStringValue(modePayload?.name).trim() || normalizedProfile,
    };
    txProfileModesCache.set(normalizedProfile, resolved);
    return resolved;
  } catch (_) {
    return txProfileModeFallback(normalizedProfile, currentValue);
  }
}

function txProfileModeInitialState() {
  return {
    defaultMode: "",
    modes: [],
    name: "",
  };
}

export function txBlockVisualEditorDisplay() {
  return {
    booleanRows: TX_BLOCK_BOOLEAN_ROWS,
    jsonValueTypeRows: TX_BLOCK_JSON_VALUE_TYPE_ROWS,
    operationKindRows: TX_BLOCK_OPERATION_KIND_ROWS,
    rollbackKindRows: TX_BLOCK_ROLLBACK_KIND_ROWS,
    stepRollbackStateRows: TX_BLOCK_STEP_ROLLBACK_STATE_ROWS.map(
      (optionRow) => ({
        label: t(optionRow.labelKey),
        value: optionRow.value,
      }),
    ),
    templateVarTypeRows: TX_BLOCK_TEMPLATE_VAR_TYPE_ROWS,
  };
}

export function txBlockVisualEditorCoverage() {
  return TX_BLOCK_VISUAL_EDITOR_COVERAGE;
}

export function createTxBlockVisualEditorWorkspace({
  model = {},
  onChange = null,
} = {}) {
  const modelStateStore = writable(model);
  const onChangeStateStore = writable(onChange);
  const editorDisplayStateStore = deriveStore(currentLanguageState, () =>
    txBlockVisualEditorDisplay(),
  );
  const editorActionHandlersStateStore = deriveStore(
    [modelStateStore, onChangeStateStore],
    ([$model, $onChange]) => txBlockVisualEditorBindings($model, $onChange),
  );
  const rootPanelStateStore = deriveStore(
    [modelStateStore, editorDisplayStateStore, currentLanguageState],
    ([$model, $editorDisplay]) =>
      txBlockRootPanelDisplay($model, $editorDisplay),
  );
  const rollbackPanelStateStore = deriveStore(
    [modelStateStore, editorDisplayStateStore, currentLanguageState],
    ([$model, $editorDisplay]) =>
      txBlockRollbackPolicyPanelDisplay($model, $editorDisplay),
  );
  const stepsPanelStateStore = deriveStore(
    [modelStateStore, currentLanguageState],
    ([$model]) => txBlockStepsPanelDisplay($model),
  );

  return {
    editorActionHandlersStateStore,
    editorDisplayStateStore,
    rollbackPanelStateStore,
    rootPanelStateStore,
    setVisualEditorContext({
      model: nextModel = {},
      onChange: nextOnChange = null,
    } = {}) {
      modelStateStore.set(txPlainObject(nextModel) ? nextModel : {});
      onChangeStateStore.set(nextOnChange);
    },
    stepsPanelStateStore,
  };
}

export function createTxBlockCommandEditorWorkspace({
  command = {},
  metadataFieldDefs = [],
  onChange = null,
} = {}) {
  const commandStateStore = writable(command);
  const metadataFieldDefsStateStore = writable(
    Array.isArray(metadataFieldDefs) ? metadataFieldDefs : [],
  );
  const onChangeStateStore = writable(onChange);
  const commandModeLoader = createLatestAsyncValueLoader({
    initialValue: txProfileModeInitialState(),
    loadValue: ({ currentMode, profileName }) =>
      loadTxProfileModes(profileName, currentMode),
  });
  const commandActionHandlersStateStore = deriveStore(
    [commandStateStore, onChangeStateStore],
    ([$command, $onChange]) =>
      txBlockCommandEditorBindings($command, $onChange),
  );
  const commandDisplayStateStore = deriveStore(
    [commandStateStore, commandModeLoader.state, currentLanguageState],
    ([$command, $commandModeState]) =>
      txBlockCommandEditorDisplay($command, $commandModeState),
  );
  const metadataFieldRowsStateStore = deriveStore(
    [commandStateStore, metadataFieldDefsStateStore, currentLanguageState],
    ([$command, $metadataFieldDefs]) =>
      txExtraStringFieldRows($command?.extra, $metadataFieldDefs),
  );

  return {
    commandActionHandlersStateStore,
    commandDisplayStateStore,
    metadataFieldRowsStateStore,
    setCommandEditorContext({
      command: nextCommand = {},
      metadataFieldDefs: nextMetadataFieldDefs = [],
      onChange: nextOnChange = null,
    } = {}) {
      const commandValue = txPlainObject(nextCommand) ? nextCommand : {};
      commandStateStore.set(commandValue);
      metadataFieldDefsStateStore.set(
        Array.isArray(nextMetadataFieldDefs) ? nextMetadataFieldDefs : [],
      );
      onChangeStateStore.set(nextOnChange);
      void commandModeLoader.refresh({
        currentMode: commandValue.mode ?? "",
        profileName: currentExecutionConnectionProfile(),
      });
    },
  };
}

export function createTxBlockOperationEditorWorkspace({
  operation = {},
  onChange = null,
  titleText = "",
} = {}) {
  const operationStateStore = writable(operation);
  const onChangeStateStore = writable(onChange);
  const titleStateStore = writable(titleText);
  const operationActionHandlersStateStore = deriveStore(
    [operationStateStore, onChangeStateStore],
    ([$operation, $onChange]) =>
      txBlockOperationBindings($operation, $onChange),
  );
  const operationFieldRowsStateStore = deriveStore(
    [operationStateStore, titleStateStore, currentLanguageState],
    ([$operation, $titleText]) =>
      txBlockOperationFieldsDisplay($operation, $titleText),
  );
  return {
    operationActionHandlersStateStore,
    operationFieldRowsStateStore,
    setOperationEditorContext({
      onChange: nextOnChange = null,
      operation: nextOperation = {},
      titleText: nextTitleText = "",
    } = {}) {
      onChangeStateStore.set(nextOnChange);
      operationStateStore.set(
        txPlainObject(nextOperation) ? nextOperation : {},
      );
      titleStateStore.set(txStringValue(nextTitleText));
    },
  };
}

export function createTxBlockStepEditorWorkspace({
  step = {},
  onRollbackStateChange = null,
  onStepChange = null,
} = {}) {
  const stepStateStore = writable(step);
  const onRollbackStateChangeStateStore = writable(onRollbackStateChange);
  const onStepChangeStateStore = writable(onStepChange);
  const rollbackStateStore = deriveStore(stepStateStore, ($step) =>
    $step && typeof $step === "object" && $step.hasRollback === false
      ? "absent"
      : $step?.rollback
        ? "operation"
        : $step?.hasRollback
          ? "null"
          : "absent",
  );
  const stepFieldRowsStateStore = deriveStore(
    [stepStateStore, currentLanguageState],
    ([$step]) => txBlockStepFieldsDisplay($step),
  );
  const stepMetadataFieldRowsStateStore = deriveStore(
    [stepStateStore, currentLanguageState],
    ([$step]) => txBlockStepMetadataFieldRows($step),
  );
  const stepActionHandlersStateStore = deriveStore(
    [stepStateStore, onRollbackStateChangeStateStore, onStepChangeStateStore],
    ([$step, $onRollbackStateChange, $onStepChange]) =>
      txBlockStepEditorBindings($step, {
        onRollbackStateChange: $onRollbackStateChange,
        onStepChange: $onStepChange,
      }),
  );
  return {
    rollbackStateStore,
    setStepEditorContext({
      onRollbackStateChange: nextOnRollbackStateChange = null,
      onStepChange: nextOnStepChange = null,
      step: nextStep = {},
    } = {}) {
      onRollbackStateChangeStateStore.set(nextOnRollbackStateChange);
      onStepChangeStateStore.set(nextOnStepChange);
      stepStateStore.set(txPlainObject(nextStep) ? nextStep : {});
    },
    stepActionHandlersStateStore,
    stepFieldRowsStateStore,
    stepMetadataFieldRowsStateStore,
  };
}

export function createTxBlockFlowEditorWorkspace({
  operation = {},
  onChange = null,
  booleanRows = [],
} = {}) {
  const operationStateStore = writable(
    txPlainObject(operation) ? operation : {},
  );
  const onChangeStateStore = writable(onChange);
  const booleanRowsStateStore = writable(
    Array.isArray(booleanRows) ? booleanRows : [],
  );
  const flowActionHandlersStateStore = deriveStore(
    [operationStateStore, onChangeStateStore],
    ([$operationStateStore, $onChangeStateStore]) =>
      txBlockFlowEditorBindings($operationStateStore, $onChangeStateStore),
  );
  const flowFieldRowsStateStore = deriveStore(
    [operationStateStore, booleanRowsStateStore, currentLanguageState],
    ([$operationStateStore, $booleanRowsStateStore]) =>
      txBlockFlowFieldsDisplay(
        $operationStateStore.flow,
        $booleanRowsStateStore,
      ),
  );
  const flowMetadataFieldRowsStateStore = deriveStore(
    [operationStateStore, currentLanguageState],
    ([$operationStateStore]) =>
      txBlockFlowMetadataFieldRows($operationStateStore),
  );
  const flowStepRowsStateStore = deriveStore(
    operationStateStore,
    ($operationStateStore) =>
      (Array.isArray($operationStateStore.flow?.steps)
        ? $operationStateStore.flow.steps
        : []
      ).map((flowStep, stepIndex) => ({
        flowStep,
        stepIndex,
        titleText: `${t("txBlockFormFlowStep")} ${stepIndex + 1}`,
      })),
  );
  return {
    flowActionHandlersStateStore,
    flowFieldRowsStateStore,
    flowMetadataFieldRowsStateStore,
    flowStepRowsStateStore,
    setFlowEditorContext({
      booleanRows: nextBooleanRows = [],
      onChange: nextOnChange = null,
      operation: nextOperation = {},
    } = {}) {
      booleanRowsStateStore.set(
        Array.isArray(nextBooleanRows) ? nextBooleanRows : [],
      );
      onChangeStateStore.set(nextOnChange);
      operationStateStore.set(
        txPlainObject(nextOperation) ? nextOperation : {},
      );
    },
  };
}

export function createTxBlockCommandInteractionEditorWorkspace({
  command = {},
  commandDisplay = {},
  onChange = null,
} = {}) {
  const commandStateStore = writable(txPlainObject(command) ? command : {});
  const commandDisplayStateStore = writable(
    txPlainObject(commandDisplay) ? commandDisplay : {},
  );
  const onChangeStateStore = writable(onChange);
  const interactionActionHandlersStateStore = deriveStore(
    [commandStateStore, onChangeStateStore],
    ([$commandStateStore, $onChangeStateStore]) => {
      const bindings = txBlockCommandInteractionEditorBindings(
        $commandStateStore,
        $onChangeStateStore,
      );
      return {
        ...bindings,
        promptActionHandlers(promptIndex) {
          return bindings.promptEditorBindings(promptIndex);
        },
      };
    },
  );
  const interactionDisplayStateStore = deriveStore(
    [commandStateStore, commandDisplayStateStore, currentLanguageState],
    ([$commandStateStore, $commandDisplayStateStore]) =>
      $commandDisplayStateStore.interactionDisplay ||
      txBlockCommandInteractionDisplay(
        $commandStateStore,
        TX_BLOCK_BOOLEAN_ROWS,
      ),
  );
  const interactionMetadataFieldRowsStateStore = deriveStore(
    [commandStateStore, currentLanguageState],
    ([$commandStateStore]) =>
      txBlockInteractionMetadataFieldRows($commandStateStore),
  );
  return {
    interactionActionHandlersStateStore,
    interactionDisplayStateStore,
    interactionMetadataFieldRowsStateStore,
    setInteractionEditorContext({
      command: nextCommand = {},
      commandDisplay: nextCommandDisplay = {},
      onChange: nextOnChange = null,
    } = {}) {
      commandStateStore.set(txPlainObject(nextCommand) ? nextCommand : {});
      commandDisplayStateStore.set(
        txPlainObject(nextCommandDisplay) ? nextCommandDisplay : {},
      );
      onChangeStateStore.set(nextOnChange);
    },
  };
}

export function createTxBlockCommandDynParamsEditorWorkspace({
  command = {},
  commandDisplay = {},
  onChange = null,
} = {}) {
  const commandStateStore = writable(txPlainObject(command) ? command : {});
  const commandDisplayStateStore = writable(
    txPlainObject(commandDisplay) ? commandDisplay : {},
  );
  const onChangeStateStore = writable(onChange);
  const dynParamsActionHandlersStateStore = deriveStore(
    [commandStateStore, onChangeStateStore],
    ([$commandStateStore, $onChangeStateStore]) =>
      txBlockCommandDynParamsEditorBindings(
        $commandStateStore,
        $onChangeStateStore,
      ),
  );
  const dynParamsDisplayStateStore = deriveStore(
    [commandStateStore, commandDisplayStateStore],
    ([$commandStateStore, $commandDisplayStateStore]) =>
      txBlockCommandDynParamsDisplay(
        $commandStateStore,
        $commandDisplayStateStore,
      ),
  );
  return {
    dynParamsActionHandlersStateStore,
    dynParamsDisplayStateStore,
    setDynParamsContext({
      command: nextCommand = {},
      commandDisplay: nextCommandDisplay = {},
      onChange: nextOnChange = null,
    } = {}) {
      commandStateStore.set(txPlainObject(nextCommand) ? nextCommand : {});
      commandDisplayStateStore.set(
        txPlainObject(nextCommandDisplay) ? nextCommandDisplay : {},
      );
      onChangeStateStore.set(nextOnChange);
    },
  };
}
