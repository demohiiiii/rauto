import { tick } from "svelte";
import { derived, get, writable } from "svelte/store";
import { currentLanguageState, t, tr } from "../../../lib/i18n.js";
import { dashboardApi } from "../infrastructure/dashboardApi.js";
import { dashboardResources } from "../infrastructure/dashboardResources.js";
import { dashboardRuntime } from "../infrastructure/dashboardRuntime.js";
import {
  defaultDashboardRoute,
  routeById,
  routeByPath,
} from "../model/navigation.js";
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
} from "./dashboardState.js";
import type {
  DashboardBootstrapDisplay,
  DashboardBootstrapState,
  DashboardRoute,
} from "../model/types.js";

export {
  dashboardState,
  getDashboardState,
  protectedDashboardResourcesRefreshState,
} from "./dashboardState.js";

const dashboardBootstrapState = writable<DashboardBootstrapState>({
  error: "",
  status: "loading",
});

interface ProfilesFeatureModule {
  initializeProfiles(): void;
  loadProfilesOverview(): Promise<unknown>;
}

interface TransactionsFeatureModule {
  loadAllJsonTemplates(): Promise<unknown>;
}

interface DashboardFeatureModules {
  profile: ProfilesFeatureModule;
  transactionsWorkspace: TransactionsFeatureModule;
}

type DashboardFeatureModuleKey = keyof DashboardFeatureModules;

const featureModules = new Map<DashboardFeatureModuleKey, unknown>();
const featureModulePromises = new Map<
  DashboardFeatureModuleKey,
  Promise<unknown>
>();

let dashboardAppBootstrapped = false;

function dashboardBootstrapDisplay(
  bootstrap: DashboardBootstrapState,
): DashboardBootstrapDisplay {
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

function dashboardModuleLoadErrorMessage(error: unknown): string {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : String(error || "");
}

async function loadDashboardBodyComponentModule() {
  const componentModule =
    await import("../presentation/components/DashboardBody.svelte");
  return componentModule.default;
}

export function createDashboardAppWorkspace() {
  initializeDashboardStatePreferences();
  const dashboardBodyComponentStateStore = writable<unknown>(null);
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

async function loadFeatureModule<K extends DashboardFeatureModuleKey>(
  key: K,
  loader: () => Promise<DashboardFeatureModules[K]>,
): Promise<DashboardFeatureModules[K]> {
  const cachedModule = featureModules.get(key);
  if (cachedModule) {
    return cachedModule as DashboardFeatureModules[K];
  }
  if (!featureModulePromises.has(key)) {
    featureModulePromises.set(
      key,
      (async () => {
        try {
          const featureModule = await loader();
          featureModules.set(key, featureModule);
          return featureModule;
        } catch (error) {
          featureModulePromises.delete(key);
          throw error;
        }
      })(),
    );
  }
  return featureModulePromises.get(key) as Promise<DashboardFeatureModules[K]>;
}

function loadProfilesModule(): Promise<ProfilesFeatureModule> {
  return loadFeatureModule(
    "profile",
    () => import("$domains/profiles/application/profileCatalogState.js"),
  );
}

function loadTransactionsWorkspaceModule(): Promise<TransactionsFeatureModule> {
  return loadFeatureModule(
    "transactionsWorkspace",
    () => import("../../transactions/application/transactionPanelState.js"),
  );
}

function maybePersistAgentTokenFromUrl(): boolean {
  const url = dashboardRuntime.currentUrl();
  const token = (
    url.searchParams.get("token") ||
    url.searchParams.get("api_token") ||
    ""
  ).trim();
  if (!token) return false;
  dashboardApi.setAgentApiToken(token);
  url.searchParams.delete("token");
  url.searchParams.delete("api_token");
  dashboardRuntime.replaceBrowserState({}, url.toString());
  return true;
}

async function detectManagedAgentMode(): Promise<boolean> {
  try {
    const agentInfoPayload = await dashboardApi.getAgentInfo();
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

export async function refreshProtectedDashboardResources(): Promise<void> {
  const [profilesModule, transactionsWorkspaceModule] = await Promise.all([
    loadProfilesModule(),
    loadTransactionsWorkspaceModule(),
  ]);

  await Promise.allSettled([
    dashboardResources.loadSavedConnections(),
    profilesModule.loadProfilesOverview(),
    transactionsWorkspaceModule.loadAllJsonTemplates(),
  ]);
  markProtectedDashboardResourcesRefreshCompleted();
  dashboardResources.refreshConnectionProfileOptions();
  dashboardResources.refreshSidebarConnectionSelector();
}

async function initializeProtectedDashboardResources(): Promise<void> {
  maybePersistAgentTokenFromUrl();
  await detectManagedAgentMode();
  if (
    getDashboardState().managedAgentMode &&
    !dashboardApi.getAgentApiToken()
  ) {
    dashboardResources.setSavedConnectionStatus(t("agentAuthRequired"), "info");
    return;
  }
  await refreshProtectedDashboardResources();
}

async function initializeProfilesModule(): Promise<void> {
  const profilesModule = await loadProfilesModule();
  profilesModule.initializeProfiles();
}

function initializeDashboardAppState(): void {
  bindSystemThemeListener();
  applyDashboardI18n();
  void initializeProtectedDashboardResources();
  void initializeProfilesModule();
  refreshAgentAuthStatus();
}

function onDashboardTabChange(tab: unknown): void {
  setDashboardTab(tab);
}

function onDashboardTxStageChange(stage: unknown): void {
  setDashboardTxStage(stage);
}

function currentDashboardRoute(): DashboardRoute {
  return routeByPath(dashboardRuntime.currentPathname());
}

function applyDashboardRoute(route: DashboardRoute): void {
  const tab = route.tab || defaultDashboardRoute.tab;
  if (route.txStage) {
    onDashboardTabChange(tab);
    onDashboardTxStageChange(route.txStage);
    return;
  }
  onDashboardTabChange(tab);
}

function navigateDashboardRoute(routeOrId: DashboardRoute | string): void {
  const route =
    typeof routeOrId === "string" ? routeById(routeOrId) : routeOrId;
  if (!route) {
    return;
  }
  if (dashboardRuntime.currentPathname() !== route.path) {
    dashboardRuntime.pushBrowserState({ routeId: route.id }, route.path);
  }
  applyDashboardRoute(route);
}

function initDashboardRouter(): () => void {
  const handlePopState = () => applyDashboardRoute(currentDashboardRoute());
  const removePopStateListener = dashboardRuntime.addWindowListener(
    "popstate",
    handlePopState,
  );

  if (dashboardRuntime.currentPathname() === "/") {
    dashboardRuntime.replaceBrowserState(
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

async function bootstrapDashboardApp(): Promise<(() => void) | null> {
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

function startDashboardAppBootstrap(): () => void {
  let mounted = true;
  let destroyDashboardAppState: (() => void) | null = null;

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
