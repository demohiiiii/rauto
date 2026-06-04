import { byId, safeCall, setRuntimeValue } from "../services/runtimeGlobals.js";
import {
  closeDashboardConnectionModal,
  openDashboardConnectionModal,
  setDashboardExecMode,
  setDashboardInventorySection,
  setDashboardLangMenuOpen,
  setDashboardLanguage,
  setDashboardConnectionModalMode,
  setDashboardPromptMode,
  setDashboardTab,
  setDashboardTheme,
  setDashboardTemplateSection,
  setDashboardTxStage,
} from "../state/dashboardView.js";

function t(key) {
  return typeof window.t === "function" ? window.t(key) : key;
}

let systemThemeCleanup = null;

function themePreferenceLabel(preference, theme) {
  if (preference === "system") {
    return t("themeSystem");
  }
  return theme === "dark" ? t("themeDark") : t("themeLight");
}

function focusConnectionModalField(id) {
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      const input = byId(id);
      if (!input) return;
      input.focus();
      if (
        typeof input.select === "function" &&
        (id === "saved-conn-name" || id === "host")
      ) {
        input.select();
      }
    }, 90);
  });
}

function onDashboardLanguageChange(lang) {
  setRuntimeValue("currentLang", lang);
  window.currentLang = lang;
  localStorage.setItem("rauto_lang", lang);
  setDashboardLanguage(lang);
  safeCall("applyI18n");
}

function onDashboardThemeChange(theme, preference = "system") {
  const nextTheme = theme === "light" ? "light" : "dark";
  const normalizedPreference =
    typeof window.normalizeThemePreference === "function"
      ? window.normalizeThemePreference(preference)
      : preference === "light" || preference === "dark"
        ? preference
        : "system";

  setRuntimeValue("currentTheme", nextTheme);
  setRuntimeValue("currentThemePreference", normalizedPreference);
  setDashboardTheme(nextTheme, normalizedPreference);
  window.currentTheme = nextTheme;
  window.currentThemePreference = normalizedPreference;
  localStorage.setItem("rauto_theme", normalizedPreference);
  document.body.setAttribute("data-dashboard-theme", nextTheme);
  document.body.setAttribute("data-theme", nextTheme);
  safeCall("setTxBlockJsonEditorTheme", nextTheme);
  safeCall("setTxWorkflowJsonEditorTheme", nextTheme);
  safeCall("setOrchestrationJsonEditorTheme", nextTheme);

  const themeValue = byId("dashboard-tool-theme-value");
  if (themeValue) {
    themeValue.textContent = themePreferenceLabel(
      normalizedPreference,
      nextTheme,
    );
  }
}

function bindSystemThemeListener() {
  if (!window.matchMedia) return;
  systemThemeCleanup?.();

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = () => {
    if (window.currentThemePreference === "system") {
      const nextTheme = media.matches ? "dark" : "light";
      onDashboardThemeChange(nextTheme, "system");
    }
  };

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", sync);
    systemThemeCleanup = () => media.removeEventListener("change", sync);
  } else if (typeof media.addListener === "function") {
    media.addListener(sync);
    systemThemeCleanup = () => media.removeListener(sync);
  }
}

function onDashboardConnectionModalOpen(mode = "saved") {
  const normalizedMode = mode === "temporary" ? "temporary" : "saved";
  openDashboardConnectionModal(normalizedMode);
  safeCall("setStatusMessage", "saved-conn-out", "", "info");
  focusConnectionModalField(
    normalizedMode === "temporary" ? "host" : "saved-conn-name",
  );
  safeCall("renderConnectionModalModeCopy", normalizedMode);
}

function onDashboardConnectionModalModeChange(mode) {
  setDashboardConnectionModalMode(mode);
  safeCall("renderConnectionModalModeCopy", mode);
  focusConnectionModalField(mode === "temporary" ? "host" : "saved-conn-name");
}

function onDashboardTabChange(tab) {
  setRuntimeValue("currentTab", tab);
  setDashboardTab(tab);
  safeCall("applyTabs");
  if (tab === "standard" || tab === "orchestrated") {
    safeCall("loadShowObjects");
    safeCall("loadFlowTemplates");
    safeCall("loadAllJsonTemplates");
  }
  if (tab === "replay") {
    safeCall("renderReplayView");
  }
  if (tab === "prompts") {
    safeCall("loadProfilesOverview");
  }
  if (tab === "templates") {
    safeCall("loadTemplates");
    safeCall("loadFlowTemplates");
    safeCall("loadTextfsmTemplates");
    safeCall("loadTextfsmMappings");
    safeCall("loadAllJsonTemplates");
  }
  if (tab === "inventory") {
    safeCall("loadInventoryConnections");
    safeCall("loadInventoryGroups");
    safeCall("loadInventoryLabels");
  }
  if (tab === "blacklist") {
    safeCall("loadBlacklistPatterns");
  }
  if (tab === "backup") {
    safeCall("loadBackups");
  }
  if (tab === "tasks") {
    safeCall("loadTasks");
  }
}

function onDashboardOpKindChange(kind) {
  setRuntimeValue("currentOpKind", kind);
  safeCall("applyOperationKind");
}

function onDashboardExecModeChange(mode) {
  setRuntimeValue("currentExecMode", mode);
  setDashboardExecMode(mode);
  safeCall("applyExecMode");
}

function onDashboardTxStageChange(stage) {
  setRuntimeValue("currentTxStage", stage);
  setDashboardTxStage(stage);
  safeCall("applyTxStage");
}

function onDashboardPromptModeChange(mode) {
  setRuntimeValue("currentPromptMode", mode);
  setDashboardPromptMode(mode);
  safeCall("applyPromptMode");
}

function onDashboardTemplateSectionChange(section) {
  setRuntimeValue("currentTemplateSection", section);
  setDashboardTemplateSection(section);
  safeCall("applyTemplateSection");
  if (section === "textfsm") {
    safeCall("loadTextfsmTemplates");
    safeCall("loadTextfsmMappings");
  }
}

function onDashboardInventorySectionChange(section) {
  setRuntimeValue("currentInventorySection", section);
  setDashboardInventorySection(section);
  safeCall("applyInventorySection");
}

export function installDashboardViewRuntime() {
  window.themePreferenceLabel = themePreferenceLabel;
  window.bindSystemThemeListener = bindSystemThemeListener;
  window.onDashboardLanguageChange = onDashboardLanguageChange;
  window.onDashboardThemeChange = onDashboardThemeChange;
  window.onDashboardConnectionModalOpen = onDashboardConnectionModalOpen;
  window.onDashboardConnectionModalModeChange =
    onDashboardConnectionModalModeChange;
  window.openDashboardConnectionModal = onDashboardConnectionModalOpen;
  window.closeDashboardConnectionModal = closeDashboardConnectionModal;
  window.onDashboardTabChange = onDashboardTabChange;
  window.onDashboardOpKindChange = onDashboardOpKindChange;
  window.onDashboardExecModeChange = onDashboardExecModeChange;
  window.onDashboardTxStageChange = onDashboardTxStageChange;
  window.onDashboardPromptModeChange = onDashboardPromptModeChange;
  window.onDashboardTemplateSectionChange = onDashboardTemplateSectionChange;
  window.onDashboardInventorySectionChange = onDashboardInventorySectionChange;
  window.setDashboardLangMenuOpen = setDashboardLangMenuOpen;
}
