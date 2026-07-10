import { derived, writable } from "svelte/store";
import { createLoadingRunner } from "../lib/svelte.js";
import { callbackFormValueHandler } from "../lib/events.js";
import {
  classNames,
  pillClass,
  safeString,
  selectOptionsWithCurrent,
  workflowChipClass,
} from "../lib/ui.js";
import { currentLanguageState, t } from "../lib/i18n.js";
import {
  normalizeStandardExecMode,
  STANDARD_EXEC_MODE,
} from "../config/dashboardModes.js";
import {
  flowVarsFieldState,
  flowVarsPresentation,
  runFlowTemplateSelectState,
  runTemplateSelectState,
  setFlowVarDraftValue,
  setFlowVarsJsonOverridesText,
} from "./templates.js";
import {
  MODE_SELECT,
  TEXTFSM_PLATFORM_SELECT,
  modeSelection,
  textfsmPlatformSelection,
} from "./profiles.js";
import {
  executionResultDisplay,
  exportParsedOutputItemExcel,
  exportParsedOutputSheetsExcel,
  parsedOutputBlockDisplayFromItem,
  parsedOutputSheetsFromParsedOutputItems,
} from "./results.js";
import {
  commandFlowExecutionResultState,
  createStandardLoadingKeysStore,
  createStandardTextfsmStateStore,
  DEFAULT_STANDARD_PAGE_MODE,
  directExecutionResultState,
  executeCommandFlow,
  executeDirectCommand,
  executeTemplate,
  exportCommandFlowExcel,
  loadSelectedTemplateContent,
  prepareCommandFlowOnActive,
  previewTemplate,
  refreshCommandFlowLanguageFields,
  refreshStandardExecutionModeOptions,
  setCommandFlowFields,
  selectCommandFlowTemplate,
  setDirectExecutionFields,
  setStandardRunTemplateSelectValue,
  setStandardTextfsmEnabled,
  setStandardTextfsmFields,
  setStandardTextfsmStrictErrors,
  setStandardTextfsmTemplate,
  setTemplateExecutionFields,
  standardTemplateVarsObject,
  templateContentText,
  templateExecutionResultState,
  templatePreviewResultState,
} from "./standardExecutionState.js";

export {
  flowVarsFieldState as standardFlowVarsFieldState,
  flowVarsPresentation as standardFlowVarsPresentation,
  runFlowTemplateSelectState as standardRunFlowTemplateSelectState,
  runTemplateSelectState as standardRunTemplateSelectState,
  setFlowVarDraftValue as setStandardFlowVarDraftValue,
  setFlowVarsJsonOverridesText as setStandardFlowVarsJsonOverridesText,
} from "./templates.js";

export {
  executionConnectionProfileState as standardExecutionConnectionProfileState,
  MODE_SELECT as STANDARD_MODE_SELECT,
  modeSelection as standardModeSelection,
  TEXTFSM_PLATFORM_SELECT as STANDARD_TEXTFSM_PLATFORM_SELECT,
  textfsmPlatformSelection as standardTextfsmPlatformSelection,
} from "./profiles.js";
export { refreshStandardExecutionModeOptions } from "./standardExecutionState.js";

const standardExecutionResultDisplay = executionResultDisplay;
export const exportStandardParsedOutputItemExcel = exportParsedOutputItemExcel;
const exportStandardParsedOutputSheetsExcel = exportParsedOutputSheetsExcel;

const standardExecModePresentation = (mode = "") => ({
  directActive: normalizeStandardExecMode(mode) === STANDARD_EXEC_MODE.direct,
  flowActive: normalizeStandardExecMode(mode) === STANDARD_EXEC_MODE.flow,
  templateActive:
    normalizeStandardExecMode(mode) === STANDARD_EXEC_MODE.template,
});

