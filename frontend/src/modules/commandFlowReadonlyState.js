import { t } from "../lib/i18n.js";

const textValue = (value) => (value == null ? "" : String(value));
const translatedBoolean = (value, translate) =>
  translate(value ? "enabled" : "disabled");

function promptPresentation(prompt = {}, promptIndex = 0, translate = t) {
  return {
    appendNewlineLabelText: translate("commandFlowAppendNewline"),
    appendNewlineText: translatedBoolean(!!prompt.appendNewline, translate),
    patternRows: Array.isArray(prompt.patterns)
      ? prompt.patterns.map(textValue)
      : [],
    patternsLabelText: translate("commandFlowPromptPatterns"),
    recordInputLabelText: translate("commandFlowRecordInput"),
    recordInputText: translatedBoolean(!!prompt.recordInput, translate),
    responseLabelText: translate("commandFlowPromptResponse"),
    responseText: textValue(prompt.response),
    titleText: `${translate("commandFlowPrompts")} ${promptIndex + 1}`,
  };
}

function stepPresentation(step = {}, stepIndex = 0, translate = t) {
  const inheritedText = translate("commandFlowReadonlyInherited");
  return {
    commandLabelText: translate("txBlockFormCommand"),
    commandText: textValue(step.command),
    multilineModeLabelText: translate("commandMultilineMode"),
    multilineModeText: translate(
      step.multilineMode === "whole"
        ? "commandMultilineModeWhole"
        : "commandMultilineModeSplitLines",
    ),
    modeLabelText: translate("txBlockFormMode"),
    modeText: step.hasMode ? textValue(step.mode) || "-" : inheritedText,
    promptRows: Array.isArray(step.prompts)
      ? step.prompts.map((prompt, promptIndex) =>
          promptPresentation(prompt, promptIndex, translate),
        )
      : [],
    timeoutLabelText: translate("txBlockFormTimeout"),
    timeoutText: step.hasTimeoutSecs
      ? `${textValue(step.timeoutSecs ?? 0)}s`
      : inheritedText,
    titleText: `${translate("txBlockFormFlowStep")} ${stepIndex + 1}`,
  };
}

export function commandFlowReadonlyPresentation(model = {}, translate = t) {
  const steps = Array.isArray(model.steps) ? model.steps : [];
  return {
    emptyText: translate("txBlockFormFlowStepsEmpty"),
    hasSteps: steps.length > 0,
    nameLabelText: translate("txBlockFormTemplateName"),
    nameText: textValue(model.name) || "-",
    stepRows: steps.map((step, stepIndex) =>
      stepPresentation(step, stepIndex, translate),
    ),
    stepsTitleText: translate("txBlockFormFlowSteps"),
    summaryRows: [
      {
        labelText: translate("txBlockFormDefaultMode"),
        valueText: model.hasDefaultMode
          ? textValue(model.defaultMode) || "-"
          : translate("commandFlowReadonlyInherited"),
      },
      {
        labelText: translate("txBlockFormStopOnError"),
        valueText: translatedBoolean(model.stopOnError !== false, translate),
      },
      {
        labelText: translate("txBlockFormFlowSteps"),
        valueText: String(steps.length),
      },
    ],
  };
}
