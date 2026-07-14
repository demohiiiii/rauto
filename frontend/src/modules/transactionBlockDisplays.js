import { derived as deriveStore, get, readonly, writable } from "svelte/store";
import { currentLanguage, currentLanguageState, t, tr } from "../lib/i18n.js";
import { plainObject, stringValue } from "../lib/jsonValue.js";
import { createTxProfileModeLoader } from "./transactionProfileModes.js";
import { validateTxBlockFormModel } from "./transactionBlockFormModels.js";
import {
  txBlockCommandEditorBindings,
  txBlockCommandDynParamsEditorBindings,
  txBlockCommandInteractionEditorBindings,
  txBlockFlowEditorBindings,
  txBlockOperationBindings,
  txBlockStepEditorBindings,
  txBlockVisualEditorBindings,
} from "./transactionBlockBindingState.js";
import {
  txBlockAddStep,
  txBlockDuplicateStep,
  txBlockMoveStep,
  txBlockRemoveStep,
} from "./transactionBlockMutations.js";
import { txExtraStringFieldRows } from "./transactionMetadataFields.js";
import {
  TX_BLOCK_BOOLEAN_ROWS,
  TX_BLOCK_JSON_VALUE_TYPE_ROWS,
  TX_BLOCK_OPERATION_KIND_ROWS,
  TX_BLOCK_ROLLBACK_KIND_ROWS,
  txBlockCommandInteractionDisplay,
  txBlockCommandDynParamsDisplay,
  txBlockCommandEditorDisplay,
  txBlockFlowFieldsDisplay,
  txBlockOperationFieldsDisplay,
  txBlockRollbackPolicyPanelDisplay,
  txBlockRootPanelDisplay,
  txBlockStepFieldsDisplay,
  txBlockStepsPanelDisplay,
  txBlockTimelineDisplay,
} from "./transactionBlockDisplayState.js";

export * from "./transactionBlockDisplayState.js";

const txPlainObject = plainObject;
const txStringValue = stringValue;

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
    ]),
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
    ]),
  }),
});

export function txBlockVisualEditorDisplay() {
  return {
    booleanRows: TX_BLOCK_BOOLEAN_ROWS,
    jsonValueTypeRows: TX_BLOCK_JSON_VALUE_TYPE_ROWS,
    operationKindRows: TX_BLOCK_OPERATION_KIND_ROWS,
    rollbackKindRows: TX_BLOCK_ROLLBACK_KIND_ROWS,
  };
}

export function txBlockVisualEditorCoverage() {
  return TX_BLOCK_VISUAL_EDITOR_COVERAGE;
}

