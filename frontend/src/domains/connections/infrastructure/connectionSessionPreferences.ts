import { storageGet, storageSet } from "$lib/browser.js";
import {
  defaultConnectionKeepAlive,
  validHeartbeatInterval,
} from "../model/connectionSession.js";
import type { ConnectionKeepAlive } from "../model/types.js";

const storageKey = "rauto_connection_session_preferences";

export function readConnectionSessionPreferences(): ConnectionKeepAlive {
  try {
    const parsed: unknown = JSON.parse(storageGet(storageKey));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "enabled" in parsed &&
      typeof parsed.enabled === "boolean" &&
      "interval_secs" in parsed &&
      typeof parsed.interval_secs === "number" &&
      validHeartbeatInterval(parsed.interval_secs)
    ) {
      return { enabled: parsed.enabled, interval_secs: parsed.interval_secs };
    }
  } catch {
    /* Use defaults when browser storage is missing or invalid. */
  }
  return { ...defaultConnectionKeepAlive };
}

export function saveConnectionSessionPreferences(
  preferences: ConnectionKeepAlive,
): void {
  storageSet(storageKey, JSON.stringify(preferences));
}
