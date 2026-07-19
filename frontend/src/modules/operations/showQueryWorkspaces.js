import { normalizeShowQuery, SHOW_QUERY } from "../../config/dashboardModes.js";
import { derived, writable } from "svelte/store";
import { currentLanguageState, t } from "../../lib/i18n.js";
import { createLoadingStateRunner } from "../../lib/svelte.js";
import {
  emptyString,
  safeString,
  selectOptionsWithCurrent,
} from "../../lib/ui.js";
import {
  executionResultDisplay,
  exportParsedOutputItemExcel,
  exportParsedOutputSheetsExcel,
  parsedOutputBlockDisplay,
  parsedOutputSheetsFromBatchShow,
  parsedOutputSheetsFromParsedOutputItems,
} from "./results.js";
import {
  MODE_SELECT,
  modeSelection,
  TEXTFSM_PLATFORM_SELECT,
  textfsmPlatformSelection,
} from "../profiles/profiles.js";
import { batchShowTargetPickerFields } from "../connections/connections.js";
import {
  batchShowExecutionResultState,
  DEFAULT_SHOW_PAGE_QUERY,
  EMPTY_RESULT,
  executeBatchShowObject,
  executeShowObject,
  isBatchShowBusy,
  loadBatchShowObjects,
  loadShowObjects,
  refreshShowExecutionModeOptions,
  refreshShowObjects,
  setBatchShowFields,
  setShowTextfsmFields,
  setSingleShowFields,
  showCommandPreviewRowsState,
  showConnectionTargetIdentity,
  showExecutionResultState,
  showObjectPickerKey,
  updateBatchShowCommandPreview,
  updateShowCommandPreview,
} from "./showQueryState.js";

export {
  showConnectionTargetState,
  showExecutionConnectionProfileState,
} from "./showQueryState.js";
export const exportShowParsedOutputItemExcel = exportParsedOutputItemExcel;

function showModeOptionRows(selected = "", modeOptions = []) {
  const modeOptionRows = selectOptionsWithCurrent(modeOptions, selected).map(
    (modeOptionValue) => ({
      labelText: modeOptionValue,
      valueText: modeOptionValue,
    }),
  );
  return [
    { labelText: t("showModeAutoPlaceholder"), valueText: "" },
    ...modeOptionRows,
  ];
}

function showQueryPresentation(query = "") {
  return {
    batchActive: normalizeShowQuery(query) === SHOW_QUERY.batch,
    singleActive: normalizeShowQuery(query) === SHOW_QUERY.single,
  };
}

function showPageDisplay(query = "") {
  return {
    ...showQueryPresentation(query),
    queryAriaLabel: t("opExecShow"),
    title: t("opExecShow"),
  };
}

function showObjectSelectionPresentation({
  selectedMode = "",
  modeOptions = [],
} = {}) {
  return {
    commandLabel: t("showPreviewCommand"),
    mappingLabel: t("showPreviewMapping"),
    modeOptionRows: showModeOptionRows(selectedMode, modeOptions),
    modePlaceholder: t("modePlaceholder"),
    objectLabel: t("showObjectPlaceholder"),
    objectPlaceholder: t("showObjectPlaceholder"),
    platformLabel: t("showPreviewPlatform"),
    previewEmptyText: "-",
    previewTitle: t("showPreviewTitle"),
    sourceLabel: t("showPreviewSource"),
    textfsmLabel: t("showPreviewTextfsm"),
  };
}

function showSelectionFieldsForQuery({
  modeState = {},
  previewRows = {},
  query = "",
} = {}) {
  const key = normalizeShowQuery(query);
  return {
    mode: safeString(modeState?.selected),
    modeOptions: Array.isArray(modeState?.modes) ? modeState.modes : [],
    objectPickerKey: safeString(showObjectPickerKey(query)),
    previewRows: Array.isArray(previewRows?.[key]) ? previewRows[key] : [],
    showResolvedCommandDetails: key === SHOW_QUERY.single,
  };
}

