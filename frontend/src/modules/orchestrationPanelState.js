import { derived, get, writable } from "svelte/store";
import {
  createLazyComponentRegistry,
  createLoadingRunner,
} from "../lib/svelte.js";
import { currentLanguageState, t } from "../lib/i18n.js";
import { dashboardState } from "./dashboardApp.js";
import { createOrchestratedWorkspace } from "./orchestratedWorkspace.js";
import { executionModeOptionsVersion } from "./profiles.js";
import {
  orchestrationInputPanelDisplay,
  orchestrationEditorRunButtonDisplayPresentation,
  orchestrationStageDisplay,
} from "./orchestrationFormDisplayState.js";
import {
  orchestrationExecutionPanelDisplay,
  orchestrationStageExecutionDisplayPresentation,
  orchestrationStagePreviewDisplay,
  orchestrationStageJobsPanelDisplay,
} from "./orchestrationResultState.js";
import {
  jsonTemplateSelectValue,
  orchestrationPreviewState,
  orchestrationResultState,
  runTxExecutionModeHandler,
  transactionOutputState,
  TX_OUTPUT,
  TX_VISUAL,
  txExecutionModes,
  visualOutputState,
} from "./transactionsWorkspace.js";

export {
  createOrchestrationEditorPanelWorkspace,
  orchestrationEditorDisplays,
  orchestrationJsonPlaceholder,
} from "./orchestrationEditorState.js";

function orchestrationStagePresentation(stage = "") {
  const normalized =
    stage === "workflow" || stage === "orchestrate" ? stage : "block";
  return {
    blockActive: normalized === "block",
    newButtonLabelKey:
      normalized === "workflow" ? "txWorkflowAddBlockBtn" : "newBtn",
    orchestrationActive: normalized === "orchestrate",
    titleText: t(
      normalized === "workflow"
        ? "txStageWorkflow"
        : normalized === "orchestrate"
          ? "txStageOrchestrate"
          : "txStageBlock",
    ),
    workflowActive: normalized === "workflow",
  };
}

const orchestratedPagePresentation = (shellState = {}) =>
  orchestrationStagePresentation(shellState.currentTxStage);

const orchestratedRouteState = derived(dashboardState, (state) => ({
  currentTheme: state.currentTheme || "dark",
  currentTxStage: state.currentTxStage || "block",
}));

const orchestratedExecutionModeOptionsVersion = executionModeOptionsVersion;

export const orchestrationVarsPlaceholder =
  'plan vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

export const orchestrationTemplateVarsPlaceholder =
  'plan template vars JSON (optional), e.g. {"peer_host":"edge94.host"}';

function normalizeOptionalHandler(handler) {
  return typeof handler === "function" ? handler : null;
}

