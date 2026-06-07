const navigationDefinitions = [
  {
    id: "show",
    path: "/app/show",
    navButtonId: "tab-show",
    tab: "show",
    labelKey: "opExecShow",
    label: "查询",
  },
  {
    id: "standard",
    path: "/app/standard",
    navButtonId: "tab-standard",
    tab: "standard",
    labelKey: "opSectionStandard",
    label: "Standard Delivery",
  },
  {
    id: "tx-block",
    path: "/app/tx-block",
    navButtonId: "tab-tx-block",
    tab: "orchestrated",
    txStage: "block",
    labelKey: "txStageBlock",
    label: "Tx Block",
  },
  {
    id: "tx-workflow",
    path: "/app/tx-workflow",
    navButtonId: "tab-tx-workflow",
    tab: "orchestrated",
    txStage: "workflow",
    labelKey: "txStageWorkflow",
    label: "Tx Workflow",
  },
  {
    id: "orchestrate",
    path: "/app/orchestrate",
    navButtonId: "tab-orchestrate",
    tab: "orchestrated",
    txStage: "orchestrate",
    labelKey: "txStageOrchestrate",
    label: "Orchestrate",
  },
  {
    id: "replay",
    path: "/app/replay",
    navButtonId: "tab-replay",
    tab: "replay",
    labelKey: "tabReplay",
    label: "Session Replay",
  },
  {
    id: "prompts",
    path: "/app/prompts",
    navButtonId: "tab-prompts",
    tab: "prompts",
    labelKey: "tabPrompts",
    label: "Prompt Profiles",
  },
  {
    id: "templates",
    path: "/app/templates",
    navButtonId: "tab-templates",
    tab: "templates",
    labelKey: "tabTemplates",
    label: "Templates",
  },
  {
    id: "inventory",
    path: "/app/inventory",
    navButtonId: "tab-inventory",
    tab: "inventory",
    labelKey: "tabInventory",
    label: "Inventory",
  },
  {
    id: "transfer",
    path: "/app/transfer",
    navButtonId: "tab-transfer",
    tab: "transfer",
    labelKey: "tabTransfer",
    label: "SFTP Upload",
  },
  {
    id: "blacklist",
    path: "/app/blacklist",
    navButtonId: "tab-blacklist",
    tab: "blacklist",
    labelKey: "tabBlacklist",
    label: "Blacklist",
  },
  {
    id: "backup",
    path: "/app/backup",
    navButtonId: "tab-backup",
    tab: "backup",
    labelKey: "tabBackup",
    label: "Backup",
  },
  {
    id: "tasks",
    path: "/app/tasks",
    navButtonId: "tab-tasks",
    tab: "tasks",
    labelKey: "tabTasks",
    label: "Tasks",
  },
];

export const dashboardRoutes = navigationDefinitions.map((item) => ({
  id: item.id,
  path: item.path,
  navButtonId: item.navButtonId,
  tab: item.tab,
  txStage: item.txStage,
}));

export const dashboardNavigationItems = navigationDefinitions.map((item) => ({
  id: item.navButtonId,
  routeId: item.id,
  label: item.label,
  labelKey: item.labelKey,
  dataTab: item.txStage ? undefined : item.tab,
  activeWhen: item.tab,
  txStage: item.txStage,
}));

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