function showTextfsmFieldsForState({
  enabled = false,
  excelName,
  platformState = {},
  strictErrors = false,
  template = "",
} = {}) {
  return {
    enabled: !!enabled,
    excelName:
      excelName === undefined ? undefined : safeString(excelName).trim(),
    platform: safeString(platformState?.selected),
    platformOptions: Array.isArray(platformState?.profiles)
      ? platformState.profiles
      : [],
    strictErrors: !!strictErrors,
    template: safeString(template),
  };
}

function singleShowRunPresentation() {
  return {
    executeButtonLabel: t("showExecuteBtn"),
  };
}

function showRunButtonDisplayPresentation({
  executeButtonLabel = "",
  executeLoading = false,
} = {}) {
  return {
    executeButtonLabel: safeString(executeButtonLabel),
    executeLoading: !!executeLoading,
  };
}

function showResultDisplayBase(statusMessage = "", statusTone = "info") {
  return {
    basePayload: null,
    showResults: [],
    statusMessage,
    statusTone,
  };
}

function showResultsExecutionDisplay(showResult = {}) {
  const kind = showResult?.kind || "empty";
  if (kind === "running") {
    return showResultDisplayBase(t("running"), "running");
  }
  if (kind === "error") {
    return showResultDisplayBase(showResult.message || "", "error");
  }
  if (kind === "result") {
    return {
      basePayload: showResult.basePayload || null,
      showResults: Array.isArray(showResult.results) ? showResult.results : [],
      statusMessage: "",
      statusTone: "info",
    };
  }
  return showResultDisplayBase();
}

function singleShowExportSheets(resultDisplay = {}) {
  return parsedOutputSheetsFromParsedOutputItems(resultDisplay.showResults, {
    sheetName: (showResult, index) =>
      showResult.object || showResult.command || `show_${index + 1}`,
  });
}

function singleShowResultsPresentation(resultDisplay = {}) {
  const connection = resultDisplay?.basePayload?.connection || {};
  const exportSheets = singleShowExportSheets(resultDisplay);
  const showResults = Array.isArray(resultDisplay?.showResults)
    ? resultDisplay.showResults
    : [];
  const deviceName = connection.connection_name || connection.host || "";
  const parsedResultCount = showResults.filter(
    (showResult) =>
      Array.isArray(showResult?.parsed) && showResult.parsed.length,
  ).length;
  const resultCount = showResults.length;
  return {
    exportButtonLabel: t("textfsmExportAllExcel"),
    exportAvailable: exportSheets.length > 0,
    exportSheets,
    parsedResultCount,
    resultCount,
    resultRows: showResults.map((showResult, index) => {
      const exportItem = { ...showResult, device: deviceName };
      const objectText = safeString(showResult?.object);
      const commandText = safeString(showResult?.command);
      const modeText = safeString(showResult?.mode || "-");
      return {
        ...showResult,
        commandText,
        metaFields: [
          { label: t("showObjectPlaceholder"), value: showResult?.object },
          { label: t("showResultPlatform"), value: showResult?.platform },
          { label: t("historyColMode"), value: showResult?.mode },
          { label: t("showPreviewSource"), value: showResult?.source },
          {
            label: t("showPreviewTextfsm"),
            value: showResult?.textfsm_template_name || "-",
          },
          {
            label: t("showResultCommand"),
            mono: true,
            value: showResult?.command,
          },
        ],
        modeText,
        objectText,
        outputTitle: deviceName || safeString(showResult?.object) || "Output",
        outputText: safeString(showResult?.output),
        parsedOutputBlock: parsedOutputBlockDisplay({
          exportItem,
          parseError: showResult?.parse_error,
          parsedOutput: showResult?.parsed_output,
        }),
        resultKey: `${objectText}|${commandText}|${index}`,
      };
    }),
    summaryChips: [
      `${t("showResultCount")}: ${resultCount}`,
      `${t("showResultParsedCount")}: ${parsedResultCount}`,
    ],
    statusMessage: resultDisplay?.statusMessage || "",
    statusTone: resultDisplay?.statusTone || "info",
    title: t("showResultsTitle"),
  };
}

