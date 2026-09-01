import { transactionFallbackDisplay } from "$domains/transactions/index.js";
import { orchestrationExecutionPresentation } from "./orchestrationResultDetailState.js";

interface StagePreviewDisplayOptions {
  fallback?: unknown;
  preview?: unknown;
}

interface StageExecutionDisplayOptions {
  executionFallback?: unknown;
  executionPayload?: unknown;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function orchestrationOutputModePresentation(mode: unknown = "") {
  return {
    showResult: mode === "result",
    showStatus: mode === "status",
    showText: mode === "text",
  };
}

const orchestrationStageExecutionDisplay = (
  result: unknown = {},
  message: unknown = "",
  mode: unknown = "empty",
  text: unknown = "",
  tone: unknown = "info",
) => ({ result, status: { message, mode, text, tone } });

export function orchestrationStagePreviewDisplay({
  fallback = null,
  preview = {},
}: StagePreviewDisplayOptions = {}) {
  const fallbackDisplay = transactionFallbackDisplay(fallback);
  const previewValue = objectValue(preview);
  let previewMode = "preview";
  let previewText = "";
  let previewMessage = "";
  let previewTone = "info";
  const previewPlan = previewValue.plan ?? null;

  if (fallbackDisplay) {
    previewMode = fallbackDisplay.mode;
    previewText = fallbackDisplay.text;
    previewMessage = fallbackDisplay.message;
    previewTone = fallbackDisplay.tone;
  }

  return {
    message: previewMessage,
    plan: previewPlan,
    previewMode,
    text: previewText,
    tone: previewTone,
  };
}

export function orchestrationStageExecutionDisplayPresentation({
  executionFallback = null,
  executionPayload = null,
}: StageExecutionDisplayOptions = {}) {
  const executionFallbackDisplay =
    transactionFallbackDisplay(executionFallback);
  let executionMode = executionPayload ? "result" : "empty";
  let executionText = "";
  let executionMessage = "";
  let executionTone = "info";
  let effectiveExecutionPayload = executionPayload ?? null;

  if (executionFallbackDisplay) {
    executionMode = executionFallbackDisplay.mode;
    executionText = executionFallbackDisplay.text;
    executionMessage = executionFallbackDisplay.message;
    executionTone = executionFallbackDisplay.tone;
    effectiveExecutionPayload = null;
  }

  return orchestrationStageExecutionDisplay(
    orchestrationExecutionPresentation(effectiveExecutionPayload),
    executionMessage,
    executionMode,
    executionText,
    executionTone,
  );
}

export function orchestrationExecutionPanelDisplay(
  executionDisplay: unknown = {},
) {
  const display = objectValue(executionDisplay);
  const emptyResultDisplay = {
    detailIndex: { stageDetails: [], targetDetails: [] },
    emptyMessage: "",
    hasResult: false,
    hasStageRows: false,
    requestFailedMessage: "",
    resultTitle: "",
    stageCountSummaryText: "0/0",
    stageCountText: "0/0",
    stageRows: [],
    summaryCards: [],
  };
  const emptyStatusDisplay = {
    message: "",
    mode: "empty",
    text: "",
    tone: "info",
  };
  const statusDisplay = objectValue(display.status);
  const effectiveStatusDisplay = Object.keys(statusDisplay).length
    ? statusDisplay
    : emptyStatusDisplay;
  const resultDisplay = objectValue(display.result);
  return {
    executionModeDisplay: orchestrationOutputModePresentation(
      effectiveStatusDisplay.mode,
    ),
    resultDisplay: Object.keys(resultDisplay).length
      ? resultDisplay
      : emptyResultDisplay,
    statusDisplay: effectiveStatusDisplay,
  };
}
