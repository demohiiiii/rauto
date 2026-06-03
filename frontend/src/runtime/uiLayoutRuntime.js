import {
  byId,
  runtimeValue,
  setRuntimeValue,
} from "../services/runtimeGlobals.js";
import {
  setDashboardManagedAgentMode,
  setDashboardTab,
} from "../state/dashboardView.js";

function applyTabs() {
  const tabs = [
    "standard",
    "orchestrated",
    "replay",
    "prompts",
    "templates",
    "inventory",
    "transfer",
    "blacklist",
    "backup",
    "tasks",
  ];
  const tasksVisible = runtimeValue("managedAgentMode") === true;
  let currentTab = runtimeValue("currentTab") || "standard";
  if (!tasksVisible && currentTab === "tasks") {
    currentTab = "standard";
    setRuntimeValue("currentTab", currentTab);
  }
  setDashboardManagedAgentMode(tasksVisible);
  setDashboardTab(currentTab);
  for (const tab of tabs) {
    const button = byId(`tab-${tab}`);
    const navItem = button ? button.closest("li") : null;
    const visible = tab !== "tasks" || tasksVisible;
    const active = visible && tab === currentTab;

    if (navItem) {
      navItem.hidden = !visible;
    } else if (button) {
      button.hidden = !visible;
    }

    if (button) {
      button.setAttribute("aria-selected", active ? "true" : "false");
    }
  }
}

export function installUiLayoutRuntime() {
  window.applyTabs = applyTabs;
}
