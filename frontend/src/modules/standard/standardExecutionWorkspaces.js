import { derived, get, writable } from "svelte/store";
import {
  createCommandFlowTemplate,
  getCommandFlowTemplate,
  inspectCommandFlowTemplate,
  updateCommandFlowTemplate,
} from "../../api/client.js";
import { browserConfirm } from "../../lib/browser.js";
import { createLoadingRunner } from "../../lib/svelte.js";
import { callbackFormValueHandler } from "../../lib/events.js";
import {
  classNames,
  pillClass,
  safeString,
  selectOptionsWithCurrent,
  workflowChipClass,
} from "../../lib/ui.js";
import { currentLanguageState, t } from "../../lib/i18n.js";
import {
  normalizeStandardExecMode,
  STANDARD_EXEC_MODE,
} from "../../config/dashboardModes.js";
import {
  flowVarsFieldState,
  getCurrentFlowTemplateFieldDraft,
  loadFlowTemplates,
  parseBuiltinFlowTemplateValue,
  runFlowTemplateSelectState,
  setFlowVarDraftValue,
  updateFlowTemplateVarFields,
} from "../templates/templatesFlowRuntimeState.js";
import { flowVarsPresentation } from "../templates/templatesFlowDisplayState.js";
import { createStandardCommandFlowAuthoringState } from "./standardCommandFlowAuthoringState.js";
import {
  MODE_SELECT,
  TEXTFSM_PLATFORM_SELECT,
  modeSelection,
  textfsmPlatformSelection,
} from "../profiles/profiles.js";
import {
  executionResultDisplay,
  exportParsedOutputSheetsExcel,
  parsedOutputBlockDisplayFromItem,
  parsedOutputSheetsFromParsedOutputItems,
} from "../operations/results.js";
import {
  commandFlowExecutionResultState,
  createStandardLoadingKeysStore,
  createStandardTextfsmStateStore,
  DEFAULT_STANDARD_PAGE_MODE,
  executeCommandFlow,
  exportCommandFlowExcel,
  refreshStandardExecutionModeOptions,
  setStandardTextfsmEnabled,
  setStandardTextfsmFields,
  setStandardTextfsmStrictErrors,
  setStandardTextfsmTemplate,
} from "./standardExecutionState.js";

const standardExecutionResultDisplay = executionResultDisplay;

const standardExecModePresentation = (mode = "") => ({
  directActive: normalizeStandardExecMode(mode) === STANDARD_EXEC_MODE.direct,
  flowActive: normalizeStandardExecMode(mode) === STANDARD_EXEC_MODE.flow,
});

function standardPageDisplay(mode = "") {
  return {
    ...standardExecModePresentation(mode),
    execModeAriaLabel: t("opSectionStandard"),
    hint: t("standardWorkspaceHint"),
    title: t("opCardTitle"),
  };
}

function standardModeSelectDisplay(modeState = {}) {
  const modeOptions = Array.isArray(modeState?.modes) ? modeState.modes : [];
  return {
    hasModeOptions: Boolean(modeOptions[0]),
    modeOptions,
    selectedMode: safeString(modeState?.selected),
  };
}

function standardTextfsmFieldsForState({
  enabled = false,
  platformState = {},
  strictErrors = false,
  template = "",
} = {}) {
  return {
    enabled: !!enabled,
    platform: safeString(platformState?.selected),
    platformOptions: Array.isArray(platformState?.profiles)
      ? platformState.profiles
      : [],
    strictErrors: !!strictErrors,
    template: safeString(template),
  };
}

function standardFlowTemplateSelectDisplay(templateState = {}) {
  return {
    selectedTemplate: safeString(templateState?.selected),
    templateOptions: Array.isArray(templateState?.options)
      ? templateState.options
      : [],
  };
}

function standardFlowTemplateFieldsPresentation({
  templateName = "",
  templateOptions = [],
} = {}) {
  return {
    templateName: safeString(templateName),
    templateOptions: Array.isArray(templateOptions) ? templateOptions : [],
  };
}

function standardInputField(value, placeholder) {
  return {
    ariaLabelText: placeholder,
    placeholder,
    value: safeString(value),
  };
}

