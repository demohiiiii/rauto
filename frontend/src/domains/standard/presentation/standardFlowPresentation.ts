import {
  normalizeStandardExecMode,
  STANDARD_EXEC_MODE,
} from "../../../config/dashboardModes.js";
import type { StandardExecMode } from "../../../config/dashboardModes.js";
import { t } from "../../../lib/i18n.js";
import {
  classNames,
  pillClass,
  safeString,
  selectOptionsWithCurrent,
  workflowChipClass,
} from "../../../lib/ui.js";
import { parsedOutputBlockDisplayFromItem } from "$domains/execution/index.js";
import type {
  ModeSelectState,
  TextfsmPlatformSelectState,
} from "$domains/profiles/index.js";
import type { FlowTemplateSelectState } from "$domains/templates/index.js";
import type {
  StandardCommandFlowExecutionResponse,
  StandardCommandResult,
} from "../model/types.js";

export function standardPagePresentation(mode: StandardExecMode) {
  const normalizedMode = normalizeStandardExecMode(mode);
  return {
    directActive: normalizedMode === STANDARD_EXEC_MODE.direct,
    flowActive: normalizedMode === STANDARD_EXEC_MODE.flow,
    execModeAriaLabel: t("opSectionStandard"),
    hint: t("standardWorkspaceHint"),
    title: t("opCardTitle"),
  };
}

export function standardModeSelectPresentation(modeState: ModeSelectState) {
  const modeOptions = modeState.modes;
  return {
    hasModeOptions: Boolean(modeOptions[0]),
    modeOptions,
    selectedMode: modeState.selected,
  };
}

export function standardTextfsmFieldsPresentation({
  enabled = false,
  platformState,
  strictErrors = false,
  template = "",
}: {
  enabled?: boolean;
  platformState: TextfsmPlatformSelectState;
  strictErrors?: boolean;
  template?: string;
}) {
  return {
    enabled,
    platform: platformState.selected,
    platformOptions: platformState.profiles,
    strictErrors,
    template,
  };
}

export function standardFlowTemplateSelectPresentation(
  templateState: FlowTemplateSelectState,
) {
  return {
    selectedTemplate: templateState.selected,
    templateOptions: templateState.options,
  };
}

export function standardFlowTemplateFieldsPresentation({
  templateName = "",
  templateOptions = [],
}: {
  templateName?: string;
  templateOptions?: string[];
} = {}) {
  return {
    templateName,
    templateOptions,
  };
}

function standardInputField(value: string, placeholder: string) {
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
  templateName?: string;
  templateOptions?: string[];
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
    templateOptionRows: selectOptionsWithCurrent(templateOptions, templateName),
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
}: { executeLoading?: boolean } = {}) {
  return { executeLoading };
}

function standardParsedExecutionRows(
  executionItems: StandardCommandResult[] = [],
) {
  return executionItems.map((executionItem, executionRowIndex) => {
    const success = executionItem.success;
    const commandText = executionItem.command || "-";
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
      exportItem: executionItem,
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
        executionItem,
        executionItem,
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
  });
}

function commandFlowParsedOutputSheets(
  flowResult: StandardCommandFlowExecutionResponse | null,
) {
  const outputs = flowResult?.outputs ?? [];
  return outputs
    .filter((flowOutput) => flowOutput.parsed_output != null)
    .map((flowOutput, index) => ({
      name: flowOutput.command || `command_${index + 1}`,
      parsed_output: flowOutput.parsed_output,
    }));
}

export function commandFlowResultPresentation(
  flowResult: StandardCommandFlowExecutionResponse | null = null,
) {
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
