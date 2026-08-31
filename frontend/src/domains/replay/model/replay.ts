import type {
  ReplayEntry,
  ReplayPreferences,
  ReplayState,
  ReplayStatusState,
  ReplayTransferState,
} from "./types.js";

export function newReplayState(): ReplayState {
  return {
    commandInput: "",
    displayMode: "list",
    eventKind: "all",
    failedOnly: false,
    jsonl: "",
    lastReplayResult: null,
    listLoading: false,
    mode: "",
    runLoading: false,
    searchQuery: "",
    statusText: "",
  };
}

export function replayEntriesFromResult(state: ReplayState): ReplayEntry[] {
  return Array.isArray(state.lastReplayResult?.entries)
    ? state.lastReplayResult.entries
    : [];
}

export function replayEntryIsFailedCommandEvent(entry: ReplayEntry): boolean {
  return (
    entry.event?.kind === "command_output" && entry.event.success === false
  );
}

export function replayEntryMatchesSearch(
  entry: ReplayEntry,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const event = entry.event || {};
  const searchableFields = [
    event.kind,
    event.command,
    event.mode,
    event.content,
    event.all,
    event.prompt_before,
    event.prompt_after,
    event.fsm_prompt_before,
    event.fsm_prompt_after,
    event.device_addr,
    event.reason,
  ];
  const haystack = searchableFields
    .filter((value) => value != null)
    .map((value) => String(value).toLowerCase())
    .join("\n");
  return haystack.includes(normalizedQuery);
}

export function replayFilteredEntries(state: ReplayState): ReplayEntry[] {
  return replayEntriesFromResult(state).filter((entry) => {
    const kindMatches =
      !state.eventKind ||
      state.eventKind === "all" ||
      entry.event?.kind === state.eventKind;
    const failureMatches = state.failedOnly
      ? replayEntryIsFailedCommandEvent(entry)
      : true;
    return (
      kindMatches &&
      failureMatches &&
      replayEntryMatchesSearch(entry, state.searchQuery)
    );
  });
}

export function applyReplayPreferences(
  state: ReplayState,
  preferences: ReplayPreferences,
): void {
  state.displayMode = preferences.displayMode;
  state.eventKind = preferences.eventKind;
  state.failedOnly = preferences.failedOnly;
  state.searchQuery = preferences.searchQuery;
}

export function setReplayLoadingKeys(state: ReplayState, keys: string[]): void {
  state.listLoading = keys.includes("list");
  state.runLoading = keys.includes("command");
}

export function resetReplayFilters(state: ReplayState): void {
  state.eventKind = "all";
  state.failedOnly = false;
  state.searchQuery = "";
}

export function applyReplayJsonlTransfer(
  state: ReplayState,
  transfer: ReplayTransferState,
  appliedVersion: number,
): number {
  if (!transfer.version || transfer.version === appliedVersion) {
    return appliedVersion;
  }
  state.jsonl = transfer.jsonl || "";
  state.lastReplayResult = null;
  return transfer.version;
}

export function applyReplayStatus(
  state: ReplayState,
  status: ReplayStatusState | undefined,
): void {
  if (status !== undefined) state.statusText = status.text || "";
}
