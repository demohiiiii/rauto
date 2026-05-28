/**
 * app.js - Application bootstrap
 */

normalizeFilterPrefs();
normalizeHistoryFilters();
saveFilterPrefs();
saveHistoryFilterPrefs();
bindEvents();
if (typeof initConnectionSelectionPickers === "function") {
  initConnectionSelectionPickers();
}
if (typeof initConnectionVarsForms === "function") {
  initConnectionVarsForms();
}
initTopLevelAutocomplete();
initCollapsibleGroups();
txWorkflowBlocks = [createTxWorkflowBlock()];
if (!safeString(byId("tx-workflow-json")?.value || "").trim()) {
  setTxWorkflowEditorJson(defaultTxWorkflowTemplatePayload());
}
if (!safeString(byId("tx-block-json")?.value || "").trim()) {
  setTxBlockEditorJson(defaultTxBlockTemplatePayload());
}
if (!safeString(byId("orchestration-json")?.value || "").trim()) {
  setOrchestrationEditorJson(defaultOrchestrationTemplatePayload());
}
if (typeof setupTxWorkflowJsonEditor === "function") {
  setupTxWorkflowJsonEditor();
}
if (typeof setupTxBlockJsonEditor === "function") {
  setupTxBlockJsonEditor();
}
if (typeof setupOrchestrationJsonEditor === "function") {
  setupOrchestrationJsonEditor();
}
if (typeof setupTxVarsAssistants === "function") {
  setupTxVarsAssistants();
}
if (typeof bindSystemThemeListener === "function") {
  bindSystemThemeListener();
}
applyI18n();
setStatusMessage("saved-conn-out", "-", "info");
setStatusMessage("connection-test-out", "-", "info");
setStatusMessage("tx-plan-out", "-", "info");
setStatusMessage("tx-exec-out", "-", "info");
setStatusMessage("tx-workflow-plan-out", "-", "info");
setStatusMessage("tx-workflow-exec-out", "-", "info");
setStatusMessage("orchestration-plan-out", "-", "info");
setStatusMessage("orchestration-exec-out", "-", "info");
setStatusMessage("template-out", "-", "info");
setStatusMessage("flow-out", "-", "info");
setStatusMessage("upload-out", "-", "info");
setStatusMessage("flow-template-out", "-", "info");
setStatusMessage("inventory-group-out", "-", "info");
setStatusMessage("inventory-label-out", "-", "info");
setStatusMessage("blacklist-out", "-", "info");
setStatusMessage("backup-out", "-", "info");
setStatusMessage("builtin-detail-status", "-", "info");
setStatusMessage("profile-out", "-", "info");
setStatusMessage("profile-diagnose-out", "-", "info");
renderBlacklistCheckResult();
applyTabs();
applyOperationKind();
applyPromptMode();
applyTemplateSection();
applyInventorySection();
resetDiagnoseView();
updateRecordFabVisibility();
byId("record-failed-only").checked = recordFailedOnly;
byId("replay-failed-only").checked = replayFailedOnly;
byId("record-event-kind").value = recordEventKind;
byId("replay-event-kind").value = replayEventKind;
byId("record-search").value = recordSearchQuery;
byId("replay-search").value = replaySearchQuery;
maybePersistAgentTokenFromUrl();
detectManagedAgentMode().then(() => {
  if (managedAgentMode && !getStoredAgentApiToken()) {
    setStatusMessage("saved-conn-out", t("agentAuthRequired"), "info");
    return;
  }
  refreshProtectedData();
});
setProfileForm({
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
refreshExecutionModeOptions();
