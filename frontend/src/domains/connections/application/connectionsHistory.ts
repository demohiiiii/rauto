import { writable } from "svelte/store";
import { t, tr } from "../../../lib/i18n.js";
import { confirmUserChoice, formatTimestamp } from "../../../lib/ui.js";
import {
  closeRecordDrawer,
  navigateToReplay,
  openDetailModal,
  sendRecordingToReplay,
} from "$domains/overlays/index.js";
import { connectionApi } from "../infrastructure/connectionApi.js";
import { activeConnectionTarget } from "./connectionTargetStoreState.js";
import {
  readConnectionHistoryFilter,
  writeConnectionHistoryFilter,
} from "../infrastructure/connectionHistoryPersistence.js";
import type {
  ConnectionHistoryDrawerState,
  ConnectionHistoryDevice,
  ConnectionHistoryFilter,
  ConnectionHistoryItem,
  ConnectionHistoryTargetQuery,
  ConnectionTargetState,
} from "../model/types.js";

let historyFilterState = readConnectionHistoryFilter();
let historyDevicesState: ConnectionHistoryDevice[] = [];
let historyRefreshCount = 0;
let historyRequestVersion = 0;

const ALL_HISTORY_DEVICES = "all";

function savedHistoryDeviceValue(connectionName: string): string {
  return `saved:${encodeURIComponent(connectionName)}`;
}

function temporaryHistoryDeviceValue(host: string, port: number): string {
  return `temporary:${encodeURIComponent(host.trim().toLowerCase())}:${port}`;
}

function historyDeviceFromItem(
  historyItem: ConnectionHistoryItem,
): ConnectionHistoryDevice {
  const connectionName = historyItem.connection_name?.trim() || null;
  const kind = connectionName ? "saved" : "temporary";
  return {
    connectionName,
    deviceProfile: historyItem.device_profile,
    host: historyItem.host,
    kind,
    port: historyItem.port,
    value: connectionName
      ? savedHistoryDeviceValue(connectionName)
      : temporaryHistoryDeviceValue(historyItem.host, historyItem.port),
  };
}

function historyDeviceFromTarget(
  target: ConnectionTargetState,
): ConnectionHistoryDevice | null {
  const details = target.details;
  if (!details) return null;
  const host = String(details.host || "").trim();
  const port = Number(details.port || 22) || 22;
  const deviceProfile = String(
    details.profile || details.device_profile || "autodetect",
  ).trim();
  if (target.kind === "saved") {
    const connectionName = String(details.name || "").trim();
    if (!connectionName) return null;
    return {
      connectionName,
      deviceProfile,
      host,
      kind: "saved",
      port,
      value: savedHistoryDeviceValue(connectionName),
    };
  }
  if (target.kind !== "temporary" || !host || host === "-") return null;
  return {
    connectionName: null,
    deviceProfile,
    host,
    kind: "temporary",
    port,
    value: temporaryHistoryDeviceValue(host, port),
  };
}

function mergeHistoryDevices(
  historyItems: ConnectionHistoryItem[],
  preferredDevice: ConnectionHistoryDevice | null = null,
): ConnectionHistoryDevice[] {
  const devices = new Map<string, ConnectionHistoryDevice>();
  if (preferredDevice) devices.set(preferredDevice.value, preferredDevice);
  historyItems.forEach((historyItem) => {
    const device = historyDeviceFromItem(historyItem);
    const preferred = devices.get(device.value);
    if (!preferred) {
      devices.set(device.value, device);
    } else if (!preferred.host || preferred.host === "-") {
      devices.set(device.value, { ...preferred, host: device.host });
    }
  });
  return [...devices.values()];
}

function selectedHistoryDevice(): ConnectionHistoryDevice | null {
  return (
    historyDevicesState.find(
      (device) => device.value === historyFilterState.deviceKey,
    ) || null
  );
}

function selectedHistoryTargetQuery(): ConnectionHistoryTargetQuery {
  const device = selectedHistoryDevice();
  if (!device) return {};
  return device.kind === "saved"
    ? { connectionName: device.connectionName || undefined }
    : { temporaryHost: device.host, temporaryPort: device.port };
}

export const historyFilterStateStore = writable<ConnectionHistoryFilter>({
  ...historyFilterState,
});
export const historyDrawerState = writable<ConnectionHistoryDrawerState>({
  connectionLabel: tr("historyAllConnections"),
  currentDeviceKey: "",
  devices: [],
  historyItems: [],
  refreshLoading: false,
  status: {
    message: tr("savedConnHistoryEmpty", "no history"),
    tone: "info",
  },
  version: 0,
});

function applyHistoryStatus(message = "", tone = "info"): void {
  updateHistoryDrawerState({ status: { message, tone } });
}

function updateHistoryDrawerState(
  patch: Partial<ConnectionHistoryDrawerState> = {},
): void {
  historyDrawerState.update((state) => ({
    ...state,
    ...patch,
    version: (state?.version || 0) + 1,
  }));
}

function setHistoryFilterState(
  filter: Partial<ConnectionHistoryFilter> = {},
): ConnectionHistoryFilter {
  historyFilterState = {
    deviceKey:
      typeof filter.deviceKey === "string"
        ? filter.deviceKey
        : historyFilterState.deviceKey,
    limit:
      Number.isFinite(Number(filter.limit)) && Number(filter.limit) > 0
        ? Number(filter.limit)
        : historyFilterState.limit,
    operation:
      typeof filter.operation === "string"
        ? filter.operation
        : historyFilterState.operation,
    query:
      typeof filter.query === "string"
        ? filter.query
        : historyFilterState.query,
  };
  writeConnectionHistoryFilter(historyFilterState);
  historyFilterStateStore.set({ ...historyFilterState });
  return historyFilterState;
}

