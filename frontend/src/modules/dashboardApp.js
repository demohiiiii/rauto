import { tick } from "svelte";
import { derived, get, writable } from "svelte/store";
import {
  getAgentApiToken,
  getAgentInfo,
  setAgentApiToken,
} from "../api/client.js";
import {
  loadSavedConnections,
  refreshConnectionProfileOptions,
  refreshSidebarConnectionSelector,
  setSavedConnectionStatus,
} from "./connections.js";
import {
  addWindowListener,
  currentPathname,
  currentUrl,
  pushBrowserState,
  replaceBrowserState,
} from "../lib/browser.js";
import { currentLanguageState, t, tr } from "../lib/i18n.js";
import {
  defaultDashboardRoute,
  routeById,
  routeByPath,
} from "../config/dashboardNavigation.js";
import {
  applyDashboardI18n,
  bindSystemThemeListener,
  createDashboardAgentAuthPanelWorkspace as createDashboardAgentAuthPanelWorkspaceState,
  createDashboardPreferenceToolsWorkspace as createDashboardPreferenceToolsWorkspaceState,
  dashboardState,
  destroySystemThemeListener,
  getDashboardState,
  initializeDashboardStatePreferences,
  markProtectedDashboardResourcesRefreshCompleted,
  protectedDashboardResourcesRefreshState,
  refreshAgentAuthStatus,
  setDashboardManagedAgentMode,
  setDashboardTab,
  setDashboardTxStage,
} from "./dashboardAppState.js";

export {
  dashboardState,
  getDashboardState,
  protectedDashboardResourcesRefreshState,
} from "./dashboardAppState.js";

const dashboardBootstrapState = writable({
  error: "",
  status: "loading",
});

const featureModules = {
  profile: null,
  transactionsWorkspace: null,
};
const featureModulePromises = new Map();

let dashboardAppBootstrapped = false;

function dashboardBootstrapDisplay(bootstrap = {}) {
  return {
    busy: bootstrap.status === "loading",
    errorMessage: bootstrap.error || "",
    loadFailedTitle: tr(
      "dashboardLoadFailedTitle",
      "Failed to load rauto web dashboard",
    ),
    reloadButtonLabel: tr("dashboardReloadBtn", "Reload dashboard"),
    showError: bootstrap.status === "error",
  };
}

function dashboardModuleLoadErrorMessage(error) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : String(error || "");
}

async function loadDashboardBodyComponentModule() {
  const componentModule =
    await import("../components/layout/DashboardBody.svelte");
  return componentModule.default;
}

export function createDashboardAppWorkspace() {
  const dashboardBodyComponentStateStore = writable(null);
  const dashboardBodyLoadErrorStateStore = writable("");
  const bootstrapDisplayStateStore = derived(
    [dashboardBootstrapState, currentLanguageState],
    ([$dashboardBootstrapState, _currentLanguageState]) =>
      dashboardBootstrapDisplay($dashboardBootstrapState),
  );

  function ensureDashboardBodyComponentLoaded() {
    if (
      get(dashboardBodyComponentStateStore) ||
      get(dashboardBodyLoadErrorStateStore)
    ) {
      return undefined;
    }

    let cancelled = false;

    async function loadDashboardBodyComponentIntoStore() {
      try {
        const dashboardBodyComponent = await loadDashboardBodyComponentModule();
        if (!cancelled && dashboardBodyComponent) {
          dashboardBodyComponentStateStore.set(dashboardBodyComponent);
        }
      } catch (error) {
        if (!cancelled) {
          dashboardBodyLoadErrorStateStore.set(
            dashboardModuleLoadErrorMessage(error),
          );
        }
      }
    }

    void loadDashboardBodyComponentIntoStore();
    return () => {
      cancelled = true;
    };
  }

  function applyAppBootstrap() {
    return startDashboardAppBootstrap();
  }

  return {
    applyAppBootstrap,
    bootstrapDisplayStateStore,
    dashboardBodyComponentStateStore,
    dashboardBodyLoadErrorStateStore,
    ensureDashboardBodyComponentLoaded,
  };
}

export function createDashboardPreferenceToolsWorkspace() {
  return createDashboardPreferenceToolsWorkspaceState();
}

export function createDashboardAgentAuthPanelWorkspace() {
  return createDashboardAgentAuthPanelWorkspaceState({
    onRefreshProtectedResources: refreshProtectedDashboardResources,
  });
}

async function loadFeatureModule(key, loader) {
  if (featureModules[key]) {
    return featureModules[key];
  }
  if (!featureModulePromises.has(key)) {
    featureModulePromises.set(
      key,
      (async () => {
        try {
          const featureModule = await loader();
          featureModules[key] = featureModule;
          return featureModule;
        } catch (error) {
          featureModulePromises.delete(key);
          throw error;
        }
      })(),
    );
  }
  return featureModulePromises.get(key);
}

function loadProfilesModule() {
  return loadFeatureModule("profile", () => import("./profiles.js"));
}

function loadTransactionsWorkspaceModule() {
  return loadFeatureModule(
    "transactionsWorkspace",
    () => import("./transactionsWorkspace.js"),
  );
}