function singleShowPanelPresentation({
  modeState = {},
  previewRows = {},
  textfsmState = {},
  executionResult = EMPTY_RESULT,
  executeLoading = false,
} = {}) {
  const resultDisplay = showResultsExecutionDisplay(executionResult);
  const resultsDisplay = singleShowResultsPresentation(resultDisplay);
  const runDisplay = singleShowRunPresentation();
  return {
    selectionFields: showSelectionFieldsForQuery({
      modeState,
      previewRows,
      query: SHOW_QUERY.single,
    }),
    textfsmFields: showTextfsmFieldsForState(textfsmState),
    resultDisplay,
    resultsDisplay,
    runButtonDisplay: showRunButtonDisplayPresentation({
      executeButtonLabel: runDisplay.executeButtonLabel,
      executeLoading,
    }),
    runDisplay,
  };
}

function batchShowInputPresentation(fields = []) {
  return {
    executeButtonLabel: t("batchShowExecuteBtn"),
    fields: (Array.isArray(fields) ? fields : []).map((field) => ({
      ...field,
      labelText: t(field.labelKey),
      pickerPlaceholder: t(field.placeholderKey),
    })),
    targetsLabel: t("batchShowTargetsLabel"),
  };
}

function batchShowPanelPresentation({
  executeLoading = false,
  fields = [],
  modeState = {},
  previewRows = {},
  textfsmState = {},
} = {}) {
  const inputDisplay = batchShowInputPresentation(fields);
  return {
    inputDisplay,
    selectionFields: showSelectionFieldsForQuery({
      modeState,
      previewRows,
      query: SHOW_QUERY.batch,
    }),
    textfsmFields: showTextfsmFieldsForState(textfsmState),
    runButtonDisplay: showRunButtonDisplayPresentation({
      executeButtonLabel: inputDisplay.executeButtonLabel,
      executeLoading,
    }),
  };
}

function batchShowResultRows(showRows = []) {
  return (Array.isArray(showRows) ? showRows : []).map(
    (batchShowResult, index) => {
      const errorText = emptyString(batchShowResult?.error).trim();
      const command = safeString(batchShowResult?.command);
      const exitCodeText = safeString(batchShowResult?.exit_code ?? "-");
      const host = safeString(batchShowResult?.host);
      const mode = safeString(batchShowResult?.mode);
      const object = safeString(batchShowResult?.object);
      const platform = safeString(batchShowResult?.platform || "-");
      const profile = safeString(batchShowResult?.profile);
      const target = safeString(batchShowResult?.target);
      const deviceKey = target || host || `device-${index}`;
      const exportItem = {
        command: batchShowResult?.command,
        device: batchShowResult?.target,
        parse_error: batchShowResult?.parse_error,
        parsed_output: batchShowResult?.parsed_output,
      };
      return {
        command,
        error: errorText,
        exitCodeText,
        deviceKey,
        metaFields: [
          { label: t("showResultTarget"), value: target },
          { label: t("showObjectPlaceholder"), value: object },
          { label: t("showResultProfile"), value: profile },
          { label: t("showResultPlatform"), value: platform },
          { label: t("historyColMode"), value: mode },
          { label: t("txBlockResultExitCode"), value: exitCodeText },
          { label: t("fieldCommand"), mono: true, value: command },
        ],
        mode,
        modeText: mode || "-",
        object,
        objectText:
          object || command || `${t("showObjectPlaceholder")} ${index + 1}`,
        outputTitle: target || command || "Output",
        outputText: safeString(batchShowResult?.output),
        parsedOutputBlock: parsedOutputBlockDisplay({
          exportItem,
          parseError: batchShowResult?.parse_error,
          parsedOutput: batchShowResult?.parsed_output,
        }),
        platform,
        profile,
        resultKey: `${target}|${object}|${command}|${index}`,
        target,
        targetText: target || host || `${t("showResultTarget")} ${index + 1}`,
      };
    },
  );
}