export async function loadConnectionHistory({
  refreshDevices = false,
}: { refreshDevices?: boolean } = {}) {
  const requestVersion = ++historyRequestVersion;
  updateHistoryDrawerState({
    historyItems: [],
    status: { message: tr("running", "running"), tone: "running" },
  });
  try {
    const [historyPayload, historyDevicePayload] = await Promise.all([
      connectionApi.listHistory(
        Number.isFinite(historyFilterState.limit)
          ? historyFilterState.limit
          : 30,
        selectedHistoryTargetQuery(),
      ),
      refreshDevices
        ? connectionApi.listHistoryDevices().catch(() => null)
        : Promise.resolve(null),
    ]);
    if (requestVersion !== historyRequestVersion) return;
    const preferredDevice = selectedHistoryDevice();
    if (Array.isArray(historyDevicePayload)) {
      historyDevicesState = mergeHistoryDevices(
        historyDevicePayload,
        preferredDevice,
      );
    }
    updateHistoryDrawerState({
      devices: historyDevicesState,
      historyItems: Array.isArray(historyPayload) ? historyPayload : [],
      status: {
        message: tr("savedConnHistoryEmpty", "no history"),
        tone: "info",
      },
    });
  } catch (error: unknown) {
    if (requestVersion !== historyRequestVersion) return;
    updateHistoryDrawerState({
      historyItems: [],
      status: {
        message: error instanceof Error ? error.message : String(error),
        tone: "error",
      },
    });
  }
}

export async function refreshConnectionHistory() {
  historyRefreshCount += 1;
  updateHistoryDrawerState({ refreshLoading: true });
  try {
    await loadConnectionHistory({ refreshDevices: true });
  } finally {
    historyRefreshCount -= 1;
    updateHistoryDrawerState({ refreshLoading: historyRefreshCount > 0 });
  }
}

export async function openConnectionHistory() {
  const activeDevice = historyDeviceFromTarget(activeConnectionTarget());
  historyDevicesState = activeDevice ? [activeDevice] : [];
  setHistoryFilterState({
    deviceKey: activeDevice?.value || ALL_HISTORY_DEVICES,
  });
  updateHistoryDrawerState({
    connectionLabel: activeDevice
      ? activeDevice.value
      : tr("historyAllConnections"),
    currentDeviceKey: activeDevice?.value || "",
    devices: historyDevicesState,
    historyItems: [],
  });
  await refreshConnectionHistory();
}

export async function loadConnectionHistoryDetail(historyId: string | number) {
  if (!historyId) return;
  openDetailModal(tr("running", "running"));
  try {
    const historyDetail = await connectionApi.getHistoryDetail(historyId);
    openDetailModal("", {
      detailPayload: { ...historyDetail },
      kind: "historyDetail",
      title: tr("historyDetailTitle", "History Detail"),
    });
  } catch (error: unknown) {
    openDetailModal(error instanceof Error ? error.message : String(error), {
      title: tr("historyDetailTitle", "History Detail"),
    });
  }
}

export async function replayConnectionHistoryItem(
  historyId: string | number,
): Promise<boolean> {
  if (!historyId) return false;
  try {
    const historyDetail = await connectionApi.getHistoryDetail(historyId);
    if (!sendRecordingToReplay(historyDetail.recording_jsonl)) return false;
    closeRecordDrawer();
    return navigateToReplay();
  } catch (error: unknown) {
    applyHistoryStatus(
      error instanceof Error ? error.message : String(error),
      "error",
    );
    return false;
  }
}

export async function deleteConnectionHistoryItem(historyId: string | number) {
  if (!historyId) return;
  if (!confirmUserChoice(tr("historyDeleteConfirm", "Delete history item?"))) {
    return;
  }
  applyHistoryStatus(tr("running", "running"), "running");
  try {
    await connectionApi.deleteHistory(historyId);
    applyHistoryStatus(tr("historyDeleteDone", "deleted"), "success");
    await loadConnectionHistory({ refreshDevices: true });
  } catch (error: unknown) {
    applyHistoryStatus(
      error instanceof Error ? error.message : String(error),
      "error",
    );
  }
}

export function clearHistoryFilters() {
  return setHistoryFilterState({
    deviceKey: ALL_HISTORY_DEVICES,
    limit: historyFilterState.limit,
    operation: "all",
    query: "",
  });
}

export function setHistoryFilterLimit(limit: unknown) {
  return setHistoryFilterState({
    deviceKey: historyFilterState.deviceKey,
    limit: Number(limit),
    operation: historyFilterState.operation,
    query: historyFilterState.query,
  });
}

export function setHistoryFilterOperation(operation: unknown) {
  return setHistoryFilterState({
    deviceKey: historyFilterState.deviceKey,
    limit: historyFilterState.limit,
    operation:
      typeof operation === "string" ? operation : historyFilterState.operation,
    query: historyFilterState.query,
  });
}

export function setHistoryFilterQuery(query: unknown) {
  return setHistoryFilterState({
    deviceKey: historyFilterState.deviceKey,
    limit: historyFilterState.limit,
    operation: historyFilterState.operation,
    query: typeof query === "string" ? query : historyFilterState.query,
  });
}

export function setHistoryFilterDevice(deviceKey: string) {
  return setHistoryFilterState({
    deviceKey: deviceKey || ALL_HISTORY_DEVICES,
    limit: historyFilterState.limit,
    operation: historyFilterState.operation,
    query: historyFilterState.query,
  });
}

export function formatHistoryTime(tsMs: unknown) {
  return formatTimestamp(tsMs);
}
