import {
  createTemplateResource,
  deleteTemplateResource,
  getTemplateResource,
  listTemplateResource,
  updateTemplateResource,
} from "../api/client.js";

const JSON_TEMPLATE_MANAGERS = {
  tx_block: {
    apiBase: "/api/tx-block-templates",
    runSelectId: "tx-block-template-name",
    emptyKey: "txBlockTemplateListEmpty",
    newPromptKey: "txBlockTemplateNewPrompt",
    nameRequiredKey: "txBlockTemplateNameRequired",
    runOutId: "tx-plan-out",
    runEditorId: "tx-block-json",
  },
  tx_workflow: {
    apiBase: "/api/tx-workflow-templates",
    runSelectId: "tx-workflow-template-name",
    emptyKey: "txWorkflowTemplateListEmpty",
    newPromptKey: "txWorkflowTemplateNewPrompt",
    nameRequiredKey: "txWorkflowTemplateNameRequired",
    runOutId: "tx-workflow-plan-out",
    runEditorId: "tx-workflow-json",
  },
  orchestration: {
    apiBase: "/api/orchestration-templates",
    runSelectId: "orchestration-template-name",
    emptyKey: "orchestrationTemplateListEmpty",
    newPromptKey: "orchestrationTemplateNewPrompt",
    nameRequiredKey: "orchestrationTemplateNameRequired",
    runOutId: "orchestration-plan-out",
    runEditorId: "orchestration-json",
  },
};

function tr(key, fallback = key) {
  return typeof window.t === "function" ? window.t(key) : fallback;
}

