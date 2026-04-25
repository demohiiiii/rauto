/**
 * app_events.js - Event bindings
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
    const inventoryLabelRow = e.target.closest(".js-inventory-label-row");
    if (inventoryLabelRow) {
      const name = inventoryLabelRow.getAttribute("data-name") || "";
      ensureSelectValue("inventory-label-picker", name);
      loadInventoryLabelDetail();
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
    if (
      e.key === "Escape" &&
      ((typeof detailModal.open === "boolean" && detailModal.open) ||
        !detailModal.classList.contains("hidden"))
    ) {
      closeDetailModal();
    }
    if (e.key === "Escape" && byId("record-drawer").classList.contains("open")) {
      closeRecordDrawer();
    }
    if (e.key === "Escape" && byId("history-drawer").classList.contains("open")) {
      closeHistoryDrawer();
    }
  });

  if (typeof bindRecordingHistoryTaskEvents === "function") {
    bindRecordingHistoryTaskEvents();
  }

  byId("device_profile").addEventListener("change", () => {
    refreshExecutionModeOptions();
  });
  [
    "host",
    "port",
    "username",
    "password",
    "enable_password",
    "ssh_security",
    "linux_shell_flavor",
    "device_profile",
    "enable-password-empty-enter",
    "saved-conn-enabled",
    "saved-conn-labels",
    "saved-conn-vars",
    "saved-conn-groups",
  ].forEach((id) => {
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
  if (typeof bindTxExecutionEvents === "function") {
    bindTxExecutionEvents();
  }

  byId("connection-test-btn").onclick = () =>
    withButtonLoading("connection-test-btn", async () => {
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
    });
  byId("saved-conn-template-btn").onclick = () =>
    withButtonLoading("saved-conn-template-btn", async () => {
      await downloadConnectionImportTemplate();
    });
  byId("saved-conn-use-btn").onclick = () =>
    withButtonLoading("saved-conn-use-btn", async () => {
      const ok = await loadSavedConnectionByName();
      if (!ok) return;
      try {
        if (window.Alpine && typeof window.Alpine.store === "function") {
          window.Alpine.store("app").closeConnectionModal();
        }
      } catch (_) {}
    });
  byId("saved-conn-edit-btn").onclick = () =>
    withButtonLoading("saved-conn-edit-btn", async () => {
      await openSavedConnectionEditor();
    });
  byId("saved-conn-new-btn").onclick = () =>
    withButtonLoading("saved-conn-new-btn", async () => {
      await createSavedConnectionDraft();
    });
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
  byId("saved-conn-delete-btn").onclick = () =>
    withButtonLoading("saved-conn-delete-btn", async () => {
      await deleteConnectionByName();
    });
  byId("saved-conn-history-btn").onclick = () =>
    withButtonLoading("saved-conn-history-btn", async () => {
      openHistoryDrawer();
      await loadConnectionHistory();
    });
  byId("saved-conn-import-file-input").onchange = async () => {
    try {
      await importConnectionsFromFile();
    } catch (_) {}
  };
  byId("saved-conn-edit-close-btn").onclick = hideSavedConnectionEditorModal;
  byId("saved-conn-edit-cancel-btn").onclick = hideSavedConnectionEditorModal;
  byId("saved-conn-edit-save-btn").onclick = () =>
    withButtonLoading("saved-conn-edit-save-btn", async () => {
      await saveSavedConnectionEditor();
    });
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
  byId("inventory-label-picker").onchange = loadInventoryLabelDetail;
  byId("inventory-label-new-btn").onclick = createInventoryLabelDraft;
  byId("inventory-label-save-btn").onclick = saveInventoryLabel;
  byId("inventory-label-delete-btn").onclick = deleteInventoryLabel;
  byId("inventory-label-hosts-filter").oninput = onInventoryLabelHostFilterInput;
  byId("inventory-label-hosts-select-all-btn").onclick = selectAllInventoryLabelHosts;
  byId("inventory-label-hosts-clear-btn").onclick = clearInventoryLabelHostsSelection;
  byId("inventory-label-hosts").addEventListener("change", onInventoryLabelHostSelectionChange);
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

  byId("render-btn").onclick = () =>
    withButtonLoading("render-btn", async () => {
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
    });

  byId("exec-btn").onclick = () =>
    withButtonLoading("exec-btn", async () => {
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
    });

  byId("template-exec-btn").onclick = () =>
    withButtonLoading("template-exec-btn", async () => {
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
    });

  byId("custom-profile-picker").onchange = async () => {
    if (!byId("custom-profile-picker").value.trim()) return;
    await loadCustomProfile();
  };
  byId("profile-new-btn").onclick = createCustomProfileDraft;
  byId("builtin-profile-select").onchange = async () => {
    await loadBuiltinProfileDetail();
  };
  byId("builtin-copy-btn").onclick = async () => {
    if (!lastBuiltinProfile && byId("builtin-profile-select").value.trim()) {
      await loadBuiltinProfileDetail();
    }
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
  byId("profile-diagnose-btn").onclick = () =>
    withButtonLoading("profile-diagnose-btn", async () => {
      await diagnoseCustomProfile();
    });
  byId("add-more-pattern-btn").onclick = () => addSimpleListRow("profile-more-list");
  byId("add-error-pattern-btn").onclick = () => addSimpleListRow("profile-error-list");
  byId("add-ignore-error-btn").onclick = () => addSimpleListRow("profile-ignore-list");
  byId("add-prompt-prefix-btn").onclick = () => addSimpleListRow("profile-prompt-prefix-list");
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
  byId("flow-exec-btn").onclick = () =>
    withButtonLoading("flow-exec-btn", async () => {
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
    });
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
  byId("upload-exec-btn").onclick = () =>
    withButtonLoading("upload-exec-btn", async () => {
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
    });
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
  byId("backup-create-btn").onclick = () =>
    withButtonLoading("backup-create-btn", async () => {
      await createBackupFromWeb();
    });
  byId("backup-refresh-btn").onclick = () =>
    withButtonLoading("backup-refresh-btn", async () => {
      await loadBackups();
    });
  byId("backup-download-btn").onclick = () =>
    withButtonLoading("backup-download-btn", async () => {
      await downloadBackupFromWeb();
    });
  byId("backup-restore-merge-btn").onclick = () =>
    withButtonLoading("backup-restore-merge-btn", async () => {
      await restoreBackupFromWeb(false);
    });
  byId("backup-restore-replace-btn").onclick = () =>
    withButtonLoading("backup-restore-replace-btn", async () => {
      await restoreBackupFromWeb(true);
    });
  byId("backup-restore-archive").oninput = (e) => {
    renderBackupOptions(e.target.value || "");
    updateSelectedBackupMeta();
    renderBackupList();
  };
  byId("backup-restore-archive").onchange = () => {
    updateSelectedBackupMeta();
    renderBackupList();
  };
  byId("backup-list").addEventListener("click", async (e) => {
    const downloadBtn = e.target.closest(".js-backup-download");
    if (downloadBtn) {
      const path = downloadBtn.getAttribute("data-backup-path") || "";
      selectBackupPath(path);
      await withButtonLoading(downloadBtn, async () => {
        await downloadBackupFromWeb();
      });
      return;
    }
    const restoreMergeBtn = e.target.closest(".js-backup-restore-merge");
    if (restoreMergeBtn) {
      const path = restoreMergeBtn.getAttribute("data-backup-path") || "";
      selectBackupPath(path);
      await withButtonLoading(restoreMergeBtn, async () => {
        await restoreBackupFromWeb(false);
      });
      return;
    }
    const restoreReplaceBtn = e.target.closest(".js-backup-restore-replace");
    if (restoreReplaceBtn) {
      const path = restoreReplaceBtn.getAttribute("data-backup-path") || "";
      selectBackupPath(path);
      await withButtonLoading(restoreReplaceBtn, async () => {
        await restoreBackupFromWeb(true);
      });
      return;
    }
    const row = e.target.closest(".js-backup-row");
    if (!row) return;
    const path = row.getAttribute("data-backup-path") || "";
    if (!path) return;
    selectBackupPath(path);
  });
}
