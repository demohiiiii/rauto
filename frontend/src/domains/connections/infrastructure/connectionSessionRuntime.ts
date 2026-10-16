import { hasWindow } from "$lib/browser.js";

export function subscribeConnectionStatusChecks(check: () => void): () => void {
  if (!hasWindow()) return () => {};
  const interval = window.setInterval(check, 15_000);
  window.addEventListener("online", check);
  return () => {
    window.clearInterval(interval);
    window.removeEventListener("online", check);
  };
}
