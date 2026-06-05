import { writable } from "svelte/store";

const DEFAULT_TAB = "standard";

function normalizeTab(tab, tasksVisible) {
  const normalized = String(tab || DEFAULT_TAB).trim() || DEFAULT_TAB;
  if (normalized === "tasks" && !tasksVisible) {
    return DEFAULT_TAB;
  }
  return normalized;
}

export const dashboardView = writable({
  currentTab: DEFAULT_TAB,
  connectionModalMode: "saved",
  connectionModalOpen: false,
  currentExecMode: "direct",
  currentInventorySection: "groups",
  currentLang: "zh",
  currentPromptMode: "view",
  currentTheme: "dark",
  currentThemePreference: "system",
  currentTemplateSection: "templates",
  currentTxStage: "block",
  langMenuOpen: false,
  tasksVisible: false,
});

export function setDashboardTab(tab) {
  dashboardView.update((view) => {
    const currentTab = normalizeTab(tab, view.tasksVisible);
    if (typeof window !== "undefined") {
      window.currentTab = currentTab;
    }
    return {
      ...view,
      currentTab,
    };
  });
}

export function setDashboardManagedAgentMode(managed) {
  dashboardView.update((view) => {
    const tasksVisible = managed === true;
    const currentTab = normalizeTab(view.currentTab, tasksVisible);
    if (typeof window !== "undefined") {
      window.currentTab = currentTab;
    }
    return {
      ...view,
      currentTab,
      tasksVisible,
    };
  });
}

export function setDashboardTxStage(stage) {
  const currentTxStage = String(stage || "block").trim() || "block";
  dashboardView.update((view) => ({
    ...view,
    currentTxStage,
  }));
}

export function setDashboardExecMode(mode) {
  const currentExecMode = ["direct", "template", "flow"].includes(mode)
    ? mode
    : "direct";
  dashboardView.update((view) => ({
    ...view,
    currentExecMode,
  }));
  if (typeof window !== "undefined") {
    window.currentExecMode = currentExecMode;
  }
}

export function setDashboardPromptMode(mode) {
  const currentPromptMode = ["view", "edit", "diagnose"].includes(mode)
    ? mode
    : "view";
  dashboardView.update((view) => ({
    ...view,
    currentPromptMode,
  }));
  if (typeof window !== "undefined") {
    window.currentPromptMode = currentPromptMode;
  }
}

export function setDashboardTemplateSection(section) {
  const currentTemplateSection = [
    "templates",
    "flows",
    "textfsm",
    "show-objects",
  ].includes(section)
    ? section
    : "templates";
  dashboardView.update((view) => ({
    ...view,
    currentTemplateSection,
  }));
  if (typeof window !== "undefined") {
    window.currentTemplateSection = currentTemplateSection;
  }
}

export function setDashboardInventorySection(section) {
  const currentInventorySection = ["groups", "labels"].includes(section)
    ? section
    : "groups";
  dashboardView.update((view) => ({
    ...view,
    currentInventorySection,
  }));
  if (typeof window !== "undefined") {
    window.currentInventorySection = currentInventorySection;
  }
}

export function setDashboardLanguage(lang) {
  const currentLang = lang === "en" ? "en" : "zh";
  dashboardView.update((view) => ({
    ...view,
    currentLang,
    langMenuOpen: false,
  }));
  if (typeof window !== "undefined") {
    window.currentLang = currentLang;
  }
}

export function setDashboardTheme(theme, preference = "system") {
  const currentTheme = theme === "light" ? "light" : "dark";
  const currentThemePreference = ["system", "light", "dark"].includes(
    preference,
  )
    ? preference
    : "system";
  dashboardView.update((view) => ({
    ...view,
    currentTheme,
    currentThemePreference,
  }));
  if (typeof window !== "undefined") {
    window.currentTheme = currentTheme;
    window.currentThemePreference = currentThemePreference;
  }
}

export function setDashboardLangMenuOpen(open) {
  dashboardView.update((view) => ({
    ...view,
    langMenuOpen: !!open,
  }));
}

export function openDashboardConnectionModal(mode = "saved") {
  const connectionModalMode = mode === "temporary" ? "temporary" : "saved";
  dashboardView.update((view) => ({
    ...view,
    connectionModalMode,
    connectionModalOpen: true,
  }));
  if (typeof window !== "undefined") {
    window.connectionModalMode = connectionModalMode;
    window.connectionModalOpen = true;
  }
}

export function closeDashboardConnectionModal() {
  dashboardView.update((view) => ({
    ...view,
    connectionModalOpen: false,
  }));
  if (typeof window !== "undefined") {
    window.connectionModalOpen = false;
  }
}

export function setDashboardConnectionModalMode(mode) {
  const connectionModalMode = mode === "temporary" ? "temporary" : "saved";
  dashboardView.update((view) => ({
    ...view,
    connectionModalMode,
  }));
  if (typeof window !== "undefined") {
    window.connectionModalMode = connectionModalMode;
  }
}

export function isDashboardTabActive(view, tab) {
  return view.currentTab === tab && (tab !== "tasks" || view.tasksVisible);
}
