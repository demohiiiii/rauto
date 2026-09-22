import { t } from "../../../lib/i18n.js";
import type {
  InteractiveReadonlyDisplay,
  InteractiveReadonlyPromptDisplay,
  InteractiveReadonlyCommandDisplay,
  InteractiveTemplateModel,
  InteractiveTemplatePromptModel,
  InteractiveCommandModel,
  CommandTranslate,
} from "../model/types.js";

const INTERACTIVE_ACCENT_COLORS = Object.freeze([
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
  prompt: InteractiveTemplatePromptModel,
  promptIndex = 0,
  translate: CommandTranslate = t,
): InteractiveReadonlyPromptDisplay {
  return {
    appendNewlineLabelText: translate("interactiveAppendNewline"),
    appendNewlineText: translatedBoolean(prompt.appendNewline, translate),
    patternRows: prompt.patterns,
    patternsLabelText: translate("interactivePromptPatterns"),
    recordInputLabelText: translate("interactiveRecordInput"),
    recordInputText: translatedBoolean(prompt.recordInput, translate),
    responseLabelText: translate("interactivePromptResponse"),
    responseText: prompt.response,
    titleText: `${translate("interactivePrompts")} ${promptIndex + 1}`,
  };
}

function stepPresentation(
  step: InteractiveCommandModel,
  translate: CommandTranslate = t,
): InteractiveReadonlyCommandDisplay {
  const inheritedText = translate("interactiveReadonlyInherited");
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
    titleText: translate("txBlockFormCommand"),
  };
}

export function interactiveReadonlyPresentation(
  model: InteractiveTemplateModel,
  translate: CommandTranslate = t,
): InteractiveReadonlyDisplay {
  return {
    nameLabelText: translate("txBlockFormTemplateName"),
    nameText: model.name || "-",
    command: stepPresentation(model, translate),
    summaryRows: [
      {
        labelText: translate("txBlockFormMode"),
        valueText: model.hasMode
          ? model.mode || "-"
          : translate("interactiveReadonlyInherited"),
      },
      {
        labelText: translate("txBlockFormTimeout"),
        valueText: model.hasTimeoutSecs
          ? `${model.timeoutSecs ?? 0}s`
          : translate("interactiveReadonlyInherited"),
      },
      {
        labelText: translate("interactivePrompts"),
        valueText: String(model.prompts.length),
      },
    ],
  };
}

export function interactiveAccentColor(itemIndex = 0): string {
  const normalizedIndex = Number.isFinite(itemIndex)
    ? Math.trunc(itemIndex)
    : 0;
  const paletteIndex =
    ((normalizedIndex % INTERACTIVE_ACCENT_COLORS.length) +
      INTERACTIVE_ACCENT_COLORS.length) %
    INTERACTIVE_ACCENT_COLORS.length;
  return INTERACTIVE_ACCENT_COLORS[paletteIndex];
}
