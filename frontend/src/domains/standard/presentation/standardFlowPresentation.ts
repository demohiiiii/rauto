import {
  normalizeStandardExecMode,
  STANDARD_EXEC_MODE,
} from "../../../config/dashboardModes.js";
import { t } from "../../../lib/i18n.js";
import {
  classNames,
  pillClass,
  safeString,
  selectOptionsWithCurrent,
  workflowChipClass,
} from "../../../lib/ui.js";
import {
  parsedOutputBlockDisplayFromItem,
  parsedOutputSheetsFromParsedOutputItems,
} from "$domains/execution/index.js";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

export function standardPagePresentation(mode: unknown = "") {
  const normalizedMode = normalizeStandardExecMode(safeString(mode));
  return {
    directActive: normalizedMode === STANDARD_EXEC_MODE.direct,
    flowActive: normalizedMode === STANDARD_EXEC_MODE.flow,
    execModeAriaLabel: t("opSectionStandard"),
    hint: t("standardWorkspaceHint"),
    title: t("opCardTitle"),
  };
}

export function standardModeSelectPresentation(modeState: unknown = {}) {
  const state = record(modeState);
  const modeOptions = Array.isArray(state.modes) ? state.modes : [];
  return {
    hasModeOptions: Boolean(modeOptions[0]),
    modeOptions,
    selectedMode: safeString(state.selected),
  };
}

export function standardTextfsmFieldsPresentation({
  enabled = false,
  platformState = {},
  strictErrors = false,
  template = "",
}: {
  enabled?: unknown;
  platformState?: unknown;
  strictErrors?: unknown;
  template?: unknown;
} = {}) {
  const platform = record(platformState);
  return {
    enabled: !!enabled,
    platform: safeString(platform.selected),
    platformOptions: Array.isArray(platform.profiles) ? platform.profiles : [],
    strictErrors: !!strictErrors,
    template: safeString(template),
  };
}

export function standardFlowTemplateSelectPresentation(
  templateState: unknown = {},
) {
  const state = record(templateState);
  return {
    selectedTemplate: safeString(state.selected),
    templateOptions: Array.isArray(state.options) ? state.options : [],
  };
}

export function standardFlowTemplateFieldsPresentation({
  templateName = "",
  templateOptions = [],
}: {
  templateName?: unknown;
  templateOptions?: unknown;
} = {}) {
  return {
    templateName: safeString(templateName),
    templateOptions: Array.isArray(templateOptions) ? templateOptions : [],
  };
}

function standardInputField(value: unknown, placeholder: string) {
  return {
    ariaLabelText: placeholder,
    placeholder,
    value: safeString(value),
  };
}

export function flowExecutionInputPresentation({
  templateName = "",
  templateOptions = [],
}: {
  templateName?: unknown;
  templateOptions?: unknown;
} = {}) {
  const templatePlaceholder = t("flowTemplateRunPlaceholder");
  return {
    builtinSourceLabel: t("flowBuiltinSourceLabel"),
    cancelButtonLabel: t("cancel"),
    customSourceLabel: t("flowCustomSourceLabel"),
    currentDraftLabel: t("flowCurrentDraftLabel"),
    descriptionText: t("flowHint"),
    executeButtonLabel: t("flowExecBtn"),
    nameDialogDescription: t("flowNameDialogDescription"),
    nameDialogNewTitle: t("flowNameDialogNewTitle"),
    nameDialogSaveAsTitle: t("flowNameDialogSaveAsTitle"),
    nameDialogSubmitLabel: t("confirmBtn"),
    newButtonLabel: t("flowNewButton"),
    newSourceLabel: t("flowNewSourceLabel"),
    saveButtonLabel: t("flowTemplateSaveBtn"),
    saveAsButtonLabel: t("flowSaveAsButton"),
    inspectingText: t("flowInspecting"),
    resultsDescriptionText: t("flowResultsHint"),
    resultsTitleText: t("flowResultsTitle"),
    flowStepCountLabel: t("flowStepCountLabel"),
    flowVariableCountLabel: t("flowVariableCountLabel"),
    templateDescriptionText: t("flowTemplateSourceHint"),
    templateField: standardInputField(templateName, templatePlaceholder),
    templateOptionRows: selectOptionsWithCurrent(
      Array.isArray(templateOptions) ? templateOptions : [],
      safeString(templateName),
    ),
    templateTitleText: t("flowTemplateSourceTitle"),
    tomlTabLabel: t("flowTomlTab"),
    tomlFieldLabel: t("flowTomlLabel"),
    tomlFieldHint: t("flowTomlHint"),
    textfsmDescriptionText: t("textfsmParseHint"),
    textfsmTitleText: t("flowTextfsmTitle"),
    visualTabLabel: t("flowVisualTab"),
    workbenchDescriptionText: t("flowWorkbenchHint"),
    workbenchTitleText: t("flowWorkbenchTitle"),
  };
}