function standardPageDisplay(mode = "") {
  return {
    ...standardExecModePresentation(mode),
    execModeAriaLabel: t("opSectionStandard"),
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

function standardTemplateSelectDisplay(templateState = {}) {
  return {
    selectedTemplate: safeString(templateState?.selected),
    templateOptions: Array.isArray(templateState?.names)
      ? templateState.names
      : [],
  };
}

function directExecutionEmptyDisplay(overrides = {}) {
  return {
    output: "",
    parsedOutputBlock: null,
    statusMessage: "",
    statusTone: "info",
    ...overrides,
  };
}

function directExecutionDisplay(executionResult = {}) {
  const kind = executionResult?.kind || "empty";
  if (kind === "running") {
    return directExecutionEmptyDisplay({
      statusMessage: t("running"),
      statusTone: "running",
    });
  }
  if (kind === "error") {
    return directExecutionEmptyDisplay({
      statusMessage: executionResult.message || "",
      statusTone: "error",
    });
  }
  if (kind === "result") {
    const parsedItem = executionResult.parsedItem || null;
    return directExecutionEmptyDisplay({
      output: executionResult.output || "",
      parsedOutputBlock: parsedItem
        ? parsedOutputBlockDisplayFromItem(parsedItem)
        : null,
    });
  }
  return directExecutionEmptyDisplay();
}

function modeOptionRowsPresentation({
  hasModeOptions = false,
  mode = "",
  modeOptions = [],
  placeholder = "",
} = {}) {
  const optionRows = selectOptionsWithCurrent(modeOptions, mode).map(
    (modeOptionValue) => ({
      labelText: modeOptionValue,
      valueText: modeOptionValue,
    }),
  );
  return hasModeOptions
    ? optionRows
    : [{ labelText: placeholder, valueText: "" }, ...optionRows];
}

function standardInputField(value, placeholder) {
  return {
    ariaLabelText: placeholder,
    placeholder,
    value: safeString(value),
  };
}

function directExecutionRunPresentation({
  command = "",
  hasModeOptions = false,
  mode = "",
  modeOptions = [],
} = {}) {
  const modePlaceholder = t("modePlaceholder");
  const commandPlaceholder = t("commandPlaceholder");
  return {
    commandField: standardInputField(command, commandPlaceholder),
    executeButtonLabel: t("execBtn"),
    modeField: standardInputField(mode, modePlaceholder),
    modeOptionRows: modeOptionRowsPresentation({
      hasModeOptions,
      mode,
      modeOptions,
      placeholder: modePlaceholder,
    }),
  };
}

function templatePreviewEmptyDisplay(overrides = {}) {
  return { message: "", text: "", tone: "info", ...overrides };
}

function templatePreviewExecutionDisplay(previewResult = {}) {
  const kind = previewResult?.kind || "empty";
  if (kind === "running") {
    return templatePreviewEmptyDisplay({ text: t("running") });
  }
  if (kind === "result") {
    return templatePreviewEmptyDisplay({
      text: safeString(previewResult.renderedCommands || ""),
    });
  }
  if (kind === "error") {
    return templatePreviewEmptyDisplay({
      message: previewResult.message || "",
      tone: "error",
    });
  }
  return templatePreviewEmptyDisplay();
}

const templatePreviewStatusPresentation = (previewDisplay = {}) => ({
  message: previewDisplay.message || "",
  text: previewDisplay.text || "",
  tone: previewDisplay.tone || "info",
});

function templateExecutionRunPresentation() {
  return {
    executeButtonLabel: t("templateExecBtn"),
    previewButtonLabel: t("renderBtn"),
  };
}

function templateExecutionInputPresentation({
  hasModeOptions = false,
  mode = "",
  modeOptions = [],
  selectedContentText = "",
  templateName = "",
  templateOptions = [],
  vars = {},
} = {}) {
  const modePlaceholder = t("templateModePlaceholder");
  const templatePlaceholder = t("templatePlaceholder");
  const templateSelectPlaceholder = t("templateSelectPlaceholder");
  const selectedContentPlaceholder = t("templateSelectedContentPlaceholder");
  const varsPlaceholder = t("varsPlaceholder");
  return {
    modeField: standardInputField(mode, modePlaceholder),
    modeOptionRows: modeOptionRowsPresentation({
      hasModeOptions,
      mode,
      modeOptions,
      placeholder: modePlaceholder,
    }),
    selectedContentField: {
      ariaLabelText: selectedContentPlaceholder,
      placeholder: selectedContentPlaceholder,
    },
    selectedContentText,
    selectedContentTitle: t("templateSelectedContentTitle"),
    templateOptionRows: selectOptionsWithCurrent(templateOptions, templateName),
    templateField: standardInputField(templateName, templatePlaceholder),
    templateSelectField: {
      ariaLabelText: templateSelectPlaceholder,
      placeholder: templateSelectPlaceholder,
    },
    varsField: {
      ariaLabelText: varsPlaceholder,
      placeholder: varsPlaceholder,
      source: standardTemplateVarsObject(vars),
    },
  };
}

function flowExecutionInputPresentation({
  templateName = "",
  templateOptions = [],
} = {}) {
  const templatePlaceholder = t("flowTemplateRunPlaceholder");
  return {
    executeButtonLabel: t("flowExecBtn"),
    hintText: t("flowHint"),
    templateField: standardInputField(templateName, templatePlaceholder),
    templateOptionRows: selectOptionsWithCurrent(templateOptions, templateName),
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

function templateExecutionSummaryCards(executedRows = []) {
  const normalizedExecutedRows = Array.isArray(executedRows)
    ? executedRows
    : [];
  const successCount = normalizedExecutedRows.filter(
    (executionRow) => executionRow.success,
  ).length;
  const failedCount = Math.max(0, normalizedExecutedRows.length - successCount);
  return [
    {
      label: t("templateExecSummaryTotal"),
      summaryValue: normalizedExecutedRows.length,
    },
    { label: t("templateExecSummarySuccess"), summaryValue: successCount },
    { label: t("templateExecSummaryFailed"), summaryValue: failedCount },
  ];
}

function templateExecutionPresentation(executionDisplay = {}) {
  const templateResult = executionDisplay?.resultPayload || null;
  const statusMessage =
    executionDisplay?.statusMessage ||
    (executionDisplay?.kind === "empty" ? t("templateExecVisualEmpty") : "");
  const executedRows = standardParsedExecutionRows(templateResult?.executed);
  return {
    commandLabel: t("fieldCommand"),
    executedRows,
    executedTitle: t("templateExecExecutedTitle"),
    exportButtonLabel: t("textfsmExportAllExcel"),
    hasResult: Boolean(templateResult),
    noItemsText: t("templateExecNoItems"),
    renderedTitle: t("templateExecRenderedTitle"),
    renderedCommandsText: safeString(templateResult?.rendered_commands || ""),
    showResultSection:
      executionDisplay?.kind === "result" && Boolean(templateResult),
    showStatusCard:
      executionDisplay?.kind === "empty" || Boolean(statusMessage),
    summaryCards: templateExecutionSummaryCards(executedRows),
    statusMessage,
    statusTone: executionDisplay?.statusTone || "info",
    visualTitle: t("templateExecVisualTitle"),
  };
}

function templateExecutionRowsPresentation(executedRows = []) {
  const normalizedExecutedRows = Array.isArray(executedRows)
    ? executedRows
    : [];
  const exportSheets = parsedOutputSheetsFromParsedOutputItems(
    normalizedExecutedRows.map((executionRow) => executionRow.exportItem || {}),
    {
      sheetName: (executionExportItem, index) =>
        executionExportItem.command || `command_${index + 1}`,
    },
  );
  return {
    exportAvailable: exportSheets.length > 0,
    exportSheets,
    hasExecutedRows: normalizedExecutedRows.length > 0,
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

function createFlowVarsInputPanelWorkspace({
  onJsonChange = null,
  onValueChange = null,
} = {}) {
  return {
    changeJsonOverrides: onJsonChange,
    changeFlowVarValue(flowVarName) {
      return callbackFormValueHandler(onValueChange, flowVarName);
    },
  };
}

export function createTemplateExecutionPanelWorkspace() {
  const templatePreviewResultStateStore = templatePreviewResultState();
  const templateExecutionResultStateStore = templateExecutionResultState();
  const templateModePicker = modeSelection(MODE_SELECT.standardTemplate);
  const templateTextfsmPlatformPicker = textfsmPlatformSelection(
    TEXTFSM_PLATFORM_SELECT.standard,
  );
  const templateVarsStateStore = writable({});
  const templateTextfsmStateStore = createStandardTextfsmStateStore();
  const { loadingKeysStore, loadingRunner } =
    createStandardLoadingKeysStore(createLoadingRunner);
  const templatePanelDisplayStateStore = derived(
    [
      templateModePicker.state,
      runTemplateSelectState,
      templateTextfsmPlatformPicker.state,
      templateVarsStateStore,
      templateTextfsmStateStore,
      templatePreviewResultStateStore,
      templateExecutionResultStateStore,
      loadingKeysStore,
      templateContentText,
      currentLanguageState,
    ],
    ([
      $templateModeState,
      $runTemplateSelectState,
      $templateTextfsmPlatformState,
      $templateVarsState,
      $templateTextfsmState,
      $templatePreviewResult,
      $templateExecutionResult,
      $loadingKeysStore,
      $templateContentText,
      _currentLanguageState,
    ]) => {
      const templateModeDisplay = standardModeSelectDisplay($templateModeState);
      const templateSelectDisplay = standardTemplateSelectDisplay(
        $runTemplateSelectState,
      );
      const templateTextfsmFields = standardTextfsmFieldsForState({
        enabled: $templateTextfsmState.enabled,
        platformState: $templateTextfsmPlatformState,
        strictErrors: $templateTextfsmState.strictErrors,
        template: $templateTextfsmState.template,
      });
      const templatePreviewDisplay = templatePreviewExecutionDisplay(
        $templatePreviewResult,
      );
      const templateExecutionDisplay = templateExecutionPresentation(
        standardExecutionResultDisplay($templateExecutionResult, {
          emptyMessageKey: "templateExecVisualEmpty",
        }),
      );
      return {
        executeLoading: $loadingKeysStore.includes("execute"),
        previewLoading: $loadingKeysStore.includes("preview"),
        runDisplay: templateExecutionRunPresentation(),
        templateExecutionDisplay,
        templateInputDisplay: templateExecutionInputPresentation({
          hasModeOptions: templateModeDisplay.hasModeOptions,
          mode: templateModeDisplay.selectedMode,
          modeOptions: templateModeDisplay.modeOptions,
          selectedContentText: $templateContentText,
          templateName: templateSelectDisplay.selectedTemplate,
          templateOptions: templateSelectDisplay.templateOptions,
          vars: $templateVarsState,
        }),
        templatePreviewStatus: templatePreviewStatusPresentation(
          templatePreviewDisplay,
        ),
        textfsmFields: templateTextfsmFields,
      };
    },
  );
  let loadedTemplateName = null;

  function changeTemplateName(templateName = "") {
    setStandardRunTemplateSelectValue(templateName);
  }

  function changeTemplateMode(commandMode = "") {
    templateModePicker.setValue(commandMode);
  }

  function changeTemplateVars(nextVars = {}) {
    templateVarsStateStore.set(standardTemplateVarsObject(nextVars));
  }

  function changeTemplateTextfsmEnabled(textfsmEnabled = false) {
    setStandardTextfsmEnabled(templateTextfsmStateStore, textfsmEnabled);
  }

  function changeTemplateTextfsmPlatform(textfsmPlatform = "") {
    templateTextfsmPlatformPicker.setValue(textfsmPlatform);
  }

  function changeTemplateTextfsmStrictErrors(textfsmStrictErrors = false) {
    setStandardTextfsmStrictErrors(
      templateTextfsmStateStore,
      textfsmStrictErrors,
    );
  }

  function changeTemplateTextfsmTemplate(textfsmTemplate = "") {
    setStandardTextfsmTemplate(templateTextfsmStateStore, textfsmTemplate);
  }

  const runActionHandlers = {
    execute: executeTemplateExecution,
    preview: previewTemplateExecution,
  };

  function previewTemplateExecution() {
    return loadingRunner.run("preview", previewTemplate);
  }

  function executeTemplateExecution() {
    return loadingRunner.run("execute", executeTemplate);
  }

  function setPanelContext({
    active = false,
    templatePanelDisplay = null,
  } = {}) {
    if (!active) {
      loadedTemplateName = null;
      return;
    }
    if (!templatePanelDisplay) return;
    setTemplateExecutionFields(
      templatePanelDisplay.templateInputDisplay.templateField.value,
      templatePanelDisplay.templateInputDisplay.modeField.value,
      templatePanelDisplay.templateInputDisplay.varsField.source,
    );
    setStandardTextfsmFields(templatePanelDisplay.textfsmFields);
    const templateName =
      templatePanelDisplay.templateInputDisplay.templateField.value;
    if (loadedTemplateName === templateName) return;
    loadedTemplateName = templateName;
    void loadSelectedTemplateContent();
  }

  return {
    changeTemplateMode,
    changeTemplateName,
    changeTemplateTextfsmEnabled,
    changeTemplateTextfsmPlatform,
    changeTemplateTextfsmStrictErrors,
    changeTemplateTextfsmTemplate,
    changeTemplateVars,
    runActionHandlers,
    setPanelContext,
    templatePanelDisplayStateStore,
  };
}

export function createDirectExecutionPanelWorkspace() {
  const directExecutionResultStateStore = directExecutionResultState();
  const directModePicker = modeSelection(MODE_SELECT.standardDirect);
  const directTextfsmPlatformPicker = textfsmPlatformSelection(
    TEXTFSM_PLATFORM_SELECT.standard,
  );
  const directCommandStateStore = writable("");
  const directTextfsmStateStore = createStandardTextfsmStateStore();
  const { loadingKeysStore, loadingRunner } =
    createStandardLoadingKeysStore(createLoadingRunner);
  const directPanelDisplayStateStore = derived(
    [
      directCommandStateStore,
      directModePicker.state,
      directTextfsmPlatformPicker.state,
      directTextfsmStateStore,
      directExecutionResultStateStore,
      loadingKeysStore,
      currentLanguageState,
    ],
    ([
      $directCommandStateStore,
      $directModeState,
      $directTextfsmPlatformState,
      $directTextfsmState,
      $directExecutionResult,
      $loadingKeysStore,
      _currentLanguageState,
    ]) => {
      const directModeDisplay = standardModeSelectDisplay($directModeState);
      return {
        directResultDisplay: directExecutionDisplay($directExecutionResult),
        executeLoading: $loadingKeysStore.includes("execute"),
        runDisplay: directExecutionRunPresentation({
          command: $directCommandStateStore,
          hasModeOptions: directModeDisplay.hasModeOptions,
          mode: directModeDisplay.selectedMode,
          modeOptions: directModeDisplay.modeOptions,
        }),
        textfsmFields: standardTextfsmFieldsForState({
          enabled: $directTextfsmState.enabled,
          platformState: $directTextfsmPlatformState,
          strictErrors: $directTextfsmState.strictErrors,
          template: $directTextfsmState.template,
        }),
      };
    },
  );

  function changeDirectCommand(commandText = "") {
    directCommandStateStore.set(safeString(commandText));
  }

  function changeDirectMode(commandMode = "") {
    directModePicker.setValue(commandMode);
  }

  function changeDirectTextfsmEnabled(textfsmEnabled = false) {
    setStandardTextfsmEnabled(directTextfsmStateStore, textfsmEnabled);
  }

  function changeDirectTextfsmPlatform(textfsmPlatform = "") {
    directTextfsmPlatformPicker.setValue(textfsmPlatform);
  }

  function changeDirectTextfsmStrictErrors(textfsmStrictErrors = false) {
    setStandardTextfsmStrictErrors(
      directTextfsmStateStore,
      textfsmStrictErrors,
    );
  }

  function changeDirectTextfsmTemplate(textfsmTemplate = "") {
    setStandardTextfsmTemplate(directTextfsmStateStore, textfsmTemplate);
  }

  function setPanelContext({ active = false, directPanelDisplay = null } = {}) {
    if (!active || !directPanelDisplay) return;
    setDirectExecutionFields(
      directPanelDisplay.runDisplay.commandField.value,
      directPanelDisplay.runDisplay.modeField.value,
    );
    setStandardTextfsmFields(directPanelDisplay.textfsmFields);
  }

  function executeDirectExecution() {
    return loadingRunner.run("execute", executeDirectCommand);
  }

  return {
    changeDirectCommand,
    changeDirectMode,
    changeDirectTextfsmEnabled,
    changeDirectTextfsmPlatform,
    changeDirectTextfsmStrictErrors,
    changeDirectTextfsmTemplate,
    directPanelDisplayStateStore,
    executeDirectExecution,
    setPanelContext,
  };
}

export function createFlowExecutionPanelWorkspace() {
  const commandFlowExecutionResultStateStore =
    commandFlowExecutionResultState();
  const textfsmPlatformPicker = textfsmPlatformSelection(
    TEXTFSM_PLATFORM_SELECT.standard,
  );
  const flowTextfsmStateStore = createStandardTextfsmStateStore();
  const { loadingKeysStore, loadingRunner } =
    createStandardLoadingKeysStore(createLoadingRunner);
  const flowVarsInputPanelWorkspace = createFlowVarsInputPanelWorkspace({
    onJsonChange: setFlowVarsJsonOverridesText,
    onValueChange: setFlowVarDraftValue,
  });
  const flowPanelDisplayStateStore = derived(
    [
      runFlowTemplateSelectState,
      flowVarsFieldState,
      textfsmPlatformPicker.state,
      flowTextfsmStateStore,
      commandFlowExecutionResultStateStore,
      loadingKeysStore,
      currentLanguageState,
    ],
    ([
      $runFlowTemplateSelectState,
      $flowVarsFieldState,
      $textfsmPlatformState,
      $flowTextfsmState,
      $commandFlowExecutionResult,
      $loadingKeysStore,
      $currentLanguageState,
    ]) => {
      const flowTemplateSelectDisplay = standardFlowTemplateSelectDisplay(
        $runFlowTemplateSelectState,
      );
      const flowTemplateFields = standardFlowTemplateFieldsPresentation({
        templateName: flowTemplateSelectDisplay.selectedTemplate,
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
      return {
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

  function changeFlowTemplateName(flowTemplateName = "") {
    selectCommandFlowTemplate(flowTemplateName);
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
    return loadingRunner.run("execute", executeCommandFlow);
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

  function setPanelContext({ active = false, flowPanelDisplay = null } = {}) {
    if (!active) {
      commandFlowPrepared = false;
      lastCommandFlowLanguage = "";
      return;
    }
    if (!flowPanelDisplay) return;
    if (!commandFlowPrepared) {
      commandFlowPrepared = true;
      void prepareCommandFlowOnActive();
    }
    const language = safeString(flowPanelDisplay.language);
    if (lastCommandFlowLanguage !== language) {
      lastCommandFlowLanguage = language;
      refreshCommandFlowLanguageFields();
    }
    setCommandFlowFields(flowPanelDisplay.flowTemplateFields.templateName);
    setStandardTextfsmFields(flowPanelDisplay.flowTextfsmFields);
  }

  return {
    changeFlowTemplateName,
    changeFlowJsonOverrides: flowVarsInputPanelWorkspace.changeJsonOverrides,
    changeFlowTextfsmEnabled,
    changeFlowTextfsmPlatform,
    changeFlowTextfsmStrictErrors,
    changeFlowTextfsmTemplate,
    changeFlowVarValue: flowVarsInputPanelWorkspace.changeFlowVarValue,
    executeFlowExecution,
    exportFlowExecutionExcel,
    flowPanelDisplayStateStore,
    runActionHandlers,
    setPanelContext,
  };
}

export function createTemplateExecutionResultsPanelWorkspace() {
  const { loadingKeysStore, loadingRunner } =
    createStandardLoadingKeysStore(createLoadingRunner);
  const panelDisplayStateStore = writable(templateExecutionPresentation());
  const executionRowsDisplayStateStore = writable(
    templateExecutionRowsPresentation(),
  );
  const exportLoadingStateStore = derived(
    loadingKeysStore,
    ($loadingKeysStore) => ({
      exportLoading: $loadingKeysStore.includes("export"),
    }),
  );

  function exportTemplateExecutionResults(executionRowsDisplay = {}) {
    return loadingRunner.run("export", () =>
      exportParsedOutputSheetsExcel(executionRowsDisplay.exportSheets || [], {
        filename: "textfsm-template.xlsx",
      }),
    );
  }

  return {
    executionRowsDisplayStateStore,
    exportLoadingStateStore,
    exportTemplateExecutionResults,
    loadingKeysStore,
    panelDisplayStateStore,
    setResultsContext({ templateExecutionDisplay = {} } = {}) {
      panelDisplayStateStore.set(
        templateExecutionPresentation(templateExecutionDisplay),
      );
      executionRowsDisplayStateStore.set(
        templateExecutionRowsPresentation(
          templateExecutionDisplay.executedRows,
        ),
      );
    },
  };
}
