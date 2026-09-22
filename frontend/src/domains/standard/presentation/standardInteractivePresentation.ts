import { t } from "../../../lib/i18n.js";
import {
  classNames,
  pillClass,
  safeString,
  selectOptionsWithCurrent,
  workflowChipClass,
} from "../../../lib/ui.js";
import { parsedOutputBlockDisplayFromItem } from "$domains/execution/index.js";
import type { ModeSelectState } from "$domains/profiles/index.js";
import type { InteractiveTemplateSelectState } from "$domains/templates/index.js";
import type {
  StandardInteractiveExecutionResponse,
  StandardCommandResult,
} from "../model/types.js";

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
  autoDownloadExcel = false,
  autoDownloadOutput = false,
  strictErrors = false,
  template = "",
}: {
  enabled?: boolean;
  autoDownloadExcel?: boolean;
  autoDownloadOutput?: boolean;
  strictErrors?: boolean;
  template?: string;
}) {
  return {
    enabled,
    autoDownloadExcel,
    autoDownloadOutput,
    strictErrors,
    template,
  };
}

export function standardInteractiveTemplateSelectPresentation(
  templateState: InteractiveTemplateSelectState,
) {
  return {
    selectedTemplate: templateState.selected,
    templateOptions: templateState.options,
  };
}

export function standardInteractiveTemplateFieldsPresentation({
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

export function interactiveExecutionInputPresentation({
  templateName = "",
  templateOptions = [],
}: {
  templateName?: string;
  templateOptions?: string[];
} = {}) {
  const templatePlaceholder = t("interactiveTemplateRunPlaceholder");
  return {
    builtinSourceLabel: t("interactiveBuiltinSourceLabel"),
    cancelButtonLabel: t("cancel"),
    customSourceLabel: t("interactiveCustomSourceLabel"),
    currentDraftLabel: t("interactiveCurrentDraftLabel"),
    descriptionText: t("interactiveHint"),
    executeButtonLabel: t("interactiveExecBtn"),
    nameDialogDescription: t("interactiveNameDialogDescription"),
    nameDialogNewTitle: t("interactiveNameDialogNewTitle"),
    nameDialogSaveAsTitle: t("interactiveNameDialogSaveAsTitle"),
    nameDialogSubmitLabel: t("confirmBtn"),
    newButtonLabel: t("interactiveNewButton"),
    newSourceLabel: t("interactiveNewSourceLabel"),
    saveButtonLabel: t("interactiveTemplateSaveBtn"),
    saveAsButtonLabel: t("interactiveSaveAsButton"),
    inspectingText: t("interactiveInspecting"),
    resultsDescriptionText: t("interactiveResultsHint"),
    resultsTitleText: t("interactiveResultsTitle"),
    interactiveVariableCountLabel: t("interactiveVariableCountLabel"),
    templateDescriptionText: t("interactiveTemplateSourceHint"),
    templateField: standardInputField(templateName, templatePlaceholder),
    templateOptionRows: selectOptionsWithCurrent(templateOptions, templateName),
    templateTitleText: t("interactiveTemplateSourceTitle"),
    tomlTabLabel: t("interactiveTomlTab"),
    tomlFieldLabel: t("interactiveTomlLabel"),
    tomlFieldHint: t("interactiveTomlHint"),
    textfsmDescriptionText: t("textfsmParseHint"),
    textfsmTitleText: t("interactiveTextfsmTitle"),
    visualTabLabel: t("interactiveVisualTab"),
    workbenchDescriptionText: t("interactiveWorkbenchHint"),
    workbenchTitleText: t("interactiveWorkbenchTitle"),
  };
}

export function standardInteractiveRunButtonPresentation({
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
      interactiveBadgeClass: pillClass(
        success
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700",
      ),
      interactiveRowTitleText: `${executionRowIndex + 1}. ${commandText}`,
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

function interactiveParsedOutputSheets(
  interactiveResult: StandardInteractiveExecutionResponse | null,
) {
  const outputs = interactiveResult?.outputs ?? [];
  return outputs
    .filter((interactiveOutput) => interactiveOutput.parsed_output != null)
    .map((interactiveOutput, index) => ({
      name: interactiveOutput.command || `command_${index + 1}`,
      parsed_output: interactiveOutput.parsed_output,
    }));
}

export function interactiveResultPresentation(
  interactiveResult: StandardInteractiveExecutionResponse | null = null,
) {
  const resultSuccess = interactiveResult?.success === true;
  const resultTemplateName = safeString(interactiveResult?.template_name || "");
  const resultRows = standardParsedExecutionRows(interactiveResult?.outputs);
  const exportSheets = interactiveParsedOutputSheets(interactiveResult);
  return {
    exportAvailable: exportSheets.length > 0,
    exportButtonLabel: t("textfsmExportAllExcel"),
    hasResult: Boolean(interactiveResult),
    hasResultRows: resultRows.length > 0,
    resultRows,
    resultSummaryMessage: `${resultSuccess ? t("orchestrationStatusSuccess") : t("orchestrationStatusFailed")} · template=${resultTemplateName || "-"}`,
    resultSummaryTone: resultSuccess ? "success" : "error",
  };
}
