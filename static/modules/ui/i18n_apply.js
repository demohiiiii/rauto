/**
 * ui/i18n_apply.js - i18n + dynamic label sync
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
  byId("builtin-profile-select").setAttribute(
    "title",
    t("builtinProfileSelectPlaceholder")
  );
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
  byId("tx-plan-btn").textContent = t("txPlanBtn");
  byId("tx-exec-btn").textContent = t("txExecBtn");
  if (typeof rerenderTxVarsAssistants === "function") {
    rerenderTxVarsAssistants();
  }
  byId("tx-block-visual-title").textContent = t("txBlockVisualTitle");
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
