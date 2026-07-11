import { derived, writable } from "svelte/store";
import {
  openConnectionHistoryDrawer,
  openConnectionModal,
  sidebarConnectionPresentation,
  sidebarConnectionState,
} from "./connections.js";
import {
  dashboardOverlayDrawerState,
  dashboardRecordLevelState,
  dashboardRecordToolsPresentation,
  closeDashboardEntryDrawer,
  closeDashboardHistoryDrawer,
  closeDashboardOverlayOnEscape,
  closeDashboardRecordDrawer,
  createDashboardOverlayHostWorkspace,
  openDashboardRecordDrawer,
  toggleDashboardRecordLevel,
} from "./dashboardOverlays.js";
import {
  addBodyClass,
  bodyHasClass,
  currentPathname,
  getBodyAttribute,
  getDocumentLanguage,
  pushBrowserState,
  removeBodyAttribute,
  removeBodyClass,
  setBodyAttribute,
  setDocumentLanguage,
} from "../lib/browser.js";
import { createLazyComponentRegistry } from "../lib/svelte.js";
import {
  callbackMappedFormCheckedHandler,
  submitOnKeyHandler,
} from "../lib/events.js";
import { currentLanguageState, tr } from "../lib/i18n.js";
import {
  dashboardNavigationItems,
  routeById,
} from "../config/dashboardNavigation.js";
import {
  createDashboardAgentAuthPanelWorkspace,
  createDashboardAppWorkspace,
  createDashboardPreferenceToolsWorkspace,
  dashboardState,
  getDashboardState,
  protectedDashboardResourcesRefreshState,
  refreshProtectedDashboardResources,
} from "./dashboardApp.js";

export {
  closeDashboardEntryDrawer,
  closeDashboardHistoryDrawer,
  closeDashboardOverlayOnEscape,
  closeDashboardRecordDrawer,
  createDashboardAgentAuthPanelWorkspace,
  createDashboardAppWorkspace,
  createDashboardOverlayHostWorkspace,
  createDashboardPreferenceToolsWorkspace,
  dashboardState,
  getDashboardState,
  protectedDashboardResourcesRefreshState,
  refreshProtectedDashboardResources,
};

const dashboardSidebarConnectionState = sidebarConnectionState;

const dashboardSidebarConnectionPresentation = (connectionState = {}) =>
  sidebarConnectionPresentation(connectionState);
const openDashboardConnectionHistoryDrawer = () =>
  openConnectionHistoryDrawer();
const openDashboardConnectionEditor = () => openConnectionModal();

export { dashboardRecordToolsPresentation };

// Keep the direct shell-side module path visible so dashboard infrastructure
// checks can verify transaction template resources still resolve from the
// focused transactions workspace module.
async function loadTransactionsWorkspaceModule() {
  return import("./transactionPanelState.js");
}

function isDashboardTabActive(dashboard = {}, tab = "") {
  return (
    dashboard.currentTab === tab && (tab !== "tasks" || dashboard.tasksVisible)
  );
}

function activeDashboardPageDefinition(pageDefinitions, dashboard = {}) {
  return pageDefinitions.find((pageDefinition) =>
    isDashboardTabActive(dashboard, pageDefinition.id),
  );
}

function dashboardPageOutletRows(
  pageDefinitions,
  dashboard = {},
  loadedComponents = {},
  loadErrors = {},
) {
  const activePage = activeDashboardPageDefinition(pageDefinitions, dashboard);
  if (!activePage) return [];
  return [
    {
      active: true,
      errorMessage: loadErrors[activePage.id] || "",
      id: activePage.id,
      PageComponent: loadedComponents[activePage.id],
    },
  ];
}

function dashboardNavItemPresentation(navigationItem, dashboard = {}) {
  return {
    active:
      navigationItem.activeWhen === dashboard.currentTab &&
      (!navigationItem.txStage ||
        navigationItem.txStage === dashboard.currentTxStage),
    labelText: tr(navigationItem.labelKey, navigationItem.label),
    visible: navigationItem.activeWhen !== "tasks" || dashboard.tasksVisible,
  };
}

function dashboardSidebarNavigationPresentation(dashboard = {}) {
  return dashboardNavigationItems.map((navigationItem) => ({
    ...dashboardNavItemPresentation(navigationItem, dashboard),
    group: navigationItem.group || "operations",
    routeId: navigationItem.routeId,
  }));
}

function dashboardTabPanelDisplay({
  title = "",
  titleFallback = "",
  titleKey = "",
} = {}) {
  return {
    panelTitle: titleKey ? tr(titleKey, titleFallback || titleKey) : title,
  };
}

export function createDashboardTabPanelWorkspace() {
  const panelInputStateStore = writable({
    title: "",
    titleFallback: "",
    titleKey: "",
  });
  const panelDisplayStateStore = derived(
    [panelInputStateStore, currentLanguageState],
    ([$panelInputStateStore, _currentLanguageState]) =>
      dashboardTabPanelDisplay($panelInputStateStore),
  );

  function setPanelContext({
    title = "",
    titleFallback = "",
    titleKey = "",
  } = {}) {
    panelInputStateStore.set({
      title,
      titleFallback,
      titleKey,
    });
  }

  return {
    panelDisplayStateStore,
    setPanelContext,
  };
}

function dashboardSidebarDisplay() {
  return {
    closeAria: tr("sidebarCloseAria", "Close sidebar"),
  };
}

function dashboardBodyDisplay(shellState = {}) {
  return {
    currentTheme: shellState.currentTheme === "light" ? "light" : "dark",
    loadingStatus: { message: tr("loading", "Loading..."), variant: "alert" },
    pageErrorStatus: { tone: "error", variant: "alert" },
    pageTitle: tr("title", "rauto Web Console"),
    requestFailedMessage: tr("requestFailed", "Request failed"),
    sidebarOpenAria: tr("sidebarOpenAria", "Open sidebar"),
  };
}

