import { removeBodyClass, setBodyClass } from "../../../lib/browser.js";
import type { OverlayToastRuntime } from "../model/types.js";

type SonnerToast = (typeof import("svelte-sonner"))["toast"];

let sonnerToastPromise: Promise<SonnerToast> | null = null;

function loadToast(): Promise<SonnerToast> {
  if (!sonnerToastPromise) {
    sonnerToastPromise = import("svelte-sonner").then((module) => module.toast);
  }
  return sonnerToastPromise;
}

export const overlayRuntime: OverlayToastRuntime = {
  canShowToast(): boolean {
    return typeof window !== "undefined";
  },
  loadToast,
  setBodyLocked(locked: boolean): void {
    if (locked) {
      setBodyClass("overflow-hidden", true);
    } else {
      removeBodyClass("overflow-hidden");
    }
  },
};
