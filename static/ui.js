/**
 * ui.js - UI control and state management functions
 */

function currentConnectionModalMode() {
  try {
    if (window.Alpine && typeof window.Alpine.store === "function") {
      const appStore = window.Alpine.store("app");
      if (appStore && appStore.connectionModalMode) {
        return appStore.connectionModalMode;
      }
    }
  } catch (_) {}
  return "saved";
}

function renderConnectionModalModeCopy(mode = "") {
  const currentMode = mode || currentConnectionModalMode();
  const subtitle = byId("connection-workspace-subtitle");
  if (subtitle) {
    subtitle.textContent =
      currentMode === "temporary"
        ? t("connectionWorkspaceSubtitleTemporary")
        : t("connectionWorkspaceSubtitleManage");
  }
  const savedTab = byId("connection-modal-tab-saved");
  if (savedTab) {
    savedTab.textContent = t("connectionModalModeManage");
  }
  const temporaryTab = byId("connection-modal-tab-temporary");
  if (temporaryTab) {
    temporaryTab.textContent = t("connectionModalModeTemporary");
  }
}

function currentOrchestratedStageTitle() {
  return currentTxStage === "workflow"
    ? t("txStageWorkflow")
    : currentTxStage === "orchestrate"
      ? t("txStageOrchestrate")
      : t("txStageBlock");
}

