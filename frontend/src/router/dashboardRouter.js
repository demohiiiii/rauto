import {
  dashboardRoutes,
  defaultDashboardRoute,
  routeById,
  routeByPath,
} from "../routes.js";
import {
  setDashboardTab,
  setDashboardTxStage,
} from "../state/dashboardView.js";

function currentRoute() {
  return routeByPath(window.location.pathname);
}

function applyRoute(route) {
  const tab = route.tab || defaultDashboardRoute.tab;
  setDashboardTab(tab);
  if (route.txStage) {
    setDashboardTxStage(route.txStage);
    window.onDashboardTabChange?.(tab);
    window.onDashboardOpKindChange?.("tx");
    window.onDashboardTxStageChange?.(route.txStage);
    return;
  }
  if (tab === "standard") {
    window.onDashboardOpKindChange?.("exec");
  }
  window.onDashboardTabChange?.(tab);
}

export function navigateDashboardRoute(routeOrId) {
  const route =
    typeof routeOrId === "string" ? routeById(routeOrId) : routeOrId;
  if (!route) {
    return;
  }
  if (window.location.pathname !== route.path) {
    window.history.pushState({ routeId: route.id }, "", route.path);
  }
  applyRoute(route);
}

export function initDashboardRouter() {
  const handlePopState = () => applyRoute(currentRoute());
  window.addEventListener("popstate", handlePopState);

  if (window.location.pathname === "/") {
    window.history.replaceState(
      { routeId: defaultDashboardRoute.id },
      "",
      defaultDashboardRoute.path,
    );
  }
  applyRoute(currentRoute());

  return () => {
    window.removeEventListener("popstate", handlePopState);
  };
}
