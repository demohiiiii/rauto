import { derived as deriveStore, writable } from "svelte/store";
import { currentLanguageState } from "../../lib/i18n.js";
import {
  orchestrationExecutionDetailAt,
  orchestrationJsonDisplay,
  orchestrationPreviewPresentation,
} from "./orchestrationResultDisplayState.js";

export * from "./orchestrationResultDisplayState.js";

function orchestrationOutputModePresentation(mode = "") {
  return {
    showResult: mode === "result",
    showStatus: mode === "status",
    showText: mode === "text",
  };
}

export function createOrchestrationJsonSectionWorkspace({
  jsonValue = null,
} = {}) {
  const jsonValueStateStore = writable(jsonValue);
  const orchestrationJsonSectionDisplayStateStore = deriveStore(
    [jsonValueStateStore, currentLanguageState],
    ([$jsonValueStateStore]) => orchestrationJsonDisplay($jsonValueStateStore),
  );
  return {
    orchestrationJsonSectionDisplayStateStore,
    setJsonValue(nextJsonValue = null) {
      jsonValueStateStore.set(nextJsonValue);
    },
  };
}

export function createOrchestrationPreviewPanelWorkspace({
  plan = null,
  previewMode = "",
} = {}) {
  const planStateStore = writable(plan);
  const previewModeStateStore = writable(previewMode);
  const previewPresentationStateStore = deriveStore(
    [planStateStore, currentLanguageState],
    ([$planStateStore]) => orchestrationPreviewPresentation($planStateStore),
  );
  const previewModeDisplayStateStore = deriveStore(
    previewModeStateStore,
    ($previewModeStateStore) =>
      orchestrationOutputModePresentation($previewModeStateStore),
  );
  return {
    previewModeDisplayStateStore,
    previewPresentationStateStore,
    setPreviewInputs({
      plan: nextPlan = null,
      previewMode: nextPreviewMode = "",
    } = {}) {
      planStateStore.set(nextPlan);
      previewModeStateStore.set(nextPreviewMode);
    },
  };
}

function openOrchestrationExecutionDetail(executionDetail = null) {
  if (!executionDetail) return;
  const detailConfig = {
    detailPayload: executionDetail.detail,
    kind: "orchestrationDetail",
    title: executionDetail.titleText,
  };
  void openOrchestrationExecutionDetailModal(detailConfig);
}

async function openOrchestrationExecutionDetailModal(detailConfig) {
  const { openDetailModal } = await import("../overlays/overlays.js");
  openDetailModal("", detailConfig);
}

function orchestrationExecutionStagePanelCallbacks(
  stageIndex = 0,
  { onOpenStageDetail = null, onOpenTargetDetail = null } = {},
) {
  return {
    openStageDetail() {
      return typeof onOpenStageDetail === "function"
        ? onOpenStageDetail(stageIndex)
        : undefined;
    },
    openTargetDetailHandler(stageJobIndex = 0, targetIndex = 0) {
      return () =>
        typeof onOpenTargetDetail === "function"
          ? onOpenTargetDetail(stageIndex, stageJobIndex, targetIndex)
          : undefined;
    },
  };
}

function orchestrationExecutionPanelCallbacks(resultDisplay = {}) {
  function openStageDetail(stageIndex = 0) {
    return openOrchestrationExecutionDetail(
      orchestrationExecutionDetailAt(resultDisplay.detailIndex, stageIndex),
    );
  }

  function openTargetDetail(stageIndex = 0, jobIndex = 0, targetIndex = 0) {
    return openOrchestrationExecutionDetail(
      orchestrationExecutionDetailAt(
        resultDisplay.detailIndex,
        stageIndex,
        jobIndex,
        targetIndex,
      ),
    );
  }

  return {
    openStageDetail,
    openTargetDetail,
    stagePanelCallbacks(stageIndex = 0) {
      return orchestrationExecutionStagePanelCallbacks(stageIndex, {
        onOpenStageDetail: openStageDetail,
        onOpenTargetDetail: openTargetDetail,
      });
    },
  };
}

export function createOrchestrationExecutionPanelWorkspace({
  panelDisplay = null,
} = {}) {
  const panelDisplayStateStore = writable(panelDisplay);
  const resultDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => $panelDisplayStateStore?.resultDisplay || {},
  );
  const statusDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => $panelDisplayStateStore?.statusDisplay || {},
  );
  const executionModeDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      $panelDisplayStateStore?.executionModeDisplay || {},
  );
  const executionCallbacksStateStore = deriveStore(
    resultDisplayStateStore,
    ($resultDisplayStateStore) =>
      orchestrationExecutionPanelCallbacks($resultDisplayStateStore),
  );
  return {
    executionCallbacksStateStore,
    executionModeDisplayStateStore,
    panelDisplayStateStore,
    resultDisplayStateStore,
    setExecutionPanelContext({ panelDisplay: nextPanelDisplay = null } = {}) {
      panelDisplayStateStore.set(nextPanelDisplay);
    },
    statusDisplayStateStore,
  };
}