function applyI18n() {
  if (byId("title")) byId("title").textContent = t("title");
  if (byId("subtitle")) byId("subtitle").textContent = t("subtitle");
  if (byId("dashboard-header-subtitle")) {
    byId("dashboard-header-subtitle").textContent = t("dashboardHeaderSubtitle");
    if (byId("dashboard-chip-web")) byId("dashboard-chip-web").textContent = t("dashboardChipWeb");
    if (byId("dashboard-chip-mode")) byId("dashboard-chip-mode").textContent = t("dashboardChipMode");
    if (byId("dashboard-kicker")) byId("dashboard-kicker").textContent = t("dashboardKicker");
    if (byId("dashboard-pill-exec")) byId("dashboard-pill-exec").textContent = t("dashboardPillExec");
    if (byId("dashboard-pill-tx")) byId("dashboard-pill-tx").textContent = t("dashboardPillTx");
    if (byId("dashboard-pill-flow")) byId("dashboard-pill-flow").textContent = t("dashboardPillFlow");
    if (byId("dashboard-pill-upload")) byId("dashboard-pill-upload").textContent = t("dashboardPillUpload");
    if (byId("dashboard-summary-label-execution")) byId("dashboard-summary-label-execution").textContent = t("dashboardSummaryLabelExecution");
    if (byId("dashboard-summary-value-execution")) byId("dashboard-summary-value-execution").textContent = t("dashboardSummaryValueExecution");
    if (byId("dashboard-summary-note-execution")) byId("dashboard-summary-note-execution").textContent = t("dashboardSummaryNoteExecution");
    if (byId("dashboard-summary-label-connection")) byId("dashboard-summary-label-connection").textContent = t("dashboardSummaryLabelConnection");
    if (byId("dashboard-summary-value-connection")) byId("dashboard-summary-value-connection").textContent = t("dashboardSummaryValueConnection");
    if (byId("dashboard-summary-note-connection")) byId("dashboard-summary-note-connection").textContent = t("dashboardSummaryNoteConnection");
    if (byId("dashboard-summary-label-flows")) byId("dashboard-summary-label-flows").textContent = t("dashboardSummaryLabelFlows");
    if (byId("dashboard-summary-value-flows")) byId("dashboard-summary-value-flows").textContent = t("dashboardSummaryValueFlows");
    if (byId("dashboard-summary-note-flows")) byId("dashboard-summary-note-flows").textContent = t("dashboardSummaryNoteFlows");
    if (byId("dashboard-summary-label-records")) byId("dashboard-summary-label-records").textContent = t("dashboardSummaryLabelRecords");
    if (byId("dashboard-summary-value-records")) byId("dashboard-summary-value-records").textContent = t("dashboardSummaryValueRecords");
    if (byId("dashboard-summary-note-records")) byId("dashboard-summary-note-records").textContent = t("dashboardSummaryNoteRecords");
  }
  if (byId("dashboard-sidebar-tagline")) {
    byId("dashboard-sidebar-tagline").textContent = t("dashboardSidebarTagline");
  }
  if (byId("agent-auth-title")) {
    byId("agent-auth-title").textContent = t("agentAuthTitle");
    byId("agent-auth-hint").textContent = t("agentAuthHint");
    byId("agent-api-token").placeholder = t("agentAuthPlaceholder");
    byId("agent-api-token-save-btn").textContent = t("agentAuthSaveBtn");
    byId("agent-api-token-clear-btn").textContent = t("agentAuthClearBtn");
  }
  byId("lang-fab").title = t("langMenuLabel");
  byId("lang-fab").setAttribute("aria-label", t("langMenuLabel"));
  byId("theme-toggle-btn").title = t("themeToggleTitle");
  byId("theme-toggle-btn").setAttribute("aria-label", t("themeToggleTitle"));
  byId("dashboard-tool-theme").textContent = t("themeToggleTitle");
  byId("dashboard-tool-theme-value").textContent =
    currentTheme === "dark" ? t("themeDark") : t("themeLight");
  byId("dashboard-tool-language").textContent = t("langMenuLabel");
  byId("lang-en").textContent = t("langOptionEnglish");
  byId("lang-zh").textContent = t("langOptionChinese");
  byId("connection-title").textContent = t("connectionTitle");
  renderConnectionModalModeCopy();
  byId("connection-quick-title").textContent = t("connectionQuickTitle");
  byId("sidebar-connection-title").textContent = t("sidebarConnectionTitle");
  byId("sidebar-connection-help").setAttribute("aria-label", t("sidebarConnectionHint"));
  byId("sidebar-connection-help").setAttribute("title", t("sidebarConnectionHint"));
  byId("sidebar-connection-open-btn").textContent = t("sidebarConnectionOpenBtn");
  byId("sidebar-connection-history-btn").textContent = t("savedConnHistoryBtn");
  byId("connection-test-btn").textContent = t("connectionTestBtn");
  byId("saved-conn-title").textContent = t("savedConnTitle");
  byId("saved-conn-subtitle").textContent = t("savedConnSubtitle");
  byId("saved-conn-save-password-label").textContent = t("savedConnSavePassword");
  byId("saved-conn-enabled-label").textContent = t("inventoryFieldEnabled");
  byId("saved-conn-labels-label").textContent = t("inventoryFieldLabels");
  byId("saved-conn-groups-label").textContent = t("inventoryFieldGroups");
  byId("saved-conn-vars-label").textContent = t("inventoryFieldVars");
  byId("saved-conn-labels").placeholder = t("inventoryFieldLabelsPlaceholder");
  byId("saved-conn-vars").placeholder = t("inventoryFieldVarsPlaceholder");
  byId("saved-conn-template-btn").textContent = t("savedConnTemplateBtn");
  byId("saved-conn-import-btn").textContent = t("savedConnImportBtn");
  byId("saved-conn-new-btn").textContent = t("newBtn");
  byId("saved-conn-use-btn").textContent = t("savedConnUseBtn");
  byId("saved-conn-edit-btn").textContent = t("savedConnEditBtn");
  byId("saved-conn-delete-btn").textContent = t("savedConnDeleteBtn");
  byId("saved-conn-history-btn").textContent = t("savedConnHistoryBtn");
  byId("saved-conn-edit-title").textContent = t("savedConnEditTitle");
  byId("saved-conn-edit-hint").textContent = t("savedConnEditHint");
  byId("saved-conn-edit-name-label").textContent = t("inventoryFieldName");
  byId("saved-conn-edit-save-password-label").textContent = t("savedConnSavePassword");
  byId("saved-conn-edit-enabled-label").textContent = t("inventoryFieldEnabled");
  byId("saved-conn-edit-labels-label").textContent = t("inventoryFieldLabels");
  byId("saved-conn-edit-groups-label").textContent = t("inventoryFieldGroups");
  byId("saved-conn-edit-vars-label").textContent = t("inventoryFieldVars");
  byId("saved-conn-edit-labels").placeholder = t("inventoryFieldLabelsPlaceholder");
  byId("saved-conn-edit-vars").placeholder = t("inventoryFieldVarsPlaceholder");
  byId("saved-conn-edit-save-btn").textContent = t("savedConnSaveBtn");
  byId("saved-conn-edit-cancel-btn").textContent = t("cancel");
  byId("saved-conn-edit-close-btn").textContent = t("close");
  byId("connection-temp-apply-btn").textContent = t("connectionTempApplyBtn");
  byId("connection-modal-close").textContent = t("close");
  byId("connection-help").textContent = t("connectionHelp");
  byId("connection-temp-hint").textContent = t("connectionTempHint");
  byId("saved-conn-edit-ssh-security-option-default").textContent = t("sshSecurityOptionDefault");
  byId("saved-conn-edit-ssh-security-option-secure").textContent = t("sshSecurityOptionSecure");
  byId("saved-conn-edit-ssh-security-option-balanced").textContent = t("sshSecurityOptionBalanced");
  byId("saved-conn-edit-ssh-security-option-legacy").textContent = t("sshSecurityOptionLegacy");
  byId("saved-conn-edit-linux-shell-option-default").textContent = t("linuxShellOptionDefault");
  byId("saved-conn-edit-linux-shell-option-posix").textContent = t("linuxShellOptionPosix");
  byId("saved-conn-edit-linux-shell-option-fish").textContent = t("linuxShellOptionFish");
  if (typeof window.onAlpineThemeChange === "function") {
    window.onAlpineThemeChange(currentTheme);
  }

  byId("tab-standard").textContent = t("opSectionStandard");
  if (byId("tab-tx-block")) {
    byId("tab-tx-block").textContent = t("txStageBlock");
  }
  if (byId("tab-tx-workflow")) {
    byId("tab-tx-workflow").textContent = t("txStageWorkflow");
  }
  if (byId("tab-orchestrate")) {
    byId("tab-orchestrate").textContent = t("txStageOrchestrate");
  }
  byId("tab-interactive").textContent = t("tabInteractive");
  byId("tab-replay").textContent = t("tabReplay");
  byId("tab-prompts").textContent = t("tabPrompts");
  byId("tab-templates").textContent = t("tabTemplates");
  byId("tab-inventory").textContent = t("tabInventory");
  byId("tab-transfer").textContent = t("tabTransfer");
  byId("tab-blacklist").textContent = t("tabBlacklist");
  byId("tab-backup").textContent = t("tabBackup");
  byId("tab-tasks").textContent = t("tabTasks");
  byId("standard-mode-direct").textContent = t("opExecDirect");
  byId("standard-mode-template").textContent = t("opExecTemplate");
  byId("standard-mode-flow").textContent = t("opExecFlow");
  byId("nav-prompt-view").textContent = t("promptModeView");
  byId("nav-prompt-edit").textContent = t("promptModeEdit");
  byId("nav-prompt-diagnose").textContent = t("promptModeDiagnose");
  byId("template-section-btn-library").textContent = t("templateCommonTabTitle");
  byId("template-section-btn-flows").textContent = t("flowTemplateMgrTitle");
  byId("nav-inventory-groups").textContent = t("inventoryGroupsTitle");
  byId("nav-inventory-resolve").textContent = t("inventoryResolveTitle");

  byId("standard-title").textContent = t("opSectionStandard");
  byId("orchestrated-title").textContent = currentOrchestratedStageTitle();
  byId("interactive-title").textContent = t("interactiveTitle");
  byId("interactive-card-title").textContent = t("interactiveCardTitle");
  byId("interactive-start-btn").textContent = t("interactiveStartBtn");
  byId("interactive-stop-btn").textContent = t("interactiveStopBtn");
  byId("interactive-send-btn").textContent = t("interactiveSendBtn");
  byId("interactive-clear-btn").textContent = t("interactiveClearBtn");
  byId("record-fab").title = t("recordFabTitle");
  byId("dashboard-tool-record").textContent = t("recordFabTitle");
  byId("record-level-toggle-btn").title = t("recordLevelLabel");
  byId("record-level-toggle-btn").setAttribute("aria-label", t("recordLevelLabel"));
  byId("dashboard-tool-record-level").textContent = t("recordLevelLabel");
  byId("history-topbar-btn").title = t("savedConnHistoryBtn");
  byId("dashboard-tool-history").textContent = t("savedConnHistoryBtn");
  byId("record-drawer-close").textContent = t("recordDrawerClose");
  byId("recording-subtitle").textContent = t("recordDrawerSubtitle");
  const currentRecordLevel =
    byId("record-level")?.value ||
    "key-events-only";
  const recordLevelOptions = `
    <option value="key-events-only">${escapeHtml(t("recordLevelAudit"))}</option>
    <option value="full">${escapeHtml(t("recordLevelFull"))}</option>
  `;
  const recordLevelEl = byId("record-level");
  recordLevelEl.innerHTML = recordLevelOptions;
  syncRecordLevelToggleView(currentRecordLevel, { updateSelect: true });
  updateRecordLevelTooltip();
  byId("history-drawer-title").textContent = t("historyDrawerTitle");
  byId("history-drawer-subtitle").textContent = t("historyDrawerSubtitle");
  byId("history-drawer-refresh-btn").textContent = t("historyDrawerRefresh");
  byId("history-drawer-close").textContent = t("close");
  byId("history-drawer-conn-label").textContent = t("historyDrawerConnLabel");
  byId("history-filter-query").placeholder = t("historyFilterPlaceholder");
  byId("history-filter-clear-btn").textContent = t("historyFilterClear");
  const historyOpEl = byId("history-filter-operation");
  historyOpEl.innerHTML = `
    <option value="all">${escapeHtml(t("historyFilterOperationAll"))}</option>
    <option value="exec">exec</option>
    <option value="template_execute">template_execute</option>
    <option value="tx_block">tx_block</option>
    <option value="tx_workflow">tx_workflow</option>
    <option value="orchestrate_tx_block">orchestrate_tx_block</option>
    <option value="orchestrate_tx_workflow">orchestrate_tx_workflow</option>
    <option value="interactive">interactive</option>
  `;
  historyOpEl.value = historyFilterOperation;
  byId("history-filter-limit").value = String(historyFilterLimit || 30);
  byId("history-filter-query").value = historyFilterQuery || "";
  if (interactiveSessionId) {
    setInteractiveStatus(`${t("interactiveStatusReady")} · ${interactiveSessionId}`);
  } else {
    setInteractiveStatus(t("interactiveStatusIdle"));
  }
  byId("replay-page-title").textContent = t("replayPageTitle");
  byId("standard-op-card-title").textContent = t("opCardTitle");
  if (byId("orchestrated-op-card-title")) {
    byId("orchestrated-op-card-title").textContent = t("opCardTitle");
  }
  byId("template-selected-content-title").textContent = t("templateSelectedContentTitle");
  byId("prompt-mgr-title").textContent = t("promptMgrTitle");
  byId("builtin-title").textContent = t("builtinTitle");
  byId("custom-title").textContent = t("customTitle");
  byId("template-mgr-title").textContent = t("templateMgrTitle");
  byId("inventory-title").textContent = t("inventoryTitle");
  byId("inventory-groups-title").textContent = t("inventoryGroupsTitle");
  byId("inventory-group-editor-title").textContent = t("inventoryGroupEditorTitle");
  byId("inventory-resolve-title").textContent = t("inventoryResolveTitle");
  byId("inventory-group-new-btn").textContent = t("newBtn");
  byId("inventory-group-save-btn").textContent = t("savedConnSaveBtn");
  byId("inventory-group-delete-btn").textContent = t("savedConnDeleteBtn");
  byId("inventory-resolve-btn").textContent = t("inventoryResolveBtn");
  byId("inventory-group-name-label").textContent = t("inventoryFieldName");
  byId("inventory-group-description-label").textContent = t("inventoryFieldDescription");
  byId("inventory-group-hosts-label").textContent = t("inventoryFieldHosts");
  byId("inventory-group-hosts-filter").placeholder = t("inventoryFieldHostsFilterPlaceholder");
  byId("inventory-group-hosts-select-all-btn").textContent = t("inventoryHostsSelectAllBtn");
  byId("inventory-group-hosts-clear-btn").textContent = t("inventoryHostsClearBtn");
  byId("inventory-group-hosts-empty").textContent = t("inventoryHostsEmpty");
  byId("inventory-group-vars-label").textContent = t("inventoryFieldVars");
  if (typeof renderInventoryGroupHosts === "function") {
    renderInventoryGroupHosts();
  }
  byId("inventory-resolve-host-label").textContent = t("inventoryResolveHostLabel");
  byId("inventory-resolve-groups-label").textContent = t("inventoryResolveGroupsLabel");
  byId("inventory-resolve-runtime-label").textContent = t("inventoryResolveRuntimeLabel");
  byId("inventory-resolve-hint").textContent = t("inventoryResolveHint");
  byId("inventory-group-description").placeholder = t("inventoryFieldDescriptionPlaceholder");
  byId("inventory-group-vars").placeholder = t("inventoryFieldVarsPlaceholder");
  byId("inventory-resolve-runtime").placeholder = t("inventoryFieldVarsPlaceholder");
  byId("transfer-title").textContent = t("transferTitle");
  byId("flow-vars-fields-title").textContent = t("flowVarsFieldsTitle");
  byId("flow-vars-fields-hint").textContent = t("flowVarsFieldsHint");
  byId("flow-vars-json-hint").textContent = t("flowVarsJsonHint");
  byId("upload-title").textContent = t("uploadTitle");
  byId("template-list-title").textContent = t("templateListTitle");
  byId("template-editor-title").textContent = t("templateEditorTitle");
  byId("flow-template-mgr-title").textContent = t("flowTemplateMgrTitle");
  byId("flow-template-manage-hint").textContent = t("flowTemplateManageHint");
  byId("flow-template-builtin-title").textContent = t("flowBuiltinTemplateTitle");
  byId("flow-template-builtin-detail-btn").textContent = t("builtinDetailBtn");
  byId("flow-template-builtin-copy-btn").textContent = t("builtinCopyBtn");
  byId("flow-template-builtin-hint").textContent = t("flowBuiltinTemplateHint");
  byId("blacklist-title").textContent = t("blacklistTitle");
  byId("blacklist-list-title").textContent = t("blacklistListTitle");
  byId("blacklist-add-title").textContent = t("blacklistAddTitle");
  byId("blacklist-check-title").textContent = t("blacklistCheckTitle");
  byId("blacklist-refresh-btn").textContent = t("blacklistRefreshBtn");
  byId("blacklist-add-btn").textContent = t("blacklistAddBtn");
  byId("blacklist-check-btn").textContent = t("blacklistCheckBtn");
  byId("blacklist-file-hint").textContent = t("blacklistFileHint");
  byId("blacklist-pattern").placeholder = t("blacklistPatternPlaceholder");
  byId("blacklist-pattern-hint").textContent = t("blacklistPatternHint");
  byId("blacklist-check-command").placeholder = t("blacklistCheckPlaceholder");
  byId("backup-title").textContent = t("backupTitle");
  byId("backup-create-title").textContent = t("backupCreateTitle");
  byId("backup-list-title").textContent = t("backupListTitle");
  byId("backup-output-path").placeholder = t("backupOutputPlaceholder");
  byId("backup-restore-archive").placeholder = t("backupArchivePlaceholder");
  byId("backup-create-btn").textContent = t("backupCreateBtn");
  byId("backup-refresh-btn").textContent = t("backupRefreshBtn");
  byId("backup-download-btn").textContent = t("backupDownloadBtn");
  byId("backup-restore-merge-btn").textContent = t("backupRestoreMergeBtn");
  byId("backup-restore-replace-btn").textContent = t("backupRestoreReplaceBtn");
  byId("tasks-title").textContent = t("tasksTitle");
  byId("tasks-filters-title").textContent = t("tasksFiltersTitle");
  byId("tasks-list-title").textContent = t("tasksListTitle");
  byId("tasks-detail-title").textContent = t("tasksDetailTitle");
  byId("tasks-refresh-btn").textContent = t("tasksRefreshBtn");
  byId("tasks-clear-btn").textContent = t("tasksClearBtn");
  byId("tasks-search").placeholder = t("tasksSearchPlaceholder");
  const currentTaskOperationValue = byId("tasks-operation").value || "";
  const currentTaskStatusValue = byId("tasks-status").value || "";
  const currentTaskOutcomeValue = byId("tasks-outcome").value || taskOutcomeFilter || "all";
  const currentTaskTimeRangeValue =
    byId("tasks-time-range").value || taskTimeRangeFilter || "all";
  const currentTaskRecordingValue =
    byId("tasks-recording").value || taskRecordingFilter || "all";
  const currentTaskErrorValue = byId("tasks-error").value || taskErrorFilter || "all";
  byId("tasks-operation").innerHTML = `
    <option value="">${escapeHtml(t("tasksOperationAll"))}</option>
    <option value="exec">exec</option>
    <option value="template">template</option>
    <option value="command_flow">command_flow</option>
    <option value="file_transfer">file_transfer</option>
    <option value="upload">upload</option>
    <option value="tx_block">tx_block</option>
    <option value="tx_workflow">tx_workflow</option>
    <option value="orchestration">orchestration</option>
  `;
  byId("tasks-operation").value = currentTaskOperationValue;
  byId("tasks-status").innerHTML = `
    <option value="">${escapeHtml(t("tasksStatusAll"))}</option>
    <option value="queued">queued</option>
    <option value="running">running</option>
    <option value="success">success</option>
    <option value="failed">failed</option>
  `;
  byId("tasks-status").value = currentTaskStatusValue;
  byId("tasks-outcome").innerHTML = `
    <option value="all">${escapeHtml(t("tasksOutcomeAll"))}</option>
    <option value="success">${escapeHtml(t("tasksOutcomeSuccess"))}</option>
    <option value="partial_success">${escapeHtml(t("tasksOutcomePartial"))}</option>
    <option value="failed">${escapeHtml(t("tasksOutcomeFailure"))}</option>
    <option value="none">${escapeHtml(t("tasksOutcomeNone"))}</option>
  `;
  byId("tasks-outcome").value = currentTaskOutcomeValue;
  byId("tasks-time-range").innerHTML = `
    <option value="all">${escapeHtml(t("tasksTimeRangeAll"))}</option>
    <option value="1h">${escapeHtml(t("tasksTimeRange1h"))}</option>
    <option value="6h">${escapeHtml(t("tasksTimeRange6h"))}</option>
    <option value="24h">${escapeHtml(t("tasksTimeRange24h"))}</option>
    <option value="7d">${escapeHtml(t("tasksTimeRange7d"))}</option>
  `;
  byId("tasks-time-range").value = currentTaskTimeRangeValue;
  byId("tasks-recording").innerHTML = `
    <option value="all">${escapeHtml(t("tasksRecordingAll"))}</option>
    <option value="yes">${escapeHtml(t("tasksRecordingYes"))}</option>
    <option value="no">${escapeHtml(t("tasksRecordingNo"))}</option>
  `;
  byId("tasks-recording").value = currentTaskRecordingValue;
  byId("tasks-error").innerHTML = `
    <option value="all">${escapeHtml(t("tasksErrorAll"))}</option>
    <option value="yes">${escapeHtml(t("tasksErrorYes"))}</option>
    <option value="no">${escapeHtml(t("tasksErrorNo"))}</option>
  `;
  byId("tasks-error").value = currentTaskErrorValue;
  byId("tasks-empty-state").textContent = t("tasksEmptyState");
  byId("tasks-detail-empty").textContent = t("tasksDetailEmpty");
  if (typeof renderTaskList === "function") {
    renderTaskList();
  }
  if (typeof renderTaskDetail === "function") {
    renderTaskDetail();
  }
  if (typeof renderInventoryConnectionOptions === "function") {
    renderInventoryConnectionOptions(byId("inventory-resolve-host")?.value || "");
  }
  if (typeof renderInventoryGroupOptions === "function") {
    renderInventoryGroupOptions(byId("inventory-group-picker")?.value || "");
  }
  if (typeof renderInventoryGroupList === "function") {
    renderInventoryGroupList();
  }

  byId("render-btn").textContent = t("renderBtn");
  byId("exec-btn").textContent = t("execBtn");
  byId("template-exec-btn").textContent = t("templateExecBtn");
  byId("template-exec-visual-title").textContent = t("templateExecVisualTitle");
  renderTemplateExecVisual();
  byId("recording-title").textContent = t("recordingTitle");
  byId("record-view-label").textContent = t("recordViewLabel");
  byId("record-view-list").textContent = t("viewList");
  byId("record-view-raw").textContent = t("viewRaw");
  byId("record-failed-only-label").textContent = t("failedOnly");
  byId("record-event-kind").setAttribute("aria-label", t("eventTypeLabel"));
  byId("record-search").placeholder = t("searchPlaceholder");
  byId("record-clear-filters").textContent = t("clearFilters");
  byId("record-copy-btn").textContent = t("recordCopyBtn");
  byId("record-use-replay-btn").textContent = t("recordUseReplayBtn");
  byId("replay-title").textContent = t("replayTitle");
  byId("replay-view-label").textContent = t("replayViewLabel");
  byId("replay-view-list").textContent = t("viewList");
  byId("replay-view-raw").textContent = t("viewRaw");
  byId("replay-failed-only-label").textContent = t("failedOnly");
  byId("replay-event-kind").setAttribute("aria-label", t("eventTypeLabel"));
  byId("replay-search").placeholder = t("searchPlaceholder");
  byId("replay-clear-filters").textContent = t("clearFilters");
  renderBlacklistList();
  renderBlacklistCheckResult();
  byId("replay-list-btn").textContent = t("replayListBtn");
  byId("replay-run-btn").textContent = t("replayRunBtn");
  byId("detail-modal-title").textContent = t("detailModalTitle");
  byId("detail-modal-close").textContent = t("detailModalClose");
  byId("entry-drawer-title").textContent = t("entryDrawerTitle");
  byId("entry-drawer-close").textContent = t("entryDrawerClose");
  byId("profile-save-btn").textContent = t("profileSaveBtn");
  byId("profile-new-btn").textContent = t("newBtn");
  byId("profile-delete-btn").textContent = t("profileDeleteBtn");
  byId("profile-diagnose-title").textContent = t("profileDiagnoseTitle");
  byId("profile-diagnose-btn").textContent = t("profileDiagnoseBtn");
  byId("profile-diagnose-result-title").textContent = t("profileDiagnoseResultTitle");
  byId("diag-k-total").textContent = t("diagTotalStates");
  byId("diag-k-graph").textContent = t("diagGraphStates");
  byId("diag-k-entry").textContent = t("diagEntryStates");
  byId("diag-k-issues").textContent = t("diagIssues");
  byId("diag-l-unreach").textContent = t("diagUnreachableStates");
  byId("diag-l-deadend").textContent = t("diagDeadEndStates");
  byId("diag-l-missing-src").textContent = t("diagMissingEdgeSources");
  byId("diag-l-missing-tgt").textContent = t("diagMissingEdgeTargets");
  byId("diag-l-ambiguous").textContent = t("diagAmbiguousPromptStates");
  const builtinCommandExecutionValue =
    byId("builtin-command-execution-mode").value ||
    normalizeCommandExecutionConfig(lastBuiltinProfile?.command_execution).mode;
  byId("builtin-detail-btn").textContent = t("builtinDetailBtn");
  byId("builtin-copy-btn").textContent = t("builtinCopyBtn");
  byId("builtin-command-execution-title").textContent = t("commandExecutionTitle");
  byId("builtin-command-execution-mode").innerHTML = `
    <option value="prompt_driven">${escapeHtml(t("commandExecutionModePromptDriven"))}</option>
    <option value="shell_exit_status">${escapeHtml(t("commandExecutionModeShellExitStatus"))}</option>
  `;
  byId("builtin-command-execution-mode").value = builtinCommandExecutionValue;
  byId("builtin-command-execution-marker").placeholder = t("commandExecutionMarkerPlaceholder");
  byId("template-save-btn").textContent = t("templateSaveBtn");
  byId("template-new-btn").textContent = t("newBtn");
  byId("template-delete-btn").textContent = t("templateDeleteBtn");
  byId("flow-exec-btn").textContent = t("flowExecBtn");
  byId("upload-exec-btn").textContent = t("uploadExecBtn");
  byId("upload-show-progress-label").textContent = t("uploadShowProgressLabel");
  byId("flow-template-new-btn").textContent = t("newBtn");
  byId("flow-template-save-btn").textContent = t("flowTemplateSaveBtn");
  byId("flow-template-delete-btn").textContent = t("flowTemplateDeleteBtn");
  byId("add-more-pattern-btn").textContent = t("addInlineBtn");
  byId("add-error-pattern-btn").textContent = t("addInlineBtn");
  byId("add-ignore-error-btn").textContent = t("addInlineBtn");
  byId("add-prompt-row-btn").textContent = t("addInlineBtn");
  byId("add-sys-prompt-row-btn").textContent = t("addInlineBtn");
  byId("add-interaction-row-btn").textContent = t("addInlineBtn");
  byId("add-transition-row-btn").textContent = t("addInlineBtn");
  byId("label-more-patterns").textContent = t("labelMorePatterns");
  byId("label-error-patterns").textContent = t("labelErrorPatterns");
  byId("label-ignore-errors").textContent = t("labelIgnoreErrors");
  const profileCommandExecutionValue =
    byId("profile-command-execution-mode").value ||
    normalizeCommandExecutionConfig(lastBuiltinProfile?.command_execution).mode;
  byId("label-command-execution").textContent = t("commandExecutionTitle");
  byId("label-prompts").textContent = t("labelPrompts");
  byId("label-sys-prompts").textContent = t("labelSysPrompts");
  byId("label-interactions").textContent = t("labelInteractions");
  byId("label-transitions").textContent = t("labelTransitions");
  byId("profile-command-execution-mode").innerHTML = `
    <option value="prompt_driven">${escapeHtml(t("commandExecutionModePromptDriven"))}</option>
    <option value="shell_exit_status">${escapeHtml(t("commandExecutionModeShellExitStatus"))}</option>
  `;
  byId("profile-command-execution-mode").value = profileCommandExecutionValue;
  byId("profile-command-execution-marker").placeholder = t("commandExecutionMarkerPlaceholder");

  byId("host").placeholder = t("hostPlaceholder");
  byId("port").placeholder = t("portPlaceholder");
  byId("username").placeholder = t("usernamePlaceholder");
  byId("password").placeholder = t("passwordPlaceholder");
  byId("enable_password").placeholder = t("enablePasswordPlaceholder");
  byId("ssh-security-option-default").textContent = t("sshSecurityOptionDefault");
  byId("ssh-security-option-secure").textContent = t("sshSecurityOptionSecure");
  byId("ssh-security-option-balanced").textContent = t("sshSecurityOptionBalanced");
  byId("ssh-security-option-legacy").textContent = t("sshSecurityOptionLegacy");
  byId("linux-shell-option-default").textContent = t("linuxShellOptionDefault");
  byId("linux-shell-option-posix").textContent = t("linuxShellOptionPosix");
  byId("linux-shell-option-fish").textContent = t("linuxShellOptionFish");
  byId("device_profile").placeholder = t("deviceProfilePlaceholder");
  byId("saved-conn-name").setAttribute("title", t("savedConnSelectPlaceholder"));
  byId("template").setAttribute("title", t("templatePlaceholder"));
  byId("template-selected-content").placeholder = t("templateSelectedContentPlaceholder");
  byId("tx-block-view-direct").textContent = t("txBlockViewDirect");
  byId("tx-block-view-template").textContent = t("txBlockViewTemplate");
  byId("tx-workflow-view-direct").textContent = t("txBlockViewDirect");
  byId("tx-workflow-view-template").textContent = t("txBlockViewTemplate");
  byId("tx-workflow-template-run-new-btn").textContent = t("newBtn");
  byId("tx-workflow-template-run-save-btn").textContent = t("templateSaveBtn");
  byId("tx-workflow-template-run-delete-btn").textContent = t("templateDeleteBtn");
  byId("tx-workflow-view-direct-hint").textContent = t("txWorkflowDirectHint");
  if (byId("tx-block-view-direct-hint")) {
    byId("tx-block-view-direct-hint").textContent = t("txBlockDirectHint");
  }
  if (byId("tx-block-direct-vars-form-title")) {
    byId("tx-block-direct-vars-form-title").textContent = t("txVarsFormTitle");
  }
  if (byId("tx-block-direct-vars-add-btn")) {
    byId("tx-block-direct-vars-add-btn").textContent = t("txVarsFormAddBtn");
  }
  if (byId("tx-block-direct-vars-sync-btn")) {
    byId("tx-block-direct-vars-sync-btn").textContent = t("txVarsFormSyncBtn");
  }
  if (byId("tx-block-direct-vars-clear-btn")) {
    byId("tx-block-direct-vars-clear-btn").textContent = t("txVarsFormClearBtn");
  }
  if (byId("tx-block-direct-vars")) {
    byId("tx-block-direct-vars").placeholder = t("txBlockDirectVarsPlaceholder");
  }
  if (byId("tx-block-direct-vars-hint")) {
    byId("tx-block-direct-vars-hint").textContent = t("txBlockDirectVarsHint");
  }
  if (byId("tx-block-template-vars-form-title")) {
    byId("tx-block-template-vars-form-title").textContent = t("txVarsFormTitle");
  }
  if (byId("tx-block-template-vars-add-btn")) {
    byId("tx-block-template-vars-add-btn").textContent = t("txVarsFormAddBtn");
  }
  if (byId("tx-block-template-vars-sync-btn")) {
    byId("tx-block-template-vars-sync-btn").textContent = t("txVarsFormSyncBtn");
  }
  if (byId("tx-block-template-vars-clear-btn")) {
    byId("tx-block-template-vars-clear-btn").textContent = t("txVarsFormClearBtn");
  }
  if (byId("tx-workflow-direct-vars-form-title")) {
    byId("tx-workflow-direct-vars-form-title").textContent = t("txVarsFormTitle");
  }
  if (byId("tx-workflow-direct-vars-add-btn")) {
    byId("tx-workflow-direct-vars-add-btn").textContent = t("txVarsFormAddBtn");
  }
  if (byId("tx-workflow-direct-vars-sync-btn")) {
    byId("tx-workflow-direct-vars-sync-btn").textContent = t("txVarsFormSyncBtn");
  }
  if (byId("tx-workflow-direct-vars-clear-btn")) {
    byId("tx-workflow-direct-vars-clear-btn").textContent = t("txVarsFormClearBtn");
  }
  if (byId("tx-workflow-template-vars-form-title")) {
    byId("tx-workflow-template-vars-form-title").textContent = t("txVarsFormTitle");
  }
  if (byId("tx-workflow-template-vars-add-btn")) {
    byId("tx-workflow-template-vars-add-btn").textContent = t("txVarsFormAddBtn");
  }
  if (byId("tx-workflow-template-vars-sync-btn")) {
    byId("tx-workflow-template-vars-sync-btn").textContent = t("txVarsFormSyncBtn");
  }
  if (byId("tx-workflow-template-vars-clear-btn")) {
    byId("tx-workflow-template-vars-clear-btn").textContent = t("txVarsFormClearBtn");
  }
  if (byId("orchestration-view-direct")) {
    byId("orchestration-view-direct").textContent = t("txBlockViewDirect");
  }
  if (byId("orchestration-view-template")) {
    byId("orchestration-view-template").textContent = t("txBlockViewTemplate");
  }
  if (byId("orchestration-view-direct-hint")) {
    byId("orchestration-view-direct-hint").textContent = t("orchestrationDirectHint");
  }
  if (byId("orchestration-template-run-new-btn")) {
    byId("orchestration-template-run-new-btn").textContent = t("newBtn");
  }
  if (byId("orchestration-template-run-save-btn")) {
    byId("orchestration-template-run-save-btn").textContent = t("templateSaveBtn");
  }
  if (byId("orchestration-template-run-delete-btn")) {
    byId("orchestration-template-run-delete-btn").textContent = t("templateDeleteBtn");
  }
  if (byId("orchestration-direct-vars-form-title")) {
    byId("orchestration-direct-vars-form-title").textContent = t("txVarsFormTitle");
  }
  if (byId("orchestration-direct-vars-add-btn")) {
    byId("orchestration-direct-vars-add-btn").textContent = t("txVarsFormAddBtn");
  }
  if (byId("orchestration-direct-vars-sync-btn")) {
    byId("orchestration-direct-vars-sync-btn").textContent = t("txVarsFormSyncBtn");
  }
  if (byId("orchestration-direct-vars-clear-btn")) {
    byId("orchestration-direct-vars-clear-btn").textContent = t("txVarsFormClearBtn");
  }
  if (byId("orchestration-template-vars-form-title")) {
    byId("orchestration-template-vars-form-title").textContent = t("txVarsFormTitle");
  }
  if (byId("orchestration-template-vars-add-btn")) {
    byId("orchestration-template-vars-add-btn").textContent = t("txVarsFormAddBtn");
  }
  if (byId("orchestration-template-vars-sync-btn")) {
    byId("orchestration-template-vars-sync-btn").textContent = t("txVarsFormSyncBtn");
  }
  if (byId("orchestration-template-vars-clear-btn")) {
    byId("orchestration-template-vars-clear-btn").textContent = t("txVarsFormClearBtn");
  }
  byId("tx-block-template-run-new-btn").textContent = t("newBtn");
  byId("tx-block-template-run-hint").textContent = t("txBlockTemplateRunHint");
  byId("tx-block-template-vars").placeholder = t("txBlockTemplateVarsPlaceholder");
  byId("tx-block-template-run-save-btn").textContent = t("templateSaveBtn");
  byId("tx-block-template-run-delete-btn").textContent = t("templateDeleteBtn");
  byId("tx-block-json-hint").textContent = t("txBlockJsonHint");
  byId("tx-block-json").placeholder = t("txBlockJsonPlaceholder");
  byId("tx-template-plan-btn").textContent = t("txPlanBtn");
  byId("tx-template-exec-btn").textContent = t("txExecBtn");
  byId("tx-block-editor-title").textContent = t("txBlockEditorTitle");
  byId("tx-block-editor-new-btn").textContent = t("newBtn");
  if (byId("tx-workflow-editor-bridge-title")) {
    byId("tx-workflow-editor-bridge-title").textContent = t(
      "txWorkflowEditorBridgeTitle"
    );
  }
  if (byId("tx-workflow-editor-cancel-btn")) {
    byId("tx-workflow-editor-cancel-btn").textContent = t("close");
  }
  byId("tx-plan-btn").textContent = t("txPlanBtn");
  byId("tx-exec-btn").textContent = t("txExecBtn");
  if (typeof rerenderTxVarsAssistants === "function") {
    rerenderTxVarsAssistants();
  }
  byId("tx-block-visual-title").textContent = t("txBlockVisualTitle");
  if (byId("tx-workflow-title")) {
    byId("tx-workflow-title").textContent = t("txWorkflowTitle");
  }
  byId("tx-workflow-template-run-hint").textContent =
    t("txWorkflowTemplateRunHint");
  byId("tx-workflow-json-new-btn").textContent = t("newBtn");
  byId("tx-workflow-import-file-btn").textContent = t("txWorkflowImportFileBtn");
  byId("tx-workflow-json").placeholder = t("txWorkflowJsonPlaceholder");
  byId("tx-workflow-vars-json").placeholder = t("txWorkflowVarsPlaceholder");
  byId("tx-workflow-template-vars-json").placeholder = t("txWorkflowVarsPlaceholder");
  byId("tx-workflow-vars-hint").textContent = t("txWorkflowVarsHint");
  byId("tx-workflow-plan-btn").textContent = t("txWorkflowPlanBtn");
  byId("tx-workflow-exec-btn").textContent = t("txWorkflowExecBtn");
  renderTxBlockVisual();
  byId("tx-workflow-visual-title").textContent = t("txWorkflowVisualTitle");
  renderTxWorkflowPreviewFromEditor();
  if (byId("orchestration-title")) {
    byId("orchestration-title").textContent = t("orchestrationTitle");
  }
  if (byId("orchestration-template-run-title")) {
    byId("orchestration-template-run-title").textContent =
      t("orchestrationTemplateRunTitle");
  }
  if (byId("orchestration-template-load-btn")) {
    byId("orchestration-template-load-btn").textContent =
      t("orchestrationTemplateLoadBtn");
  }
  if (byId("orchestration-template-run-hint")) {
    byId("orchestration-template-run-hint").textContent =
      t("orchestrationTemplateRunHint");
  }
  byId("orchestration-vars-json").placeholder = t("orchestrationVarsPlaceholder");
  if (byId("orchestration-template-vars-json")) {
    byId("orchestration-template-vars-json").placeholder = t("orchestrationVarsPlaceholder");
  }
  if (byId("orchestration-template-edit-hint")) {
    byId("orchestration-template-edit-hint").textContent = t("orchestrationTemplateEditHint");
  }
  if (byId("orchestration-editor-title")) {
    byId("orchestration-editor-title").textContent = t("orchestrationEditorTitle");
  }
  if (byId("orchestration-json-new-btn")) {
    byId("orchestration-json-new-btn").textContent = t("newBtn");
  }
  if (byId("orchestration-json-hint")) {
    byId("orchestration-json-hint").textContent = t("orchestrationJsonHint");
  }
  byId("orchestration-vars-hint").textContent = t("orchestrationVarsHint");
  byId("orchestration-json").placeholder = t("orchestrationJsonPlaceholder");
  byId("orchestration-plan-btn").textContent = t("orchestrationPlanBtn");
  byId("orchestration-exec-btn").textContent = t("orchestrationExecBtn");
  byId("orchestration-import-file-btn").textContent = t("orchestrationImportFileBtn");
  byId("orchestration-visual-title").textContent = t("orchestrationVisualTitle");
  if (lastOrchestrationPreview.plan) {
    renderOrchestrationPreview();
    renderOrchestrationResultPanel();
  } else {
    renderOrchestrationPreviewFromEditor();
  }
  byId("record-jsonl").placeholder = t("recordJsonlPlaceholder");
  byId("replay-jsonl").placeholder = t("replayJsonlPlaceholder");
  byId("replay-command").placeholder = t("replayCommandPlaceholder");
  byId("replay-mode").placeholder = t("replayModePlaceholder");
  byId("vars").placeholder = t("varsPlaceholder");
  byId("command").placeholder = t("commandPlaceholder");
  byId("mode").placeholder = t("modePlaceholder");
  byId("template-mode").placeholder = t("templateModePlaceholder");
  byId("custom-profile-picker").setAttribute("title", t("customProfileSelectPlaceholder"));
  byId("profile-diagnose-picker").setAttribute("title", t("profileDiagnoseSelectPlaceholder"));
  byId("builtin-detail-name").placeholder = t("builtinFieldName");
  byId("builtin-detail-aliases").placeholder = t("builtinFieldAliases");
  byId("builtin-detail-summary").placeholder = t("builtinFieldSummary");
  byId("builtin-detail-source").placeholder = t("builtinFieldSource");
  byId("builtin-detail-notes").placeholder = t("builtinFieldNotes");
  byId("template-pick-name").setAttribute("title", t("templateSelectPlaceholder"));
  byId("flow-template-name").setAttribute("title", t("flowTemplateRunPlaceholder"));
  byId("flow-vars-json").placeholder = t("flowVarsPlaceholder");
  byId("flow-hint").textContent = t("flowHint");
  byId("flow-template-picker").setAttribute("title", t("flowTemplateSelectPlaceholder"));
  byId("flow-template-builtin-picker").setAttribute(
    "title",
    t("flowBuiltinTemplateSelectPlaceholder")
  );
  byId("tx-block-template-name").setAttribute("title", t("templateSelectPlaceholder"));
  byId("tx-workflow-template-name").setAttribute(
    "title",
    t("templateSelectPlaceholder")
  );
  byId("orchestration-template-name").setAttribute(
    "title",
    t("templateSelectPlaceholder")
  );
  if (typeof renderSidebarConnectionSelector === "function") {
    renderSidebarConnectionSelector();
  }
  renderTemplateList();
  renderFlowTemplateOptions();
  renderFlowTemplateList();
  renderBuiltinFlowTemplateList();
  renderAllJsonTemplateOptions();
  renderAllJsonTemplateLists();
  renderCustomProfileOptions();
  renderDiagnoseProfileOptions();
  renderTemplateOptions();
  if (lastDiagnoseSnapshot) {
    renderDiagnoseResult(lastDiagnoseSnapshot.name, lastDiagnoseSnapshot.report);
  }
  byId("template-content").placeholder = t("templateContentPlaceholder");
  byId("upload-local-path").placeholder = t("uploadLocalPathPlaceholder");
  byId("upload-remote-path").placeholder = t("uploadRemotePathPlaceholder");
  byId("upload-timeout-secs").placeholder = t("uploadTimeoutPlaceholder");
  byId("upload-buffer-size").placeholder = t("uploadBufferSizePlaceholder");
  byId("upload-hint").textContent = t("uploadHint");
  byId("flow-template-content").placeholder = t("flowTemplateContentPlaceholder");
  byId("flow-template-builtin-content").placeholder =
    t("flowBuiltinTemplateContentPlaceholder");
  renderFlowTemplateVarFields(
    lastFlowRunTemplateDetail,
    getCurrentFlowTemplateFieldDraft()
  );
  byId("interactive-command").placeholder = t("interactiveCommandPlaceholder");
  byId("interactive-mode").placeholder = t("interactiveModePlaceholder");
  setEventKindOptions("record-event-kind", recordEventKind);
  setEventKindOptions("replay-event-kind", replayEventKind);
  localizeDynamicFields();
  renderRecordingView();
  renderReplayView();
  applyTxStage();
  applyPromptMode();
  applyTemplateSection();
  applyTxWorkflowMoreActionsState();
  updateBuiltinCommandExecutionVisibility();
  updateProfileCommandExecutionVisibility();
  updateSelectedBackupMeta();
  syncAgentAuthUi();

  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
}