export function createOrchestrationInputPanelWorkspace(inputState = {}) {
  const dependencyState = {
    onCreateJsonTemplateDraft: normalizeOptionalHandler(
      inputState.onCreateJsonTemplateDraft,
    ),
    onDirectMode: normalizeOptionalHandler(inputState.onDirectMode),
    onExecute: normalizeOptionalHandler(inputState.onExecute),
    onImportFile: normalizeOptionalHandler(inputState.onImportFile),
    onLoadJsonTemplate: normalizeOptionalHandler(inputState.onLoadJsonTemplate),
    onPreview: normalizeOptionalHandler(inputState.onPreview),
    onTemplateMode: normalizeOptionalHandler(inputState.onTemplateMode),
  };
  const loadingKeysStore = writable([]);
  const editorSyncVersionStateStore = writable(0);
  const inputDisplayStateStore = derived(
    [txExecutionModes, currentLanguageState],
    ([$txExecutionModes, _currentLanguageState]) =>
      orchestrationInputPanelDisplay($txExecutionModes),
  );
  const orchestrationEditorRunButtonDisplayStateStore = derived(
    loadingKeysStore,
    (loadingKeys) =>
      orchestrationEditorRunButtonDisplayPresentation({
        createLoading: loadingKeys.includes("json-new"),
        executeLoading: loadingKeys.includes("execute"),
        previewLoading: loadingKeys.includes("preview"),
      }),
  );
  const loadingRunner = createLoadingRunner(
    () => get(loadingKeysStore),
    (nextKeys) => loadingKeysStore.set(Array.isArray(nextKeys) ? nextKeys : []),
  );

  function bumpEditorSyncVersion() {
    editorSyncVersionStateStore.update((version) => Number(version || 0) + 1);
  }

  function createJsonDraft() {
    return loadingRunner.run(
      "json-new",
      dependencyState.onCreateJsonTemplateDraft,
    );
  }

  async function createTemplateDraft() {
    const result =
      typeof dependencyState.onCreateJsonTemplateDraft === "function"
        ? await dependencyState.onCreateJsonTemplateDraft()
        : undefined;
    bumpEditorSyncVersion();
    return result;
  }

  function executeOrchestration() {
    return loadingRunner.run("execute", dependencyState.onExecute);
  }

  function importFile(file) {
    return typeof dependencyState.onImportFile === "function"
      ? dependencyState.onImportFile(file)
      : undefined;
  }

  function selectMode(txExecutionMode = "") {
    return runTxExecutionModeHandler(
      txExecutionMode,
      dependencyState.onDirectMode,
      dependencyState.onTemplateMode,
    );
  }

  async function loadJsonTemplate(templateName) {
    const result =
      typeof dependencyState.onLoadJsonTemplate === "function"
        ? await dependencyState.onLoadJsonTemplate(templateName)
        : undefined;
    bumpEditorSyncVersion();
    return result;
  }

  function previewOrchestration() {
    return loadingRunner.run("preview", dependencyState.onPreview);
  }

  return {
    createJsonDraft,
    createTemplateDraft,
    editorSyncVersionStateStore,
    executeOrchestration,
    importFile,
    inputDisplayStateStore,
    loadJsonTemplate,
    loadingKeysStore,
    orchestrationEditorRunButtonDisplayStateStore,
    previewOrchestration,
    selectMode,
    setInputPanelContext(nextInputState = {}) {
      if ("onCreateJsonTemplateDraft" in nextInputState) {
        dependencyState.onCreateJsonTemplateDraft = normalizeOptionalHandler(
          nextInputState.onCreateJsonTemplateDraft,
        );
      }
      if ("onDirectMode" in nextInputState) {
        dependencyState.onDirectMode = normalizeOptionalHandler(
          nextInputState.onDirectMode,
        );
      }
      if ("onExecute" in nextInputState) {
        dependencyState.onExecute = normalizeOptionalHandler(
          nextInputState.onExecute,
        );
      }
      if ("onImportFile" in nextInputState) {
        dependencyState.onImportFile = normalizeOptionalHandler(
          nextInputState.onImportFile,
        );
      }
      if ("onLoadJsonTemplate" in nextInputState) {
        dependencyState.onLoadJsonTemplate = normalizeOptionalHandler(
          nextInputState.onLoadJsonTemplate,
        );
      }
      if ("onPreview" in nextInputState) {
        dependencyState.onPreview = normalizeOptionalHandler(
          nextInputState.onPreview,
        );
      }
      if ("onTemplateMode" in nextInputState) {
        dependencyState.onTemplateMode = normalizeOptionalHandler(
          nextInputState.onTemplateMode,
        );
      }
    },
  };
}

export function createOrchestrationStageDetailPanelWorkspace() {
  const jobsPanelDisplayStateStore = derived(
    currentLanguageState,
    (_currentLanguageState) => orchestrationStageJobsPanelDisplay(),
  );

  return {
    jobsPanelDisplayStateStore,
  };
}

export function createOrchestrationStageWorkspace() {
  const activeStateStore = writable(false);
  const orchestrationPlanStatusStateStore = transactionOutputState(
    TX_OUTPUT.orchestrationPlan,
  );
  const orchestrationPreviewFallbackStateStore = visualOutputState(
    TX_VISUAL.orchestrationPreview,
  );
  const orchestrationExecutionFallbackStateStore = transactionOutputState(
    TX_OUTPUT.orchestrationExec,
  );
  const stageDisplayStateStore = derived(
    [currentLanguageState, orchestrationPlanStatusStateStore],
    ([_language, $planStatus]) => orchestrationStageDisplay($planStatus),
  );
  let lastPreviewDisplay = orchestrationStagePreviewDisplay({
    preview: { inventory: null, plan: null },
  });
  const previewDisplayStateStore = derived(
    [
      activeStateStore,
      currentLanguageState,
      orchestrationPreviewState,
      orchestrationPreviewFallbackStateStore,
    ],
    ([$active, _language, $previewState, $previewFallbackState]) => {
      if (!$active) {
        return lastPreviewDisplay;
      }
      lastPreviewDisplay = orchestrationStagePreviewDisplay({
        fallback: $previewFallbackState,
        preview: $previewState,
      });
      return lastPreviewDisplay;
    },
  );
  let lastExecutionDisplay = orchestrationStageExecutionDisplayPresentation({
    executionPayload: null,
  });
  const executionDisplayStateStore = derived(
    [
      activeStateStore,
      currentLanguageState,
      orchestrationResultState,
      orchestrationExecutionFallbackStateStore,
    ],
    ([
      $active,
      _language,
      $orchestrationResultState,
      $executionFallbackState,
    ]) => {
      if (!$active) {
        return lastExecutionDisplay;
      }
      const orchestrationExecutionPayload =
        $orchestrationResultState == null ? null : $orchestrationResultState;
      lastExecutionDisplay = orchestrationStageExecutionDisplayPresentation({
        executionFallback: $executionFallbackState,
        executionPayload: orchestrationExecutionPayload,
      });
      return lastExecutionDisplay;
    },
  );
  const executionPanelDisplayStateStore = derived(
    [executionDisplayStateStore, currentLanguageState],
    ([$executionDisplayStateStore, _currentLanguageState]) =>
      orchestrationExecutionPanelDisplay($executionDisplayStateStore),
  );

  return {
    executionDisplayStateStore,
    executionPanelDisplayStateStore,
    previewDisplayStateStore,
    setStageContext({ active = false } = {}) {
      activeStateStore.set(!!active);
    },
    stageDisplayStateStore,
  };
}

