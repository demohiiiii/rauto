import { currentPathname, pushBrowserState } from "../../../lib/browser.js";
import { routeById } from "$domains/dashboard/model/navigation.js";

export function navigateToReplay(): boolean {
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
