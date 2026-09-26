import { get, writable, readonly } from "svelte/store";
import {
  readExecutionHistory,
  writeExecutionHistory,
} from "../infrastructure/executionHistoryPersistence.js";
import {
  historyOutputSnapshot,
  historyLimit,
  historyStatus,
  retainExecutionHistory,
} from "../model/executionHistory.js";
import type {
  ExecutionHistoryEntry,
  ExecutionHistoryFunction,
  ExecutionHistoryOutput,
  ExecutionHistorySnapshot,
} from "../model/executionHistory.js";

export function createExecutionHistory({
  initial = { limit: 10, entries: [] },
  persist = (_snapshot: ExecutionHistorySnapshot) => {},
  now = () => new Date().toISOString(),
}: {
  initial?: ExecutionHistorySnapshot;
  persist?: (snapshot: ExecutionHistorySnapshot) => void;
  now?: () => string;
} = {}) {
  const store = writable<ExecutionHistorySnapshot>({
    limit: historyLimit(initial.limit),
    entries: retainExecutionHistory(
      initial.entries,
      historyLimit(initial.limit),
    ),
  });
  let sequence = 0;
  function update(
    change: (value: ExecutionHistorySnapshot) => ExecutionHistorySnapshot,
  ) {
    store.update((value) => {
      const next = change(value);
      try {
        persist(next);
      } catch {
        /* History stays available in memory when storage is unavailable. */
      }
      return next;
    });
  }
  function start(
    feature: ExecutionHistoryFunction,
    scope: ExecutionHistoryEntry["scope"],
    textfsmEnabled = false,
  ) {
    const startedAt = now();
    const id =
      feature +
      "-" +
      startedAt +
      "-" +
      ++sequence +
      "-" +
      Math.random().toString(36).slice(2);
    update((value) => ({
      ...value,
      entries: retainExecutionHistory(
        [
          {
            id,
            feature,
            scope,
            textfsmEnabled,
            startedAt,
            completedAt: null,
            status: "running",
            message: "",
            outputs: [],
          },
          ...value.entries,
        ],
        value.limit,
      ),
    }));
    return id;
  }
  function finish(
    id: string,
    outputs: ExecutionHistoryOutput[],
    message = "",
    failed = false,
  ) {
    // Copy the result so later editor changes and downloads cannot alter a run.
    const snapshot = structuredClone(outputs.map(historyOutputSnapshot));
    update((value) => ({
      ...value,
      entries: value.entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              completedAt: now(),
              outputs: snapshot,
              message,
              status: message ? "error" : historyStatus(snapshot, failed),
            }
          : entry,
      ),
    }));
  }
  function fail(id: string, message: string) {
    const existing = get(store).entries.find((entry) => entry.id === id);
    finish(id, existing?.outputs ?? [], message, true);
  }
  return {
    state: readonly(store),
    start,
    finish,
    fail,
    setLimit(value: number) {
      const limit = historyLimit(value);
      update((state) => ({
        limit,
        entries: retainExecutionHistory(state.entries, limit),
      }));
    },
  };
}
export const executionHistory = createExecutionHistory({
  initial: readExecutionHistory(),
  persist: writeExecutionHistory,
});