function updateRecordLevelTooltip() {
  const level = normalizeRecordLevel(
    byId("record-level")?.value || byId("record-level-toggle-btn")?.dataset.level
  );
  const hint =
    level === "full" ? t("recordLevelFullHint") : t("recordLevelAuditHint");
  const toolbarToggle = byId("record-level-toggle-btn");
  const drawerSelect = byId("record-level");
  if (toolbarToggle) toolbarToggle.title = hint;
  if (drawerSelect) drawerSelect.title = hint;
}

function normalizeRecordLevel(level) {
  return String(level || "").trim() === "full" ? "full" : "key-events-only";
}

function syncRecordLevelToggleView(level, options = {}) {
  const normalized = normalizeRecordLevel(level);
  const updateSelect = options.updateSelect !== false;
  const drawerSelect = byId("record-level");
  if (updateSelect && drawerSelect) {
    drawerSelect.value = normalized;
  }
  const toggle = byId("record-level-toggle-btn");
  if (toggle) {
    toggle.dataset.level = normalized;
  }
  const valueLabel = byId("dashboard-tool-record-level-value");
  if (valueLabel) {
    valueLabel.textContent =
      normalized === "full" ? t("recordLevelFull") : t("recordLevelAudit");
  }
}

function localizeDynamicFields() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const key = el.getAttribute("data-i18n-ph");
    if (key) el.setAttribute("placeholder", t(key));
  });
  document.querySelectorAll(".collapse-btn").forEach((btn) => {
    const bodyId = btn.getAttribute("data-target");
    const body = bodyId ? byId(bodyId) : null;
    if (!body) return;
    btn.textContent = body.hidden ? t("expand") : t("collapse");
  });
}