export function standardFlowRunButtonPresentation({
  executeLoading = false,
}: { executeLoading?: unknown } = {}) {
  return { executeLoading: !!executeLoading };
}

function standardParsedExecutionRows(executionItems: unknown = []) {
  return (Array.isArray(executionItems) ? executionItems : []).map(
    (executionItemValue, executionRowIndex) => {
      const executionItem = record(executionItemValue);
      const exportItem = executionItemValue || {};
      const success = !!executionItem.success;
      const commandText = safeString(executionItem.command) || "-";
      return {
        cardClass: classNames(
          "rounded-lg border px-3 py-3",
          success
            ? "border-emerald-200 bg-emerald-50"
            : "border-rose-200 bg-rose-50",
        ),
        commandText,
        error: safeString(executionItem.error),
        exitCodeMetaText: `${t("txBlockResultExitCode")}: ${safeString(
          executionItem.exit_code,
        )}`,
        exitCodeText: safeString(executionItem.exit_code),
        exportItem,
        flowBadgeClass: pillClass(
          success
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700",
        ),
        flowRowTitleText: `${executionRowIndex + 1}. ${commandText}`,
        outputText: safeString(
          success
            ? executionItem.output ||
                executionItem.all ||
                executionItem.error ||
                ""
            : executionItem.all ||
                executionItem.output ||
                executionItem.error ||
                "",
        ),
        parsedOutputBlock: parsedOutputBlockDisplayFromItem(
          executionItemValue,
          exportItem,
        ),
        statusLabel: success
          ? t("orchestrationStatusSuccess")
          : t("orchestrationStatusFailed"),
        statusChipClass: workflowChipClass(),
        statusShortText: success ? "OK" : "FAIL",
        statusTextClass: success ? "text-emerald-700" : "text-rose-700",
        stepNumberText: `#${executionRowIndex + 1}`,
        stepIndexClass: classNames(
          "text-xs font-semibold",
          success ? "text-emerald-700" : "text-rose-700",
        ),
        success,
      };
    },
  );
}

function commandFlowParsedOutputSheets(flowResult: UnknownRecord | null) {
  const outputs = Array.isArray(flowResult?.outputs) ? flowResult.outputs : [];
  return parsedOutputSheetsFromParsedOutputItems(outputs, {
    sheetName: (flowOutput: UnknownRecord, index: number) =>
      flowOutput.command || `command_${index + 1}`,
  });
}

export function commandFlowResultPresentation(flowPayload: unknown = null) {
  const flowResult =
    flowPayload &&
    typeof flowPayload === "object" &&
    !Array.isArray(flowPayload)
      ? (flowPayload as UnknownRecord)
      : null;
  const resultSuccess = flowResult?.success === true;
  const resultTemplateName = safeString(flowResult?.template_name || "");
  const resultRows = standardParsedExecutionRows(flowResult?.outputs);
  const exportSheets = commandFlowParsedOutputSheets(flowResult);
  return {
    exportAvailable: exportSheets.length > 0,
    exportButtonLabel: t("textfsmExportAllExcel"),
    hasResult: Boolean(flowResult),
    hasResultRows: resultRows.length > 0,
    resultRows,
    resultSummaryMessage: `${resultSuccess ? t("orchestrationStatusSuccess") : t("orchestrationStatusFailed")} · template=${resultTemplateName || "-"}`,
    resultSummaryTone: resultSuccess ? "success" : "error",
  };
}
