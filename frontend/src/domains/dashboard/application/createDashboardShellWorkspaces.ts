import { derived, writable } from "svelte/store";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import type { I18nLanguage } from "../../../i18n/types.js";
import { dashboardRuntime } from "../infrastructure/dashboardRuntime.js";
import { dashboardShellResources } from "../infrastructure/dashboardShellResources.js";
import { dashboardNavigationItems, routeById } from "../model/navigation.js";
import type {
  DashboardBodyDisplay,
  DashboardNavigationItem,
  DashboardNavigationItemDisplay,
  DashboardPageComponent,
  DashboardPageDefinition,
  DashboardPageOutletRow,
  DashboardState,
} from "../model/types.js";
import {
  dashboardOverlayDrawerState,
  dashboardRecordLevelState,
  dashboardRecordToolsPresentation,
  openDashboardRecordDrawer,
  toggleDashboardRecordLevel,
} from "./createDashboardOverlayHostWorkspace.js";
import { dashboardState, getDashboardState } from "./dashboardState.js";

function isDashboardTabActive(
  dashboard: Partial<DashboardState> = {},
  tab = "",
): boolean {
  return (
    dashboard.currentTab === tab &&
    (tab !== "tasks" || !!dashboard.tasksVisible) &&
    (tab !== "schedules" || !dashboard.managedAgentMode) &&
    (tab !== "config-history" || !dashboard.managedAgentMode)
  );
}

function activeDashboardPageDefinition(
  pageDefinitions: readonly DashboardPageDefinition[],
  dashboard: Partial<DashboardState> = {},
): DashboardPageDefinition | undefined {
  return pageDefinitions.find((pageDefinition) =>
    isDashboardTabActive(dashboard, pageDefinition.id),
  );
}

