import { writable } from "svelte/store";
import { t, tr } from "../../../lib/i18n.js";
import { confirmUserChoice, formatTimestamp } from "../../../lib/ui.js";
import { openDetailModal } from "$domains/overlays/index.js";
import { connectionApi } from "../infrastructure/connectionApi.js";
import {
  readConnectionHistoryFilter,
  writeConnectionHistoryFilter,
} from "../infrastructure/connectionHistoryPersistence.js";
import type {
  ConnectionHistoryDrawerState,
  ConnectionHistoryFilter,
} from "../model/types.js";

let historyFilterState = readConnectionHistoryFilter();
let historyRefreshLoading = false;
let resolveCurrentSavedConnectionName: () => string = () => "";
let setHistoryStatus: ((message: string, tone: string) => unknown) | null =
  null;

export const historyFilterStateStore = writable<ConnectionHistoryFilter>({
  ...historyFilterState,
});
export const historyDrawerState = writable<ConnectionHistoryDrawerState>({
  connectionLabel: "-",
  historyItems: [],
  refreshLoading: false,
  status: {
    message: tr("savedConnHistoryEmpty", "no history"),
    tone: "info",
  },
  version: 0,
});

export function configureConnectionHistory(
  config: {
    resolveCurrentSavedConnectionName?: () => string;
    setHistoryStatus?: (message: string, tone: string) => unknown;
  } = {},
) {
  resolveCurrentSavedConnectionName =
    typeof config.resolveCurrentSavedConnectionName === "function"
      ? config.resolveCurrentSavedConnectionName
      : resolveCurrentSavedConnectionName;
  setHistoryStatus =
    typeof config.setHistoryStatus === "function"
      ? config.setHistoryStatus
      : setHistoryStatus;
}

function currentSavedConnectionName(): string {
  return resolveCurrentSavedConnectionName();
}

function applyHistoryStatus(message = "", tone = "info"): void {
  if (typeof setHistoryStatus === "function") {
    setHistoryStatus(message, tone);
  }
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
    const historyPayload = await connectionApi.listHistory(
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
  } catch (error: unknown) {
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

export async function loadConnectionHistoryDetail(historyId: string | number) {
  const savedConnectionName = currentSavedConnectionName();
  if (!savedConnectionName || !historyId) return;
  openDetailModal(tr("running", "running"));
  try {
    const historyDetail = await connectionApi.getHistoryDetail(
      savedConnectionName,
      historyId,
    );
    openDetailModal("", {
      detailPayload: historyDetail,
      kind: "historyDetail",
      title: tr("historyDetailTitle", "History Detail"),
    });
  } catch (error: unknown) {
    openDetailModal(error instanceof Error ? error.message : String(error), {
      title: tr("historyDetailTitle", "History Detail"),
    });
  }
}

export async function deleteConnectionHistoryItem(historyId: string | number) {
  const savedConnectionName = currentSavedConnectionName();
  if (!savedConnectionName || !historyId) return;
  if (!confirmUserChoice(tr("historyDeleteConfirm", "Delete history item?"))) {
    return;
  }
  applyHistoryStatus(tr("running", "running"), "running");
  try {
    await connectionApi.deleteHistory(savedConnectionName, historyId);
    applyHistoryStatus(tr("historyDeleteDone", "deleted"), "success");
    await loadConnectionHistory();
  } catch (error: unknown) {
    applyHistoryStatus(
      error instanceof Error ? error.message : String(error),
      "error",
    );
  }
}

export function clearHistoryFilters() {
  return setHistoryFilterState({
    limit: historyFilterState.limit,
    operation: "all",
    query: "",
  });
}

export function setHistoryFilterLimit(limit: unknown) {
  return setHistoryFilterState({
    limit: Number(limit),
    operation: historyFilterState.operation,
    query: historyFilterState.query,
  });
}

export function setHistoryFilterOperation(operation: unknown) {
  return setHistoryFilterState({
    limit: historyFilterState.limit,
    operation:
      typeof operation === "string" ? operation : historyFilterState.operation,
    query: historyFilterState.query,
  });
}

export function setHistoryFilterQuery(query: unknown) {
  return setHistoryFilterState({
    limit: historyFilterState.limit,
    operation: historyFilterState.operation,
    query: typeof query === "string" ? query : historyFilterState.query,
  });
}

export function formatHistoryTime(tsMs: unknown) {
  return formatTimestamp(tsMs);
}
