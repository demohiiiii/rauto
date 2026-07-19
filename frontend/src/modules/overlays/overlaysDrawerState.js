import { derived, get, writable } from "svelte/store";
import {
  storageGet,
  storageSet,
  writeClipboardText,
} from "../../lib/browser.js";
import {
  callbackFormCheckedHandler,
  callbackFormValueHandler,
} from "../../lib/events.js";
import { classNames, displayMode, displayText } from "../../lib/ui.js";
import { displayModeTabs } from "../../config/dashboardModes.js";
import { currentLanguageState, tr } from "../../lib/i18n.js";
import {
  eventEntriesPresentation,
  formatHistoryTime,
  historyEntryOpenHandler,
  openEntryDrawer,
} from "./overlaysDetail.js";

const recordDrawerPreferenceStorage = {
  displayMode: "rauto_record_view_mode",
  failedOnly: "rauto_record_failed_only",
  eventKind: "rauto_record_event_kind",
  searchQuery: "rauto_record_search_query",
};

const recordDrawerDefaultPreferences = {
  displayMode: "list",
  eventKind: "all",
  failedOnly: false,
  searchQuery: "",
};

export const overlayDrawerState = writable({
  historyDrawerOpen: false,
  recordDrawerOpen: false,
  recordFabCount: 0,
});

export const recordDrawerRecordingState = writable({
  jsonl: "",
  version: 0,
});

export const recordLevelState = writable("key-events-only");

export const replayJsonlTransferState = writable({
  jsonl: "",
  version: 0,
});

export const replayStatusTextState = writable({
  text: "",
  version: 0,
});

const recordDrawerEventKindOptions = [
  ["all", "eventTypeAll"],
  ["command_output", "command_output"],
  ["connection_established", "connection_established"],
  ["connection_closed", "connection_closed"],
  ["prompt_changed", "prompt_changed"],
  ["state_changed", "state_changed"],
  ["raw_chunk", "raw_chunk"],
];

function recordDrawerEventKindOptionRows(t = tr) {
  return recordDrawerEventKindOptions.map(
    ([recordEventKindValue, recordEventKindLabelKey]) => ({
      label:
        recordEventKindValue === "all"
          ? t(recordEventKindLabelKey)
          : recordEventKindLabelKey,
      value: recordEventKindValue,
    }),
  );
}

const historyDrawerOperationValues =
  "all|exec|template_execute|tx_block|tx_workflow|orchestrate_tx_block|orchestrate_tx_workflow|orchestrate_compensation".split(
    "|",
  );

function historyDrawerOperationOptions(t = tr) {
  return historyDrawerOperationValues.map((historyOperation) => ({
    label:
      historyOperation === "all"
        ? t("historyFilterOperationAll")
        : historyOperationLabel(historyOperation, t),
    value: historyOperation,
  }));
}

function updateOverlayDrawerState(patch = {}) {
  overlayDrawerState.update((state) => ({ ...state, ...patch }));
}

export const openRecordDrawer = () =>
  updateOverlayDrawerState({ recordDrawerOpen: true });
export const closeRecordDrawer = () =>
  updateOverlayDrawerState({ recordDrawerOpen: false });
export const openHistoryDrawer = () =>
  updateOverlayDrawerState({ historyDrawerOpen: true });
export const closeHistoryDrawer = () =>
  updateOverlayDrawerState({ historyDrawerOpen: false });

function recordDrawerShellDisplay(overlayState = {}) {
  const title = tr("recordingTitle");
  return {
    ariaLabelText: title,
    closeLabel: tr("recordDrawerClose"),
    open: !!overlayState.recordDrawerOpen,
    subtitle: tr("recordDrawerSubtitle"),
    title,
  };
}

function historyItemMatchesSearch(historyItem = {}, query = "") {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();
  if (!normalizedQuery) return true;
  return [
    historyItem.command_label,
    historyItem.operation,
    historyItem.mode,
    historyItem.device_profile,
    historyItem.connection_name,
    historyItem.host,
    historyItem.port,
    historyItem.username,
  ]
    .filter((historyFieldValue) => historyFieldValue != null)
    .map((historyFieldValue) => String(historyFieldValue).toLowerCase())
    .join("\n")
    .includes(normalizedQuery);
}

