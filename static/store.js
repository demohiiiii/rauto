/**
 * store.js - Alpine.js global state management
 *
 * The dashboard uses Alpine as the single source of truth for
 * navigation and view mode. Legacy modules still expose imperative
 * side effects through the window.onAlpine* hooks.
 */

function readGlobalState(key, fallback) {
  return typeof window[key] !== "undefined" ? window[key] : fallback;
}

document.addEventListener("alpine:init", () => {
  Alpine.store("app", {
    currentLang: readGlobalState("currentLang", "zh"),
    currentTheme: readGlobalState("currentTheme", "dark"),
    currentTab: readGlobalState("currentTab", "standard"),
    currentOpKind: readGlobalState("currentOpKind", "exec"),
    currentExecMode: readGlobalState("currentExecMode", "direct"),
    currentTxStage: readGlobalState("currentTxStage", "block"),
    currentTxBlockRunKind: readGlobalState("currentTxBlockRunKind", "commands"),
    currentPromptMode: readGlobalState("currentPromptMode", "view"),
    currentTemplateSection: readGlobalState("currentTemplateSection", "templates"),
    navGroups: {
      standard: readGlobalState("currentTab", "standard") === "standard",
      orchestrated: readGlobalState("currentTab", "standard") === "orchestrated",
      prompts: readGlobalState("currentTab", "standard") === "prompts",
      templates: readGlobalState("currentTab", "standard") === "templates",
    },
    sidebarOpen: false,
    langMenuOpen: false,
    connectionModalOpen: false,

    isActiveTab(tab) {
      return this.currentTab === tab;
    },

    setTab(tab) {
      if (!tab || this.currentTab === tab) return;
      this.currentTab = tab;
      currentTab = tab;
      if (tab === "standard" || tab === "orchestrated" || tab === "prompts" || tab === "templates") {
        this.navGroups[tab] = true;
      }
      if (tab === "standard" && this.currentOpKind !== "exec") {
        this.setOpKind("exec");
      }
      if (tab === "orchestrated" && this.currentOpKind !== "tx") {
        this.setOpKind("tx");
      }
      if (typeof window.onAlpineTabChange === "function") {
        window.onAlpineTabChange(tab);
      }
    },

    isNavGroupOpen(group) {
      return !!this.navGroups[group];
    },

    setNavGroupOpen(group, open) {
      if (!group || typeof this.navGroups[group] === "undefined") return;
      this.navGroups[group] = !!open;
    },

    toggleNavGroup(group) {
      if (!group || typeof this.navGroups[group] === "undefined") return;
      this.navGroups[group] = !this.navGroups[group];
    },

    togglePrimaryGroup(group) {
      if (!group || typeof this.navGroups[group] === "undefined") return;
      const wasActive = this.currentTab === group;
      if (!wasActive) {
        this.setTab(group);
        this.navGroups[group] = true;
        return;
      }
      this.navGroups[group] = !this.navGroups[group];
    },

    setOpKind(kind) {
      if (!kind || this.currentOpKind === kind) return;
      this.currentOpKind = kind;
      currentOpKind = kind;
      if (typeof window.onAlpineOpKindChange === "function") {
        window.onAlpineOpKindChange(kind);
      }
    },

    setExecMode(mode) {
      if (!mode || this.currentExecMode === mode) return;
      this.currentExecMode = mode;
      currentExecMode = mode;
      if (typeof window.onAlpineExecModeChange === "function") {
        window.onAlpineExecModeChange(mode);
      }
    },

    setTxStage(stage) {
      if (!stage || this.currentTxStage === stage) return;
      this.currentTxStage = stage;
      currentTxStage = stage;
      if (typeof window.onAlpineTxStageChange === "function") {
        window.onAlpineTxStageChange(stage);
      }
    },

    setTxBlockRunKind(kind) {
      if (!kind || this.currentTxBlockRunKind === kind) return;
      this.currentTxBlockRunKind = kind;
      currentTxBlockRunKind = kind;
      if (typeof window.onAlpineTxBlockRunKindChange === "function") {
        window.onAlpineTxBlockRunKindChange(kind);
      }
    },

    setPromptMode(mode) {
      if (!mode || this.currentPromptMode === mode) return;
      this.currentPromptMode = mode;
      currentPromptMode = mode;
      if (typeof window.onAlpinePromptModeChange === "function") {
        window.onAlpinePromptModeChange(mode);
      }
    },

    setTemplateSection(section) {
      if (!section || this.currentTemplateSection === section) return;
      this.currentTemplateSection = section;
      currentTemplateSection = section;
      if (typeof window.onAlpineTemplateSectionChange === "function") {
        window.onAlpineTemplateSectionChange(section);
      }
    },

    openStandardSection(section) {
      this.setTab("standard");
      this.navGroups.standard = true;
      this.setOpKind("exec");
      this.setExecMode(section || "direct");
    },

    isStandardSection(section) {
      return this.currentTab === "standard" && this.currentExecMode === section;
    },

    openOrchestratedSection(section) {
      this.setTab("orchestrated");
      this.navGroups.orchestrated = true;
      this.setOpKind("tx");
      this.setTxStage(section || "block");
    },

    isOrchestratedSection(section) {
      return this.currentTab === "orchestrated" && this.currentTxStage === section;
    },

    openPromptSection(section) {
      this.setTab("prompts");
      this.navGroups.prompts = true;
      this.setPromptMode(section || "view");
    },

    isPromptSection(section) {
      return this.currentTab === "prompts" && this.currentPromptMode === section;
    },

    openTemplateSection(section) {
      this.setTab("templates");
      this.navGroups.templates = true;
      this.setTemplateSection(section || "templates");
    },

    isTemplateSection(section) {
      return this.currentTab === "templates" && this.currentTemplateSection === section;
    },

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },

    closeSidebar() {
      this.sidebarOpen = false;
    },

    toggleLangMenu() {
      this.langMenuOpen = !this.langMenuOpen;
    },

    closeLangMenu() {
      this.langMenuOpen = false;
    },

    openConnectionModal() {
      this.connectionModalOpen = true;
      if (typeof window.onAlpineConnectionModalOpen === "function") {
        window.onAlpineConnectionModalOpen();
      }
    },

    closeConnectionModal() {
      this.connectionModalOpen = false;
    },

    setLanguage(lang) {
      if (!lang) return;
      this.currentLang = lang;
      currentLang = lang;
      localStorage.setItem(STORAGE_KEYS.lang, lang);
      this.closeLangMenu();
      if (typeof window.onAlpineLanguageChange === "function") {
        window.onAlpineLanguageChange(lang);
      }
    },

    setTheme(theme) {
      const nextTheme = theme === "light" ? "light" : "dark";
      this.currentTheme = nextTheme;
      currentTheme = nextTheme;
      localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
      if (typeof window.onAlpineThemeChange === "function") {
        window.onAlpineThemeChange(nextTheme);
      }
    },

    toggleTheme() {
      this.setTheme(this.currentTheme === "dark" ? "light" : "dark");
    },

    syncFromGlobals() {
      this.currentLang = readGlobalState("currentLang", this.currentLang);
      this.currentTheme = readGlobalState("currentTheme", this.currentTheme);
      this.currentTab = readGlobalState("currentTab", this.currentTab);
      this.currentOpKind = readGlobalState("currentOpKind", this.currentOpKind);
      this.currentExecMode = readGlobalState("currentExecMode", this.currentExecMode);
      this.currentTxStage = readGlobalState("currentTxStage", this.currentTxStage);
      this.currentTxBlockRunKind = readGlobalState(
        "currentTxBlockRunKind",
        this.currentTxBlockRunKind
      );
      this.currentPromptMode = readGlobalState(
        "currentPromptMode",
        this.currentPromptMode
      );
      this.currentTemplateSection = readGlobalState(
        "currentTemplateSection",
        this.currentTemplateSection
      );
    },
  });
});
