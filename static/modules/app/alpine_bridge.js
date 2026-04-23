/**
 * app_alpine.js - Alpine bridge callbacks and modal focus helpers
 */

window.onAlpineLanguageChange = function onAlpineLanguageChange(lang) {
  currentLang = lang;
  window.currentLang = currentLang;
  applyI18n();
};

window.onAlpineThemeChange = function onAlpineThemeChange(theme) {
  currentTheme = theme === "light" ? "light" : "dark";
  window.currentTheme = currentTheme;
  document.body.setAttribute("data-dashboard-theme", currentTheme);
  document.body.setAttribute("data-theme", currentTheme);
  if (typeof setTxBlockJsonEditorTheme === "function") {
    setTxBlockJsonEditorTheme(currentTheme);
  }
  if (typeof setTxWorkflowJsonEditorTheme === "function") {
    setTxWorkflowJsonEditorTheme(currentTheme);
  }
  if (typeof setOrchestrationJsonEditorTheme === "function") {
    setOrchestrationJsonEditorTheme(currentTheme);
  }
  const themeValue = byId("dashboard-tool-theme-value");
  if (themeValue) {
    themeValue.textContent =
      currentTheme === "dark" ? t("themeDark") : t("themeLight");
  }
};

function focusConnectionModalField(id) {
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      const input = byId(id);
      if (!input) return;
      input.focus();
      if (typeof input.select === "function" && (id === "saved-conn-name" || id === "host")) {
        input.select();
      }
    }, 90);
  });
}

window.onAlpineConnectionModalOpen = function onAlpineConnectionModalOpen() {
  setStatusMessage("saved-conn-out", "", "info");
  focusConnectionModalField("saved-conn-name");
  if (typeof renderConnectionModalModeCopy === "function") {
    renderConnectionModalModeCopy("saved");
  }
};

window.onAlpineConnectionModalModeChange = function onAlpineConnectionModalModeChange(mode) {
  if (typeof renderConnectionModalModeCopy === "function") {
    renderConnectionModalModeCopy(mode);
  }
  if (mode === "temporary") {
    focusConnectionModalField("host");
    return;
  }
  focusConnectionModalField("saved-conn-name");
};

window.onAlpineTabChange = function onAlpineTabChange(tab) {
  currentTab = tab;
  applyTabs();
  if (tab === "standard" || tab === "orchestrated") {
    loadFlowTemplates();
    loadAllJsonTemplates();
  }
  if (tab === "replay") {
    renderReplayView();
  }
  if (tab === "prompts") {
    loadProfilesOverview();
  }
  if (tab === "templates") {
    loadTemplates();
    loadFlowTemplates();
    loadAllJsonTemplates();
  }
  if (tab === "inventory") {
    loadInventoryConnections();
    loadInventoryGroups();
    loadInventoryLabels();
  }
  if (tab === "blacklist") {
    loadBlacklistPatterns();
  }
  if (tab === "backup") {
    loadBackups();
  }
  if (tab === "tasks") {
    loadTasks();
  }
};

window.onAlpineOpKindChange = function onAlpineOpKindChange(kind) {
  currentOpKind = kind;
  applyOperationKind();
};

window.onAlpineExecModeChange = function onAlpineExecModeChange(mode) {
  currentExecMode = mode;
  applyExecMode();
};

window.onAlpineTxStageChange = function onAlpineTxStageChange(stage) {
  currentTxStage = stage;
  applyTxStage();
};

window.onAlpinePromptModeChange = function onAlpinePromptModeChange(mode) {
  currentPromptMode = mode;
  applyPromptMode();
};

window.onAlpineTemplateSectionChange = function onAlpineTemplateSectionChange(section) {
  currentTemplateSection = section;
  applyTemplateSection();
};

window.onAlpineInventorySectionChange = function onAlpineInventorySectionChange(section) {
  currentInventorySection = section;
  applyInventorySection();
};