function historyDrawerFilteredItems(historyItems = [], filters = {}) {
  const operation = String(filters.operation || "all").toLowerCase();
  return (Array.isArray(historyItems) ? historyItems : [])
    .filter((historyItem) => {
      const itemOperation = String(historyItem.operation || "").toLowerCase();
      const operationMatches =
        operation === "all" ? true : itemOperation === operation;
      return (
        operationMatches && historyItemMatchesSearch(historyItem, filters.query)
      );
    })
    .sort((a, b) => Number(a.ts_ms || 0) - Number(b.ts_ms || 0));
}

function historyOperationLabel(raw, t = tr) {
  const historyOperation = displayText(raw).toLowerCase();
  if (historyOperation === "exec") return t("historyOperationExec", "Execute");
  if (historyOperation === "template_execute") {
    return t("historyOperationTemplateExecute", "Template Execute");
  }
  return historyOperation || "-";
}

function historyDrawerBadgeClass(toneClass) {
  return classNames(
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
    toneClass,
  );
}

function historyOperationBadgeDisplay(raw) {
  const historyOperation = displayText(raw).toLowerCase();
  const toneClass =
    historyOperation === "template_execute"
      ? "border-cyan-200 bg-cyan-100 text-cyan-800"
      : "border-indigo-200 bg-indigo-100 text-indigo-800";
  return {
    badgeClass: historyDrawerBadgeClass(toneClass),
    label: historyOperationLabel(raw),
  };
}

function historyRecordLevelBadgeDisplay(raw) {
  const recordLevel = displayText(raw).toLowerCase();
  const toneClass =
    recordLevel === "full"
      ? "border-violet-200 bg-violet-100 text-violet-800"
      : "border-emerald-200 bg-emerald-100 text-emerald-800";
  return {
    badgeClass: historyDrawerBadgeClass(toneClass),
    label: displayText(raw || "-"),
  };
}

function historyDrawerRow(historyItem = {}, index = 0) {
  const operationBadge = historyOperationBadgeDisplay(historyItem.operation);
  const recordLevelBadge = historyRecordLevelBadgeDisplay(
    historyItem.record_level,
  );
  return {
    commandLabel: displayText(historyItem.command_label),
    connectionName: displayText(historyItem.connection_name || "-"),
    deleteButtonLabel: tr("historyDeleteBtn", "Delete"),
    deviceProfile: displayText(historyItem.device_profile),
    detailButtonLabel: tr("actionViewDetail", "View"),
    historyId: historyItem.id || "",
    hostPort: `${displayText(historyItem.host)}:${displayText(historyItem.port)}`,
    indexText: String(index + 1),
    modeBadgeClass: historyDrawerBadgeClass(
      "border-amber-200 bg-amber-100 text-amber-800",
    ),
    modeText: displayMode(historyItem.mode) || "-",
    operationBadgeClass: operationBadge.badgeClass,
    operationLabel: operationBadge.label,
    recordLevelBadgeClass: recordLevelBadge.badgeClass,
    recordLevelText: recordLevelBadge.label,
    timestampText: formatHistoryTime(historyItem.ts_ms),
  };
}

function historyDrawerFilteredRows(historyItems = [], filters = {}) {
  return historyDrawerFilteredItems(historyItems, filters).map(
    historyDrawerRow,
  );
}

function historyDrawerFiltersPresentation(operationOptionRows = []) {
  return {
    clearButtonLabel: tr("historyFilterClear"),
    limitLabel: tr("historyColLimit", "Limit"),
    limitOptionRows: [10, 20, 30, 50].map((limitValue) => ({
      label: String(limitValue),
      value: limitValue,
    })),
    operationLabel: tr("historyColOperation", "Operation"),
    operationOptionRows,
    queryPlaceholder: tr("historyFilterPlaceholder"),
  };
}

