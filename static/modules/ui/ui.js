/**
 * ui/ui.js - lightweight tab/layout state sync
 */

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
  const tasksVisible = managedAgentMode === true;
  if (!tasksVisible && currentTab === "tasks") {
    currentTab = "standard";
  }
  for (const tab of tabs) {
    const button = byId(`tab-${tab}`);
    const panel = byId(`panel-${tab}`);
    const navItem = button ? button.closest("li") : null;
    const visible = tab !== "tasks" || tasksVisible;
    const active = visible && tab === currentTab;

    if (navItem) {
      navItem.hidden = !visible;
    } else if (button) {
      button.hidden = !visible;
    }

    if (button) {
      if (active) {
        button.classList.add("menu-active");
        button.setAttribute("aria-selected", "true");
      } else {
        button.classList.remove("menu-active");
        button.setAttribute("aria-selected", "false");
      }
    }
    if (panel) {
      if (active) {
        panel.hidden = false;
        panel.style.display = "";
      } else {
        panel.hidden = true;
        panel.style.display = "none";
      }
    }
  }

  try {
    if (window.Alpine && typeof window.Alpine.store === "function") {
      const appStore = window.Alpine.store("app");
      if (appStore) {
        if (typeof appStore.syncFromGlobals === "function") {
          appStore.syncFromGlobals();
        } else if (appStore.currentTab !== currentTab) {
          appStore.currentTab = currentTab;
        }
      }
    }
  } catch (_) {
    // Alpine store is optional during the migration period.
  }
}