function applyTabs() {
  const tabs = [
    "standard",
    "orchestrated",
    "interactive",
    "replay",
    "prompts",
    "templates",
    "inventory",
    "transfer",
    "blacklist",
    "backup",
    "tasks",
  ];
  for (const tab of tabs) {
    const button = byId(`tab-${tab}`);
    const panel = byId(`panel-${tab}`);
    const active = tab === currentTab;

    if (button) {
      if (active) {
        button.classList.add("menu-active");
        button.setAttribute("aria-selected", "true");
      } else {
        button.classList.remove("menu-active");
        button.setAttribute("aria-selected", "false");
      }
    }
    if (panel) {
      if (active) {
      panel.hidden = false;
      panel.style.display = "";
      } else {
      panel.hidden = true;
      panel.style.display = "none";
      }
    }
  }

  try {
    if (window.Alpine && typeof window.Alpine.store === "function") {
      const appStore = window.Alpine.store("app");
      if (appStore) {
        if (typeof appStore.syncFromGlobals === "function") {
          appStore.syncFromGlobals();
        } else if (appStore.currentTab !== currentTab) {
          appStore.currentTab = currentTab;
        }
      }
    }
  } catch (_) {
    // Alpine store is optional during the migration period.
  }
}

function setInteractiveStatus(text, tone = null) {
  const el = byId("interactive-status");
  if (!el) return;
  if (tone) {
    el.innerHTML = renderStatusMessageCard(text, tone);
    return;
  }
  el.textContent = text;
}

