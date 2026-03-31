function byId(id) {
  return document.getElementById(id);
}

const STORAGE_KEYS = {
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
  rollbackTemplateLibrary: "rauto_rollback_templates",
};



let currentLang = localStorage.getItem(STORAGE_KEYS.lang) || "zh";
let currentTheme = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
window.currentLang = currentLang;
window.currentTheme = currentTheme;
let currentTab = "standard";
window._initialTab = currentTab;
let currentOpKind = "exec";
let currentExecMode = "direct";
let currentTxBlockRunKind = "commands";
let currentPromptMode = "view";
let currentTemplateSection = "templates";
let temporaryConnectionActive = false;
let temporaryConnectionLabel = "";
let temporaryConnectionDetails = null;
let currentConnectionTarget = {
  kind: "none",
  details: null,
};
let managedAgentMode = false;
let cachedSavedConnections = [];
let cachedCustomProfiles = [];
let cachedDeviceProfiles = [];
let cachedTemplates = [];
let cachedTemplateMetas = [];
let cachedFlowTemplateNames = [];
let cachedFlowTemplateMetas = [];
let cachedBackups = [];
let cachedBlacklistPatterns = [];
let cachedProfileModes = new Map();
let lastBuiltinProfile = null;
let lastTemplateDetail = null;
let lastFlowTemplateDetail = null;
let lastFlowRunTemplateDetail = null;
let lastDiagnoseSnapshot = null;
let lastTemplateExecResult = null;
let lastBlacklistCheckResult = null;
let recordViewMode = localStorage.getItem(STORAGE_KEYS.recordViewMode) || "list";
let replayViewMode = localStorage.getItem(STORAGE_KEYS.replayViewMode) || "list";
let lastReplayResult = null;
let recordFailedOnly = localStorage.getItem(STORAGE_KEYS.recordFailedOnly) === "true";
let replayFailedOnly = localStorage.getItem(STORAGE_KEYS.replayFailedOnly) === "true";
let recordEventKind = localStorage.getItem(STORAGE_KEYS.recordEventKind) || "all";
let replayEventKind = localStorage.getItem(STORAGE_KEYS.replayEventKind) || "all";
let recordSearchQuery = localStorage.getItem(STORAGE_KEYS.recordSearchQuery) || "";
let replaySearchQuery = localStorage.getItem(STORAGE_KEYS.replaySearchQuery) || "";
let historyFilterQuery =
  localStorage.getItem(STORAGE_KEYS.historyFilterQuery) || "";
let historyFilterOperation =
  localStorage.getItem(STORAGE_KEYS.historyFilterOperation) || "all";
let historyFilterLimit = Number(
  localStorage.getItem(STORAGE_KEYS.historyFilterLimit) || 30
);
let lastHistoryItems = [];
let detailEntrySeq = 0;
let orchestrationDetailSeq = 0;
let txWorkflowBlockSeq = 0;
let txWorkflowBlocks = [];
let txWorkflowDragBlockId = "";
let txWorkflowFilterKind = "all";
let txWorkflowFilterRollback = "all";
let txWorkflowFilterQuery = "";
let lastTxBlockPreview = {
  txBlock: null,
  txResult: null,
};
let lastOrchestrationPreview = {
  plan: null,
  inventory: null,
  result: null,
};
let txAdvancedExpanded = false;
let currentTxStage = "block";
let txWorkflowMoreExpanded = false;
let rollbackTemplateLibrary = [];
let txRollbackInputMode = "text";
let interactiveSessionId = null;
const detailEntryMap = new Map();
const orchestrationDetailMap = new Map();
const autocompleteMenus = [];
const ALLOWED_EVENT_KINDS = new Set([
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
