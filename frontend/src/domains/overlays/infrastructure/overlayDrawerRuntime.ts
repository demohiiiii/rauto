import {
  currentPathname,
  pushBrowserState,
  storageGet,
  storageSet,
  writeClipboardText,
} from "../../../lib/browser.js";
import { routeById } from "$domains/dashboard/model/navigation.js";
import type {
  OverlayDrawerRuntime,
  RecordDrawerPreferences,
} from "../model/types.js";

const RECORD_DRAWER_STORAGE = Object.freeze({
  displayMode: "rauto_record_view_mode",
  eventKind: "rauto_record_event_kind",
  failedOnly: "rauto_record_failed_only",
  searchQuery: "rauto_record_search_query",
});

function loadPreferences(): RecordDrawerPreferences {
  return {
    displayMode:
      storageGet(RECORD_DRAWER_STORAGE.displayMode, "list") === "raw"
        ? "raw"
        : "list",
    eventKind: storageGet(RECORD_DRAWER_STORAGE.eventKind, "all"),
    failedOnly: storageGet(RECORD_DRAWER_STORAGE.failedOnly) === "true",
    searchQuery: storageGet(RECORD_DRAWER_STORAGE.searchQuery),
  };
}

function savePreferences(preferences: RecordDrawerPreferences): void {
  storageSet(RECORD_DRAWER_STORAGE.displayMode, preferences.displayMode);
  storageSet(RECORD_DRAWER_STORAGE.eventKind, preferences.eventKind);
  storageSet(RECORD_DRAWER_STORAGE.failedOnly, String(preferences.failedOnly));
  storageSet(RECORD_DRAWER_STORAGE.searchQuery, preferences.searchQuery);
}

function navigateToReplay(): boolean {
  const route = routeById("replay");
  if (!route) return false;
  if (currentPathname() !== route.path) {
    pushBrowserState({ routeId: route.id }, route.path);
  }
  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function"
  ) {
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  return true;
}

export const overlayDrawerRuntime: OverlayDrawerRuntime = {
  loadPreferences,
  navigateToReplay,
  savePreferences,
  writeClipboardText,
};