function safeString(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function escapeHtml(value) {
  return safeString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusCard(message, tone = "info") {
  if (typeof window.renderStatusMessageCard === "function") {
    return window.renderStatusMessageCard(message, tone);
  }
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-50 text-slate-600";
  return `<div class="rounded-xl border ${toneClass} px-3 py-2 text-sm">${escapeHtml(message)}</div>`;
}

function setStatus(id, message, tone = "info") {
  if (typeof window.setStatusMessage === "function") {
    window.setStatusMessage(id, message, tone);
    return;
  }
  const out = document.getElementById(id);
  if (!out) return;
  out.innerHTML = statusCard(message, tone);
}

function populateSelect(select, values, config = {}) {
  if (!select) return;
  const {
    placeholder = "-",
    selected = "",
    allowEmpty = true,
    emptyValue = "",
  } = config;
  const items = Array.from(new Set((values || []).filter(Boolean)));
  const options = [];
  if (allowEmpty) {
    options.push(
      `<option value="${escapeHtml(emptyValue)}">${escapeHtml(placeholder)}</option>`,
    );
  }
  items.forEach((value) => {
    options.push(
      `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`,
    );
  });
  select.innerHTML = options.join("");
  if (selected && items.includes(selected)) {
    select.value = selected;
  } else if (selected && !items.includes(selected)) {
    const option = document.createElement("option");
    option.value = selected;
    option.textContent = selected;
    select.appendChild(option);
    select.value = selected;
  } else if (allowEmpty) {
    select.value = emptyValue;
  } else if (items.length > 0) {
    select.value = items[0];
  } else {
    select.value = "";
  }
}

function ensureSelectValue(select, value, config = {}) {
  if (!select) return;
  const normalized = safeString(value).trim();
  if (!normalized) {
    if (config.fallbackToEmpty !== false) {
      select.value = "";
    }
    return;
  }
  const hasOption = Array.from(select.options).some(
    (option) => option.value === normalized,
  );
  if (!hasOption) {
    const option = document.createElement("option");
    option.value = normalized;
    option.textContent = normalized;
    select.appendChild(option);
  }
  select.value = normalized;
}

function promptResourceName(message, initialValue = "") {
  if (typeof window.promptForResourceName === "function") {
    return window.promptForResourceName(message, initialValue);
  }
  const result = window.prompt(message, initialValue);
  if (result == null) return null;
  const normalized = result.trim();
  return normalized || null;
}

async function withLoading(buttonOrId, handler) {
  if (typeof window.withButtonLoading === "function") {
    return window.withButtonLoading(buttonOrId, handler);
  }
  const button =
    typeof buttonOrId === "string"
      ? document.getElementById(buttonOrId)
      : buttonOrId;
  const previousDisabled = button?.disabled;
  if (button) button.disabled = true;
  try {
    return await handler();
  } finally {
    if (button) button.disabled = previousDisabled;
  }
}

function prettyJsonText(rawContent) {
  const text = safeString(rawContent).trim();
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch (_) {
    return text;
  }
}

function setPrettyJsonToTextarea(id, rawContent) {
  const text = prettyJsonText(rawContent);
  if (
    id === "tx-block-json" &&
    typeof window.setTxBlockEditorRawText === "function"
  ) {
    window.setTxBlockEditorRawText(text);
    return;
  }
  if (
    id === "tx-workflow-json" &&
    typeof window.setTxWorkflowEditorText === "function"
  ) {
    window.setTxWorkflowEditorText(text, { notify: true });
    return;
  }
  if (
    id === "orchestration-json" &&
    typeof window.setOrchestrationEditorText === "function"
  ) {
    window.setOrchestrationEditorText(text, { notify: true });
    return;
  }
  const textarea = document.getElementById(id);
  if (textarea) {
    textarea.value = text;
  }
}

function editorRaw(id) {
  if (
    id === "tx-workflow-json" &&
    typeof window.txWorkflowEditorRaw === "function"
  ) {
    return window.txWorkflowEditorRaw().trim();
  }
  if (
    id === "orchestration-json" &&
    typeof window.orchestrationEditorRaw === "function"
  ) {
    return window.orchestrationEditorRaw().trim();
  }
  if (id === "tx-block-json" && typeof window.txBlockEditorRaw === "function") {
    return window.txBlockEditorRaw().trim();
  }
  return (document.getElementById(id)?.value || "").trim();
}

function switchTxViewMode(kind) {
  window.setTxRuntimeViewModes?.({
    txBlock: kind === "tx_block" ? "template" : undefined,
    txWorkflow: kind === "tx_workflow" ? "template" : undefined,
    orchestration: kind === "orchestration" ? "template" : undefined,
  });
  if (kind === "tx_block") window.applyTxBlockViewMode?.();
  if (kind === "tx_workflow") window.applyTxWorkflowViewMode?.();
  if (kind === "orchestration") window.applyOrchestrationViewMode?.();
}

function normalizeJsonEditorContent(id, requiredKey) {
  const raw = editorRaw(id);
  if (!raw) {
    throw new Error(tr(requiredKey));
  }
  const normalized = JSON.stringify(JSON.parse(raw), null, 2);
  setPrettyJsonToTextarea(id, normalized);
  return normalized;
}

export function jsonTemplatesBehavior(node) {
  const cache = {
    tx_block: [],
    tx_workflow: [],
    orchestration: [],
  };

  const byId = (id) =>
    node.querySelector(`#${id}`) || document.getElementById(id);
  const namesFor = (kind) =>
    cache[kind].map((item) => item.name).filter(Boolean);
  const configFor = (kind) => JSON_TEMPLATE_MANAGERS[kind] || null;

  function syncRuntimeSnapshot() {
    window.setJsonTemplateRuntimeSnapshots?.({
      txBlockNames: namesFor("tx_block"),
      txBlockMetas: cache.tx_block,
      txWorkflowNames: namesFor("tx_workflow"),
      txWorkflowMetas: cache.tx_workflow,
      orchestrationNames: namesFor("orchestration"),
      orchestrationMetas: cache.orchestration,
    });
  }

  function renderJsonTemplateOptionsByKind(kind) {
    const cfg = configFor(kind);
    if (!cfg) return;
    populateSelect(byId(cfg.runSelectId), namesFor(kind), {
      placeholder: tr("templateSelectPlaceholder", "Select template"),
      selected: byId(cfg.runSelectId)?.value || "",
    });
  }

  function renderJsonTemplateListByKind() {
    // Manager lists are rendered by Svelte pages; keep the global hook stable for runtime callers.
  }

  async function loadJsonTemplatesByKind(kind) {
    const cfg = configFor(kind);
    if (!cfg) return;
    try {
      const data = await listTemplateResource(cfg.apiBase);
      cache[kind] = Array.isArray(data) ? data : [];
      syncRuntimeSnapshot();
      renderJsonTemplateOptionsByKind(kind);
      renderJsonTemplateListByKind(kind);
    } catch (error) {
      cache[kind] = [];
      syncRuntimeSnapshot();
      renderJsonTemplateOptionsByKind(kind);
      renderJsonTemplateListByKind(kind, error.message);
    }
  }

  async function loadTxBlockTemplates() {
    await loadJsonTemplatesByKind("tx_block");
    window.renderTxWorkflowBuilder?.();
  }

  async function loadTxWorkflowTemplates() {
    await loadJsonTemplatesByKind("tx_workflow");
  }

  async function loadOrchestrationTemplates() {
    await loadJsonTemplatesByKind("orchestration");
  }

  async function loadAllJsonTemplates() {
    await Promise.allSettled([
      loadTxBlockTemplates(),
      loadTxWorkflowTemplates(),
      loadOrchestrationTemplates(),
    ]);
  }

  function renderAllJsonTemplateOptions() {
    renderJsonTemplateOptionsByKind("tx_block");
    renderJsonTemplateOptionsByKind("tx_workflow");
    renderJsonTemplateOptionsByKind("orchestration");
  }

  function renderAllJsonTemplateLists() {
    renderJsonTemplateListByKind("tx_block");
    renderJsonTemplateListByKind("tx_workflow");
    renderJsonTemplateListByKind("orchestration");
  }

  async function loadTemplateIntoEditor(kind, nameOverride = "") {
    const cfg = configFor(kind);
    const name = safeString(
      nameOverride || byId(cfg.runSelectId)?.value || "",
    ).trim();
    if (!name) {
      setStatus(cfg.runOutId, tr(cfg.nameRequiredKey), "error");
      return null;
    }
    setStatus(cfg.runOutId, tr("running", "running"), "running");
    try {
      const detail = await getTemplateResource(cfg.apiBase, name);
      ensureSelectValue(byId(cfg.runSelectId), detail.name || name);
      if (detail?.content) {
        setPrettyJsonToTextarea(cfg.runEditorId, detail.content);
        if (kind === "tx_workflow")
          window.renderTxWorkflowPreviewFromEditor?.();
        if (kind === "orchestration")
          window.renderOrchestrationPreviewFromEditor?.();
      }
      setStatus(
        cfg.runOutId,
        `${tr("loaded", "Loaded")}: ${detail?.name || name}`,
        "success",
      );
      return detail;
    } catch (error) {
      setStatus(cfg.runOutId, error.message, "error");
      return null;
    }
  }

  async function saveTemplateFromExecution(kind) {
    const cfg = configFor(kind);
    const name = safeString(byId(cfg.runSelectId)?.value || "").trim();
    if (!name) {
      setStatus(cfg.runOutId, tr(cfg.nameRequiredKey), "error");
      return;
    }
    setStatus(cfg.runOutId, tr("running", "running"), "running");
    try {
      const content =
        kind === "tx_block"
          ? JSON.stringify(
              window.buildTxBlockTemplatePayloadFromEditor?.(),
              null,
              2,
            )
          : normalizeJsonEditorContent(
              cfg.runEditorId,
              kind === "tx_workflow"
                ? "txWorkflowJsonRequired"
                : "orchestrationJsonRequired",
            );
      const exists = namesFor(kind).includes(name);
      const data = exists
        ? await updateTemplateResource(cfg.apiBase, name, content)
        : await createTemplateResource(cfg.apiBase, name, content);
      await loadJsonTemplatesByKind(kind);
      ensureSelectValue(byId(cfg.runSelectId), data.name || name);
      if (kind === "tx_block") window.renderTxWorkflowBuilder?.();
      setStatus(
        cfg.runOutId,
        `${exists ? tr("saved", "Saved") : tr("created", "Created")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      setStatus(cfg.runOutId, error.message, "error");
    }
  }

  async function deleteTemplateFromExecution(kind) {
    const cfg = configFor(kind);
    const name = safeString(byId(cfg.runSelectId)?.value || "").trim();
    if (!name) {
      setStatus(cfg.runOutId, tr(cfg.nameRequiredKey), "error");
      return;
    }
    setStatus(cfg.runOutId, tr("running", "running"), "running");
    try {
      await deleteTemplateResource(cfg.apiBase, name);
      await loadJsonTemplatesByKind(kind);
      ensureSelectValue(byId(cfg.runSelectId), "");
      if (kind === "tx_block") window.renderTxWorkflowBuilder?.();
      setStatus(
        cfg.runOutId,
        `${tr("deleted", "Deleted")}: ${name}`,
        "success",
      );
    } catch (error) {
      setStatus(cfg.runOutId, error.message, "error");
    }
  }

  async function createTemplateDraft(kind) {
    const cfg = configFor(kind);
    const name = promptResourceName(tr(cfg.newPromptKey));
    if (!name) return;
    if (namesFor(kind).includes(name)) {
      ensureSelectValue(byId(cfg.runSelectId), name);
      await loadTemplateIntoEditor(kind);
      setStatus(
        cfg.runOutId,
        tr("templateExistsHint", "Template already exists"),
        "warning",
      );
      return;
    }
    switchTxViewMode(kind);
    setStatus(cfg.runOutId, tr("running", "running"), "running");
    try {
      const content =
        kind === "tx_block"
          ? JSON.stringify(
              window.buildTxBlockTemplatePayloadFromEditor?.(),
              null,
              2,
            )
          : normalizeJsonEditorContent(
              cfg.runEditorId,
              kind === "tx_workflow"
                ? "txWorkflowJsonRequired"
                : "orchestrationJsonRequired",
            );
      const data = await createTemplateResource(cfg.apiBase, name, content);
      await loadJsonTemplatesByKind(kind);
      ensureSelectValue(byId(cfg.runSelectId), data.name || name);
      if (kind === "tx_block") window.renderTxWorkflowBuilder?.();
      setStatus(
        cfg.runOutId,
        `${tr("created", "Created")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      setStatus(cfg.runOutId, error.message, "error");
    }
  }

  const bindings = [
    [
      "tx-block-editor-new-btn",
      "click",
      () =>
        withLoading("tx-block-editor-new-btn", () =>
          createTemplateDraft("tx_block"),
        ),
    ],
    [
      "tx-block-template-run-new-btn",
      "click",
      () =>
        withLoading("tx-block-template-run-new-btn", () =>
          createTemplateDraft("tx_block"),
        ),
    ],
    [
      "tx-block-template-run-save-btn",
      "click",
      () =>
        withLoading("tx-block-template-run-save-btn", () =>
          saveTemplateFromExecution("tx_block"),
        ),
    ],
    [
      "tx-block-template-run-delete-btn",
      "click",
      () =>
        withLoading("tx-block-template-run-delete-btn", () =>
          deleteTemplateFromExecution("tx_block"),
        ),
    ],
    [
      "tx-block-template-name",
      "change",
      async () => {
        if (!byId("tx-block-template-name")?.value.trim()) return;
        await loadTemplateIntoEditor("tx_block");
      },
    ],
    [
      "tx-workflow-json-new-btn",
      "click",
      () =>
        withLoading("tx-workflow-json-new-btn", () =>
          createTemplateDraft("tx_workflow"),
        ),
    ],
    [
      "tx-workflow-template-run-new-btn",
      "click",
      () =>
        withLoading("tx-workflow-template-run-new-btn", () =>
          createTemplateDraft("tx_workflow"),
        ),
    ],
    [
      "tx-workflow-template-run-save-btn",
      "click",
      () =>
        withLoading("tx-workflow-template-run-save-btn", () =>
          saveTemplateFromExecution("tx_workflow"),
        ),
    ],
    [
      "tx-workflow-template-run-delete-btn",
      "click",
      () =>
        withLoading("tx-workflow-template-run-delete-btn", () =>
          deleteTemplateFromExecution("tx_workflow"),
        ),
    ],
    [
      "tx-workflow-template-name",
      "change",
      async () => {
        if (!byId("tx-workflow-template-name")?.value.trim()) return;
        await loadTemplateIntoEditor("tx_workflow");
      },
    ],
    [
      "orchestration-json-new-btn",
      "click",
      () =>
        withLoading("orchestration-json-new-btn", () =>
          createTemplateDraft("orchestration"),
        ),
    ],
    [
      "orchestration-template-run-new-btn",
      "click",
      () =>
        withLoading("orchestration-template-run-new-btn", () =>
          createTemplateDraft("orchestration"),
        ),
    ],
    [
      "orchestration-template-run-save-btn",
      "click",
      () =>
        withLoading("orchestration-template-run-save-btn", () =>
          saveTemplateFromExecution("orchestration"),
        ),
    ],
    [
      "orchestration-template-run-delete-btn",
      "click",
      () =>
        withLoading("orchestration-template-run-delete-btn", () =>
          deleteTemplateFromExecution("orchestration"),
        ),
    ],
    [
      "orchestration-template-name",
      "change",
      async () => {
        if (!byId("orchestration-template-name")?.value.trim()) return;
        await loadTemplateIntoEditor("orchestration");
      },
    ],
  ];

  bindings.forEach(([id, event, handler]) => {
    byId(id)?.addEventListener(event, handler);
  });

  window.loadJsonTemplatesByKind = loadJsonTemplatesByKind;
  window.loadTxBlockTemplates = loadTxBlockTemplates;
  window.loadTxWorkflowTemplates = loadTxWorkflowTemplates;
  window.loadOrchestrationTemplates = loadOrchestrationTemplates;
  window.loadAllJsonTemplates = loadAllJsonTemplates;
  window.renderAllJsonTemplateOptions = renderAllJsonTemplateOptions;
  window.renderAllJsonTemplateLists = renderAllJsonTemplateLists;
  window.loadTxBlockTemplateIntoEditorByName = (name) =>
    loadTemplateIntoEditor("tx_block", name);
  window.loadSelectedTxBlockTemplateForExecution = () =>
    loadTemplateIntoEditor("tx_block");
  window.saveTxBlockTemplateFromEditor = () =>
    saveTemplateFromExecution("tx_block");
  window.deleteTxBlockTemplateFromManager = () =>
    deleteTemplateFromExecution("tx_block");
  window.createTxBlockTemplateDraftFromManager = () =>
    createTemplateDraft("tx_block");
  window.loadSelectedTxWorkflowTemplateForExecution = () =>
    loadTemplateIntoEditor("tx_workflow");
  window.saveTxWorkflowTemplateFromExecution = () =>
    saveTemplateFromExecution("tx_workflow");
  window.deleteTxWorkflowTemplateFromExecution = () =>
    deleteTemplateFromExecution("tx_workflow");
  window.createTxWorkflowTemplateDraftFromExecution = () =>
    createTemplateDraft("tx_workflow");
  window.loadSelectedOrchestrationTemplateForExecution = () =>
    loadTemplateIntoEditor("orchestration");
  window.saveOrchestrationTemplateFromExecution = () =>
    saveTemplateFromExecution("orchestration");
  window.deleteOrchestrationTemplateFromExecution = () =>
    deleteTemplateFromExecution("orchestration");
  window.createOrchestrationTemplateDraftFromExecution = () =>
    createTemplateDraft("orchestration");

  syncRuntimeSnapshot();
  renderAllJsonTemplateOptions();

  return {
    destroy() {
      bindings.forEach(([id, event, handler]) => {
        byId(id)?.removeEventListener(event, handler);
      });
    },
  };
}
