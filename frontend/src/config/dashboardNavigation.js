const navigationDefinitions = [
  {
    id: "show",
    path: "/app/show",
    tab: "show",
    labelKey: "opExecShow",
    label: "Show",
    group: "operations",
  },
  {
    id: "standard",
    path: "/app/standard",
    tab: "standard",
    labelKey: "opSectionStandard",
    label: "Standard Delivery",
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
    label: "Session Replay",
    group: "operations",
  },
  {
    id: "prompts",
    path: "/app/prompts",
    tab: "prompts",
    labelKey: "tabPrompts",
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
    label: "Inventory",
    group: "management",
  },
  {
    id: "transfer",
    path: "/app/transfer",
    tab: "transfer",
    labelKey: "tabTransfer",
    label: "SFTP Upload",
    group: "management",
  },
  {
    id: "blacklist",
    path: "/app/blacklist",
    tab: "blacklist",
    labelKey: "tabBlacklist",
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
];

export const dashboardRoutes = navigationDefinitions.map(
  (navigationDefinition) => ({
    id: navigationDefinition.id,
    path: navigationDefinition.path,
    tab: navigationDefinition.tab,
    txStage: navigationDefinition.txStage,
  }),
);

export const dashboardNavigationItems = navigationDefinitions.map(
  (navigationDefinition) => ({
    routeId: navigationDefinition.id,
    label: navigationDefinition.label,
    labelKey: navigationDefinition.labelKey,
    activeWhen: navigationDefinition.tab,
    txStage: navigationDefinition.txStage,
    group: navigationDefinition.group,
  }),
);

export const dashboardPageDefinitions = [
  { id: "show", load: () => import("../pages/ShowPage.svelte") },
  { id: "standard", load: () => import("../pages/StandardPage.svelte") },
  {
    id: "orchestrated",
    load: () => import("../pages/OrchestratedPage.svelte"),
  },
  { id: "replay", load: () => import("../pages/ReplayPage.svelte") },
  { id: "prompts", load: () => import("../pages/PromptsPage.svelte") },
  { id: "templates", load: () => import("../pages/TemplatesPage.svelte") },
  { id: "inventory", load: () => import("../pages/InventoryPage.svelte") },
  { id: "transfer", load: () => import("../pages/TransferPage.svelte") },
  { id: "blacklist", load: () => import("../pages/BlacklistPage.svelte") },
  { id: "backup", load: () => import("../pages/BackupPage.svelte") },
  { id: "tasks", load: () => import("../pages/TasksPage.svelte") },
];

export const dashboardOverlayDefinitions = {
  connectionModal: () =>
    import("../components/connections/ConnectionModal.svelte"),
  detailModal: () => import("../components/overlays/DetailModal.svelte"),
  entryDrawer: () => import("../components/overlays/EntryDrawer.svelte"),
  historyDrawer: () => import("../components/overlays/HistoryDrawer.svelte"),
  recordDrawer: () => import("../components/overlays/RecordDrawer.svelte"),
  savedConnectionEditModal: () =>
    import("../components/connections/SavedConnectionEditModal.svelte"),
};

export const dashboardDetailRendererDefinitions = {
  orchestrationStageDetail: () =>
    import("../pages/orchestrated/OrchestrationStageDetailPanel.svelte"),
  orchestrationTargetDetail: () =>
    import("../pages/orchestrated/OrchestrationTargetDetailPanel.svelte"),
};

export const defaultDashboardRoute = dashboardRoutes[0];

export function routeByPath(pathname) {
  return (
    dashboardRoutes.find((route) => route.path === pathname) ||
    defaultDashboardRoute
  );
}

export function routeById(id) {
  return dashboardRoutes.find((route) => route.id === id) || null;
}
