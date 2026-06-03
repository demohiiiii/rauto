import {
  byId,
  runtimeValue,
  safeCall,
  setRuntimeValue,
} from "../services/runtimeGlobals.js";

function safeString(value) {
  if (typeof window.safeString === "function") {
    return window.safeString(value);
  }
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function t(key) {
  return typeof window.t === "function" ? window.t(key) : key;
}

function initializeStatusMessages() {
  [
    "saved-conn-out",
    "connection-test-out",
    "tx-plan-out",
    "tx-exec-out",
    "tx-workflow-plan-out",
    "tx-workflow-exec-out",
    "orchestration-plan-out",
    "orchestration-exec-out",
    "template-out",
    "flow-out",
    "upload-out",
    "flow-template-out",
    "inventory-group-out",
    "inventory-label-out",
    "blacklist-out",
    "backup-out",
    "builtin-detail-status",
    "profile-out",
    "profile-diagnose-out",
  ].forEach((id) => safeCall("setStatusMessage", id, "-", "info"));
}

function initializeTxEditors() {
  setRuntimeValue("txWorkflowBlocks", [safeCall("createTxWorkflowBlock")]);

  if (!safeString(byId("tx-workflow-json")?.value || "").trim()) {
    safeCall(
      "setTxWorkflowEditorJson",
      safeCall("defaultTxWorkflowTemplatePayload"),
    );
  }
  if (!safeString(byId("tx-block-json")?.value || "").trim()) {
    safeCall("setTxBlockEditorJson", safeCall("defaultTxBlockTemplatePayload"));
  }
  if (!safeString(byId("orchestration-json")?.value || "").trim()) {
    safeCall(
      "setOrchestrationEditorJson",
      safeCall("defaultOrchestrationTemplatePayload"),
    );
  }

  safeCall("setupTxWorkflowJsonEditor");
  safeCall("setupTxBlockJsonEditor");
  safeCall("setupOrchestrationJsonEditor");
  safeCall("setupTxVarsAssistants");
}

function initializeEventFilters() {
  const recordFailedOnly = byId("record-failed-only");
  if (recordFailedOnly)
    recordFailedOnly.checked = !!runtimeValue("recordFailedOnly");

  const replayFailedOnly = byId("replay-failed-only");
  if (replayFailedOnly)
    replayFailedOnly.checked = !!runtimeValue("replayFailedOnly");

  const recordEventKind = byId("record-event-kind");
  if (recordEventKind)
    recordEventKind.value = runtimeValue("recordEventKind") || "all";

  const replayEventKind = byId("replay-event-kind");
  if (replayEventKind)
    replayEventKind.value = runtimeValue("replayEventKind") || "all";

  const recordSearch = byId("record-search");
  if (recordSearch)
    recordSearch.value = runtimeValue("recordSearchQuery") || "";

  const replaySearch = byId("replay-search");
  if (replaySearch)
    replaySearch.value = runtimeValue("replaySearchQuery") || "";
}

function initializeProtectedData() {
  safeCall("maybePersistAgentTokenFromUrl");
  const detectManagedAgentMode = window.detectManagedAgentMode;
  if (typeof detectManagedAgentMode !== "function") {
    safeCall("refreshProtectedData");
    return;
  }

  detectManagedAgentMode().then(() => {
    if (
      runtimeValue("managedAgentMode") &&
      !safeCall("getStoredAgentApiToken")
    ) {
      safeCall(
        "setStatusMessage",
        "saved-conn-out",
        t("agentAuthRequired"),
        "info",
      );
      return;
    }
    safeCall("refreshProtectedData");
  });
}

export function bootstrapDashboardRuntime() {
  safeCall("normalizeFilterPrefs");
  safeCall("normalizeHistoryFilters");
  safeCall("saveFilterPrefs");
  safeCall("saveHistoryFilterPrefs");
  safeCall("bindEvents");
  safeCall("initConnectionSelectionPickers");
  safeCall("initConnectionVarsForms");
  safeCall("initTopLevelAutocomplete");
  safeCall("initCollapsibleGroups");
  initializeTxEditors();
  safeCall("bindSystemThemeListener");
  safeCall("applyI18n");
  initializeStatusMessages();
  safeCall("renderBlacklistCheckResult");
  safeCall("applyTabs");
  safeCall("applyOperationKind");
  safeCall("applyPromptMode");
  safeCall("applyTemplateSection");
  safeCall("applyInventorySection");
  safeCall("resetDiagnoseView");
  safeCall("updateRecordFabVisibility");
  initializeEventFilters();
  initializeProtectedData();
  safeCall("setProfileForm", {
    name: "",
    more_patterns: [],
    error_patterns: [],
    ignore_errors: [],
    prompt_prefix: [],
    prompts: [],
    sys_prompts: [],
    interactions: [],
    transitions: [],
  });
  safeCall("refreshExecutionModeOptions");
}
