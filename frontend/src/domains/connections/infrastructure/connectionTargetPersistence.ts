import { storageGet, storageRemove, storageSet } from "../../../lib/browser.js";
import type { PersistedConnectionTarget } from "../model/types.js";

const CONNECTION_TARGET_STORAGE_KEY = "rauto_connection_target";

export function clearPersistedConnectionTarget(): void {
  storageRemove(CONNECTION_TARGET_STORAGE_KEY);
}

export function readConnectionTargetPersistence(): PersistedConnectionTarget | null {
  try {
    const raw = storageGet(CONNECTION_TARGET_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const target = parsed as Record<string, unknown>;
    return typeof target.kind === "string"
      ? (target as PersistedConnectionTarget)
      : null;
  } catch {
    clearPersistedConnectionTarget();
    return null;
  }
}

export function writeConnectionTargetPersistence(
  target: PersistedConnectionTarget | null,
): void {
  try {
    if (!target) {
      clearPersistedConnectionTarget();
      return;
    }
    storageSet(CONNECTION_TARGET_STORAGE_KEY, JSON.stringify(target));
  } catch {
    // Storage failures must not prevent an in-memory target change.
  }
}
