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
    const txDeleteBtn = e.target.closest(".js-tx-workflow-delete-block");
    if (txDeleteBtn) {
      const blockId = txDeleteBtn.getAttribute("data-tx-block-id") || "";
      if (blockId) {
        txWorkflowBlocks = txWorkflowBlocks.filter((b) => b.id !== blockId);
        renderTxWorkflowBuilder();
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
    const txRollbackModeBtn = e.target.closest(".js-tx-workflow-rollback-mode");
    if (txRollbackModeBtn) {
      const blockId = txRollbackModeBtn.getAttribute("data-tx-block-id") || "";
      const mode = txRollbackModeBtn.getAttribute("data-mode") || "text";
      const item = txWorkflowBlocks.find((b) => b.id === blockId);
      if (item) {
        item.rollbackInputMode = mode === "pairs" ? "pairs" : "text";
        renderTxWorkflowBuilder();
      }
    }
    const txRollbackAutoBtn = e.target.closest(".js-tx-workflow-rollback-auto");
    if (txRollbackAutoBtn) {
      const blockId = txRollbackAutoBtn.getAttribute("data-tx-block-id") || "";
      const item = txWorkflowBlocks.find((b) => b.id === blockId);
      if (item) {
        const commands = txWorkflowLines(item.commandsText);
        const rollbacks = commands.map((cmd) =>
          buildRollbackCommand(item.rollbackRule, cmd, item.rollbackRuleTemplate)
        );
        item.rollbackCommandsText = rollbacks.join("\n");
        item.rollbackInputMode = "pairs";
        renderTxWorkflowBuilder();
      }
    }
    const txRollbackSaveBtn = e.target.closest(".js-tx-workflow-rollback-template-save");
    if (txRollbackSaveBtn) {
      const blockId = txRollbackSaveBtn.getAttribute("data-tx-block-id") || "";
      const item = txWorkflowBlocks.find((b) => b.id === blockId);
      if (!item) return;
      const nameEl = document.querySelector(
        `.js-tx-workflow-rollback-template-name[data-tx-block-id="${blockId}"]`
      );
      const name = nameEl ? nameEl.value.trim() : "";
      const template = String(item.rollbackRuleTemplate || "").trim();
      if (name && template) {
        upsertRollbackTemplate(name, template);
        item.rollbackLibraryName = name;
        renderTxWorkflowBuilder();
      }
    }
    const txRollbackDeleteBtn = e.target.closest(
      ".js-tx-workflow-rollback-template-delete"
    );
    if (txRollbackDeleteBtn) {
      const blockId = txRollbackDeleteBtn.getAttribute("data-tx-block-id") || "";
      const item = txWorkflowBlocks.find((b) => b.id === blockId);
      if (!item) return;
      const nameEl = document.querySelector(
        `.js-tx-workflow-rollback-template-name[data-tx-block-id="${blockId}"]`
      );
      const name = nameEl ? nameEl.value.trim() : "";
      if (name) {
        deleteRollbackTemplate(name);
        if (item.rollbackLibraryName === name) {
          item.rollbackLibraryName = "";
        }
        renderTxWorkflowBuilder();
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

  byId("device_profile").addEventListener("change", () => {
    refreshExecutionModeOptions();
  });
  ["host", "port", "username", "password", "enable_password", "ssh_security", "device_profile"].forEach((id) => {
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
  byId("tx-advanced-toggle-btn").onclick = () => {
    txAdvancedExpanded = !txAdvancedExpanded;
    applyTxLayoutState();
  };
  byId("tx-workflow-more-btn").onclick = () => {
    txWorkflowMoreExpanded = !txWorkflowMoreExpanded;
    applyTxWorkflowMoreActionsState();
  };

  byId("connection-test-btn").onclick = async () => {
    setStatusMessage("connection-test-out", t("running"), "running");
    try {
      const data = await request("POST", "/api/connection/test", {
        connection: connectionPayload(),
      });
    setStatusMessage(
      "connection-test-out",
      `${t("connectionOk")}: ${data.username}@${data.host}:${data.port} (${data.device_profile}, ${safeString(data.ssh_security)})`,
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
  byId("saved-conn-save-btn").onclick = saveConnectionByName;
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
  byId("saved-conn-name").oninput = (e) => {
    renderSavedConnectionOptions(e.target.value);
  };
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
      });
      out.textContent = data.rendered_commands;
    } catch (e) {
      out.innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };

  byId("exec-btn").onclick = async () => {
    const out = byId("exec-out");
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

  byId("tx-plan-btn").onclick = async () => {
    const execOut = byId("tx-exec-out");
    const visualOut = byId("tx-block-visual");
    setStatusMessage("tx-plan-out", t("running"), "running");
    try {
      const data = await request("POST", "/api/tx/block", txPayload(true));
      setTxBlockVisual(data && data.tx_block ? data.tx_block : {}, null);
      setStatusMessage("tx-plan-out", t("txBlockPreviewDone"), "success");
      execOut.innerHTML = "";
    } catch (e) {
      setStatusMessage("tx-plan-out", e.message, "error");
      if (visualOut) {
        visualOut.innerHTML = renderStatusMessageCard(e.message, "error");
      }
    }
  };

  byId("tx-exec-btn").onclick = async () => {
    const visualOut = byId("tx-block-visual");
    setStatusMessage("tx-exec-out", t("running"), "running");
    try {
      const data = await request("POST", "/api/tx/block", txPayload(false));
      setTxBlockVisual(
        data && data.tx_block ? data.tx_block : {},
        data && data.tx_result ? data.tx_result : {}
      );
      setStatusMessage("tx-exec-out", t("txBlockExecuteDone"), "success");
      applyRecordingFromResponse(data);
    } catch (e) {
      setStatusMessage("tx-exec-out", e.message, "error");
      if (visualOut) {
        visualOut.innerHTML = renderStatusMessageCard(e.message, "error");
      }
    }
  };

  byId("tx-workflow-plan-btn").onclick = async () => {
    const visualOut = byId("tx-workflow-plan-visual");
    setStatusMessage("tx-workflow-plan-out", t("running"), "running");
    try {
      const data = await request("POST", "/api/tx/workflow", txWorkflowPayload(true));
      const workflow = data && data.workflow ? data.workflow : {};
      byId("tx-workflow-json").value = JSON.stringify(workflow, null, 2);
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
  byId("orchestration-import-file-input").onchange = async () => {
    try {
      await importOrchestrationFromFile();
    } catch (e) {
      setStatusMessage("orchestration-plan-out", e.message, "error");
    }
  };
  byId("tx-workflow-import-block-btn").onclick = importTxBlockIntoWorkflowBuilder;
  byId("tx-workflow-add-block-btn").onclick = () => {
    txWorkflowBlocks.push(createTxWorkflowBlock());
    renderTxWorkflowBuilder();
  };
  byId("tx-workflow-collapse-all-btn").onclick = () => {
    setAllTxWorkflowBlocksCollapsed(true);
  };
  byId("tx-workflow-expand-all-btn").onclick = () => {
    setAllTxWorkflowBlocksCollapsed(false);
  };
  byId("tx-workflow-filter-kind").onchange = () => {
    txWorkflowFilterKind = byId("tx-workflow-filter-kind").value || "all";
    renderTxWorkflowBuilder();
  };
  byId("tx-workflow-filter-rollback").onchange = () => {
    txWorkflowFilterRollback = byId("tx-workflow-filter-rollback").value || "all";
    renderTxWorkflowBuilder();
  };
  byId("tx-workflow-filter-query").oninput = () => {
    txWorkflowFilterQuery = byId("tx-workflow-filter-query").value || "";
    renderTxWorkflowBuilder();
  };
  byId("tx-workflow-filter-clear-btn").onclick = () => {
    txWorkflowFilterKind = "all";
    txWorkflowFilterRollback = "all";
    txWorkflowFilterQuery = "";
    byId("tx-workflow-filter-kind").value = "all";
    byId("tx-workflow-filter-rollback").value = "all";
    byId("tx-workflow-filter-query").value = "";
    renderTxWorkflowBuilder();
  };
  byId("tx-rollback-mode").onchange = () => {
    applyTxRollbackMode();
  };
  byId("tx-rollback-input-text").onclick = () => {
    txRollbackInputMode = "text";
    applyTxRollbackInputMode();
  };
  byId("tx-rollback-input-pairs").onclick = () => {
    txRollbackInputMode = "pairs";
    applyTxRollbackInputMode();
  };
  byId("tx-commands").addEventListener("change", () => {
    renderTxRollbackPairs();
  });
  byId("tx-rollback-commands").addEventListener("input", () => {
    if (txRollbackInputMode === "pairs") {
      renderTxRollbackPairs();
    }
  });
  byId("tx-rollback-pairs").addEventListener("input", (e) => {
    const pairEl = e.target.closest(".js-tx-rollback-pair");
    if (!pairEl) return;
    const idxRaw = pairEl.getAttribute("data-index");
    const idx = idxRaw ? Number(idxRaw) : NaN;
    if (!Number.isFinite(idx)) return;
    const lines = parseRollbackLinesRaw(byId("tx-rollback-commands").value || "");
    while (lines.length <= idx) lines.push("");
    lines[idx] = pairEl.value || "";
    byId("tx-rollback-commands").value = lines.join("\n");
  });
  byId("tx-rollback-auto-btn").onclick = () => {
    const rule = byId("tx-rollback-rule").value || "no_prefix";
    const tpl = byId("tx-rollback-template").value || "";
    const commands = parseTxCommands();
    const rollbacks = commands.map((cmd) => buildRollbackCommand(rule, cmd, tpl));
    byId("tx-rollback-commands").value = rollbacks.join("\n");
    txRollbackInputMode = "pairs";
    applyTxRollbackInputMode();
  };
  byId("tx-rollback-rule").onchange = () => {
    applyTxRollbackRuleVisibility();
  };
  byId("tx-rollback-template-pick").onchange = () => {
    const name = byId("tx-rollback-template-pick").value || "";
    const found = rollbackTemplateLibrary.find((t) => t.name === name);
    if (found) {
      byId("tx-rollback-rule").value = "custom";
      byId("tx-rollback-template").value = found.template;
      byId("tx-rollback-template-name").value = found.name;
      byId("tx-rollback-template").hidden = false;
      byId("tx-rollback-template").style.display = "";
    }
  };
  byId("tx-rollback-template-save").onclick = () => {
    const name = byId("tx-rollback-template-name").value || "";
    const template = byId("tx-rollback-template").value || "";
    upsertRollbackTemplate(name, template);
    byId("tx-rollback-template-pick").innerHTML = rollbackTemplateOptionsHtml(name);
  };
  byId("tx-rollback-template-delete").onclick = () => {
    const name = byId("tx-rollback-template-name").value || "";
    deleteRollbackTemplate(name);
    byId("tx-rollback-template-pick").innerHTML = rollbackTemplateOptionsHtml("");
  };
  byId("tx-workflow-generate-btn").onclick = () => {
    try {
      generateTxWorkflowJsonFromBuilder();
    } catch (e) {
      setStatusMessage("tx-workflow-plan-out", e.message, "error");
    }
  };
  byId("tx-workflow-load-btn").onclick = () => {
    try {
      loadTxWorkflowBuilderFromJson();
    } catch (e) {
      setStatusMessage("tx-workflow-plan-out", e.message, "error");
    }
  };
  byId("tx-workflow-download-btn").onclick = () => {
    try {
      downloadTxWorkflowJsonFromBuilder();
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
      await importTxWorkflowBuilderFromFile();
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
  const txWorkflowBlocksWrap = byId("tx-workflow-blocks");
  txWorkflowBlocksWrap.addEventListener("input", (e) => {
    const pairEl = e.target.closest(".js-tx-workflow-rollback-pair");
    if (pairEl) {
      const id = pairEl.getAttribute("data-tx-block-id");
      const idxRaw = pairEl.getAttribute("data-index");
      const idx = idxRaw ? Number(idxRaw) : NaN;
      if (!id || !Number.isFinite(idx)) return;
      const item = txWorkflowBlocks.find((b) => b.id === id);
      if (!item) return;
      const lines = parseRollbackLinesRaw(item.rollbackCommandsText);
      while (lines.length <= idx) lines.push("");
      lines[idx] = pairEl.value || "";
      item.rollbackCommandsText = lines.join("\n");
      return;
    }

    const ruleEl = e.target.closest(".js-tx-workflow-rollback-rule");
    if (ruleEl) {
      const id = ruleEl.getAttribute("data-tx-block-id");
      const item = txWorkflowBlocks.find((b) => b.id === id);
      if (item) {
        item.rollbackRule = ruleEl.value || "no_prefix";
        renderTxWorkflowBuilder();
      }
      return;
    }

    const tplEl = e.target.closest(".js-tx-workflow-rollback-template");
    if (tplEl) {
      const id = tplEl.getAttribute("data-tx-block-id");
      const item = txWorkflowBlocks.find((b) => b.id === id);
      if (item) {
        item.rollbackRuleTemplate = tplEl.value || "";
      }
      return;
    }

    const el = e.target;
    const id = el.getAttribute("data-tx-block-id");
    const field = el.getAttribute("data-field");
    if (!id || !field) return;
    const item = txWorkflowBlocks.find((b) => b.id === id);
    if (!item) return;
    item[field] = el.type === "checkbox" ? el.checked : el.value;
  });
  txWorkflowBlocksWrap.addEventListener("change", (e) => {
    const fieldEl = e.target.closest(".js-tx-workflow-field");
    if (fieldEl) {
      const id = fieldEl.getAttribute("data-tx-block-id");
      const field = fieldEl.getAttribute("data-field");
      const item = txWorkflowBlocks.find((b) => b.id === id);
      if (item && (field === "commandsText" || field === "rollbackPolicy")) {
        if (field === "rollbackPolicy") {
          item.rollbackPolicy = fieldEl.value;
          renderTxWorkflowBuilder();
          return;
        }
        if (field === "commandsText" && item.rollbackInputMode === "pairs") {
          renderTxWorkflowBuilder();
          return;
        }
      }
    }
    const pickEl = e.target.closest(".js-tx-workflow-rollback-template-pick");
    if (!pickEl) return;
    const id = pickEl.getAttribute("data-tx-block-id");
    const item = txWorkflowBlocks.find((b) => b.id === id);
    if (!item) return;
    const name = pickEl.value || "";
    item.rollbackLibraryName = name;
    const found = rollbackTemplateLibrary.find((t) => t.name === name);
    if (found) {
      item.rollbackRule = "custom";
      item.rollbackRuleTemplate = found.template;
    }
    renderTxWorkflowBuilder();
  });
  txWorkflowBlocksWrap.addEventListener("dragstart", (e) => {
    const handle = e.target.closest(".js-tx-workflow-drag-block");
    if (!handle) return;
    txWorkflowDragBlockId = handle.getAttribute("data-tx-block-id") || "";
    if (!txWorkflowDragBlockId) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", txWorkflowDragBlockId);
  });
  txWorkflowBlocksWrap.addEventListener("dragover", (e) => {
    const card = e.target.closest("[data-tx-block-id]");
    if (!card) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    autoScrollDuringDrag(e, txWorkflowBlocksWrap);
    clearTxWorkflowDropMarkers(txWorkflowBlocksWrap);
    const rect = card.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    card.classList.add("tx-workflow-drop-target");
    card.classList.add(after ? "tx-workflow-drop-after" : "tx-workflow-drop-before");
  });
  txWorkflowBlocksWrap.addEventListener("dragleave", (e) => {
    if (e.target === txWorkflowBlocksWrap) {
      clearTxWorkflowDropMarkers(txWorkflowBlocksWrap);
    }
  });
  txWorkflowBlocksWrap.addEventListener("drop", (e) => {
    const card = e.target.closest("[data-tx-block-id]");
    if (!card) return;
    e.preventDefault();
    const rect = card.getBoundingClientRect();
    const insertAfter = e.clientY > rect.top + rect.height / 2;
    const targetId = card.getAttribute("data-tx-block-id") || "";
    const sourceId =
      txWorkflowDragBlockId ||
      (e.dataTransfer ? e.dataTransfer.getData("text/plain") : "");
    if (!sourceId || !targetId || sourceId === targetId) {
      clearTxWorkflowDropMarkers(txWorkflowBlocksWrap);
      return;
    }
    const from = txWorkflowBlocks.findIndex((b) => b.id === sourceId);
    const to = txWorkflowBlocks.findIndex((b) => b.id === targetId);
    if (from < 0 || to < 0) {
      clearTxWorkflowDropMarkers(txWorkflowBlocksWrap);
      return;
    }
    const [moved] = txWorkflowBlocks.splice(from, 1);
    let insertAt = to + (insertAfter ? 1 : 0);
    if (from < insertAt) {
      insertAt -= 1;
    }
    txWorkflowBlocks.splice(insertAt, 0, moved);
    txWorkflowDragBlockId = "";
    clearTxWorkflowDropMarkers(txWorkflowBlocksWrap);
    renderTxWorkflowBuilder();
  });
  txWorkflowBlocksWrap.addEventListener("dragend", () => {
    txWorkflowDragBlockId = "";
    clearTxWorkflowDropMarkers(txWorkflowBlocksWrap);
  });

  byId("template").onchange = loadSelectedTemplateContent;
  byId("record-enable").onchange = () => {
    byId("record-level").disabled = byId("record-enable").checked;
  };
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
  byId("custom-profile-picker").oninput = (e) => {
    renderCustomProfileOptions(e.target.value);
  };
  byId("custom-profile-picker").onchange = async () => {
    if (!byId("custom-profile-picker").value.trim()) return;
    await loadCustomProfile();
  };
  byId("profile-diagnose-picker").oninput = (e) => {
    renderDiagnoseProfileOptions(e.target.value);
  };
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

  byId("template-pick-name").oninput = (e) => {
    renderTemplateOptions(e.target.value);
    renderTemplateList();
  };
  byId("template-list").addEventListener("click", async (e) => {
    const row = e.target.closest(".js-template-row");
    if (!row) return;
    const name = row.getAttribute("data-name") || "";
    if (!name) return;
    byId("template-pick-name").value = name;
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
  byId("template-save-btn").onclick = saveTemplate;
  byId("template-delete-btn").onclick = deleteTemplate;
  byId("flow-exec-btn").onclick = async () => {
    const out = byId("flow-out");
    out.innerHTML = renderStatusMessageCard(t("running"), "running");
    try {
      const templateName = byId("flow-template-name").value.trim();
      if (!templateName) {
        throw new Error(t("flowTemplateNameRequired"));
      }
      await ensureFlowRunTemplateDetail(templateName, { silent: true });
      const payload = {
        template_name: templateName,
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
  byId("flow-template-name").oninput = () => {
    const name = byId("flow-template-name").value.trim();
    if (!name) {
      renderFlowTemplateVarFields(null, {});
      return;
    }
    if (lastFlowRunTemplateDetail && lastFlowRunTemplateDetail.name !== name) {
      renderFlowTemplateVarFields(null, {});
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
  byId("flow-template-picker").oninput = () => {
    renderFlowTemplateList();
  };
  byId("flow-template-list").addEventListener("click", async (e) => {
    const row = e.target.closest(".js-flow-template-row");
    if (!row) return;
    const name = row.getAttribute("data-name") || "";
    if (!name) return;
    byId("flow-template-picker").value = name;
    renderFlowTemplateList();
    await loadFlowTemplateDetail();
    renderFlowTemplateList();
  });
  byId("flow-template-picker").onchange = async () => {
    if (!byId("flow-template-picker").value.trim()) return;
    await loadFlowTemplateDetail();
    renderFlowTemplateList();
  };
  byId("flow-template-load-btn").onclick = loadFlowTemplateDetail;
  byId("flow-template-save-btn").onclick = saveFlowTemplate;
  byId("flow-template-delete-btn").onclick = deleteFlowTemplate;

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
};

window.onAlpineTabChange = function onAlpineTabChange(tab) {
  currentTab = tab;
  applyTabs();
  if (tab === "standard" || tab === "orchestrated") {
    loadFlowTemplates();
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
  }
  if (tab === "blacklist") {
    loadBlacklistPatterns();
  }
  if (tab === "backup") {
    loadBackups();
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

window.onAlpineTxBlockRunKindChange = function onAlpineTxBlockRunKindChange(kind) {
  currentTxBlockRunKind = kind;
  applyTxBlockRunKind();
};

window.onAlpinePromptModeChange = function onAlpinePromptModeChange(mode) {
  currentPromptMode = mode;
  applyPromptMode();
};

window.onAlpineTemplateSectionChange = function onAlpineTemplateSectionChange(section) {
  currentTemplateSection = section;
  applyTemplateSection();
};

normalizeFilterPrefs();
normalizeHistoryFilters();
saveFilterPrefs();
saveHistoryFilterPrefs();
bindEvents();
initTopLevelAutocomplete();
initCollapsibleGroups();
loadRollbackTemplateLibrary();
txWorkflowBlocks = [createTxWorkflowBlock()];
byId("tx-workflow-name").value = "tx-workflow";
byId("tx-workflow-fail-fast").checked = true;
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
setStatusMessage("blacklist-out", "-", "info");
setStatusMessage("backup-out", "-", "info");
setStatusMessage("builtin-detail-status", "-", "info");
setStatusMessage("profile-out", "-", "info");
setStatusMessage("profile-diagnose-out", "-", "info");
renderBlacklistCheckResult();
applyTabs();
applyOperationKind();
applyPromptMode();
resetDiagnoseView();
updateInteractiveButtons();
updateRecordFabVisibility();
byId("record-level").disabled = byId("record-enable").checked;
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
