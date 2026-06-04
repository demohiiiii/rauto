const DASHBOARD_STATE_RUNTIME_KEY = "__rautoDashboardStateInstalled";

function byId(id) {
  return document.getElementById(id);
}

function normalizeThemePreference(value) {
  return value === "light" || value === "dark" ? value : "system";
}

function resolveThemePreference(value) {
  const preference = normalizeThemePreference(value);
  if (preference !== "system") {
    return preference;
  }
  if (window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "dark";
}

function setIfArray(key, value) {
  if (Array.isArray(value)) {
    window[key] = value;
  }
}

export function installDashboardState() {
  if (window[DASHBOARD_STATE_RUNTIME_KEY]) return;

  window.byId = byId;
  window.normalizeThemePreference = normalizeThemePreference;
  window.resolveThemePreference = resolveThemePreference;

  window.STORAGE_KEYS = {
    lang: "rauto_lang",
    theme: "rauto_theme",
    agentApiToken: "rauto_agent_api_token",
    recordViewMode: "rauto_record_view_mode",
    replayViewMode: "rauto_replay_view_mode",
    recordFailedOnly: "rauto_record_failed_only",
    replayFailedOnly: "rauto_replay_failed_only",
    recordEventKind: "rauto_record_event_kind",
    replayEventKind: "rauto_replay_event_kind",
    recordSearchQuery: "rauto_record_search_query",
    replaySearchQuery: "rauto_replay_search_query",
    historyFilterQuery: "rauto_history_filter_query",
    historyFilterOperation: "rauto_history_filter_operation",
    historyFilterLimit: "rauto_history_filter_limit",
    connectionTarget: "rauto_connection_target",
  };

  window.currentLang = localStorage.getItem(window.STORAGE_KEYS.lang) || "zh";
  window.currentThemePreference = normalizeThemePreference(
    localStorage.getItem(window.STORAGE_KEYS.theme),
  );
  window.currentTheme = resolveThemePreference(window.currentThemePreference);
  window.currentTab = "standard";
  window._initialTab = window.currentTab;
  window.currentOpKind = "exec";
  window.currentExecMode = "show";
  window.currentPromptMode = "view";
  window.currentTemplateSection = "templates";
  window.currentInventorySection = "groups";
  window.temporaryConnectionActive = false;
  window.temporaryConnectionLabel = "";
  window.temporaryConnectionDetails = null;
  window.currentConnectionTarget = {
    kind: "none",
    details: null,
  };
  window.managedAgentMode = false;

  window.cachedSavedConnections = [];
  window.cachedSavedConnectionDetails = new Map();
  window.cachedCustomProfiles = [];
  window.cachedDeviceProfiles = [];
  window.cachedTemplates = [];
  window.cachedTemplateMetas = [];
  window.cachedFlowTemplateNames = [];
  window.cachedFlowTemplateMetas = [];
  window.cachedBuiltinFlowTemplateMetas = [];
  window.cachedTxBlockTemplateNames = [];
  window.cachedTxBlockTemplateMetas = [];
  window.cachedTxWorkflowTemplateNames = [];
  window.cachedTxWorkflowTemplateMetas = [];
  window.cachedOrchestrationTemplateNames = [];
  window.cachedOrchestrationTemplateMetas = [];
  window.cachedInventoryGroups = [];
  window.cachedInventoryLabels = [];
  window.cachedBackups = [];
  window.cachedBlacklistPatterns = [];
  window.cachedProfileModes = new Map();

  window.lastBuiltinProfile = null;
  window.lastTemplateDetail = null;
  window.lastFlowTemplateDetail = null;
  window.lastBuiltinFlowTemplateDetail = null;
  window.lastFlowRunTemplateDetail = null;
  window.lastDiagnoseSnapshot = null;
  window.lastTemplateExecResult = null;
  window.lastBlacklistCheckResult = null;

  window.recordViewMode =
    localStorage.getItem(window.STORAGE_KEYS.recordViewMode) || "list";
  window.replayViewMode =
    localStorage.getItem(window.STORAGE_KEYS.replayViewMode) || "list";
  window.recordFailedOnly =
    localStorage.getItem(window.STORAGE_KEYS.recordFailedOnly) === "true";
  window.replayFailedOnly =
    localStorage.getItem(window.STORAGE_KEYS.replayFailedOnly) === "true";
  window.recordEventKind =
    localStorage.getItem(window.STORAGE_KEYS.recordEventKind) || "all";
  window.replayEventKind =
    localStorage.getItem(window.STORAGE_KEYS.replayEventKind) || "all";
  window.recordSearchQuery =
    localStorage.getItem(window.STORAGE_KEYS.recordSearchQuery) || "";
  window.replaySearchQuery =
    localStorage.getItem(window.STORAGE_KEYS.replaySearchQuery) || "";

  window.historyFilterQuery =
    localStorage.getItem(window.STORAGE_KEYS.historyFilterQuery) || "";
  window.historyFilterOperation =
    localStorage.getItem(window.STORAGE_KEYS.historyFilterOperation) || "all";
  window.historyFilterLimit = Number(
    localStorage.getItem(window.STORAGE_KEYS.historyFilterLimit) || 30,
  );

  window.detailEntrySeq = 0;
  window.orchestrationDetailSeq = 0;
  window.txWorkflowBlockSeq = 0;
  window.txWorkflowBlocks = [];
  window.txWorkflowDragBlockId = "";
  window.txWorkflowEditingBlockId = "";
  window.txWorkflowEditorModalOpen = false;
  window.suppressTxWorkflowEditorSync = false;
  window.txWorkflowFilterRollback = "all";
  window.txWorkflowFilterQuery = "";
  window.lastTxBlockPreview = {
    txBlock: null,
    txResult: null,
  };
  window.lastOrchestrationPreview = {
    plan: null,
    inventory: null,
    result: null,
  };
  window.currentTxStage = "block";
  window.txBlockViewMode = "direct";
  window.txWorkflowViewMode = "direct";
  window.orchestrationViewMode = "direct";
  window.txWorkflowMoreExpanded = false;
  window.detailEntryMap = new Map();
  window.orchestrationDetailMap = new Map();
  window.autocompleteMenus = [];
  window.ALLOWED_EVENT_KINDS = new Set([
    "all",
    "command_output",
    "connection_established",
    "connection_closed",
    "prompt_changed",
    "state_changed",
    "raw_chunk",
    "tx_block_started",
    "tx_step_succeeded",
    "tx_step_failed",
    "tx_rollback_started",
    "tx_rollback_step_succeeded",
    "tx_rollback_step_failed",
    "tx_block_finished",
    "tx_workflow_started",
    "tx_workflow_finished",
  ]);

  window.setTemplateRuntimeSnapshots = function setTemplateRuntimeSnapshots(
    snapshot = {},
  ) {
    setIfArray("cachedTemplates", snapshot.templates);
    setIfArray("cachedTemplateMetas", snapshot.metas);
    if ("detail" in snapshot) {
      window.lastTemplateDetail = snapshot.detail;
    }
  };

  window.setFlowTemplateRuntimeSnapshots =
    function setFlowTemplateRuntimeSnapshots(snapshot = {}) {
      setIfArray("cachedFlowTemplateNames", snapshot.names);
      setIfArray("cachedFlowTemplateMetas", snapshot.metas);
      setIfArray("cachedBuiltinFlowTemplateMetas", snapshot.builtinMetas);
      if ("detail" in snapshot) {
        window.lastFlowTemplateDetail = snapshot.detail;
      }
      if ("builtinDetail" in snapshot) {
        window.lastBuiltinFlowTemplateDetail = snapshot.builtinDetail;
      }
    };

  window.setJsonTemplateRuntimeSnapshots =
    function setJsonTemplateRuntimeSnapshots(snapshot = {}) {
      setIfArray("cachedTxBlockTemplateNames", snapshot.txBlockNames);
      setIfArray("cachedTxBlockTemplateMetas", snapshot.txBlockMetas);
      setIfArray("cachedTxWorkflowTemplateNames", snapshot.txWorkflowNames);
      setIfArray("cachedTxWorkflowTemplateMetas", snapshot.txWorkflowMetas);
      setIfArray(
        "cachedOrchestrationTemplateNames",
        snapshot.orchestrationNames,
      );
      setIfArray(
        "cachedOrchestrationTemplateMetas",
        snapshot.orchestrationMetas,
      );
    };

  window.setInventoryRuntimeSnapshots = function setInventoryRuntimeSnapshots(
    snapshot = {},
  ) {
    setIfArray("cachedInventoryGroups", snapshot.groups);
    setIfArray("cachedInventoryLabels", snapshot.labels);
  };

  window.setProfileDiagnoseRuntimeSnapshot =
    function setProfileDiagnoseRuntimeSnapshot(snapshot) {
      window.lastDiagnoseSnapshot = snapshot || null;
    };

  window.setRecordingRuntimeState = function setRecordingRuntimeState(
    state = {},
  ) {
    if (state.viewMode === "list" || state.viewMode === "raw") {
      window.recordViewMode = state.viewMode;
    }
    if (typeof state.failedOnly === "boolean") {
      window.recordFailedOnly = state.failedOnly;
    }
    if (typeof state.eventKind === "string") {
      window.recordEventKind = state.eventKind;
    }
    if (typeof state.searchQuery === "string") {
      window.recordSearchQuery = state.searchQuery;
    }
  };

  window.setReplayRuntimeState = function setReplayRuntimeState(state = {}) {
    if (state.viewMode === "list" || state.viewMode === "raw") {
      window.replayViewMode = state.viewMode;
    }
    if (typeof state.failedOnly === "boolean") {
      window.replayFailedOnly = state.failedOnly;
    }
    if (typeof state.eventKind === "string") {
      window.replayEventKind = state.eventKind;
    }
    if (typeof state.searchQuery === "string") {
      window.replaySearchQuery = state.searchQuery;
    }
  };

  window.setHistoryFilterRuntimeState = function setHistoryFilterRuntimeState(
    state = {},
  ) {
    if (typeof state.query === "string") {
      window.historyFilterQuery = state.query;
    }
    if (typeof state.operation === "string") {
      window.historyFilterOperation = state.operation;
    }
    const limit = Number(state.limit);
    if (Number.isFinite(limit) && limit > 0) {
      window.historyFilterLimit = limit;
    }
  };

  window.setTxRuntimeViewModes = function setTxRuntimeViewModes(modes = {}) {
    if (modes.txBlock === "direct" || modes.txBlock === "template") {
      window.txBlockViewMode = modes.txBlock;
    }
    if (modes.txWorkflow === "direct" || modes.txWorkflow === "template") {
      window.txWorkflowViewMode = modes.txWorkflow;
    }
    if (
      modes.orchestration === "direct" ||
      modes.orchestration === "template"
    ) {
      window.orchestrationViewMode = modes.orchestration;
    }
  };

  window[DASHBOARD_STATE_RUNTIME_KEY] = true;
}
