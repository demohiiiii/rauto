import { transactionFallbackDisplay } from "$domains/transactions/index.js";
import type {
  OrchestrationExecutionResult,
  OrchestrationPlan,
} from "../model/types.js";
import { orchestrationExecutionPresentation } from "./orchestrationResultDetailState.js";

interface StagePreviewDisplayOptions {
  fallback?: unknown;
  preview?: { plan: OrchestrationPlan | null } | null;
}

interface StageExecutionDisplayOptions {
  executionFallback?: unknown;
  executionPayload?: OrchestrationExecutionResult | null;
}

type OrchestrationExecutionPresentation = ReturnType<
  typeof orchestrationExecutionPresentation
>;

interface OrchestrationExecutionStatusDisplay {
  message: string;
  mode: string;
  text: string;
  tone: string;
}

interface OrchestrationStageExecutionDisplay {
  result: OrchestrationExecutionPresentation;
  status: OrchestrationExecutionStatusDisplay;
}

function orchestrationOutputModePresentation(mode = "") {
  return {
    showResult: mode === "result",
    showStatus: mode === "status",
    showText: mode === "text",
  };
}

const orchestrationStageExecutionDisplay = (
  result = orchestrationExecutionPresentation(),
  message = "",
  mode = "empty",
  text = "",
  tone = "info",
): OrchestrationStageExecutionDisplay => ({
  result,
  status: { message, mode, text, tone },
});

export function orchestrationStagePreviewDisplay({
  fallback = null,
  preview = null,
}: StagePreviewDisplayOptions = {}) {
  const fallbackDisplay = transactionFallbackDisplay(fallback);
  let previewMode = "preview";
  let previewText = "";
  let previewMessage = "";
  let previewTone = "info";
  const previewPlan = preview?.plan ?? null;

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
  executionDisplay: OrchestrationStageExecutionDisplay | null = null,
) {
  const statusDisplay = executionDisplay?.status ?? {
    message: "",
    mode: "empty",
    text: "",
    tone: "info",
  };
  return {
    executionModeDisplay: orchestrationOutputModePresentation(
      statusDisplay.mode,
    ),
    resultDisplay:
      executionDisplay?.result ?? orchestrationExecutionPresentation(),
    statusDisplay,
  };
}
