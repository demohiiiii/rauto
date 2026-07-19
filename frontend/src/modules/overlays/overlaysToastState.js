import { removeBodyClass, setBodyClass } from "../../lib/browser.js";
import { displayString } from "../../lib/ui.js";

let sonnerToastPromise = null;

function loadSonnerToast() {
  if (!sonnerToastPromise) {
    sonnerToastPromise = import("svelte-sonner").then((module) => module.toast);
  }
  return sonnerToastPromise;
}

export function applyOverlayBodyLock(locked) {
  setBodyClass("overflow-hidden", locked);
  return () => {
    removeBodyClass("overflow-hidden");
  };
}

export function showToast(message, tone = "info") {
  const normalizedTone = ["success", "error", "warning", "info"].includes(tone)
    ? tone
    : "info";
  const duration =
    normalizedTone === "error"
      ? 7000
      : normalizedTone === "warning"
        ? 5000
        : 3600;
  const messageText = displayString(message || "-");

  if (typeof window === "undefined") return undefined;

  return loadSonnerToast().then((toast) => {
    const toastHandler =
      normalizedTone === "info" ? toast : (toast[normalizedTone] ?? toast);
    return toastHandler(messageText, { duration });
  });
}
