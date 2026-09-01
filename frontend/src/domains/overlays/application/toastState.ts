import { displayString } from "../../../lib/ui.js";
import { overlayRuntime } from "../infrastructure/overlayRuntime.js";
import type { OverlayToastTone } from "../model/types.js";

const overlayToastTones: readonly OverlayToastTone[] = [
  "success",
  "error",
  "warning",
  "info",
];

function normalizeToastTone(tone: unknown): OverlayToastTone {
  return overlayToastTones.includes(tone as OverlayToastTone)
    ? (tone as OverlayToastTone)
    : "info";
}

function toastDuration(tone: OverlayToastTone): number {
  if (tone === "error") return 7000;
  if (tone === "warning") return 5000;
  return 3600;
}

export function applyOverlayBodyLock(locked: unknown): () => void {
  overlayRuntime.setBodyLocked(!!locked);
  return () => overlayRuntime.setBodyLocked(false);
}

export function showToast(message: unknown, tone: unknown = "info") {
  const normalizedTone = normalizeToastTone(tone);
  const duration = toastDuration(normalizedTone);
  const messageText = displayString(message || "-");

  if (!overlayRuntime.canShowToast()) return undefined;

  return overlayRuntime.loadToast().then((toast) => {
    const toastHandler =
      normalizedTone === "info" ? toast : toast[normalizedTone];
    return toastHandler(messageText, { duration });
  });
}