export function createTxBlockVisualEditorWorkspace({
  model = {},
  onChange = null,
} = {}) {
  const initialModel = txPlainObject(model) ? model : {};
  const initialSteps = Array.isArray(initialModel.steps)
    ? initialModel.steps
    : [];
  const modelStateStore = writable(initialModel);
  const onChangeStateStore = writable(onChange);
  const selectedTargetWritableStateStore = writable(
    initialSteps.length > 0
      ? { kind: "step", stepIndex: 0 }
      : { kind: "root", stepIndex: -1 },
  );
  const selectedTargetStateStore = readonly(selectedTargetWritableStateStore);

  function modelSteps(currentModel = get(modelStateStore)) {
    return Array.isArray(currentModel?.steps) ? currentModel.steps : [];
  }

  function stepSelection(stepIndex) {
    return { kind: "step", stepIndex };
  }

  function rootSelection() {
    return { kind: "root", stepIndex: -1 };
  }

  function normalizedSelection(selection, currentModel) {
    const steps = modelSteps(currentModel);
    if (selection?.kind !== "step" || steps.length === 0) {
      return rootSelection();
    }
    const stepIndex = Number.isInteger(selection.stepIndex)
      ? Math.min(Math.max(selection.stepIndex, 0), steps.length - 1)
      : 0;
    return stepSelection(stepIndex);
  }

  function applyVisualEditorModel(nextModel) {
    modelStateStore.set(nextModel);
    const currentOnChange = get(onChangeStateStore);
    if (typeof currentOnChange === "function") currentOnChange(nextModel);
  }

  function selectRoot() {
    selectedTargetWritableStateStore.set(rootSelection());
    return true;
  }

  function selectStep(stepIndex) {
    const steps = modelSteps();
    if (
      !Number.isInteger(stepIndex) ||
      stepIndex < 0 ||
      stepIndex >= steps.length
    ) {
      return false;
    }
    selectedTargetWritableStateStore.set(stepSelection(stepIndex));
    return true;
  }

  function addAndSelectStep() {
    const currentModel = get(modelStateStore);
    const stepIndex = modelSteps(currentModel).length;
    applyVisualEditorModel(txBlockAddStep(currentModel));
    selectedTargetWritableStateStore.set(stepSelection(stepIndex));
    return true;
  }

  function duplicateSelectedStep() {
    const selection = get(selectedTargetStateStore);
    const steps = modelSteps();
    if (
      selection.kind !== "step" ||
      selection.stepIndex < 0 ||
      selection.stepIndex >= steps.length
    ) {
      return false;
    }
    applyVisualEditorModel(
      txBlockDuplicateStep(get(modelStateStore), selection.stepIndex),
    );
    selectedTargetWritableStateStore.set(
      stepSelection(selection.stepIndex + 1),
    );
    return true;
  }

  function moveSelectedStep(delta) {
    const selection = get(selectedTargetStateStore);
    if (selection.kind !== "step" || !Number.isInteger(delta) || delta === 0) {
      return false;
    }
    const toIndex = selection.stepIndex + delta;
    if (toIndex < 0 || toIndex >= modelSteps().length) return false;
    applyVisualEditorModel(
      txBlockMoveStep(get(modelStateStore), selection.stepIndex, toIndex),
    );
    selectedTargetWritableStateStore.set(stepSelection(toIndex));
    return true;
  }

  function removeSelectedStep() {
    const selection = get(selectedTargetStateStore);
    const steps = modelSteps();
    if (
      selection.kind !== "step" ||
      selection.stepIndex < 0 ||
      selection.stepIndex >= steps.length
    ) {
      return false;
    }
    const nextModel = txBlockRemoveStep(
      get(modelStateStore),
      selection.stepIndex,
    );
    applyVisualEditorModel(nextModel);
    selectedTargetWritableStateStore.set(
      normalizedSelection(selection, nextModel),
    );
    return true;
  }

  const editorDisplayStateStore = deriveStore(currentLanguageState, () =>
    txBlockVisualEditorDisplay(),
  );
  const editorActionHandlersStateStore = deriveStore(
    modelStateStore,
    ($model) => txBlockVisualEditorBindings($model, applyVisualEditorModel),
  );
  const validationErrorsStateStore = deriveStore(modelStateStore, ($model) =>
    validateTxBlockFormModel($model),
  );
  const rootPanelStateStore = deriveStore(
    [modelStateStore, editorDisplayStateStore, currentLanguageState],
    ([$model, $editorDisplay]) =>
      txBlockRootPanelDisplay($model, $editorDisplay),
  );
  const rollbackPanelStateStore = deriveStore(
    [
      modelStateStore,
      editorDisplayStateStore,
      validationErrorsStateStore,
      currentLanguageState,
    ],
    ([$model, $editorDisplay, $validationErrors]) =>
      txBlockRollbackPolicyPanelDisplay(
        $model,
        $editorDisplay,
        $validationErrors,
      ),
  );
  const stepsPanelStateStore = deriveStore(
    [modelStateStore, currentLanguageState],
    ([$model]) => txBlockStepsPanelDisplay($model),
  );
  const timelineDisplayStateStore = deriveStore(
    [modelStateStore, currentLanguageState, selectedTargetStateStore],
    ([$model, , $selectedTarget]) => {
      const timelineDisplay = txBlockTimelineDisplay($model);
      return {
        ...timelineDisplay,
        stepRows: timelineDisplay.stepRows.map((stepRow) => ({
          ...stepRow,
          selected:
            $selectedTarget.kind === "step" &&
            $selectedTarget.stepIndex === stepRow.stepIndex,
        })),
      };
    },
  );
  const editorSummaryStateStore = deriveStore(
    [modelStateStore, currentLanguageState],
    ([$model]) => {
      const rollbackKind = txStringValue($model?.rollbackPolicy?.kind, "none");
      const rollbackLabelKeys = {
        none: "txWorkflowBlockRollbackNone",
        per_step: "txWorkflowBlockRollbackPerStep",
        whole_resource: "txWorkflowBlockRollbackWhole",
      };
      const unnamedBlockText = tr(
        "txBlockTimelineUnnamedBlock",
        currentLanguage() === "zh" ? "未命名事务块" : "Unnamed block",
      );
      return {
        cellRows: [
          {
            labelText: t("txBlockFormName"),
            valueText: txStringValue($model?.name).trim() || unnamedBlockText,
          },
          {
            labelText: t("txBlockSummaryRollback"),
            valueText: t(
              rollbackLabelKeys[rollbackKind] ||
                "txWorkflowBlockRollbackPerStep",
            ),
          },
          {
            labelText: t("txBlockSummarySteps"),
            valueText: String(modelSteps($model).length),
          },
          {
            labelText: t("txBlockSummaryFailFast"),
            valueText: t($model?.failFast !== false ? "enabled" : "disabled"),
          },
        ],
      };
    },
  );

  return {
    addAndSelectStep,
    duplicateSelectedStep,
    editorActionHandlersStateStore,
    editorDisplayStateStore,
    editorSummaryStateStore,
    moveSelectedStep,
    removeSelectedStep,
    rollbackPanelStateStore,
    rootPanelStateStore,
    selectedTargetStateStore,
    selectRoot,
    selectStep,
    setVisualEditorContext({
      model: nextModel = {},
      onChange: nextOnChange = null,
    } = {}) {
      const nextModelValue = txPlainObject(nextModel) ? nextModel : {};
      modelStateStore.set(nextModelValue);
      onChangeStateStore.set(nextOnChange);
      selectedTargetWritableStateStore.set(
        normalizedSelection(get(selectedTargetStateStore), nextModelValue),
      );
    },
    stepsPanelStateStore,
    timelineDisplayStateStore,
    validationErrorsStateStore,
  };
}

