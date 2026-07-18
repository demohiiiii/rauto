import { t } from "../lib/i18n.js";

export * from "./orchestrationFormStructureState.js";

export const orchestrationEditorRunButtonDisplayPresentation = (display = {}) =>
  display;

export function orchestrationStagesPanelDisplay(visualDisplay = {}) {
  return {
    addStageButtonLabel: t("orchestrationFormAddStage"),
    stageRows: Array.isArray(visualDisplay.stageRows)
      ? visualDisplay.stageRows
      : [],
    titleText: t("orchestrationFormStage"),
  };
}
