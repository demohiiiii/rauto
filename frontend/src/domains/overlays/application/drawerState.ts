import { derived, get, writable } from "svelte/store";
import {
  eventEntriesPresentation,
  formatHistoryTime,
  historyEntryOpenHandler,
  openEntryDrawer,
} from "./detailState.js";
import { showToast } from "./toastState.js";
import { callbackHandler } from "../../../lib/events.js";
import { classNames, displayMode, displayText } from "../../../lib/ui.js";
import { displayModeTabs } from "../../../config/dashboardModes.js";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import { overlayDrawerRuntime } from "../infrastructure/overlayDrawerRuntime.js";
import type {
  OverlayData,
  OverlayDrawerState,
  OverlayEventEntry,
  OverlayHistoryItem,
  OverlayToastTone,
  OverlayTranslate,
  RecordDrawerMode,
  RecordDrawerPreferences,
  RecordDrawerRecordingState,
  RecordLevel,
  ReplayStatusTextState,
  SessionRecordsView,
} from "../model/types.js";

const recordDrawerDefaultPreferences: Readonly<RecordDrawerPreferences> =
  Object.freeze({
    displayMode: "list",
    eventKind: "all",
    failedOnly: false,
    searchQuery: "",
  });

export const overlayDrawerState = writable<OverlayDrawerState>({
  recordDrawerOpen: false,
  recordFabCount: 0,
});

export const SESSION_RECORDS_VIEW = Object.freeze({
  history: "history",
  recent: "recent",
} as const);

export const sessionRecordsViewState = writable<SessionRecordsView>(
  SESSION_RECORDS_VIEW.recent,
);

export const recordDrawerRecordingState = writable<RecordDrawerRecordingState>({
  jsonl: "",
  version: 0,
});

export const recordLevelState = writable<RecordLevel>("key-events-only");

export const replayJsonlTransferState = writable<RecordDrawerRecordingState>({
  jsonl: "",
  version: 0,
});