function historyDrawerListPresentation(
  historyItems = [],
  filteredRows = [],
  status = {},
) {
  const hasItems = Array.isArray(historyItems) && historyItems.length > 0;
  const hasRows = Array.isArray(filteredRows) && filteredRows.length > 0;
  return {
    emptyStatus: hasItems
      ? {
          message: tr("noMatchedEntries", "no matched entries"),
          tone: "info",
        }
      : {
          message: displayText(status.message || "-"),
          tone: status.tone || "info",
        },
    hasRows: hasItems && hasRows,
  };
}

export function historyDrawerPresentation({
  drawerState = {},
  filterState = {},
  overlayState = {},
} = {}) {
  const shellTitle = tr("historyDrawerTitle");
  const historyItems = Array.isArray(drawerState.historyItems)
    ? drawerState.historyItems
    : [];
  const query = filterState.query || "";
  const operation = filterState.operation || "all";
  const status = drawerState.status || {
    message: tr("savedConnHistoryEmpty", "no history"),
    tone: "info",
  };
  const filteredRows = historyDrawerFilteredRows(historyItems, {
    operation,
    query,
  });
  const listDisplay = historyDrawerListPresentation(
    historyItems,
    filteredRows,
    status,
  );

  return {
    connectionLabel: displayText(drawerState.connectionLabel || "-"),
    connectionTitle: tr("historyDrawerConnLabel"),
    emptyStatus: listDisplay.emptyStatus,
    filtersDisplay: historyDrawerFiltersPresentation(
      historyDrawerOperationOptions(),
    ),
    filteredRows,
    hasRows: listDisplay.hasRows,
    limit: filterState.limit || 30,
    listTitle: tr("historyListTitle", "History Records"),
    modeLabel: tr("historyColMode", "Mode"),
    operation,
    query,
    recordLevelLabel: tr("historyColLevel", "Level"),
    refreshButtonLabel: tr("historyDrawerRefresh"),
    refreshLoading: !!drawerState.refreshLoading,
    rowCountText: `${filteredRows.length} ${tr("historyListCountSuffix", "records")}`,
    shellDisplay: {
      ariaLabelText: shellTitle,
      closeLabel: tr("close"),
      open: !!overlayState.historyDrawerOpen,
      subtitle: tr("historyDrawerSubtitle"),
      title: shellTitle,
    },
    tableHeaderCells:
      "historyColIndex|#,historyColTime|Time,historyColOperation|Operation,historyColCommand|Command,historyColMode|Mode,historyColProfile|Profile,historyColLevel|Level,tableAction|Action"
        .split(",")
        .map((definition) => {
          const [labelKey, fallback] = definition.split("|");
          return { labelText: tr(labelKey, fallback) };
        }),
  };
}

const setRecordFabCount = (count) =>
  updateOverlayDrawerState({ recordFabCount: Math.max(0, Number(count) || 0) });

function normalizeRecordLevel(level) {
  return String(level || "").trim() === "full" ? "full" : "key-events-only";
}

function nextRecordLevel(level) {
  return normalizeRecordLevel(level) === "full" ? "key-events-only" : "full";
}

function recordToolPresentation(level) {
  const normalized = normalizeRecordLevel(level);
  return {
    hintKey:
      normalized === "full" ? "recordLevelFullHint" : "recordLevelAuditHint",
    labelKey: normalized === "full" ? "recordLevelFull" : "recordLevelAudit",
  };
}

export function dashboardRecordToolsPresentation({
  recordLevel,
  overlayState = {},
} = {}) {
  const levelDisplay = recordToolPresentation(recordLevel);
  const recordFabCount = Math.max(0, Number(overlayState.recordFabCount) || 0);
  return {
    historyButtonLabel: tr("savedConnHistoryBtn"),
    levelHintText: tr(levelDisplay.hintKey),
    levelLabelText: tr(levelDisplay.labelKey),
    recordFabBadgeText: recordFabCount > 99 ? "99+" : String(recordFabCount),
    recordFabHasCount: recordFabCount > 0,
    recordFabTitle: tr("recordFabTitle"),
    recordLevelLabel: tr("recordLevelLabel"),
  };
}

