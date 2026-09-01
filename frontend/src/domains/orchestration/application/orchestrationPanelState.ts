import { derived, get, writable } from "svelte/store";
import {
  createLazyComponentRegistry,
  createLoadingRunner,
} from "../../../lib/svelte.js";
import { currentLanguageState } from "../../../lib/i18n.js";
import { dashboardState } from "$domains/dashboard/index.js";
import { createOrchestratedWorkspace } from "./orchestratedWorkspace.js";
import { executionModeOptionsVersion } from "$domains/profiles/index.js";
import { orchestrationEditorRunButtonDisplayPresentation } from "../presentation/orchestrationFormStructureState.js";
import {
  orchestrationExecutionPanelDisplay,
  orchestrationStageExecutionDisplayPresentation,
  orchestrationStagePreviewDisplay,
} from "../presentation/orchestrationResultDisplayState.js";
import { orchestrationStageJobsPanelDisplay } from "../presentation/orchestrationResultDetailState.js";
import {
  orchestratedActiveStageDefinition,
  orchestratedPagePresentation,
} from "../presentation/orchestrationPanelDisplayState.js";
import type { OrchestratedStageDefinition } from "../presentation/orchestrationPanelDisplayState.js";
import {
  orchestrationPreviewState,
  orchestrationResultState,
  transactionOutputState,
  TX_OUTPUT,
  TX_VISUAL,
  txExecutionModes,
  visualOutputState,
} from "$domains/transactions/index.js";

type OptionalHandler = (...args: unknown[]) => unknown;

interface ExternalActionContext {
  isCurrent?: () => boolean;
}

interface OrchestrationInputPanelContext {
  onCreateJsonTemplateDraft?: unknown;
  onExecute?: unknown;
  onImportFile?: unknown;
  onLoadJsonTemplate?: unknown;
  onPreview?: unknown;
}

interface OrchestratedPageWorkspaceInput {
  afterDomUpdate?: unknown;
  stageDefinitions?: readonly OrchestratedStageDefinition[];
}

const orchestratedRouteState = derived(dashboardState, (state) => ({
  currentTheme: state.currentTheme || "dark",
  currentTxStage: state.currentTxStage || "block",
}));

const orchestratedExecutionModeOptionsVersion = executionModeOptionsVersion;

function normalizeOptionalHandler(handler: unknown): OptionalHandler | null {
  return typeof handler === "function" ? (handler as OptionalHandler) : null;
}

export function createOrchestrationInputPanelWorkspace(
  inputState: OrchestrationInputPanelContext = {},
) {
  const dependencyState = {
    onCreateJsonTemplateDraft: normalizeOptionalHandler(
      inputState.onCreateJsonTemplateDraft,
    ),
    onExecute: normalizeOptionalHandler(inputState.onExecute),
    onImportFile: normalizeOptionalHandler(inputState.onImportFile),
    onLoadJsonTemplate: normalizeOptionalHandler(inputState.onLoadJsonTemplate),
    onPreview: normalizeOptionalHandler(inputState.onPreview),
  };
  const loadingKeysStore = writable<string[]>([]);
  const editorSyncVersionStateStore = writable(0);
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
    (nextKeys: unknown) =>
      loadingKeysStore.set(Array.isArray(nextKeys) ? nextKeys.map(String) : []),
  );

  function bumpEditorSyncVersion() {
    editorSyncVersionStateStore.update((version) => Number(version || 0) + 1);
  }

  function createJsonDraft(actionContext: ExternalActionContext | null = null) {
    return loadingRunner.run("json-new", () =>
      typeof dependencyState.onCreateJsonTemplateDraft === "function"
        ? dependencyState.onCreateJsonTemplateDraft(actionContext)
        : undefined,
    );
  }

  function executeOrchestration() {
    return loadingRunner.run("execute", dependencyState.onExecute);
  }

  function importFile(
    file: unknown,
    actionContext: ExternalActionContext | null = null,
  ) {
    return typeof dependencyState.onImportFile === "function"
      ? dependencyState.onImportFile(file, actionContext)
      : undefined;
  }

  async function loadJsonTemplate(
    templateName: unknown,
    actionContext: ExternalActionContext | null = null,
  ) {
    const result =
      typeof dependencyState.onLoadJsonTemplate === "function"
        ? await dependencyState.onLoadJsonTemplate(templateName, actionContext)
        : undefined;
    if (
      typeof actionContext?.isCurrent !== "function" ||
      actionContext.isCurrent()
    ) {
      bumpEditorSyncVersion();
    }
    return result;
  }

  function previewOrchestration() {
    return loadingRunner.run("preview", dependencyState.onPreview);
  }

  return {
    createJsonDraft,
    editorSyncVersionStateStore,
    executeOrchestration,
    importFile,
    loadJsonTemplate,
    loadingKeysStore,
    orchestrationEditorRunButtonDisplayStateStore,
    previewOrchestration,
    setInputPanelContext(nextInputState: OrchestrationInputPanelContext = {}) {
      if ("onCreateJsonTemplateDraft" in nextInputState) {
        dependencyState.onCreateJsonTemplateDraft = normalizeOptionalHandler(
          nextInputState.onCreateJsonTemplateDraft,
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
  const orchestrationPreviewFallbackStateStore = visualOutputState(
    TX_VISUAL.orchestrationPreview,
  );
  const orchestrationExecutionFallbackStateStore = transactionOutputState(
    TX_OUTPUT.orchestrationExec,
  );
  let lastPreviewDisplay = orchestrationStagePreviewDisplay({
    preview: { plan: null },
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
    setStageContext({ active = false }: { active?: unknown } = {}) {
      activeStateStore.set(!!active);
    },
  };
}

export function createOrchestratedPageWorkspace({
  afterDomUpdate = null,
  stageDefinitions = [],
}: OrchestratedPageWorkspaceInput = {}) {
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
        ? (
            Object.assign({}, $loadedStageComponents) as Record<string, unknown>
          )[$activeStageDefinition.id]
        : null,
  );
  let templatesLoadedForRun = false;
  let lastLanguage = "";
  let lastModeOptionsVersion = 0;
  let workspaceInitialized = false;

  function setPageContext({ active = false }: { active?: unknown } = {}) {
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