function maybePersistAgentTokenFromUrl() {
  const url = currentUrl();
  const token = (
    url.searchParams.get("token") ||
    url.searchParams.get("api_token") ||
    ""
  ).trim();
  if (!token) return false;
  setAgentApiToken(token);
  url.searchParams.delete("token");
  url.searchParams.delete("api_token");
  replaceBrowserState({}, url.toString());
  return true;
}

async function detectManagedAgentMode() {
  try {
    const agentInfoPayload = await getAgentInfo();
    const managed = !!(agentInfoPayload && agentInfoPayload.managed);
    setDashboardManagedAgentMode(managed);
    return managed;
  } catch (_) {
    setDashboardManagedAgentMode(false);
    return false;
  } finally {
    refreshAgentAuthStatus();
  }
}

export async function refreshProtectedDashboardResources() {
  const [profilesModule, transactionsWorkspaceModule] = await Promise.all([
    loadProfilesModule(),
    loadTransactionsWorkspaceModule(),
  ]);

  await Promise.allSettled([
    loadSavedConnections(),
    profilesModule.loadProfilesOverview(),
    transactionsWorkspaceModule.loadAllJsonTemplates(),
  ]);
  markProtectedDashboardResourcesRefreshCompleted();
  refreshConnectionProfileOptions();
  refreshSidebarConnectionSelector();
}

async function initializeProtectedDashboardResources() {
  maybePersistAgentTokenFromUrl();
  await detectManagedAgentMode();
  if (getDashboardState().managedAgentMode && !getAgentApiToken()) {
    setSavedConnectionStatus(t("agentAuthRequired"), "info");
    return;
  }
  await refreshProtectedDashboardResources();
}

async function initializeProfilesModule() {
  const profilesModule = await loadProfilesModule();
  profilesModule.initializeProfiles();
}

function initializeDashboardAppState() {
  bindSystemThemeListener();
  applyDashboardI18n();
  void initializeProtectedDashboardResources();
  void initializeProfilesModule();
  refreshAgentAuthStatus();
}

function onDashboardTabChange(tab) {
  setDashboardTab(tab);
}

function onDashboardTxStageChange(stage) {
  setDashboardTxStage(stage);
}

function currentDashboardRoute() {
  return routeByPath(currentPathname());
}

function applyDashboardRoute(route) {
  const tab = route.tab || defaultDashboardRoute.tab;
  if (route.txStage) {
    onDashboardTabChange(tab);
    onDashboardTxStageChange(route.txStage);
    return;
  }
  onDashboardTabChange(tab);
}

function navigateDashboardRoute(routeOrId) {
  const route =
    typeof routeOrId === "string" ? routeById(routeOrId) : routeOrId;
  if (!route) {
    return;
  }
  if (currentPathname() !== route.path) {
    pushBrowserState({ routeId: route.id }, route.path);
  }
  applyDashboardRoute(route);
}

function initDashboardRouter() {
  const handlePopState = () => applyDashboardRoute(currentDashboardRoute());
  const removePopStateListener = addWindowListener("popstate", handlePopState);

  if (currentPathname() === "/") {
    replaceBrowserState(
      { routeId: defaultDashboardRoute.id },
      defaultDashboardRoute.path,
    );
  }
  applyDashboardRoute(currentDashboardRoute());

  return () => {
    removePopStateListener();
  };
}

function isDashboardAppBootstrapped() {
  return dashboardAppBootstrapped;
}

function markDashboardAppBootstrapped() {
  dashboardAppBootstrapped = true;
}

function clearDashboardAppBootstrapped() {
  dashboardAppBootstrapped = false;
}

async function bootstrapDashboardApp() {
  if (isDashboardAppBootstrapped()) {
    return null;
  }

  initializeDashboardStatePreferences();
  await tick();

  initializeDashboardAppState();
  const destroyDashboardRouter = initDashboardRouter();
  markDashboardAppBootstrapped();
  return () => {
    if (typeof destroyDashboardRouter === "function") destroyDashboardRouter();
    destroySystemThemeListener();
    clearDashboardAppBootstrapped();
  };
}

function startDashboardAppBootstrap() {
  let mounted = true;
  let destroyDashboardAppState = null;

  dashboardBootstrapState.set({
    error: "",
    status: "loading",
  });

  async function runBootstrap() {
    try {
      const destroyDashboardAfterBootstrap = await bootstrapDashboardApp();
      if (!mounted) {
        if (typeof destroyDashboardAfterBootstrap === "function") {
          destroyDashboardAfterBootstrap();
        }
        return;
      }
      destroyDashboardAppState = destroyDashboardAfterBootstrap;
      dashboardBootstrapState.set({
        error: "",
        status: "ready",
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      dashboardBootstrapState.set({
        error: error instanceof Error ? error.message : String(error),
        status: "error",
      });
    }
  }

  void runBootstrap();

  return () => {
    mounted = false;
    if (typeof destroyDashboardAppState === "function") {
      destroyDashboardAppState();
      destroyDashboardAppState = null;
    }
  };
}
