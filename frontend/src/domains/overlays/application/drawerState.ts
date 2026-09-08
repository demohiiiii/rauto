import { derived, get, writable } from "svelte/store";
import { formatHistoryTime } from "./detailState.js";
import { classNames, displayMode, displayText } from "../../../lib/ui.js";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import { showToast } from "./toastState.js";
import type {
  OverlayDrawerState,
  OverlayHistoryItem,
  OverlayTranslate,
  RecordLevel,
} from "../model/types.js";

export const overlayDrawerState = writable<OverlayDrawerState>({
  recordDrawerOpen: false,
});

export const recordLevelState = writable<RecordLevel>("key-events-only");

export const replayJsonlTransferState = writable({
  jsonl: "",
  version: 0,
});

export const replayStatusTextState = writable({
  text: "",
  version: 0,
});

export function sendRecordingToReplay(jsonl: string): boolean {
  if (!jsonl.trim()) {
    const message = tr(
      "recordingNoJsonlForReplay",
      "No recording data to send to replay",
    );
    replayStatusTextState.update((state) => ({
      text: message,
      version: state.version + 1,
    }));
    void showToast(message, "warning");
    return false;
  }

  replayJsonlTransferState.update((state) => ({
    jsonl,
    version: state.version + 1,
  }));
  const message = tr("recordingSetToReplay", "Recording moved to replay");
  replayStatusTextState.update((state) => ({
    text: message,
    version: state.version + 1,
  }));
  void showToast(message, "success");
  return true;
}

interface HistoryDrawerFilters {
  deviceKey?: string;
  limit?: number;
  operation?: string;
  query?: string;
}

interface HistoryDrawerStatus {
  message?: string;
  tone?: string;
}

interface HistoryDrawerState {
  connectionLabel?: string;
  currentDeviceKey?: string;
  devices?: readonly HistoryDrawerDevice[];
  historyItems?: readonly OverlayHistoryItem[];
  refreshLoading?: boolean;
  status?: HistoryDrawerStatus;
}

interface HistoryDrawerDevice {
  connectionName: string | null;
  deviceProfile: string;
  host: string;
  kind: "saved" | "temporary";
  port: number;
  value: string;
}

interface RecordToolDisplay {
  hintKey: string;
  labelKey: string;
}

const historyDrawerOperationValues =
  "all|exec|show|command_flow|template_execute|config_fetch|sftp_upload|tx_block|tx_workflow|orchestrate_tx_workflow|orchestrate_compensation".split(
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
  updateOverlayDrawerState({ recordDrawerOpen: true });
};
export const closeRecordDrawer = (): void =>
  updateOverlayDrawerState({ recordDrawerOpen: false });

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

function historyItemDeviceValue(historyItem: OverlayHistoryItem): string {
  const connectionName = String(historyItem.connection_name || "").trim();
  return connectionName
    ? `saved:${encodeURIComponent(connectionName)}`
    : `temporary:${encodeURIComponent(
        String(historyItem.host || "")
          .trim()
          .toLowerCase(),
      )}:${Number(historyItem.port || 22) || 22}`;
}

function historyItemMatchesDevice(
  historyItem: OverlayHistoryItem,
  deviceKey = "all",
): boolean {
  return (
    deviceKey === "all" || historyItemDeviceValue(historyItem) === deviceKey
  );
}

function historyDrawerFilteredItems(
  historyItems: readonly OverlayHistoryItem[] = [],
  filters: HistoryDrawerFilters = {},
): OverlayHistoryItem[] {
  const deviceKey = String(filters.deviceKey || "all");
  const operation = String(filters.operation || "all").toLowerCase();
  return [...historyItems]
    .filter((historyItem) => {
      const itemOperation = String(historyItem.operation || "").toLowerCase();
      const operationMatches =
        operation === "all" ? true : itemOperation === operation;
      return (
        historyItemMatchesDevice(historyItem, deviceKey) &&
        operationMatches &&
        historyItemMatchesSearch(historyItem, filters.query)
      );
    })
    .sort((a, b) => Number(b.ts_ms || 0) - Number(a.ts_ms || 0));
}