export function createTxBlockCommandEditorWorkspace({
  command = {},
  metadataFieldDefs = [],
  onChange = null,
  pathPrefix = "",
  validationErrors = [],
} = {}) {
  const commandStateStore = writable(command);
  const metadataFieldDefsStateStore = writable(
    Array.isArray(metadataFieldDefs) ? metadataFieldDefs : [],
  );
  const onChangeStateStore = writable(onChange);
  const pathPrefixStateStore = writable(pathPrefix);
  const validationErrorsStateStore = writable(validationErrors);
  const commandModeLoader = createTxProfileModeLoader({
    currentMode: () => get(commandStateStore)?.mode ?? "",
  });
  const unsubscribeCommandModeInitialization =
    commandModeLoader.state.subscribe((modeState) => {
      const commandValue = get(commandStateStore);
      if (txStringValue(commandValue?.mode).trim()) return;
      const defaultMode = txStringValue(modeState?.defaultMode).trim();
      const availableModes = Array.isArray(modeState?.modes)
        ? modeState.modes
        : [];
      if (!defaultMode || !availableModes.includes(defaultMode)) return;
      const currentOnChange = get(onChangeStateStore);
      if (typeof currentOnChange !== "function") return;
      const nextCommand = { ...commandValue, mode: defaultMode };
      commandStateStore.set(nextCommand);
      currentOnChange(nextCommand);
    });
  const commandActionHandlersStateStore = deriveStore(
    [commandStateStore, onChangeStateStore],
    ([$command, $onChange]) =>
      txBlockCommandEditorBindings($command, $onChange),
  );
  const commandDisplayStateStore = deriveStore(
    [
      commandStateStore,
      commandModeLoader.state,
      validationErrorsStateStore,
      pathPrefixStateStore,
      currentLanguageState,
    ],
    ([$command, $commandModeState, $validationErrors, $pathPrefix]) =>
      txBlockCommandEditorDisplay(
        $command,
        $commandModeState,
        $validationErrors,
        $pathPrefix,
      ),
  );
  const metadataFieldRowsStateStore = deriveStore(
    [commandStateStore, metadataFieldDefsStateStore, currentLanguageState],
    ([$command, $metadataFieldDefs]) =>
      txExtraStringFieldRows($command?.extra, $metadataFieldDefs),
  );

  return {
    commandActionHandlersStateStore,
    commandDisplayStateStore,
    destroy() {
      unsubscribeCommandModeInitialization();
      commandModeLoader.destroy();
    },
    metadataFieldRowsStateStore,
    setCommandEditorContext({
      command: nextCommand = {},
      metadataFieldDefs: nextMetadataFieldDefs = [],
      onChange: nextOnChange = null,
      pathPrefix: nextPathPrefix = "",
      validationErrors: nextValidationErrors = [],
    } = {}) {
      const commandValue = txPlainObject(nextCommand) ? nextCommand : {};
      commandStateStore.set(commandValue);
      metadataFieldDefsStateStore.set(
        Array.isArray(nextMetadataFieldDefs) ? nextMetadataFieldDefs : [],
      );
      onChangeStateStore.set(nextOnChange);
      pathPrefixStateStore.set(txStringValue(nextPathPrefix));
      validationErrorsStateStore.set(
        Array.isArray(nextValidationErrors) ? nextValidationErrors : [],
      );
      void commandModeLoader.refresh();
    },
  };
}