function flowExecutionInputPresentation({
  templateName = "",
  templateOptions = [],
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

function standardFlowRunButtonDisplay({ executeLoading = false } = {}) {
  return { executeLoading: !!executeLoading };
}

function standardParsedExecutionRows(executionItems = []) {
  return (Array.isArray(executionItems) ? executionItems : []).map(
    (executionItem, executionRowIndex) => {
      const exportItem = executionItem || {};
      const success = !!executionItem?.success;
      const commandText = safeString(executionItem?.command) || "-";
      return {
        cardClass: classNames(
          "rounded-lg border px-3 py-3",
          success
            ? "border-emerald-200 bg-emerald-50"
            : "border-rose-200 bg-rose-50",
        ),
        commandText,
        error: safeString(executionItem?.error),
        exitCodeMetaText: `${t("txBlockResultExitCode")}: ${safeString(
          executionItem?.exit_code,
        )}`,
        exitCodeText: safeString(executionItem?.exit_code),
        exportItem,
        flowBadgeClass: pillClass(
          success
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700",
        ),
        flowRowTitleText: `${executionRowIndex + 1}. ${commandText}`,
        outputText: safeString(
          executionItem?.output || executionItem?.error || "",
        ),
        parsedOutputBlock: parsedOutputBlockDisplayFromItem(
          executionItem,
          exportItem,
        ),
        statusLabel: success
          ? t("orchestrationStatusSuccess", "Success")
          : t("orchestrationStatusFailed", "Failed"),
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

function commandFlowResultPresentation(flowPayload = null) {
  const flowResult =
    flowPayload && typeof flowPayload === "object" ? flowPayload : null;
  const resultSuccess = flowResult?.success === true;
  const resultTemplateName = safeString(flowResult?.template_name || "");
  const resultRows = standardParsedExecutionRows(flowResult?.outputs);
  const exportSheets = commandFlowParsedOutputSheets({
    kind: "result",
    resultPayload: flowResult,
  });
  return {
    exportAvailable: exportSheets.length > 0,
    exportButtonLabel: t("textfsmExportAllExcel"),
    hasResult: Boolean(flowResult),
    hasResultRows: resultRows.length > 0,
    resultRows,
    resultSummaryMessage: `${resultSuccess ? t("orchestrationStatusSuccess", "Success") : t("orchestrationStatusFailed", "Failed")} · template=${resultTemplateName || "-"}`,
    resultSummaryTone: resultSuccess ? "success" : "error",
  };
}

function commandFlowParsedOutputSheets(flowExecutionResult = {}) {
  const resultPayload =
    flowExecutionResult?.kind === "result"
      ? flowExecutionResult.resultPayload
      : null;
  const outputs = Array.isArray(resultPayload?.outputs)
    ? resultPayload.outputs
    : [];
  return parsedOutputSheetsFromParsedOutputItems(outputs, {
    sheetName: (flowOutput, index) =>
      flowOutput.command || `command_${index + 1}`,
  });
}

export function createStandardPageWorkspace() {
  const currentExecModeState = writable(DEFAULT_STANDARD_PAGE_MODE);
  const pageDisplayStateStore = derived(
    [currentExecModeState, currentLanguageState],
    ([$currentExecModeState, _currentLanguageState]) =>
      standardPageDisplay($currentExecModeState),
  );
  let lastExecutionProfile = "";

  function selectExecMode(standardExecMode) {
    currentExecModeState.set(normalizeStandardExecMode(standardExecMode));
  }

  function setRouteContext({ active = false, profile = "" } = {}) {
    const executionProfile = safeString(profile).trim();
    if (!active) {
      lastExecutionProfile = "";
      return;
    }
    if (lastExecutionProfile === executionProfile) return;
    lastExecutionProfile = executionProfile;
    void refreshStandardExecutionModeOptions();
  }

  function destroy() {
    lastExecutionProfile = "";
  }

  return {
    currentExecModeState,
    destroy,
    pageDisplayStateStore,
    selectExecMode,
    setRouteContext,
  };
}

function createFlowVarsInputPanelWorkspace({ onValueChange = null } = {}) {
  return {
    changeFlowVarValue(flowVarName) {
      return callbackFormValueHandler(onValueChange, flowVarName);
    },
  };
}

export function createFlowExecutionPanelWorkspace() {
  const commandFlowExecutionResultStateStore =
    commandFlowExecutionResultState();
  const authoringModePicker = modeSelection(MODE_SELECT.standardFlow);
  const textfsmPlatformPicker = textfsmPlatformSelection(
    TEXTFSM_PLATFORM_SELECT.standard,
  );
  const flowTextfsmStateStore = createStandardTextfsmStateStore();
  const { loadingKeysStore, loadingRunner } =
    createStandardLoadingKeysStore(createLoadingRunner);
  const flowVarsInputPanelWorkspace = createFlowVarsInputPanelWorkspace({
    onValueChange: setFlowVarDraftValue,
  });
  const authoring = createStandardCommandFlowAuthoringState({
    confirmDiscard: browserConfirm,
    createTemplate: createCommandFlowTemplate,
    getTemplate: getCommandFlowTemplate,
    inspectTemplate: inspectCommandFlowTemplate,
    onInspection(detail) {
      updateFlowTemplateVarFields(detail, getCurrentFlowTemplateFieldDraft());
    },
    parseBuiltinSelection: parseBuiltinFlowTemplateValue,
    refreshTemplates: loadFlowTemplates,
    updateTemplate: updateCommandFlowTemplate,
  });
  const flowPanelDisplayStateStore = derived(
    [
      runFlowTemplateSelectState,
      flowVarsFieldState,
      authoringModePicker.state,
      textfsmPlatformPicker.state,
      flowTextfsmStateStore,
      commandFlowExecutionResultStateStore,
      loadingKeysStore,
      authoring.selectionStateStore,
      authoring.actionStateStore,
      authoring.nameDialogStateStore,
      authoring.draft.modelStateStore,
      authoring.draft.tomlTextStateStore,
      authoring.draft.errorStateStore,
      authoring.draft.activeTabStateStore,
      authoring.draft.inspectionStateStore,
      currentLanguageState,
    ],
    ([
      $runFlowTemplateSelectState,
      $flowVarsFieldState,
      $authoringModeState,
      $textfsmPlatformState,
      $flowTextfsmState,
      $commandFlowExecutionResult,
      $loadingKeysStore,
      $authoringSelection,
      $authoringActions,
      $nameDialog,
      $authoringModel,
      $authoringTomlText,
      $authoringError,
      $authoringActiveTab,
      $authoringInspection,
      $currentLanguageState,
    ]) => {
      const flowTemplateSelectDisplay = standardFlowTemplateSelectDisplay(
        $runFlowTemplateSelectState,
      );
      const flowTemplateFields = standardFlowTemplateFieldsPresentation({
        templateName: $authoringSelection.value,
        templateOptions: flowTemplateSelectDisplay.templateOptions,
      });
      const flowTextfsmFields = standardTextfsmFieldsForState({
        enabled: $flowTextfsmState.enabled,
        platformState: $textfsmPlatformState,
        strictErrors: $flowTextfsmState.strictErrors,
        template: $flowTextfsmState.template,
      });
      const executionStatusDisplay = standardExecutionResultDisplay(
        $commandFlowExecutionResult,
      );
      const authoringModeDisplay =
        standardModeSelectDisplay($authoringModeState);
      return {
        authoringDisplay: {
          ...$authoringActions,
          activeTab: $authoringActiveTab,
          errorMessage:
            $authoringError || $authoringInspection.errorMessage || "",
          inspecting: !!$authoringInspection.loading,
          modeOptions: authoringModeDisplay.modeOptions,
          model: $authoringModel,
          nameDialog: $nameDialog,
          selection: $authoringSelection,
          tomlText: $authoringTomlText,
        },
        executionStatusDisplay,
        exportLoading: $loadingKeysStore.includes("export"),
        flowInputDisplay: flowExecutionInputPresentation({
          templateName: flowTemplateFields.templateName,
          templateOptions: flowTemplateFields.templateOptions,
        }),
        flowResultDisplay: commandFlowResultPresentation(
          executionStatusDisplay.resultPayload,
        ),
        flowRunButtonDisplay: standardFlowRunButtonDisplay({
          executeLoading: $loadingKeysStore.includes("execute"),
        }),
        flowTemplateFields,
        flowTextfsmFields,
        flowVarsDisplay: flowVarsPresentation($flowVarsFieldState),
        language: $currentLanguageState,
      };
    },
  );
  let commandFlowPrepared = false;
  let lastCommandFlowLanguage = "";

  function syncAuthoringSelection() {
    setStandardRunTemplateSelectValue(get(authoring.selectionStateStore).value);
  }

  async function changeFlowTemplateName(flowTemplateName = "") {
    const changed = await authoring.selectTemplate(flowTemplateName);
    if (changed) syncAuthoringSelection();
    return changed;
  }

  function changeFlowEditorTab(editorTab = "visual") {
    authoring.draft.selectTab(editorTab);
  }

  function changeFlowModel(model = {}) {
    authoring.setModel(model);
  }

  function changeFlowToml(tomlText = "") {
    return authoring.setTomlText(tomlText);
  }

  function changeFlowTextfsmEnabled(textfsmEnabled = false) {
    setStandardTextfsmEnabled(flowTextfsmStateStore, textfsmEnabled);
  }

  function changeFlowTextfsmPlatform(textfsmPlatform = "") {
    textfsmPlatformPicker.setValue(textfsmPlatform);
  }

  function changeFlowTextfsmStrictErrors(textfsmStrictErrors = false) {
    setStandardTextfsmStrictErrors(flowTextfsmStateStore, textfsmStrictErrors);
  }

  function changeFlowTextfsmTemplate(textfsmTemplate = "") {
    setStandardTextfsmTemplate(flowTextfsmStateStore, textfsmTemplate);
  }

  function executeFlowExecution() {
    return loadingRunner.run("execute", () =>
      executeCommandFlow(authoring.executeSource()),
    );
  }

  async function saveFlowTemplate() {
    const saved = await authoring.save();
    if (saved) syncAuthoringSelection();
    return saved;
  }

  function openNewFlowDialog() {
    authoring.openNewDialog();
  }

  function openSaveAsFlowDialog() {
    authoring.openSaveAsDialog();
  }

  function closeFlowNameDialog() {
    authoring.closeNameDialog();
  }

  function changeFlowNameDialogValue(value = "") {
    authoring.setNameDialogValue(value);
  }

  async function submitFlowNameDialog() {
    const saved = await authoring.submitNameDialog();
    if (saved) syncAuthoringSelection();
    return saved;
  }

  function exportFlowExecutionExcel() {
    return loadingRunner.run("export", () =>
      exportCommandFlowExcel(exportParsedOutputSheetsExcel),
    );
  }

  function exportFlowExecutionExcelHandler() {
    return () => exportFlowExecutionExcel();
  }

  const runActionHandlers = {
    execute: executeFlowExecution,
    export: exportFlowExecutionExcelHandler(),
  };

  async function prepareAuthoringOnActive() {
    await loadFlowTemplates();
    const selected = safeString(
      get(runFlowTemplateSelectState).selected,
    ).trim();
    if (selected) await changeFlowTemplateName(selected);
  }

  function setPanelContext({ active = false, flowPanelDisplay = null } = {}) {
    if (!active) {
      commandFlowPrepared = false;
      lastCommandFlowLanguage = "";
      return;
    }
    if (!flowPanelDisplay) return;
    if (!commandFlowPrepared) {
      commandFlowPrepared = true;
      void prepareAuthoringOnActive();
    }
    const language = safeString(flowPanelDisplay.language);
    if (lastCommandFlowLanguage !== language) {
      lastCommandFlowLanguage = language;
      updateFlowTemplateVarFields(
        {
          vars_schema: get(authoring.draft.inspectionStateStore).varsSchema,
        },
        getCurrentFlowTemplateFieldDraft(),
      );
    }
    setStandardTextfsmFields(flowPanelDisplay.flowTextfsmFields);
  }

  return {
    authoring,
    changeFlowEditorTab,
    changeFlowModel,
    changeFlowNameDialogValue,
    changeFlowTemplateName,
    changeFlowTextfsmEnabled,
    changeFlowTextfsmPlatform,
    changeFlowTextfsmStrictErrors,
    changeFlowTextfsmTemplate,
    changeFlowToml,
    changeFlowVarValue: flowVarsInputPanelWorkspace.changeFlowVarValue,
    closeFlowNameDialog,
    executeFlowExecution,
    exportFlowExecutionExcel,
    flowPanelDisplayStateStore,
    openNewFlowDialog,
    openSaveAsFlowDialog,
    runActionHandlers,
    saveFlowTemplate,
    saveFlowTemplateAs: authoring.saveAs,
    setPanelContext,
    submitFlowNameDialog,
  };
}