function batchShowDeviceRows(resultRows = []) {
  const deviceRows = [];
  const deviceRowsByKey = new Map();
  for (const resultRow of Array.isArray(resultRows) ? resultRows : []) {
    let deviceRow = deviceRowsByKey.get(resultRow.deviceKey);
    if (!deviceRow) {
      deviceRow = {
        deviceKey: resultRow.deviceKey,
        objectRows: [],
        profileText: resultRow.profile || "-",
        targetText: resultRow.targetText,
      };
      deviceRowsByKey.set(resultRow.deviceKey, deviceRow);
      deviceRows.push(deviceRow);
    }
    deviceRow.objectRows.push(resultRow);
  }
  return deviceRows;
}

function batchShowResultsPresentation(batchPayload = null) {
  const batchResult =
    batchPayload && typeof batchPayload === "object" ? batchPayload : null;
  const resultRows = batchShowResultRows(batchResult?.results);
  const exportSheets = parsedOutputSheetsFromBatchShow(batchResult);
  return {
    deviceRows: batchShowDeviceRows(resultRows),
    exportButtonLabel: t("textfsmExportAllExcel"),
    exportAvailable: exportSheets.length > 0,
    exportFilename: "textfsm-batch-show.xlsx",
    exportSheets,
    hasResultRows: resultRows.length > 0,
    objectName: safeString(batchResult?.object),
    resultCount: resultRows.length,
    resultRows,
  };
}

async function exportSingleShowResultsExcel(singleShowResults = {}) {
  const exportSheets = Array.isArray(singleShowResults?.exportSheets)
    ? singleShowResults.exportSheets
    : [];
  return exportParsedOutputSheetsExcel(exportSheets, {
    filename: "textfsm-show.xlsx",
  });
}

function batchShowResultsDisplay(executionResult = null) {
  const display = executionResultDisplay(executionResult);
  const resultPayload = display.resultPayload || {};
  const resultRows = Array.isArray(resultPayload.results)
    ? resultPayload.results
    : [];
  return {
    ...display,
    showResultPanel: Boolean(
      display.statusMessage || resultPayload.object || resultRows.length,
    ),
  };
}

function createShowObjectSelectionWorkspace({ onModeChange = null } = {}) {
  const selectionFieldsStateStore = writable({});
  const selectionDisplayStateStore = derived(
    [selectionFieldsStateStore, currentLanguageState],
    ([$selectionFieldsStateStore, _currentLanguageState]) =>
      showObjectSelectionPresentation({
        selectedMode: $selectionFieldsStateStore.mode,
        modeOptions: $selectionFieldsStateStore.modeOptions,
      }),
  );
  return {
    changeMode(nextMode) {
      if (typeof onModeChange === "function") {
        onModeChange(nextMode);
      }
    },
    selectionDisplayStateStore,
    setSelectionFields(nextShowSelectionFields = {}) {
      selectionFieldsStateStore.set(nextShowSelectionFields);
    },
  };
}

function runAfterShowPageDomUpdate(afterDomUpdate, onReady) {
  if (typeof afterDomUpdate !== "function") {
    onReady();
    return;
  }
  afterDomUpdate(onReady);
}

function waitForShowPageDomUpdate(afterDomUpdate) {
  return new Promise((resolve) => {
    runAfterShowPageDomUpdate(afterDomUpdate, resolve);
  });
}

export function createShowPageWorkspace({ afterDomUpdate } = {}) {
  const batchShowExecutionResultStateStore = batchShowExecutionResultState();
  const currentQueryState = writable(DEFAULT_SHOW_PAGE_QUERY);
  const pageDisplayStateStore = derived(
    [currentQueryState, currentLanguageState],
    ([$currentQuery, _currentLanguageState]) => showPageDisplay($currentQuery),
  );
  const batchResultDisplayStateStore = derived(
    [batchShowExecutionResultStateStore, currentLanguageState],
    ([$batchShowExecutionResult, _currentLanguageState]) =>
      batchShowResultsDisplay($batchShowExecutionResult),
  );
  const batchResultsPresentationStateStore = derived(
    [batchResultDisplayStateStore, currentLanguageState],
    ([$batchResultDisplay, _currentLanguageState]) =>
      batchShowResultsPresentation($batchResultDisplay.resultPayload),
  );
  let lastExecutionProfile = "";
  let lastConnectionTargetKey = "";

  async function selectQuery(showQuery) {
    currentQueryState.set(normalizeShowQuery(showQuery));
    await waitForShowPageDomUpdate(afterDomUpdate);
    await refreshShowObjects();
  }

  function setRouteContext({ active = false, target = {}, profile = "" } = {}) {
    const nextConnectionTargetKey = showConnectionTargetIdentity(target);
    if (!active) {
      lastConnectionTargetKey = "";
      lastExecutionProfile = "";
      return;
    }
    if (lastConnectionTargetKey !== nextConnectionTargetKey) {
      lastConnectionTargetKey = nextConnectionTargetKey;
      void refreshShowObjects();
    }
    const executionProfile = safeString(profile).trim();
    if (lastExecutionProfile === executionProfile) return;
    lastExecutionProfile = executionProfile;
    void refreshShowExecutionModeOptions();
  }

  function destroy() {
    lastConnectionTargetKey = "";
    lastExecutionProfile = "";
  }

  return {
    batchResultDisplayStateStore,
    batchResultsPresentationStateStore,
    currentQueryState,
    destroy,
    pageDisplayStateStore,
    selectQuery,
    setRouteContext,
  };
}

