import type {
  DashboardComponentDefinitions,
  DashboardDetailRendererId,
  DashboardNavigationItem,
  DashboardOverlayId,
  DashboardPageDefinition,
  DashboardRoute,
} from "./types.js";

interface NavigationDefinition {
  group: string;
  id: string;
  label: string;
  labelKey: string;
  navLabelKey?: string;
  path: string;
  tab: string;
  txStage?: string;
}

const navigationDefinitions: NavigationDefinition[] = [
  {
    id: "show",
    path: "/app/show",
    tab: "show",
    labelKey: "opExecShow",
    label: "Show",
    group: "operations",
  },
  {
    id: "config-fetch",
    path: "/app/config-fetch",
    tab: "config-fetch",
    labelKey: "opConfigFetch",
    label: "Config Fetch",
    group: "operations",
  },
  {
    id: "standard",
    path: "/app/standard",
    tab: "standard",
    labelKey: "opSectionStandard",
    navLabelKey: "navStandard",
    label: "Standard Delivery",
    group: "operations",
  },
  {
    id: "batch",
    path: "/app/batch",
    tab: "batch",
    labelKey: "opSectionBatch",
    navLabelKey: "navBatch",
    label: "Batch Delivery",
    group: "operations",
  },
  {
    id: "tx-block",
    path: "/app/tx-block",
    tab: "orchestrated",
    txStage: "block",
    labelKey: "txStageBlock",
    label: "Tx Block",
    group: "operations",
  },
  {
    id: "tx-workflow",
    path: "/app/tx-workflow",
    tab: "orchestrated",
    txStage: "workflow",
    labelKey: "txStageWorkflow",
    label: "Tx Workflow",
    group: "operations",
  },
  {
    id: "orchestrate",
    path: "/app/orchestrate",
    tab: "orchestrated",
    txStage: "orchestrate",
    labelKey: "txStageOrchestrate",
    label: "Orchestrate",
    group: "operations",
  },
  {
    id: "replay",
    path: "/app/replay",
    tab: "replay",
    labelKey: "tabReplay",
    navLabelKey: "navReplay",
    label: "Session Replay",
    group: "operations",
  },
  {
    id: "device-discovery",
    path: "/app/device-discovery",
    tab: "device-discovery",
    labelKey: "deviceDiscoveryTitle",
    navLabelKey: "navDiscovery",
    label: "Auto Discovery",
    group: "operations",
  },
  {
    id: "schedules",
    path: "/app/schedules",
    tab: "schedules",
    labelKey: "tabSchedules",
    label: "Schedules",
    group: "operations",
  },
  {
    id: "transfer",
    path: "/app/transfer",
    tab: "transfer",
    labelKey: "tabTransfer",
    label: "SFTP Upload",
    group: "operations",
  },
  {
    id: "prompts",
    path: "/app/prompts",
    tab: "prompts",
    labelKey: "tabPrompts",
    navLabelKey: "navProfiles",
    label: "Profile Management",
    group: "management",
  },
  {
    id: "templates",
    path: "/app/templates",
    tab: "templates",
    labelKey: "tabTemplates",
    label: "Templates",
    group: "management",
  },
  {
    id: "inventory",
    path: "/app/inventory",
    tab: "inventory",
    labelKey: "tabInventory",
    navLabelKey: "navDevices",
    label: "Inventory",
    group: "management",
  },
  {
    id: "credentials",
    path: "/app/credentials",
    tab: "credentials",
    labelKey: "tabCredentials",
    label: "Credentials",
    group: "management",
  },
  {
    id: "blacklist",
    path: "/app/blacklist",
    tab: "blacklist",
    labelKey: "tabBlacklist",
    navLabelKey: "navBlacklist",
    label: "Blacklist",
    group: "management",
  },
  {
    id: "backup",
    path: "/app/backup",
    tab: "backup",
    labelKey: "tabBackup",
    label: "Backup",
    group: "management",
  },
  {
    id: "tasks",
    path: "/app/tasks",
    tab: "tasks",
    labelKey: "tabTasks",
    label: "Tasks",
    group: "management",
  },
  {
    id: "config-history",
    path: "/app/config-history",
    tab: "config-history",
    labelKey: "tabConfigHistory",
    navLabelKey: "navConfigHistory",
    label: "Configuration History",
    group: "management",
  },
];

