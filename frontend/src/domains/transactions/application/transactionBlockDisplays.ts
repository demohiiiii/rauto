import { derived as deriveStore, get, readonly, writable } from "svelte/store";
import {
  currentLanguage,
  currentLanguageState,
  t,
  tr,
} from "../../../lib/i18n.js";
import { plainObject, stringValue } from "../../../lib/jsonValue.js";
import {
  MANUAL_COMMAND_SOURCE,
  commandTemplateCatalog,
} from "$domains/command/index.js";
import type { CommandTemplateCatalog } from "$domains/command/index.js";
import { transactionBlockRuntime } from "../infrastructure/transactionBlockRuntime.js";
import type {
  JsonObject,
  TxBlockFormModel,
  TxCommandModel,
  TxMetadataFieldDefinition,
  TxOperationModel,
  TxStepFormModel,
  TxValidationError,
} from "../model/types.js";
import { validateTxBlockFormModel } from "../model/transactionBlockFormModels.js";
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
} from "../model/transactionBlockMutations.js";
import { txExtraStringFieldRows } from "../model/transactionMetadataFields.js";
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
} from "../presentation/transactionBlockDisplayState.js";
import { createTxProfileModeLoader } from "./transactionProfileModes.js";

type ChangeHandler<T> = ((value: T) => unknown) | null;
type MaybePromise<T> = T | Promise<T>;

interface TxBlockRuntime {
  confirm(message: string): MaybePromise<boolean>;
  getTemplate(name: string): Promise<unknown>;
}

interface TxVisualSelection {
  kind: "root" | "step";
  stepIndex: number;
}

interface TxBlockVisualEditorOptions {
  model?: unknown;
  onChange?: ChangeHandler<TxBlockFormModel>;
}

interface TxBlockCommandEditorOptions {
  command?: unknown;
  confirmReplace?: TxBlockRuntime["confirm"];
  metadataFieldDefs?: readonly TxMetadataFieldDefinition[];
  onChange?: ChangeHandler<Partial<TxCommandModel>>;
  pathPrefix?: string;
  templateApi?: Pick<TxBlockRuntime, "getTemplate">;
  templateCatalog?: CommandTemplateCatalog;
  validationErrors?: readonly TxValidationError[];
}

interface TxBlockOperationEditorOptions {
  operation?: unknown;
  onChange?: ChangeHandler<TxOperationModel>;
  titleText?: string;
}

interface TxBlockStepEditorOptions {
  step?: unknown;
  onStepChange?: TxBlockStepChangeHandler | null;
}

interface TxBlockFlowEditorOptions {
  booleanRows?: readonly string[];
  onChange?: ChangeHandler<Partial<TxOperationModel>>;
  operation?: unknown;
  pathPrefix?: string;
  validationErrors?: readonly TxValidationError[];
}

interface TxBlockCommandChildOptions {
  command?: unknown;
  commandDisplay?: unknown;
  onChange?: ChangeHandler<Partial<TxCommandModel>>;
}

interface TxBlockStepChangeHandler {
  (field: string, enabled: boolean): unknown;
  (patch: Partial<TxStepFormModel>): unknown;
}

interface TxBlockCommandChildWorkspaceOptions<
  TBindings,
  TDisplay,
> extends TxBlockCommandChildOptions {
  bindings: (
    command: TxCommandModel,
    onChange: ChangeHandler<TxCommandModel>,
  ) => TBindings;
  display: (command: TxCommandModel, commandDisplay: JsonObject) => TDisplay;
}

