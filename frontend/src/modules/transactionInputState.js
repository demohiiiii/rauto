import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";

import {
  TX_EXECUTION_MODE,
  normalizeTxExecutionMode,
} from "../config/dashboardModes.js";
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
import {
  jsonTemplateSelectStateFor,
  runTxExecutionModeHandler,
  setJsonTemplateSelectValue,
  setTxJsonEditorRawText,
  setTxVarsRawText,
  txExecutionModes,
  txJsonEditorRawText,
  txVarsTextStateFor,
  TX_EDITOR,
  TX_VARS,
} from "./transactionPanelState.js";

export const jsonTemplateNameValue = (templateName) =>
  safeTemplateString(templateName).trim();

const txExecutionModePresentation = (mode = "") => {
  const normalized = normalizeTxExecutionMode(mode);
  return {
    isDirect: normalized === TX_EXECUTION_MODE.direct,
    isTemplate: normalized === TX_EXECUTION_MODE.template,
    mode: normalized,
  };
};

const txDisplayText = (displaySource) => displayText(displaySource);

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

export function txDirectVarsPanelDisplay({
  ariaLabel = "",
  hintKey = "",
  placeholderFallback = "",
  placeholderKey = "",
  varsTextState = {},
} = {}) {
  const placeholderText = t(placeholderKey, placeholderFallback);
  return {
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
    varsPlaceholderText,
    varsText: txDisplayText(varsTextState?.raw),
  };
}

