import { derived, get, writable } from "svelte/store";
import { dashboardApi } from "../infrastructure/dashboardApi.js";
import { dashboardResources } from "../infrastructure/dashboardResources.js";
import { dashboardRuntime } from "../infrastructure/dashboardRuntime.js";
import {
  applyThemeSettings,
  defaultThemeSettings,
  loadThemeSettings,
  resolveThemeMode,
  themeModeOptions,
  updateThemeSettings,
} from "../model/theme.js";
import { callIfFunction, submitOnKeyHandler } from "../../../lib/events.js";
import {
  currentLanguageState,
  loadI18nLanguage,
  t,
  tr,
} from "../../../lib/i18n.js";
import { statusPresentation } from "../../../lib/ui.js";
import type {
  DashboardAgentAuthDisplay,
  DashboardPreferenceDisplay,
  DashboardState,
  DashboardStatusState,
  DashboardThemeMode,
  DashboardThemeSettingsInput,
} from "../model/types.js";

const DEFAULT_TAB = "standard";

const dashboardStateDefaults: DashboardState = {
  currentTab: DEFAULT_TAB,
  currentTheme: "light",
  currentThemePreference: "system",
  currentThemeSettings: { ...defaultThemeSettings },
  currentTxStage: "block",
  managedAgentMode: false,
  tasksVisible: false,
};

export const dashboardState = writable<DashboardState>({
  ...dashboardStateDefaults,
});
export const protectedDashboardResourcesRefreshState = writable(0);

const agentAuthStatusState = writable<DashboardStatusState>({
  message: "",
  tone: "info",
});

let systemThemeCleanup: (() => void) | null = null;

export const getDashboardState = () => get(dashboardState);

function normalizeDashboardThemePreference(
  themePreference: unknown,
): DashboardThemeMode {
  return themeModeOptions.includes(themePreference as DashboardThemeMode)
    ? (themePreference as DashboardThemeMode)
    : "system";
}

function nextDashboardThemePreference(
  themePreference: unknown,
): DashboardThemeMode {
  const preference = normalizeDashboardThemePreference(themePreference);
  if (preference === "system") return "light";
  if (preference === "light") return "dark";
  return "system";
}

function dashboardLanguageShortLabel(language: unknown): string {
  return language === "zh" ? "中文" : "EN";
}

export function initializeDashboardStatePreferences() {
  const currentThemeSettings = loadThemeSettings();
  const currentTheme = resolveThemeMode(currentThemeSettings.mode);
  const appliedThemeSettings = applyThemeSettings(currentThemeSettings);
  dashboardState.update((currentDashboard) => ({
    ...currentDashboard,
    currentTheme,
    currentThemePreference: currentThemeSettings.mode,
    currentThemeSettings: appliedThemeSettings,
  }));
}

function normalizeTab(
  tab: unknown,
  tasksVisible: boolean,
  managedAgentMode = false,
): string {
  const normalized = String(tab || DEFAULT_TAB).trim() || DEFAULT_TAB;
  if (normalized === "tasks" && !tasksVisible) return DEFAULT_TAB;
  if (normalized === "schedules" && managedAgentMode) return DEFAULT_TAB;
  if (normalized === "config-history" && managedAgentMode) return DEFAULT_TAB;
  return normalized;
}

export function setDashboardTab(tab: unknown): void {
  dashboardState.update((currentDashboard) => {
    const currentTab = normalizeTab(
      tab,
      currentDashboard.tasksVisible,
      currentDashboard.managedAgentMode,
    );
    return {
      ...currentDashboard,
      currentTab,
    };
  });
}

export function setDashboardManagedAgentMode(managed: unknown): void {
  dashboardState.update((currentDashboard) => {
    const tasksVisible = managed === true;
    const currentTab = normalizeTab(
      currentDashboard.currentTab,
      tasksVisible,
      managed === true,
    );
    return {
      ...currentDashboard,
      currentTab,
      managedAgentMode: tasksVisible,
      tasksVisible,
    };
  });
}

export function setDashboardTxStage(stage: unknown): void {
  const currentTxStage = String(stage || "block").trim() || "block";
  dashboardState.update((currentDashboard) => ({
    ...currentDashboard,
    currentTxStage,
  }));
}

async function changeDashboardLanguage(language: string): Promise<void> {
  await loadI18nLanguage(language);
  dashboardRuntime.storageSet("rauto_lang", language);
  applyDashboardI18n();
}

function onDashboardThemeSettingsChange(
  patch: DashboardThemeSettingsInput = {},
): void {
  const shellState = getDashboardState();
  const currentThemeSettings =
    shellState.currentThemeSettings ||
    dashboardStateDefaults.currentThemeSettings;
  const nextSettings = updateThemeSettings(currentThemeSettings, patch);
  const currentTheme = resolveThemeMode(nextSettings.mode);
  const appliedThemeSettings = applyThemeSettings(nextSettings);
  dashboardState.update((currentDashboard) => ({
    ...currentDashboard,
    currentTheme,
    currentThemePreference: nextSettings.mode,
    currentThemeSettings: appliedThemeSettings,
  }));
}

function dashboardThemePreferenceLabelKey(
  dashboard: Pick<DashboardState, "currentTheme" | "currentThemePreference">,
): string {
  if (dashboard.currentThemePreference === "system") {
    return "themeSystem";
  }
  return dashboard.currentTheme === "dark" ? "themeDark" : "themeLight";
}

