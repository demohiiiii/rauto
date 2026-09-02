import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";
import type { Readable } from "svelte/store";

import { callbackMappedFormValueHandler } from "../../../lib/events.js";
import { currentLanguageState, t } from "../../../lib/i18n.js";
import { createLoadingRunner } from "../../../lib/svelte.js";
import {
  displayText,
  safeString as safeTemplateString,
  selectOptionsWithCurrent,
} from "../../../lib/ui.js";
import {
  defaultTxBlockTemplatePayload,
  txBlockEditorFormStateFromJsonText,
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
} from "../model/transactionBlockFormModels.js";
import {
  defaultTxWorkflowTemplatePayload,
  txWorkflowEditorFormStateFromJsonText,
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
} from "../model/transactionWorkflowFormModels.js";
import { createTransactionEditorSession } from "./transactionEditorSession.js";
import type {
  JsonErrorDetail,
  JsonObject,
  TransactionEditorSyncStatus,
  TransactionEditorView,
  TransactionParsedFormState,
  TxBlockFormModel,
  TxWorkflowFormModel,
} from "../model/types.js";
import {
  jsonTemplateSelectStateFor,
  runTxExecutionModeHandler,
  setJsonTemplateSelectValue,
  setTxJsonEditorRawText,
  txJsonEditorRawText,
  TX_EDITOR,
} from "./transactionPanelState.js";
import {
  setTxVarsRawText,
  txVarsTextStateFor,
  TX_VARS,
} from "./transactionVarsAssistant.js";

type OptionalHandler = (...args: unknown[]) => unknown;

interface TxVarsTextState {
  errorKind?: unknown;
  errorMessage?: unknown;
  raw?: unknown;
}

interface TxTemplateSelectState {
  names?: unknown;
  selected?: unknown;
}

interface TxDirectVarsPanelConfig {
  ariaLabel?: unknown;
  hintKey?: unknown;
  placeholderFallback?: unknown;
  placeholderKey?: unknown;
  varsKey?: unknown;
}

interface TxDirectVarsPanelOptions {
  getPanelConfig?: (() => TxDirectVarsPanelConfig) | null;
}

interface TxChangeFormModelOptions {
  editorDisplayMode?: TransactionEditorView;
  notify?: boolean;
}

interface TxInputEditorSyncState<
  TModel,
  TErrorDetail,
> extends TransactionParsedFormState<TModel, TErrorDetail> {
  jsonText: string;
}

interface TxInputPanelWorkspaceConfig<TModel, TErrorDetail> {
  buildDefaultFormModel(): TModel;
  formModelToJsonText(model: TModel): string;
  inputEditorSyncState(
    currentModel: TModel,
  ): TxInputEditorSyncState<TModel, TErrorDetail>;
  inputFormStateFromJsonText(
    jsonText: string,
    currentModel: TModel,
  ): TransactionParsedFormState<TModel, TErrorDetail>;
  saveEditorFormModel(model: TModel, options?: { notify?: boolean }): unknown;
}

interface TxInputActionWorkspacePort<TModel> {
  changeFormModel(
    nextModel: TModel,
    options?: TxChangeFormModelOptions,
  ): unknown;
  handleJsonInput(jsonText?: unknown): unknown;
  jsonTextStateStore: Readable<string>;
  refreshFromFormModel(): unknown;
  runLoading<T>(
    loadingKey: string,
    operation: () => T | Promise<T>,
  ): Promise<T | undefined>;
}

interface TxExternalActionGroup {
  pendingActions: number;
  requestVersion: number;
  startInputVersion: number;
  succeeded: boolean;
  synchronizedByOwnedNotification: boolean;
}

interface TxExternalActionContext {
  didSynchronizeEditor(): boolean;
  isCurrent(): boolean;
  runOwnedEditorMutation<T>(
    operation: (() => T) | null | undefined,
  ): T | undefined;
}

type TxInputDependencies = Record<string, unknown>;

export const jsonTemplateNameValue = (templateName: unknown): string =>
  safeTemplateString(templateName).trim();

const txDisplayText = (displaySource: unknown): string =>
  displayText(displaySource);

export function transactionEditorSyncPresentation(
  status: TransactionEditorSyncStatus = "synced",
) {
  if (status === "invalid-json") {
    return {
      text: t("txEditorSyncInvalid"),
      tone: "warning",
    };
  }
  if (status === "dirty") {
    return {
      text: t("txEditorSyncDirty"),
      tone: "muted",
    };
  }
  return {
    text: t("txEditorSyncSynced"),
    tone: "primary",
  };
}