const setRecordLevel = (level) =>
  recordLevelState.set(normalizeRecordLevel(level));
export const toggleRecordLevel = () =>
  setRecordLevel(nextRecordLevel(get(recordLevelState)));
export const recordLevelPayload = () =>
  normalizeRecordLevel(get(recordLevelState));

export function applyRecordDrawerRecording(recordingPayload) {
  const jsonl = recordingPayload?.recording_jsonl
    ? String(recordingPayload.recording_jsonl)
    : "";
  if (!jsonl) return;
  recordDrawerRecordingState.update((state) => ({
    jsonl,
    version: (state?.version || 0) + 1,
  }));
}

function createRecordDrawerRecordingSync() {
  let appliedRecordingVersion = 0;
  return {
    apply(recording = {}, setRecordingJsonl) {
      if (!recording.version || recording.version === appliedRecordingVersion) {
        return;
      }
      appliedRecordingVersion = recording.version;
      setRecordingJsonl(recording.jsonl || "");
    },
  };
}

function showReplayStatus(text) {
  replayStatusTextState.update((state) => ({
    text: text || "",
    version: (state?.version || 0) + 1,
  }));
}

function setReplayJsonlFromRecording(jsonl) {
  replayJsonlTransferState.update((state) => ({
    jsonl: jsonl || "",
    version: (state?.version || 0) + 1,
  }));
  showReplayStatus(tr("recordingSetToReplay", "recording copied to replay"));
}

function normalizeRecordDrawerMode(displayMode) {
  return displayMode === "raw" ? "raw" : "list";
}

function recordDrawerDisplayModePresentation(mode = "") {
  const normalized = normalizeRecordDrawerMode(mode);
  return {
    mode: normalized,
    showList: normalized === "list",
    showRaw: normalized === "raw",
  };
}

function normalizeRecordDrawerEventKind(eventKind) {
  const normalizedEventKind = String(eventKind || "").trim();
  return recordDrawerEventKindOptions.some(
    ([kind]) => kind === normalizedEventKind,
  )
    ? normalizedEventKind
    : "all";
}

const recordDrawerEventKindValue = normalizeRecordDrawerEventKind;
const recordDrawerSearchQueryValue = (searchQuery) => String(searchQuery || "");
const recordDrawerRawTextValue = recordDrawerSearchQueryValue;

function defaultRecordDrawerFilters() {
  const { eventKind, failedOnly, searchQuery } = recordDrawerDefaultPreferences;
  return {
    eventKind,
    failedOnly,
    searchQuery,
  };
}

function defaultRecordDrawerPreferences() {
  return { ...recordDrawerDefaultPreferences };
}

function loadRecordDrawerPreferences() {
  return {
    displayMode: normalizeRecordDrawerMode(
      storageGet(
        recordDrawerPreferenceStorage.displayMode,
        recordDrawerDefaultPreferences.displayMode,
      ),
    ),
    eventKind: normalizeRecordDrawerEventKind(
      storageGet(
        recordDrawerPreferenceStorage.eventKind,
        recordDrawerDefaultPreferences.eventKind,
      ),
    ),
    failedOnly: storageGet(recordDrawerPreferenceStorage.failedOnly) === "true",
    searchQuery: storageGet(
      recordDrawerPreferenceStorage.searchQuery,
      recordDrawerDefaultPreferences.searchQuery,
    ),
  };
}

function saveRecordDrawerPreferences(preferences = {}) {
  const nextPreferences = {
    ...recordDrawerDefaultPreferences,
    ...preferences,
  };
  storageSet(
    recordDrawerPreferenceStorage.displayMode,
    normalizeRecordDrawerMode(nextPreferences.displayMode),
  );
  storageSet(
    recordDrawerPreferenceStorage.failedOnly,
    String(Boolean(nextPreferences.failedOnly)),
  );
  storageSet(
    recordDrawerPreferenceStorage.eventKind,
    normalizeRecordDrawerEventKind(nextPreferences.eventKind),
  );
  storageSet(
    recordDrawerPreferenceStorage.searchQuery,
    nextPreferences.searchQuery || "",
  );
}

