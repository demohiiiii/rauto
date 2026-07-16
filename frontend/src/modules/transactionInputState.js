import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";

import { callbackMappedFormValueHandler } from "../lib/events.js";
import { currentLanguageState, t } from "../lib/i18n.js";
import { createLoadingRunner } from "../lib/svelte.js";
import {
  displayText,
  safeString as safeTemplateString,
  selectOptionsWithCurrent,
} from "../lib/ui.js";
import {
  defaultTxBlockTemplatePayload,
  txBlockEditorFormStateFromJsonText,
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
} from "./transactionBlockFormModels.js";
import {
  defaultTxWorkflowTemplatePayload,
  txWorkflowEditorFormStateFromJsonText,
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
} from "./transactionWorkflowFormModels.js";
import { createTransactionEditorSession } from "./transactionEditorSession.js";
import {
  jsonTemplateSelectStateFor,
  runTxExecutionModeHandler,
  setJsonTemplateSelectValue,
  setTxJsonEditorRawText,
  setTxVarsRawText,
  txJsonEditorRawText,
  txVarsTextStateFor,
  TX_EDITOR,
  TX_VARS,
} from "./transactionPanelState.js";

export const jsonTemplateNameValue = (templateName) =>
  safeTemplateString(templateName).trim();

const txDisplayText = (displaySource) => displayText(displaySource);

export function transactionEditorSyncPresentation(status = "synced") {
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

const txOptionRowsWithCurrent = (optionValues = [], selected = "") =>
  selectOptionsWithCurrent(optionValues, selected).map((optionValue) => ({
    labelText: optionValue,
    valueText: optionValue,
  }));

export const txWorkflowVarsPlaceholder =
  'workflow vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const txWorkflowJsonPlaceholder =
  '{"name":"linux-safe-deploy-demo","fail_fast":true,"blocks":[{"name":"precheck","rollback_policy":"none","fail_fast":true,"steps":[{"run":{"kind":"command","mode":"User","command":"uname -a","timeout":30},"rollback":null,"rollback_on_failure":false},{"run":{"kind":"command","mode":"User","command":"date","timeout":30},"rollback":null,"rollback_on_failure":false}]},{"name":"apply-change","rollback_policy":"per_step","fail_fast":true,"steps":[{"run":{"kind":"command","mode":"User","command":"mkdir -p /tmp/rauto-demo","timeout":30},"rollback":{"kind":"command","mode":"User","command":"rm -rf /tmp/rauto-demo","timeout":30},"rollback_on_failure":false},{"run":{"kind":"command","mode":"User","command":"echo version=2026.04.17 > /tmp/rauto-demo/release.txt","timeout":30},"rollback":{"kind":"command","mode":"User","command":"rm -f /tmp/rauto-demo/release.txt","timeout":30},"rollback_on_failure":true}]},{"name":"verify","rollback_policy":{"whole_resource":{"rollback":{"kind":"command","mode":"User","command":"rm -rf /tmp/rauto-demo","timeout":30},"trigger_step_index":0}},"fail_fast":false,"steps":[{"run":{"kind":"command","mode":"User","command":"ls -lah /tmp/rauto-demo","timeout":30},"rollback":null,"rollback_on_failure":false}]}]}';

export const txWorkflowTemplateVarsPlaceholder =
  'workflow template vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const txBlockVarsPlaceholder =
  'tx block vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const txBlockTemplateVarsPlaceholder =
  'tx block template vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const txBlockJsonPlaceholder =
  '{"name":"tx-block","rollback_policy":"none","steps":[{"run":{"kind":"command","mode":"User","command":"show version","timeout":30},"rollback":null,"rollback_on_failure":false}],"fail_fast":true}';

function txVarsFormError(varsTextState = {}) {
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
} = {}) => ({
  directHint: t("txBlockDirectHint"),
  editorTitle: t("txBlockEditorTitle"),
  jsonHint: t("txBlockJsonHint"),
  jsonPlaceholderText: t("txBlockJsonPlaceholder", jsonPlaceholder),
  newButtonLabel: t(newButtonLabelKey),
  tabAriaLabel: t("txStageBlock"),
});

