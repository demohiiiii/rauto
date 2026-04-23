/**
 * ui/runtime.js - runtime UI interactions
 */

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
  const title = byId("orchestrated-title");
  blockPanel.hidden = !isBlock;
  blockPanel.style.display = isBlock ? "" : "none";
  workflowPanel.hidden = !isWorkflow;
  workflowPanel.style.display = isWorkflow ? "" : "none";
  orchestratePanel.hidden = !isOrchestrate;
  orchestratePanel.style.display = isOrchestrate ? "" : "none";
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
  if (currentInventorySection !== "groups" && currentInventorySection !== "labels") {
    currentInventorySection = "groups";
  }
  const isGroups = currentInventorySection === "groups";
  const groupsPanel = byId("inventory-groups-section");
  const labelsPanel = byId("inventory-labels-section");
  if (groupsPanel) {
    groupsPanel.hidden = !isGroups;
    groupsPanel.style.display = isGroups ? "" : "none";
  }
  if (labelsPanel) {
    labelsPanel.hidden = isGroups;
    labelsPanel.style.display = isGroups ? "none" : "";
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
    enable_password_empty_enter: !!byId("enable-password-empty-enter")?.checked,
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
  if (byId("enable-password-empty-enter")) {
    byId("enable-password-empty-enter").checked = !!connection.enable_password_empty_enter;
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
  const pendingResetTimer = Number(modal?.dataset?.detailModalResetTimer || 0);
  if (pendingResetTimer) {
    window.clearTimeout(pendingResetTimer);
    delete modal.dataset.detailModalResetTimer;
  }
  byId("detail-modal-title").textContent = options.title || t("detailModalTitle");
  if (options.html) {
    body.innerHTML = content;
  } else {
    body.innerHTML = `<pre class="output max-h-[70vh] overflow-auto whitespace-pre-wrap break-all">${escapeHtml(
      safeString(content)
    )}</pre>`;
  }
  if (typeof modal.showModal === "function") {
    if (!modal.open) {
      modal.showModal();
    }
  } else {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
  document.body.classList.add("overflow-hidden");
}

function closeDetailModal() {
  const modal = byId("detail-modal");
  if (typeof modal.close === "function") {
    if (modal.open) {
      modal.close();
    }
  } else {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
  const keepLocked =
    byId("record-drawer")?.classList.contains("open") ||
    byId("history-drawer")?.classList.contains("open") ||
    byId("entry-drawer")?.classList.contains("open");
  if (!keepLocked) {
    document.body.classList.remove("overflow-hidden");
  }
  const pendingResetTimer = Number(modal?.dataset?.detailModalResetTimer || 0);
  if (pendingResetTimer) {
    window.clearTimeout(pendingResetTimer);
  }
  const timerId = window.setTimeout(() => {
    const isStillOpen =
      (typeof modal.open === "boolean" && modal.open) ||
      !modal.classList.contains("hidden");
    if (!isStillOpen) {
      byId("detail-modal-body").innerHTML = "";
      byId("detail-modal-title").textContent = t("detailModalTitle");
    }
    delete modal.dataset.detailModalResetTimer;
  }, 240);
  modal.dataset.detailModalResetTimer = String(timerId);
}