function applyDashboardDocumentState(theme, language) {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  const previousLang = getDocumentLanguage();
  const previousDashboardTheme = getBodyAttribute("data-dashboard-theme");
  const previousDaisyTheme = getBodyAttribute("data-theme");
  const hadDashboardBodyClass = bodyHasClass("dashboard-body");
  const hadDarkClass = bodyHasClass("dark");

  addBodyClass("dashboard-body");
  if (normalizedTheme === "dark") {
    addBodyClass("dark");
  } else {
    removeBodyClass("dark");
  }
  setBodyAttribute("data-dashboard-theme", normalizedTheme);
  setBodyAttribute("data-theme", normalizedTheme);
  setDocumentLanguage(language === "zh" ? "zh-CN" : "en");

  return () => {
    if (!hadDashboardBodyClass) {
      removeBodyClass("dashboard-body");
    }
    if (hadDarkClass) {
      addBodyClass("dark");
    } else {
      removeBodyClass("dark");
    }
    if (previousDashboardTheme === null) {
      removeBodyAttribute("data-dashboard-theme");
    } else {
      setBodyAttribute("data-dashboard-theme", previousDashboardTheme);
    }
    if (previousDaisyTheme === null) {
      removeBodyAttribute("data-theme");
    } else {
      setBodyAttribute("data-theme", previousDaisyTheme);
    }
    setDocumentLanguage(previousLang);
  };
}

export function createDashboardBodyWorkspace(pageDefinitions = []) {
  const pageRegistry = createLazyComponentRegistry({
    errorMessage: () =>
      dashboardBodyDisplay(getDashboardState()).requestFailedMessage,
  });
  const sidebarOpenStateStore = writable(false);
  const bodyDisplayStateStore = derived(
    [dashboardState, currentLanguageState],
    ([$dashboardState, _currentLanguageState]) =>
      dashboardBodyDisplay($dashboardState),
  );
  const recordToolsDisplayStateStore = derived(
    [
      dashboardOverlayDrawerState,
      dashboardRecordLevelState,
      currentLanguageState,
    ],
    ([
      $dashboardOverlayDrawerState,
      $dashboardRecordLevelState,
      _currentLanguageState,
    ]) =>
      dashboardRecordToolsPresentation({
        overlayState: $dashboardOverlayDrawerState,
        recordLevel: $dashboardRecordLevelState,
      }),
  );
  const pageOutletRowsStateStore = derived(
    [dashboardState, pageRegistry.components, pageRegistry.errors],
    ([$dashboardState, $loadedPageComponents, $pageLoadErrors]) =>
      dashboardPageOutletRows(
        pageDefinitions,
        $dashboardState,
        $loadedPageComponents,
        $pageLoadErrors,
      ),
  );

  function closeSidebarAction() {
    sidebarOpenStateStore.set(false);
  }

  function openSidebar() {
    sidebarOpenStateStore.set(true);
  }

  function setSidebarOpen(open) {
    sidebarOpenStateStore.set(!!open);
  }

  function applyShellState({
    language = "en",
    shellState = getDashboardState(),
  } = {}) {
    pageRegistry.ensure(
      activeDashboardPageDefinition(pageDefinitions, shellState),
    );
    return applyDashboardDocumentState(shellState.currentTheme, language);
  }

  return {
    applyShellState,
    bodyDisplayStateStore,
    closeSidebarAction,
    documentKeydownHandler: submitOnKeyHandler("Escape", closeSidebarAction),
    openHistoryDrawerAction: openDashboardConnectionHistoryDrawer,
    openRecordDrawerAction: openDashboardRecordDrawer,
    openSidebar,
    openSidebarAction: openSidebar,
    pageOutletRowsStateStore,
    recordToolsDisplayStateStore,
    sidebarOpenChangeHandler: callbackMappedFormCheckedHandler(
      setSidebarOpen,
      (open) => open,
    ),
    setSidebarOpen,
    sidebarOpenStateStore,
    toggleRecordLevelAction: toggleDashboardRecordLevel,
  };
}

export function createDashboardSidebarWorkspace() {
  const sidebarDisplayStateStore = derived(
    currentLanguageState,
    (_currentLanguageState) => dashboardSidebarDisplay(),
  );
  const sidebarConnectionDisplayStateStore = derived(
    [dashboardSidebarConnectionState, currentLanguageState],
    ([$dashboardSidebarConnectionState, _currentLanguageState]) =>
      dashboardSidebarConnectionPresentation($dashboardSidebarConnectionState),
  );
  const navigationItemsStateStore = derived(
    [dashboardState, currentLanguageState],
    ([$dashboardState, _currentLanguageState]) =>
      dashboardSidebarNavigationPresentation($dashboardState),
  );

  function navigateRoute(routeId = "") {
    return navigateDashboardRoute(routeId);
  }

  function openConnectionEditor() {
    openDashboardConnectionEditor();
  }

  return {
    navigationItemsStateStore,
    navigateRoute,
    openConnectionEditor,
    sidebarConnectionDisplayStateStore,
    sidebarDisplayStateStore,
  };
}

function navigateDashboardRoute(routeId = "") {
  const route = routeById(routeId);
  if (!route) {
    return;
  }

  if (currentPathname() !== route.path) {
    pushBrowserState({ routeId: route.id }, route.path);
  }

  dashboardState.update((currentDashboard) => ({
    ...currentDashboard,
    currentTab: route.tab || currentDashboard.currentTab,
    currentTxStage: route.txStage || currentDashboard.currentTxStage,
  }));
}
