import { tr as translate } from "../../../lib/i18n.js";
import { getDashboardState } from "$domains/dashboard/index.js";
import type { DashboardState } from "$domains/dashboard/index.js";
import {
  clearTxJsonEditorsHost,
  createJsonTemplateLibrary,
  createTxJsonEditorsHost,
  defaultTxBlockTemplatePayload,
  defaultTxWorkflowTemplatePayload,
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
} from "$domains/transactions/index.js";
import {
  createOrchestratedExecutionDependencies,
  jsonTemplateConfigFor,
  orchestratedExecutionOperations,
} from "./orchestratedExecutionState.js";
import { defaultOrchestrationTemplatePayload } from "../model/orchestratedExecutionPayloads.js";

type AfterDomUpdate = (handler: () => void) => void | (() => void);
type TxExecutionModes = ReturnType<typeof getTxExecutionModes>;
type TxJsonEditors = ReturnType<typeof createTxJsonEditorsHost>;
type DashboardEditorState = Pick<
  DashboardState,
  "currentTheme" | "currentTxStage"
>;
type ExecutionOperations = ReturnType<typeof orchestratedExecutionOperations>;
type JsonTemplateLibrary = ReturnType<typeof createJsonTemplateLibrary>;
type JsonTemplateActionContext = Parameters<
  JsonTemplateLibrary["createTemplateDraft"]
>[1];
type TextFile = Parameters<ExecutionOperations["importTxBlockFile"]>[0];
type ExternalActionContext = Parameters<
  ExecutionOperations["importTxBlockFile"]
>[1];

interface OrchestratedWorkspaceConfig {
  afterDomUpdate?: AfterDomUpdate | null;
}

interface TxModeSnapshot {
  orchestration: string;
  stage: string;
  txBlock: string;
  txWorkflow: string;
}

interface OrchestratedEditorLayoutInput {
  active?: boolean;
  modes?: TxExecutionModes;
  shellState?: DashboardEditorState;
}

const errorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String(error.message)
    : String(error || "");

function tr(key: string, fallback = key): string {
  return translate(key, fallback);
}

function defaultAfterDomUpdate(afterDomUpdateHandler: () => void): void {
  if (typeof afterDomUpdateHandler === "function") {
    afterDomUpdateHandler();
  }
}

function externalActionIsCurrent(
  actionContext: ExternalActionContext = null,
): boolean {
  return (
    typeof actionContext?.isCurrent !== "function" || actionContext.isCurrent()
  );
}

function normalizeTransactionKey(
  rawKey: string,
  validKeys: ReadonlySet<string>,
  fallback = "",
): string {
  const normalized = rawKey.trim();
  if (!normalized) return fallback;
  return validKeys.has(normalized) ? normalized : fallback || normalized;
}

