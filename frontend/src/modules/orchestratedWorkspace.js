import { tr as translate } from "../lib/i18n.js";
import { getDashboardState } from "./dashboardApp.js";
import {
  clearTxJsonEditorsHost,
  createJsonTemplateLibrary,
  createTxJsonEditorsHost,
  getLastOrchestrationPreview,
  refreshOrchestrationPreview,
  refreshOrchestrationResult,
  refreshTxBlockPreview,
  refreshTxVarsAssistants,
  requireTxJsonEditor,
  setOrchestrationPreview,
  setTxBlockVisual,
  setTxExecutionModes,
  setTxWorkflowPreview,
  setVisualOutputStatus,
  setupTxVarsAssistants,
  updateJsonTemplateSelectOptions,
  updateOrchestrationPreviewFromEditor,
  updateTxWorkflowPreviewFromEditor,
  getTxExecutionModes,
  jsonTemplateSelectValue,
  setErrorStatus,
  setJsonTemplateSelectValue,
  setNamedStatus,
  setRunningStatus,
  setStatus,
  TX_EDITOR,
  TX_OUTPUT,
  TX_TEMPLATE_KIND,
} from "./transactionPanelState.js";
import {
  createOrchestratedExecutionDependencies,
  defaultOrchestrationTemplatePayload,
  defaultTxBlockTemplatePayload,
  defaultTxWorkflowTemplatePayload,
  jsonTemplateConfigFor,
  orchestratedExecutionOperations,
} from "./orchestratedExecutionState.js";

function tr(key, fallback = key) {
  return translate(key, fallback);
}

function defaultAfterDomUpdate(afterDomUpdateHandler) {
  if (typeof afterDomUpdateHandler === "function") {
    afterDomUpdateHandler();
  }
}

function callObjectFunction(target, name, ...args) {
  return typeof target?.[name] === "function"
    ? target[name](...args)
    : undefined;
}

function normalizeTransactionKey(rawKey, validKeys, fallback = "") {
  const key =
    rawKey == null ? "" : typeof rawKey === "string" ? rawKey : String(rawKey);
  const normalized = key.trim();
  if (!normalized) return fallback;
  return validKeys.has(normalized) ? normalized : fallback || normalized;
}