function recordDrawerEmptyText(filters = {}, t = tr) {
  if (filters.failedOnly) return t("noFailedEntries");
  if (normalizeRecordDrawerEventKind(filters.eventKind) !== "all") {
    return t("noMatchedEntries");
  }
  return t("recordListEmpty");
}

function drawerInputField(value, placeholderKey, t = tr) {
  const placeholder = t(placeholderKey);
  return {
    ariaLabelText: placeholder,
    placeholder,
    value: displayText(value),
  };
}

function recordDrawerContentPresentation(jsonl = "", filters = {}) {
  const parsedRecording = parseJsonl(jsonl, tr);
  const eventEntries = parsedRecording.ok
    ? filterEntries(
        parsedRecording.recordRows,
        filters.eventKind,
        filters.failedOnly,
        filters.searchQuery,
      )
    : [];
  const eventEntriesDisplay = eventEntriesPresentation(eventEntries);
  return {
    emptyText: recordDrawerEmptyText(filters),
    eventEntries,
    entryCount: eventEntriesDisplay.entryCount,
    entryRows: eventEntriesDisplay.entryRows,
    hasEntries: eventEntriesDisplay.hasEntries,
    parseError: parsedRecording.ok ? "" : parsedRecording.error,
    statCards: eventEntriesDisplay.statCards,
  };
}

function recordDrawerContentPropsPresentation({
  contentDisplay = {},
  displayModeDisplay = {},
  displayMode = "list",
  eventKind = "all",
  failedOnly = false,
  modeTabs = [],
  rawText = "",
  recordDisplay = {},
  recordLevel = "key-events-only",
  searchQuery = "",
  t = tr,
} = {}) {
  return {
    content: {
      emptyText: contentDisplay.emptyText,
      entryRows: contentDisplay.entryRows || [],
      hasEntries: contentDisplay.hasEntries,
      parseError: contentDisplay.parseError,
      parseErrorStatus: { tone: "error" },
      rawField: drawerInputField(rawText, "recordJsonlPlaceholder", t),
      showListPanel: displayModeDisplay.showList,
      showRawPanel: displayModeDisplay.showRaw,
      statCards: contentDisplay.statCards || [],
      tableHeaderCells: contentDisplay.tableHeaderCells || [],
    },
    controls: {
      clearButtonLabel: t("clearFilters"),
      copyButtonLabel: t("recordCopyBtn"),
      displayMode,
      displayModeLabel: t("recordDisplayModeLabel"),
      eventKind,
      eventKindLabel: t("eventTypeLabel"),
      eventKindOptionRows: recordDrawerEventKindOptionRows(t),
      failedOnly,
      failedOnlyLabel: t("failedOnly"),
      modeTabs,
      recordLevel,
      recordLevelHint: t(recordDisplay.hintKey),
      recordLevelLabel: t("recordLevelLabel"),
      recordLevelOptionRows: [
        { label: t("recordLevelAudit"), value: "key-events-only" },
        { label: t("recordLevelFull"), value: "full" },
      ],
      searchField: drawerInputField(searchQuery, "searchPlaceholder", t),
      useReplayButtonLabel: t("recordUseReplayBtn"),
    },
  };
}

