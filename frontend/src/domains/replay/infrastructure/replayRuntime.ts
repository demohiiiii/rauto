import { storageGet, storageSet } from "../../../lib/browser.js";
import {
  replayJsonlTransferState,
  replayStatusTextState,
} from "$domains/overlays/index.js";
import { openEntryDrawer } from "$domains/overlays/index.js";
import type {
  ReplayPreferences,
  ReplayRuntime,
  ReplayState,
} from "../model/types.js";

const REPLAY_STORAGE = Object.freeze({
  displayMode: "rauto_replay_view_mode",
  eventKind: "rauto_replay_event_kind",
  failedOnly: "rauto_replay_failed_only",
  searchQuery: "rauto_replay_search_query",
});

function loadPreferences(): ReplayPreferences {
  return {
    displayMode:
      storageGet(REPLAY_STORAGE.displayMode, "list") === "raw" ? "raw" : "list",
    eventKind: storageGet(REPLAY_STORAGE.eventKind, "all"),
    failedOnly: storageGet(REPLAY_STORAGE.failedOnly) === "true",
    searchQuery: storageGet(REPLAY_STORAGE.searchQuery),
  };
}

function savePreferences(state: ReplayState): void {
  storageSet(
    REPLAY_STORAGE.displayMode,
    state.displayMode === "raw" ? "raw" : "list",
  );
  storageSet(REPLAY_STORAGE.failedOnly, String(state.failedOnly));
  storageSet(REPLAY_STORAGE.eventKind, state.eventKind || "all");
  storageSet(REPLAY_STORAGE.searchQuery, state.searchQuery || "");
}

export const replayRuntime = {
  loadPreferences,
  openEntry: openEntryDrawer,
  replayJsonlTransferState,
  replayStatusTextState,
  savePreferences,
} as ReplayRuntime;
