import {
  normalizeShowQuery,
  SHOW_QUERY,
} from "../../../config/dashboardModes.js";
import { derived, writable } from "svelte/store";
import type { Readable, Writable } from "svelte/store";
import { currentLanguageState, t } from "../../../lib/i18n.js";
import { createLoadingStateRunner } from "../../../lib/svelte.js";
import { emptyString, safeString } from "../../../lib/ui.js";
import {
  executionResultDisplay,
  executionResultFailed,
  executionResultOutputText,
  exportParsedOutputSheetsExcel,
  parsedOutputBlockDisplay,
  parsedOutputSheetsFromBatchShow,
  parsedOutputSheetsFromParsedOutputItems,
} from "../../../modules/operations/results.js";
import {
  MODE_SELECT,
  modeSelection,
  TEXTFSM_PLATFORM_SELECT,
  textfsmPlatformSelection,
} from "../../../modules/profiles/profiles.js";
import { batchShowTargetPickerFields } from "../../../modules/connections/connections.js";
import {
  batchShowExecutionResultState,
  batchShowObjectAvailabilityState,
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
  setBatchShowRetryFields,
  setShowTextfsmFields,
  setSingleShowFields,
  setSingleShowRetryFields,
  showCommandPreviewRowsState,
  showExecutionResultState,
  showObjectPickerKey,
  updateBatchShowCommandPreview,
  updateShowCommandPreview,
} from "./showExecutionState.js";
import { showConnectionTargetIdentity } from "../model/show.js";
import {
  showObjectSelectionPresentation,
  showPagePresentation,
} from "../presentation/showPresentation.js";
import {
  createSessionRetryState,
  sessionRetryValidation,
} from "../../../modules/operations/sessionRetry.js";
import type {
  BatchShowExecutionResult,
  BatchShowObjectAvailability,
  ShowCommandPreviewRow,
  ShowExecutionResult,
} from "../model/types.js";

type UnknownRecord = Record<string, unknown>;
type AfterDomUpdate = (onReady: () => void) => void;
type ExportSheet = { name: string; parsed_output: unknown };
type StatusTone = "error" | "info" | "running" | "success" | "warning";

interface ModePickerState {
  modes?: string[];
  profiles?: string[];
  selected?: unknown;
}

interface PickerController<T> {
  setValue(value: string): void;
  state: Readable<T>;
}

interface LoadingRunner {
  run<T>(key: string, operation: () => Promise<T> | T): Promise<T | undefined>;
}

interface SessionRetryState extends UnknownRecord {
  enabled: boolean;
  initialBackoffMs: string;
  maxBackoffMs: string;
  maxRetries: string;
  retryAuthenticationErrors: boolean;
}

interface ShowSelectionFields extends UnknownRecord {
  maxParallel?: string;
  mode: string;
  modeOptions: string[];
  objectPickerKey: string;
  previewRows: ShowCommandPreviewRow[];
  showResolvedCommandDetails: boolean;
}

interface ShowTextfsmFields extends UnknownRecord {
  enabled: boolean;
  excelName?: string;
  platform: string;
  platformOptions: string[];
  strictErrors: boolean;
  template: string;
}

interface ShowResultDisplay {
  basePayload: UnknownRecord | null;
  showResults: UnknownRecord[];
  statusMessage: string;
  statusTone: StatusTone;
}

interface BatchTargetPickerField extends UnknownRecord {
  key: string;
  keyName: string;
  labelKey: string;
  placeholderKey: string;
}

interface ParsedOutputBlock {
  [key: string]: unknown;
}

interface BatchExecutionDisplay extends UnknownRecord {
  resultPayload: UnknownRecord | null;
  statusMessage: string;
  statusTone: StatusTone;
}

const createRetryState = createSessionRetryState as () => SessionRetryState;
const validateRetryState = sessionRetryValidation as (
  value: SessionRetryState,
) => { valid: boolean };
const createLoadingRunner = createLoadingStateRunner as unknown as (
  state: { keys: string[] },
  config: { setKeys(keys: string[]): void },
) => LoadingRunner;
const createModeSelection = modeSelection as unknown as (
  key: string,
) => PickerController<ModePickerState>;
const createTextfsmPlatformSelection = textfsmPlatformSelection as unknown as (
  key: string,
) => PickerController<ModePickerState>;
const buildParsedOutputBlock = parsedOutputBlockDisplay as unknown as (input: {
  exportItem?: UnknownRecord;
  parseError?: unknown;
  parsedOutput?: unknown;
}) => ParsedOutputBlock;
const buildParsedOutputSheets =
  parsedOutputSheetsFromParsedOutputItems as unknown as (
    items: UnknownRecord[],
    config: {
      sheetName(item: UnknownRecord, index: number): unknown;
    },
  ) => ExportSheet[];
