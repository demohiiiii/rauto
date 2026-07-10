import {
  TX_EXECUTION_MODE,
  normalizeTxExecutionMode,
} from "../config/dashboardModes.js";
import { t } from "../lib/i18n.js";
import { displayText } from "../lib/ui.js";

export * from "./orchestrationFormStructureState.js";

function orchestrationText(displaySource) {
  return displayText(displaySource);
}

function orchestrationOutputModePresentation(mode = "") {
  return {
    showResult: mode === "result",
    showStatus: mode === "status",
    showText: mode === "text",
  };
}

function orchestrationExecutionModePresentation(mode = "") {
  const normalizedMode = normalizeTxExecutionMode(mode);
  return {
    isDirect: normalizedMode === TX_EXECUTION_MODE.direct,
    isTemplate: normalizedMode === TX_EXECUTION_MODE.template,
    mode: normalizedMode,
  };
}

function orchestrationOutputStatusDisplay(output = {}) {
  const mode = orchestrationText(output.mode || "");
  return {
    ...orchestrationOutputModePresentation(mode),
    message: orchestrationText(output.message || ""),
    mode,
    tone: output.tone || "info",
  };
}

export const orchestrationInputPanelDisplay = (modes = {}) => ({
  activeMode: orchestrationText(modes.orchestration || ""),
  directHint: t("orchestrationDirectHint"),
  mode: orchestrationExecutionModePresentation(modes.orchestration),
  tabAriaLabel: t("txStageOrchestrate"),
});

export const orchestrationEditorRunButtonDisplayPresentation = (display = {}) =>
  display;

export const orchestrationStageDisplay = (plan = {}) => ({
  planStatus: orchestrationOutputStatusDisplay(plan),
});

export function orchestrationStagesPanelDisplay(visualDisplay = {}) {
  return {
    addStageButtonLabel: t("orchestrationFormAddStage"),
    stageRows: Array.isArray(visualDisplay.stageRows)
      ? visualDisplay.stageRows
      : [],
    titleText: t("orchestrationFormStage"),
  };
}