export function createOrchestratedWorkspace(workspaceCfg = {}) {
  const afterDomUpdate =
    typeof workspaceCfg.afterDomUpdate === "function"
      ? workspaceCfg.afterDomUpdate
      : defaultAfterDomUpdate;
  const txEditorKeys = new Set(Object.values(TX_EDITOR));

  let txJsonEditorsPromise = null;
  let txJsonEditors = null;
  let txJsonEditorsHost = null;
  let deactivateJsonTemplateLibrary = null;
  let lastEditorTheme = "";
  let lastTxModeSnapshot = null;

  function buildTxBlockTemplatePayloadFromEditor() {
    return requireTxJsonEditor("parseTxBlockEditorJson")();
  }

  function resizeActiveTxSharedEditor() {
    if ((getDashboardState().currentTxStage || "block") === "block") {
      callObjectFunction(txJsonEditors, "resizeTxBlockJsonEditor");
    }
  }

  function refreshTxWorkflowBuilder() {
    resizeActiveTxSharedEditor();
  }

  function setTxMode(modes) {
    setTxExecutionModes(modes);
  }

  function applyTxEditorTheme(theme) {
    callObjectFunction(txJsonEditors, "setTxBlockJsonEditorTheme", theme);
    callObjectFunction(txJsonEditors, "setTxWorkflowJsonEditorTheme", theme);
    callObjectFunction(txJsonEditors, "setOrchestrationJsonEditorTheme", theme);
  }

  function applyTxWorkflowExecutionModeLayout(modes = getTxExecutionModes()) {
    if (modes.txWorkflow !== "direct") return;
    afterDomUpdate(() => {
      callObjectFunction(txJsonEditors, "resizeTxWorkflowJsonEditor");
    });
  }

  function applyTxBlockExecutionModeLayout() {
    afterDomUpdate(resizeActiveTxSharedEditor);
  }

  function applyOrchestrationExecutionModeLayout() {
    afterDomUpdate(() => {
      callObjectFunction(txJsonEditors, "resizeOrchestrationJsonEditor");
    });
  }

  function applyTxStageExecutionModeLayout(
    currentTxStage = getDashboardState().currentTxStage,
    modes = getTxExecutionModes(),
  ) {
    const isBlock = currentTxStage === "block";
    const isWorkflow = currentTxStage === "workflow";
    const isOrchestrate = currentTxStage === "orchestrate";
    if (isBlock || isWorkflow) {
      applyTxBlockExecutionModeLayout();
    }
    if (isWorkflow) {
      applyTxWorkflowExecutionModeLayout(modes);
    }
    if (isOrchestrate) {
      applyOrchestrationExecutionModeLayout();
    }
    afterDomUpdate(resizeActiveTxSharedEditor);
  }

  function applyTxModeChange(
    previousState,
    nextState,
    modes = getTxExecutionModes(),
  ) {
    if (!previousState) {
      applyTxStageExecutionModeLayout(nextState.stage, modes);
      return;
    }
    if (previousState.stage !== nextState.stage) {
      applyTxStageExecutionModeLayout(nextState.stage, modes);
      return;
    }
    if (previousState.txBlock !== nextState.txBlock) {
      applyTxBlockExecutionModeLayout();
    }
    if (previousState.txWorkflow !== nextState.txWorkflow) {
      applyTxWorkflowExecutionModeLayout(modes);
    }
    if (previousState.orchestration !== nextState.orchestration) {
      applyOrchestrationExecutionModeLayout();
    }
  }

  function txModeSnapshot(
    shellState = getDashboardState(),
    modes = getTxExecutionModes(),
  ) {
    return {
      orchestration: modes.orchestration,
      stage: shellState.currentTxStage,
      txBlock: modes.txBlock,
      txWorkflow: modes.txWorkflow,
    };
  }

  function applyOrchestratedEditorLayout({
    active: pageActive = false,
    modes = getTxExecutionModes(),
    shellState = getDashboardState(),
  } = {}) {
    const nextState = txModeSnapshot(shellState, modes);
    if (!pageActive) {
      lastTxModeSnapshot = nextState;
      return;
    }

    void ensureEditors(shellState, modes);
    const previous = lastTxModeSnapshot;
    lastTxModeSnapshot = nextState;
    applyTxModeChange(previous, nextState, modes);
  }

  function applyEditorThemeFromDashboardState(dashboard = getDashboardState()) {
    const theme = dashboard.currentTheme || "dark";
    if (theme === lastEditorTheme) return;
    lastEditorTheme = theme;
    applyTxEditorTheme(theme);
  }

  function applyOrchestratedEditorTheme(shellState = getDashboardState()) {
    applyEditorThemeFromDashboardState(shellState);
  }

  function updateTxWorkflowPreviewFromCurrentEditor(text = null) {
    if (text != null) {
      callObjectFunction(txJsonEditors, "setTxWorkflowEditorRawText", text);
    }
    updateTxWorkflowPreviewFromEditor(txJsonEditors);
  }

  function updateOrchestrationPreviewFromCurrentEditor(text = null) {
    if (text != null) {
      callObjectFunction(txJsonEditors, "setOrchestrationEditorRawText", text);
    }
    updateOrchestrationPreviewFromEditor(txJsonEditors);
  }

  function getJsonTemplateEditorContext() {
    return {
      buildTxBlockTemplatePayloadFromEditor,
      editors: txJsonEditors,
      refreshTxWorkflowBuilder,
      updateOrchestrationPreviewFromEditor:
        updateOrchestrationPreviewFromCurrentEditor,
      updateTxWorkflowPreviewFromEditor:
        updateTxWorkflowPreviewFromCurrentEditor,
    };
  }

  function refreshTxVisuals() {
    const lastOrchestrationPreview = getLastOrchestrationPreview();
    refreshTxBlockPreview();
    updateTxWorkflowPreviewFromCurrentEditor();
    if (lastOrchestrationPreview?.plan) {
      refreshOrchestrationPreview();
      refreshOrchestrationResult();
    } else {
      updateOrchestrationPreviewFromCurrentEditor();
    }
  }

  const jsonTemplateLibrary = createJsonTemplateLibrary({
    configFor: jsonTemplateConfigFor,
    getEditorContext: getJsonTemplateEditorContext,
    getSelectedName: jsonTemplateSelectValue,
    normalizeEditorKey: (editorKey) =>
      normalizeTransactionKey(editorKey, txEditorKeys),
    setErrorStatus,
    setExecutionModes: setTxExecutionModes,
    setNamedStatus,
    setRunningStatus,
    setSelectedName: setJsonTemplateSelectValue,
    setStatus,
    tr,
    txEditor: TX_EDITOR,
    txTemplateKind: TX_TEMPLATE_KIND,
    updateOptions: updateJsonTemplateSelectOptions,
  });

  const txExecutionDependencies = createOrchestratedExecutionDependencies({
    setOrchestrationPreview,
    setTxBlockVisual,
    setTxWorkflowPreview,
    setVisualOutputStatus,
    updateOrchestrationPreviewFromEditor:
      updateOrchestrationPreviewFromCurrentEditor,
    updateTxWorkflowPreviewFromEditor: updateTxWorkflowPreviewFromCurrentEditor,
  });

  async function ensureEditors(
    shellState = getDashboardState(),
    modes = getTxExecutionModes(),
  ) {
    if (!txJsonEditorsPromise) {
      txJsonEditorsPromise = initializeTxJsonEditors(shellState, modes);
    }
    return txJsonEditorsPromise;
  }

  async function initializeTxJsonEditors(shellState, modes) {
    try {
      txJsonEditors = createTxJsonEditorsHost({
        orchestrationDefaultJsonText: JSON.stringify(
          defaultOrchestrationTemplatePayload(),
          null,
          2,
        ),
        txBlockDefaultJsonText: JSON.stringify(
          defaultTxBlockTemplatePayload(),
          null,
          2,
        ),
        txBlockJsonInvalidShapeMessage: tr("txBlockJsonInvalidShape"),
        txBlockJsonRequiredMessage: tr("txBlockJsonRequired"),
        txWorkflowDefaultJsonText: JSON.stringify(
          defaultTxWorkflowTemplatePayload(),
          null,
          2,
        ),
      });
      txJsonEditorsHost = txJsonEditors;
      if (!txJsonEditors.txWorkflowEditorRaw().trim()) {
        txJsonEditors.setTxWorkflowEditorJson(
          defaultTxWorkflowTemplatePayload(),
        );
      }
      if (!txJsonEditors.txBlockEditorRaw().trim()) {
        txJsonEditors.setTxBlockEditorJson(defaultTxBlockTemplatePayload());
      }
      if (!txJsonEditors.orchestrationEditorRaw().trim()) {
        txJsonEditors.setOrchestrationEditorJson(
          defaultOrchestrationTemplatePayload(),
        );
      }
      txJsonEditors.setupTxWorkflowJsonEditor();
      txJsonEditors.setupTxBlockJsonEditor();
      txJsonEditors.setupOrchestrationJsonEditor();
      applyTxEditorTheme(shellState.currentTheme || "dark");
      applyTxStageExecutionModeLayout(shellState.currentTxStage, modes);
      setupTxVarsAssistants();
    } catch (error) {
      txJsonEditorsPromise = null;
      throw error;
    }
  }

  function init() {
    if (!deactivateJsonTemplateLibrary) {
      deactivateJsonTemplateLibrary = jsonTemplateLibrary.activate();
    }
  }

  function destroy() {
    if (typeof deactivateJsonTemplateLibrary === "function") {
      deactivateJsonTemplateLibrary();
    }
    clearTxJsonEditorsHost();
    txJsonEditorsPromise = null;
    txJsonEditors = null;
    txJsonEditorsHost = null;
    deactivateJsonTemplateLibrary = null;
    lastEditorTheme = "";
    lastTxModeSnapshot = null;
  }

  async function loadTemplates() {
    await jsonTemplateLibrary.loadAllJsonTemplates();
  }

  function refreshOrchestratedLanguageFields(
    shellState = getDashboardState(),
    modes = getTxExecutionModes(),
  ) {
    refreshTxVarsAssistants();
    jsonTemplateLibrary.refreshAllJsonTemplateOptions();
    jsonTemplateLibrary.refreshAllJsonTemplateLists();
    refreshTxVisuals();
    applyTxStageExecutionModeLayout(shellState.currentTxStage, modes);
  }

  async function runTxBlock(mode, dryRun, output) {
    const executionActions = orchestratedExecutionOperations({
      dependencies: txExecutionDependencies,
      txJsonEditorsHost,
    });
    try {
      await executionActions.runTxBlock(mode, dryRun, output);
    } catch (error) {
      setErrorStatus(output, error);
      setVisualOutputStatus("txBlockPreview", error.message, "error");
    }
  }

  async function importTxWorkflowFile(file) {
    const executionActions = orchestratedExecutionOperations({
      dependencies: txExecutionDependencies,
      txJsonEditorsHost,
    });
    try {
      await executionActions.importTxWorkflowFile(file);
    } catch (error) {
      setErrorStatus(TX_OUTPUT.txWorkflowPlan, error);
    }
  }

  async function importOrchestrationFile(file) {
    const executionActions = orchestratedExecutionOperations({
      dependencies: txExecutionDependencies,
      txJsonEditorsHost,
    });
    try {
      await executionActions.importOrchestrationFile(file);
    } catch (error) {
      setErrorStatus(TX_OUTPUT.orchestrationPlan, error);
    }
  }

  function jsonTemplateStageBindings(kind) {
    return {
      onCreateJsonTemplateDraft: () =>
        jsonTemplateLibrary.createTemplateDraft(kind),
      onDeleteJsonTemplate: () =>
        jsonTemplateLibrary.deleteTemplateFromExecution(kind),
      onLoadJsonTemplate: (name) =>
        jsonTemplateLibrary.loadTemplateIntoEditor(kind, name),
      onSaveJsonTemplate: () =>
        jsonTemplateLibrary.saveTemplateFromExecution(kind),
    };
  }

  const txBlockJsonTemplateStageProps = jsonTemplateStageBindings(
    TX_TEMPLATE_KIND.txBlock,
  );
  const txWorkflowJsonTemplateStageProps = jsonTemplateStageBindings(
    TX_TEMPLATE_KIND.txWorkflow,
  );
  const orchestrationJsonTemplateStageProps = jsonTemplateStageBindings(
    TX_TEMPLATE_KIND.orchestration,
  );

  const runOrchestrationExecute = () =>
    orchestratedExecutionOperations({
      dependencies: txExecutionDependencies,
      txJsonEditorsHost,
    }).executeOrchestration();
  const runTxWorkflowExecute = () =>
    orchestratedExecutionOperations({
      dependencies: txExecutionDependencies,
      txJsonEditorsHost,
    }).executeTxWorkflow();
  const runOrchestrationPreview = () =>
    orchestratedExecutionOperations({
      dependencies: txExecutionDependencies,
      txJsonEditorsHost,
    }).previewOrchestration();
  const runTxWorkflowPreview = () =>
    orchestratedExecutionOperations({
      dependencies: txExecutionDependencies,
      txJsonEditorsHost,
    }).previewTxWorkflow();

  return {
    applyEditorTheme: applyTxEditorTheme,
    applyModeChange: applyTxModeChange,
    applyOrchestratedEditorLayout,
    applyOrchestratedEditorTheme,
    createJsonTemplateDraft: jsonTemplateLibrary.createTemplateDraft,
    createOrchestrationJsonTemplateDraft:
      orchestrationJsonTemplateStageProps.onCreateJsonTemplateDraft,
    createTxBlockJsonTemplateDraft:
      txBlockJsonTemplateStageProps.onCreateJsonTemplateDraft,
    createTxWorkflowJsonTemplateDraft:
      txWorkflowJsonTemplateStageProps.onCreateJsonTemplateDraft,
    deleteJsonTemplateFromExecution:
      jsonTemplateLibrary.deleteTemplateFromExecution,
    deleteOrchestrationJsonTemplate:
      orchestrationJsonTemplateStageProps.onDeleteJsonTemplate,
    deleteTxBlockJsonTemplate:
      txBlockJsonTemplateStageProps.onDeleteJsonTemplate,
    deleteTxWorkflowJsonTemplate:
      txWorkflowJsonTemplateStageProps.onDeleteJsonTemplate,
    destroy,
    ensureEditors,
    executeOrchestration: runOrchestrationExecute,
    executeTxWorkflow: runTxWorkflowExecute,
    importOrchestrationFile,
    importTxWorkflowFile,
    init,
    loadJsonTemplateIntoEditor: jsonTemplateLibrary.loadTemplateIntoEditor,
    loadOrchestrationJsonTemplate:
      orchestrationJsonTemplateStageProps.onLoadJsonTemplate,
    loadTemplates,
    loadTxBlockJsonTemplate: txBlockJsonTemplateStageProps.onLoadJsonTemplate,
    loadTxWorkflowJsonTemplate:
      txWorkflowJsonTemplateStageProps.onLoadJsonTemplate,
    previewOrchestration: runOrchestrationPreview,
    previewTxWorkflow: runTxWorkflowPreview,
    refreshOrchestratedLanguageFields,
    refreshTxWorkflowBuilder,
    runTxBlockDirectExecute: () =>
      runTxBlock("direct", false, TX_OUTPUT.txBlockExec),
    runTxBlockDirectPlan: () =>
      runTxBlock("direct", true, TX_OUTPUT.txBlockPlan),
    runTxBlockTemplateExecute: () =>
      runTxBlock("template", false, TX_OUTPUT.txBlockExec),
    runTxBlockTemplatePlan: () =>
      runTxBlock("template", true, TX_OUTPUT.txBlockPlan),
    saveJsonTemplateFromExecution:
      jsonTemplateLibrary.saveTemplateFromExecution,
    saveOrchestrationJsonTemplate:
      orchestrationJsonTemplateStageProps.onSaveJsonTemplate,
    saveTxBlockJsonTemplate: txBlockJsonTemplateStageProps.onSaveJsonTemplate,
    saveTxWorkflowJsonTemplate:
      txWorkflowJsonTemplateStageProps.onSaveJsonTemplate,
    setMode: setTxMode,
    setOrchestrationDirectMode: () => setTxMode({ orchestration: "direct" }),
    setOrchestrationTemplateMode: () =>
      setTxMode({ orchestration: "template" }),
    setTxBlockDirectMode: () => setTxMode({ txBlock: "direct" }),
    setTxBlockTemplateMode: () => setTxMode({ txBlock: "template" }),
    setTxWorkflowDirectMode: () => setTxMode({ txWorkflow: "direct" }),
    setTxWorkflowTemplateMode: () => setTxMode({ txWorkflow: "template" }),
    updateOrchestrationEditorInput: updateOrchestrationPreviewFromCurrentEditor,
    updateTxBlockEditorInput: (text) => {
      if (text != null) {
        callObjectFunction(txJsonEditors, "setTxBlockEditorRawText", text);
      }
    },
    updateTxWorkflowEditorInput: updateTxWorkflowPreviewFromCurrentEditor,
  };
}