function updateInteractiveButtons() {
  const active = !!interactiveSessionId;
  const startBtn = byId("interactive-start-btn");
  const stopBtn = byId("interactive-stop-btn");
  const sendBtn = byId("interactive-send-btn");
  if (startBtn) startBtn.disabled = active;
  if (stopBtn) stopBtn.disabled = !active;
  if (sendBtn) sendBtn.disabled = !active;
}

function isDeviceSelected() {
  const host = byId("host").value.trim();
  const saved = byId("saved-conn-name").value.trim();
  const profile = byId("device_profile").value.trim();
  return !!(host || saved || profile);
}

function hasSelectedConnectionTarget() {
  if (currentConnectionTarget && currentConnectionTarget.kind !== "none") {
    return true;
  }
  const saved = safeString(byId("saved-conn-name")?.value || "").trim();
  if (saved) return true;
  const host = safeString(byId("host")?.value || "").trim();
  return !!host;
}

function ensureConnectionTargetSelected(statusId = "", outputId = "") {
  if (hasSelectedConnectionTarget()) return true;
  const message = t("connectionTargetRequired");
  if (statusId) {
    setStatusMessage(statusId, message, "warning");
  } else {
    showToast(message, "warning");
  }
  if (outputId) {
    const out = byId(outputId);
    if (out) {
      out.innerHTML = renderStatusMessageCard(message, "warning");
    }
  }
  try {
    if (window.Alpine && typeof window.Alpine.store === "function") {
      const appStore = window.Alpine.store("app");
      if (appStore && typeof appStore.openConnectionModal === "function") {
        appStore.openConnectionModal();
      }
    }
  } catch (_) {}
  return false;
}

function updateRecordFabVisibility() {
  const button = byId("record-fab");
  if (!button) return;
  button.disabled = false;
}

