import { derived as deriveStore, writable } from "svelte/store";
import { currentLanguageState } from "../../../lib/i18n.js";
import { orchestrationDetailRuntime } from "../infrastructure/orchestrationDetailRuntime.js";
import type {
  OrchestrationExecutionDetailEntry,
  OrchestrationJsonValue,
  OrchestrationPlan,
} from "../model/types.js";
import { orchestrationExecutionDetailAt } from "../presentation/orchestrationResultDetailState.js";
import { orchestrationExecutionPanelDisplay } from "../presentation/orchestrationResultDisplayState.js";
import {
  orchestrationJsonDisplay,
  orchestrationPreviewPresentation,
} from "../presentation/orchestrationResultPreviewState.js";

interface JsonSectionContext {
  jsonValue?: OrchestrationJsonValue;
}

interface PreviewPanelContext {
  plan?: OrchestrationPlan | null;
  previewMode?: string;
}

interface ExecutionPanelContext {
  panelDisplay?: OrchestrationExecutionPanelDisplay | null;
}

interface ExecutionDetailCallbacks {
  onOpenStageDetail?: ((stageIndex: number) => void) | null;
  onOpenTargetDetail?:
    | ((stageIndex: number, jobIndex: number, targetIndex: number) => void)
    | null;
}

type OrchestrationExecutionPanelDisplay = ReturnType<
  typeof orchestrationExecutionPanelDisplay
>;

type OrchestrationExecutionResultDisplay =
  OrchestrationExecutionPanelDisplay["resultDisplay"];

function orchestrationOutputModePresentation(mode = "") {
  return {
    showResult: mode === "result",
    showStatus: mode === "status",
    showText: mode === "text",
  };
}

export function createOrchestrationJsonSectionWorkspace({
  jsonValue = null,
}: JsonSectionContext = {}) {
  const jsonValueStateStore = writable<OrchestrationJsonValue>(jsonValue);
  const orchestrationJsonSectionDisplayStateStore = deriveStore(
    [jsonValueStateStore, currentLanguageState],
    ([$jsonValueStateStore]) => orchestrationJsonDisplay($jsonValueStateStore),
  );
  return {
    orchestrationJsonSectionDisplayStateStore,
    setJsonValue(nextJsonValue: OrchestrationJsonValue = null): void {
      jsonValueStateStore.set(nextJsonValue);
    },
  };
}

export function createOrchestrationPreviewPanelWorkspace({
  plan = null,
  previewMode = "",
}: PreviewPanelContext = {}) {
  const planStateStore = writable<OrchestrationPlan | null>(plan);
  const previewModeStateStore = writable<string>(previewMode);
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
    }: PreviewPanelContext = {}): void {
      planStateStore.set(nextPlan);
      previewModeStateStore.set(nextPreviewMode);
    },
  };
}

function openOrchestrationExecutionDetail(
  executionDetail: OrchestrationExecutionDetailEntry | null = null,
): void {
  if (!executionDetail) return;
  void orchestrationDetailRuntime.openDetail({
    detailPayload: { ...executionDetail.detail },
    kind: "orchestrationDetail",
    title: executionDetail.titleText,
  });
}

function orchestrationExecutionStagePanelCallbacks(
  stageIndex = 0,
  {
    onOpenStageDetail = null,
    onOpenTargetDetail = null,
  }: ExecutionDetailCallbacks = {},
) {
  return {
    openStageDetail(): void {
      onOpenStageDetail?.(stageIndex);
    },
    openTargetDetailHandler(stageJobIndex = 0, targetIndex = 0) {
      return (): void => {
        onOpenTargetDetail?.(stageIndex, stageJobIndex, targetIndex);
      };
    },
  };
}

function orchestrationExecutionPanelCallbacks(
  resultDisplay: OrchestrationExecutionResultDisplay,
) {
  function openStageDetail(stageIndex = 0): void {
    openOrchestrationExecutionDetail(
      orchestrationExecutionDetailAt(resultDisplay.detailIndex, stageIndex),
    );
  }

  function openTargetDetail(
    stageIndex = 0,
    jobIndex = 0,
    targetIndex = 0,
  ): void {
    openOrchestrationExecutionDetail(
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
}: ExecutionPanelContext = {}) {
  const panelDisplayStateStore =
    writable<OrchestrationExecutionPanelDisplay | null>(panelDisplay);
  const resultDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      ($panelDisplayStateStore ?? orchestrationExecutionPanelDisplay())
        .resultDisplay,
  );
  const statusDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      ($panelDisplayStateStore ?? orchestrationExecutionPanelDisplay())
        .statusDisplay,
  );
  const executionModeDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      ($panelDisplayStateStore ?? orchestrationExecutionPanelDisplay())
        .executionModeDisplay,
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
    setExecutionPanelContext({
      panelDisplay: nextPanelDisplay = null,
    }: ExecutionPanelContext = {}): void {
      panelDisplayStateStore.set(nextPanelDisplay);
    },
    statusDisplayStateStore,
  };
}