export function createRecordDrawerWorkspace({
  onCopyRecordDrawerRecording = copyRecordDrawerRecording,
  onLoadRecordDrawerPreferences = loadRecordDrawerPreferences,
  onOpenEntryDrawer = openEntryDrawer,
  onSaveRecordDrawerPreferences = saveRecordDrawerPreferences,
  onSetRecordFabCount = setRecordFabCount,
  onSetRecordLevel = setRecordLevel,
  onSetReplayJsonlFromRecording = setReplayJsonlFromRecording,
} = {}) {
  const defaultPreferences = defaultRecordDrawerPreferences();
  const displayModeStore = writable(defaultPreferences.displayMode);
  const eventKindStore = writable(defaultPreferences.eventKind);
  const failedOnlyStore = writable(defaultPreferences.failedOnly);
  const recordingJsonlStore = writable("");
  const searchQueryStore = writable(defaultPreferences.searchQuery);
  const recordingSync = createRecordDrawerRecordingSync();
  let appliedEntryCount = 0;
  const drawerShellDisplayStateStore = derived(
    [overlayDrawerState, currentLanguageState],
    ([$overlayDrawerState, _currentLanguageState]) =>
      recordDrawerShellDisplay($overlayDrawerState),
  );
  const contentDisplayStateStore = derived(
    [
      recordingJsonlStore,
      eventKindStore,
      failedOnlyStore,
      searchQueryStore,
      currentLanguageState,
    ],
    ([
      $recordingJsonlStore,
      $eventKindStore,
      $failedOnlyStore,
      $searchQueryStore,
      _currentLanguageState,
    ]) =>
      recordDrawerContentPresentation($recordingJsonlStore, {
        eventKind: $eventKindStore,
        failedOnly: $failedOnlyStore,
        searchQuery: $searchQueryStore,
      }),
  );
  const displayModePresentationStateStore = derived(
    displayModeStore,
    ($displayModeStore) =>
      recordDrawerDisplayModePresentation($displayModeStore),
  );
  const recordDisplayStateStore = derived(
    [recordLevelState, currentLanguageState],
    ([$recordLevelState, _currentLanguageState]) =>
      recordToolPresentation($recordLevelState),
  );
  const drawerContentDisplayStateStore = derived(
    [
      contentDisplayStateStore,
      displayModeStore,
      displayModePresentationStateStore,
      eventKindStore,
      failedOnlyStore,
      recordingJsonlStore,
      recordDisplayStateStore,
      recordLevelState,
      searchQueryStore,
      currentLanguageState,
    ],
    ([
      $contentDisplayStateStore,
      $displayModeStore,
      $displayModePresentationStateStore,
      $eventKindStore,
      $failedOnlyStore,
      $recordingJsonlStore,
      $recordDisplayStateStore,
      $recordLevelState,
      $searchQueryStore,
      _currentLanguageState,
    ]) =>
      recordDrawerContentPropsPresentation({
        contentDisplay: $contentDisplayStateStore,
        displayMode: $displayModeStore,
        displayModeDisplay: $displayModePresentationStateStore,
        eventKind: $eventKindStore,
        failedOnly: $failedOnlyStore,
        modeTabs: displayModeTabs,
        rawText: $recordingJsonlStore,
        recordDisplay: $recordDisplayStateStore,
        recordLevel: $recordLevelState,
        searchQuery: $searchQueryStore,
      }),
  );
  const openEntryIndexHandlerStateStore = derived(
    contentDisplayStateStore,
    ($contentDisplayStateStore) =>
      historyEntryOpenHandler(
        $contentDisplayStateStore.eventEntries,
        onOpenEntryDrawer,
      ),
  );
  let recordDrawerPreferencesApplied = false;

  function saveRecordPrefs() {
    return onSaveRecordDrawerPreferences({
      displayMode: get(displayModeStore),
      eventKind: get(eventKindStore),
      failedOnly: get(failedOnlyStore),
      searchQuery: get(searchQueryStore),
    });
  }

  function setDisplayMode(nextDisplayMode = "list") {
    displayModeStore.set(normalizeRecordDrawerMode(nextDisplayMode));
    saveRecordPrefs();
  }

  function setEventKind(nextEventKind = "all") {
    eventKindStore.set(recordDrawerEventKindValue(nextEventKind));
    saveRecordPrefs();
  }

  function setFailedOnly(nextFailedOnly = false) {
    failedOnlyStore.set(!!nextFailedOnly);
    saveRecordPrefs();
  }

  function setRawRecordingText(nextRecordingJsonl = "") {
    recordingJsonlStore.set(recordDrawerRawTextValue(nextRecordingJsonl));
  }

  function setSearchQuery(nextSearchQuery = "") {
    searchQueryStore.set(recordDrawerSearchQueryValue(nextSearchQuery));
    saveRecordPrefs();
  }

  function resetFilters() {
    const defaultFilters = defaultRecordDrawerFilters();
    failedOnlyStore.set(defaultFilters.failedOnly);
    eventKindStore.set(defaultFilters.eventKind);
    searchQueryStore.set(defaultFilters.searchQuery);
    saveRecordPrefs();
  }

  return {
    contentDisplayStateStore,
    copyRecording() {
      return onCopyRecordDrawerRecording(get(recordingJsonlStore));
    },
    displayModePresentationStateStore,
    displayModeStore,
    drawerContentDisplayStateStore,
    drawerShellDisplayStateStore,
    ensurePreferencesLoaded() {
      if (recordDrawerPreferencesApplied) return;
      recordDrawerPreferencesApplied = true;
      const preferences = onLoadRecordDrawerPreferences();
      displayModeStore.set(preferences.displayMode);
      eventKindStore.set(preferences.eventKind);
      failedOnlyStore.set(preferences.failedOnly);
      searchQueryStore.set(preferences.searchQuery);
    },
    eventKindStore,
    failedOnlyStore,
    openEntryIndexHandler(eventEntries = []) {
      return (entryIndex) => {
        const recordEventEntry = Array.isArray(eventEntries)
          ? eventEntries[Number(entryIndex)] || null
          : null;
        if (recordEventEntry) {
          onOpenEntryDrawer(recordEventEntry);
        }
      };
    },
    openEntryIndexHandlerStateStore,
    recordDisplayStateStore,
    recordingJsonlStore,
    resetFilters,
    searchQueryStore,
    selectDisplayMode: setDisplayMode,
    setDrawerContext({ entryCount, recording } = {}) {
      if (recording) {
        recordingSync.apply(recording, setRawRecordingText);
      }
      if (entryCount !== undefined && entryCount !== appliedEntryCount) {
        appliedEntryCount = entryCount;
        onSetRecordFabCount(entryCount);
      }
    },
    setEventKind,
    setFailedOnly,
    setRawRecordingText,
    setRecordLevel: onSetRecordLevel,
    setSearchQuery,
    useInReplay() {
      return onSetReplayJsonlFromRecording(get(recordingJsonlStore));
    },
  };
}