export function createSingleShowPanelWorkspace() {
  const showCommandPreviewRowsStateStore = showCommandPreviewRowsState();
  const showExecutionResultStateStore = showExecutionResultState();
  const singleShowLoadingStateStore = writable({
    executeLoading: false,
    exportLoading: false,
  });
  const singleShowLoadingState = { keys: [] };
  const singleModePicker = modeSelection(MODE_SELECT.showSingle);
  const singleTextfsmPlatformPicker = textfsmPlatformSelection(
    TEXTFSM_PLATFORM_SELECT.standard,
  );
  const singleShowTextStateStore = writable({
    strictErrors: false,
    textfsmEnabled: true,
    textfsmTemplate: "",
  });
  const singleShowLoadingRunner = createLoadingStateRunner(
    singleShowLoadingState,
    {
      setKeys(keys) {
        singleShowLoadingStateStore.set({
          executeLoading: keys.includes("execute"),
          exportLoading: keys.includes("export"),
        });
      },
    },
  );
  const selectionPanelWorkspace = createShowObjectSelectionWorkspace({
    onModeChange: updateSingleShowMode,
  });
  const panelDisplayStateStore = derived(
    [
      singleModePicker.state,
      showCommandPreviewRowsStateStore,
      singleTextfsmPlatformPicker.state,
      singleShowTextStateStore,
      showExecutionResultStateStore,
      singleShowLoadingStateStore,
      currentLanguageState,
    ],
    ([
      $singleModeState,
      $showCommandPreviewRows,
      $singleTextfsmPlatformState,
      $singleShowTextState,
      $showExecutionResult,
      $singleShowLoadingState,
      _currentLanguageState,
    ]) =>
      singleShowPanelPresentation({
        modeState: $singleModeState,
        previewRows: $showCommandPreviewRows,
        textfsmState: {
          enabled: $singleShowTextState.textfsmEnabled,
          platformState: $singleTextfsmPlatformState,
          strictErrors: $singleShowTextState.strictErrors,
          template: $singleShowTextState.textfsmTemplate,
        },
        executionResult: $showExecutionResult,
        executeLoading: $singleShowLoadingState.executeLoading,
      }),
  );
  const singleShowResultsDisplayStateStore = derived(
    panelDisplayStateStore,
    ($panelDisplayStateStore) => $panelDisplayStateStore.resultsDisplay,
  );
  const exportLoadingStateStore = derived(
    singleShowLoadingStateStore,
    ($singleShowLoadingStateStore) => ({
      exportLoading: $singleShowLoadingStateStore.exportLoading,
    }),
  );
  const exportActionHandlersStateStore = derived(
    singleShowResultsDisplayStateStore,
    ($singleShowResultsDisplayStateStore) => ({
      export: () =>
        exportSingleShowResultExcel($singleShowResultsDisplayStateStore),
    }),
  );

  function updateSingleShowMode(showMode) {
    singleModePicker.setValue(showMode);
  }

  function updateSingleShowObjectSelection() {
    updateShowCommandPreview();
  }

  function updateSingleShowTextfsmEnabled(textfsmEnabled) {
    singleShowTextStateStore.update((state) => ({
      ...state,
      textfsmEnabled: !!textfsmEnabled,
    }));
  }

  async function updateSingleShowTextfsmPlatform(textfsmPlatform) {
    singleTextfsmPlatformPicker.setValue(textfsmPlatform);
    return loadShowObjects(textfsmPlatform);
  }

  function updateSingleShowTextfsmStrictErrors(textfsmStrictErrors) {
    singleShowTextStateStore.update((state) => ({
      ...state,
      strictErrors: !!textfsmStrictErrors,
    }));
  }

  function updateSingleShowTextfsmTemplate(textfsmTemplate) {
    singleShowTextStateStore.update((state) => ({
      ...state,
      textfsmTemplate: safeString(textfsmTemplate),
    }));
  }

  function setPanelContext({ active = false, panelDisplay = null } = {}) {
    if (!active || !panelDisplay) return;
    selectionPanelWorkspace.setSelectionFields(panelDisplay.selectionFields);
    setSingleShowFields(panelDisplay.selectionFields);
    setShowTextfsmFields(panelDisplay.textfsmFields);
  }

  async function executeSingleShow() {
    return singleShowLoadingRunner.run("execute", executeShowObject);
  }

  async function exportSingleShowResultExcel(resultsDisplay = null) {
    return singleShowLoadingRunner.run("export", () =>
      exportSingleShowResultsExcel(resultsDisplay),
    );
  }

  return {
    changeShowObject: updateSingleShowObjectSelection,
    changeShowObjectMode: selectionPanelWorkspace.changeMode,
    executeSingleShow,
    exportActionHandlersStateStore,
    exportLoadingStateStore,
    panelDisplayStateStore,
    selectionDisplayStateStore:
      selectionPanelWorkspace.selectionDisplayStateStore,
    setPanelContext,
    textfsmActionHandlers: {
      enabledChange: updateSingleShowTextfsmEnabled,
      platformChange: updateSingleShowTextfsmPlatform,
      strictErrorsChange: updateSingleShowTextfsmStrictErrors,
      templateChange: updateSingleShowTextfsmTemplate,
    },
  };
}

