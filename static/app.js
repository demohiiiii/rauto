/**
 * app.js - Main application entry point and event bindings
 * Dependencies: All other modules
 */

function bindEvents() {
  const detailModal = byId("detail-modal");
  const entryDrawer = byId("entry-drawer");
  const entryDrawerBackdrop = byId("entry-drawer-backdrop");

  byId("agent-api-token-save-btn").onclick = () => {
    saveAgentApiTokenFromWeb();
  };
  byId("agent-api-token-clear-btn").onclick = () => {
    setStoredAgentApiToken("");
    syncAgentAuthUi();
    setStatusMessage("agent-auth-out", t("agentAuthCleared"), "info");
  };
  byId("agent-api-token").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveAgentApiTokenFromWeb();
    }
  });

  document.addEventListener("click", (e) => {
    const detailBtn = e.target.closest(".js-entry-detail-btn");
    if (detailBtn) {
      const id = detailBtn.getAttribute("data-detail-id") || "";
      const entry = detailEntryMap.get(id);
      if (entry) {
        openEntryDrawer(entry);
      }
    }
    const historyDetailBtn = e.target.closest(".js-history-detail-btn");
    if (historyDetailBtn) {
      const historyId = historyDetailBtn.getAttribute("data-history-id") || "";
      if (historyId) {
        loadConnectionHistoryDetail(historyId);
      }
    }
    const orchestrationDetailBtn = e.target.closest(".js-orchestration-detail-btn");
    if (orchestrationDetailBtn) {
      const detailId =
        orchestrationDetailBtn.getAttribute("data-orchestration-detail-id") || "";
      const detail = orchestrationDetailMap.get(detailId);
      if (detail) {
        openOrchestrationDetail(detail);
      }
    }
    const historyDeleteBtn = e.target.closest(".js-history-delete-btn");
    if (historyDeleteBtn) {
      const historyId = historyDeleteBtn.getAttribute("data-history-id") || "";
      if (historyId) {
        deleteConnectionHistoryItem(historyId);
      }
    }
    const taskDetailBtn = e.target.closest(".js-task-detail-btn");
    if (taskDetailBtn) {
      const taskId = taskDetailBtn.getAttribute("data-task-id") || "";
      if (taskId) {
        loadTaskDetail(taskId);
      }
    }
    const inventoryGroupRow = e.target.closest(".js-inventory-group-row");
    if (inventoryGroupRow) {
      const name = inventoryGroupRow.getAttribute("data-name") || "";
      ensureSelectValue("inventory-group-picker", name);
      loadInventoryGroupDetail();
    }
    const txDeleteBtn = e.target.closest(".js-tx-workflow-delete-block");
    if (txDeleteBtn) {
      const blockId = txDeleteBtn.getAttribute("data-tx-block-id") || "";
      if (blockId) {
        const idx = txWorkflowBlocks.findIndex((b) => b.id === blockId);
        const wasEditing = txWorkflowEditingBlockId === blockId;
        if (idx >= 0) {
          txWorkflowBlocks.splice(idx, 1);
        }
        if (wasEditing && txWorkflowEditorModalOpen) {
          const fallback =
            txWorkflowBlocks[idx] ||
            txWorkflowBlocks[Math.max(0, idx - 1)] ||
            null;
          if (fallback) {
            startTxWorkflowBlockEditor(fallback.id);
          } else {
            hideTxWorkflowEditorModal({ clearSelection: true });
          }
        } else {
          if (wasEditing) {
            txWorkflowEditingBlockId = "";
          }
          renderTxWorkflowBuilder();
        }
      }
    }
    const txToggleBtn = e.target.closest(".js-tx-workflow-toggle-block");
    if (txToggleBtn) {
      const blockId = txToggleBtn.getAttribute("data-tx-block-id") || "";
      const item = txWorkflowBlocks.find((b) => b.id === blockId);
      if (item) {
        item.collapsed = !item.collapsed;
        renderTxWorkflowBuilder();
      }
    }
    const txCopyBtn = e.target.closest(".js-tx-workflow-copy-block");
    if (txCopyBtn) {
      const blockId = txCopyBtn.getAttribute("data-tx-block-id") || "";
      const idx = txWorkflowBlocks.findIndex((b) => b.id === blockId);
      if (idx >= 0) {
        const src = txWorkflowBlocks[idx];
        txWorkflowBlocks.splice(idx + 1, 0, createTxWorkflowBlock({ ...src }));
        renderTxWorkflowBuilder();
      }
    }
    const txMoveUpBtn = e.target.closest(".js-tx-workflow-move-up-block");
    if (txMoveUpBtn) {
      const blockId = txMoveUpBtn.getAttribute("data-tx-block-id") || "";
      const idx = txWorkflowBlocks.findIndex((b) => b.id === blockId);
      if (idx > 0) {
        const tmp = txWorkflowBlocks[idx - 1];
        txWorkflowBlocks[idx - 1] = txWorkflowBlocks[idx];
        txWorkflowBlocks[idx] = tmp;
        renderTxWorkflowBuilder();
      }
    }
    const txMoveDownBtn = e.target.closest(".js-tx-workflow-move-down-block");
    if (txMoveDownBtn) {
      const blockId = txMoveDownBtn.getAttribute("data-tx-block-id") || "";
      const idx = txWorkflowBlocks.findIndex((b) => b.id === blockId);
      if (idx >= 0 && idx < txWorkflowBlocks.length - 1) {
        const tmp = txWorkflowBlocks[idx + 1];
        txWorkflowBlocks[idx + 1] = txWorkflowBlocks[idx];
        txWorkflowBlocks[idx] = tmp;
        renderTxWorkflowBuilder();
      }
    }
    const txEditBtn = e.target.closest(".js-tx-workflow-edit-block");
    if (txEditBtn) {
      const blockId = txEditBtn.getAttribute("data-tx-block-id") || "";
      if (blockId) {
        startTxWorkflowBlockEditor(blockId);
      }
    }
    const txSelectCard = e.target.closest(".js-tx-workflow-select-block");
    if (txSelectCard && !e.target.closest("[data-workflow-action='true']")) {
      const blockId = txSelectCard.getAttribute("data-tx-block-id") || "";
      if (blockId && txWorkflowEditingBlockId !== blockId) {
        startTxWorkflowBlockEditor(blockId);
      }
    }
  });

  byId("detail-modal-close").onclick = closeDetailModal;
  byId("entry-drawer-close").onclick = closeEntryDrawer;
  entryDrawerBackdrop.onclick = closeEntryDrawer;
  entryDrawer.onclick = (e) => {
    if (e.target === entryDrawer) {
      closeEntryDrawer();
    }
  };
  detailModal.onclick = (e) => {
    if (e.target === detailModal) {
      closeDetailModal();
    }
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const txWorkflowEditorModal = byId("tx-workflow-editor-modal");
      if (
        txWorkflowEditorModal &&
        (txWorkflowEditorModal.open === true ||
          txWorkflowEditorModal.classList.contains("modal-open"))
      ) {
        hideTxWorkflowEditorModal({ clearSelection: true });
        return;
      }
    }
    if (e.key === "Escape") {
      const savedConnEditModal = byId("saved-conn-edit-modal");
      if (savedConnEditModal && !savedConnEditModal.classList.contains("hidden")) {
        hideSavedConnectionEditorModal();
        return;
      }
    }
    if (e.key === "Escape" && entryDrawer.classList.contains("open")) {
      closeEntryDrawer();
      return;
    }
    if (e.key === "Escape") {
      try {
        if (window.Alpine && typeof window.Alpine.store === "function") {
          const appStore = window.Alpine.store("app");
          if (appStore) {
            appStore.closeLangMenu();
          }
        }
      } catch (_) {}
    }
    if (e.key === "Escape" && !detailModal.classList.contains("hidden")) {
      closeDetailModal();
    }
    if (e.key === "Escape" && byId("record-drawer").classList.contains("open")) {
      closeRecordDrawer();
    }
    if (e.key === "Escape" && byId("history-drawer").classList.contains("open")) {
      closeHistoryDrawer();
    }
  });

  byId("interactive-start-btn").onclick = () => {
    startInteractive();
  };
  byId("interactive-stop-btn").onclick = () => {
    stopInteractive();
  };
  byId("interactive-send-btn").onclick = () => {
    sendInteractiveCommand();
  };
  byId("interactive-clear-btn").onclick = () => {
    byId("interactive-out").textContent = "";
    if (interactiveSessionId) {
      setInteractiveStatus(`${t("interactiveStatusReady")} · ${interactiveSessionId}`);
    } else {
      setInteractiveStatus(t("interactiveStatusIdle"));
    }
  };
  byId("interactive-command").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendInteractiveCommand();
    }
  });

  byId("record-fab").onclick = () => {
    openRecordDrawer();
  };
  const normalizeRecordLevelValue = (value) =>
    String(value || "").trim() === "full" ? "full" : "key-events-only";
  const applyRecordLevel = (level) => {
    const normalized = normalizeRecordLevelValue(level);
    const drawerSelect = byId("record-level");
    if (drawerSelect) {
      drawerSelect.value = normalized;
    }
    if (typeof syncRecordLevelToggleView === "function") {
      syncRecordLevelToggleView(normalized, { updateSelect: false });
    }
    if (typeof updateRecordLevelTooltip === "function") {
      updateRecordLevelTooltip();
    }
  };
  byId("record-level-toggle-btn").onclick = () => {
    const current = normalizeRecordLevelValue(
      byId("record-level")?.value || byId("record-level-toggle-btn")?.dataset.level
    );
    applyRecordLevel(current === "full" ? "key-events-only" : "full");
  };
  byId("record-level").onchange = () => {
    applyRecordLevel(byId("record-level")?.value);
  };
  byId("history-topbar-btn").onclick = () => {
    openHistoryDrawer();
    loadConnectionHistory();
  };
  byId("sidebar-connection-history-btn").onclick = () => {
    openHistoryDrawer();
    loadConnectionHistory();
  };
  byId("record-drawer-close").onclick = () => {
    closeRecordDrawer();
  };
  byId("record-drawer-backdrop").onclick = () => {
    closeRecordDrawer();
  };
  byId("history-drawer-close").onclick = () => {
    closeHistoryDrawer();
  };
  byId("history-drawer-backdrop").onclick = () => {
    closeHistoryDrawer();
  };
  byId("tasks-refresh-btn").onclick = () => {
    loadTasks();
  };
  byId("tasks-clear-btn").onclick = () => {
    byId("tasks-search").value = "";
    byId("tasks-operation").value = "";
    byId("tasks-status").value = "";
    byId("tasks-outcome").value = "all";
    byId("tasks-time-range").value = "all";
    byId("tasks-recording").value = "all";
    byId("tasks-error").value = "all";
    byId("tasks-limit").value = "50";
    taskSearchQuery = "";
    taskOutcomeFilter = "all";
    taskTimeRangeFilter = "all";
    taskRecordingFilter = "all";
    taskErrorFilter = "all";
    loadTasks();
  };
  byId("tasks-search").oninput = () => {
    taskSearchQuery = byId("tasks-search").value || "";
    renderTaskList();
  };
  byId("tasks-operation").onchange = () => {
    loadTasks();
  };
  byId("tasks-status").onchange = () => {
    loadTasks();
  };
  byId("tasks-outcome").onchange = () => {
    taskOutcomeFilter = byId("tasks-outcome").value || "all";
    renderTaskList();
  };
  byId("tasks-time-range").onchange = () => {
    taskTimeRangeFilter = byId("tasks-time-range").value || "all";
    renderTaskList();
  };
  byId("tasks-recording").onchange = () => {
    taskRecordingFilter = byId("tasks-recording").value || "all";
    renderTaskList();
  };
  byId("tasks-error").onchange = () => {
    taskErrorFilter = byId("tasks-error").value || "all";
    renderTaskList();
  };
  byId("tasks-limit").onchange = () => {
    loadTasks();
  };

  byId("device_profile").addEventListener("change", () => {
    refreshExecutionModeOptions();
  });
  ["host", "port", "username", "password", "enable_password", "ssh_security", "linux_shell_flavor", "device_profile"].forEach((id) => {
    const el = byId(id);
    if (!el) return;
    el.addEventListener("input", () => {
      if (temporaryConnectionActive && typeof renderSidebarConnectionSelector === "function") {
        temporaryConnectionLabel = "";
        temporaryConnectionDetails = {
          name: currentTemporaryConnectionLabel(),
          host: safeString(byId("host")?.value || "").trim() || "-",
          port: Number(byId("port")?.value || 22) || 22,
          username: safeString(byId("username")?.value || "").trim() || "-",
          profile: safeString(byId("device_profile")?.value || "linux").trim() || "linux",
          kind: "temporary",
          note: t("sidebarConnectionTemporaryHint"),
        };
        if (typeof setCurrentConnectionTarget === "function") {
          setCurrentConnectionTarget(temporaryConnectionDetails);
        }
        renderSidebarConnectionSelector();
      }
    });
    el.addEventListener("change", () => {
      if (temporaryConnectionActive && typeof renderSidebarConnectionSelector === "function") {
        temporaryConnectionLabel = "";
        temporaryConnectionDetails = {
          name: currentTemporaryConnectionLabel(),
          host: safeString(byId("host")?.value || "").trim() || "-",
          port: Number(byId("port")?.value || 22) || 22,
          username: safeString(byId("username")?.value || "").trim() || "-",
          profile: safeString(byId("device_profile")?.value || "linux").trim() || "linux",
          kind: "temporary",
          note: t("sidebarConnectionTemporaryHint"),
        };
        if (typeof setCurrentConnectionTarget === "function") {
          setCurrentConnectionTarget(temporaryConnectionDetails);
        }
        renderSidebarConnectionSelector();
      }
    });
  });
  byId("history-drawer-refresh-btn").onclick = loadConnectionHistory;
  byId("history-filter-query").oninput = () => {
    historyFilterQuery = byId("history-filter-query").value || "";
    saveHistoryFilterPrefs();
    renderHistoryDrawer();
  };
  byId("history-filter-operation").onchange = () => {
    historyFilterOperation = byId("history-filter-operation").value || "all";
    saveHistoryFilterPrefs();
    renderHistoryDrawer();
  };
  byId("history-filter-limit").onchange = () => {
    const raw = Number(byId("history-filter-limit").value || 30);
    historyFilterLimit = Number.isFinite(raw) ? raw : 30;
    saveHistoryFilterPrefs();
    loadConnectionHistory();
  };
  byId("history-filter-clear-btn").onclick = () => {
    historyFilterQuery = "";
    historyFilterOperation = "all";
    byId("history-filter-query").value = "";
    byId("history-filter-operation").value = "all";
    saveHistoryFilterPrefs();
    renderHistoryDrawer();
  };
  byId("tx-block-view-direct").onclick = () => {
    txBlockViewMode = "direct";
    applyTxBlockViewMode();
    syncSelectedTxWorkflowBlockFromEditor();
  };
  byId("tx-block-view-template").onclick = () => {
    txBlockViewMode = "template";
    applyTxBlockViewMode();
    syncSelectedTxWorkflowBlockFromEditor();
  };
  byId("tx-workflow-view-direct").onclick = () => {
    txWorkflowViewMode = "direct";
    applyTxWorkflowViewMode();
  };
  byId("tx-workflow-view-template").onclick = () => {
    txWorkflowViewMode = "template";
    applyTxWorkflowViewMode();
  };
  byId("tx-workflow-template-run-new-btn").onclick =
    createTxWorkflowTemplateDraftFromExecution;
  byId("tx-workflow-template-run-save-btn").onclick =
    saveTxWorkflowTemplateFromExecution;
  byId("tx-workflow-template-run-delete-btn").onclick =
    deleteTxWorkflowTemplateFromExecution;
  byId("tx-workflow-template-name").onchange = async () => {
    if (!byId("tx-workflow-template-name").value.trim()) return;
    await loadSelectedTxWorkflowTemplateForExecution();
  };
  byId("tx-block-editor-new-btn").onclick = () => {
    setTxBlockEditorJson(defaultTxBlockTemplatePayload());
    setStatusMessage("tx-plan-out", t("editingNew"), "info");
  };
  byId("tx-block-template-run-new-btn").onclick = createTxBlockTemplateDraftFromManager;
  byId("tx-block-template-run-save-btn").onclick = saveTxBlockTemplateFromEditor;
  byId("tx-block-template-run-delete-btn").onclick = deleteTxBlockTemplateFromManager;
  byId("tx-block-template-name").onchange = async () => {
    if (!byId("tx-block-template-name").value.trim()) return;
    await loadSelectedTxBlockTemplateForExecution();
    syncSelectedTxWorkflowBlockFromEditor();
  };

  byId("connection-test-btn").onclick = async () => {
    setStatusMessage("connection-test-out", t("running"), "running");
    try {
      const data = await request("POST", "/api/connection/test", {
        connection: connectionPayload(),
      });
    setStatusMessage(
      "connection-test-out",
      `${t("connectionOk")}: ${data.username}@${data.host}:${data.port} (${data.device_profile}, ${safeString(data.ssh_security)}, ${safeString(data.linux_shell_flavor || "-")})`,
      "success"
    );
    } catch (e) {
      setStatusMessage("connection-test-out", e.message, "error");
    }
  };
  byId("saved-conn-template-btn").onclick = downloadConnectionImportTemplate;
  byId("saved-conn-use-btn").onclick = async () => {
    const ok = await loadSavedConnectionByName();
    if (!ok) return;
    try {
      if (window.Alpine && typeof window.Alpine.store === "function") {
        window.Alpine.store("app").closeConnectionModal();
      }
    } catch (_) {}
  };
  byId("saved-conn-edit-btn").onclick = openSavedConnectionEditor;
  byId("saved-conn-new-btn").onclick = createSavedConnectionDraft;
  byId("connection-temp-apply-btn").onclick = async () => {
    byId("saved-conn-name").value = "";
    markTemporaryConnectionActive();
    await refreshExecutionModeOptions();
    setStatusMessage("saved-conn-out", t("sidebarConnectionTemporaryApplied"), "success");
    try {
      if (window.Alpine && typeof window.Alpine.store === "function") {
        window.Alpine.store("app").closeConnectionModal();
      }
    } catch (_) {}
  };
  byId("saved-conn-import-btn").onclick = () => {
    byId("saved-conn-import-file-input").click();
  };
  byId("saved-conn-delete-btn").onclick = deleteConnectionByName;
  byId("saved-conn-history-btn").onclick = () => {
    openHistoryDrawer();
    loadConnectionHistory();
  };
  byId("saved-conn-import-file-input").onchange = async () => {
    try {
      await importConnectionsFromFile();
    } catch (_) {}
  };
  byId("saved-conn-edit-close-btn").onclick = hideSavedConnectionEditorModal;
  byId("saved-conn-edit-cancel-btn").onclick = hideSavedConnectionEditorModal;
  byId("saved-conn-edit-save-btn").onclick = saveSavedConnectionEditor;
  byId("saved-conn-edit-modal").onclick = (e) => {
    if (e.target === byId("saved-conn-edit-modal")) {
      hideSavedConnectionEditorModal();
    }
  };
  byId("inventory-group-picker").onchange = loadInventoryGroupDetail;
  byId("inventory-group-new-btn").onclick = createInventoryGroupDraft;
  byId("inventory-group-save-btn").onclick = saveInventoryGroup;
  byId("inventory-group-delete-btn").onclick = deleteInventoryGroup;
  byId("inventory-group-hosts-filter").oninput = onInventoryGroupHostFilterInput;
  byId("inventory-group-hosts-select-all-btn").onclick = selectAllInventoryGroupHosts;
  byId("inventory-group-hosts-clear-btn").onclick = clearInventoryGroupHostsSelection;
  byId("inventory-group-hosts").addEventListener("change", onInventoryGroupHostSelectionChange);
  byId("inventory-resolve-btn").onclick = resolveInventoryVarsFromWeb;
  byId("blacklist-refresh-btn").onclick = loadBlacklistPatterns;
  byId("blacklist-add-btn").onclick = addBlacklistPatternFromWeb;
  byId("blacklist-check-btn").onclick = checkBlacklistCommandFromWeb;
  byId("blacklist-pattern").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addBlacklistPatternFromWeb();
    }
  });
  byId("blacklist-check-command").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      checkBlacklistCommandFromWeb();
    }
  });
  byId("blacklist-list").addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".js-blacklist-delete");
    if (!deleteBtn) return;
    const pattern = deleteBtn.getAttribute("data-pattern") || "";
    if (!pattern) return;
    deleteBlacklistPatternFromWeb(pattern);
  });
  byId("saved-conn-name").onchange = async () => {
    renderSavedConnectionOptions(byId("saved-conn-name").value || "");
  };

  byId("render-btn").onclick = async () => {
    const out = byId("render-out");
    out.textContent = t("running");
    try {
      const data = await request("POST", "/api/render", {
        template: byId("template").value.trim(),
        vars: parseVars(),
        connection: connectionPayload(),
      });
      out.textContent = data.rendered_commands;
    } catch (e) {
      out.innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };

  byId("exec-btn").onclick = async () => {
    const out = byId("exec-out");
    if (!ensureConnectionTargetSelected("", "exec-out")) {
      return;
    }
    out.textContent = t("running");
    try {
      const data = await request("POST", "/api/exec", {
        command: byId("command").value.trim(),
        mode: byId("mode").value.trim() || null,
        connection: connectionPayload(),
        record_level: recordLevelPayload(),
      });
      out.textContent = data.output;
      applyRecordingFromResponse(data);
    } catch (e) {
      out.innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };

  byId("template-exec-btn").onclick = async () => {
    const visualOut = byId("template-exec-visual");
    if (!ensureConnectionTargetSelected("", "template-exec-visual")) {
      return;
    }
    visualOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("running")
    )}</div>`;
    try {
      const data = await request("POST", "/api/template/execute", {
        template: byId("template").value.trim(),
        vars: parseVars(),
        mode: byId("template-mode").value.trim() || null,
        connection: connectionPayload(),
        record_level: recordLevelPayload(),
      });
      lastTemplateExecResult = data;
      renderTemplateExecVisual();
      applyRecordingFromResponse(data);
    } catch (e) {
      visualOut.innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };

  const runTxBlock = async (dryRun, statusId) => {
    const visualOut = byId("tx-block-visual");
    if (!ensureConnectionTargetSelected(statusId, "tx-block-visual")) {
      return;
    }
    const payload = txPayload(dryRun);
    if (
      txBlockViewMode === "template" &&
      !safeString(payload.tx_block_template_content || "").trim()
    ) {
      throw new Error(t("txBlockJsonRequired"));
    }
    if (
      txBlockViewMode === "direct" &&
      (!payload.tx_block || typeof payload.tx_block !== "object" || Array.isArray(payload.tx_block))
    ) {
      throw new Error(t("txBlockJsonInvalidShape"));
    }
    setStatusMessage(statusId, t("running"), "running");
    const data = await request("POST", "/api/tx/block", payload);
    setTxBlockVisual(
      data && data.tx_block ? data.tx_block : {},
      dryRun ? null : data && data.tx_result ? data.tx_result : {}
    );
    if (dryRun) {
      setStatusMessage(statusId, t("txBlockPreviewDone"), "success");
      byId("tx-exec-out").innerHTML = "";
    } else {
      setStatusMessage(statusId, t("txBlockExecuteDone"), "success");
      applyRecordingFromResponse(data);
    }
    if (!data && visualOut) {
      visualOut.innerHTML = "";
    }
  };

  byId("tx-plan-btn").onclick = async () => {
    try {
      txBlockViewMode = "direct";
      applyTxBlockViewMode();
      await runTxBlock(true, "tx-plan-out");
    } catch (e) {
      setStatusMessage("tx-plan-out", e.message, "error");
      byId("tx-block-visual").innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };

  byId("tx-exec-btn").onclick = async () => {
    try {
      txBlockViewMode = "direct";
      applyTxBlockViewMode();
      await runTxBlock(false, "tx-exec-out");
    } catch (e) {
      setStatusMessage("tx-exec-out", e.message, "error");
      byId("tx-block-visual").innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };
  byId("tx-template-plan-btn").onclick = async () => {
    try {
      txBlockViewMode = "template";
      applyTxBlockViewMode();
      await runTxBlock(true, "tx-plan-out");
    } catch (e) {
      setStatusMessage("tx-plan-out", e.message, "error");
      byId("tx-block-visual").innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };
  byId("tx-template-exec-btn").onclick = async () => {
    try {
      txBlockViewMode = "template";
      applyTxBlockViewMode();
      await runTxBlock(false, "tx-exec-out");
    } catch (e) {
      setStatusMessage("tx-exec-out", e.message, "error");
      byId("tx-block-visual").innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };
  byId("tx-workflow-plan-btn").onclick = async () => {
    const visualOut = byId("tx-workflow-plan-visual");
    if (!ensureConnectionTargetSelected("tx-workflow-plan-out", "tx-workflow-plan-visual")) {
      return;
    }
    setStatusMessage("tx-workflow-plan-out", t("running"), "running");
    try {
      const data = await request("POST", "/api/tx/workflow", txWorkflowPayload(true));
      const workflow = data && data.workflow ? data.workflow : {};
      setTxWorkflowEditorJson(workflow);
      setTxWorkflowPreview(workflow);
      setStatusMessage("tx-workflow-plan-out", t("txWorkflowPreviewDone"), "success");
    } catch (e) {
      setStatusMessage("tx-workflow-plan-out", e.message, "error");
      if (visualOut) {
        visualOut.innerHTML = renderStatusMessageCard(e.message, "error");
      }
    }
  };

  byId("tx-workflow-exec-btn").onclick = async () => {
    const out = byId("tx-workflow-exec-out");
    if (!ensureConnectionTargetSelected("tx-workflow-exec-out", "tx-workflow-exec-out")) {
      return;
    }
    setStatusMessage("tx-workflow-exec-out", t("running"), "running");
    try {
      const data = await request("POST", "/api/tx/workflow", txWorkflowPayload(false));
      const result = data.tx_workflow_result || {};
      out.innerHTML = renderTxWorkflowResult(result);
      applyRecordingFromResponse(data);
    } catch (e) {
      setStatusMessage("tx-workflow-exec-out", e.message, "error");
    }
  };
  byId("tx-workflow-json-new-btn").onclick = () => {
    setTxWorkflowEditorJson(defaultTxWorkflowTemplatePayload());
    byId("tx-workflow-vars-json").value = "{}";
    renderTxWorkflowPreviewFromEditor();
    setStatusMessage("tx-workflow-plan-out", t("editingNew"), "info");
  };
  byId("orchestration-plan-btn").onclick = async () => {
    const visualOut = byId("orchestration-visual");
    setStatusMessage("orchestration-plan-out", t("running"), "running");
    try {
      const data = await request("POST", "/api/orchestrate", orchestrationPayload(true));
      const plan = data && data.plan ? data.plan : {};
      const inventory = data && data.inventory ? data.inventory : {};
      byId("orchestration-json").value = JSON.stringify(plan, null, 2);
      setOrchestrationPreview(plan, inventory, null);
      setStatusMessage(
        "orchestration-plan-out",
        t("orchestrationPreviewDone"),
        "success"
      );
      byId("orchestration-exec-out").innerHTML = "";
    } catch (e) {
      setStatusMessage("orchestration-plan-out", e.message, "error");
      if (visualOut) {
        visualOut.innerHTML = renderStatusMessageCard(e.message, "error");
      }
    }
  };
  byId("orchestration-exec-btn").onclick = async () => {
    const out = byId("orchestration-exec-out");
    setStatusMessage("orchestration-exec-out", t("running"), "running");
    try {
      const data = await request("POST", "/api/orchestrate", orchestrationPayload(false));
      const plan = data && data.plan ? data.plan : {};
      const inventory = data && data.inventory ? data.inventory : {};
      const result = data && data.orchestration_result ? data.orchestration_result : {};
      setOrchestrationPreview(plan, inventory, result);
      out.innerHTML = renderOrchestrationResult(result);
    } catch (e) {
      setStatusMessage("orchestration-exec-out", e.message, "error");
    }
  };
  byId("orchestration-download-btn").onclick = () => {
    try {
      downloadOrchestrationJson();
      setStatusMessage(
        "orchestration-plan-out",
        t("orchestrationDownloadDone"),
        "success"
      );
    } catch (e) {
      setStatusMessage("orchestration-plan-out", e.message, "error");
    }
  };
  byId("orchestration-import-file-btn").onclick = () => {
    byId("orchestration-import-file-input").click();
  };
  byId("orchestration-inventory-merge-btn").onclick = () => {
    try {
      applyOrchestrationInventorySelection("merge");
      setStatusMessage(
        "orchestration-plan-out",
        t("orchestrationInventoryMergeDone"),
        "success"
      );
    } catch (e) {
      setStatusMessage("orchestration-plan-out", e.message, "error");
    }
  };
  byId("orchestration-inventory-build-btn").onclick = () => {
    try {
      applyOrchestrationInventorySelection("build");
      setStatusMessage(
        "orchestration-plan-out",
        t("orchestrationInventoryBuildDone"),
        "success"
      );
    } catch (e) {
      setStatusMessage("orchestration-plan-out", e.message, "error");
    }
  };
  byId("orchestration-import-file-input").onchange = async () => {
    try {
      await importOrchestrationFromFile();
    } catch (e) {
      setStatusMessage("orchestration-plan-out", e.message, "error");
    }
  };
  byId("tx-workflow-download-btn").onclick = () => {
    try {
      downloadTxWorkflowJson();
      setStatusMessage("tx-workflow-plan-out", t("txWorkflowDownloadDone"), "success");
    } catch (e) {
      setStatusMessage("tx-workflow-plan-out", e.message, "error");
    }
  };
  byId("tx-workflow-import-file-btn").onclick = () => {
    byId("tx-workflow-import-file-input").click();
  };
  byId("tx-workflow-import-file-input").onchange = async () => {
    try {
      await importTxWorkflowFromFile();
    } catch (e) {
      setStatusMessage("tx-workflow-plan-out", e.message, "error");
    }
  };
  byId("tx-workflow-json").oninput = () => {
    renderTxWorkflowPreviewFromEditor();
  };
  byId("orchestration-json").oninput = () => {
    renderOrchestrationPreviewFromEditor();
  };
  byId("template").onchange = loadSelectedTemplateContent;
  byId("record-view-list").onclick = () => {
    recordViewMode = "list";
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-view-raw").onclick = () => {
    recordViewMode = "raw";
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-jsonl").oninput = () => {
    if (recordViewMode === "list") {
      renderRecordingView();
    }
  };
  byId("record-failed-only").onchange = () => {
    recordFailedOnly = byId("record-failed-only").checked;
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-event-kind").onchange = () => {
    recordEventKind = byId("record-event-kind").value || "all";
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-search").oninput = () => {
    recordSearchQuery = byId("record-search").value || "";
    saveFilterPrefs();
    renderRecordingView();
  };
  byId("record-clear-filters").onclick = () => {
    resetRecordFilters();
  };
  byId("record-copy-btn").onclick = async () => {
    const text = byId("record-jsonl").value || "";
    if (!text.trim()) {
      showReplayStatus(t("replayNoJsonl"));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showReplayStatus(t("recordingCopied"));
    } catch (_) {
      showReplayStatus(t("requestFailed"));
    }
  };
  byId("record-use-replay-btn").onclick = () => {
    byId("replay-jsonl").value = byId("record-jsonl").value || "";
    lastReplayResult = null;
    renderReplayView();
    showReplayStatus(t("recordingSetToReplay"));
  };
  byId("replay-view-list").onclick = () => {
    replayViewMode = "list";
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-view-raw").onclick = () => {
    replayViewMode = "raw";
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-failed-only").onchange = () => {
    replayFailedOnly = byId("replay-failed-only").checked;
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-event-kind").onchange = () => {
    replayEventKind = byId("replay-event-kind").value || "all";
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-search").oninput = () => {
    replaySearchQuery = byId("replay-search").value || "";
    saveFilterPrefs();
    renderReplayView();
  };
  byId("replay-clear-filters").onclick = () => {
    resetReplayFilters();
  };
  byId("replay-list-btn").onclick = replayList;
  byId("replay-run-btn").onclick = replayCommand;
  byId("custom-profile-picker").onchange = async () => {
    if (!byId("custom-profile-picker").value.trim()) return;
    await loadCustomProfile();
  };
  byId("profile-new-btn").onclick = createCustomProfileDraft;
  byId("builtin-detail-btn").onclick = loadBuiltinProfileDetail;
  byId("builtin-copy-btn").onclick = () => {
    if (!lastBuiltinProfile) {
      setStatusMessage("builtin-detail-status", t("needLoadBuiltinFirst"), "error");
      return;
    }
    const copied = JSON.parse(JSON.stringify(lastBuiltinProfile));
    copied.name = `${copied.name}_custom`;
    setProfileForm(copied);
    byId("custom-profile-picker").value = copied.name;
    currentPromptMode = "edit";
    applyPromptMode();
    setStatusMessage("builtin-detail-status", t("copiedToCustom"), "success");
  };
  byId("profile-command-execution-mode").onchange = updateProfileCommandExecutionVisibility;
  byId("profile-save-btn").onclick = saveCustomProfile;
  byId("profile-delete-btn").onclick = deleteCustomProfile;
  byId("profile-diagnose-btn").onclick = diagnoseCustomProfile;
  byId("add-more-pattern-btn").onclick = () => addSimpleListRow("profile-more-list");
  byId("add-error-pattern-btn").onclick = () => addSimpleListRow("profile-error-list");
  byId("add-ignore-error-btn").onclick = () => addSimpleListRow("profile-ignore-list");
  byId("add-prompt-row-btn").onclick = () => addPromptRow();
  byId("add-sys-prompt-row-btn").onclick = () => addSysPromptRow();
  byId("add-interaction-row-btn").onclick = () => addInteractionRow();
  byId("add-transition-row-btn").onclick = () => addTransitionRow();

  byId("template-list").addEventListener("click", async (e) => {
    const row = e.target.closest(".js-template-row");
    if (!row) return;
    const name = row.getAttribute("data-name") || "";
    if (!name) return;
    ensureSelectValue("template-pick-name", name);
    renderTemplateOptions(name);
    renderTemplateList();
    await loadTemplateDetail();
    renderTemplateList();
  });
  byId("template-pick-name").onchange = async () => {
    if (!byId("template-pick-name").value.trim()) return;
    await loadTemplateDetail();
    renderTemplateList();
  };
  byId("template-new-btn").onclick = createTemplateDraft;
  byId("template-save-btn").onclick = saveTemplate;
  byId("template-delete-btn").onclick = deleteTemplate;
  byId("flow-exec-btn").onclick = async () => {
    const out = byId("flow-out");
    if (!ensureConnectionTargetSelected("flow-out", "flow-out")) {
      return;
    }
    out.innerHTML = renderStatusMessageCard(t("running"), "running");
    try {
      const templateSelection = byId("flow-template-name").value.trim();
      if (!templateSelection) {
        throw new Error(t("flowTemplateNameRequired"));
      }
      await ensureFlowRunTemplateDetail(templateSelection, { silent: true });
      const builtinTemplateName = parseBuiltinFlowTemplateValue(templateSelection);
      const payload = {
        template_name: builtinTemplateName ? null : templateSelection,
        builtin_template_name: builtinTemplateName,
        vars: buildFlowVarsPayload(),
        connection: connectionPayload(),
        record_level: recordLevelPayload(),
      };
      const data = await request("POST", "/api/flow/execute", payload);
      out.innerHTML = renderCommandFlowResult(data);
      applyRecordingFromResponse(data);
    } catch (e) {
      out.innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };
  byId("flow-template-name").onchange = async () => {
    const name = byId("flow-template-name").value.trim();
    if (!name) {
      renderFlowTemplateVarFields(null, {});
      return;
    }
    try {
      await ensureFlowRunTemplateDetail(name);
    } catch (_) {
      // The field renderer already shows the error state.
    }
  };
  byId("upload-exec-btn").onclick = async () => {
    const out = byId("upload-out");
    if (!ensureConnectionTargetSelected("upload-out", "upload-out")) {
      return;
    }
    out.innerHTML = renderStatusMessageCard(t("running"), "running");
    try {
      const payload = uploadPayload();
      if (!payload.local_path) {
        throw new Error(t("localPathRequired"));
      }
      if (!payload.remote_path) {
        throw new Error(t("remotePathRequired"));
      }
      const data = await request("POST", "/api/upload", payload);
      out.innerHTML = renderUploadResult(data);
      applyRecordingFromResponse(data);
    } catch (e) {
      out.innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };
  byId("flow-template-list").addEventListener("click", async (e) => {
    const row = e.target.closest(".js-flow-template-row");
    if (!row) return;
    const name = row.getAttribute("data-name") || "";
    if (!name) return;
    ensureSelectValue("flow-template-picker", name);
    renderFlowTemplateList();
    await loadFlowTemplateDetail();
    renderFlowTemplateList();
  });
  byId("flow-template-builtin-list").addEventListener("click", async (e) => {
    const row = e.target.closest(".js-flow-builtin-template-row");
    if (!row) return;
    const name = row.getAttribute("data-name") || "";
    if (!name) return;
    ensureSelectValue("flow-template-builtin-picker", name);
    renderBuiltinFlowTemplateList();
    await loadBuiltinFlowTemplateDetail(name);
    renderBuiltinFlowTemplateList();
  });
  byId("flow-template-picker").onchange = async () => {
    if (!byId("flow-template-picker").value.trim()) return;
    await loadFlowTemplateDetail();
    renderFlowTemplateList();
  };
  byId("flow-template-builtin-picker").onchange = async () => {
    if (!byId("flow-template-builtin-picker").value.trim()) {
      byId("flow-template-builtin-content").value = "";
      renderBuiltinFlowTemplateList();
      return;
    }
    await loadBuiltinFlowTemplateDetail();
    renderBuiltinFlowTemplateList();
  };
  byId("flow-template-new-btn").onclick = createFlowTemplateDraft;
  byId("flow-template-save-btn").onclick = saveFlowTemplate;
  byId("flow-template-delete-btn").onclick = deleteFlowTemplate;
  byId("flow-template-builtin-detail-btn").onclick = () =>
    loadBuiltinFlowTemplateDetail();
  byId("flow-template-builtin-copy-btn").onclick =
    copyBuiltinFlowTemplateToCustom;
  byId("orchestration-template-load-btn").onclick =
    useSelectedOrchestrationTemplateForExecution;

  const bindJsonTemplateListClick = (listId, kind) => {
    const list = byId(listId);
    if (!list) return;
    list.addEventListener("click", async (e) => {
      const row = e.target.closest(".js-json-template-row");
      if (!row) return;
      const manager = row.getAttribute("data-manager") || "";
      if (manager !== kind) return;
      const name = row.getAttribute("data-name") || "";
      if (!name) return;
      const pickerId =
        kind === "tx_block"
          ? "tx-block-template-picker"
          : kind === "tx_workflow"
            ? "tx-workflow-template-picker"
            : "orchestration-template-picker";
      ensureSelectValue(pickerId, name);
      await loadJsonTemplateDetail(kind, name);
      renderJsonTemplateListByKind(kind);
    });
  };
  bindJsonTemplateListClick("tx-block-template-list", "tx_block");
  bindJsonTemplateListClick("tx-workflow-template-list", "tx_workflow");
  bindJsonTemplateListClick("orchestration-template-list", "orchestration");
  byId("tx-block-template-picker").onchange = async () => {
    if (!byId("tx-block-template-picker").value.trim()) return;
    await loadJsonTemplateDetail("tx_block");
    renderJsonTemplateListByKind("tx_block");
  };
  byId("tx-workflow-template-picker").onchange = async () => {
    if (!byId("tx-workflow-template-picker").value.trim()) return;
    await loadJsonTemplateDetail("tx_workflow");
    renderJsonTemplateListByKind("tx_workflow");
  };
  byId("orchestration-template-picker").onchange = async () => {
    if (!byId("orchestration-template-picker").value.trim()) return;
    await loadJsonTemplateDetail("orchestration");
    renderJsonTemplateListByKind("orchestration");
  };
  byId("tx-block-template-new-btn").onclick = () =>
    createJsonTemplateDraftByKind("tx_block");
  byId("tx-workflow-template-new-btn").onclick = () =>
    createJsonTemplateDraftByKind("tx_workflow");
  byId("orchestration-template-new-btn").onclick = () =>
    createJsonTemplateDraftByKind("orchestration");
  byId("tx-block-template-save-btn").onclick = () =>
    saveJsonTemplateByKind("tx_block");
  byId("tx-workflow-template-save-btn").onclick = () =>
    saveJsonTemplateByKind("tx_workflow");
  byId("orchestration-template-save-btn").onclick = () =>
    saveJsonTemplateByKind("orchestration");
  byId("tx-block-template-delete-btn").onclick = () =>
    deleteJsonTemplateByKind("tx_block");
  byId("tx-workflow-template-delete-btn").onclick = () =>
    deleteJsonTemplateByKind("tx_workflow");
  byId("orchestration-template-delete-btn").onclick = () =>
    deleteJsonTemplateByKind("orchestration");
  byId("tx-block-template-use-btn").onclick = () =>
    useJsonTemplateByKind("tx_block");
  byId("tx-workflow-template-use-btn").onclick = () =>
    useJsonTemplateByKind("tx_workflow");
  byId("orchestration-template-use-btn").onclick = () =>
    useJsonTemplateByKind("orchestration");

  byId("backup-create-btn").onclick = createBackupFromWeb;
  byId("backup-refresh-btn").onclick = loadBackups;
  byId("backup-download-btn").onclick = downloadBackupFromWeb;
  byId("backup-restore-merge-btn").onclick = () => restoreBackupFromWeb(false);
  byId("backup-restore-replace-btn").onclick = () => restoreBackupFromWeb(true);
  byId("backup-restore-archive").oninput = (e) => {
    renderBackupOptions(e.target.value || "");
    updateSelectedBackupMeta();
    renderBackupList();
  };
  byId("backup-restore-archive").onchange = () => {
    updateSelectedBackupMeta();
    renderBackupList();
  };
  byId("backup-list").addEventListener("click", (e) => {
    const downloadBtn = e.target.closest(".js-backup-download");
    if (downloadBtn) {
      const path = downloadBtn.getAttribute("data-backup-path") || "";
      selectBackupPath(path);
      downloadBackupFromWeb();
      return;
    }
    const restoreMergeBtn = e.target.closest(".js-backup-restore-merge");
    if (restoreMergeBtn) {
      const path = restoreMergeBtn.getAttribute("data-backup-path") || "";
      selectBackupPath(path);
      restoreBackupFromWeb(false);
      return;
    }
    const restoreReplaceBtn = e.target.closest(".js-backup-restore-replace");
    if (restoreReplaceBtn) {
      const path = restoreReplaceBtn.getAttribute("data-backup-path") || "";
      selectBackupPath(path);
      restoreBackupFromWeb(true);
      return;
    }
    const row = e.target.closest(".js-backup-row");
    if (!row) return;
    const path = row.getAttribute("data-backup-path") || "";
    if (!path) return;
    selectBackupPath(path);
  });
}

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

normalizeFilterPrefs();
normalizeHistoryFilters();
saveFilterPrefs();
saveHistoryFilterPrefs();
bindEvents();
initTopLevelAutocomplete();
initCollapsibleGroups();
txWorkflowBlocks = [createTxWorkflowBlock()];
if (!safeString(byId("tx-workflow-json")?.value || "").trim()) {
  setTxWorkflowEditorJson(defaultTxWorkflowTemplatePayload());
}
if (!safeString(byId("tx-block-json")?.value || "").trim()) {
  setTxBlockEditorJson(defaultTxBlockTemplatePayload());
}
if (typeof setupTxWorkflowJsonEditor === "function") {
  setupTxWorkflowJsonEditor();
}
if (typeof setupTxBlockJsonEditor === "function") {
  setupTxBlockJsonEditor();
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
setStatusMessage("tx-block-template-out", "-", "info");
setStatusMessage("tx-workflow-template-out", "-", "info");
setStatusMessage("orchestration-template-out", "-", "info");
setStatusMessage("inventory-group-out", "-", "info");
setStatusMessage("inventory-resolve-out", "-", "info");
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
updateInteractiveButtons();
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
  prompts: [],
  sys_prompts: [],
  interactions: [],
  transitions: [],
});
refreshExecutionModeOptions();
