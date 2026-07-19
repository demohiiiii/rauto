import { transactionFallbackDisplay } from "../transactions/transactionExecutionDisplays.js";
import { orchestrationExecutionPresentation } from "./orchestrationResultDetailState.js";

export * from "./orchestrationResultPreviewState.js";
export * from "./orchestrationResultDetailState.js";

function orchestrationOutputModePresentation(mode = "") {
  return {
    showResult: mode === "result",
    showStatus: mode === "status",
    showText: mode === "text",
  };
}

const orchestrationStageExecutionDisplay = (
  result = {},
  message = "",
  mode = "empty",
  text = "",
  tone = "info",
) => ({ result, status: { message, mode, text, tone } });

export function orchestrationStagePreviewDisplay({
  fallback = null,
  preview = {},
} = {}) {
  const fallbackDisplay = transactionFallbackDisplay(fallback);
  let previewMode = "preview";
  let previewText = "";
  let previewMessage = "";
  let previewTone = "info";
  let previewPlan = preview?.plan ?? null;

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
} = {}) {
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

export function orchestrationExecutionPanelDisplay(executionDisplay = {}) {
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
  const statusDisplay = executionDisplay?.status || emptyStatusDisplay;
  return {
    executionModeDisplay: orchestrationOutputModePresentation(
      statusDisplay.mode,
    ),
    resultDisplay: executionDisplay?.result || emptyResultDisplay,
    statusDisplay,
  };
}