function recordDrawerContentInputHandlers({
  onEventKindChange = null,
  onFailedOnlyChange = null,
  onRawInput = null,
  onRecordLevelChange = null,
  onSearchInput = null,
} = {}) {
  return {
    eventKindChangeHandler() {
      return callbackFormValueHandler(onEventKindChange);
    },
    failedOnlyChangeHandler() {
      return callbackFormCheckedHandler(onFailedOnlyChange);
    },
    rawInputChangeHandler() {
      return callbackFormValueHandler(onRawInput);
    },
    recordLevelChangeHandler() {
      return callbackFormValueHandler(onRecordLevelChange);
    },
    searchInputChangeHandler() {
      return callbackFormValueHandler(onSearchInput);
    },
  };
}

function recordDrawerContentActionHandlers({
  onEventKindChange = null,
  onFailedOnlyChange = null,
  onRawInput = null,
  onRecordLevelChange = null,
  onSearchInput = null,
} = {}) {
  const inputHandlers = recordDrawerContentInputHandlers({
    onEventKindChange,
    onFailedOnlyChange,
    onRawInput,
    onRecordLevelChange,
    onSearchInput,
  });
  return {
    recordEventKindChangeHandler() {
      return inputHandlers.eventKindChangeHandler();
    },
    recordFailedOnlyChangeHandler() {
      return inputHandlers.failedOnlyChangeHandler();
    },
    recordLevelChangeHandler() {
      return inputHandlers.recordLevelChangeHandler();
    },
    recordRawInputChangeHandler() {
      return inputHandlers.rawInputChangeHandler();
    },
    recordSearchInputChangeHandler() {
      return inputHandlers.searchInputChangeHandler();
    },
  };
}