function updateRecordFabBadge(count) {
  const badge = byId("record-fab-badge");
  if (!badge) return;
  const value = Number(count) || 0;
  if (value <= 0) {
    badge.hidden = true;
    badge.style.display = "none";
    return;
  }
  badge.hidden = false;
  badge.style.display = "flex";
  badge.textContent = value > 99 ? "99+" : String(value);
}

function openRecordDrawer() {
  const backdrop = byId("record-drawer-backdrop");
  const drawer = byId("record-drawer");
  backdrop.classList.add("open");
  drawer.classList.add("open");
  document.body.classList.add("overflow-hidden");
}

function closeRecordDrawer() {
  const backdrop = byId("record-drawer-backdrop");
  const drawer = byId("record-drawer");
  backdrop.classList.remove("open");
  drawer.classList.remove("open");
  document.body.classList.remove("overflow-hidden");
}

function openHistoryDrawer() {
  const backdrop = byId("history-drawer-backdrop");
  const drawer = byId("history-drawer");
  backdrop.classList.add("open");
  drawer.classList.add("open");
  document.body.classList.add("overflow-hidden");
}

function closeHistoryDrawer() {
  const backdrop = byId("history-drawer-backdrop");
  const drawer = byId("history-drawer");
  backdrop.classList.remove("open");
  drawer.classList.remove("open");
  document.body.classList.remove("overflow-hidden");
}

function appendInteractiveLog(label, content) {
  const out = byId("interactive-out");
  if (!out) return;
  const ts = new Date().toLocaleTimeString();
  const prefix = label ? `${label}` : "output";
  out.textContent += `[${ts}] ${prefix}\n${content}\n\n`;
  out.scrollTop = out.scrollHeight;
}

function applyOperationKind() {
  if (currentOpKind === "tx") {
    applyTxStage();
  }
  if (currentOpKind === "exec") {
    applyExecMode();
  }
  try {
    if (window.Alpine && typeof window.Alpine.store === "function") {
      const appStore = window.Alpine.store("app");
      if (appStore && appStore.currentOpKind !== currentOpKind) {
        appStore.currentOpKind = currentOpKind;
      }
    }
  } catch (_) {}
}

function applyExecMode() {
  const isDirect = currentExecMode === "direct";
  const isTemplate = currentExecMode === "template";
  const isFlow = currentExecMode === "flow";
  byId("op-exec-direct-fields").hidden = !isDirect;
  byId("op-exec-direct-fields").style.display = isDirect ? "" : "none";
  byId("op-exec-template-fields").hidden = !isTemplate;
  byId("op-exec-template-fields").style.display = isTemplate ? "" : "none";
  byId("op-exec-flow-fields").hidden = !isFlow;
  byId("op-exec-flow-fields").style.display = isFlow ? "" : "none";
  if (isTemplate && byId("template").value.trim()) {
    loadSelectedTemplateContent();
  }
  try {
    if (window.Alpine && typeof window.Alpine.store === "function") {
      const appStore = window.Alpine.store("app");
      if (appStore && appStore.currentExecMode !== currentExecMode) {
        appStore.currentExecMode = currentExecMode;
      }
    }
  } catch (_) {}
}

function applyTxStage() {
  const isBlock = currentTxStage === "block";
  const isWorkflow = currentTxStage === "workflow";
  const isOrchestrate = currentTxStage === "orchestrate";
  const blockPanel = byId("tx-stage-block-panel");
  const workflowPanel = byId("tx-stage-workflow-panel");
  const orchestratePanel = byId("tx-stage-orchestrate-panel");
  const hint = byId("tx-stage-hint");
  const title = byId("orchestrated-title");
  blockPanel.hidden = !isBlock;
  blockPanel.style.display = isBlock ? "" : "none";
  workflowPanel.hidden = !isWorkflow;
  workflowPanel.style.display = isWorkflow ? "" : "none";
  orchestratePanel.hidden = !isOrchestrate;
  orchestratePanel.style.display = isOrchestrate ? "" : "none";
  if (hint) {
    hint.textContent = isBlock
      ? t("txStageHintBlock")
      : isWorkflow
        ? t("txStageHintWorkflow")
        : t("txStageHintOrchestrate");
  }
  if (title) {
    title.textContent = currentOrchestratedStageTitle();
  }
  if (isBlock || isWorkflow) {
    applyTxBlockViewMode();
  }
  if (isWorkflow) {
    applyTxWorkflowViewMode();
  }
  if (isOrchestrate) {
    applyOrchestrationViewMode();
  }
  if (byId("tx-block-editor-new-btn")) {
    byId("tx-block-editor-new-btn").textContent = isWorkflow
      ? t("txWorkflowAddBlockBtn")
      : t("newBtn");
  }
  if (!isWorkflow && txWorkflowEditorModalOpen) {
    hideTxWorkflowEditorModal({ clearSelection: true });
  }
  if (typeof syncTxSharedEditorMount === "function") {
    syncTxSharedEditorMount();
  }
  try {
    if (window.Alpine && typeof window.Alpine.store === "function") {
      const appStore = window.Alpine.store("app");
      if (appStore && appStore.currentTxStage !== currentTxStage) {
        appStore.currentTxStage = currentTxStage;
      }
    }
  } catch (_) {}
}