const txOptionRowsWithCurrent = (
  optionValues: unknown = [],
  selected: unknown = "",
) =>
  selectOptionsWithCurrent(
    Array.isArray(optionValues) ? optionValues : [],
    selected,
  ).map((optionValue) => ({
    labelText: optionValue,
    valueText: optionValue,
  }));

export const txWorkflowVarsPlaceholder =
  'workflow vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const txWorkflowJsonPlaceholder =
  '{"name":"linux-safe-deploy-demo","fail_fast":true,"blocks":[{"name":"precheck","rollback_policy":"none","fail_fast":true,"steps":[{"run":{"kind":"command","mode":"User","command":"uname -a","timeout":30},"rollback":null,"rollback_on_failure":false},{"run":{"kind":"command","mode":"User","command":"date","timeout":30},"rollback":null,"rollback_on_failure":false}]},{"name":"apply-change","rollback_policy":"per_step","fail_fast":true,"steps":[{"run":{"kind":"command","mode":"User","command":"mkdir -p /tmp/rauto-demo","timeout":30},"rollback":{"kind":"command","mode":"User","command":"rm -rf /tmp/rauto-demo","timeout":30},"rollback_on_failure":false},{"run":{"kind":"command","mode":"User","command":"echo version=2026.04.17 > /tmp/rauto-demo/release.txt","timeout":30},"rollback":{"kind":"command","mode":"User","command":"rm -f /tmp/rauto-demo/release.txt","timeout":30},"rollback_on_failure":true}]},{"name":"verify","rollback_policy":{"whole_resource":{"rollback":{"kind":"command","mode":"User","command":"rm -rf /tmp/rauto-demo","timeout":30},"trigger_step_index":0}},"fail_fast":false,"steps":[{"run":{"kind":"command","mode":"User","command":"ls -lah /tmp/rauto-demo","timeout":30},"rollback":null,"rollback_on_failure":false}]}]}';

export const txBlockVarsPlaceholder =
  'tx block vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const txBlockTemplateVarsPlaceholder =
  'tx block template vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const txBlockJsonPlaceholder =
  '{"name":"tx-block","rollback_policy":"none","steps":[{"run":{"kind":"command","mode":"User","command":"show version","timeout":30},"rollback":null,"rollback_on_failure":false}],"fail_fast":true}';

function txVarsFormError(varsTextState: TxVarsTextState = {}): string {
  if (varsTextState?.errorKind === "object-required") {
    return t("txVarsFormJsonObjectRequired");
  }
  if (varsTextState?.errorKind === "invalid") {
    const detail = txDisplayText(varsTextState.errorMessage);
    return detail
      ? `${t("txVarsFormJsonInvalid")}: ${detail}`
      : t("txVarsFormJsonInvalid");
  }
  return "";
}

export function txDirectVarsPanelDisplay({
  ariaLabel = "",
  hintKey = "",
  placeholderFallback = "",
  placeholderKey = "",
  varsTextState = {},
}: {
  ariaLabel?: string;
  hintKey?: string;
  placeholderFallback?: string;
  placeholderKey?: string;
  varsTextState?: TxVarsTextState;
} = {}) {
  const placeholderText = t(placeholderKey, placeholderFallback);
  return {
    formError: txVarsFormError(varsTextState),
    hintText: hintKey ? t(hintKey) : "",
    placeholderText,
    showHint: !!hintKey,
    textareaLabel: ariaLabel || placeholderText,
    varsText: txDisplayText(varsTextState?.raw),
  };
}

export function txTemplateRunPanelDisplay({
  ariaLabel = "",
  hintKeys = [],
  templateSelectState = {},
  varsPlaceholderFallback = "",
  varsPlaceholderKey = "",
  varsTextState = {},
}: {
  ariaLabel?: string;
  hintKeys?: readonly string[];
  templateSelectState?: TxTemplateSelectState;
  varsPlaceholderFallback?: string;
  varsPlaceholderKey?: string;
  varsTextState?: TxVarsTextState;
} = {}) {
  const varsPlaceholderText = t(varsPlaceholderKey, varsPlaceholderFallback);
  const selectedTemplate = jsonTemplateNameValue(templateSelectState?.selected);
  return {
    deleteButtonLabel: t("templateDeleteBtn"),
    hintRows: (Array.isArray(hintKeys) ? hintKeys : []).map((hintKey) => ({
      hintText: t(hintKey),
    })),
    newButtonLabel: t("newBtn"),
    saveButtonLabel: t("templateSaveBtn"),
    selectedTemplate,
    selectPlaceholder: t("templateSelectPlaceholder"),
    templateOptionRows: txOptionRowsWithCurrent(
      templateSelectState?.names,
      selectedTemplate,
    ),
    textareaLabel: ariaLabel || t("txTemplateVarsJsonAria"),
    varsFormError: txVarsFormError(varsTextState),
    varsPlaceholderText,
    varsText: txDisplayText(varsTextState?.raw),
  };
}