export const replayStatusTextState = writable<ReplayStatusTextState>({
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
] as const;

interface HistoryDrawerFilters {
  limit?: number;
  operation?: string;
  query?: string;
}

interface HistoryDrawerStatus {
  message?: unknown;
  tone?: unknown;
}

interface HistoryDrawerState {
  connectionLabel?: unknown;
  historyItems?: unknown;
  refreshLoading?: unknown;
  status?: HistoryDrawerStatus;
}

interface RecordToolDisplay {
  hintKey: string;
  labelKey: string;
}

function recordDrawerEventKindOptionRows(t: OverlayTranslate = tr) {
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

function historyDrawerOperationOptions(t: OverlayTranslate = tr) {
  return historyDrawerOperationValues.map((historyOperation) => ({
    label:
      historyOperation === "all"
        ? t("historyFilterOperationAll")
        : historyOperationLabel(historyOperation, t),
    value: historyOperation,
  }));
}

function updateOverlayDrawerState(
  patch: Partial<OverlayDrawerState> = {},
): void {
  overlayDrawerState.update((state) => ({ ...state, ...patch }));
}

export const openRecordDrawer = (): void => {
  sessionRecordsViewState.set(SESSION_RECORDS_VIEW.recent);
  updateOverlayDrawerState({ recordDrawerOpen: true });
};
export const closeRecordDrawer = (): void =>
  updateOverlayDrawerState({ recordDrawerOpen: false });

export function setSessionRecordsView(view: unknown = ""): SessionRecordsView {
  const normalizedView =
    view === SESSION_RECORDS_VIEW.history
      ? SESSION_RECORDS_VIEW.history
      : SESSION_RECORDS_VIEW.recent;
  sessionRecordsViewState.set(normalizedView);
  return normalizedView;
}

function recordDrawerShellDisplay(
  overlayState: Partial<OverlayDrawerState> = {},
) {
  const title = tr("recordFabTitle");
  return {
    ariaLabelText: title,
    closeLabel: tr("recordDrawerClose"),
    open: !!overlayState.recordDrawerOpen,
    subtitle: tr("recordDrawerSubtitle"),
    title,
    viewLabel: tr("sessionRecordsViewsLabel"),
    viewTabs: [
      {
        label: tr("sessionRecordsRecentTab"),
        value: SESSION_RECORDS_VIEW.recent,
      },
      {
        label: tr("sessionRecordsHistoryTab"),
        value: SESSION_RECORDS_VIEW.history,
      },
    ],
  };
}

function historyItemMatchesSearch(
  historyItem: OverlayHistoryItem = {},
  query: unknown = "",
): boolean {
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

function historyDrawerFilteredItems(
  historyItems: readonly OverlayHistoryItem[] = [],
  filters: HistoryDrawerFilters = {},
): OverlayHistoryItem[] {
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

function historyOperationLabel(raw: unknown, t: OverlayTranslate = tr): string {
  const historyOperation = displayText(raw).toLowerCase();
  if (historyOperation === "exec") return t("historyOperationExec", "Execute");
  if (historyOperation === "template_execute") {
    return t("historyOperationTemplateExecute", "Template Execute");
  }
  return historyOperation || "-";
}

function historyDrawerBadgeClass(toneClass: string): string {
  return classNames(
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
    toneClass,
  );
}

function historyOperationBadgeDisplay(raw: unknown) {
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

function historyRecordLevelBadgeDisplay(raw: unknown) {
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

function historyDrawerRow(historyItem: OverlayHistoryItem = {}, index = 0) {
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
    historyId: displayText(historyItem.id),
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

function historyDrawerFilteredRows(
  historyItems: readonly OverlayHistoryItem[] = [],
  filters: HistoryDrawerFilters = {},
) {
  return historyDrawerFilteredItems(historyItems, filters).map(
    historyDrawerRow,
  );
}

function historyDrawerFiltersPresentation(
  operationOptionRows: readonly { label: string; value: string }[] = [],
) {
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
  historyItems: readonly OverlayHistoryItem[] = [],
  filteredRows: readonly ReturnType<typeof historyDrawerRow>[] = [],
  status: HistoryDrawerStatus = {},
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
}: {
  drawerState?: HistoryDrawerState;
  filterState?: HistoryDrawerFilters;
} = {}) {
  const historyItems = Array.isArray(drawerState.historyItems)
    ? (drawerState.historyItems as OverlayHistoryItem[])
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
    tableHeaderCells:
      "historyColIndex|#,historyColTime|Time,historyColOperation|Operation,historyColCommand|Command,historyColMode|Mode,historyColProfile|Profile,historyColLevel|Level,tableAction|Action"
        .split(",")
        .map((definition) => {
          const [labelKey = "", fallback = ""] = definition.split("|");
          return { labelText: tr(labelKey, fallback) };
        }),
  };
}

const setRecordFabCount = (count: unknown): void =>
  updateOverlayDrawerState({ recordFabCount: Math.max(0, Number(count) || 0) });

function normalizeRecordLevel(level: unknown): RecordLevel {
  return String(level || "").trim() === "full" ? "full" : "key-events-only";
}

function nextRecordLevel(level: unknown): RecordLevel {
  return normalizeRecordLevel(level) === "full" ? "key-events-only" : "full";
}

function recordToolPresentation(level: unknown): RecordToolDisplay {
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
}: {
  overlayState?: Partial<OverlayDrawerState>;
  recordLevel?: unknown;
} = {}) {
  const levelDisplay = recordToolPresentation(recordLevel);
  const recordFabCount = Math.max(0, Number(overlayState.recordFabCount) || 0);
  return {
    levelHintText: tr(levelDisplay.hintKey),
    levelLabelText: tr(levelDisplay.labelKey),
    recordFabBadgeText: recordFabCount > 99 ? "99+" : String(recordFabCount),
    recordFabHasCount: recordFabCount > 0,
    recordFabTitle: tr("recordFabTitle"),
    recordLevelLabel: tr("recordLevelLabel"),
  };
}

const setRecordLevel = (level: unknown): void =>
  recordLevelState.set(normalizeRecordLevel(level));
export const toggleRecordLevel = (): void =>
  setRecordLevel(nextRecordLevel(get(recordLevelState)));
export const recordLevelPayload = (): RecordLevel =>
  normalizeRecordLevel(get(recordLevelState));

export function applyRecordDrawerRecording(recordingPayload: unknown): void {
  const payload =
    recordingPayload && typeof recordingPayload === "object"
      ? (recordingPayload as OverlayData)
      : {};
  const jsonl = payload.recording_jsonl ? String(payload.recording_jsonl) : "";
  if (!jsonl) return;
  recordDrawerRecordingState.update((state) => ({
    jsonl,
    version: (state?.version || 0) + 1,
  }));
}

function createRecordDrawerRecordingSync() {
  let appliedRecordingVersion = 0;
  return {
    apply(
      recording: Partial<RecordDrawerRecordingState> = {},
      setRecordingJsonl: (jsonl: string) => void,
    ): void {
      if (!recording.version || recording.version === appliedRecordingVersion) {
        return;
      }
      appliedRecordingVersion = recording.version;
      setRecordingJsonl(recording.jsonl || "");
    },
  };
}

function showReplayStatus(text: unknown): void {
  replayStatusTextState.update((state) => ({
    text: String(text || ""),
    version: (state?.version || 0) + 1,
  }));
}

function notifyRecordingAction(
  message: unknown,
  tone: OverlayToastTone = "info",
): void {
  const text = String(message || "").trim();
  if (!text) return;
  showReplayStatus(text);
  showToast(text, tone);
}

function setReplayJsonlFromRecording(jsonl: unknown): boolean {
  const text = String(jsonl || "").trim();
  if (!text) {
    notifyRecordingAction(
      tr("recordingNoJsonlForReplay", "No recording data to send to replay"),
      "warning",
    );
    return false;
  }
  replayJsonlTransferState.update((state) => ({
    jsonl: text,
    version: (state?.version || 0) + 1,
  }));
  notifyRecordingAction(
    tr("recordingSetToReplay", "recording copied to replay"),
    "success",
  );
  return true;
}

function normalizeRecordDrawerMode(displayMode: unknown): RecordDrawerMode {
  return displayMode === "raw" ? "raw" : "list";
}

function recordDrawerDisplayModePresentation(mode: unknown = "") {
  const normalized = normalizeRecordDrawerMode(mode);
  return {
    mode: normalized,
    showList: normalized === "list",
    showRaw: normalized === "raw",
  };
}

function normalizeRecordDrawerEventKind(eventKind: unknown): string {
  const normalizedEventKind = String(eventKind || "").trim();
  return recordDrawerEventKindOptions.some(
    ([kind]) => kind === normalizedEventKind,
  )
    ? normalizedEventKind
    : "all";
}

const recordDrawerRawTextValue = (rawText: unknown): string =>
  String(rawText || "");

function defaultRecordDrawerFilters(): Omit<
  RecordDrawerPreferences,
  "displayMode"
> {
  const { eventKind, failedOnly, searchQuery } = recordDrawerDefaultPreferences;
  return {
    eventKind,
    failedOnly,
    searchQuery,
  };
}

function defaultRecordDrawerPreferences(): RecordDrawerPreferences {
  return { ...recordDrawerDefaultPreferences };
}

function normalizeRecordDrawerPreferences(
  preferences: Partial<RecordDrawerPreferences> = {},
): RecordDrawerPreferences {
  return {
    displayMode: normalizeRecordDrawerMode(preferences.displayMode),
    eventKind: normalizeRecordDrawerEventKind(preferences.eventKind),
    failedOnly: Boolean(preferences.failedOnly),
    searchQuery: String(preferences.searchQuery || ""),
  };
}

function loadRecordDrawerPreferences(): RecordDrawerPreferences {
  return normalizeRecordDrawerPreferences(
    overlayDrawerRuntime.loadPreferences(),
  );
}

function saveRecordDrawerPreferences(
  preferences: RecordDrawerPreferences,
): void {
  overlayDrawerRuntime.savePreferences(
    normalizeRecordDrawerPreferences(preferences),
  );
}

function recordDrawerEmptyText(
  filters: Partial<RecordDrawerPreferences> = {},
  t: OverlayTranslate = tr,
): string {
  if (filters.failedOnly) return t("noFailedEntries");
  if (normalizeRecordDrawerEventKind(filters.eventKind) !== "all") {
    return t("noMatchedEntries");
  }
  return t("recordListEmpty");
}

function drawerInputField(
  value: unknown,
  placeholderKey: string,
  t: OverlayTranslate = tr,
) {
  const placeholder = t(placeholderKey);
  return {
    ariaLabelText: placeholder,
    placeholder,
    value: displayText(value),
  };
}

function recordDrawerContentPresentation(
  jsonl = "",
  filters: RecordDrawerPreferences = defaultRecordDrawerPreferences(),
) {
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
    tableHeaderCells: eventEntriesDisplay.tableHeaderCells,
  };
}

type RecordDrawerContentDisplay = ReturnType<
  typeof recordDrawerContentPresentation
>;
type RecordDrawerDisplayModeDisplay = ReturnType<
  typeof recordDrawerDisplayModePresentation
>;

interface RecordDrawerContentPropsInput {
  contentDisplay?: Partial<RecordDrawerContentDisplay>;
  displayModeDisplay?: Partial<RecordDrawerDisplayModeDisplay>;
  displayMode?: RecordDrawerMode;
  eventKind?: string;
  failedOnly?: boolean;
  modeTabs?: readonly { label?: string; labelKey?: string; value: string }[];
  rawText?: string;
  recordDisplay?: Partial<RecordToolDisplay>;
  recordLevel?: RecordLevel;
  searchQuery?: string;
  t?: OverlayTranslate;
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
}: RecordDrawerContentPropsInput = {}) {
  return {
    content: {
      emptyText: contentDisplay.emptyText,
      entryRows: contentDisplay.entryRows || [],
      hasEntries: contentDisplay.hasEntries,
      parseError: contentDisplay.parseError,
      parseErrorStatus: { tone: "error" as const },
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
      recordLevelHint: t(recordDisplay.hintKey || ""),
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

interface RecordDrawerWorkspaceOptions {
  onCopyRecordDrawerRecording?: (jsonl: string) => boolean | Promise<boolean>;
  onLoadRecordDrawerPreferences?: () => RecordDrawerPreferences;
  onOpenEntryDrawer?: (eventEntry: OverlayEventEntry) => unknown;
  onSaveRecordDrawerPreferences?: (
    preferences: RecordDrawerPreferences,
  ) => unknown;
  onSetRecordFabCount?: (count: number) => unknown;
  onSetRecordLevel?: (level: RecordLevel | string) => unknown;
  onSetReplayJsonlFromRecording?: (jsonl: string) => boolean;
}

export function createRecordDrawerWorkspace({
  onCopyRecordDrawerRecording = copyRecordDrawerRecording,
  onLoadRecordDrawerPreferences = loadRecordDrawerPreferences,
  onOpenEntryDrawer = openEntryDrawer,
  onSaveRecordDrawerPreferences = saveRecordDrawerPreferences,
  onSetRecordFabCount = setRecordFabCount,
  onSetRecordLevel = setRecordLevel,
  onSetReplayJsonlFromRecording = setReplayJsonlFromRecording,
}: RecordDrawerWorkspaceOptions = {}) {
  const defaultPreferences = defaultRecordDrawerPreferences();
  const displayModeStore = writable<RecordDrawerMode>(
    defaultPreferences.displayMode,
  );
  const eventKindStore = writable(defaultPreferences.eventKind);
  const failedOnlyStore = writable(defaultPreferences.failedOnly);
  const searchQueryStore = writable(defaultPreferences.searchQuery);
  const preferencesStateStore = derived(
    [
      displayModeStore,
      eventKindStore,
      failedOnlyStore,
      searchQueryStore,
    ] as const,
    ([displayMode, eventKind, failedOnly, searchQuery]) => ({
      displayMode,
      eventKind,
      failedOnly,
      searchQuery,
    }),
  );
  const recordingJsonlStore = writable("");
  const recordingSync = createRecordDrawerRecordingSync();
  let appliedEntryCount = 0;
  const drawerShellDisplayStateStore = derived(
    [overlayDrawerState, currentLanguageState] as const,
    ([$overlayDrawerState, _currentLanguageState]) =>
      recordDrawerShellDisplay($overlayDrawerState),
  );
  const contentDisplayStateStore = derived(
    [recordingJsonlStore, preferencesStateStore, currentLanguageState] as const,
    ([$recordingJsonlStore, $preferencesStateStore]) =>
      recordDrawerContentPresentation(
        $recordingJsonlStore,
        $preferencesStateStore,
      ),
  );
  const displayModePresentationStateStore = derived(
    displayModeStore,
    ($displayModeStore) =>
      recordDrawerDisplayModePresentation($displayModeStore),
  );
  const recordDisplayStateStore = derived(
    [recordLevelState, currentLanguageState] as const,
    ([$recordLevelState, _currentLanguageState]) =>
      recordToolPresentation($recordLevelState),
  );
  const drawerContentDisplayStateStore = derived(
    [
      contentDisplayStateStore,
      preferencesStateStore,
      recordingJsonlStore,
      recordDisplayStateStore,
      recordLevelState,
      currentLanguageState,
    ] as const,
    ([
      $contentDisplayStateStore,
      $preferencesStateStore,
      $recordingJsonlStore,
      $recordDisplayStateStore,
      $recordLevelState,
      _currentLanguageState,
    ]) =>
      recordDrawerContentPropsPresentation({
        contentDisplay: $contentDisplayStateStore,
        displayMode: $preferencesStateStore.displayMode,
        displayModeDisplay: recordDrawerDisplayModePresentation(
          $preferencesStateStore.displayMode,
        ),
        eventKind: $preferencesStateStore.eventKind,
        failedOnly: $preferencesStateStore.failedOnly,
        modeTabs: displayModeTabs,
        rawText: $recordingJsonlStore,
        recordDisplay: $recordDisplayStateStore,
        recordLevel: $recordLevelState,
        searchQuery: $preferencesStateStore.searchQuery,
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

  function currentRecordPreferences(): RecordDrawerPreferences {
    return {
      displayMode: get(displayModeStore),
      eventKind: get(eventKindStore),
      failedOnly: get(failedOnlyStore),
      searchQuery: get(searchQueryStore),
    };
  }

  function saveRecordPrefs() {
    return onSaveRecordDrawerPreferences(currentRecordPreferences());
  }

  function setDisplayMode(value: string = "list"): void {
    displayModeStore.set(normalizeRecordDrawerMode(value));
    saveRecordPrefs();
  }

  function setEventKind(value: string = "all"): void {
    eventKindStore.set(normalizeRecordDrawerEventKind(value));
    saveRecordPrefs();
  }

  function setFailedOnly(value: boolean = false): void {
    failedOnlyStore.set(Boolean(value));
    saveRecordPrefs();
  }

  function setSearchQuery(value: string = ""): void {
    searchQueryStore.set(String(value || ""));
    saveRecordPrefs();
  }

  function setRawRecordingText(nextRecordingJsonl: string = ""): void {
    recordingJsonlStore.set(recordDrawerRawTextValue(nextRecordingJsonl));
  }

  function resetFilters(): void {
    const defaultFilters = defaultRecordDrawerFilters();
    eventKindStore.set(defaultFilters.eventKind);
    failedOnlyStore.set(defaultFilters.failedOnly);
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
      const preferences = normalizeRecordDrawerPreferences(
        onLoadRecordDrawerPreferences(),
      );
      displayModeStore.set(preferences.displayMode);
      eventKindStore.set(preferences.eventKind);
      failedOnlyStore.set(preferences.failedOnly);
      searchQueryStore.set(preferences.searchQuery);
    },
    eventKindStore,
    failedOnlyStore,
    openEntryIndexHandler(eventEntries: readonly OverlayEventEntry[] = []) {
      return (entryIndex: unknown): void => {
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
    setDrawerContext({
      entryCount,
      recording,
    }: {
      entryCount?: number;
      recording?: Partial<RecordDrawerRecordingState>;
    } = {}) {
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
      const moved = onSetReplayJsonlFromRecording(get(recordingJsonlStore));
      if (moved) {
        closeRecordDrawer();
        overlayDrawerRuntime.navigateToReplay();
      }
      return moved;
    },
  };
}

export function createRecordDrawerContentWorkspace({
  onEventKindChange = null,
  onFailedOnlyChange = null,
  onRawInput = null,
  onRecordLevelChange = null,
  onSearchInput = null,
}: {
  onEventKindChange?: ((value: string) => unknown) | null;
  onFailedOnlyChange?: ((value: boolean) => unknown) | null;
  onRawInput?: ((value: string) => unknown) | null;
  onRecordLevelChange?: ((value: string) => unknown) | null;
  onSearchInput?: ((value: string) => unknown) | null;
} = {}) {
  // Plain* field bindings already extract value/checked before invoking
  // onValueChange / onValueInput / onCheckedChange, so these handlers must
  // accept the bare value rather than a DOM event.
  return {
    recordEventKindChangeHandler() {
      return callbackHandler(onEventKindChange);
    },
    recordFailedOnlyChangeHandler() {
      return callbackHandler(onFailedOnlyChange);
    },
    recordLevelChangeHandler() {
      return callbackHandler(onRecordLevelChange);
    },
    recordRawInputChangeHandler() {
      return callbackHandler(onRawInput);
    },
    recordSearchInputChangeHandler() {
      return callbackHandler(onSearchInput);
    },
  };
}

async function copyRecordDrawerRecording(
  jsonl: string,
  t: OverlayTranslate = tr,
): Promise<boolean> {
  if (!String(jsonl || "").trim()) {
    notifyRecordingAction(
      t("recordingNoJsonl", "No recording data to copy"),
      "warning",
    );
    return false;
  }
  try {
    await overlayDrawerRuntime.writeClipboardText(jsonl);
    notifyRecordingAction(t("recordingCopied", "recording copied"), "success");
    return true;
  } catch (_) {
    notifyRecordingAction(t("requestFailed", "request failed"), "error");
    return false;
  }
}

function isFailedCommandEvent(eventEntry: OverlayEventEntry): boolean {
  const eventRecord = (eventEntry && eventEntry.event) || {};
  return eventRecord.kind === "command_output" && eventRecord.success === false;
}

function matchesSearch(eventEntry: OverlayEventEntry, query: unknown): boolean {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();
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

function filterEntries(
  eventEntries: readonly OverlayEventEntry[],
  kindFilter: unknown,
  failedOnly: boolean,
  query: unknown,
): OverlayEventEntry[] {
  return eventEntries.filter((eventEntry) => {
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

type RecordDrawerParseResult =
  | { ok: true; recordRows: OverlayEventEntry[] }
  | { error: string; ok: false; recordRows: [] };

function parseJsonl(
  jsonl: unknown,
  t: OverlayTranslate = tr,
): RecordDrawerParseResult {
  const recordRows: OverlayEventEntry[] = [];
  const text = String(jsonl || "").trim();
  if (!text) {
    return { ok: true, recordRows };
  }
  const lines = text.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineText = lines[lineIndex].trim();
    if (!lineText) continue;
    try {
      const parsedRow: unknown = JSON.parse(lineText);
      if (
        parsedRow &&
        typeof parsedRow === "object" &&
        !Array.isArray(parsedRow)
      ) {
        recordRows.push(parsedRow as OverlayEventEntry);
      }
    } catch (_) {
      return {
        ok: false,
        error: `${t("recordParseError")}: line ${lineIndex + 1}`,
        recordRows: [],
      };
    }
  }
  return { ok: true, recordRows };
}