function applyTxWorkflowViewMode() {
  const modes = ["direct", "template"];
  modes.forEach((mode) => {
    const btn = byId(`tx-workflow-view-${mode}`);
    const panel = byId(`tx-workflow-view-${mode}-panel`);
    const active = txWorkflowViewMode === mode;
    if (btn) {
      btn.classList.toggle("tab-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    }
    if (panel) {
      panel.hidden = !active;
      panel.style.display = active ? "" : "none";
    }
  });
  if (txWorkflowViewMode === "direct" && typeof resizeTxWorkflowJsonEditor === "function") {
    window.requestAnimationFrame(() => {
      resizeTxWorkflowJsonEditor();
    });
  }
}

function applyTxBlockViewMode() {
  const modes = ["direct", "template"];
  modes.forEach((mode) => {
    const btn = byId(`tx-block-view-${mode}`);
    const panel = byId(`tx-block-view-${mode}-panel`);
    const active = txBlockViewMode === mode;
    if (btn) {
      btn.classList.toggle("tab-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    }
    if (panel) {
      panel.hidden = !active;
      panel.style.display = active ? "" : "none";
    }
  });
  const showRunPanels = currentTxStage === "block";
  const runDirect = byId("tx-block-run-direct-panel");
  const runTemplate = byId("tx-block-run-template-panel");
  if (runDirect) {
    const active = showRunPanels && txBlockViewMode === "direct";
    runDirect.hidden = !active;
    runDirect.style.display = active ? "" : "none";
  }
  if (runTemplate) {
    const active = showRunPanels && txBlockViewMode === "template";
    runTemplate.hidden = !active;
    runTemplate.style.display = active ? "" : "none";
  }
}

function applyOrchestrationViewMode() {
  const modes = ["direct", "template"];
  modes.forEach((mode) => {
    const btn = byId(`orchestration-view-${mode}`);
    const panel = byId(`orchestration-view-${mode}-panel`);
    const active = orchestrationViewMode === mode;
    if (btn) {
      btn.classList.toggle("tab-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    }
    if (panel) {
      panel.hidden = !active;
      panel.style.display = active ? "" : "none";
    }
  });
  if (typeof resizeOrchestrationJsonEditor === "function") {
    window.requestAnimationFrame(() => {
      resizeOrchestrationJsonEditor();
    });
  }
}

function applyTxWorkflowMoreActionsState() {
  const btn = byId("tx-workflow-more-btn");
  const panel = byId("tx-workflow-more-panel");
  if (!btn || !panel) return;
  panel.hidden = !txWorkflowMoreExpanded;
  panel.style.display = txWorkflowMoreExpanded ? "" : "none";
  btn.textContent = txWorkflowMoreExpanded
    ? `${t("txWorkflowMoreBtn")} · ${t("collapse")}`
    : `${t("txWorkflowMoreBtn")} · ${t("expand")}`;
}

function applyPromptMode() {
  const modes = ["view", "edit", "diagnose"];
  for (const mode of modes) {
    const panel = byId(`prompt-${mode}-panel`);
    const active = mode === currentPromptMode;
    panel.hidden = !active;
    panel.style.display = active ? "" : "none";
  }
  try {
    if (window.Alpine && typeof window.Alpine.store === "function") {
      const appStore = window.Alpine.store("app");
      if (appStore && appStore.currentPromptMode !== currentPromptMode) {
        appStore.currentPromptMode = currentPromptMode;
      }
    }
  } catch (_) {}
}

function applyTemplateSection() {
  const sections = ["templates", "flows"];
  if (!sections.includes(currentTemplateSection)) {
    currentTemplateSection = "templates";
  }
  const panelBySection = {
    templates: byId("template-library-section"),
    flows: byId("template-flows-section"),
  };
  sections.forEach((section) => {
    const panel = panelBySection[section];
    if (!panel) return;
    const active = currentTemplateSection === section;
    panel.hidden = !active;
    panel.style.display = active ? "" : "none";
  });
  try {
    if (window.Alpine && typeof window.Alpine.store === "function") {
      const appStore = window.Alpine.store("app");
      if (appStore && appStore.currentTemplateSection !== currentTemplateSection) {
        appStore.currentTemplateSection = currentTemplateSection;
      }
    }
  } catch (_) {}
}

function applyInventorySection() {
  const isGroups = currentInventorySection === "groups";
  const groupsPanel = byId("inventory-groups-section");
  const resolvePanel = byId("inventory-resolve-section");
  if (groupsPanel) {
    groupsPanel.hidden = !isGroups;
    groupsPanel.style.display = isGroups ? "" : "none";
  }
  if (resolvePanel) {
    resolvePanel.hidden = isGroups;
    resolvePanel.style.display = isGroups ? "none" : "";
  }
  try {
    if (window.Alpine && typeof window.Alpine.store === "function") {
      const appStore = window.Alpine.store("app");
      if (appStore && appStore.currentInventorySection !== currentInventorySection) {
        appStore.currentInventorySection = currentInventorySection;
      }
    }
  } catch (_) {}
}

async function loadSelectedTemplateContent() {
  const name = byId("template").value.trim();
  const preview = byId("template-selected-content");
  const out = byId("render-out");
  if (!name) {
    preview.value = "";
    return;
  }
  try {
    const data = await request("GET", `/api/templates/${encodeURIComponent(name)}`);
    preview.value = data.content || "";
  } catch (e) {
    preview.value = "";
    out.innerHTML = renderStatusMessageCard(e.message, "error");
  }
}

function connectionPayload() {
  const value = (id) => byId(id).value.trim();
  const rawPort = value("port");
  const parsedPort = rawPort ? Number(rawPort) : 22;
  const connectionName = value("saved-conn-name");
  return {
    connection_name: connectionName || null,
    host: value("host") || null,
    port: Number.isFinite(parsedPort) ? parsedPort : 22,
    username: value("username") || null,
    password: value("password") || null,
    enable_password: value("enable_password") || null,
    ssh_security: value("ssh_security") || null,
    linux_shell_flavor: value("linux_shell_flavor") || null,
    device_profile: value("device_profile") || null,
    enabled: !!byId("saved-conn-enabled")?.checked,
    labels: splitCsvValues(byId("saved-conn-labels")?.value || ""),
    groups: getMultiSelectValues("saved-conn-groups"),
    vars: parseJsonById("saved-conn-vars"),
  };
}

function recordLevelPayload() {
  return normalizeRecordLevel(
    byId("record-level")?.value || byId("record-level-toggle-btn")?.dataset.level
  );
}

const INLINE_STATUS_TARGETS = new Set([
  "connection-test-out",
  "tx-plan-out",
  "tx-exec-out",
  "tx-workflow-plan-out",
  "tx-workflow-exec-out",
  "orchestration-plan-out",
  "orchestration-exec-out",
  "flow-out",
  "upload-out",
  "profile-diagnose-out",
  "builtin-detail-status",
]);

let toastSequence = 0;

function isPassiveLoadedStatus(message, tone) {
  if (tone !== "info" && tone !== "success") return false;
  const text = safeString(message || "").trim();
  const loadedPrefix = safeString(t("loaded")).trim();
  if (!text || !loadedPrefix) return false;
  return text === loadedPrefix || text.startsWith(`${loadedPrefix}:`);
}

function shouldToastStatus(message, tone) {
  const text = safeString(message || "").trim();
  if (!text || text === "-") return false;
  if (isPassiveLoadedStatus(text, tone)) return false;
  return tone === "success" || tone === "error" || tone === "warning";
}

function shouldRenderInlineStatus(id, message, tone) {
  const text = safeString(message || "").trim();
  if (!text || text === "-") return false;
  if (isPassiveLoadedStatus(text, tone)) return false;
  if (tone === "running") return true;
  return INLINE_STATUS_TARGETS.has(id);
}

function showToast(message, tone = "info") {
  const stack = byId("toast-stack");
  if (!stack || !shouldToastStatus(message, tone)) return;
  const toastId = `toast-${++toastSequence}`;
  const item = document.createElement("div");
  item.dataset.toastId = toastId;
  item.innerHTML = renderStatusToast(message, tone);
  const toastEl = item.firstElementChild;
  if (!toastEl) return;
  const closeBtn = toastEl.querySelector(".js-toast-close");
  const dismiss = () => {
    toastEl.remove();
  };
  if (closeBtn) {
    closeBtn.onclick = dismiss;
  }
  stack.appendChild(toastEl);
  window.setTimeout(dismiss, tone === "error" ? 6500 : 3200);
}

function setStatusMessage(id, message, tone = "info") {
  const el = byId(id);
  if (!el) return;
  if (isPassiveLoadedStatus(message, tone)) {
    el.innerHTML = "";
    return;
  }
  if (shouldRenderInlineStatus(id, message, tone)) {
    el.innerHTML = renderStatusMessageCard(message, tone);
  } else {
    el.innerHTML = "";
  }
  showToast(message, tone);
}

function flowVarTypeLabel(kind) {
  switch (safeString(kind).trim()) {
    case "secret":
      return t("flowVarTypeSecret");
    case "number":
      return t("flowVarTypeNumber");
    case "boolean":
      return t("flowVarTypeBoolean");
    case "json":
      return t("flowVarTypeJson");
    case "string":
    default:
      return t("flowVarTypeString");
  }
}

function normalizeFlowTemplateVarSchema(item) {
  if (!item || !safeString(item.name).trim()) return null;
  const kind = safeString(item.type || item.kind || "string")
    .trim()
    .toLowerCase();
  return {
    name: safeString(item.name).trim(),
    label: safeString(item.label || item.name).trim() || safeString(item.name).trim(),
    description: safeString(item.description).trim() || "",
    kind: kind || "string",
    required: !!item.required,
    placeholder: safeString(item.placeholder).trim(),
    options: Array.isArray(item.options)
      ? item.options.map((value) => safeString(value)).filter(Boolean)
      : [],
    defaultValue:
      item.default !== undefined ? item.default : item.default_value,
  };
}

function getFlowRunVarsSchema(detail = lastFlowRunTemplateDetail) {
  if (!detail || !Array.isArray(detail.vars_schema)) return [];
  return detail.vars_schema
    .map(normalizeFlowTemplateVarSchema)
    .filter(Boolean);
}

function defaultFlowVarDraft(field) {
  if (!field || field.defaultValue === undefined || field.defaultValue === null) {
    return "";
  }
  if (field.kind === "boolean") {
    if (field.defaultValue === true) return "true";
    if (field.defaultValue === false) return "false";
    return "";
  }
  if (field.kind === "json") {
    try {
      return JSON.stringify(field.defaultValue, null, 2);
    } catch (_) {
      return "";
    }
  }
  return safeString(field.defaultValue);
}

function getCurrentFlowTemplateFieldDraft() {
  const container = byId("flow-vars-fields");
  if (!container) return {};
  const draft = {};
  container.querySelectorAll("[data-flow-var-name]").forEach((el) => {
    const name = safeString(el.getAttribute("data-flow-var-name")).trim();
    if (!name) return;
    draft[name] = el.value;
  });
  return draft;
}

async function ensureFlowRunTemplateDetail(templateName, options = {}) {
  const name = safeString(templateName).trim();
  if (!name) {
    renderFlowTemplateVarFields(null, {});
    return null;
  }
  if (
    lastFlowRunTemplateDetail &&
    safeString(lastFlowRunTemplateDetail.__selection_key || "").trim() === name
  ) {
    return lastFlowRunTemplateDetail;
  }
  try {
    const builtinName = parseBuiltinFlowTemplateValue(name);
    const endpoint = builtinName
      ? `/api/flow-templates/builtins/${encodeURIComponent(builtinName)}`
      : `/api/flow-templates/${encodeURIComponent(name)}`;
    const data = await request("GET", endpoint);
    if (data && typeof data === "object") {
      data.__selection_key = name;
    }
    lastFlowRunTemplateDetail = data;
    renderFlowTemplateVarFields(data, {});
    return data;
  } catch (e) {
    if (!options.silent) {
      renderFlowTemplateVarFieldsError(e.message);
    } else {
      renderFlowTemplateVarFields(null, {});
    }
    throw e;
  }
}

function flowVarRequiredMessage(label) {
  return currentLang === "zh"
    ? `${label}${t("flowVarRequiredSuffix")}`
    : `${label} ${t("flowVarRequiredSuffix")}`;
}

function collectFlowTemplateFieldValues() {
  const values = {};
  for (const field of getFlowRunVarsSchema()) {
    const el = byId(`flow-var-${field.name}`);
    if (!el) continue;
    const raw = safeString(el.value);
    const isBlank = raw.trim() === "";
    const hasDefault =
      field.defaultValue !== undefined && field.defaultValue !== null;

    if (field.kind === "json") {
      if (isBlank) {
        if (field.required && !hasDefault) {
          throw new Error(flowVarRequiredMessage(field.label));
        }
        continue;
      }
      try {
        values[field.name] = JSON.parse(raw);
      } catch (_) {
        throw new Error(`${field.label} ${t("flowVarJsonInvalid")}`);
      }
      continue;
    }

    if (field.kind === "boolean") {
      if (isBlank) {
        if (field.required && !hasDefault) {
          throw new Error(flowVarRequiredMessage(field.label));
        }
        continue;
      }
      values[field.name] = raw === "true";
      continue;
    }

    if (isBlank) {
      if (field.required && !hasDefault) {
        throw new Error(flowVarRequiredMessage(field.label));
      }
      continue;
    }

    if (field.kind === "number") {
      const parsed = Number(raw);
      if (Number.isNaN(parsed)) {
        throw new Error(`${field.label} ${t("flowVarNumberInvalid")}`);
      }
      values[field.name] = parsed;
      continue;
    }

    values[field.name] = raw;
  }
  return values;
}

function parseFlowVarsJsonOverrides() {
  const rawVars = (byId("flow-vars-json").value || "").trim();
  if (!rawVars) {
    return {};
  }
  const parsed = JSON.parse(rawVars);
  if (parsed == null) {
    return {};
  }
  if (Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(t("flowVarsObjectRequired"));
  }
  return parsed;
}

function buildFlowVarsPayload() {
  const overrideVars = parseFlowVarsJsonOverrides();
  const fieldVars = collectFlowTemplateFieldValues();
  const merged = { ...overrideVars, ...fieldVars };
  return Object.keys(merged).length ? merged : null;
}

function renderTemplateExecVisual() {
  const visualOut = byId("template-exec-visual");
  if (!visualOut) return;
  if (!lastTemplateExecResult) {
    visualOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("templateExecVisualEmpty")
    )}</div>`;
    return;
  }
  visualOut.innerHTML = renderTemplateExecuteResult(lastTemplateExecResult);
}

function renderTxBlockVisual() {
  const visualOut = byId("tx-block-visual");
  if (!visualOut) return;
  visualOut.innerHTML = renderTxBlockPreview(
    lastTxBlockPreview.txBlock,
    lastTxBlockPreview.txResult
  );
}

function setTxBlockVisual(txBlock, txResult) {
  lastTxBlockPreview = {
    txBlock: txBlock || null,
    txResult: txResult || null,
  };
  renderTxBlockVisual();
}

function setTxWorkflowPreview(workflow) {
  const visualOut = byId("tx-workflow-plan-visual");
  if (!visualOut) return;
  visualOut.innerHTML = renderTxWorkflowPreview(workflow || {});
}

function renderTxWorkflowPreviewFromEditor() {
  const visualOut = byId("tx-workflow-plan-visual");
  if (!visualOut) return;
  const raw =
    typeof txWorkflowEditorRaw === "function"
      ? txWorkflowEditorRaw().trim()
      : byId("tx-workflow-json").value.trim();
  if (!raw) {
    visualOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowVisualEmpty")
    )}</div>`;
    return;
  }
  try {
    const workflow = JSON.parse(raw);
    setTxWorkflowPreview(workflow);
  } catch (e) {
    visualOut.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      `${t("txWorkflowVisualInvalid")}: ${e.message || t("requestFailed")}`
    )}</div>`;
  }
}

function rememberOrchestrationDetail(detail) {
  orchestrationDetailSeq += 1;
  const id = `orch-${orchestrationDetailSeq}`;
  orchestrationDetailMap.set(id, detail);
  return id;
}

function setOrchestrationPreview(plan, inventory, result = null) {
  lastOrchestrationPreview = {
    plan: plan || null,
    inventory: inventory || null,
    result: result || null,
  };
  renderOrchestrationPreview();
}

function renderOrchestrationPreview() {
  const visualOut = byId("orchestration-visual");
  if (!visualOut) return;
  visualOut.innerHTML = renderOrchestrationPreviewHtml(
    lastOrchestrationPreview.plan,
    lastOrchestrationPreview.inventory
  );
}

function renderOrchestrationPreviewFromEditor() {
  const visualOut = byId("orchestration-visual");
  if (!visualOut) return;
  const raw =
    typeof orchestrationEditorRaw === "function"
      ? orchestrationEditorRaw().trim()
      : byId("orchestration-json").value.trim();
  if (!raw) {
    visualOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("orchestrationVisualEmpty")
    )}</div>`;
    return;
  }
  try {
    const plan = JSON.parse(raw);
    setOrchestrationPreview(plan, plan.inventory || null, null);
  } catch (e) {
    visualOut.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      `${t("orchestrationVisualInvalid")}: ${e.message || t("requestFailed")}`
    )}</div>`;
  }
}

function openOrchestrationDetail(detail) {
  if (!detail || typeof detail !== "object") return;
  const isStage = detail.kind === "stage";
  openDetailModal(
    isStage
      ? renderOrchestrationStageDetail(detail)
      : renderOrchestrationTargetDetail(detail),
    {
      title: isStage
        ? t("orchestrationStageDetailTitle")
        : t("orchestrationTargetDetailTitle"),
      html: true,
    }
  );
}

function renderOrchestrationResultPanel() {
  const out = byId("orchestration-exec-out");
  if (!out || !lastOrchestrationPreview.result) return;
  out.innerHTML = renderOrchestrationResult(lastOrchestrationPreview.result);
}

function renderRecordingView() {
  const listOut = byId("record-list-out");
  const rawOut = byId("record-jsonl");
  const listBtn = byId("record-view-list");
  const rawBtn = byId("record-view-raw");
  const isList = recordViewMode === "list";
  listBtn.classList.toggle("tab-active", isList);
  rawBtn.classList.toggle("tab-active", !isList);
  setPanelVisible(listOut, isList, "grid");
  setPanelVisible(rawOut, !isList, "block");

  const parsed = parseJsonl(rawOut.value || "");
  if (!parsed.ok) {
    listOut.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      parsed.error
    )}</div>`;
    updateRecordFabBadge(0);
    return;
  }
  const entries = filterEntries(parsed.rows, recordEventKind, recordFailedOnly, recordSearchQuery);
  updateRecordFabBadge(entries.length);
  if (!isList) {
    return;
  }
  if (!entries.length) {
    listOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      recordFailedOnly
        ? t("noFailedEntries")
        : recordEventKind !== "all"
          ? t("noMatchedEntries")
          : t("recordListEmpty")
    )}</div>`;
    return;
  }
  const stats = buildEventStats(entries);
  listOut.innerHTML = `${renderStatsCards(stats)}${renderEntriesTable(entries)}`;
}

function applyRecordingFromResponse(data) {
  const jsonl = data && data.recording_jsonl ? String(data.recording_jsonl) : "";
  if (jsonl) {
    byId("record-jsonl").value = jsonl;
    renderRecordingView();
  }
}

function applyConnectionForm(connection = {}) {
  byId("host").value = safeString(connection.host || "");
  const port = Number(connection.port);
  byId("port").value = Number.isFinite(port) && port > 0 ? String(port) : "";
  byId("username").value = safeString(connection.username || "");
  byId("password").value = "";
  byId("enable_password").value = "";
  byId("ssh_security").value = safeString(connection.ssh_security || "");
  byId("linux_shell_flavor").value = safeString(connection.linux_shell_flavor || "");
  byId("device_profile").value = safeString(connection.device_profile || "");
  if (byId("saved-conn-enabled")) {
    byId("saved-conn-enabled").checked = connection.enabled !== false;
  }
  if (byId("saved-conn-labels")) {
    byId("saved-conn-labels").value = Array.isArray(connection.labels)
      ? connection.labels.join(", ")
      : "";
  }
  if (typeof renderSavedConnectionGroupOptions === "function") {
    renderSavedConnectionGroupOptions(Array.isArray(connection.groups) ? connection.groups : []);
  }
  if (byId("saved-conn-vars")) {
    byId("saved-conn-vars").value = JSON.stringify(connection.vars || {}, null, 2);
  }
  if (byId("saved-conn-save-password")) {
    byId("saved-conn-save-password").checked = !!(
      connection.has_password === false && connection.has_enable_password === false
    );
  }
  if (typeof renderSidebarConnectionSelector === "function") {
    renderSidebarConnectionSelector();
  }
}

function initAutocomplete(inputId, sourceFn) {
  const input = byId(inputId);
  if (!input) return;

  const menu = document.createElement("div");
  menu.className = "autocomplete-menu";
  menu.hidden = true;
  document.body.appendChild(menu);
  autocompleteMenus.push(menu);

  let items = [];
  let activeIndex = -1;

  const hide = () => {
    menu.hidden = true;
    menu.style.display = "none";
    activeIndex = -1;
  };

  const position = () => {
    const rect = input.getBoundingClientRect();
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.top = `${rect.bottom + window.scrollY + 6}px`;
    menu.style.width = `${rect.width}px`;
  };

  const render = () => {
    const all = Array.from(new Set((sourceFn() || []).filter(Boolean)));
    const q = input.value.trim().toLowerCase();
    items = all.filter((name) => (!q ? true : name.toLowerCase().includes(q))).slice(0, 24);
    if (items.length === 0) {
      hide();
      return;
    }
    menu.innerHTML = "";
    items.forEach((name, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = idx === activeIndex ? "autocomplete-item is-active" : "autocomplete-item";
      btn.setAttribute("data-idx", String(idx));
      btn.textContent = name;
      menu.appendChild(btn);
    });
    position();
    menu.hidden = false;
    menu.style.display = "";
  };

  const applyActive = () => {
    menu.querySelectorAll(".autocomplete-item").forEach((node, idx) => {
      if (idx === activeIndex) node.classList.add("is-active");
      else node.classList.remove("is-active");
    });
  };

  const selectByIndex = (idx) => {
    if (idx < 0 || idx >= items.length) return;
    input.value = items[idx];
    hide();
    input.dispatchEvent(new Event("change"));
  };

  input.addEventListener("focus", () => {
    activeIndex = -1;
    render();
  });
  input.addEventListener("input", () => {
    activeIndex = -1;
    render();
  });
  input.addEventListener("keydown", (e) => {
    if (menu.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      activeIndex = 0;
      render();
      e.preventDefault();
      return;
    }
    if (menu.hidden) return;

    if (e.key === "ArrowDown") {
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      applyActive();
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowUp") {
      activeIndex = Math.max(activeIndex - 1, 0);
      applyActive();
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" && activeIndex >= 0) {
      selectByIndex(activeIndex);
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      hide();
      e.preventDefault();
    }
  });
  input.addEventListener("blur", () => {
    setTimeout(hide, 120);
  });

  menu.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });
  menu.addEventListener("click", (e) => {
    const btn = e.target.closest(".autocomplete-item");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-idx"));
    selectByIndex(idx);
  });

  window.addEventListener("resize", () => {
    if (!menu.hidden) position();
  });
  window.addEventListener(
    "scroll",
    () => {
      if (!menu.hidden) position();
    },
    true
  );
}

function initTopLevelAutocomplete() {
  initAutocomplete("device_profile", () => cachedDeviceProfiles);
  initAutocomplete("template", () => cachedTemplates);
}

function initCollapsibleGroups() {
  document.querySelectorAll(".group-card").forEach((card) => {
    let head = card.querySelector(":scope > .field-tools");
    if (!head) {
      head = card.querySelector(":scope > div");
    }
    const body = card.querySelector(".group-body");
    if (!head || !body || !body.id) return;
    if (head.querySelector(".collapse-btn")) return;
    if (!head.classList.contains("field-tools")) {
      head.classList.add("field-tools");
    }

    const key = `rauto_collapse_${body.id}`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "collapse-btn";
    btn.setAttribute("data-target", body.id);
    head.appendChild(btn);

    const collapsed = localStorage.getItem(key) === "1";
    body.hidden = collapsed;
    body.style.display = collapsed ? "none" : "";
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.textContent = collapsed ? t("expand") : t("collapse");
    btn.onclick = () => {
      body.hidden = !body.hidden;
      body.style.display = body.hidden ? "none" : "";
      localStorage.setItem(key, body.hidden ? "1" : "0");
      btn.setAttribute("aria-expanded", body.hidden ? "false" : "true");
      btn.textContent = body.hidden ? t("expand") : t("collapse");
    };
  });
}

function openDetailModal(content, options = {}) {
  const modal = byId("detail-modal");
  const body = byId("detail-modal-body");
  byId("detail-modal-title").textContent = options.title || t("detailModalTitle");
  if (options.html) {
    body.innerHTML = content;
  } else {
    body.innerHTML = `<pre class="output max-h-[70vh] overflow-auto whitespace-pre-wrap break-all">${escapeHtml(
      safeString(content)
    )}</pre>`;
  }
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");
}

function closeDetailModal() {
  const modal = byId("detail-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  byId("detail-modal-body").innerHTML = "";
  byId("detail-modal-title").textContent = t("detailModalTitle");
  document.body.classList.remove("overflow-hidden");
}