function recordDrawerContentWorkspaceInputState(inputState = {}) {
  return {
    onEventKindChange:
      typeof inputState.onEventKindChange === "function"
        ? inputState.onEventKindChange
        : null,
    onFailedOnlyChange:
      typeof inputState.onFailedOnlyChange === "function"
        ? inputState.onFailedOnlyChange
        : null,
    onRawInput:
      typeof inputState.onRawInput === "function"
        ? inputState.onRawInput
        : null,
    onRecordLevelChange:
      typeof inputState.onRecordLevelChange === "function"
        ? inputState.onRecordLevelChange
        : null,
    onSearchInput:
      typeof inputState.onSearchInput === "function"
        ? inputState.onSearchInput
        : null,
  };
}

export function createRecordDrawerContentWorkspace(initialInputState = {}) {
  const actionHandlers = recordDrawerContentActionHandlers(
    recordDrawerContentWorkspaceInputState(initialInputState),
  );

  return {
    recordEventKindChangeHandler() {
      return actionHandlers.recordEventKindChangeHandler();
    },
    recordFailedOnlyChangeHandler() {
      return actionHandlers.recordFailedOnlyChangeHandler();
    },
    recordLevelChangeHandler() {
      return actionHandlers.recordLevelChangeHandler();
    },
    recordRawInputChangeHandler() {
      return actionHandlers.recordRawInputChangeHandler();
    },
    recordSearchInputChangeHandler() {
      return actionHandlers.recordSearchInputChangeHandler();
    },
  };
}

async function copyRecordDrawerRecording(jsonl, t = tr) {
  if (!String(jsonl || "").trim()) {
    showReplayStatus(t("replayNoJsonl", "recording JSONL is required"));
    return;
  }
  try {
    await writeClipboardText(jsonl);
    showReplayStatus(t("recordingCopied", "recording copied"));
  } catch (_) {
    showReplayStatus(t("requestFailed", "request failed"));
  }
}

function isFailedCommandEvent(eventEntry) {
  const eventRecord = (eventEntry && eventEntry.event) || {};
  return eventRecord.kind === "command_output" && eventRecord.success === false;
}

function matchesSearch(eventEntry, query) {
  const normalizedQuery = (query || "").trim().toLowerCase();
  if (!normalizedQuery) return true;
  const eventRecord = (eventEntry && eventEntry.event) || {};
  const searchableEventFields = [
    eventRecord.kind,
    eventRecord.command,
    eventRecord.mode,
    eventRecord.content,
    eventRecord.all,
    eventRecord.prompt_before,
    eventRecord.prompt_after,
    eventRecord.fsm_prompt_before,
    eventRecord.fsm_prompt_after,
    eventRecord.device_addr,
    eventRecord.reason,
  ];
  const haystack = searchableEventFields
    .filter((eventFieldValue) => eventFieldValue != null)
    .map((eventFieldValue) => String(eventFieldValue).toLowerCase())
    .join("\n");
  return haystack.includes(normalizedQuery);
}

function filterEntries(eventEntries, kindFilter, failedOnly, query) {
  return (eventEntries || []).filter((eventEntry) => {
    const eventRecord = (eventEntry && eventEntry.event) || {};
    const kindOk =
      !kindFilter || kindFilter === "all"
        ? true
        : eventRecord.kind === kindFilter;
    const failedOk = failedOnly ? isFailedCommandEvent(eventEntry) : true;
    const queryOk = matchesSearch(eventEntry, query);
    return kindOk && failedOk && queryOk;
  });
}

function parseJsonl(jsonl, t = tr) {
  const recordRows = [];
  const text = (jsonl || "").trim();
  if (!text) {
    return { ok: true, recordRows };
  }
  const lines = text.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineText = lines[lineIndex].trim();
    if (!lineText) continue;
    try {
      recordRows.push(JSON.parse(lineText));
    } catch (_) {
      return {
        ok: false,
        error: `${t("recordParseError")}: line ${lineIndex + 1}`,
      };
    }
  }
  return { ok: true, recordRows };
}