export const txBlockInputPanelDisplay = (
  modes = {},
  { jsonPlaceholder = "", newButtonLabelKey = "newBtn" } = {},
) => ({
  activeMode: txDisplayText(modes.txBlock || ""),
  directHint: t("txBlockDirectHint"),
  editorTitle: t("txBlockEditorTitle"),
  fullDraftButtonLabel: t("txBlockFullDraftBtn"),
  jsonHint: t("txBlockJsonHint"),
  jsonPlaceholderText: t("txBlockJsonPlaceholder", jsonPlaceholder),
  mode: txExecutionModePresentation(modes.txBlock),
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

export const txWorkflowInputPanelDisplay = (
  activeMode = "",
  { jsonPlaceholder = "" } = {},
) => ({
  directHint: t("txWorkflowDirectHint"),
  importButtonLabel: t("txWorkflowImportFileBtn"),
  jsonPlaceholderText: t("txWorkflowJsonPlaceholder", jsonPlaceholder),
  mode: txExecutionModePresentation(activeMode),
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
  if (typeof jsonText !== "string" || !jsonText.trim()) {
    return {
      formError: "",
      formModel: baseModel,
    };
  }
  return txBlockEditorFormStateFromJsonText(jsonText, baseModel);
}

function txBlockInputFormStateFromEditor(currentModel = null) {
  return txBlockInputFormState(
    txJsonEditorRawText(TX_EDITOR.txBlock),
    currentModel,
  );
}

export function txBlockInputEditorSyncState(currentModel = null) {
  const nextState = txBlockInputFormStateFromEditor(currentModel);
  return {
    ...nextState,
    jsonText:
      txJsonEditorRawText(TX_EDITOR.txBlock) ||
      txBlockFormModelToJsonText(nextState.formModel),
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
  if (typeof jsonText !== "string" || !jsonText.trim()) {
    return {
      formError: "",
      formModel: baseModel,
    };
  }
  return txWorkflowEditorFormStateFromJsonText(jsonText, baseModel);
}

function txWorkflowInputFormStateFromEditor(currentModel = null) {
  return txWorkflowInputFormState(
    txJsonEditorRawText(TX_EDITOR.txWorkflow),
    currentModel,
  );
}

export function txWorkflowInputEditorSyncState(currentModel = null) {
  const nextState = txWorkflowInputFormStateFromEditor(currentModel);
  return {
    ...nextState,
    jsonText:
      txJsonEditorRawText(TX_EDITOR.txWorkflow) ||
      txWorkflowFormModelToJsonText(nextState.formModel),
  };
}

export function createTxInputPanelWorkspace({
  buildDefaultFormModel,
  formModelToJsonText,
  inputEditorSyncState,
  inputFormStateFromJsonText,
  saveEditorFormModel,
} = {}) {
  const baseModel = buildDefaultFormModel();
  const formModelStateStore = writable(baseModel);
  const formErrorStateStore = writable("");
  const jsonTextStateStore = writable(formModelToJsonText(baseModel));
  const editorDisplayModeStateStore = writable("form");
  const { loadingKeysStore, loadingRunner } = createTxInputLoadingKeysStore();
  let initialized = false;

  function setEditorState(nextState = {}, nextJsonText = "") {
    formModelStateStore.set(nextState.formModel || buildDefaultFormModel());
    formErrorStateStore.set(txInputText(nextState.formError));
    jsonTextStateStore.set(
      txInputText(nextJsonText) ||
        formModelToJsonText(nextState.formModel || buildDefaultFormModel()),
    );
  }

  function currentFormModel() {
    return getStore(formModelStateStore) || buildDefaultFormModel();
  }

  function refreshFromFormModel(currentModel = currentFormModel()) {
    const nextState = inputEditorSyncState(currentModel);
    setEditorState(nextState, nextState.jsonText);
    return nextState;
  }

  function changeFormModel(nextModel, { notify = true } = {}) {
    const nextJsonText = formModelToJsonText(nextModel);
    formModelStateStore.set(nextModel);
    formErrorStateStore.set("");
    jsonTextStateStore.set(nextJsonText);
    saveEditorFormModel(nextModel, { notify });
  }

  function handleJsonInput(jsonText = "") {
    const nextState = inputFormStateFromJsonText(jsonText, currentFormModel());
    formModelStateStore.set(nextState.formModel);
    formErrorStateStore.set(txInputText(nextState.formError));
    jsonTextStateStore.set(txInputText(jsonText));
    return nextState;
  }

  function selectEditorView(nextView = "") {
    editorDisplayModeStateStore.set(nextView === "json" ? "json" : "form");
  }

  function ensureInitialized() {
    if (initialized) return;
    refreshFromFormModel();
    initialized = true;
  }

  function reset() {
    initialized = false;
    setEditorState(
      {
        formError: "",
        formModel: buildDefaultFormModel(),
      },
      formModelToJsonText(buildDefaultFormModel()),
    );
    editorDisplayModeStateStore.set("form");
    loadingKeysStore.set([]);
  }

  return {
    changeFormModel,
    editorDisplayModeStateStore,
    ensureInitialized,
    formErrorStateStore,
    formModelStateStore,
    handleJsonInput,
    jsonTextStateStore,
    loadingKeysStore,
    refreshFromFormModel,
    reset,
    runLoading: (loadingKey, operation) =>
      loadingRunner.run(loadingKey, operation),
    selectEditorView,
  };
}

export function createTxInputPanelActionWorkspace(
  txInputWorkspace,
  dependencies = {},
) {
  async function createJsonDraft() {
    const result = await txInputWorkspace.runLoading("json-new", () =>
      callOptionalTxDependency(dependencies, "onCreateJsonTemplateDraft"),
    );
    txInputWorkspace.refreshFromFormModel();
    return result;
  }

  async function createTemplateDraft() {
    const result = await callOptionalTxDependency(
      dependencies,
      "onCreateJsonTemplateDraft",
    );
    txInputWorkspace.refreshFromFormModel();
    return result;
  }

  async function createDirectDraft() {
    const result = await callOptionalTxDependency(
      dependencies,
      "onCreateDirectDraft",
    );
    txInputWorkspace.refreshFromFormModel();
    return result;
  }

  function handleEditorJsonInput(jsonText = "") {
    callOptionalTxDependency(dependencies, "onEditorInput", jsonText);
    txInputWorkspace.handleJsonInput(jsonText);
  }

  async function importFile(file) {
    const result = await callOptionalTxDependency(
      dependencies,
      "onImportFile",
      file,
    );
    txInputWorkspace.refreshFromFormModel();
    return result;
  }

  async function loadJsonTemplate(templateName = "") {
    const result = await callOptionalTxDependency(
      dependencies,
      "onLoadJsonTemplate",
      templateName,
    );
    txInputWorkspace.refreshFromFormModel();
    return result;
  }

  function selectMode(txExecutionMode = "") {
    return runTxExecutionModeHandler(
      txExecutionMode,
      () => callOptionalTxDependency(dependencies, "onDirectMode"),
      () => callOptionalTxDependency(dependencies, "onTemplateMode"),
    );
  }

  return {
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