function dashboardPageOutletRows(
  pageDefinitions: readonly DashboardPageDefinition[],
  dashboard: Partial<DashboardState> = {},
  loadedComponents: Record<string, DashboardPageComponent> = {},
  loadErrors: Record<string, string> = {},
): DashboardPageOutletRow[] {
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

function dashboardNavItemPresentation(
  navigationItem: DashboardNavigationItem,
  dashboard: Partial<DashboardState> = {},
): Pick<DashboardNavigationItemDisplay, "active" | "labelText" | "visible"> {
  return {
    active:
      navigationItem.activeWhen === dashboard.currentTab &&
      (!navigationItem.txStage ||
        navigationItem.txStage === dashboard.currentTxStage),
    labelText: tr(
      navigationItem.navLabelKey || navigationItem.labelKey,
      navigationItem.label,
    ),
    visible:
      (navigationItem.activeWhen !== "tasks" || !!dashboard.tasksVisible) &&
      (navigationItem.activeWhen !== "schedules" ||
        !dashboard.managedAgentMode) &&
      (navigationItem.activeWhen !== "config-history" ||
        !dashboard.managedAgentMode),
  };
}

function dashboardSidebarNavigationPresentation(
  dashboard: Partial<DashboardState> = {},
): DashboardNavigationItemDisplay[] {
  return dashboardNavigationItems.map((navigationItem) => ({
    ...navigationItem,
    ...dashboardNavItemPresentation(navigationItem, dashboard),
  }));
}

function activeDashboardNavigationItem(
  dashboard: Partial<DashboardState> = {},
): DashboardNavigationItem | undefined {
  return dashboardNavigationItems.find(
    (navigationItem) =>
      navigationItem.activeWhen === dashboard.currentTab &&
      (!navigationItem.txStage ||
        navigationItem.txStage === dashboard.currentTxStage),
  );
}

function dashboardSidebarDisplay() {
  return {
    closeAria: tr("sidebarCloseAria", "Close sidebar"),
  };
}

function dashboardBodyDisplay(
  shellState: Partial<DashboardState> = {},
): DashboardBodyDisplay {
  const activeNavigationItem = activeDashboardNavigationItem(shellState);
  return {
    breadcrumbAria: tr("dashboardBreadcrumbAria", "Breadcrumb"),
    breadcrumbRootText: tr("dashboardBreadcrumbRoot", "Console"),
    currentTheme: shellState.currentTheme === "light" ? "light" : "dark",
    loadingStatus: { message: tr("loading", "Loading..."), variant: "alert" },
    pageErrorStatus: { tone: "error", variant: "alert" },
    pageLabelText: activeNavigationItem
      ? tr(activeNavigationItem.labelKey, activeNavigationItem.label)
      : "",
    pageTitle: tr("title", "rauto Web Console"),
    requestFailedMessage: tr("requestFailed", "Request failed"),
    sidebarOpenAria: tr("sidebarOpenAria", "Open sidebar"),
  };
}

function applyDashboardDocumentState(
  theme: DashboardState["currentTheme"],
  language: I18nLanguage,
): () => void {
  const normalizedTheme = theme === "light" ? "light" : "dark";
  const previousLang = dashboardRuntime.getDocumentLanguage();
  const previousDashboardTheme = dashboardRuntime.getBodyAttribute(
    "data-dashboard-theme",
  );
  const previousDaisyTheme = dashboardRuntime.getBodyAttribute("data-theme");
  const hadDashboardBodyClass = dashboardRuntime.bodyHasClass("dashboard-body");
  const hadDarkClass = dashboardRuntime.bodyHasClass("dark");

  dashboardRuntime.addBodyClass("dashboard-body");
  if (normalizedTheme === "dark") {
    dashboardRuntime.addBodyClass("dark");
  } else {
    dashboardRuntime.removeBodyClass("dark");
  }
  dashboardRuntime.setBodyAttribute("data-dashboard-theme", normalizedTheme);
  dashboardRuntime.setBodyAttribute("data-theme", normalizedTheme);
  dashboardRuntime.setDocumentLanguage(language === "zh" ? "zh-CN" : "en");

  return () => {
    if (!hadDashboardBodyClass) {
      dashboardRuntime.removeBodyClass("dashboard-body");
    }
    if (hadDarkClass) {
      dashboardRuntime.addBodyClass("dark");
    } else {
      dashboardRuntime.removeBodyClass("dark");
    }
    if (previousDashboardTheme === null) {
      dashboardRuntime.removeBodyAttribute("data-dashboard-theme");
    } else {
      dashboardRuntime.setBodyAttribute(
        "data-dashboard-theme",
        previousDashboardTheme,
      );
    }
    if (previousDaisyTheme === null) {
      dashboardRuntime.removeBodyAttribute("data-theme");
    } else {
      dashboardRuntime.setBodyAttribute("data-theme", previousDaisyTheme);
    }
    dashboardRuntime.setDocumentLanguage(previousLang);
  };
}

export function createDashboardBodyWorkspace(
  pageDefinitions: readonly DashboardPageDefinition[] = [],
) {
  const pageRegistry = dashboardShellResources.createPageRegistry(
    () => dashboardBodyDisplay(getDashboardState()).requestFailedMessage,
  );
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

  function closeSidebarAction(): void {
    sidebarOpenStateStore.set(false);
  }

  function openSidebar(): void {
    sidebarOpenStateStore.set(true);
  }

  function setSidebarOpen(open: boolean): void {
    sidebarOpenStateStore.set(open);
  }

  function applyShellState({
    language = "en",
    shellState = getDashboardState(),
  }: {
    language?: I18nLanguage;
    shellState?: DashboardState;
  } = {}): () => void {
    const activePage = activeDashboardPageDefinition(
      pageDefinitions,
      shellState,
    );
    if (activePage) {
      pageRegistry.ensure(activePage);
    }
    return applyDashboardDocumentState(shellState.currentTheme, language);
  }

  function documentKeydownHandler(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeSidebarAction();
  }

  return {
    applyShellState,
    bodyDisplayStateStore,
    closeSidebarAction,
    documentKeydownHandler,
    openRecordDrawerAction: openDashboardRecordDrawer,
    openSidebar,
    openSidebarAction: openSidebar,
    pageOutletRowsStateStore,
    recordToolsDisplayStateStore,
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
    [dashboardShellResources.sidebarConnectionState, currentLanguageState],
    ([$sidebarConnectionState, _currentLanguageState]) =>
      dashboardShellResources.sidebarConnectionPresentation(
        $sidebarConnectionState,
      ),
  );
  const navigationItemsStateStore = derived(
    [dashboardState, currentLanguageState],
    ([$dashboardState, _currentLanguageState]) =>
      dashboardSidebarNavigationPresentation($dashboardState),
  );

  function navigateRoute(routeId = ""): void {
    navigateDashboardRoute(routeId);
  }

  function openConnectionEditor(): void {
    dashboardShellResources.openConnectionEditor();
  }

  return {
    navigationItemsStateStore,
    navigateRoute,
    openConnectionEditor,
    sidebarConnectionDisplayStateStore,
    sidebarDisplayStateStore,
  };
}

function navigateDashboardRoute(routeId = ""): void {
  const route = routeById(routeId);
  if (!route) return;

  if (dashboardRuntime.currentPathname() !== route.path) {
    dashboardRuntime.pushBrowserState({ routeId: route.id }, route.path);
  }

  dashboardState.update((currentDashboard) => ({
    ...currentDashboard,
    currentTab: route.tab || currentDashboard.currentTab,
    currentTxStage: route.txStage || currentDashboard.currentTxStage,
  }));
}