export const txBlockInputPanelDisplay = ({
  jsonPlaceholder = "",
  newButtonLabelKey = "newBtn",
}: {
  jsonPlaceholder?: string;
  newButtonLabelKey?: string;
} = {}) => ({
  directHint: t("txBlockDirectHint"),
  editorTitle: t("txBlockEditorTitle"),
  jsonHint: t("txBlockJsonHint"),
  jsonPlaceholderText: t("txBlockJsonPlaceholder", jsonPlaceholder),
  newButtonLabel: t(newButtonLabelKey),
  tabAriaLabel: t("txStageBlock"),
});

export function txBlockInputEditorSurfaceDisplay(
  inputDisplay: JsonObject = {},
) {
  return {
    editorKey: "txBlock",
    editorTitle: txDisplayText(inputDisplay.editorTitle),
    hostClass: "tx-json-editor",
    jsonHintText: txDisplayText(inputDisplay.jsonHint),
    placeholder: txDisplayText(inputDisplay.jsonPlaceholderText),
  };
}

export const txWorkflowInputPanelDisplay = ({
  jsonPlaceholder = "",
}: {
  jsonPlaceholder?: string;
} = {}) => ({
  directHint: t("txWorkflowDirectHint"),
  importButtonLabel: t("txWorkflowImportFileBtn"),
  jsonPlaceholderText: t("txWorkflowJsonPlaceholder", jsonPlaceholder),
  newButtonLabel: t("newBtn"),
  tabAriaLabel: t("txStageWorkflow"),
});

export function txWorkflowInputEditorSurfaceDisplay(
  inputDisplay: JsonObject = {},
) {
  return {
    editorKey: "txWorkflow",
    editorTitle: txDisplayText(inputDisplay.tabAriaLabel),
    hostClass: "tx-json-editor tx-json-editor-compact",
    placeholder: txDisplayText(inputDisplay.jsonPlaceholderText),
  };
}

