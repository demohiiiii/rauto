export const dashboardRoutes = [
  {
    id: "standard",
    path: "/app/standard",
    navButtonId: "tab-standard",
    tab: "standard",
  },
  {
    id: "tx-block",
    path: "/app/tx-block",
    navButtonId: "tab-tx-block",
    tab: "orchestrated",
    txStage: "block",
  },
  {
    id: "tx-workflow",
    path: "/app/tx-workflow",
    navButtonId: "tab-tx-workflow",
    tab: "orchestrated",
    txStage: "workflow",
  },
  {
    id: "orchestrate",
    path: "/app/orchestrate",
    navButtonId: "tab-orchestrate",
    tab: "orchestrated",
    txStage: "orchestrate",
  },
  {
    id: "replay",
    path: "/app/replay",
    navButtonId: "tab-replay",
    tab: "replay",
  },
  {
    id: "prompts",
    path: "/app/prompts",
    navButtonId: "tab-prompts",
    tab: "prompts",
  },
  {
    id: "templates",
    path: "/app/templates",
    navButtonId: "tab-templates",
    tab: "templates",
  },
  {
    id: "inventory",
    path: "/app/inventory",
    navButtonId: "tab-inventory",
    tab: "inventory",
  },
  {
    id: "transfer",
    path: "/app/transfer",
    navButtonId: "tab-transfer",
    tab: "transfer",
  },
  {
    id: "blacklist",
    path: "/app/blacklist",
    navButtonId: "tab-blacklist",
    tab: "blacklist",
  },
  {
    id: "backup",
    path: "/app/backup",
    navButtonId: "tab-backup",
    tab: "backup",
  },
  {
    id: "tasks",
    path: "/app/tasks",
    navButtonId: "tab-tasks",
    tab: "tasks",
  },
];

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