export function createOrchestratedWorkspace(
  workspaceCfg: OrchestratedWorkspaceConfig = {},
) {
  const afterDomUpdate = workspaceCfg.afterDomUpdate ?? defaultAfterDomUpdate;
  const txEditorKeys: ReadonlySet<string> = new Set(Object.values(TX_EDITOR));

  let txJsonEditorsPromise: Promise<void> | null = null;
  let txJsonEditors: TxJsonEditors | null = null;
  let txJsonEditorsHost: TxJsonEditors | null = null;
  let deactivateJsonTemplateLibrary: (() => void) | null = null;
  let lastEditorTheme = "";
  let lastTxModeSnapshot: TxModeSnapshot | null = null;

  function buildTxBlockTemplatePayloadFromEditor() {
    return requireTxJsonEditor("parseTxBlockEditorJson")();
  }

  function resizeActiveTxSharedEditor(): void {
    if ((getDashboardState().currentTxStage || "block") === "block") {
      txJsonEditors?.resizeTxBlockJsonEditor();
    }
  }

  function refreshTxWorkflowBuilder(): void {
    resizeActiveTxSharedEditor();
  }

  function setTxMode(modes: Partial<TxExecutionModes>): void {
    setTxExecutionModes(modes);
  }

  function applyTxEditorTheme(
    theme: DashboardEditorState["currentTheme"],
  ): void {
    txJsonEditors?.setTxBlockJsonEditorTheme(theme);
    txJsonEditors?.setTxWorkflowJsonEditorTheme(theme);
    txJsonEditors?.setOrchestrationJsonEditorTheme(theme);
  }

  function applyTxWorkflowExecutionModeLayout(
    modes: TxExecutionModes = getTxExecutionModes(),
  ): void {
    if (modes.txWorkflow !== "direct") return;
    afterDomUpdate(() => {
      txJsonEditors?.resizeTxWorkflowJsonEditor();
    });
  }

  function applyTxBlockExecutionModeLayout(): void {
    afterDomUpdate(resizeActiveTxSharedEditor);
  }

  function applyOrchestrationExecutionModeLayout(): void {
    afterDomUpdate(() => {
      txJsonEditors?.resizeOrchestrationJsonEditor();
    });
  }

  function applyTxStageExecutionModeLayout(
    currentTxStage = getDashboardState().currentTxStage,
    modes: TxExecutionModes = getTxExecutionModes(),
  ): void {
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
    previousState: TxModeSnapshot | null,
    nextState: TxModeSnapshot,
    modes: TxExecutionModes = getTxExecutionModes(),
  ): void {
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
    shellState: DashboardEditorState = getDashboardState(),
    modes: TxExecutionModes = getTxExecutionModes(),
  ): TxModeSnapshot {
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
  }: OrchestratedEditorLayoutInput = {}): void {
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

  function applyEditorThemeFromDashboardState(
    dashboard: DashboardEditorState = getDashboardState(),
  ): void {
    const theme = dashboard.currentTheme || "dark";
    if (theme === lastEditorTheme) return;
    lastEditorTheme = theme;
    applyTxEditorTheme(theme);
  }

  function applyOrchestratedEditorTheme(
    shellState: DashboardEditorState = getDashboardState(),
  ): void {
    applyEditorThemeFromDashboardState(shellState);
  }

  function updateTxWorkflowPreviewFromCurrentEditor(
    text: string | null = null,
  ): void {
    if (text != null) {
      txJsonEditors?.setTxWorkflowEditorRawText(text);
    }
    updateTxWorkflowPreviewFromEditor(txJsonEditors);
  }

  function updateOrchestrationPreviewFromCurrentEditor(
    text: string | null = null,
  ): void {
    if (text != null) {
      txJsonEditors?.setOrchestrationEditorRawText(text);
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

  function refreshTxVisuals(): void {
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
    normalizeEditorKey: (editorKey: string) =>
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
    shellState: DashboardEditorState = getDashboardState(),
    modes: TxExecutionModes = getTxExecutionModes(),
  ): Promise<void> {
    if (!txJsonEditorsPromise) {
      txJsonEditorsPromise = initializeTxJsonEditors(shellState, modes);
    }
    return txJsonEditorsPromise;
  }

  async function initializeTxJsonEditors(
    shellState: DashboardEditorState,
    modes: TxExecutionModes,
  ): Promise<void> {
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

  function init(): void {
    if (!deactivateJsonTemplateLibrary) {
      deactivateJsonTemplateLibrary =
        typeof jsonTemplateLibrary.activate === "function"
          ? jsonTemplateLibrary.activate()
          : null;
    }
  }

  function destroy(): void {
    if (typeof deactivateJsonTemplateLibrary === "function") {
      deactivateJsonTemplateLibrary();
    }
    clearTxJsonEditorsHost(txJsonEditorsHost);
    txJsonEditorsPromise = null;
    txJsonEditors = null;
    txJsonEditorsHost = null;
    deactivateJsonTemplateLibrary = null;
    lastEditorTheme = "";
    lastTxModeSnapshot = null;
  }

  async function loadTemplates(): Promise<void> {
    await jsonTemplateLibrary.loadAllJsonTemplates();
  }

  function refreshOrchestratedLanguageFields(
    shellState: DashboardEditorState = getDashboardState(),
    modes: TxExecutionModes = getTxExecutionModes(),
  ): void {
    refreshTxVarsAssistants();
    jsonTemplateLibrary.refreshAllJsonTemplateOptions();
    jsonTemplateLibrary.refreshAllJsonTemplateLists();
    refreshTxVisuals();
    applyTxStageExecutionModeLayout(shellState.currentTxStage, modes);
  }

  async function runTxBlock(dryRun: boolean, output: string): Promise<void> {
    const executionActions = orchestratedExecutionOperations({
      dependencies: txExecutionDependencies,
      txJsonEditorsHost,
    });
    try {
      await executionActions.runTxBlock(dryRun, output);
    } catch (error) {
      setErrorStatus(output, error);
      setVisualOutputStatus("txBlockPreview", errorMessage(error), "error");
    }
  }

  async function importTxWorkflowFile(
    file: TextFile,
    actionContext: ExternalActionContext = null,
  ): Promise<void> {
    const executionActions = orchestratedExecutionOperations({
      dependencies: txExecutionDependencies,
      txJsonEditorsHost,
    });
    try {
      await executionActions.importTxWorkflowFile(file, actionContext);
    } catch (error) {
      if (externalActionIsCurrent(actionContext)) {
        setErrorStatus(TX_OUTPUT.txWorkflowPlan, error);
      }
    }
  }

  async function importTxBlockFile(
    file: TextFile,
    actionContext: ExternalActionContext = null,
  ): Promise<void> {
    const executionActions = orchestratedExecutionOperations({
      dependencies: txExecutionDependencies,
      txJsonEditorsHost,
    });
    try {
      await executionActions.importTxBlockFile(file, actionContext);
    } catch (error) {
      if (externalActionIsCurrent(actionContext)) {
        setErrorStatus(TX_OUTPUT.txBlockPlan, error);
      }
    }
  }

  async function importOrchestrationFile(
    file: TextFile,
    actionContext: ExternalActionContext = null,
  ): Promise<void> {
    const executionActions = orchestratedExecutionOperations({
      dependencies: txExecutionDependencies,
      txJsonEditorsHost,
    });
    try {
      await executionActions.importOrchestrationFile(file, actionContext);
    } catch (error) {
      if (externalActionIsCurrent(actionContext)) {
        setErrorStatus(TX_OUTPUT.orchestrationPlan, error);
      }
    }
  }

  function jsonTemplateStageBindings(kind: string) {
    return {
      onCreateJsonTemplateDraft: (actionContext: JsonTemplateActionContext) =>
        jsonTemplateLibrary.createTemplateDraft(kind, actionContext),
      onDeleteJsonTemplate: () =>
        jsonTemplateLibrary.deleteTemplateFromExecution(kind),
      onLoadJsonTemplate: (
        name: string,
        actionContext: JsonTemplateActionContext,
      ) =>
        jsonTemplateLibrary.loadTemplateIntoEditor(kind, name, actionContext),
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
    deleteTxBlockJsonTemplate:
      txBlockJsonTemplateStageProps.onDeleteJsonTemplate,
    deleteTxWorkflowJsonTemplate:
      txWorkflowJsonTemplateStageProps.onDeleteJsonTemplate,
    destroy,
    ensureEditors,
    executeOrchestration: runOrchestrationExecute,
    executeTxWorkflow: runTxWorkflowExecute,
    importOrchestrationFile,
    importTxBlockFile,
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
    runTxBlockExecute: () => runTxBlock(false, TX_OUTPUT.txBlockExec),
    saveJsonTemplateFromExecution:
      jsonTemplateLibrary.saveTemplateFromExecution,
    saveTxBlockJsonTemplate: txBlockJsonTemplateStageProps.onSaveJsonTemplate,
    saveTxWorkflowJsonTemplate:
      txWorkflowJsonTemplateStageProps.onSaveJsonTemplate,
    setMode: setTxMode,
    updateOrchestrationEditorInput: updateOrchestrationPreviewFromCurrentEditor,
    updateTxBlockEditorInput: (text: string | null) => {
      if (text != null) {
        txJsonEditors?.setTxBlockEditorRawText(text);
      }
    },
    updateTxWorkflowEditorInput: updateTxWorkflowPreviewFromCurrentEditor,
  };
}
