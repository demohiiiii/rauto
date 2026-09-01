import { derived as deriveStore, writable } from "svelte/store";
import { currentLanguageState } from "../../../lib/i18n.js";
import { orchestrationDetailRuntime } from "../infrastructure/orchestrationDetailRuntime.js";
import { orchestrationExecutionDetailAt } from "../presentation/orchestrationResultDetailState.js";
import {
  orchestrationJsonDisplay,
  orchestrationPreviewPresentation,
} from "../presentation/orchestrationResultPreviewState.js";

interface JsonSectionContext {
  jsonValue?: unknown;
}

interface PreviewPanelContext {
  plan?: unknown;
  previewMode?: unknown;
}

interface ExecutionPanelContext {
  panelDisplay?: unknown;
}

interface ExecutionDetailCallbacks {
  onOpenStageDetail?: ((stageIndex: number) => unknown) | null;
  onOpenTargetDetail?:
    | ((stageIndex: number, jobIndex: number, targetIndex: number) => unknown)
    | null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function integerOr(value: unknown, fallback = 0): number {
  return Number.isInteger(value) ? (value as number) : fallback;
}

function orchestrationOutputModePresentation(mode: unknown = "") {
  return {
    showResult: mode === "result",
    showStatus: mode === "status",
    showText: mode === "text",
  };
}

export function createOrchestrationJsonSectionWorkspace({
  jsonValue = null,
}: JsonSectionContext = {}) {
  const jsonValueStateStore = writable<unknown>(jsonValue);
  const orchestrationJsonSectionDisplayStateStore = deriveStore(
    [jsonValueStateStore, currentLanguageState],
    ([$jsonValueStateStore]) => orchestrationJsonDisplay($jsonValueStateStore),
  );
  return {
    orchestrationJsonSectionDisplayStateStore,
    setJsonValue(nextJsonValue: unknown = null): void {
      jsonValueStateStore.set(nextJsonValue);
    },
  };
}

export function createOrchestrationPreviewPanelWorkspace({
  plan = null,
  previewMode = "",
}: PreviewPanelContext = {}) {
  const planStateStore = writable<unknown>(plan);
  const previewModeStateStore = writable<unknown>(previewMode);
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

function openOrchestrationExecutionDetail(executionDetail: unknown = null) {
  const detail = objectValue(executionDetail);
  if (!Object.keys(detail).length) return;
  void orchestrationDetailRuntime.openDetail({
    detailPayload: objectValue(detail.detail),
    kind: "orchestrationDetail",
    title: String(detail.titleText || ""),
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
    openStageDetail(): unknown {
      return typeof onOpenStageDetail === "function"
        ? onOpenStageDetail(stageIndex)
        : undefined;
    },
    openTargetDetailHandler(
      stageJobIndex: unknown = 0,
      targetIndex: unknown = 0,
    ) {
      return (): unknown =>
        typeof onOpenTargetDetail === "function"
          ? onOpenTargetDetail(
              stageIndex,
              integerOr(stageJobIndex),
              integerOr(targetIndex),
            )
          : undefined;
    },
  };
}

function orchestrationExecutionPanelCallbacks(resultDisplay: unknown = {}) {
  const display = objectValue(resultDisplay);
  function openStageDetail(stageIndex: unknown = 0): void {
    const normalizedStageIndex = integerOr(stageIndex);
    openOrchestrationExecutionDetail(
      orchestrationExecutionDetailAt(display.detailIndex, normalizedStageIndex),
    );
  }

  function openTargetDetail(
    stageIndex: unknown = 0,
    jobIndex: unknown = 0,
    targetIndex: unknown = 0,
  ): void {
    openOrchestrationExecutionDetail(
      orchestrationExecutionDetailAt(
        display.detailIndex,
        integerOr(stageIndex),
        integerOr(jobIndex),
        integerOr(targetIndex),
      ),
    );
  }

  return {
    openStageDetail,
    openTargetDetail,
    stagePanelCallbacks(stageIndex: unknown = 0) {
      return orchestrationExecutionStagePanelCallbacks(integerOr(stageIndex), {
        onOpenStageDetail: openStageDetail,
        onOpenTargetDetail: openTargetDetail,
      });
    },
  };
}

export function createOrchestrationExecutionPanelWorkspace({
  panelDisplay = null,
}: ExecutionPanelContext = {}) {
  const panelDisplayStateStore = writable<unknown>(panelDisplay);
  const resultDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      objectValue($panelDisplayStateStore).resultDisplay || {},
  );
  const statusDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      objectValue($panelDisplayStateStore).statusDisplay || {},
  );
  const executionModeDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      objectValue($panelDisplayStateStore).executionModeDisplay || {},
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
