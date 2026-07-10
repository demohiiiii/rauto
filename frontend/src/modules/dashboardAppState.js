import { derived, get, writable } from "svelte/store";
import { getAgentApiToken, setAgentApiToken } from "../api/client.js";
import {
  refreshConnectionProfileOptions,
  refreshSidebarConnectionSelector,
} from "./connections.js";
import { showToast } from "./overlays.js";
import { storageSet, subscribeColorSchemeChange } from "../lib/browser.js";
import {
  applyThemeSettings,
  defaultThemeSettings,
  loadThemeSettings,
  resolveThemeMode,
  themeModeOptions,
  themePresetOptions,
  themeRadiusOptions,
  updateThemeSettings,
} from "./themeSystem.js";
import { statusPresentation } from "../lib/ui.js";
import { callIfFunction, submitOnKeyHandler } from "../lib/events.js";
import { currentLanguageState, loadI18nLanguage, t, tr } from "../lib/i18n.js";

const DEFAULT_TAB = "standard";

const dashboardStateDefaults = {
  currentTab: DEFAULT_TAB,
  currentTheme: "light",
  currentThemePreference: "system",
  currentThemeSettings: { ...defaultThemeSettings },
  currentTxStage: "block",
  managedAgentMode: false,
  tasksVisible: false,
};

export const dashboardState = writable({ ...dashboardStateDefaults });
export const protectedDashboardResourcesRefreshState = writable(0);

const agentAuthStatusState = writable({
  message: "",
  tone: "info",
});

let systemThemeCleanup = null;

export const getDashboardState = () => get(dashboardState);

function normalizeDashboardThemePreference(themePreference) {
  return ["system", "light", "dark"].includes(themePreference)
    ? themePreference
    : "system";
}

function nextDashboardThemePreference(themePreference) {
  const preference = normalizeDashboardThemePreference(themePreference);
  if (preference === "system") return "light";
  if (preference === "light") return "dark";
  return "system";
}

function dashboardLanguageShortLabel(language) {
  return language === "zh" ? "中文" : "EN";
}

export function initializeDashboardStatePreferences() {
  const currentThemeSettings = loadThemeSettings();
  const currentTheme = resolveThemeMode(currentThemeSettings.mode);
  applyThemeSettings(currentThemeSettings);
  dashboardState.update((currentDashboard) => ({
    ...currentDashboard,
    currentTheme,
    currentThemePreference: currentThemeSettings.mode,
    currentThemeSettings,
  }));
}

function normalizeTab(tab, tasksVisible) {
  const normalized = String(tab || DEFAULT_TAB).trim() || DEFAULT_TAB;
  if (normalized === "tasks" && !tasksVisible) return DEFAULT_TAB;
  return normalized;
}

export function setDashboardTab(tab) {
  dashboardState.update((currentDashboard) => {
    const currentTab = normalizeTab(tab, currentDashboard.tasksVisible);
    return {
      ...currentDashboard,
      currentTab,
    };
  });
}

export function setDashboardManagedAgentMode(managed) {
  dashboardState.update((currentDashboard) => {
    const tasksVisible = managed === true;
    const currentTab = normalizeTab(currentDashboard.currentTab, tasksVisible);
    return {
      ...currentDashboard,
      currentTab,
      managedAgentMode: tasksVisible,
      tasksVisible,
    };
  });
}

export function setDashboardTxStage(stage) {
  const currentTxStage = String(stage || "block").trim() || "block";
  dashboardState.update((currentDashboard) => ({
    ...currentDashboard,
    currentTxStage,
  }));
}

async function changeDashboardLanguage(language) {
  await loadI18nLanguage(language);
  storageSet("rauto_lang", language);
  applyDashboardI18n();
}

function onDashboardThemeSettingsChange(patch = {}) {
  const shellState = getDashboardState();
  const currentThemeSettings =
    shellState.currentThemeSettings ||
    dashboardStateDefaults.currentThemeSettings;
  const nextSettings = updateThemeSettings(currentThemeSettings, patch);
  const currentTheme = resolveThemeMode(nextSettings.mode);
  applyThemeSettings(nextSettings);
  dashboardState.update((currentDashboard) => ({
    ...currentDashboard,
    currentTheme,
    currentThemePreference: nextSettings.mode,
    currentThemeSettings: nextSettings,
  }));
}

function dashboardThemePreferenceLabelKey(dashboard = {}) {
  if (dashboard.currentThemePreference === "system") {
    return "themeSystem";
  }
  return dashboard.currentTheme === "dark" ? "themeDark" : "themeLight";
}

