import { writable } from "svelte/store";
import {
  deleteConnectionHistory,
  getConnectionHistoryDetail,
  listConnectionHistory,
} from "../api/client.js";
import { storageGet, storageSet } from "../lib/browser.js";
import { t, tr } from "../lib/i18n.js";
import { confirmUserChoice, formatTimestamp } from "../lib/ui.js";
import { openDetailModal, openHistoryDrawer } from "./overlays.js";

const HISTORY_STORAGE = {
  limit: "rauto_history_filter_limit",
  operation: "rauto_history_filter_operation",
  query: "rauto_history_filter_query",
};

let historyFilterState = {
  limit: Number(storageGet(HISTORY_STORAGE.limit, "30")),
  operation: storageGet(HISTORY_STORAGE.operation, "all"),
  query: storageGet(HISTORY_STORAGE.query),
};
let historyRefreshLoading = false;
let resolveCurrentSavedConnectionName = () => "";
let setHistoryStatus = null;

export const historyFilterStateStore = writable({ ...historyFilterState });
export const historyDrawerState = writable({
  connectionLabel: "-",
  historyItems: [],
  refreshLoading: false,
  status: {
    message: tr("savedConnHistoryEmpty", "no history"),
    tone: "info",
  },
  version: 0,
});

export function configureConnectionHistory(config = {}) {
  resolveCurrentSavedConnectionName =
    typeof config.resolveCurrentSavedConnectionName === "function"
      ? config.resolveCurrentSavedConnectionName
      : resolveCurrentSavedConnectionName;
  setHistoryStatus =
    typeof config.setHistoryStatus === "function"
      ? config.setHistoryStatus
      : setHistoryStatus;
}

function currentSavedConnectionName() {
  return resolveCurrentSavedConnectionName();
}

function applyHistoryStatus(message = "", tone = "info") {
  if (typeof setHistoryStatus === "function") {
    setHistoryStatus(message, tone);
  }
}

function updateHistoryDrawerState(patch = {}) {
  historyDrawerState.update((state) => ({
    ...state,
    ...patch,
    version: (state?.version || 0) + 1,
  }));
}

function setHistoryFilterState(filter = {}) {
  historyFilterState = {
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
  storageSet(HISTORY_STORAGE.query, historyFilterState.query);
  storageSet(HISTORY_STORAGE.operation, historyFilterState.operation);
  storageSet(HISTORY_STORAGE.limit, String(historyFilterState.limit));
  historyFilterStateStore.set({ ...historyFilterState });
  return historyFilterState;
}

export async function loadConnectionHistory() {
  const savedConnectionName = currentSavedConnectionName();
  updateHistoryDrawerState({ connectionLabel: savedConnectionName || "-" });
  if (!savedConnectionName) {
    updateHistoryDrawerState({
      historyItems: [],
      status: {
        message: tr("connectionNameRequired", "connection name required"),
        tone: "error",
      },
    });
    return;
  }
  updateHistoryDrawerState({
    status: { message: tr("running", "running"), tone: "running" },
  });
  try {
    const historyPayload = await listConnectionHistory(
      savedConnectionName,
      Number.isFinite(historyFilterState.limit) ? historyFilterState.limit : 30,
    );
    updateHistoryDrawerState({
      historyItems: Array.isArray(historyPayload) ? historyPayload : [],
      status: {
        message: tr("savedConnHistoryEmpty", "no history"),
        tone: "info",
      },
    });
  } catch (error) {
    updateHistoryDrawerState({
      historyItems: [],
      status: { message: error.message, tone: "error" },
    });
  }
}

export async function refreshConnectionHistory() {
  if (historyRefreshLoading) return;
  historyRefreshLoading = true;
  updateHistoryDrawerState({ refreshLoading: true });
  try {
    await loadConnectionHistory();
  } finally {
    historyRefreshLoading = false;
    updateHistoryDrawerState({ refreshLoading: false });
  }
}

export async function openConnectionHistoryDrawer() {
  openHistoryDrawer();
  await loadConnectionHistory();
}

export async function loadConnectionHistoryDetail(historyId) {
  const savedConnectionName = currentSavedConnectionName();
  if (!savedConnectionName || !historyId) return;
  openDetailModal(tr("running", "running"));
  try {
    const historyDetail = await getConnectionHistoryDetail(
      savedConnectionName,
      historyId,
    );
    openDetailModal("", {
      detailPayload: historyDetail,
      kind: "historyDetail",
      title: tr("historyDetailTitle", "History Detail"),
    });
  } catch (error) {
    openDetailModal(error.message, {
      title: tr("historyDetailTitle", "History Detail"),
    });
  }
}

export async function deleteConnectionHistoryItem(historyId) {
  const savedConnectionName = currentSavedConnectionName();
  if (!savedConnectionName || !historyId) return;
  if (!confirmUserChoice(tr("historyDeleteConfirm", "Delete history item?"))) {
    return;
  }
  applyHistoryStatus(tr("running", "running"), "running");
  try {
    await deleteConnectionHistory(savedConnectionName, historyId);
    applyHistoryStatus(tr("historyDeleteDone", "deleted"), "success");
    await loadConnectionHistory();
  } catch (error) {
    applyHistoryStatus(error.message, "error");
  }
}

export function clearHistoryFilters() {
  return setHistoryFilterState({
    limit: historyFilterState.limit,
    operation: "all",
    query: "",
  });
}

export function setHistoryFilterLimit(limit) {
  return setHistoryFilterState({
    limit,
    operation: historyFilterState.operation,
    query: historyFilterState.query,
  });
}

export function setHistoryFilterOperation(operation) {
  return setHistoryFilterState({
    limit: historyFilterState.limit,
    operation,
    query: historyFilterState.query,
  });
}

export function setHistoryFilterQuery(query) {
  return setHistoryFilterState({
    limit: historyFilterState.limit,
    operation: historyFilterState.operation,
    query,
  });
}

export function formatHistoryTime(tsMs) {
  return formatTimestamp(tsMs);
}
