<script>
  import { dashboardToolsBehavior } from "../../actions/dashboardToolsBehavior.js";
  import {
    dashboardView,
    setDashboardLangMenuOpen,
    setDashboardLanguage,
    setDashboardTheme,
  } from "../../state/dashboardView.js";

  function toggleTheme() {
    const currentPreference = $dashboardView.currentThemePreference;
    const nextPreference =
      currentPreference === "system"
        ? "light"
        : currentPreference === "light"
          ? "dark"
          : "system";
    const nextTheme =
      nextPreference === "system"
        ? window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
          ? "dark"
          : "light"
        : nextPreference;
    setDashboardTheme(nextTheme, nextPreference);
    window.onDashboardThemeChange?.(nextTheme, nextPreference);
  }

  function toggleLangMenu(event) {
    event.stopPropagation();
    setDashboardLangMenuOpen(!$dashboardView.langMenuOpen);
  }

  function chooseLanguage(event, lang) {
    event.stopPropagation();
    setDashboardLanguage(lang);
    localStorage.setItem("rauto_lang", lang);
    window.onDashboardLanguageChange?.(lang);
  }
</script>

<div class="flex-none lg:hidden">
  <label
    for="sidebar-drawer"
    aria-label="open sidebar"
    class="btn btn-square btn-ghost"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      class="inline-block h-5 w-5 stroke-current"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  </label>
</div>
<div class="flex-1"></div>
<div class="dashboard-header-actions flex-none px-2" use:dashboardToolsBehavior>
  <div class="dashboard-tool-group">
    <button
      id="record-level-toggle-btn"
      class="dashboard-tool dashboard-tool-compact"
      type="button"
      title="Recording level"
      aria-label="Recording level"
    >
      <span id="dashboard-tool-record-level" class="dashboard-tool-label"
        >Record</span
      >
      <span id="dashboard-tool-record-level-value" class="dashboard-tool-meta"
        >Audit</span
      >
    </button>
    <button
      id="record-fab"
      class="dashboard-tool"
      type="button"
      title="Recording"
    >
      <span id="dashboard-tool-record" class="dashboard-tool-label"
        >Recording</span
      >
      <span id="record-fab-badge" class="dashboard-tool-badge" hidden>0</span>
    </button>
    <button id="history-topbar-btn" class="dashboard-tool" type="button">
      <span id="dashboard-tool-history" class="dashboard-tool-label"
        >History</span
      >
    </button>
  </div>
  <div class="dashboard-tool-group dashboard-tool-group-muted">
    <button
      id="theme-toggle-btn"
      class="dashboard-tool dashboard-tool-compact"
      type="button"
      onclick={toggleTheme}
    >
      <span id="dashboard-tool-theme" class="dashboard-tool-label">Theme</span>
      <span id="dashboard-tool-theme-value" class="dashboard-tool-meta"
        >Dark</span
      >
    </button>
    <div class="dashboard-lang-wrap">
      <button
        id="lang-fab"
        class="dashboard-tool dashboard-tool-compact"
        type="button"
        aria-haspopup="true"
        aria-expanded={$dashboardView.langMenuOpen.toString()}
        onclick={toggleLangMenu}
      >
        <span id="dashboard-tool-language" class="dashboard-tool-label"
          >Language</span
        >
        <span class="dashboard-tool-meta"
          >{$dashboardView.currentLang === "zh" ? "中文" : "EN"}</span
        >
      </button>
      <div
        id="lang-menu"
        class="dashboard-menu"
        hidden={!$dashboardView.langMenuOpen}
      >
        <button
          id="lang-en"
          type="button"
          onclick={(event) => chooseLanguage(event, "en")}
        >
          English
        </button>
        <button
          id="lang-zh"
          type="button"
          onclick={(event) => chooseLanguage(event, "zh")}
        >
          中文
        </button>
      </div>
    </div>
  </div>
</div>