function titleCaseThemeValue(value = "") {
  const text = String(value || "");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

function themeOptionLabel(kind, value) {
  return tr(`theme${kind}${titleCaseThemeValue(value)}`, value);
}

function themeOptionRows(kind, options, currentValue) {
  return options.map((value) => ({
    active: value === currentValue,
    label: themeOptionLabel(kind, value),
    value,
  }));
}

function dashboardPreferenceToolsPresentation({
  language,
  shellState = {},
} = {}) {
  const themeSettings =
    shellState.currentThemeSettings ||
    dashboardStateDefaults.currentThemeSettings;
  return {
    closeLabel: tr("close", "Close"),
    languageMenuLabel: tr("langMenuLabel"),
    languageOptionChineseLabel: tr("langOptionChinese"),
    languageOptionEnglishLabel: tr("langOptionEnglish"),
    languageShortLabel: dashboardLanguageShortLabel(language),
    themeModeLabel: tr("themeModeLabel", "Mode"),
    themeModeRows: themeOptionRows(
      "Mode",
      themeModeOptions,
      themeSettings.mode,
    ),
    themePresetLabel: tr("themePresetLabel", "Color"),
    themePresetRows: themeOptionRows(
      "Preset",
      themePresetOptions,
      themeSettings.preset,
    ),
    themePreferenceLabel: tr(dashboardThemePreferenceLabelKey(shellState)),
    themeRadiusLabel: tr("themeRadiusLabel", "Radius"),
    themeRadiusRows: themeOptionRows(
      "Radius",
      themeRadiusOptions,
      themeSettings.radius,
    ),
    themeSettings,
    themeToggleTitle: tr("themeToggleTitle"),
  };
}

function dashboardPreferenceLanguageActionHandlers({
  chooseLanguage,
  onCloseMenu = null,
} = {}) {
  return {
    chooseLanguageAction(language) {
      return async () => {
        await callIfFunction(chooseLanguage, language);
        callIfFunction(onCloseMenu);
      };
    },
  };
}

export function createDashboardPreferenceToolsWorkspace() {
  const preferenceDisplayStateStore = derived(
    [currentLanguageState, dashboardState],
    ([$currentLanguageState, $dashboardState]) =>
      dashboardPreferenceToolsPresentation({
        language: $currentLanguageState,
        shellState: $dashboardState,
      }),
  );
  const langMenuOpenStateStore = writable(false);

  function chooseLanguage(language) {
    return changeDashboardLanguage(language);
  }

  function toggleTheme() {
    return toggleDashboardThemePreference();
  }

  function chooseThemeMode(mode) {
    return () => onDashboardThemeSettingsChange({ mode });
  }

  function chooseThemePreset(preset) {
    return () => onDashboardThemeSettingsChange({ preset });
  }

  function chooseThemeRadius(radius) {
    return () => onDashboardThemeSettingsChange({ radius });
  }

  function closeLangMenu() {
    langMenuOpenStateStore.set(false);
  }

  function toggleLangMenu() {
    langMenuOpenStateStore.update((open) => !open);
  }

  return {
    chooseLanguageAction: dashboardPreferenceLanguageActionHandlers({
      chooseLanguage,
      onCloseMenu: closeLangMenu,
    }).chooseLanguageAction,
    chooseThemeMode,
    chooseThemePreset,
    chooseThemeRadius,
    closeLangMenu,
    documentKeydownHandler: submitOnKeyHandler("Escape", closeLangMenu),
    langMenuOpenStateStore,
    preferenceDisplayStateStore,
    themeModeOptions,
    themePresetOptions,
    themeRadiusOptions,
    toggleLangMenu,
    toggleTheme,
  };
}

function dashboardAgentAuthPanelPresentation({
  shellState = {},
  statusState = {},
} = {}) {
  const status = statusPresentation(
    statusState.message || "",
    statusState.tone || "info",
    { suppressPassiveLoaded: false },
  );
  const managedAgentMode = !!shellState.managedAgentMode;
  return {
    clearButtonLabel: tr("agentAuthClearBtn"),
    hidden: !managedAgentMode,
    hint: tr("agentAuthHint"),
    inputAriaLabel: tr("agentAuthPlaceholder"),
    inputPlaceholder: tr("agentAuthPlaceholder"),
    managedAgentMode,
    saveButtonLabel: tr("agentAuthSaveBtn"),
    showStatus: !!status.text,
    statusMessage: status.text,
    statusTone: status.tone,
    title: tr("agentAuthTitle"),
  };
}

function getStoredAgentApiToken() {
  return getAgentApiToken();
}

function setStoredAgentApiToken(token) {
  setAgentApiToken(token);
}

function setAgentAuthStatus(message = "-", tone = "info") {
  const presentation = statusPresentation(message, tone);
  agentAuthStatusState.set({
    message: presentation.inlineMessage,
    tone: presentation.tone,
  });
  if (presentation.shouldToast) {
    showToast(presentation.text, presentation.tone);
  }
}

function readStoredDashboardAgentToken() {
  return getStoredAgentApiToken();
}

export function refreshAgentAuthStatus() {
  const managedAgentMode = !!getDashboardState().managedAgentMode;
  if (!managedAgentMode) {
    return;
  }
  const token = getStoredAgentApiToken();
  setAgentAuthStatus(
    token ? t("agentAuthSaved") : t("agentAuthRequired"),
    token ? "success" : "info",
  );
}

function clearAgentToken() {
  setStoredAgentApiToken("");
  refreshAgentAuthStatus();
  setAgentAuthStatus(t("agentAuthCleared"), "info");
}

async function saveAgentToken(token = "", onRefreshProtectedResources = null) {
  setStoredAgentApiToken(token);
  refreshAgentAuthStatus();
  if (!getStoredAgentApiToken()) {
    setAgentAuthStatus(t("agentAuthRequired"), "info");
    return;
  }
  await callIfFunction(onRefreshProtectedResources);
}

export function createDashboardAgentAuthPanelWorkspace({
  onRefreshProtectedResources = null,
} = {}) {
  const agentTokenStateStore = writable("");
  const agentAuthDisplayStateStore = derived(
    [dashboardState, agentAuthStatusState, currentLanguageState],
    ([$dashboardState, $agentAuthStatusState, _currentLanguageState]) =>
      dashboardAgentAuthPanelPresentation({
        shellState: $dashboardState,
        statusState: $agentAuthStatusState,
      }),
  );
  let previousManagedAgentMode = false;

  function setPanelContext({ managedAgentMode = false } = {}) {
    const nextManagedAgentMode = !!managedAgentMode;
    if (nextManagedAgentMode && !previousManagedAgentMode) {
      agentTokenStateStore.set(readStoredDashboardAgentToken());
    }
    if (!nextManagedAgentMode && previousManagedAgentMode) {
      agentTokenStateStore.set("");
    }
    previousManagedAgentMode = nextManagedAgentMode;
  }

  function setAgentToken(token = "") {
    agentTokenStateStore.set(String(token || ""));
  }

  function clearAgentTokenState() {
    agentTokenStateStore.set("");
    return clearAgentToken();
  }

  function saveAgentTokenState() {
    return saveAgentToken(
      get(agentTokenStateStore) || "",
      onRefreshProtectedResources,
    );
  }

  function destroy() {
    agentTokenStateStore.set("");
    previousManagedAgentMode = false;
  }

  const workspace = {
    agentAuthDisplayStateStore,
    agentTokenStateStore,
    clearAgentTokenState,
    destroy,
    saveAgentTokenState,
    setAgentToken,
    setPanelContext,
  };

  return {
    ...workspace,
    agentTokenKeydownHandler: submitOnKeyHandler("Enter", () =>
      workspace.saveAgentTokenState(),
    ),
  };
}

function toggleDashboardThemePreference() {
  const shellState = getDashboardState();
  const currentMode =
    shellState.currentThemeSettings?.mode ||
    shellState.currentThemePreference ||
    "system";
  const nextPreference = nextDashboardThemePreference(currentMode);
  onDashboardThemeSettingsChange({ mode: nextPreference });
}

export function bindSystemThemeListener() {
  destroySystemThemeListener();
  const applySystemThemePreferenceUpdate = () => {
    if (getDashboardState().currentThemePreference === "system") {
      onDashboardThemeSettingsChange({ mode: "system" });
    }
  };
  systemThemeCleanup = subscribeColorSchemeChange(
    applySystemThemePreferenceUpdate,
  );
}

export function destroySystemThemeListener() {
  if (typeof systemThemeCleanup === "function") systemThemeCleanup();
  systemThemeCleanup = null;
}

export function applyDashboardI18n() {
  refreshConnectionProfileOptions();
  refreshSidebarConnectionSelector();
  refreshAgentAuthStatus();
}

export function markProtectedDashboardResourcesRefreshCompleted() {
  protectedDashboardResourcesRefreshState.update((version) => version + 1);
}