function orchestratedActiveStageDefinition(
  stageDisplay = {},
  stageDefinitions = [],
) {
  if (!Array.isArray(stageDefinitions) || stageDefinitions.length === 0) {
    return null;
  }
  if (stageDisplay.blockActive) return stageDefinitions[0] || null;
  if (stageDisplay.workflowActive) return stageDefinitions[1] || null;
  return stageDefinitions[2] || stageDefinitions[0] || null;
}

export function createOrchestratedPageWorkspace({
  afterDomUpdate = null,
  stageDefinitions = [],
} = {}) {
  const orchestratedWorkspace = createOrchestratedWorkspace({
    afterDomUpdate,
  });
  const stageRegistry = createLazyComponentRegistry();
  const routeSyncStateStore = derived(
    [
      currentLanguageState,
      orchestratedExecutionModeOptionsVersion,
      orchestratedRouteState,
      txExecutionModes,
    ],
    ([
      $currentLanguageState,
      $orchestratedExecutionModeOptionsVersion,
      $orchestratedRouteState,
      $txExecutionModes,
    ]) => ({
      language: $currentLanguageState,
      modeOptionsVersion: $orchestratedExecutionModeOptionsVersion,
      routeState: $orchestratedRouteState,
      txModes: $txExecutionModes,
    }),
  );
  const stageDisplayStateStore = derived(
    [currentLanguageState, orchestratedRouteState],
    ([_language, $routeState]) => orchestratedPagePresentation($routeState),
  );
  const activeStageDefinitionStateStore = derived(
    stageDisplayStateStore,
    ($stageDisplay) =>
      orchestratedActiveStageDefinition($stageDisplay, stageDefinitions),
  );
  const activeStageComponentStateStore = derived(
    [stageRegistry.components, activeStageDefinitionStateStore],
    ([$loadedStageComponents, $activeStageDefinition]) =>
      $activeStageDefinition
        ? $loadedStageComponents[$activeStageDefinition.id]
        : null,
  );
  let templatesLoadedForRun = false;
  let lastLanguage = "";
  let lastModeOptionsVersion = 0;
  let workspaceInitialized = false;

  function setPageContext({ active = false } = {}) {
    if (!active) {
      if (workspaceInitialized) {
        orchestratedWorkspace.destroy();
        workspaceInitialized = false;
      }
      templatesLoadedForRun = false;
      lastLanguage = "";
      lastModeOptionsVersion = 0;
      return;
    }

    const { language, modeOptionsVersion, routeState, txModes } =
      get(routeSyncStateStore);

    if (!workspaceInitialized) {
      orchestratedWorkspace.init();
      workspaceInitialized = true;
    }
    if (!templatesLoadedForRun) {
      templatesLoadedForRun = true;
      void orchestratedWorkspace.loadTemplates();
    }
    orchestratedWorkspace.applyOrchestratedEditorLayout({
      active,
      modes: txModes,
      shellState: routeState,
    });
    orchestratedWorkspace.applyOrchestratedEditorTheme(routeState);
    if (lastLanguage !== language) {
      lastLanguage = language;
      orchestratedWorkspace.refreshOrchestratedLanguageFields(
        routeState,
        txModes,
      );
    }
    if (lastModeOptionsVersion !== modeOptionsVersion) {
      lastModeOptionsVersion = modeOptionsVersion;
      orchestratedWorkspace.refreshTxWorkflowBuilder();
    }
    const activeStageDefinition = get(activeStageDefinitionStateStore);
    if (activeStageDefinition) {
      void stageRegistry.ensure(activeStageDefinition);
    }
  }

  function destroy() {
    orchestratedWorkspace.destroy();
    templatesLoadedForRun = false;
    lastLanguage = "";
    lastModeOptionsVersion = 0;
    workspaceInitialized = false;
  }

  return {
    ...orchestratedWorkspace,
    activeStageComponentStateStore,
    destroy,
    setPageContext,
    stageDisplayStateStore,
  };
}
