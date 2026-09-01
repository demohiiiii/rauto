import { storageGet, storageSet } from "../../../lib/browser.js";
import type { ConnectionHistoryFilter } from "../model/types.js";

const HISTORY_STORAGE = {
  limit: "rauto_history_filter_limit",
  operation: "rauto_history_filter_operation",
  query: "rauto_history_filter_query",
} as const;

export function readConnectionHistoryFilter(): ConnectionHistoryFilter {
  return {
    limit: Number(storageGet(HISTORY_STORAGE.limit, "30")),
    operation: storageGet(HISTORY_STORAGE.operation, "all"),
    query: storageGet(HISTORY_STORAGE.query),
  };
}

export function writeConnectionHistoryFilter(
  filter: ConnectionHistoryFilter,
): void {
  storageSet(HISTORY_STORAGE.query, filter.query);
  storageSet(HISTORY_STORAGE.operation, filter.operation);
  storageSet(HISTORY_STORAGE.limit, String(filter.limit));
}