export function createTxBlockOperationEditorWorkspace({
  operation = {},
  onChange = null,
  titleText = "",
  pathPrefix = "",
  validationErrors = [],
} = {}) {
  const operationStateStore = writable(operation);
  const onChangeStateStore = writable(onChange);
  const titleStateStore = writable(titleText);
  const pathPrefixStateStore = writable(pathPrefix);
  const validationErrorsStateStore = writable(validationErrors);
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
      pathPrefix: nextPathPrefix = "",
      validationErrors: nextValidationErrors = [],
    } = {}) {
      onChangeStateStore.set(nextOnChange);
      operationStateStore.set(
        txPlainObject(nextOperation) ? nextOperation : {},
      );
      titleStateStore.set(txStringValue(nextTitleText));
      pathPrefixStateStore.set(txStringValue(nextPathPrefix));
      validationErrorsStateStore.set(
        Array.isArray(nextValidationErrors) ? nextValidationErrors : [],
      );
    },
  };
}

export function createTxBlockStepEditorWorkspace({
  step = {},
  onStepChange = null,
  pathPrefix = "",
  validationErrors = [],
} = {}) {
  const stepStateStore = writable(step);
  const onStepChangeStateStore = writable(onStepChange);
  const pathPrefixStateStore = writable(pathPrefix);
  const validationErrorsStateStore = writable(validationErrors);
  const rollbackEnabledStateStore = deriveStore(
    stepStateStore,
    ($step) => !!$step?.rollback,
  );
  const stepFieldRowsStateStore = deriveStore(
    [stepStateStore, currentLanguageState],
    ([$step]) => txBlockStepFieldsDisplay($step),
  );
  const stepActionHandlersStateStore = deriveStore(
    [stepStateStore, onStepChangeStateStore],
    ([$step, $onStepChange]) =>
      txBlockStepEditorBindings($step, { onStepChange: $onStepChange }),
  );
  return {
    rollbackEnabledStateStore,
    setStepEditorContext({
      onStepChange: nextOnStepChange = null,
      step: nextStep = {},
      pathPrefix: nextPathPrefix = "",
      validationErrors: nextValidationErrors = [],
    } = {}) {
      onStepChangeStateStore.set(nextOnStepChange);
      stepStateStore.set(txPlainObject(nextStep) ? nextStep : {});
      pathPrefixStateStore.set(txStringValue(nextPathPrefix));
      validationErrorsStateStore.set(
        Array.isArray(nextValidationErrors) ? nextValidationErrors : [],
      );
    },
    stepActionHandlersStateStore,
    stepFieldRowsStateStore,
  };
}

export function createTxBlockFlowEditorWorkspace({
  operation = {},
  onChange = null,
  booleanRows = [],
  pathPrefix = "",
  validationErrors = [],
} = {}) {
  const operationStateStore = writable(
    txPlainObject(operation) ? operation : {},
  );
  const onChangeStateStore = writable(onChange);
  const booleanRowsStateStore = writable(
    Array.isArray(booleanRows) ? booleanRows : [],
  );
  const pathPrefixStateStore = writable(pathPrefix);
  const validationErrorsStateStore = writable(validationErrors);
  const flowActionHandlersStateStore = deriveStore(
    [operationStateStore, onChangeStateStore],
    ([$operationStateStore, $onChangeStateStore]) =>
      txBlockFlowEditorBindings($operationStateStore, $onChangeStateStore),
  );
  const flowFieldRowsStateStore = deriveStore(
    [
      operationStateStore,
      booleanRowsStateStore,
      validationErrorsStateStore,
      pathPrefixStateStore,
      currentLanguageState,
    ],
    ([
      $operationStateStore,
      $booleanRowsStateStore,
      $validationErrors,
      $pathPrefix,
    ]) =>
      txBlockFlowFieldsDisplay(
        $operationStateStore.flow,
        $booleanRowsStateStore,
        $validationErrors,
        $pathPrefix,
      ),
  );
  const flowStepRowsStateStore = deriveStore(
    [operationStateStore, currentLanguageState],
    ([$operationStateStore]) =>
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
    flowStepRowsStateStore,
    setFlowEditorContext({
      booleanRows: nextBooleanRows = [],
      pathPrefix: nextPathPrefix = "",
      validationErrors: nextValidationErrors = [],
      onChange: nextOnChange = null,
      operation: nextOperation = {},
    } = {}) {
      booleanRowsStateStore.set(
        Array.isArray(nextBooleanRows) ? nextBooleanRows : [],
      );
      pathPrefixStateStore.set(txStringValue(nextPathPrefix));
      validationErrorsStateStore.set(
        Array.isArray(nextValidationErrors) ? nextValidationErrors : [],
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
  return {
    interactionActionHandlersStateStore,
    interactionDisplayStateStore,
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
