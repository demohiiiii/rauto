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

function currentTemporaryDetails() {
  return {
    name: safeCall("currentTemporaryConnectionLabel"),
    host: safeString(byId("host")?.value || "").trim() || "-",
    port: Number(byId("port")?.value || 22) || 22,
    username: safeString(byId("username")?.value || "").trim() || "-",
    profile:
      safeString(byId("device_profile")?.value || "autodetect").trim() ||
      "autodetect",
    kind: "temporary",
    note: t("sidebarConnectionTemporaryHint"),
  };
}

function closeConnectionModal() {
  window.closeDashboardConnectionModal?.();
}

function closeLangMenu() {
  window.setDashboardLangMenuOpen?.(false);
}

function bindClick(element, handler) {
  element?.addEventListener("click", handler);
  return () => element?.removeEventListener("click", handler);
}

function bindChange(element, handler) {
  element?.addEventListener("change", handler);
  return () => element?.removeEventListener("change", handler);
}

function bindInputAndChange(element, handler) {
  element?.addEventListener("input", handler);
  element?.addEventListener("change", handler);
  return () => {
    element?.removeEventListener("input", handler);
    element?.removeEventListener("change", handler);
  };
}

function withButtonLoading(id, handler) {
  return safeCall("withButtonLoading", id, handler);
}

