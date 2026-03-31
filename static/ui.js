/**
 * ui.js - UI control and state management functions
 */

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
  byId("connection-workspace-subtitle").textContent = t("connectionWorkspaceSubtitle");
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
  byId("saved-conn-template-btn").textContent = t("savedConnTemplateBtn");
  byId("saved-conn-import-btn").textContent = t("savedConnImportBtn");
  byId("saved-conn-use-btn").textContent = t("savedConnUseBtn");
  byId("saved-conn-save-btn").textContent = t("savedConnSaveBtn");
  byId("saved-conn-delete-btn").textContent = t("savedConnDeleteBtn");
  byId("saved-conn-history-btn").textContent = t("savedConnHistoryBtn");
  byId("connection-temp-apply-btn").textContent = t("connectionTempApplyBtn");
  byId("connection-modal-close").textContent = t("close");
  byId("connection-help").textContent = t("connectionHelp");
  byId("connection-temp-hint").textContent = t("connectionTempHint");
  if (typeof window.onAlpineThemeChange === "function") {
    window.onAlpineThemeChange(currentTheme);
  }

  byId("tab-standard").textContent = t("opSectionStandard");
  byId("tab-orchestrated").textContent = t("opSectionOrchestrated");
  byId("tab-interactive").textContent = t("tabInteractive");
  byId("tab-replay").textContent = t("tabReplay");
  byId("tab-prompts").textContent = t("tabPrompts");
  byId("tab-templates").textContent = t("tabTemplates");
  byId("tab-transfer").textContent = t("tabTransfer");
  byId("tab-blacklist").textContent = t("tabBlacklist");
  byId("tab-backup").textContent = t("tabBackup");
  byId("nav-standard-direct").textContent = t("opExecDirect");
  byId("nav-standard-template").textContent = t("opExecTemplate");
  byId("nav-standard-flow").textContent = t("opExecFlow");
  byId("nav-orchestrated-block").textContent = t("txStageBlock");
  byId("nav-orchestrated-workflow").textContent = t("txStageWorkflow");
  byId("nav-orchestrated-orchestrate").textContent = t("txStageOrchestrate");
  byId("nav-prompt-view").textContent = t("promptModeView");
  byId("nav-prompt-edit").textContent = t("promptModeEdit");
  byId("nav-prompt-diagnose").textContent = t("promptModeDiagnose");
  byId("nav-template-library").textContent = t("templateListTitle");
  byId("nav-template-flows").textContent = t("flowTemplateMgrTitle");

  byId("standard-title").textContent = t("opSectionStandard");
  byId("orchestrated-title").textContent = t("opSectionOrchestrated");
  byId("interactive-title").textContent = t("interactiveTitle");
  byId("interactive-card-title").textContent = t("interactiveCardTitle");
  byId("interactive-start-btn").textContent = t("interactiveStartBtn");
  byId("interactive-stop-btn").textContent = t("interactiveStopBtn");
  byId("interactive-send-btn").textContent = t("interactiveSendBtn");
  byId("interactive-clear-btn").textContent = t("interactiveClearBtn");
  byId("record-fab").title = t("recordFabTitle");
  byId("dashboard-tool-record").textContent = t("recordFabTitle");
  byId("history-topbar-btn").title = t("savedConnHistoryBtn");
  byId("dashboard-tool-history").textContent = t("savedConnHistoryBtn");
  byId("record-drawer-close").textContent = t("recordDrawerClose");
  byId("recording-subtitle").textContent = t("recordDrawerSubtitle");
  byId("history-drawer-title").textContent = t("historyDrawerTitle");
  byId("history-drawer-subtitle").textContent = t("historyDrawerSubtitle");
  byId("history-drawer-refresh-btn").textContent = t("historyDrawerRefresh");
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
  byId("orchestrated-op-card-title").textContent = t("opCardTitle");
  byId("template-selected-content-title").textContent = t("templateSelectedContentTitle");
  byId("prompt-mgr-title").textContent = t("promptMgrTitle");
  byId("builtin-title").textContent = t("builtinTitle");
  byId("custom-title").textContent = t("customTitle");
  byId("template-mgr-title").textContent = t("templateMgrTitle");
  byId("transfer-title").textContent = t("transferTitle");
  byId("flow-vars-fields-title").textContent = t("flowVarsFieldsTitle");
  byId("flow-vars-fields-hint").textContent = t("flowVarsFieldsHint");
  byId("flow-vars-json-hint").textContent = t("flowVarsJsonHint");
  byId("upload-title").textContent = t("uploadTitle");
  byId("template-list-title").textContent = t("templateListTitle");
  byId("template-editor-title").textContent = t("templateEditorTitle");
  byId("flow-template-mgr-title").textContent = t("flowTemplateMgrTitle");
  byId("flow-template-manage-hint").textContent = t("flowTemplateManageHint");
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
  byId("record-enable-label").textContent = t("recordEnableLabel");
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
  byId("template-delete-btn").textContent = t("templateDeleteBtn");
  byId("flow-exec-btn").textContent = t("flowExecBtn");
  byId("upload-exec-btn").textContent = t("uploadExecBtn");
  byId("upload-show-progress-label").textContent = t("uploadShowProgressLabel");
  byId("flow-template-load-btn").textContent = t("flowTemplateLoadBtn");
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
  byId("device_profile").placeholder = t("deviceProfilePlaceholder");
  byId("saved-conn-name").placeholder = t("savedConnNamePlaceholder");
  byId("template").placeholder = t("templatePlaceholder");
  byId("template-selected-content").placeholder = t("templateSelectedContentPlaceholder");
  byId("tx-name").placeholder = t("txNamePlaceholder");
  byId("tx-template").placeholder = t("txTemplatePlaceholder");
  byId("tx-vars").placeholder = t("txVarsPlaceholder");
  byId("tx-commands").placeholder = t("txCommandsPlaceholder");
  byId("tx-mode").placeholder = t("txModePlaceholder");
  byId("tx-timeout-secs").placeholder = t("txTimeoutPlaceholder");
  byId("tx-resource-rollback").placeholder = t("txResourceRollbackPlaceholder");
  byId("tx-rollback-mode-label").textContent = t("txRollbackModeLabel");
  byId("tx-rollback-mode").innerHTML = `
    <option value="per_step">${escapeHtml(t("txRollbackModePerStep"))}</option>
    <option value="whole_resource">${escapeHtml(t("txRollbackModeWhole"))}</option>
  `;
  byId("tx-rollback-input-label").textContent = t("txWorkflowRollbackInputModeLabel");
  byId("tx-rollback-input-text").textContent = t("txWorkflowRollbackInputText");
  byId("tx-rollback-input-pairs").textContent = t("txWorkflowRollbackInputPairs");
  byId("tx-rollback-auto-btn").textContent = t("txWorkflowRollbackAutoBtn");
  byId("tx-rollback-auto-hint").textContent = t("txWorkflowRollbackAutoHint");
  byId("tx-rollback-rule-label").textContent = t("txWorkflowRollbackRuleLabel");
  byId("tx-rollback-rule").innerHTML = `
    <option value="no_prefix">${escapeHtml(t("txWorkflowRollbackRuleNoPrefix"))}</option>
    <option value="set_delete">${escapeHtml(t("txWorkflowRollbackRuleSetDelete"))}</option>
    <option value="add_remove">${escapeHtml(t("txWorkflowRollbackRuleAddRemove"))}</option>
    <option value="custom">${escapeHtml(t("txWorkflowRollbackRuleCustom"))}</option>
  `;
  if (!byId("tx-rollback-rule").value) {
    byId("tx-rollback-rule").value = "no_prefix";
  }
  byId("tx-rollback-template").placeholder = t("txWorkflowRollbackTemplatePlaceholder");
  byId("tx-rollback-template-pick").innerHTML = rollbackTemplateOptionsHtml(
    byId("tx-rollback-template-name").value || ""
  );
  byId("tx-rollback-template-name").placeholder = t("txWorkflowRollbackLibraryName");
  byId("tx-rollback-template-save").textContent = t("txWorkflowRollbackLibrarySave");
  byId("tx-rollback-template-delete").textContent = t("txWorkflowRollbackLibraryDelete");
  byId("tx-rollback-commands").placeholder = t("txRollbackCommandsPlaceholder");
  byId("tx-rollback-on-failure-label").textContent = t("txRollbackOnFailureLabel");
  byId("tx-rollback-trigger-step").placeholder = t("txRollbackTriggerStepPlaceholder");
  byId("tx-rollback-empty-hint").textContent = t("txWorkflowRollbackEmptyHint");
  byId("tx-basic-title").textContent = t("txBasicTitle");
  byId("tx-run-kind-commands").textContent = t("txRunKindCommands");
  byId("tx-run-kind-flow").textContent = t("txRunKindFlow");
  byId("tx-flow-template-name").placeholder = t("txFlowTemplatePlaceholder");
  byId("tx-flow-vars").placeholder = t("txFlowVarsPlaceholder");
  byId("tx-flow-rollback-on-failure-label").textContent =
    t("txFlowRollbackOnFailureLabel");
  byId("tx-rollback-flow-template-name").placeholder =
    t("txFlowRollbackTemplatePlaceholder");
  byId("tx-rollback-flow-vars").placeholder = t("txFlowRollbackVarsPlaceholder");
  byId("tx-flow-hint").textContent = t("txFlowHint");
  byId("tx-plan-btn").textContent = t("txPlanBtn");
  byId("tx-exec-btn").textContent = t("txExecBtn");
  byId("tx-block-visual-title").textContent = t("txBlockVisualTitle");
  byId("tx-workflow-title").textContent = t("txWorkflowTitle");
  byId("tx-workflow-builder-title").textContent = t("txWorkflowBuilderTitle");
  byId("tx-workflow-import-block-btn").textContent = t("txWorkflowImportBlockBtn");
  byId("tx-workflow-add-block-btn").textContent = t("txWorkflowAddBlockBtn");
  byId("tx-workflow-collapse-all-btn").textContent = t("txWorkflowCollapseAllBtn");
  byId("tx-workflow-expand-all-btn").textContent = t("txWorkflowExpandAllBtn");
  byId("tx-workflow-name").placeholder = t("txWorkflowNamePlaceholder");
  byId("tx-workflow-fail-fast-label").textContent = t("txWorkflowFailFastLabel");
  const txWorkflowFilterKindEl = byId("tx-workflow-filter-kind");
  txWorkflowFilterKindEl.innerHTML = `
    <option value="all">${escapeHtml(t("txWorkflowFilterKindAll"))}</option>
    <option value="config">${escapeHtml(t("txWorkflowBlockKindConfig"))}</option>
    <option value="show">${escapeHtml(t("txWorkflowBlockKindShow"))}</option>
  `;
  txWorkflowFilterKindEl.value = txWorkflowFilterKind;
  const txWorkflowFilterRollbackEl = byId("tx-workflow-filter-rollback");
  txWorkflowFilterRollbackEl.innerHTML = `
    <option value="all">${escapeHtml(t("txWorkflowFilterRollbackAll"))}</option>
    <option value="none">${escapeHtml(t("txWorkflowBlockRollbackNone"))}</option>
    <option value="per_step">${escapeHtml(t("txWorkflowBlockRollbackPerStep"))}</option>
    <option value="whole_resource">${escapeHtml(t("txWorkflowBlockRollbackWhole"))}</option>
  `;
  txWorkflowFilterRollbackEl.value = txWorkflowFilterRollback;
  byId("tx-workflow-filter-query").placeholder = t("txWorkflowFilterSearchPlaceholder");
  byId("tx-workflow-filter-clear-btn").textContent = t("txWorkflowFilterClearBtn");
  byId("tx-workflow-generate-btn").textContent = t("txWorkflowGenerateBtn");
  byId("tx-workflow-load-btn").textContent = t("txWorkflowLoadBtn");
  byId("tx-workflow-download-btn").textContent = t("txWorkflowDownloadBtn");
  byId("tx-workflow-import-file-btn").textContent = t("txWorkflowImportFileBtn");
  byId("tx-workflow-json").placeholder = t("txWorkflowJsonPlaceholder");
  byId("tx-workflow-plan-btn").textContent = t("txWorkflowPlanBtn");
  byId("tx-workflow-exec-btn").textContent = t("txWorkflowExecBtn");
  renderTxBlockVisual();
  byId("tx-workflow-visual-title").textContent = t("txWorkflowVisualTitle");
  renderTxWorkflowBuilder();
  renderTxWorkflowPreviewFromEditor();
  byId("orchestration-title").textContent = t("orchestrationTitle");
  byId("orchestration-base-dir").placeholder = t("orchestrationBaseDirPlaceholder");
  byId("orchestration-json").placeholder = t("orchestrationJsonPlaceholder");
  byId("orchestration-plan-btn").textContent = t("orchestrationPlanBtn");
  byId("orchestration-exec-btn").textContent = t("orchestrationExecBtn");
  byId("orchestration-download-btn").textContent = t("orchestrationDownloadBtn");
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
  byId("custom-profile-picker").placeholder = t("customProfilePickerPlaceholder");
  byId("profile-diagnose-picker").placeholder = t("customProfilePickerPlaceholder");
  byId("builtin-detail-name").placeholder = t("builtinFieldName");
  byId("builtin-detail-aliases").placeholder = t("builtinFieldAliases");
  byId("builtin-detail-summary").placeholder = t("builtinFieldSummary");
  byId("builtin-detail-source").placeholder = t("builtinFieldSource");
  byId("builtin-detail-notes").placeholder = t("builtinFieldNotes");
  byId("template-pick-name").placeholder = t("templateViewPickerPlaceholder");
  byId("flow-template-name").placeholder = t("flowTemplateRunPlaceholder");
  byId("flow-vars-json").placeholder = t("flowVarsPlaceholder");
  byId("flow-hint").textContent = t("flowHint");
  byId("flow-template-picker").placeholder = t("flowTemplatePickerPlaceholder");
  if (typeof renderSidebarConnectionSelector === "function") {
    renderSidebarConnectionSelector();
  }
  renderTemplateList();
  renderFlowTemplateOptions();
  renderFlowTemplateList();
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
  applyTxLayoutState();
  applyTxStage();
  applyPromptMode();
  applyTemplateSection();
  applyTxWorkflowMoreActionsState();
  applyTxRollbackMode();
  applyTxRollbackRuleVisibility();
  updateBuiltinCommandExecutionVisibility();
  updateProfileCommandExecutionVisibility();
  updateSelectedBackupMeta();
  syncAgentAuthUi();

  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
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
    "transfer",
    "blacklist",
    "backup",
  ];
  for (const tab of tabs) {
    const button = byId(`tab-${tab}`);
    const panel = byId(`panel-${tab}`);
    const active = tab === currentTab;

    if (active) {
      button.classList.add("menu-active");
      panel.hidden = false;
      panel.style.display = "";
      button.setAttribute("aria-selected", "true");
    } else {
      button.classList.remove("menu-active");
      panel.hidden = true;
      panel.style.display = "none";
      button.setAttribute("aria-selected", "false");
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

function applyTxBlockRunKind() {
  const isCommands = currentTxBlockRunKind === "commands";
  const commandsBtn = byId("tx-run-kind-commands");
  const flowBtn = byId("tx-run-kind-flow");
  const commandsPanel = byId("tx-block-command-fields");
  const flowPanel = byId("tx-block-flow-fields");
  commandsBtn.classList.toggle("is-active", isCommands);
  flowBtn.classList.toggle("is-active", !isCommands);
  commandsBtn.setAttribute("aria-selected", isCommands ? "true" : "false");
  flowBtn.setAttribute("aria-selected", isCommands ? "false" : "true");
  commandsPanel.hidden = !isCommands;
  commandsPanel.style.display = isCommands ? "" : "none";
  flowPanel.hidden = isCommands;
  flowPanel.style.display = isCommands ? "none" : "";
  try {
    if (window.Alpine && typeof window.Alpine.store === "function") {
      const appStore = window.Alpine.store("app");
      if (appStore && appStore.currentTxBlockRunKind !== currentTxBlockRunKind) {
        appStore.currentTxBlockRunKind = currentTxBlockRunKind;
      }
    }
  } catch (_) {}
}

function applyTxLayoutState() {
  const advancedFields = byId("tx-advanced-fields");
  const advancedToggleBtn = byId("tx-advanced-toggle-btn");
  if (advancedFields) {
    advancedFields.hidden = !txAdvancedExpanded;
    advancedFields.style.display = txAdvancedExpanded ? "" : "none";
  }
  if (advancedToggleBtn) {
    advancedToggleBtn.textContent = txAdvancedExpanded ? t("collapse") : t("txAdvancedBtn");
  }
}

function applyTxStage() {
  const isBlock = currentTxStage === "block";
  const isWorkflow = currentTxStage === "workflow";
  const isOrchestrate = currentTxStage === "orchestrate";
  const blockPanel = byId("tx-stage-block-panel");
  const workflowPanel = byId("tx-stage-workflow-panel");
  const orchestratePanel = byId("tx-stage-orchestrate-panel");
  const hint = byId("tx-stage-hint");
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
  if (isBlock) {
    applyTxBlockRunKind();
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

function applyTxRollbackMode() {
  const mode = byId("tx-rollback-mode").value || "infer";
  const perStep = byId("tx-rollback-per-step");
  const whole = byId("tx-rollback-resource");
  perStep.hidden = mode !== "per_step";
  perStep.style.display = mode === "per_step" ? "" : "none";
  whole.hidden = mode !== "whole_resource";
  whole.style.display = mode === "whole_resource" ? "" : "none";
  applyTxRollbackInputMode();
}

function applyTxRollbackInputMode() {
  const isText = txRollbackInputMode === "text";
  byId("tx-rollback-input-text").classList.toggle("is-active", isText);
  byId("tx-rollback-input-pairs").classList.toggle("is-active", !isText);
  byId("tx-rollback-commands").hidden = !isText;
  byId("tx-rollback-commands").style.display = isText ? "" : "none";
  byId("tx-rollback-pairs").hidden = isText;
  byId("tx-rollback-pairs").style.display = isText ? "none" : "";
  renderTxRollbackPairs();
}

function applyTxRollbackRuleVisibility() {
  const isCustom = byId("tx-rollback-rule").value === "custom";
  byId("tx-rollback-template").hidden = !isCustom;
  byId("tx-rollback-template").style.display = isCustom ? "" : "none";
}

function renderTxRollbackPairs() {
  if (txRollbackInputMode !== "pairs") return;
  const commands = parseTxCommands();
  const rollbacks = parseRollbackLinesRaw(byId("tx-rollback-commands").value || "");
  const wrap = byId("tx-rollback-pairs");
  const hint = byId("tx-rollback-empty-hint");
  if (!commands.length) {
    wrap.innerHTML = "";
    hint.hidden = false;
    hint.style.display = "";
    return;
  }
  hint.hidden = true;
  hint.style.display = "none";
  wrap.innerHTML = commands
    .map((cmd, idx) => {
      const val = rollbacks[idx] || "";
      return `
        <div class="grid gap-2 md:grid-cols-[1fr_1fr] tx-workflow-pair-row">
          <div class="input tx-workflow-pair-label">
            <span class="tx-workflow-pair-index">#${idx + 1}</span>
            <span class="tx-workflow-pair-command">${escapeHtml(cmd)}</span>
          </div>
          <input class="input js-tx-rollback-pair" data-index="${idx}" value="${escapeHtml(
        val
      )}" placeholder="${escapeHtml(t("txRollbackCommandsPlaceholder"))}" />
        </div>
      `;
    })
    .join("");
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
  const isTemplates = currentTemplateSection === "templates";
  const libraryPanel = byId("template-library-section");
  const flowPanel = byId("template-flows-section");
  if (libraryPanel) {
    libraryPanel.hidden = !isTemplates;
    libraryPanel.style.display = isTemplates ? "" : "none";
  }
  if (flowPanel) {
    flowPanel.hidden = isTemplates;
    flowPanel.style.display = isTemplates ? "none" : "";
  }
  try {
    if (window.Alpine && typeof window.Alpine.store === "function") {
      const appStore = window.Alpine.store("app");
      if (appStore && appStore.currentTemplateSection !== currentTemplateSection) {
        appStore.currentTemplateSection = currentTemplateSection;
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
    device_profile: value("device_profile") || null,
  };
}

function recordLevelPayload() {
  if (byId("record-enable").checked) return "off";
  const level = (byId("record-level").value || "key-events-only").trim();
  if (!level || level === "off") return null;
  return level;
}

function setStatusMessage(id, message, tone = "info") {
  const el = byId(id);
  if (!el) return;
  el.innerHTML = renderStatusMessageCard(message, tone);
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
  if (lastFlowRunTemplateDetail && lastFlowRunTemplateDetail.name === name) {
    return lastFlowRunTemplateDetail;
  }
  try {
    const data = await request(
      "GET",
      `/api/flow-templates/${encodeURIComponent(name)}`
    );
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
  const raw = byId("tx-workflow-json").value.trim();
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
  const raw = byId("orchestration-json").value.trim();
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
  listBtn.classList.toggle("is-active", isList);
  rawBtn.classList.toggle("is-active", !isList);
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
  byId("device_profile").value = safeString(connection.device_profile || "");
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
  initAutocomplete("profile-diagnose-picker", () => cachedDeviceProfiles);
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
