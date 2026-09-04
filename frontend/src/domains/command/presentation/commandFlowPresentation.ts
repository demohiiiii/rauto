import { t } from "../../../lib/i18n.js";
import type {
  CommandFlowReadonlyDisplay,
  CommandFlowReadonlyPromptDisplay,
  CommandFlowReadonlyStepDisplay,
  CommandFlowTemplateModel,
  CommandFlowTemplatePromptModel,
  CommandFlowTemplateStepModel,
  CommandTranslate,
} from "../model/types.js";

const COMMAND_FLOW_ACCENT_COLORS = Object.freeze([
  "oklch(0.63 0.18 157)",
  "oklch(0.67 0.13 220)",
  "oklch(0.72 0.14 85)",
  "oklch(0.67 0.16 35)",
  "oklch(0.62 0.14 285)",
  "oklch(0.68 0.14 340)",
]);

const translatedBoolean = (
  value: boolean,
  translate: CommandTranslate,
): string => translate(value ? "enabled" : "disabled");

function promptPresentation(
  prompt: CommandFlowTemplatePromptModel,
  promptIndex = 0,
  translate: CommandTranslate = t,
): CommandFlowReadonlyPromptDisplay {
  return {
    appendNewlineLabelText: translate("commandFlowAppendNewline"),
    appendNewlineText: translatedBoolean(prompt.appendNewline, translate),
    patternRows: prompt.patterns,
    patternsLabelText: translate("commandFlowPromptPatterns"),
    recordInputLabelText: translate("commandFlowRecordInput"),
    recordInputText: translatedBoolean(prompt.recordInput, translate),
    responseLabelText: translate("commandFlowPromptResponse"),
    responseText: prompt.response,
    titleText: `${translate("commandFlowPrompts")} ${promptIndex + 1}`,
  };
}

function stepPresentation(
  step: CommandFlowTemplateStepModel,
  stepIndex = 0,
  translate: CommandTranslate = t,
): CommandFlowReadonlyStepDisplay {
  const inheritedText = translate("commandFlowReadonlyInherited");
  return {
    commandLabelText: translate("txBlockFormCommand"),
    commandText: step.command,
    multilineModeLabelText: translate("commandMultilineMode"),
    multilineModeText: translate(
      step.multilineMode === "whole"
        ? "commandMultilineModeWhole"
        : "commandMultilineModeSplitLines",
    ),
    modeLabelText: translate("txBlockFormMode"),
    modeText: step.hasMode ? step.mode || "-" : inheritedText,
    promptRows: step.prompts.map((prompt, promptIndex) =>
      promptPresentation(prompt, promptIndex, translate),
    ),
    timeoutLabelText: translate("txBlockFormTimeout"),
    timeoutText: step.hasTimeoutSecs
      ? `${step.timeoutSecs ?? 0}s`
      : inheritedText,
    titleText: `${translate("txBlockFormFlowStep")} ${stepIndex + 1}`,
  };
}

export function commandFlowReadonlyPresentation(
  model: CommandFlowTemplateModel,
  translate: CommandTranslate = t,
): CommandFlowReadonlyDisplay {
  const steps = model.steps;
  return {
    emptyText: translate("txBlockFormFlowStepsEmpty"),
    hasSteps: steps.length > 0,
    nameLabelText: translate("txBlockFormTemplateName"),
    nameText: model.name || "-",
    stepRows: steps.map((step, stepIndex) =>
      stepPresentation(step, stepIndex, translate),
    ),
    stepsTitleText: translate("txBlockFormFlowSteps"),
    summaryRows: [
      {
        labelText: translate("txBlockFormDefaultMode"),
        valueText: model.hasDefaultMode
          ? model.defaultMode || "-"
          : translate("commandFlowReadonlyInherited"),
      },
      {
        labelText: translate("txBlockFormStopOnError"),
        valueText: translatedBoolean(model.stopOnError, translate),
      },
      {
        labelText: translate("txBlockFormFlowSteps"),
        valueText: String(steps.length),
      },
    ],
  };
}

export function commandFlowAccentColor(itemIndex = 0): string {
  const normalizedIndex = Number.isFinite(itemIndex)
    ? Math.trunc(itemIndex)
    : 0;
  const paletteIndex =
    ((normalizedIndex % COMMAND_FLOW_ACCENT_COLORS.length) +
      COMMAND_FLOW_ACCENT_COLORS.length) %
    COMMAND_FLOW_ACCENT_COLORS.length;
  return COMMAND_FLOW_ACCENT_COLORS[paletteIndex];
}