const buildBatchParsedOutputSheets =
  parsedOutputSheetsFromBatchShow as unknown as (
    payload: UnknownRecord | null,
  ) => ExportSheet[];
const buildExecutionResultDisplay = executionResultDisplay as unknown as (
  executionResult: BatchShowExecutionResult | null,
) => BatchExecutionDisplay;
const exportOutputSheets = exportParsedOutputSheetsExcel as unknown as (
  sheets: ExportSheet[],
  options: { filename: string },
) => Promise<unknown>;

function recordValue(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function showSelectionFieldsForQuery({
  modeState = {},
  previewRows = {},
  query = "",
}: {
  modeState?: ModePickerState;
  previewRows?: Record<string, ShowCommandPreviewRow[]>;
  query?: string;
} = {}): ShowSelectionFields {
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
}: {
  enabled?: boolean;
  excelName?: unknown;
  platformState?: ModePickerState;
  strictErrors?: boolean;
  template?: string;
} = {}): ShowTextfsmFields {
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

function showResultDisplayBase(
  statusMessage = "",
  statusTone: StatusTone = "info",
): ShowResultDisplay {
  return {
    basePayload: null,
    showResults: [],
    statusMessage,
    statusTone,
  };
}

function showResultsExecutionDisplay(
  showResult: ShowExecutionResult = EMPTY_RESULT,
): ShowResultDisplay {
  if (showResult.kind === "running") {
    return showResultDisplayBase(t("running"), "running");
  }
  if (showResult.kind === "error") {
    return showResultDisplayBase(showResult.message || "", "error");
  }
  if (showResult.kind === "result") {
    return {
      basePayload: showResult.basePayload || null,
      showResults: Array.isArray(showResult.results) ? showResult.results : [],
      statusMessage: "",
      statusTone: "info",
    };
  }
  return showResultDisplayBase();
}

function singleShowExportSheets(
  resultDisplay: ShowResultDisplay,
): ExportSheet[] {
  return buildParsedOutputSheets(resultDisplay.showResults, {
    sheetName: (showResult, index) =>
      showResult.object || showResult.command || `show_${index + 1}`,
  });
}

function singleShowResultsPresentation(resultDisplay: ShowResultDisplay) {
  const connection = recordValue(resultDisplay.basePayload?.connection);
  const exportSheets = singleShowExportSheets(resultDisplay);
  const showResults = Array.isArray(resultDisplay?.showResults)
    ? resultDisplay.showResults
    : [];
  const deviceName = safeString(
    connection.connection_name || connection.host || "",
  );
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
      const failed = executionResultFailed(showResult);
      return {
        ...showResult,
        commandText,
        failed,
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
        outputText: executionResultOutputText(showResult, "output", {
          preferTranscript: failed,
        }),
        parsedOutputBlock: buildParsedOutputBlock({
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
  retryState = createRetryState(),
}: {
  modeState?: ModePickerState;
  previewRows?: Record<string, ShowCommandPreviewRow[]>;
  textfsmState?: Parameters<typeof showTextfsmFieldsForState>[0];
  executionResult?: ShowExecutionResult;
  executeLoading?: boolean;
  retryState?: SessionRetryState;
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
    retryState,
    retryValid: validateRetryState(retryState).valid,
    runButtonDisplay: showRunButtonDisplayPresentation({
      executeButtonLabel: runDisplay.executeButtonLabel,
      executeLoading,
    }),
    runDisplay,
  };
}

function batchShowInputPresentation(
  fields: readonly BatchTargetPickerField[] = [],
) {
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

export function batchShowObjectAvailabilityPresentation(
  availability: BatchShowObjectAvailability = {
    connectionCount: 0,
    missingProfileNames: [],
    objectCount: 0,
    profiles: [],
    status: "waiting",
  },
): {
  canSelect: boolean;
  message: string;
  status: string;
  tone: StatusTone;
} {
  const status = safeString(availability?.status || "waiting");
  const missingProfileNames = Array.isArray(availability?.missingProfileNames)
    ? availability.missingProfileNames
    : [];
  const messages: Record<string, string> = {
    empty: t("batchShowObjectsEmptyIntersection"),
    error:
      safeString(availability?.errorMessage) || t("batchShowObjectsLoadFailed"),
    loading: t("batchShowObjectsLoading"),
    "missing-profile": t("batchShowObjectsMissingProfile").replace(
      "{names}",
      missingProfileNames.join(", ") || "-",
    ),
    "no-targets": t("batchShowObjectsNoTargets"),
    waiting: t("batchShowSelectTargetsFirst"),
  };
  return {
    canSelect: status === "ready",
    message: messages[status] || "",
    status,
    tone:
      status === "loading"
        ? "running"
        : ["error", "missing-profile"].includes(status)
          ? "error"
          : status === "empty" || status === "no-targets"
            ? "warning"
            : "info",
  };
}

function batchShowPanelPresentation({
  executeLoading = false,
  fields = [],
  maxParallel = "",
  modeState = {},
  objectAvailability = {
    connectionCount: 0,
    missingProfileNames: [],
    objectCount: 0,
    profiles: [],
    status: "waiting",
  },
  previewRows = {},
  textfsmState = {},
  retryState = createRetryState(),
}: {
  executeLoading?: boolean;
  fields?: readonly BatchTargetPickerField[];
  maxParallel?: string;
  modeState?: ModePickerState;
  objectAvailability?: BatchShowObjectAvailability;
  previewRows?: Record<string, ShowCommandPreviewRow[]>;
  textfsmState?: Parameters<typeof showTextfsmFieldsForState>[0];
  retryState?: SessionRetryState;
} = {}) {
  const inputDisplay = batchShowInputPresentation(fields);
  return {
    inputDisplay,
    objectAvailability:
      batchShowObjectAvailabilityPresentation(objectAvailability),
    selectionFields: {
      ...showSelectionFieldsForQuery({
        modeState,
        previewRows,
        query: SHOW_QUERY.batch,
      }),
      maxParallel: safeString(maxParallel),
    },
    textfsmFields: showTextfsmFieldsForState(textfsmState),
    retryState,
    retryValid: validateRetryState(retryState).valid,
    runButtonDisplay: showRunButtonDisplayPresentation({
      executeButtonLabel: inputDisplay.executeButtonLabel,
      executeLoading,
    }),
  };
}

function batchShowResultRows(showRows: UnknownRecord[] = []) {
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
      const failed = executionResultFailed(batchShowResult);
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
        failed,
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
        outputText: executionResultOutputText(batchShowResult, "output", {
          preferTranscript: failed,
        }),
        parsedOutputBlock: buildParsedOutputBlock({
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

function batchShowDeviceRows(
  resultRows: ReturnType<typeof batchShowResultRows> = [],
) {
  type ResultRow = ReturnType<typeof batchShowResultRows>[number];
  interface DeviceRow {
    deviceKey: string;
    objectRows: ResultRow[];
    profileText: string;
    targetText: string;
  }
  const deviceRows: DeviceRow[] = [];
  const deviceRowsByKey = new Map<string, DeviceRow>();
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

function batchShowResultsPresentation(
  batchPayload: UnknownRecord | null = null,
) {
  const batchResult = batchPayload ? recordValue(batchPayload) : null;
  const results = Array.isArray(batchResult?.results)
    ? (batchResult.results as UnknownRecord[])
    : [];
  const resultRows = batchShowResultRows(results);
  const exportSheets = buildBatchParsedOutputSheets(batchResult);
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

async function exportSingleShowResultsExcel(
  singleShowResults: ReturnType<typeof singleShowResultsPresentation> | null,
) {
  const exportSheets = Array.isArray(singleShowResults?.exportSheets)
    ? singleShowResults.exportSheets
    : [];
  return exportOutputSheets(exportSheets, {
    filename: "textfsm-show.xlsx",
  });
}

function batchShowResultsDisplay(
  executionResult: BatchShowExecutionResult | null = null,
) {
  const display = buildExecutionResultDisplay(executionResult);
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

function createShowObjectSelectionWorkspace({
  onModeChange,
}: {
  onModeChange?: (mode: string) => void;
} = {}) {
  const selectionFieldsStateStore = writable<ShowSelectionFields>({
    mode: "",
    modeOptions: [],
    objectPickerKey: "",
    previewRows: [],
    showResolvedCommandDetails: false,
  });
  const selectionDisplayStateStore = derived(
    [selectionFieldsStateStore, currentLanguageState],
    ([$selectionFieldsStateStore, _currentLanguageState]) =>
      showObjectSelectionPresentation({
        selectedMode: $selectionFieldsStateStore.mode,
        modeOptions: $selectionFieldsStateStore.modeOptions,
      }),
  );
  return {
    changeMode(nextMode: string) {
      if (onModeChange) {
        onModeChange(nextMode);
      }
    },
    selectionDisplayStateStore,
    setSelectionFields(nextShowSelectionFields: ShowSelectionFields) {
      selectionFieldsStateStore.set(nextShowSelectionFields);
    },
  };
}

function patchStoreField<T extends object, K extends keyof T>(
  stateStore: Writable<T>,
  field: K,
  value: T[K],
): void {
  stateStore.update((state) => ({ ...state, [field]: value }));
}

function runAfterShowPageDomUpdate(
  afterDomUpdate: AfterDomUpdate | undefined,
  onReady: () => void,
): void {
  if (!afterDomUpdate) {
    onReady();
    return;
  }
  afterDomUpdate(onReady);
}

function waitForShowPageDomUpdate(
  afterDomUpdate: AfterDomUpdate | undefined,
): Promise<void> {
  return new Promise<void>((resolve) => {
    runAfterShowPageDomUpdate(afterDomUpdate, resolve);
  });
}

export function createShowPageWorkspace({
  afterDomUpdate,
}: {
  afterDomUpdate?: AfterDomUpdate;
} = {}) {
  const batchShowExecutionResultStateStore = batchShowExecutionResultState();
  const currentQueryState = writable(DEFAULT_SHOW_PAGE_QUERY);
  const pageDisplayStateStore = derived(
    [currentQueryState, currentLanguageState],
    ([$currentQuery, _currentLanguageState]) =>
      showPagePresentation($currentQuery),
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

  async function selectQuery(showQuery: string): Promise<void> {
    currentQueryState.set(normalizeShowQuery(showQuery));
    await waitForShowPageDomUpdate(afterDomUpdate);
    await refreshShowObjects();
  }

  function setRouteContext({
    active = false,
    target = {},
    profile = "",
  }: {
    active?: boolean;
    target?: UnknownRecord;
    profile?: string;
  } = {}): void {
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

  function destroy(): void {
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
  const singleModePicker = createModeSelection(MODE_SELECT.showSingle);
  const singleTextfsmPlatformPicker = createTextfsmPlatformSelection(
    TEXTFSM_PLATFORM_SELECT.standard,
  );
  const singleShowTextStateStore = writable({
    strictErrors: false,
    textfsmEnabled: true,
    textfsmTemplate: "",
  });
  const singleShowRetryStateStore = writable(createRetryState());
  const singleShowLoadingRunner = createLoadingRunner(singleShowLoadingState, {
    setKeys(keys: string[]) {
      singleShowLoadingStateStore.set({
        executeLoading: keys.includes("execute"),
        exportLoading: keys.includes("export"),
      });
    },
  });
  const selectionPanelWorkspace = createShowObjectSelectionWorkspace({
    onModeChange: (mode: string) => singleModePicker.setValue(mode),
  });
  const panelDisplayStateStore = derived(
    [
      singleModePicker.state,
      showCommandPreviewRowsStateStore,
      singleTextfsmPlatformPicker.state,
      singleShowTextStateStore,
      singleShowRetryStateStore,
      showExecutionResultStateStore,
      singleShowLoadingStateStore,
      currentLanguageState,
    ],
    ([
      $singleModeState,
      $showCommandPreviewRows,
      $singleTextfsmPlatformState,
      $singleShowTextState,
      $singleShowRetryState,
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
        retryState: $singleShowRetryState,
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

  async function updateSingleShowTextfsmPlatform(
    textfsmPlatform: string,
  ): Promise<void> {
    singleTextfsmPlatformPicker.setValue(textfsmPlatform);
    return loadShowObjects(textfsmPlatform);
  }

  function setPanelContext({
    active = false,
    panelDisplay = null,
  }: {
    active?: boolean;
    panelDisplay?: ReturnType<typeof singleShowPanelPresentation> | null;
  } = {}): void {
    if (!active || !panelDisplay) return;
    selectionPanelWorkspace.setSelectionFields(panelDisplay.selectionFields);
    setSingleShowFields(panelDisplay.selectionFields);
    setShowTextfsmFields(panelDisplay.textfsmFields);
    setSingleShowRetryFields(panelDisplay.retryState);
  }

  function changeSessionRetry(retry: Partial<SessionRetryState> = {}): void {
    const nextRetry = { ...createRetryState(), ...retry };
    singleShowRetryStateStore.set(nextRetry);
    setSingleShowRetryFields(nextRetry);
  }

  async function executeSingleShow(): Promise<void | undefined> {
    return singleShowLoadingRunner.run("execute", executeShowObject);
  }

  async function exportSingleShowResultExcel(
    resultsDisplay: ReturnType<
      typeof singleShowResultsPresentation
    > | null = null,
  ) {
    return singleShowLoadingRunner.run("export", () =>
      exportSingleShowResultsExcel(resultsDisplay),
    );
  }

  const textfsmActionHandlers = {
    enabledChange: (enabled: boolean) =>
      patchStoreField(singleShowTextStateStore, "textfsmEnabled", !!enabled),
    platformChange: updateSingleShowTextfsmPlatform,
    strictErrorsChange: (strictErrors: boolean) =>
      patchStoreField(singleShowTextStateStore, "strictErrors", !!strictErrors),
    templateChange: (template: string) =>
      patchStoreField(
        singleShowTextStateStore,
        "textfsmTemplate",
        safeString(template),
      ),
  };

  return {
    changeShowObject: updateShowCommandPreview,
    changeShowObjectMode: selectionPanelWorkspace.changeMode,
    changeSessionRetry,
    executeSingleShow,
    exportActionHandlersStateStore,
    exportLoadingStateStore,
    panelDisplayStateStore,
    selectionDisplayStateStore:
      selectionPanelWorkspace.selectionDisplayStateStore,
    setPanelContext,
    textfsmActionHandlers,
  };
}

export function createBatchShowInputPanelWorkspace() {
  const showCommandPreviewRowsStateStore = showCommandPreviewRowsState();
  const batchShowObjectAvailabilityStateStore =
    batchShowObjectAvailabilityState();
  const batchShowLoadingStateStore = writable({
    executeLoading: false,
  });
  const batchShowLoadingState = { keys: [] };
  const batchModePicker = createModeSelection(MODE_SELECT.showBatch);
  const batchTextfsmPlatformPicker = createTextfsmPlatformSelection(
    TEXTFSM_PLATFORM_SELECT.batchShow,
  );
  const batchShowTextStateStore = writable({
    excelName: "",
    maxParallel: "",
    strictErrors: false,
    textfsmEnabled: true,
  });
  const batchShowRetryStateStore = writable(createRetryState());
  const batchShowLoadingRunner = createLoadingRunner(batchShowLoadingState, {
    setKeys(keys: string[]) {
      batchShowLoadingStateStore.set({
        executeLoading: isBatchShowBusy(keys),
      });
    },
  });
  const selectionPanelWorkspace = createShowObjectSelectionWorkspace({
    onModeChange: (mode: string) => batchModePicker.setValue(mode),
  });
  const panelDisplayStateStore = derived(
    [
      batchModePicker.state,
      showCommandPreviewRowsStateStore,
      batchTextfsmPlatformPicker.state,
      batchShowTextStateStore,
      batchShowRetryStateStore,
      batchShowLoadingStateStore,
      batchShowObjectAvailabilityStateStore,
      currentLanguageState,
    ],
    ([
      $batchModeState,
      $showCommandPreviewRows,
      $batchTextfsmPlatformState,
      $batchShowTextState,
      $batchShowRetryState,
      $batchShowLoadingState,
      $batchShowObjectAvailability,
      _currentLanguageState,
    ]) =>
      batchShowPanelPresentation({
        executeLoading: $batchShowLoadingState.executeLoading,
        fields: batchShowTargetPickerFields,
        maxParallel: $batchShowTextState.maxParallel,
        modeState: $batchModeState,
        objectAvailability: $batchShowObjectAvailability,
        previewRows: $showCommandPreviewRows,
        retryState: $batchShowRetryState,
        textfsmState: {
          enabled: $batchShowTextState.textfsmEnabled,
          excelName: $batchShowTextState.excelName,
          platformState: $batchTextfsmPlatformState,
          strictErrors: $batchShowTextState.strictErrors,
        },
      }),
  );

  async function updateBatchShowTextfsmPlatform(
    textfsmPlatform: string,
  ): Promise<void> {
    batchTextfsmPlatformPicker.setValue(textfsmPlatform);
    return loadBatchShowObjects();
  }

  function setPanelContext({
    active = false,
    panelDisplay = null,
  }: {
    active?: boolean;
    panelDisplay?: ReturnType<typeof batchShowPanelPresentation> | null;
  } = {}): void {
    if (!active || !panelDisplay) return;
    selectionPanelWorkspace.setSelectionFields(panelDisplay.selectionFields);
    setBatchShowFields(
      panelDisplay.selectionFields,
      panelDisplay.textfsmFields,
    );
    setBatchShowRetryFields(panelDisplay.retryState);
  }

  function changeSessionRetry(retry: Partial<SessionRetryState> = {}): void {
    const nextRetry = { ...createRetryState(), ...retry };
    batchShowRetryStateStore.set(nextRetry);
    setBatchShowRetryFields(nextRetry);
  }

  async function executeBatchShowPanel(): Promise<void | undefined> {
    return batchShowLoadingRunner.run("execute", executeBatchShowObject);
  }

  const textfsmActionHandlers = {
    enabledChange: (enabled: boolean) =>
      patchStoreField(batchShowTextStateStore, "textfsmEnabled", !!enabled),
    excelNameChange: (excelName: string) =>
      patchStoreField(
        batchShowTextStateStore,
        "excelName",
        safeString(excelName),
      ),
    platformChange: updateBatchShowTextfsmPlatform,
    strictErrorsChange: (strictErrors: boolean) =>
      patchStoreField(batchShowTextStateStore, "strictErrors", !!strictErrors),
  };

  function changeBatchMaxParallel(maxParallel: string): void {
    patchStoreField(
      batchShowTextStateStore,
      "maxParallel",
      safeString(maxParallel).trim(),
    );
  }

  return {
    batchShowLoadingStateStore,
    changeBatchMaxParallel,
    changeBatchTargets: loadBatchShowObjects,
    changeShowObject: updateBatchShowCommandPreview,
    changeShowObjectMode: selectionPanelWorkspace.changeMode,
    changeSessionRetry,
    executeBatchShowPanel,
    panelDisplayStateStore,
    selectionDisplayStateStore:
      selectionPanelWorkspace.selectionDisplayStateStore,
    setPanelContext,
    textfsmActionHandlers,
  };
}

export function createBatchShowResultsPanelWorkspace() {
  const batchShowResultsLoadingStateStore = writable({
    exportLoading: false,
  });
  const batchResultsPresentationStateStore = writable<ReturnType<
    typeof batchShowResultsPresentation
  > | null>(null);
  const batchShowResultsLoadingState = { keys: [] };
  const batchShowResultsLoadingRunner = createLoadingRunner(
    batchShowResultsLoadingState,
    {
      setKeys(keys: string[]) {
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

  async function exportBatchShowResultsExcel(
    batchResultsPresentation: ReturnType<
      typeof batchShowResultsPresentation
    > | null = null,
  ) {
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
      exportOutputSheets(exportSheets, {
        filename: exportFilename || "textfsm-batch-show.xlsx",
      }),
    );
  }

  return {
    exportActionHandlersStateStore,
    exportLoadingStateStore,
    setResultsContext({
      batchResultsPresentation = null,
    }: {
      batchResultsPresentation?: ReturnType<
        typeof batchShowResultsPresentation
      > | null;
    } = {}) {
      batchResultsPresentationStateStore.set(batchResultsPresentation);
    },
  };
}