export function createBatchShowInputPanelWorkspace() {
  const showCommandPreviewRowsStateStore = showCommandPreviewRowsState();
  const batchShowLoadingStateStore = writable({
    executeLoading: false,
  });
  const batchShowLoadingState = { keys: [] };
  const batchModePicker = modeSelection(MODE_SELECT.showBatch);
  const batchTextfsmPlatformPicker = textfsmPlatformSelection(
    TEXTFSM_PLATFORM_SELECT.batchShow,
  );
  const batchShowTextStateStore = writable({
    excelName: "",
    strictErrors: false,
    textfsmEnabled: true,
  });
  const batchShowLoadingRunner = createLoadingStateRunner(
    batchShowLoadingState,
    {
      setKeys(keys) {
        batchShowLoadingStateStore.set({
          executeLoading: isBatchShowBusy(keys),
        });
      },
    },
  );
  const selectionPanelWorkspace = createShowObjectSelectionWorkspace({
    onModeChange: updateBatchShowMode,
  });
  const panelDisplayStateStore = derived(
    [
      batchModePicker.state,
      showCommandPreviewRowsStateStore,
      batchTextfsmPlatformPicker.state,
      batchShowTextStateStore,
      batchShowLoadingStateStore,
      currentLanguageState,
    ],
    ([
      $batchModeState,
      $showCommandPreviewRows,
      $batchTextfsmPlatformState,
      $batchShowTextState,
      $batchShowLoadingState,
      _currentLanguageState,
    ]) =>
      batchShowPanelPresentation({
        executeLoading: $batchShowLoadingState.executeLoading,
        fields: batchShowTargetPickerFields,
        modeState: $batchModeState,
        previewRows: $showCommandPreviewRows,
        textfsmState: {
          enabled: $batchShowTextState.textfsmEnabled,
          excelName: $batchShowTextState.excelName,
          platformState: $batchTextfsmPlatformState,
          strictErrors: $batchShowTextState.strictErrors,
        },
      }),
  );

  function updateBatchShowMode(showMode) {
    batchModePicker.setValue(showMode);
  }

  function updateBatchShowObjectSelection() {
    updateBatchShowCommandPreview();
  }

  function updateBatchShowTextfsmEnabled(textfsmEnabled) {
    batchShowTextStateStore.update((state) => ({
      ...state,
      textfsmEnabled: !!textfsmEnabled,
    }));
  }

  function updateBatchShowTextfsmExcelName(excelName) {
    batchShowTextStateStore.update((state) => ({
      ...state,
      excelName: safeString(excelName),
    }));
  }

  async function updateBatchShowTextfsmPlatform(textfsmPlatform) {
    batchTextfsmPlatformPicker.setValue(textfsmPlatform);
    return loadBatchShowObjects();
  }

  function updateBatchShowTextfsmStrictErrors(textfsmStrictErrors) {
    batchShowTextStateStore.update((state) => ({
      ...state,
      strictErrors: !!textfsmStrictErrors,
    }));
  }

  function setPanelContext({ active = false, panelDisplay = null } = {}) {
    if (!active || !panelDisplay) return;
    selectionPanelWorkspace.setSelectionFields(panelDisplay.selectionFields);
    setBatchShowFields(
      panelDisplay.selectionFields,
      panelDisplay.textfsmFields,
    );
  }

  async function executeBatchShowPanel() {
    return batchShowLoadingRunner.run("execute", executeBatchShowObject);
  }

  return {
    batchShowLoadingStateStore,
    changeShowObject: updateBatchShowObjectSelection,
    changeShowObjectMode: selectionPanelWorkspace.changeMode,
    executeBatchShowPanel,
    panelDisplayStateStore,
    selectionDisplayStateStore:
      selectionPanelWorkspace.selectionDisplayStateStore,
    setPanelContext,
    textfsmActionHandlers: {
      enabledChange: updateBatchShowTextfsmEnabled,
      excelNameChange: updateBatchShowTextfsmExcelName,
      platformChange: updateBatchShowTextfsmPlatform,
      strictErrorsChange: updateBatchShowTextfsmStrictErrors,
    },
  };
}

