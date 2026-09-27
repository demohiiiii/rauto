import { t } from "../../../lib/i18n.js";
import { safeString, selectOptionsWithCurrent } from "../../../lib/ui.js";
import type { ModeSelectState } from "$domains/profiles/index.js";
import type { InteractiveTemplateSelectState } from "$domains/templates/index.js";

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