function titleCaseThemeValue(value: unknown = ""): string {
  const text = String(value || "");
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

function themeOptionLabel(kind: string, value: string): string {
  return tr(`theme${kind}${titleCaseThemeValue(value)}`, value);
}

function themeOptionRows(
  kind: string,
  options: readonly DashboardThemeMode[],
  currentValue: DashboardThemeMode,
) {
  return options.map((value) => ({
    active: value === currentValue,
    label: themeOptionLabel(kind, value),
    value,
  }));
}

function dashboardPreferenceToolsPresentation({
  language,
  shellState,
}: {
  language: unknown;
  shellState: DashboardState;
}): DashboardPreferenceDisplay {
  const themeSettings =
    shellState.currentThemeSettings ||
    dashboardStateDefaults.currentThemeSettings;
  return {
    closeLabel: tr("close", "Close"),
    languageMenuLabel: tr("langMenuLabel"),
    languageOptionChineseLabel: tr("langOptionChinese"),
    languageOptionEnglishLabel: tr("langOptionEnglish"),
    languageShortLabel: dashboardLanguageShortLabel(language),
    logoutLabel: tr("webLogout", "Log out"),
    showWebLogout: !shellState.managedAgentMode,
    themeModeLabel: tr("themeModeLabel", "Mode"),
    themeModeRows: themeOptionRows(
      "Mode",
      themeModeOptions,
      themeSettings.mode,
    ),
    themePreferenceLabel: tr(dashboardThemePreferenceLabelKey(shellState)),
    themeSettings,
    themeToggleTitle: tr("themeToggleTitle"),
  };
}

function dashboardPreferenceLanguageActionHandlers({
  chooseLanguage,
  onCloseMenu = null,
}: {
  chooseLanguage: (language: string) => unknown | Promise<unknown>;
  onCloseMenu?: (() => unknown) | null;
}) {
  return {
    chooseLanguageAction(language: string) {
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

  function chooseLanguage(language: string) {
    return changeDashboardLanguage(language);
  }

  function toggleTheme() {
    return toggleDashboardThemePreference();
  }

  function chooseThemeMode(mode: DashboardThemeMode) {
    return () => onDashboardThemeSettingsChange({ mode });
  }

  function closeLangMenu() {
    langMenuOpenStateStore.set(false);
  }

  function toggleLangMenu() {
    langMenuOpenStateStore.update((open) => !open);
  }

  async function logoutWebSession() {
    try {
      await dashboardApi.logoutWeb();
    } finally {
      dashboardRuntime.reloadBrowser();
    }
  }

  return {
    chooseLanguageAction: dashboardPreferenceLanguageActionHandlers({
      chooseLanguage,
      onCloseMenu: closeLangMenu,
    }).chooseLanguageAction,
    chooseThemeMode,
    closeLangMenu,
    documentKeydownHandler: submitOnKeyHandler("Escape", closeLangMenu),
    langMenuOpenStateStore,
    logoutWebSession,
    preferenceDisplayStateStore,
    themeModeOptions,
    toggleLangMenu,
    toggleTheme,
  };
}

function dashboardAgentAuthPanelPresentation({
  shellState,
  statusState,
}: {
  shellState: DashboardState;
  statusState: DashboardStatusState;
}): DashboardAgentAuthDisplay {
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
  return dashboardApi.getAgentApiToken();
}

function setStoredAgentApiToken(token: unknown): void {
  dashboardApi.setAgentApiToken(token);
}

function setAgentAuthStatus(message = "-", tone = "info"): void {
  const presentation = statusPresentation(message, tone);
  agentAuthStatusState.set({
    message: presentation.inlineMessage,
    tone: presentation.tone,
  });
  if (presentation.shouldToast) {
    dashboardResources.showToast(presentation.text, presentation.tone);
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

async function saveAgentToken(
  token = "",
  onRefreshProtectedResources: (() => unknown | Promise<unknown>) | null = null,
): Promise<void> {
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
}: {
  onRefreshProtectedResources?: (() => unknown | Promise<unknown>) | null;
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

  function setPanelContext({ managedAgentMode = false } = {}): void {
    const nextManagedAgentMode = !!managedAgentMode;
    if (nextManagedAgentMode && !previousManagedAgentMode) {
      agentTokenStateStore.set(readStoredDashboardAgentToken());
    }
    if (!nextManagedAgentMode && previousManagedAgentMode) {
      agentTokenStateStore.set("");
    }
    previousManagedAgentMode = nextManagedAgentMode;
  }

  function setAgentToken(token = ""): void {
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

  function destroy(): void {
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

export function bindSystemThemeListener(): void {
  destroySystemThemeListener();
  const applySystemThemePreferenceUpdate = () => {
    if (getDashboardState().currentThemePreference === "system") {
      onDashboardThemeSettingsChange({ mode: "system" });
    }
  };
  systemThemeCleanup = dashboardRuntime.subscribeColorSchemeChange(
    applySystemThemePreferenceUpdate,
  );
}

export function destroySystemThemeListener(): void {
  if (typeof systemThemeCleanup === "function") systemThemeCleanup();
  systemThemeCleanup = null;
}

export function applyDashboardI18n(): void {
  dashboardResources.refreshConnectionProfileOptions();
  dashboardResources.refreshSidebarConnectionSelector();
  refreshAgentAuthStatus();
}

export function markProtectedDashboardResourcesRefreshCompleted(): void {
  protectedDashboardResourcesRefreshState.update((version) => version + 1);
}