export function createBatchShowResultsPanelWorkspace() {
  const batchShowResultsLoadingStateStore = writable({
    exportLoading: false,
  });
  const batchResultsPresentationStateStore = writable(null);
  const batchShowResultsLoadingState = { keys: [] };
  const batchShowResultsLoadingRunner = createLoadingStateRunner(
    batchShowResultsLoadingState,
    {
      setKeys(keys) {
        batchShowResultsLoadingStateStore.set({
          exportLoading: keys.includes("export"),
        });
      },
    },
  );
  const exportLoadingStateStore = derived(
    batchShowResultsLoadingStateStore,
    ($batchShowResultsLoadingStateStore) => ({
      exportLoading: $batchShowResultsLoadingStateStore.exportLoading,
    }),
  );
  const exportActionHandlersStateStore = derived(
    batchResultsPresentationStateStore,
    ($batchResultsPresentationStateStore) => ({
      export: () =>
        exportBatchShowResultsExcel($batchResultsPresentationStateStore),
    }),
  );

  async function exportBatchShowResultsExcel(batchResultsPresentation = null) {
    const exportSheets = Array.isArray(batchResultsPresentation?.exportSheets)
      ? batchResultsPresentation.exportSheets
      : [];
    const exportFilename =
      batchResultsPresentation &&
      typeof batchResultsPresentation === "object" &&
      typeof batchResultsPresentation.exportFilename === "string"
        ? batchResultsPresentation.exportFilename
        : "";
    return batchShowResultsLoadingRunner.run("export", () =>
      exportParsedOutputSheetsExcel(exportSheets, {
        filename: exportFilename || "textfsm-batch-show.xlsx",
      }),
    );
  }

  return {
    exportActionHandlersStateStore,
    exportLoadingStateStore,
    setResultsContext({ batchResultsPresentation = null } = {}) {
      batchResultsPresentationStateStore.set(batchResultsPresentation);
    },
  };
}