function txInputText(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

export function normalizeOptionalHandler(
  handler: unknown,
): OptionalHandler | null {
  return typeof handler === "function" ? (handler as OptionalHandler) : null;
}

function callOptionalTxDependency(
  dependencies: TxInputDependencies,
  dependencyName: string,
  ...args: unknown[]
): unknown {
  const dependency = dependencies?.[dependencyName];
  return typeof dependency === "function" ? dependency(...args) : undefined;
}

function txVarsSafeString(varsValue: unknown): string {
  if (varsValue == null) return "";
  return typeof varsValue === "string" ? varsValue : String(varsValue);
}

function normalizeTransactionKey(
  rawKey: unknown,
  validKeys: ReadonlySet<string>,
  fallback = "",
): string {
  const key = txVarsSafeString(rawKey || "").trim();
  if (!key) return fallback;
  return validKeys.has(key) ? key : fallback || key;
}

function normalizeTxVarsKey(txKey: unknown): string {
  const raw =
    txKey && typeof txKey === "object" && "key" in txKey
      ? (txKey as { key?: unknown }).key
      : txKey;
  return normalizeTransactionKey(
    txVarsSafeString(raw).trim(),
    new Set(Object.values(TX_VARS)),
  );
}

function txDirectVarsPanelConfig(config: TxDirectVarsPanelConfig = {}) {
  return {
    ariaLabel: txVarsSafeString(config.ariaLabel),
    hintKey: txVarsSafeString(config.hintKey),
    placeholderFallback: txVarsSafeString(config.placeholderFallback),
    placeholderKey: txVarsSafeString(config.placeholderKey),
    varsKey: normalizeTxVarsKey(config.varsKey),
  };
}

export function createTxDirectVarsPanelWorkspace({
  getPanelConfig = null,
}: TxDirectVarsPanelOptions = {}) {
  const panelConfig =
    typeof getPanelConfig === "function"
      ? txDirectVarsPanelConfig(getPanelConfig())
      : txDirectVarsPanelConfig();
  const varsTextStateStore = txVarsTextStateFor(panelConfig.varsKey);
  const panelDisplayStateStore = deriveStore(
    [varsTextStateStore, currentLanguageState],
    ([$varsTextStateStore, _currentLanguageState]) => {
      const currentPanelConfig =
        typeof getPanelConfig === "function"
          ? txDirectVarsPanelConfig(getPanelConfig())
          : panelConfig;
      return txDirectVarsPanelDisplay({
        ariaLabel: currentPanelConfig.ariaLabel,
        hintKey: currentPanelConfig.hintKey,
        placeholderFallback: currentPanelConfig.placeholderFallback,
        placeholderKey: currentPanelConfig.placeholderKey,
        varsTextState: $varsTextStateStore as TxVarsTextState,
      });
    },
  );

  function changeVarsText(varsText: unknown = ""): void {
    const currentPanelConfig =
      typeof getPanelConfig === "function"
        ? txDirectVarsPanelConfig(getPanelConfig())
        : panelConfig;
    setTxVarsRawText(currentPanelConfig.varsKey, txInputText(varsText), {
      source: "editor",
    });
  }

  return {
    changeVarsText,
    panelDisplayStateStore,
    varsTextStateStore,
  };
}

export function createTxInputLoadingKeysStore() {
  const loadingKeysStore = writable<string[]>([]);
  const loadingRunner = createLoadingRunner(
    () => getStore(loadingKeysStore),
    (nextKeys: unknown) =>
      loadingKeysStore.set(
        Array.isArray(nextKeys) ? nextKeys.map(txInputText) : [],
      ),
  );
  return { loadingKeysStore, loadingRunner };
}

export function saveTxBlockEditorFormModel(
  formModel: Partial<TxBlockFormModel> = {},
  { notify = true } = {},
): void {
  setTxJsonEditorRawText(
    TX_EDITOR.txBlock,
    txBlockFormModelToJsonText(formModel),
    { notify },
  );
}

export function txBlockInputFormState(
  jsonText = "",
  currentModel: TxBlockFormModel | null = null,
): TransactionParsedFormState<TxBlockFormModel, JsonErrorDetail> {
  const baseModel =
    currentModel || txBlockFormModelFromJson(defaultTxBlockTemplatePayload());
  const state = txBlockEditorFormStateFromJsonText(jsonText, baseModel);
  return {
    ...state,
    formModel: state.formModel ?? baseModel,
  };
}

function txBlockInputFormStateFromEditor(
  currentModel: TxBlockFormModel | null = null,
) {
  return txBlockInputFormState(
    txJsonEditorRawText(TX_EDITOR.txBlock),
    currentModel,
  );
}

export function txBlockInputEditorSyncState(
  currentModel: TxBlockFormModel | null = null,
): TxInputEditorSyncState<TxBlockFormModel, JsonErrorDetail> {
  const jsonText = txJsonEditorRawText(TX_EDITOR.txBlock);
  const nextState = txBlockInputFormStateFromEditor(currentModel);
  return {
    ...nextState,
    jsonText: nextState.formError
      ? jsonText
      : jsonText || txBlockFormModelToJsonText(nextState.formModel),
  };
}

export function saveTxWorkflowEditorFormModel(
  formModel: Partial<TxWorkflowFormModel> = {},
  { notify = true } = {},
): void {
  setTxJsonEditorRawText(
    TX_EDITOR.txWorkflow,
    txWorkflowFormModelToJsonText(formModel),
    { notify },
  );
}

export function txWorkflowInputFormState(
  jsonText = "",
  currentModel: TxWorkflowFormModel | null = null,
): TransactionParsedFormState<TxWorkflowFormModel, JsonErrorDetail> {
  const baseModel =
    currentModel ||
    txWorkflowFormModelFromJson(defaultTxWorkflowTemplatePayload());
  const state = txWorkflowEditorFormStateFromJsonText(jsonText, baseModel);
  return {
    ...state,
    formModel: state.formModel ?? baseModel,
  };
}

function txWorkflowInputFormStateFromEditor(
  currentModel: TxWorkflowFormModel | null = null,
) {
  return txWorkflowInputFormState(
    txJsonEditorRawText(TX_EDITOR.txWorkflow),
    currentModel,
  );
}

export function txWorkflowInputEditorSyncState(
  currentModel: TxWorkflowFormModel | null = null,
): TxInputEditorSyncState<TxWorkflowFormModel, JsonErrorDetail> {
  const jsonText = txJsonEditorRawText(TX_EDITOR.txWorkflow);
  const nextState = txWorkflowInputFormStateFromEditor(currentModel);
  return {
    ...nextState,
    jsonText: nextState.formError
      ? jsonText
      : jsonText || txWorkflowFormModelToJsonText(nextState.formModel),
  };
}

export function createTxInputPanelWorkspace<TModel, TErrorDetail = unknown>({
  buildDefaultFormModel,
  formModelToJsonText,
  inputEditorSyncState,
  inputFormStateFromJsonText,
  saveEditorFormModel,
}: TxInputPanelWorkspaceConfig<TModel, TErrorDetail>) {
  const session = createTransactionEditorSession({
    buildDefaultFormModel,
    formModelToJsonText,
    inputFormStateFromJsonText,
  });
  const { loadingKeysStore, loadingRunner } = createTxInputLoadingKeysStore();
  let initialized = false;

  function refreshFromFormModel(
    currentModel: TModel = session.currentFormModel(),
  ) {
    const nextState = inputEditorSyncState(currentModel);
    session.replaceExternalJson(nextState.jsonText, nextState);
    return nextState;
  }

  function handleJsonInput(jsonText = "") {
    const nextJsonText = txInputText(jsonText);
    const nextState = inputFormStateFromJsonText(
      nextJsonText,
      session.currentFormModel(),
    );
    session.replaceJsonText(nextJsonText, nextState);
    return nextState;
  }

  function changeFormModel(
    nextModel: TModel,
    { editorDisplayMode, notify = true }: TxChangeFormModelOptions = {},
  ): void {
    session.changeFormModel(nextModel, {
      editorDisplayMode,
      notify: false,
    });
    saveEditorFormModel(nextModel, { notify });
  }

  function ensureInitialized(): void {
    if (initialized) return;
    refreshFromFormModel();
    initialized = true;
  }

  function reset(): void {
    initialized = false;
    const defaultFormModel = buildDefaultFormModel();
    session.replaceJsonText(formModelToJsonText(defaultFormModel), {
      formError: "",
      formErrorDetail: null,
      formModel: defaultFormModel,
    });
    session.selectEditorView("form");
    loadingKeysStore.set([]);
  }

  function resetDraft() {
    const defaultFormModel = buildDefaultFormModel();
    changeFormModel(defaultFormModel, {
      editorDisplayMode: "form",
      notify: true,
    });
    session.selectEditorView("form");
    loadingKeysStore.set([]);
    return defaultFormModel;
  }

  return {
    ...session,
    changeFormModel,
    ensureInitialized,
    handleJsonInput,
    loadingKeysStore,
    refreshFromFormModel,
    reset,
    resetDraft,
    runLoading: <T>(loadingKey: string, operation: () => T | Promise<T>) =>
      loadingRunner.run(loadingKey, operation),
  };
}

export function createTxInputPanelActionWorkspace<TModel>(
  txInputWorkspace: TxInputActionWorkspacePort<TModel>,
  dependencies: TxInputDependencies = {},
) {
  let editorInputVersion = 0;
  let activeExternalActionGroup: TxExternalActionGroup | null = null;
  let externalActionVersion = 0;
  let internalEditorInputDepth = 0;
  let ownedEditorActionGroup: TxExternalActionGroup | null = null;
  let ownedEditorInputDepth = 0;

  async function runExternalAction<T>(
    operation: (context: TxExternalActionContext) => T | Promise<T>,
  ): Promise<T> {
    const parentGroup = activeExternalActionGroup;
    const actionGroup = parentGroup || {
      pendingActions: 0,
      requestVersion: externalActionVersion + 1,
      startInputVersion: editorInputVersion,
      succeeded: false,
      synchronizedByOwnedNotification: false,
    };
    if (!parentGroup) externalActionVersion = actionGroup.requestVersion;
    const actionContext: TxExternalActionContext = {
      didSynchronizeEditor: () => actionGroup.synchronizedByOwnedNotification,
      isCurrent: () =>
        actionGroup.requestVersion === externalActionVersion &&
        editorInputVersion === actionGroup.startInputVersion,
      runOwnedEditorMutation<TValue>(
        operation: (() => TValue) | null | undefined,
      ) {
        const previousActionGroup = ownedEditorActionGroup;
        ownedEditorActionGroup = actionGroup;
        ownedEditorInputDepth += 1;
        try {
          return typeof operation === "function" ? operation() : undefined;
        } finally {
          ownedEditorInputDepth -= 1;
          ownedEditorActionGroup = previousActionGroup;
        }
      },
    };
    actionGroup.pendingActions += 1;
    let succeeded = false;
    try {
      let operationResult;
      activeExternalActionGroup = actionGroup;
      try {
        operationResult = operation(actionContext);
      } finally {
        activeExternalActionGroup = parentGroup;
      }
      const result = await operationResult;
      succeeded = true;
      return result;
    } finally {
      actionGroup.succeeded ||= succeeded;
      actionGroup.pendingActions -= 1;
      if (actionGroup.pendingActions === 0) {
        const shouldRefresh =
          actionGroup.succeeded &&
          actionContext.isCurrent() &&
          !actionGroup.synchronizedByOwnedNotification;
        if (shouldRefresh) txInputWorkspace.refreshFromFormModel();
      }
    }
  }

  async function createJsonDraft() {
    return runExternalAction((actionContext) =>
      txInputWorkspace.runLoading("json-new", () =>
        callOptionalTxDependency(
          dependencies,
          "onCreateJsonTemplateDraft",
          actionContext,
        ),
      ),
    );
  }

  async function createTemplateDraft() {
    return runExternalAction((actionContext) =>
      callOptionalTxDependency(
        dependencies,
        "onCreateJsonTemplateDraft",
        actionContext,
      ),
    );
  }

  async function createDirectDraft() {
    return runExternalAction((actionContext) =>
      callOptionalTxDependency(
        dependencies,
        "onCreateDirectDraft",
        actionContext,
      ),
    );
  }

  function changeFormModel(
    nextModel: TModel,
    options: TxChangeFormModelOptions = {},
  ): void {
    editorInputVersion += 1;
    internalEditorInputDepth += 1;
    try {
      txInputWorkspace.changeFormModel(nextModel, options);
    } finally {
      internalEditorInputDepth -= 1;
    }
  }

  function handleEditorJsonInput(jsonText: unknown = ""): void {
    callOptionalTxDependency(dependencies, "onEditorInput", jsonText);
    const notificationIsActionOwned =
      internalEditorInputDepth > 0 || ownedEditorInputDepth > 0;
    const notificationMatchesCanonical =
      txInputText(jsonText) === getStore(txInputWorkspace.jsonTextStateStore);
    if (!(notificationIsActionOwned && notificationMatchesCanonical)) {
      txInputWorkspace.handleJsonInput(jsonText);
    }
    if (ownedEditorInputDepth > 0 && ownedEditorActionGroup) {
      ownedEditorActionGroup.synchronizedByOwnedNotification = true;
    } else if (internalEditorInputDepth === 0) {
      editorInputVersion += 1;
    }
  }

  async function importFile(file: unknown) {
    return runExternalAction((actionContext) =>
      callOptionalTxDependency(
        dependencies,
        "onImportFile",
        file,
        actionContext,
      ),
    );
  }

  async function loadJsonTemplate(templateName = "") {
    return runExternalAction((actionContext) =>
      callOptionalTxDependency(
        dependencies,
        "onLoadJsonTemplate",
        templateName,
        actionContext,
      ),
    );
  }

  function selectMode(txExecutionMode = "") {
    return runTxExecutionModeHandler(
      txExecutionMode,
      () => callOptionalTxDependency(dependencies, "onDirectMode"),
      () => callOptionalTxDependency(dependencies, "onTemplateMode"),
    );
  }

  return {
    changeFormModel,
    createDirectDraft,
    createJsonDraft,
    createTemplateDraft,
    handleEditorJsonInput,
    importFile,
    loadJsonTemplate,
    selectMode,
  };
}

function txTemplateRunInputHandlers({
  onTemplateChange = null,
}: {
  onTemplateChange?: ((value: unknown) => unknown) | null;
} = {}) {
  return {
    templateChangeHandler() {
      return callbackMappedFormValueHandler(
        onTemplateChange,
        (value: unknown) => value,
      );
    },
  };
}

export function txTemplateRunActionHandlers({
  onTemplateChange = null,
}: {
  onTemplateChange?: ((value: unknown) => unknown) | null;
} = {}) {
  const inputHandlers = txTemplateRunInputHandlers({
    onTemplateChange,
  });
  return {
    templateChangeHandler: inputHandlers.templateChangeHandler,
  };
}