export function txBlockInputEditorSurfaceDisplay(inputDisplay = {}) {
  return {
    editorKey: "txBlock",
    editorTitle: txDisplayText(inputDisplay.editorTitle),
    hostClass: "tx-json-editor",
    jsonHintText: txDisplayText(inputDisplay.jsonHint),
    placeholder: txDisplayText(inputDisplay.jsonPlaceholderText),
  };
}

export const txWorkflowInputPanelDisplay = ({ jsonPlaceholder = "" } = {}) => ({
  directHint: t("txWorkflowDirectHint"),
  importButtonLabel: t("txWorkflowImportFileBtn"),
  jsonPlaceholderText: t("txWorkflowJsonPlaceholder", jsonPlaceholder),
  newButtonLabel: t("newBtn"),
  tabAriaLabel: t("txStageWorkflow"),
});

export function txWorkflowInputEditorSurfaceDisplay(inputDisplay = {}) {
  return {
    editorKey: "txWorkflow",
    editorTitle: txDisplayText(inputDisplay.tabAriaLabel),
    hostClass: "tx-json-editor tx-json-editor-compact",
    placeholder: txDisplayText(inputDisplay.jsonPlaceholderText),
  };
}

function txInputText(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

export function normalizeOptionalHandler(handler) {
  return typeof handler === "function" ? handler : null;
}

function callOptionalTxDependency(dependencies, dependencyName, ...args) {
  const dependency = dependencies?.[dependencyName];
  return typeof dependency === "function" ? dependency(...args) : undefined;
}

function txVarsSafeString(varsValue) {
  if (varsValue == null) return "";
  return typeof varsValue === "string" ? varsValue : String(varsValue);
}

function normalizeTransactionKey(rawKey, validKeys, fallback = "") {
  const key = txVarsSafeString(rawKey || "").trim();
  if (!key) return fallback;
  return validKeys.has(key) ? key : fallback || key;
}

function normalizeTxVarsKey(txKey) {
  const raw =
    txKey && typeof txKey === "object" && "key" in txKey ? txKey.key : txKey;
  return normalizeTransactionKey(
    txVarsSafeString(raw).trim(),
    new Set(Object.values(TX_VARS)),
  );
}

function txDirectVarsPanelConfig(config = {}) {
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
} = {}) {
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
        varsTextState: $varsTextStateStore,
      });
    },
  );

  function changeVarsText(varsText = "") {
    const currentPanelConfig =
      typeof getPanelConfig === "function"
        ? txDirectVarsPanelConfig(getPanelConfig())
        : panelConfig;
    setTxVarsRawText(currentPanelConfig.varsKey, varsText, {
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
  const loadingKeysStore = writable([]);
  const loadingRunner = createLoadingRunner(
    () => getStore(loadingKeysStore),
    (nextKeys) => loadingKeysStore.set(Array.isArray(nextKeys) ? nextKeys : []),
  );
  return { loadingKeysStore, loadingRunner };
}

export function saveTxBlockEditorFormModel(
  formModel = {},
  { notify = true } = {},
) {
  setTxJsonEditorRawText(
    TX_EDITOR.txBlock,
    txBlockFormModelToJsonText(formModel),
    { notify },
  );
}

export function txBlockInputFormState(jsonText = "", currentModel = null) {
  const baseModel =
    currentModel || txBlockFormModelFromJson(defaultTxBlockTemplatePayload());
  return txBlockEditorFormStateFromJsonText(jsonText, baseModel);
}

function txBlockInputFormStateFromEditor(currentModel = null) {
  return txBlockInputFormState(
    txJsonEditorRawText(TX_EDITOR.txBlock),
    currentModel,
  );
}

export function txBlockInputEditorSyncState(currentModel = null) {
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
  formModel = {},
  { notify = true } = {},
) {
  setTxJsonEditorRawText(
    TX_EDITOR.txWorkflow,
    txWorkflowFormModelToJsonText(formModel),
    { notify },
  );
}

export function txWorkflowInputFormState(jsonText = "", currentModel = null) {
  const baseModel =
    currentModel ||
    txWorkflowFormModelFromJson(defaultTxWorkflowTemplatePayload());
  return txWorkflowEditorFormStateFromJsonText(jsonText, baseModel);
}

function txWorkflowInputFormStateFromEditor(currentModel = null) {
  return txWorkflowInputFormState(
    txJsonEditorRawText(TX_EDITOR.txWorkflow),
    currentModel,
  );
}

export function txWorkflowInputEditorSyncState(currentModel = null) {
  const jsonText = txJsonEditorRawText(TX_EDITOR.txWorkflow);
  const nextState = txWorkflowInputFormStateFromEditor(currentModel);
  return {
    ...nextState,
    jsonText: nextState.formError
      ? jsonText
      : jsonText || txWorkflowFormModelToJsonText(nextState.formModel),
  };
}

export function createTxInputPanelWorkspace({
  buildDefaultFormModel,
  formModelToJsonText,
  inputEditorSyncState,
  inputFormStateFromJsonText,
  saveEditorFormModel,
} = {}) {
  const session = createTransactionEditorSession({
    buildDefaultFormModel,
    formModelToJsonText,
    inputFormStateFromJsonText,
  });
  const { loadingKeysStore, loadingRunner } = createTxInputLoadingKeysStore();
  let initialized = false;

  function refreshFromFormModel(currentModel = session.currentFormModel()) {
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
    nextModel,
    { editorDisplayMode, notify = true } = {},
  ) {
    session.changeFormModel(nextModel, {
      editorDisplayMode,
      notify: false,
    });
    saveEditorFormModel(nextModel, { notify });
  }

  function ensureInitialized() {
    if (initialized) return;
    refreshFromFormModel();
    initialized = true;
  }

  function reset() {
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

  return {
    ...session,
    changeFormModel,
    ensureInitialized,
    handleJsonInput,
    loadingKeysStore,
    refreshFromFormModel,
    reset,
    runLoading: (loadingKey, operation) =>
      loadingRunner.run(loadingKey, operation),
  };
}

export function createTxInputPanelActionWorkspace(
  txInputWorkspace,
  dependencies = {},
) {
  let editorInputVersion = 0;
  let activeExternalActionGroup = null;
  let externalActionVersion = 0;
  let internalEditorInputDepth = 0;
  let ownedEditorActionGroup = null;
  let ownedEditorInputDepth = 0;

  async function runExternalAction(operation) {
    const parentGroup = activeExternalActionGroup;
    const actionGroup = parentGroup || {
      pendingActions: 0,
      requestVersion: externalActionVersion + 1,
      startInputVersion: editorInputVersion,
      succeeded: false,
      synchronizedByOwnedNotification: false,
    };
    if (!parentGroup) externalActionVersion = actionGroup.requestVersion;
    const actionContext = {
      didSynchronizeEditor: () => actionGroup.synchronizedByOwnedNotification,
      isCurrent: () =>
        actionGroup.requestVersion === externalActionVersion &&
        editorInputVersion === actionGroup.startInputVersion,
      runOwnedEditorMutation(operation) {
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

  function changeFormModel(nextModel, options = {}) {
    editorInputVersion += 1;
    internalEditorInputDepth += 1;
    try {
      txInputWorkspace.changeFormModel(nextModel, options);
    } finally {
      internalEditorInputDepth -= 1;
    }
  }

  function handleEditorJsonInput(jsonText = "") {
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

  async function importFile(file) {
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

function txTemplateRunInputHandlers({ onTemplateChange = null } = {}) {
  return {
    templateChangeHandler() {
      return callbackMappedFormValueHandler(onTemplateChange, (value) => value);
    },
  };
}

export function txTemplateRunActionHandlers({ onTemplateChange = null } = {}) {
  const inputHandlers = txTemplateRunInputHandlers({
    onTemplateChange,
  });
  return {
    templateChangeHandler: inputHandlers.templateChangeHandler,
  };
}
