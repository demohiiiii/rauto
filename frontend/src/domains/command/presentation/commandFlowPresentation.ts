import { t } from "../../../lib/i18n.js";
import type {
  CommandFlowReadonlyDisplay,
  CommandFlowReadonlyPromptDisplay,
  CommandFlowReadonlyStepDisplay,
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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const textValue = (value: unknown): string =>
  value == null ? "" : String(value);

const translatedBoolean = (
  value: boolean,
  translate: CommandTranslate,
): string => translate(value ? "enabled" : "disabled");

function promptPresentation(
  value: unknown = {},
  promptIndex = 0,
  translate: CommandTranslate = t,
): CommandFlowReadonlyPromptDisplay {
  const prompt = record(value);
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

function stepPresentation(
  value: unknown = {},
  stepIndex = 0,
  translate: CommandTranslate = t,
): CommandFlowReadonlyStepDisplay {
  const step = record(value);
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

export function commandFlowReadonlyPresentation(
  value: unknown = {},
  translate: CommandTranslate = t,
): CommandFlowReadonlyDisplay {
  const model = record(value);
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