function txModel<T extends JsonObject>(value: unknown): T {
  return (plainObject(value) ? value : {}) as T;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function txBlockVisualEditorDisplay() {
  return {
    booleanRows: TX_BLOCK_BOOLEAN_ROWS,
    jsonValueTypeRows: TX_BLOCK_JSON_VALUE_TYPE_ROWS,
    operationKindRows: TX_BLOCK_OPERATION_KIND_ROWS,
    rollbackKindRows: TX_BLOCK_ROLLBACK_KIND_ROWS,
  };
}

export function createTxBlockVisualEditorWorkspace({
  model = {},
  onChange = null,
}: TxBlockVisualEditorOptions = {}) {
  const initialModel = txModel<TxBlockFormModel>(model);
  const initialSteps = Array.isArray(initialModel.steps)
    ? initialModel.steps
    : [];
  const modelStateStore = writable(initialModel);
  const onChangeStateStore = writable(onChange);
  const selectedTargetWritableStateStore = writable<TxVisualSelection>(
    initialSteps.length > 0
      ? { kind: "step", stepIndex: 0 }
      : { kind: "root", stepIndex: -1 },
  );
  const selectedTargetStateStore = readonly(selectedTargetWritableStateStore);

  function modelSteps(
    currentModel: TxBlockFormModel = get(modelStateStore),
  ): TxStepFormModel[] {
    return Array.isArray(currentModel?.steps) ? currentModel.steps : [];
  }

  function stepSelection(stepIndex: number): TxVisualSelection {
    return { kind: "step", stepIndex };
  }

  function rootSelection(): TxVisualSelection {
    return { kind: "root", stepIndex: -1 };
  }

  function normalizedSelection(
    selection: TxVisualSelection,
    currentModel: TxBlockFormModel,
  ): TxVisualSelection {
    const steps = modelSteps(currentModel);
    if (selection?.kind !== "step" || steps.length === 0) {
      return rootSelection();
    }
    const stepIndex = Number.isInteger(selection.stepIndex)
      ? Math.min(Math.max(selection.stepIndex, 0), steps.length - 1)
      : 0;
    return stepSelection(stepIndex);
  }

  function applyVisualEditorModel(nextModel: TxBlockFormModel): void {
    modelStateStore.set(nextModel);
    const currentOnChange = get(onChangeStateStore);
    if (typeof currentOnChange === "function") currentOnChange(nextModel);
  }

  function selectRoot() {
    selectedTargetWritableStateStore.set(rootSelection());
    return true;
  }

  function selectStep(stepIndex: number): boolean {
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

  function moveSelectedStep(delta: number): boolean {
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
      const rollbackKind = stringValue($model?.rollbackPolicy?.kind, "none");
      const rollbackLabelKeys: Record<string, string> = {
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
            valueText: stringValue($model?.name).trim() || unnamedBlockText,
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
      const nextModelValue = txModel<TxBlockFormModel>(nextModel);
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
  confirmReplace = transactionBlockRuntime.confirm,
  metadataFieldDefs = [],
  onChange = null,
  pathPrefix = "",
  templateApi = transactionBlockRuntime,
  templateCatalog = commandTemplateCatalog,
  validationErrors = [],
}: TxBlockCommandEditorOptions = {}) {
  const commandStateStore = writable(txModel<TxCommandModel>(command));
  const metadataFieldDefsStateStore = writable(
    Array.isArray(metadataFieldDefs) ? metadataFieldDefs : [],
  );
  const onChangeStateStore = writable(onChange);
  const pathPrefixStateStore = writable(pathPrefix);
  const validationErrorsStateStore = writable(validationErrors);
  const templateSourceStateStore = writable({
    baselineContent: "",
    loading: false,
    selection: MANUAL_COMMAND_SOURCE,
    statusMessage: "",
    statusTone: "info",
  });
  let templateLoadVersion = 0;
  let destroyed = false;
  const commandModeLoader = createTxProfileModeLoader({
    currentMode: () => get(commandStateStore)?.mode ?? "",
  });
  const unsubscribeCommandModeInitialization =
    commandModeLoader.state.subscribe((modeState) => {
      const commandValue = get(commandStateStore);
      if (stringValue(commandValue?.mode).trim()) return;
      const defaultMode = stringValue(modeState?.defaultMode).trim();
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
  const commandTemplateSourceStateStore = deriveStore(
    [
      commandStateStore,
      templateCatalog.state,
      templateSourceStateStore,
      currentLanguageState,
    ],
    ([$command, $catalog, $source]) => ({
      dirty:
        stringValue($command?.command) !== stringValue($source.baselineContent),
      loading: !!$catalog.loading || !!$source.loading,
      optionValues: Array.isArray($catalog.names) ? $catalog.names : [],
      selection: $source.selection,
      statusMessage: $source.statusMessage || $catalog.errorMessage || "",
      statusTone: $source.statusMessage ? $source.statusTone : "error",
    }),
  );

  function applyCommandPatch(patch: Partial<TxCommandModel>): void {
    const commandValue = get(commandStateStore);
    commandStateStore.set({ ...commandValue, ...patch });
    const currentOnChange = get(onChangeStateStore);
    if (typeof currentOnChange === "function") currentOnChange(patch);
  }

  async function initializeCommandTemplates() {
    return templateCatalog.ensureLoaded();
  }

  async function selectCommandTemplate(
    sourceValue: unknown = MANUAL_COMMAND_SOURCE,
  ): Promise<boolean> {
    const source = stringValue(sourceValue).trim() || MANUAL_COMMAND_SOURCE;
    const sourceState = get(templateSourceStateStore);
    if (source === sourceState.selection) return true;
    const commandText = stringValue(get(commandStateStore)?.command);
    if (
      commandText !== stringValue(sourceState.baselineContent) &&
      !(await confirmReplace(t("commandReplaceConfirm")))
    ) {
      return false;
    }

    const version = ++templateLoadVersion;
    if (source === MANUAL_COMMAND_SOURCE) {
      templateSourceStateStore.set({
        baselineContent: "",
        loading: false,
        selection: MANUAL_COMMAND_SOURCE,
        statusMessage: "",
        statusTone: "info",
      });
      applyCommandPatch({ command: "" });
      return true;
    }

    templateSourceStateStore.update((current) => ({
      ...current,
      loading: true,
      statusMessage: "",
    }));
    try {
      const detail = await templateApi.getTemplate(source);
      if (destroyed || version !== templateLoadVersion) return false;
      const content = stringValue(txModel<JsonObject>(detail).content);
      templateSourceStateStore.set({
        baselineContent: content,
        loading: false,
        selection: source,
        statusMessage: "",
        statusTone: "info",
      });
      applyCommandPatch({ command: content });
      return true;
    } catch (error) {
      if (!destroyed && version === templateLoadVersion) {
        templateSourceStateStore.update((current) => ({
          ...current,
          loading: false,
          statusMessage: errorMessage(error, t("commandTemplateLoadFailed")),
          statusTone: "error",
        }));
      }
      return false;
    }
  }

  return {
    commandActionHandlersStateStore,
    commandDisplayStateStore,
    commandTemplateSourceStateStore,
    destroy() {
      destroyed = true;
      templateLoadVersion += 1;
      unsubscribeCommandModeInitialization();
      commandModeLoader.destroy();
    },
    initializeCommandTemplates,
    metadataFieldRowsStateStore,
    selectCommandTemplate,
    setCommandEditorContext({
      command: nextCommand = {},
      metadataFieldDefs: nextMetadataFieldDefs = [],
      onChange: nextOnChange = null,
      pathPrefix: nextPathPrefix = "",
      validationErrors: nextValidationErrors = [],
    } = {}) {
      const commandValue = txModel<TxCommandModel>(nextCommand);
      const previousPathPrefix = get(pathPrefixStateStore);
      if (previousPathPrefix && previousPathPrefix !== nextPathPrefix) {
        templateLoadVersion += 1;
        templateSourceStateStore.set({
          baselineContent: "",
          loading: false,
          selection: MANUAL_COMMAND_SOURCE,
          statusMessage: "",
          statusTone: "info",
        });
      }
      commandStateStore.set(commandValue);
      metadataFieldDefsStateStore.set(
        Array.isArray(nextMetadataFieldDefs) ? nextMetadataFieldDefs : [],
      );
      onChangeStateStore.set(nextOnChange);
      pathPrefixStateStore.set(stringValue(nextPathPrefix));
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
}: TxBlockOperationEditorOptions = {}) {
  const operationStateStore = writable(txModel<TxOperationModel>(operation));
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
      operationStateStore.set(txModel<TxOperationModel>(nextOperation));
      titleStateStore.set(stringValue(nextTitleText));
    },
  };
}

export function createTxBlockStepEditorWorkspace({
  step = {},
  onStepChange = null,
}: TxBlockStepEditorOptions = {}) {
  const stepStateStore = writable(txModel<TxStepFormModel>(step));
  const onStepChangeStateStore = writable(onStepChange);
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
    } = {}) {
      onStepChangeStateStore.set(nextOnStepChange);
      stepStateStore.set(txModel<TxStepFormModel>(nextStep));
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
}: TxBlockFlowEditorOptions = {}) {
  const operationStateStore = writable(txModel<TxOperationModel>(operation));
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
  return {
    flowActionHandlersStateStore,
    flowFieldRowsStateStore,
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
      pathPrefixStateStore.set(stringValue(nextPathPrefix));
      validationErrorsStateStore.set(
        Array.isArray(nextValidationErrors) ? nextValidationErrors : [],
      );
      onChangeStateStore.set(nextOnChange);
      operationStateStore.set(txModel<TxOperationModel>(nextOperation));
    },
  };
}

function createTxBlockCommandChildWorkspace<TBindings, TDisplay>({
  bindings,
  command = {},
  commandDisplay = {},
  display,
  onChange = null,
}: TxBlockCommandChildWorkspaceOptions<TBindings, TDisplay>) {
  const commandStateStore = writable(txModel<TxCommandModel>(command));
  const commandDisplayStateStore = writable(
    txModel<JsonObject>(commandDisplay),
  );
  const onChangeStateStore = writable(onChange);
  const actionHandlersStateStore = deriveStore(
    [commandStateStore, onChangeStateStore],
    ([$command, $onChange]) => bindings($command, $onChange),
  );
  const displayStateStore = deriveStore(
    [commandStateStore, commandDisplayStateStore, currentLanguageState],
    ([$command, $commandDisplay]) => display($command, $commandDisplay),
  );
  return {
    actionHandlersStateStore,
    displayStateStore,
    setContext({
      command: nextCommand = {},
      commandDisplay: nextCommandDisplay = {},
      onChange: nextOnChange = null,
    } = {}) {
      commandStateStore.set(txModel<TxCommandModel>(nextCommand));
      commandDisplayStateStore.set(txModel<JsonObject>(nextCommandDisplay));
      onChangeStateStore.set(nextOnChange);
    },
  };
}

export function createTxBlockCommandInteractionEditorWorkspace(
  options: TxBlockCommandChildOptions = {},
) {
  const workspace = createTxBlockCommandChildWorkspace({
    ...options,
    bindings: txBlockCommandInteractionEditorBindings,
    display: (command, commandDisplay) => {
      const interactionDisplay = commandDisplay.interactionDisplay;
      return plainObject(interactionDisplay)
        ? interactionDisplay
        : txBlockCommandInteractionDisplay(command, TX_BLOCK_BOOLEAN_ROWS);
    },
  });
  return {
    interactionActionHandlersStateStore: workspace.actionHandlersStateStore,
    interactionDisplayStateStore: workspace.displayStateStore,
    setInteractionEditorContext: workspace.setContext,
  };
}

export function createTxBlockCommandDynParamsEditorWorkspace(
  options: TxBlockCommandChildOptions = {},
) {
  const workspace = createTxBlockCommandChildWorkspace({
    ...options,
    bindings: txBlockCommandDynParamsEditorBindings,
    display: txBlockCommandDynParamsDisplay,
  });
  return {
    dynParamsActionHandlersStateStore: workspace.actionHandlersStateStore,
    dynParamsDisplayStateStore: workspace.displayStateStore,
    setDynParamsContext: workspace.setContext,
  };
}