function historyOperationLabel(raw: unknown, t: OverlayTranslate = tr): string {
  const historyOperation = displayText(raw).toLowerCase();
  const labels: Record<string, [string, string]> = {
    command_flow: ["historyOperationCommandFlow", "Command Flow"],
    config_fetch: ["historyOperationConfigFetch", "Config Fetch"],
    exec: ["historyOperationExec", "Execute"],
    orchestrate_compensation: [
      "historyOperationOrchestrationCompensation",
      "Orchestration Compensation",
    ],
    orchestrate_tx_workflow: [
      "historyOperationOrchestrationTxWorkflow",
      "Orchestration Workflow",
    ],
    sftp_upload: ["historyOperationSftpUpload", "SFTP Upload"],
    show: ["historyOperationShow", "Show"],
    template_execute: ["historyOperationTemplateExecute", "Template Execute"],
    tx_block: ["historyOperationTxBlock", "Transaction"],
    tx_workflow: ["historyOperationTxWorkflow", "Transaction Workflow"],
  };
  const label = labels[historyOperation];
  return label ? t(label[0], label[1]) : historyOperation || "-";
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

function historyDrawerRow(
  historyItem: OverlayHistoryItem = {},
  index = 0,
  currentDeviceKey = "",
) {
  const operationBadge = historyOperationBadgeDisplay(historyItem.operation);
  const recordLevelBadge = historyRecordLevelBadgeDisplay(
    historyItem.record_level,
  );
  const isTemporary = !historyItem.connection_name;
  const temporaryLabel = tr("historyTemporaryConnection", "Temp");
  return {
    commandLabel: displayText(historyItem.command_label),
    connectionName: historyItem.connection_name
      ? displayText(historyItem.connection_name)
      : temporaryLabel,
    deleteButtonLabel: tr("historyDeleteBtn", "Delete"),
    deviceProfile: displayText(historyItem.device_profile),
    detailButtonLabel: tr("actionViewDetail", "View"),
    historyId: displayText(historyItem.id),
    hostPort: `${displayText(historyItem.host)}:${displayText(historyItem.port)}`,
    indexText: String(index + 1),
    isCurrent: historyItemDeviceValue(historyItem) === currentDeviceKey,
    isTemporary,
    modeBadgeClass: historyDrawerBadgeClass(
      "border-amber-200 bg-amber-100 text-amber-800",
    ),
    modeText: displayMode(historyItem.mode) || "-",
    operationBadgeClass: operationBadge.badgeClass,
    operationLabel: operationBadge.label,
    recordLevelBadgeClass: recordLevelBadge.badgeClass,
    recordLevelText: recordLevelBadge.label,
    replayButtonLabel: tr("recordUseReplayBtn", "Use in Replay"),
    timestampText: formatHistoryTime(historyItem.ts_ms),
    temporaryLabel,
  };
}

function historyDrawerFilteredRows(
  historyItems: readonly OverlayHistoryItem[] = [],
  filters: HistoryDrawerFilters = {},
  currentDeviceKey = "",
) {
  return historyDrawerFilteredItems(historyItems, filters).map(
    (historyItem, index) =>
      historyDrawerRow(historyItem, index, currentDeviceKey),
  );
}

function historyDrawerDeviceLabel(device: HistoryDrawerDevice): string {
  const hostPort =
    device.host && device.host !== "-" ? `${device.host}:${device.port}` : "";
  return device.kind === "saved"
    ? [device.connectionName, hostPort].filter(Boolean).join(" · ")
    : `${tr("historyTemporaryConnection", "Temp")} · ${hostPort}`;
}

function historyDrawerFiltersPresentation(
  devices: readonly HistoryDrawerDevice[] = [],
  currentDeviceKey = "",
  operationOptionRows: readonly { label: string; value: string }[] = [],
) {
  const deviceOptionRows = [
    {
      endpointText: "",
      isCurrent: false,
      isTemporary: false,
      label: tr("historyFilterDeviceAll", "All devices"),
      nameText: tr("historyFilterDeviceAll", "All devices"),
      value: "all",
    },
    ...devices.map((device) => {
      const endpointText =
        device.host && device.host !== "-"
          ? `${device.host}:${device.port}`
          : "";
      return {
        endpointText,
        isCurrent: device.value === currentDeviceKey,
        isTemporary: device.kind === "temporary",
        label: historyDrawerDeviceLabel(device),
        nameText:
          device.kind === "temporary"
            ? tr("historyTemporaryConnection", "Temp")
            : device.connectionName || "-",
        value: device.value,
      };
    }),
  ];
  return {
    clearButtonLabel: tr("historyFilterClear"),
    currentDeviceLabel: tr("historyCurrentDevice", "Current"),
    deviceLabel: tr("historyFilterDevice", "Device"),
    deviceOptionRows,
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
  const historyItems = drawerState.historyItems || [];
  const deviceKey = filterState.deviceKey || "all";
  const query = filterState.query || "";
  const operation = filterState.operation || "all";
  const status = drawerState.status || {
    message: tr("savedConnHistoryEmpty", "no history"),
    tone: "info",
  };
  const filteredRows = historyDrawerFilteredRows(
    historyItems,
    {
      deviceKey,
      operation,
      query,
    },
    drawerState.currentDeviceKey,
  );
  const listDisplay = historyDrawerListPresentation(
    historyDrawerFilteredItems(historyItems, { deviceKey }),
    filteredRows,
    status,
  );
  const filtersDisplay = historyDrawerFiltersPresentation(
    drawerState.devices,
    drawerState.currentDeviceKey,
    historyDrawerOperationOptions(),
  );
  const selectedDevice = filtersDisplay.deviceOptionRows.find(
    (option) => option.value === deviceKey,
  );

  return {
    connectionLabel: displayText(
      selectedDevice?.label || drawerState.connectionLabel || "-",
    ),
    connectionTitle: tr("historyDrawerScopeLabel"),
    emptyStatus: listDisplay.emptyStatus,
    deviceKey,
    filtersDisplay,
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
}: {
  recordLevel?: unknown;
} = {}) {
  const levelDisplay = recordToolPresentation(recordLevel);
  return {
    levelHintText: tr(levelDisplay.hintKey),
    levelLabelText: tr(levelDisplay.labelKey),
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

export function createRecordDrawerWorkspace() {
  const drawerShellDisplayStateStore = derived(
    [overlayDrawerState, currentLanguageState] as const,
    ([$overlayDrawerState, _currentLanguageState]) =>
      recordDrawerShellDisplay($overlayDrawerState),
  );
  return {
    drawerShellDisplayStateStore,
  };
}
