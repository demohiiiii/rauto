import {
  byId,
  callRuntimeFunction,
  runtimeValue,
  setRuntimeValue,
} from "../services/runtimeGlobals.js";
import {
  setDashboardExecMode,
  setDashboardInventorySection,
  setDashboardPromptMode,
  setDashboardTemplateSection,
  setDashboardTxStage,
} from "../state/dashboardView.js";

function safeString(value) {
  if (typeof window.safeString === "function") return window.safeString(value);
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function escapeHtml(value) {
  if (typeof window.escapeHtml === "function") return window.escapeHtml(value);
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function t(key) {
  if (typeof window.t === "function") return window.t(key);
  return key;
}

function hasSelectedConnectionTarget() {
  const currentConnectionTarget = runtimeValue("currentConnectionTarget");
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
    callRuntimeFunction(
      "setStatusMessage",
      () => undefined,
      statusId,
      message,
      "warning",
    );
  } else {
    callRuntimeFunction("showToast", () => undefined, message, "warning");
  }
  if (outputId) {
    const out = byId(outputId);
    if (out) {
      out.innerHTML = callRuntimeFunction(
        "renderStatusMessageCard",
        () => "",
        message,
        "warning",
      );
    }
  }
  window.onDashboardConnectionModalOpen?.();
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

function applyOperationKind() {
  const currentOpKind = runtimeValue("currentOpKind");
  if (currentOpKind === "tx") {
    applyTxStage();
  }
  if (currentOpKind === "exec") {
    applyExecMode();
  }
}

function applyExecMode() {
  const currentExecMode = runtimeValue("currentExecMode");
  const isTemplate = currentExecMode === "template";
  const isShow = currentExecMode === "show";
  setDashboardExecMode(currentExecMode);
  if (isTemplate && byId("template").value.trim()) {
    loadSelectedTemplateContent();
  }
  if (isShow) {
    const parseTextfsm = byId("parse-textfsm");
    if (parseTextfsm) {
      parseTextfsm.checked = true;
    }
    callRuntimeFunction("loadShowObjects", () => undefined);
  }
}

function applyTxStage() {
  const currentTxStage = runtimeValue("currentTxStage");
  const isBlock = currentTxStage === "block";
  const isWorkflow = currentTxStage === "workflow";
  const isOrchestrate = currentTxStage === "orchestrate";
  const title = byId("orchestrated-title");
  setDashboardTxStage(currentTxStage);
  if (title) {
    title.textContent = callRuntimeFunction(
      "currentOrchestratedStageTitle",
      () => "",
      currentTxStage,
    );
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
  if (!isWorkflow && runtimeValue("txWorkflowEditorModalOpen")) {
    callRuntimeFunction("hideTxWorkflowEditorModal", () => undefined, {
      clearSelection: true,
    });
  }
  callRuntimeFunction("syncTxSharedEditorMount", () => undefined);
}

function applyTxWorkflowViewMode() {
  const txWorkflowViewMode = runtimeValue("txWorkflowViewMode");
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
  if (txWorkflowViewMode === "direct") {
    window.requestAnimationFrame(() => {
      callRuntimeFunction("resizeTxWorkflowJsonEditor", () => undefined);
    });
  }
}

function applyTxBlockViewMode() {
  const txBlockViewMode = runtimeValue("txBlockViewMode");
  const currentTxStage = runtimeValue("currentTxStage");
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
  const orchestrationViewMode = runtimeValue("orchestrationViewMode");
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
  window.requestAnimationFrame(() => {
    callRuntimeFunction("resizeOrchestrationJsonEditor", () => undefined);
  });
}

function applyPromptMode() {
  const currentPromptMode = runtimeValue("currentPromptMode");
  setDashboardPromptMode(currentPromptMode);
}

function applyTemplateSection() {
  let currentTemplateSection = runtimeValue("currentTemplateSection");
  const sections = ["templates", "flows", "textfsm", "show-objects"];
  if (!sections.includes(currentTemplateSection)) {
    currentTemplateSection = "templates";
    setRuntimeValue("currentTemplateSection", currentTemplateSection);
  }
  setDashboardTemplateSection(currentTemplateSection);
}

function applyInventorySection() {
  let currentInventorySection = runtimeValue("currentInventorySection");
  if (
    currentInventorySection !== "groups" &&
    currentInventorySection !== "labels"
  ) {
    currentInventorySection = "groups";
    setRuntimeValue("currentInventorySection", currentInventorySection);
  }
  setDashboardInventorySection(currentInventorySection);
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
    const data = await callRuntimeFunction(
      "request",
      () => Promise.reject(new Error(t("requestFailed"))),
      "GET",
      `/api/templates/${encodeURIComponent(name)}`,
    );
    preview.value = data.content || "";
  } catch (e) {
    preview.value = "";
    out.innerHTML = callRuntimeFunction(
      "renderStatusMessageCard",
      () => "",
      e.message,
      "error",
    );
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
    labels: callRuntimeFunction(
      "getConnectionLabelValues",
      () =>
        callRuntimeFunction(
          "splitCsvValues",
          () => [],
          byId("saved-conn-labels")?.value || "",
        ),
      "saved-conn-labels",
    ),
    groups: callRuntimeFunction(
      "getConnectionGroupValues",
      () =>
        callRuntimeFunction(
          "getMultiSelectValues",
          () => [],
          "saved-conn-groups",
        ),
      "saved-conn-groups",
    ),
    vars: callRuntimeFunction(
      "getConnectionVarsValue",
      () => callRuntimeFunction("parseJsonById", () => ({}), "saved-conn-vars"),
      "saved-conn-vars",
    ),
  };
}

function recordLevelPayload() {
  return callRuntimeFunction(
    "normalizeRecordLevel",
    (value) => value || "none",
    byId("record-level")?.value ||
      byId("record-level-toggle-btn")?.dataset.level,
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
  byId("linux_shell_flavor").value = safeString(
    connection.linux_shell_flavor || "",
  );
  byId("device_profile").value = safeString(connection.device_profile || "");
  if (byId("saved-conn-enabled")) {
    byId("saved-conn-enabled").checked = connection.enabled !== false;
  }
  callRuntimeFunction(
    "setConnectionPickerValues",
    () => undefined,
    "saved-conn-labels",
    Array.isArray(connection.labels) ? connection.labels : [],
    false,
  );
  callRuntimeFunction(
    "renderSavedConnectionGroupOptions",
    () => undefined,
    Array.isArray(connection.groups) ? connection.groups : [],
  );
  callRuntimeFunction(
    "setConnectionVarsValue",
    () => {
      if (byId("saved-conn-vars")) {
        byId("saved-conn-vars").value = JSON.stringify(connection.vars || {});
      }
    },
    "saved-conn-vars",
    connection.vars || {},
    false,
  );
  callRuntimeFunction("renderSidebarConnectionSelector", () => undefined);
}

function initAutocomplete(inputId, sourceFn) {
  const input = byId(inputId);
  if (!input) return;

  const menu = document.createElement("div");
  menu.className = "autocomplete-menu";
  menu.hidden = true;
  document.body.appendChild(menu);
  runtimeValue("autocompleteMenus")?.push?.(menu);

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
    items = all
      .filter((name) => (!q ? true : name.toLowerCase().includes(q)))
      .slice(0, 24);
    if (items.length === 0) {
      hide();
      return;
    }
    menu.innerHTML = "";
    items.forEach((name, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        idx === activeIndex
          ? "autocomplete-item is-active"
          : "autocomplete-item";
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
    true,
  );
}

function initTopLevelAutocomplete() {
  initAutocomplete("template", () => runtimeValue("cachedTemplates"));
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
  byId("detail-modal-title").textContent =
    options.title || t("detailModalTitle");
  if (options.html) {
    body.innerHTML = content;
  } else {
    body.innerHTML = `<pre class="output max-h-[70vh] overflow-auto whitespace-pre-wrap break-all">${escapeHtml(
      safeString(content),
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

export function installUiInteractionRuntime() {
  Object.assign(window, {
    hasSelectedConnectionTarget,
    ensureConnectionTargetSelected,
    updateRecordFabVisibility,
    updateRecordFabBadge,
    openRecordDrawer,
    closeRecordDrawer,
    openHistoryDrawer,
    closeHistoryDrawer,
    applyOperationKind,
    applyExecMode,
    applyTxStage,
    applyTxWorkflowViewMode,
    applyTxBlockViewMode,
    applyOrchestrationViewMode,
    applyPromptMode,
    applyTemplateSection,
    applyInventorySection,
    loadSelectedTemplateContent,
    connectionPayload,
    recordLevelPayload,
    applyConnectionForm,
    initAutocomplete,
    initTopLevelAutocomplete,
    initCollapsibleGroups,
    openDetailModal,
    closeDetailModal,
  });
}