export const dashboardRoutes: DashboardRoute[] = navigationDefinitions.map(
  (navigationDefinition) => ({
    id: navigationDefinition.id,
    path: navigationDefinition.path,
    tab: navigationDefinition.tab,
    txStage: navigationDefinition.txStage,
  }),
);

export const dashboardNavigationItems: DashboardNavigationItem[] =
  navigationDefinitions.map((navigationDefinition) => ({
    routeId: navigationDefinition.id,
    label: navigationDefinition.label,
    labelKey: navigationDefinition.labelKey,
    navLabelKey: navigationDefinition.navLabelKey,
    activeWhen: navigationDefinition.tab,
    txStage: navigationDefinition.txStage,
    group: navigationDefinition.group,
  }));

export const dashboardPageDefinitions: DashboardPageDefinition[] = [
  { id: "show", load: () => import("../../../pages/ShowPage.svelte") },
  {
    id: "config-fetch",
    load: () => import("../../../pages/ConfigFetchPage.svelte"),
  },
  { id: "standard", load: () => import("../../../pages/StandardPage.svelte") },
  { id: "batch", load: () => import("../../../pages/BatchPage.svelte") },
  {
    id: "orchestrated",
    load: () => import("../../../pages/OrchestratedPage.svelte"),
  },
  { id: "replay", load: () => import("../../../pages/ReplayPage.svelte") },
  { id: "prompts", load: () => import("../../../pages/PromptsPage.svelte") },
  {
    id: "templates",
    load: () => import("../../../pages/TemplatesPage.svelte"),
  },
  {
    id: "inventory",
    load: () => import("../../../pages/InventoryPage.svelte"),
  },
  {
    id: "device-discovery",
    load: () => import("../../../pages/DeviceDiscoveryPage.svelte"),
  },
  {
    id: "credentials",
    load: () => import("../../../pages/CredentialsPage.svelte"),
  },
  { id: "transfer", load: () => import("../../../pages/TransferPage.svelte") },
  {
    id: "blacklist",
    load: () => import("../../../pages/BlacklistPage.svelte"),
  },
  { id: "backup", load: () => import("../../../pages/BackupPage.svelte") },
  { id: "tasks", load: () => import("../../../pages/TasksPage.svelte") },
  {
    id: "schedules",
    load: () => import("../../../pages/SchedulesPage.svelte"),
  },
  {
    id: "config-history",
    load: () => import("../../../pages/ConfigHistoryPage.svelte"),
  },
];

export const dashboardOverlayDefinitions: DashboardComponentDefinitions<DashboardOverlayId> =
  {
    connectionModal: () =>
      import("../../../components/connections/ConnectionModal.svelte"),
    detailModal: () =>
      import("../../../components/overlays/DetailModal.svelte"),
    entryDrawer: () =>
      import("../../../components/overlays/EntryDrawer.svelte"),
    recordDrawer: () =>
      import("../../../components/overlays/RecordDrawer.svelte"),
    savedConnectionEditModal: () =>
      import("../../../components/connections/SavedConnectionEditModal.svelte"),
  };

export const dashboardDetailRendererDefinitions: DashboardComponentDefinitions<DashboardDetailRendererId> =
  {
    orchestrationStageDetail: () =>
      import("../../../pages/orchestrated/OrchestrationStageDetailPanel.svelte"),
    orchestrationTargetDetail: () =>
      import("../../../pages/orchestrated/OrchestrationTargetDetailPanel.svelte"),
  };

export const defaultDashboardRoute = dashboardRoutes[0];

export function routeByPath(pathname: unknown): DashboardRoute {
  return (
    dashboardRoutes.find((route) => route.path === pathname) ||
    defaultDashboardRoute
  );
}

export function routeById(id: unknown): DashboardRoute | null {
  return dashboardRoutes.find((route) => route.id === id) || null;
}