function registerDashboardEvents() {
  const cleanup = [];
  const detailModal = byId("detail-modal");
  const entryDrawer = byId("entry-drawer");
  const entryDrawerBackdrop = byId("entry-drawer-backdrop");

  const onDocumentClick = (event) => {
    if (!event.target.closest?.(".dashboard-lang-wrap")) {
      closeLangMenu();
    }

    const detailBtn = event.target.closest(".js-entry-detail-btn");
    if (detailBtn) {
      const id = detailBtn.getAttribute("data-detail-id") || "";
      const entry = runtimeValue("detailEntryMap")?.get?.(id);
      if (entry) safeCall("openEntryDrawer", entry);
    }

    const orchestrationDetailBtn = event.target.closest(
      ".js-orchestration-detail-btn",
    );
    if (orchestrationDetailBtn) {
      const detailId =
        orchestrationDetailBtn.getAttribute("data-orchestration-detail-id") ||
        "";
      const detail = runtimeValue("orchestrationDetailMap")?.get?.(detailId);
      if (detail) safeCall("openOrchestrationDetail", detail);
    }
  };
  document.addEventListener("click", onDocumentClick);
  cleanup.push(() => document.removeEventListener("click", onDocumentClick));

  cleanup.push(
    bindClick(byId("detail-modal-close"), () => safeCall("closeDetailModal")),
  );
  cleanup.push(
    bindClick(byId("entry-drawer-close"), () => safeCall("closeEntryDrawer")),
  );
  cleanup.push(
    bindClick(entryDrawerBackdrop, () => safeCall("closeEntryDrawer")),
  );
  cleanup.push(
    bindClick(entryDrawer, (event) => {
      if (event.target === entryDrawer) safeCall("closeEntryDrawer");
    }),
  );
  cleanup.push(
    bindClick(detailModal, (event) => {
      if (event.target === detailModal) safeCall("closeDetailModal");
    }),
  );

  const onKeydown = (event) => {
    if (event.key !== "Escape") return;

    const savedConnEditModal = byId("saved-conn-edit-modal");
    if (
      savedConnEditModal &&
      !savedConnEditModal.classList.contains("hidden")
    ) {
      safeCall("hideSavedConnectionEditorModal");
      return;
    }
    if (entryDrawer?.classList.contains("open")) {
      safeCall("closeEntryDrawer");
      return;
    }
    closeLangMenu();
    const connectionModal = byId("connection-modal");
    if (connectionModal && !connectionModal.hidden) {
      closeConnectionModal();
      return;
    }
    if (
      (typeof detailModal?.open === "boolean" && detailModal.open) ||
      (detailModal && !detailModal.classList.contains("hidden"))
    ) {
      safeCall("closeDetailModal");
    }
    if (byId("record-drawer")?.classList.contains("open")) {
      safeCall("closeRecordDrawer");
    }
    if (byId("history-drawer")?.classList.contains("open")) {
      safeCall("closeHistoryDrawer");
    }
  };
  document.addEventListener("keydown", onKeydown);
  cleanup.push(() => document.removeEventListener("keydown", onKeydown));

  cleanup.push(
    bindChange(byId("device_profile"), () =>
      safeCall("refreshExecutionModeOptions"),
    ),
  );

  const syncTemporaryConnection = () => {
    if (
      !runtimeValue("temporaryConnectionActive") ||
      typeof window.renderSidebarConnectionSelector !== "function"
    ) {
      return;
    }
    setRuntimeValue("temporaryConnectionLabel", "");
    const details = currentTemporaryDetails();
    setRuntimeValue("temporaryConnectionDetails", details);
    safeCall("setCurrentConnectionTarget", details);
    safeCall("renderSidebarConnectionSelector");
  };
  [
    "host",
    "port",
    "username",
    "password",
    "enable_password",
    "ssh_security",
    "linux_shell_flavor",
    "device_profile",
    "saved-conn-enabled",
    "saved-conn-labels",
    "saved-conn-vars",
    "saved-conn-groups",
  ].forEach((id) =>
    cleanup.push(bindInputAndChange(byId(id), syncTemporaryConnection)),
  );

  cleanup.push(
    bindClick(byId("connection-test-btn"), () =>
      withButtonLoading("connection-test-btn", async () => {
        safeCall(
          "setStatusMessage",
          "connection-test-out",
          t("running"),
          "running",
        );
        try {
          const data = await safeCall(
            "request",
            "POST",
            "/api/connection/test",
            {
              connection: safeCall("connectionPayload"),
            },
          );
          safeCall(
            "setStatusMessage",
            "connection-test-out",
            `${t("connectionOk")}: ${data.username}@${data.host}:${data.port} (${data.device_profile}, ${safeString(data.ssh_security)}, ${safeString(data.linux_shell_flavor || "-")})`,
            "success",
          );
        } catch (error) {
          safeCall(
            "setStatusMessage",
            "connection-test-out",
            error.message,
            "error",
          );
        }
      }),
    ),
  );

  cleanup.push(
    bindClick(byId("saved-conn-template-btn"), () =>
      withButtonLoading("saved-conn-template-btn", () =>
        safeCall("downloadConnectionImportTemplate"),
      ),
    ),
  );
  cleanup.push(
    bindClick(byId("saved-conn-use-btn"), () =>
      withButtonLoading("saved-conn-use-btn", async () => {
        const ok = await safeCall("loadSavedConnectionByName");
        if (ok) closeConnectionModal();
      }),
    ),
  );
  cleanup.push(
    bindClick(byId("saved-conn-edit-btn"), () =>
      withButtonLoading("saved-conn-edit-btn", () =>
        safeCall("openSavedConnectionEditor"),
      ),
    ),
  );
  cleanup.push(
    bindClick(byId("saved-conn-new-btn"), () =>
      withButtonLoading("saved-conn-new-btn", () =>
        safeCall("createSavedConnectionDraft"),
      ),
    ),
  );
  cleanup.push(
    bindClick(byId("connection-temp-apply-btn"), async () => {
      if (byId("saved-conn-name")) byId("saved-conn-name").value = "";
      safeCall("markTemporaryConnectionActive");
      await safeCall("refreshExecutionModeOptions");
      safeCall(
        "setStatusMessage",
        "saved-conn-out",
        t("sidebarConnectionTemporaryApplied"),
        "success",
      );
      closeConnectionModal();
    }),
  );
  cleanup.push(
    bindClick(byId("saved-conn-import-btn"), () =>
      byId("saved-conn-import-file-input")?.click(),
    ),
  );
  cleanup.push(
    bindClick(byId("saved-conn-delete-btn"), () =>
      withButtonLoading("saved-conn-delete-btn", () =>
        safeCall("deleteConnectionByName"),
      ),
    ),
  );
  cleanup.push(
    bindClick(byId("saved-conn-history-btn"), () =>
      withButtonLoading("saved-conn-history-btn", async () => {
        safeCall("openHistoryDrawer");
        await safeCall("loadConnectionHistory");
      }),
    ),
  );

  const importInput = byId("saved-conn-import-file-input");
  const onImportChange = async () => {
    try {
      await safeCall("importConnectionsFromFile");
    } catch (_) {
      // The importer renders its own status.
    }
  };
  importInput?.addEventListener("change", onImportChange);
  cleanup.push(() =>
    importInput?.removeEventListener("change", onImportChange),
  );

  cleanup.push(
    bindClick(byId("saved-conn-edit-close-btn"), () =>
      safeCall("hideSavedConnectionEditorModal"),
    ),
  );
  cleanup.push(
    bindClick(byId("saved-conn-edit-cancel-btn"), () =>
      safeCall("hideSavedConnectionEditorModal"),
    ),
  );
  cleanup.push(
    bindClick(byId("saved-conn-edit-detect-profile-btn"), () =>
      withButtonLoading("saved-conn-edit-detect-profile-btn", () =>
        safeCall("detectSavedConnectionProfile"),
      ),
    ),
  );
  cleanup.push(
    bindClick(byId("saved-conn-edit-apply-detected-profile-btn"), () =>
      withButtonLoading("saved-conn-edit-apply-detected-profile-btn", () =>
        safeCall("replaceSavedConnectionProfileWithDetected"),
      ),
    ),
  );
  cleanup.push(
    bindClick(byId("saved-conn-edit-save-btn"), () =>
      withButtonLoading("saved-conn-edit-save-btn", () =>
        safeCall("saveSavedConnectionEditor"),
      ),
    ),
  );
  cleanup.push(
    bindChange(byId("saved-conn-edit-device-profile"), () =>
      safeCall("updateSavedConnectionAutodetectUi"),
    ),
  );
  [
    "saved-conn-edit-host",
    "saved-conn-edit-port",
    "saved-conn-edit-username",
    "saved-conn-edit-password",
    "saved-conn-edit-enable-password",
    "saved-conn-edit-ssh-security",
    "saved-conn-edit-linux-shell-flavor",
  ].forEach((id) =>
    cleanup.push(
      bindInputAndChange(byId(id), () =>
        safeCall("resetSavedConnectionAutodetectState"),
      ),
    ),
  );

  cleanup.push(
    bindClick(byId("saved-conn-edit-modal"), (event) => {
      if (event.target === byId("saved-conn-edit-modal")) {
        safeCall("hideSavedConnectionEditorModal");
      }
    }),
  );
  cleanup.push(
    bindChange(byId("saved-conn-name"), () =>
      safeCall(
        "renderSavedConnectionOptions",
        byId("saved-conn-name")?.value || "",
      ),
    ),
  );

  cleanup.push(
    bindChange(byId("custom-profile-picker"), async () => {
      if (!byId("custom-profile-picker")?.value.trim()) return;
      await safeCall("loadCustomProfile");
    }),
  );
  cleanup.push(
    bindClick(byId("profile-new-btn"), () =>
      safeCall("createCustomProfileDraft"),
    ),
  );
  cleanup.push(
    bindChange(byId("builtin-profile-select"), () =>
      safeCall("loadBuiltinProfileDetail"),
    ),
  );
  cleanup.push(
    bindClick(byId("builtin-copy-btn"), async () => {
      if (
        !runtimeValue("lastBuiltinProfile") &&
        byId("builtin-profile-select")?.value.trim()
      ) {
        await safeCall("loadBuiltinProfileDetail");
      }
      if (!runtimeValue("lastBuiltinProfile")) {
        safeCall(
          "setStatusMessage",
          "builtin-detail-status",
          t("needLoadBuiltinFirst"),
          "error",
        );
        return;
      }
      const copied = JSON.parse(
        JSON.stringify(runtimeValue("lastBuiltinProfile")),
      );
      copied.name = `${copied.name}_custom`;
      safeCall("setProfileForm", copied);
      if (byId("custom-profile-picker"))
        byId("custom-profile-picker").value = copied.name;
      setRuntimeValue("currentPromptMode", "edit");
      safeCall("applyPromptMode");
      safeCall(
        "setStatusMessage",
        "builtin-detail-status",
        t("copiedToCustom"),
        "success",
      );
    }),
  );

  cleanup.push(
    bindChange(byId("profile-command-execution-mode"), () =>
      safeCall("updateProfileCommandExecutionVisibility"),
    ),
  );
  cleanup.push(
    bindChange(byId("profile-detect-enabled"), () =>
      safeCall("updateProfileDetectVisibility"),
    ),
  );
  cleanup.push(
    bindClick(byId("profile-save-btn"), () => safeCall("saveCustomProfile")),
  );
  cleanup.push(
    bindClick(byId("profile-delete-btn"), () =>
      safeCall("deleteCustomProfile"),
    ),
  );
  cleanup.push(
    bindClick(byId("add-more-pattern-btn"), () =>
      safeCall("addSimpleListRow", "profile-more-list"),
    ),
  );
  cleanup.push(
    bindClick(byId("add-error-pattern-btn"), () =>
      safeCall("addSimpleListRow", "profile-error-list"),
    ),
  );
  cleanup.push(
    bindClick(byId("add-ignore-error-btn"), () =>
      safeCall("addSimpleListRow", "profile-ignore-list"),
    ),
  );
  cleanup.push(
    bindClick(byId("add-prompt-prefix-btn"), () =>
      safeCall("addSimpleListRow", "profile-prompt-prefix-list"),
    ),
  );
  cleanup.push(
    bindClick(byId("add-prompt-row-btn"), () => safeCall("addPromptRow")),
  );
  cleanup.push(
    bindClick(byId("add-sys-prompt-row-btn"), () =>
      safeCall("addSysPromptRow"),
    ),
  );
  cleanup.push(
    bindClick(byId("add-interaction-row-btn"), () =>
      safeCall("addInteractionRow"),
    ),
  );
  cleanup.push(
    bindClick(byId("add-transition-row-btn"), () =>
      safeCall("addTransitionRow"),
    ),
  );
  cleanup.push(
    bindClick(byId("add-detect-initial-rule-btn"), () =>
      safeCall("addDetectRuleRow", byId("detect-initial-rules-list")),
    ),
  );
  cleanup.push(
    bindClick(byId("add-detect-probe-btn"), () =>
      safeCall("addDetectProbeRow"),
    ),
  );
  cleanup.push(
    bindClick(byId("add-after-connect-hook-btn"), () =>
      safeCall("addHookRow", "hooks-after-connect-list"),
    ),
  );
  cleanup.push(
    bindClick(byId("add-before-disconnect-hook-btn"), () =>
      safeCall("addHookRow", "hooks-before-disconnect-list"),
    ),
  );
  cleanup.push(
    bindClick(byId("add-after-enter-state-hook-btn"), () =>
      safeCall("addHookRow", "hooks-after-enter-state-list"),
    ),
  );
  cleanup.push(
    bindClick(byId("add-before-exit-state-hook-btn"), () =>
      safeCall("addHookRow", "hooks-before-exit-state-list"),
    ),
  );

  return () => {
    cleanup.splice(0).forEach((destroy) => destroy());
  };
}

export function appEventsBehavior() {
  let destroyEvents = null;

  window.bindEvents = () => {
    destroyEvents?.();
    destroyEvents = registerDashboardEvents();
  };

  return {
    destroy() {
      destroyEvents?.();
      if (window.bindEvents) {
        delete window.bindEvents;
      }
    },
  };
}
