/**
 * tx.js — tx
 */

function defaultTxBlockTemplatePayload() {
  return {
    name: "tx-block",
    rollback_policy: "none",
    steps: [
      {
        run: {
          kind: "command",
          mode: "User",
          command: "show version",
          timeout: 30,
        },
        rollback: null,
        rollback_on_failure: false,
      },
    ],
    fail_fast: true,
  };
}

function defaultTxWorkflowTemplatePayload() {
  return {
    name: "linux-safe-deploy-demo",
    fail_fast: true,
    blocks: [
      {
        name: "precheck",
        rollback_policy: "none",
        fail_fast: true,
        steps: [
          {
            run: {
              kind: "command",
              mode: "User",
              command: "uname -a",
              timeout: 30,
            },
            rollback: null,
            rollback_on_failure: false,
          },
          {
            run: {
              kind: "command",
              mode: "User",
              command: "date",
              timeout: 30,
            },
            rollback: null,
            rollback_on_failure: false,
          },
        ],
      },
      {
        name: "apply-change",
        rollback_policy: "per_step",
        fail_fast: true,
        steps: [
          {
            run: {
              kind: "command",
              mode: "User",
              command: "mkdir -p /tmp/rauto-demo",
              timeout: 30,
            },
            rollback: {
              kind: "command",
              mode: "User",
              command: "rm -rf /tmp/rauto-demo",
              timeout: 30,
            },
            rollback_on_failure: false,
          },
          {
            run: {
              kind: "command",
              mode: "User",
              command: "echo version=2026.04.17 > /tmp/rauto-demo/release.txt",
              timeout: 30,
            },
            rollback: {
              kind: "command",
              mode: "User",
              command: "rm -f /tmp/rauto-demo/release.txt",
              timeout: 30,
            },
            rollback_on_failure: true,
          },
        ],
      },
      {
        name: "verify",
        rollback_policy: {
          whole_resource: {
            rollback: {
              kind: "command",
              mode: "User",
              command: "rm -rf /tmp/rauto-demo",
              timeout: 30,
            },
            trigger_step_index: 0,
          },
        },
        fail_fast: false,
        steps: [
          {
            run: {
              kind: "command",
              mode: "User",
              command: "ls -lah /tmp/rauto-demo",
              timeout: 30,
            },
            rollback: null,
            rollback_on_failure: false,
          },
        ],
      },
    ],
  };
}

let txBlockJsonAceEditor = null;
let txBlockJsonEditorSyncing = false;
let txWorkflowJsonAceEditor = null;
let txWorkflowJsonEditorSyncing = false;
let txVarsAssistantEntrySeq = 0;
const txVarsAssistantState = new Map();
const TX_VARS_ASSISTANTS = [
  {
    key: "tx-block-direct-vars",
    textareaId: "tx-block-direct-vars",
    formId: "tx-block-direct-vars-form",
    addBtnId: "tx-block-direct-vars-add-btn",
    syncBtnId: "tx-block-direct-vars-sync-btn",
    clearBtnId: "tx-block-direct-vars-clear-btn",
    statusId: "tx-plan-out",
  },
  {
    key: "tx-block-template-vars",
    textareaId: "tx-block-template-vars",
    formId: "tx-block-template-vars-form",
    addBtnId: "tx-block-template-vars-add-btn",
    syncBtnId: "tx-block-template-vars-sync-btn",
    clearBtnId: "tx-block-template-vars-clear-btn",
    statusId: "tx-plan-out",
  },
  {
    key: "tx-workflow-direct-vars",
    textareaId: "tx-workflow-vars-json",
    formId: "tx-workflow-direct-vars-form",
    addBtnId: "tx-workflow-direct-vars-add-btn",
    syncBtnId: "tx-workflow-direct-vars-sync-btn",
    clearBtnId: "tx-workflow-direct-vars-clear-btn",
    statusId: "tx-workflow-plan-out",
  },
  {
    key: "tx-workflow-template-vars",
    textareaId: "tx-workflow-template-vars-json",
    formId: "tx-workflow-template-vars-form",
    addBtnId: "tx-workflow-template-vars-add-btn",
    syncBtnId: "tx-workflow-template-vars-sync-btn",
    clearBtnId: "tx-workflow-template-vars-clear-btn",
    statusId: "tx-workflow-plan-out",
  },
  {
    key: "orchestration-vars",
    textareaId: "orchestration-vars-json",
    formId: "orchestration-vars-form",
    addBtnId: "orchestration-vars-add-btn",
    syncBtnId: "orchestration-vars-sync-btn",
    clearBtnId: "orchestration-vars-clear-btn",
    statusId: "orchestration-plan-out",
  },
];

function txVarsAssistantConfig(textareaId) {
  return TX_VARS_ASSISTANTS.find((item) => item.textareaId === textareaId) || null;
}

function txVarsAssistantEntry(
  key = "",
  type = "string",
  valueText = ""
) {
  txVarsAssistantEntrySeq += 1;
  return {
    id: `tx-vars-${txVarsAssistantEntrySeq}`,
    key: safeString(key),
    type: safeString(type) || "string",
    valueText: safeString(valueText),
  };
}

function txVarsAssistantInferType(value) {
  if (value === null) return "null";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "json";
}

function txVarsAssistantToEntries(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.entries(source).map(([key, item]) => {
    const type = txVarsAssistantInferType(item);
    if (type === "json") {
      return txVarsAssistantEntry(key, type, JSON.stringify(item, null, 2));
    }
    if (type === "null") {
      return txVarsAssistantEntry(key, type, "");
    }
    return txVarsAssistantEntry(key, type, String(item));
  });
}

function txVarsAssistantParseValue(entry) {
  const type = safeString(entry.type).trim() || "string";
  const text = safeString(entry.valueText);
  const trimmed = text.trim();
  if (type === "null") return null;
  if (type === "number") {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : text;
  }
  if (type === "boolean") {
    const lowered = trimmed.toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(lowered)) return true;
    if (["false", "0", "no", "n", "off"].includes(lowered)) return false;
    return text;
  }
  if (type === "json") {
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      return text;
    }
  }
  return text;
}

function txVarsAssistantEntriesToObject(entries) {
  const out = {};
  for (const entry of Array.isArray(entries) ? entries : []) {
    const key = safeString(entry && entry.key).trim();
    if (!key) continue;
    out[key] = txVarsAssistantParseValue(entry || {});
  }
  return out;
}

function txVarsAssistantValueControlHtml(entry) {
  const type = safeString(entry.type).trim() || "string";
  const value = safeString(entry.valueText);
  if (type === "json") {
    return `<textarea class="input min-h-20 font-mono js-tx-vars-value" data-field="value">${escapeHtml(
      value
    )}</textarea>`;
  }
  const placeholder =
    type === "boolean"
      ? "true / false"
      : type === "number"
        ? "123"
        : "";
  return `<input class="input input-sm js-tx-vars-value" data-field="value" value="${escapeHtml(
    value
  )}" placeholder="${escapeHtml(placeholder)}" />`;
}

function txVarsAssistantRowHtml(entry) {
  const type = safeString(entry.type).trim() || "string";
  return `
    <div class="rounded-xl border border-slate-200 bg-white px-3 py-3 js-tx-vars-row" data-row-id="${escapeHtml(
      entry.id
    )}">
      <div class="grid gap-2 md:grid-cols-[1fr_140px_1fr_auto] md:items-start">
        <input
          class="input input-sm js-tx-vars-key"
          data-field="key"
          value="${escapeHtml(safeString(entry.key))}"
          placeholder="${escapeHtml(t("txVarsFormKeyPlaceholder"))}"
        />
        <select class="select select-sm js-tx-vars-type" data-field="type">
          <option value="string" ${type === "string" ? "selected" : ""}>${escapeHtml(
            t("txVarsFormTypeString")
          )}</option>
          <option value="number" ${type === "number" ? "selected" : ""}>${escapeHtml(
            t("txVarsFormTypeNumber")
          )}</option>
          <option value="boolean" ${type === "boolean" ? "selected" : ""}>${escapeHtml(
            t("txVarsFormTypeBoolean")
          )}</option>
          <option value="null" ${type === "null" ? "selected" : ""}>${escapeHtml(
            t("txVarsFormTypeNull")
          )}</option>
          <option value="json" ${type === "json" ? "selected" : ""}>${escapeHtml(
            t("txVarsFormTypeJson")
          )}</option>
        </select>
        ${txVarsAssistantValueControlHtml(entry)}
        <button type="button" class="btn btn-sm js-tx-vars-remove">${escapeHtml(
          t("txVarsFormRemoveBtn")
        )}</button>
      </div>
    </div>
  `;
}

function txVarsAssistantGetState(config) {
  if (!txVarsAssistantState.has(config.key)) {
    txVarsAssistantState.set(config.key, { entries: [] });
  }
  return txVarsAssistantState.get(config.key);
}

function txVarsAssistantRender(config) {
  const form = byId(config.formId);
  if (!form) return;
  const state = txVarsAssistantGetState(config);
  const entries = Array.isArray(state.entries) ? state.entries : [];
  if (!entries.length) {
    form.innerHTML = `<div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">${escapeHtml(
      t("txVarsFormHint")
    )}</div>`;
    return;
  }
  form.innerHTML = entries.map((entry) => txVarsAssistantRowHtml(entry)).join("");
}

function txVarsAssistantSyncTextarea(config, { notify = false } = {}) {
  const textarea = byId(config.textareaId);
  if (!textarea) return;
  const state = txVarsAssistantGetState(config);
  const next = JSON.stringify(txVarsAssistantEntriesToObject(state.entries), null, 2);
  const changed = textarea.value !== next;
  textarea.value = next;
  if (notify && changed) {
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function txVarsAssistantSyncFromTextarea(
  textareaId,
  { silent = false, keepStateOnError = true } = {}
) {
  const config = txVarsAssistantConfig(textareaId);
  if (!config) return false;
  const textarea = byId(config.textareaId);
  if (!textarea) return false;
  const raw = safeString(textarea.value || "").trim();
  let parsed = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(t("txVarsFormJsonObjectRequired"));
      }
    } catch (err) {
      if (!silent) {
        const message = err && err.message ? err.message : t("requestFailed");
        setStatusMessage(config.statusId, `${t("txVarsFormJsonInvalid")}: ${message}`, "error");
      }
      if (!keepStateOnError) {
        const state = txVarsAssistantGetState(config);
        state.entries = [];
        txVarsAssistantRender(config);
      }
      return false;
    }
  }
  const state = txVarsAssistantGetState(config);
  state.entries = txVarsAssistantToEntries(parsed);
  txVarsAssistantRender(config);
  return true;
}

function txVarsAssistantUpdateEntryFromRow(config, rowEl) {
  const state = txVarsAssistantGetState(config);
  const rowId = rowEl && rowEl.getAttribute("data-row-id");
  const entry = state.entries.find((item) => item.id === rowId);
  if (!entry) return null;
  const keyInput = rowEl.querySelector(".js-tx-vars-key");
  const typeSelect = rowEl.querySelector(".js-tx-vars-type");
  const valueInput = rowEl.querySelector(".js-tx-vars-value");
  entry.key = safeString(keyInput && keyInput.value);
  entry.type = safeString(typeSelect && typeSelect.value).trim() || "string";
  entry.valueText = safeString(valueInput && valueInput.value);
  return entry;
}

function bindTxVarsAssistant(config) {
  const form = byId(config.formId);
  const addBtn = byId(config.addBtnId);
  const syncBtn = byId(config.syncBtnId);
  const clearBtn = byId(config.clearBtnId);
  const textarea = byId(config.textareaId);
  if (!form || !addBtn || !syncBtn || !clearBtn || !textarea) return;

  addBtn.onclick = () => {
    const state = txVarsAssistantGetState(config);
    state.entries.push(txVarsAssistantEntry());
    txVarsAssistantRender(config);
    txVarsAssistantSyncTextarea(config, { notify: true });
  };
  syncBtn.onclick = () => {
    if (txVarsAssistantSyncFromTextarea(config.textareaId)) {
      setStatusMessage(config.statusId, t("txVarsFormSynced"), "success");
    }
  };
  clearBtn.onclick = () => {
    const state = txVarsAssistantGetState(config);
    state.entries = [];
    txVarsAssistantRender(config);
    txVarsAssistantSyncTextarea(config, { notify: true });
  };

  form.addEventListener("click", (event) => {
    const removeBtn = event.target.closest(".js-tx-vars-remove");
    if (!removeBtn) return;
    const row = removeBtn.closest(".js-tx-vars-row");
    if (!row) return;
    const rowId = row.getAttribute("data-row-id");
    const state = txVarsAssistantGetState(config);
    state.entries = state.entries.filter((item) => item.id !== rowId);
    txVarsAssistantRender(config);
    txVarsAssistantSyncTextarea(config, { notify: true });
  });

  form.addEventListener("input", (event) => {
    const row = event.target.closest(".js-tx-vars-row");
    if (!row) return;
    txVarsAssistantUpdateEntryFromRow(config, row);
    txVarsAssistantSyncTextarea(config, { notify: true });
  });

  form.addEventListener("change", (event) => {
    const row = event.target.closest(".js-tx-vars-row");
    if (!row) return;
    txVarsAssistantUpdateEntryFromRow(config, row);
    txVarsAssistantRender(config);
    txVarsAssistantSyncTextarea(config, { notify: true });
  });

  textarea.addEventListener("change", () => {
    txVarsAssistantSyncFromTextarea(config.textareaId, { silent: false });
  });

  txVarsAssistantSyncFromTextarea(config.textareaId, { silent: true });
}

function setupTxVarsAssistants() {
  TX_VARS_ASSISTANTS.forEach((config) => bindTxVarsAssistant(config));
}

function rerenderTxVarsAssistants() {
  TX_VARS_ASSISTANTS.forEach((config) => txVarsAssistantRender(config));
}

function txBlockJsonEditorTheme(theme) {
  return theme === "light" ? "ace/theme/github" : "ace/theme/tomorrow_night";
}

function txBlockJsonHiddenField() {
  return byId("tx-block-json");
}

function txBlockJsonEditorHost() {
  return byId("tx-block-json-editor");
}

function emitTxBlockJsonInput() {
  const field = txBlockJsonHiddenField();
  if (!field) return;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function syncTxBlockJsonHiddenFromEditor({ notify = false } = {}) {
  const field = txBlockJsonHiddenField();
  if (!field || !txBlockJsonAceEditor) return;
  const next = txBlockJsonAceEditor.getValue();
  const changed = field.value !== next;
  field.value = next;
  if (notify && changed) {
    emitTxBlockJsonInput();
  }
}

function setTxBlockEditorText(text, { notify = false } = {}) {
  const next = safeString(text || "");
  const field = txBlockJsonHiddenField();
  if (txBlockJsonAceEditor) {
    if (txBlockJsonAceEditor.getValue() !== next) {
      txBlockJsonEditorSyncing = true;
      txBlockJsonAceEditor.setValue(next, -1);
      txBlockJsonEditorSyncing = false;
    }
    syncTxBlockJsonHiddenFromEditor({ notify });
    return;
  }
  if (!field) return;
  const changed = field.value !== next;
  field.value = next;
  if (notify && changed) {
    emitTxBlockJsonInput();
  }
}

function setupTxBlockJsonEditor() {
  if (txBlockJsonAceEditor || !window.ace) return;
  const host = txBlockJsonEditorHost();
  const field = txBlockJsonHiddenField();
  if (!host || !field) return;
  try {
    const editor = window.ace.edit(host, {
      mode: "ace/mode/json",
      theme: txBlockJsonEditorTheme(window.currentTheme || currentTheme),
      showPrintMargin: false,
      tabSize: 2,
      useSoftTabs: true,
      wrap: true,
      fontSize: "13px",
    });
    editor.session.setUseWrapMode(true);
    editor.session.setUseWorker(false);
    editor.session.on("change", () => {
      if (txBlockJsonEditorSyncing) return;
      syncTxBlockJsonHiddenFromEditor({ notify: true });
    });
    editor.commands.addCommand({
      name: "formatJson",
      bindKey: { win: "Ctrl-Shift-F", mac: "Command-Shift-F" },
      exec() {
        try {
          const parsed = JSON.parse(editor.getValue());
          setTxBlockEditorText(JSON.stringify(parsed, null, 2), { notify: true });
        } catch (_) {}
      },
    });
    txBlockJsonAceEditor = editor;
    host.classList.remove("hidden");
    field.classList.add("hidden");
    field.setAttribute("aria-hidden", "true");
    setTxBlockEditorText(field.value || "", { notify: false });
    resizeTxBlockJsonEditor();
  } catch (_) {
    txBlockJsonAceEditor = null;
    host.classList.add("hidden");
    field.classList.remove("hidden");
    field.removeAttribute("aria-hidden");
  }
}

function setTxBlockJsonEditorTheme(theme) {
  if (!txBlockJsonAceEditor) return;
  txBlockJsonAceEditor.setTheme(txBlockJsonEditorTheme(theme));
}

function resizeTxBlockJsonEditor() {
  if (!txBlockJsonAceEditor) return;
  txBlockJsonAceEditor.resize(true);
}

function setTxBlockEditorRawText(rawText) {
  setTxBlockEditorText(rawText, { notify: true });
}

function txWorkflowJsonHiddenField() {
  return byId("tx-workflow-json");
}

function txWorkflowJsonEditorHost() {
  return byId("tx-workflow-json-editor");
}

function emitTxWorkflowJsonInput() {
  const field = txWorkflowJsonHiddenField();
  if (!field) return;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function syncTxWorkflowJsonHiddenFromEditor({ notify = false } = {}) {
  const field = txWorkflowJsonHiddenField();
  if (!field || !txWorkflowJsonAceEditor) return;
  const next = txWorkflowJsonAceEditor.getValue();
  const changed = field.value !== next;
  field.value = next;
  if (notify && changed) {
    emitTxWorkflowJsonInput();
  }
}

function setTxWorkflowEditorText(text, { notify = false } = {}) {
  const next = safeString(text || "");
  const field = txWorkflowJsonHiddenField();
  if (txWorkflowJsonAceEditor) {
    if (txWorkflowJsonAceEditor.getValue() !== next) {
      txWorkflowJsonEditorSyncing = true;
      txWorkflowJsonAceEditor.setValue(next, -1);
      txWorkflowJsonEditorSyncing = false;
    }
    syncTxWorkflowJsonHiddenFromEditor({ notify });
    return;
  }
  if (!field) return;
  const changed = field.value !== next;
  field.value = next;
  if (notify && changed) {
    emitTxWorkflowJsonInput();
  }
}

function setupTxWorkflowJsonEditor() {
  if (txWorkflowJsonAceEditor || !window.ace) return;
  const host = txWorkflowJsonEditorHost();
  const field = txWorkflowJsonHiddenField();
  if (!host || !field) return;
  try {
    const editor = window.ace.edit(host, {
      mode: "ace/mode/json",
      theme: txBlockJsonEditorTheme(window.currentTheme || currentTheme),
      showPrintMargin: false,
      tabSize: 2,
      useSoftTabs: true,
      wrap: true,
      fontSize: "13px",
    });
    editor.session.setUseWrapMode(true);
    editor.session.setUseWorker(false);
    editor.session.on("change", () => {
      if (txWorkflowJsonEditorSyncing) return;
      syncTxWorkflowJsonHiddenFromEditor({ notify: true });
    });
    editor.commands.addCommand({
      name: "formatJson",
      bindKey: { win: "Ctrl-Shift-F", mac: "Command-Shift-F" },
      exec() {
        try {
          const parsed = JSON.parse(editor.getValue());
          setTxWorkflowEditorText(JSON.stringify(parsed, null, 2), { notify: true });
        } catch (_) {}
      },
    });
    txWorkflowJsonAceEditor = editor;
    host.classList.remove("hidden");
    field.classList.add("hidden");
    field.setAttribute("aria-hidden", "true");
    setTxWorkflowEditorText(field.value || "", { notify: false });
    resizeTxWorkflowJsonEditor();
  } catch (_) {
    txWorkflowJsonAceEditor = null;
    host.classList.add("hidden");
    field.classList.remove("hidden");
    field.removeAttribute("aria-hidden");
  }
}

function setTxWorkflowJsonEditorTheme(theme) {
  if (!txWorkflowJsonAceEditor) return;
  txWorkflowJsonAceEditor.setTheme(txBlockJsonEditorTheme(theme));
}

function resizeTxWorkflowJsonEditor() {
  if (!txWorkflowJsonAceEditor) return;
  txWorkflowJsonAceEditor.resize(true);
}

function txWorkflowEditorRaw() {
  if (txWorkflowJsonAceEditor) {
    return safeString(txWorkflowJsonAceEditor.getValue() || "");
  }
  return safeString(txWorkflowJsonHiddenField()?.value || "");
}

function setTxWorkflowEditorJson(payload) {
  const next =
    payload && typeof payload === "object"
      ? JSON.stringify(payload, null, 2)
      : JSON.stringify(defaultTxWorkflowTemplatePayload(), null, 2);
  setTxWorkflowEditorText(next, { notify: true });
}

function txBlockEditorRaw() {
  if (txBlockJsonAceEditor) {
    return safeString(txBlockJsonAceEditor.getValue() || "");
  }
  return safeString(txBlockJsonHiddenField()?.value || "");
}

function setTxBlockEditorJson(payload) {
  const next =
    payload && typeof payload === "object"
      ? JSON.stringify(payload, null, 2)
      : JSON.stringify(defaultTxBlockTemplatePayload(), null, 2);
  setTxBlockEditorText(next, { notify: true });
}

function parseTxBlockEditorJson() {
  const raw = txBlockEditorRaw().trim();
  if (!raw) {
    throw new Error(t("txBlockJsonRequired"));
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(t("txBlockJsonInvalidShape"));
  }
  setTxBlockEditorJson(parsed);
  return parsed;
}

function txPayload(dryRun) {
  const templateMode = txBlockViewMode === "template";
  if (templateMode) {
    const content = txBlockEditorRaw().trim();
    if (!content) {
      throw new Error(t("txBlockJsonRequired"));
    }
    return {
      tx_block: null,
      tx_block_template_name: null,
      tx_block_template_content: content,
      tx_block_template_vars: parseJsonById("tx-block-template-vars"),
      dry_run: dryRun,
      connection: connectionPayload(),
      record_level: recordLevelPayload(),
    };
  }
  return {
    tx_block: parseTxBlockEditorJson(),
    tx_block_template_name: null,
    tx_block_template_content: null,
    tx_block_template_vars: parseJsonById("tx-block-direct-vars"),
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

function buildTxBlockTemplatePayloadFromEditor() {
  return parseTxBlockEditorJson();
}

function applyTxBlockTemplatePayloadToEditor(payload) {
  setTxBlockEditorJson(payload);
}

function txWorkflowPayload(dryRun) {
  const templateMode = txWorkflowViewMode === "template";
  const workflowTemplateName = templateMode
    ? byId("tx-workflow-template-name").value.trim()
    : "";
  const raw = templateMode ? "" : txWorkflowEditorRaw().trim();
  if (templateMode && !workflowTemplateName) {
    throw new Error(t("txWorkflowTemplateNameRequired"));
  }
  if (!templateMode && !raw) {
    throw new Error(t("txWorkflowJsonRequired"));
  }
  return {
    workflow_template_name: workflowTemplateName || null,
    workflow_template_content: null,
    workflow: raw ? JSON.parse(raw) : {},
    workflow_vars: parseJsonById(
      templateMode ? "tx-workflow-template-vars-json" : "tx-workflow-vars-json"
    ),
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

function orchestrationPayload(dryRun) {
  const planTemplateName = byId("orchestration-template-name").value.trim();
  const raw = byId("orchestration-json").value.trim();
  if (!raw && !planTemplateName) {
    throw new Error(t("orchestrationJsonRequired"));
  }
  return {
    plan_template_name: planTemplateName || null,
    plan_template_content: null,
    plan: raw ? JSON.parse(raw) : {},
    plan_vars: parseJsonById("orchestration-vars-json"),
    base_dir: byId("orchestration-base-dir").value.trim() || null,
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

function orchestrationInventoryGroupNames() {
  return getMultiSelectValues("orchestration-inventory-groups");
}

function orchestrationInventoryConnectionNames() {
  return getMultiSelectValues("orchestration-inventory-hosts");
}

function orchestrationInventoryLabelNames() {
  return getMultiSelectValues("orchestration-inventory-labels");
}

function buildOrchestrationTargetFromSavedConnection(connection) {
  if (!connection || typeof connection !== "object") return null;
  const target = {};
  if (connection.name) target.name = connection.name;
  if (connection.name) target.connection = connection.name;
  if (connection.host) target.host = connection.host;
  if (connection.username) target.username = connection.username;
  if (connection.port != null) target.port = Number(connection.port);
  if (connection.ssh_security) target.ssh_security = connection.ssh_security;
  if (connection.linux_shell_flavor) target.linux_shell_flavor = connection.linux_shell_flavor;
  if (connection.device_profile) target.device_profile = connection.device_profile;
  if (
    connection.vars &&
    typeof connection.vars === "object" &&
    !Array.isArray(connection.vars)
  ) {
    target.vars = connection.vars;
  }
  return Object.keys(target).length ? target : null;
}

function findSavedConnectionByName(name) {
  const normalized = safeString(name || "").trim();
  if (!normalized) return null;
  return (cachedSavedConnections || []).find((item) => item.name === normalized) || null;
}

function buildOrchestrationInventoryGroupsFromSelection() {
  const groupsMap = {};
  const selectedGroupNames = orchestrationInventoryGroupNames();
  const selectedConnectionNames = orchestrationInventoryConnectionNames();
  const selectedLabelNames = orchestrationInventoryLabelNames();

  for (const groupName of selectedGroupNames) {
    const group = (cachedInventoryGroups || []).find((item) => item.name === groupName);
    if (!group) continue;
    const hosts = Array.isArray(group.hosts) ? group.hosts : [];
    const targets = hosts
      .map((connectionName) => findSavedConnectionByName(connectionName))
      .map((connection) => buildOrchestrationTargetFromSavedConnection(connection))
      .filter(Boolean);
    groupsMap[groupName] = {
      defaults:
        group.vars && typeof group.vars === "object" && !Array.isArray(group.vars)
          ? { vars: group.vars }
          : {},
      targets,
    };
  }

  const standaloneConnections = selectedConnectionNames
    .filter((connectionName) => {
      return !selectedGroupNames.some((groupName) => {
        const group = (cachedInventoryGroups || []).find((item) => item.name === groupName);
        return Array.isArray(group?.hosts) && group.hosts.includes(connectionName);
      });
    })
    .map((connectionName) => findSavedConnectionByName(connectionName))
    .map((connection) => buildOrchestrationTargetFromSavedConnection(connection))
    .filter(Boolean);

  if (standaloneConnections.length) {
    groupsMap.selected_connections = {
      targets: standaloneConnections,
    };
  }

  const labelConnections = (cachedSavedConnections || [])
    .filter((connection) => {
      const labels = Array.isArray(connection?.labels) ? connection.labels : [];
      return selectedLabelNames.some((label) => labels.includes(label));
    })
    .filter((connection) => {
      const connectionName = safeString(connection?.name || "").trim();
      if (!connectionName) return false;
      if (selectedConnectionNames.includes(connectionName)) return false;
      return !selectedGroupNames.some((groupName) => {
        const group = (cachedInventoryGroups || []).find((item) => item.name === groupName);
        return Array.isArray(group?.hosts) && group.hosts.includes(connectionName);
      });
    })
    .map((connection) => buildOrchestrationTargetFromSavedConnection(connection))
    .filter(Boolean);

  if (labelConnections.length) {
    groupsMap.selected_labels = {
      targets: labelConnections,
    };
  }

  return groupsMap;
}

function buildOrchestrationInventoryPlanSkeleton(selectedGroupRefs) {
  return {
    name: "inventory-orchestration",
    fail_fast: true,
    inventory: {
      groups: buildOrchestrationInventoryGroupsFromSelection(),
    },
    stages: [
      {
        name: "stage-1",
        strategy: "serial",
        target_groups: selectedGroupRefs,
        action: {
          kind: "tx_block",
          name: "starter-block",
          commands: ["show version"],
          rollback_commands: [],
          rollback_on_failure: false,
          vars: {},
        },
      },
    ],
  };
}

function applyOrchestrationInventorySelection(mode = "merge") {
  const selectedGroupNames = orchestrationInventoryGroupNames();
  const selectedConnectionNames = orchestrationInventoryConnectionNames();
  const selectedLabelNames = orchestrationInventoryLabelNames();
  if (
    !selectedGroupNames.length &&
    !selectedConnectionNames.length &&
    !selectedLabelNames.length
  ) {
    throw new Error(t("orchestrationInventorySelectionRequired"));
  }

  const selectedGroupRefs = [...selectedGroupNames];
  if (selectedConnectionNames.length) {
    selectedGroupRefs.push("selected_connections");
  }
  if (selectedLabelNames.length) {
    selectedGroupRefs.push("selected_labels");
  }

  if (mode === "build") {
    const plan = buildOrchestrationInventoryPlanSkeleton(selectedGroupRefs);
    byId("orchestration-json").value = JSON.stringify(plan, null, 2);
    renderOrchestrationPreviewFromEditor();
    return;
  }

  const raw = byId("orchestration-json").value.trim();
  const plan = raw ? JSON.parse(raw) : { name: "inventory-orchestration", fail_fast: true, stages: [] };
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error(t("orchestrationJsonRequired"));
  }
  plan.inventory = plan.inventory && typeof plan.inventory === "object" && !Array.isArray(plan.inventory)
    ? plan.inventory
    : {};
  plan.inventory.groups =
    plan.inventory.groups &&
    typeof plan.inventory.groups === "object" &&
    !Array.isArray(plan.inventory.groups)
      ? plan.inventory.groups
      : {};
  Object.assign(plan.inventory.groups, buildOrchestrationInventoryGroupsFromSelection());

  if (Array.isArray(plan.stages) && plan.stages.length === 1) {
    const stage = plan.stages[0];
    const currentTargetGroups = Array.isArray(stage.target_groups) ? stage.target_groups : [];
    if (!currentTargetGroups.length) {
      stage.target_groups = Array.from(new Set(selectedGroupRefs));
    }
  }

  byId("orchestration-json").value = JSON.stringify(plan, null, 2);
  renderOrchestrationPreviewFromEditor();
}

function createTxWorkflowBlock(seed = {}) {
  txWorkflowBlockSeq += 1;
  const sourceKind =
    seed.sourceKind === "tx_block_template" ? "tx_block_template" : "direct";
  const block = {
    id: `tx-block-${txWorkflowBlockSeq}`,
    name: seed.name || "",
    sourceKind,
    txBlockTemplateName: seed.txBlockTemplateName || "",
    txBlockTemplateVarsText:
      seed.txBlockTemplateVarsText != null
        ? String(seed.txBlockTemplateVarsText)
        : JSON.stringify(seed.txBlockTemplateVars || {}, null, 2),
    txBlockJsonText:
      seed.txBlockJsonText != null && String(seed.txBlockJsonText).trim()
        ? String(seed.txBlockJsonText)
        : JSON.stringify(defaultTxBlockTemplatePayload(), null, 2),
    failFast: seed.failFast !== false,
    collapsed: seed.collapsed === true,
  };
  return sanitizeTxWorkflowBlock(block);
}

function sanitizeTxWorkflowBlock(block) {
  if (!block || typeof block !== "object") return block;
  block.sourceKind =
    block.sourceKind === "tx_block_template" ? "tx_block_template" : "direct";
  if (block.txBlockTemplateVarsText == null || block.txBlockTemplateVarsText === "") {
    block.txBlockTemplateVarsText = "{}";
  }
  if (block.txBlockJsonText == null || String(block.txBlockJsonText).trim() === "") {
    block.txBlockJsonText = JSON.stringify(defaultTxBlockTemplatePayload(), null, 2);
  }
  block.name = safeString(block.name || "").trim();
  return block;
}

function txWorkflowAvailableModes() {
  const profileName = safeString(byId("device_profile")?.value || "").trim() || "linux";
  const profileModes = cachedProfileModes.get(profileName);
  const fromProfileCache = Array.isArray(profileModes?.modes)
    ? profileModes.modes
        .map((mode) => safeString(mode || "").trim())
        .filter((mode) => !!mode)
    : [];
  if (fromProfileCache.length) return fromProfileCache;

  return ["User"];
}

function txWorkflowBlockTemplateVarsObject(block, indexForError) {
  const raw = safeString(block && block.txBlockTemplateVarsText).trim();
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `${t("txWorkflowBlockTemplateVarsInvalid")} [block ${
        indexForError + 1
      }]: ${err.message}`
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `${t("txWorkflowBlockTemplateVarsInvalid")} [block ${indexForError + 1}]`
    );
  }
  return parsed;
}

function txWorkflowEditingBlock() {
  if (!txWorkflowEditingBlockId) return null;
  return txWorkflowBlocks.find((block) => block.id === txWorkflowEditingBlockId) || null;
}

function mountTxSharedEditorTo(containerId) {
  const section = byId("tx-shared-editor-section");
  const host = byId(containerId);
  if (!section || !host) return;
  if (section.parentElement !== host) {
    host.appendChild(section);
  }
  section.hidden = false;
  section.style.display = "";
  resizeTxBlockJsonEditor();
}

function syncTxSharedEditorMount() {
  const section = byId("tx-shared-editor-section");
  if (!section) return;
  if (currentTxStage === "workflow") {
    const modal = byId("tx-workflow-editor-modal");
    const modalVisible =
      txWorkflowEditorModalOpen &&
      !!modal &&
      (modal.open === true || modal.classList.contains("modal-open"));
    if (modalVisible) {
      mountTxSharedEditorTo("tx-shared-editor-workflow-host");
    } else {
      section.hidden = true;
      section.style.display = "none";
    }
    return;
  }
  if (currentTxStage === "block") {
    mountTxSharedEditorTo("tx-shared-editor-block-host");
    return;
  }
  section.hidden = true;
  section.style.display = "none";
}

function showTxWorkflowEditorModal() {
  const modal = byId("tx-workflow-editor-modal");
  if (!modal) return;
  if (typeof modal.showModal === "function") {
    if (!modal.open) {
      modal.showModal();
    }
  } else {
    modal.classList.add("modal-open");
  }
  txWorkflowEditorModalOpen = true;
  syncTxSharedEditorMount();
  renderTxWorkflowEditorBridge();
}

function hideTxWorkflowEditorModal({ clearSelection = false, rerender = true } = {}) {
  const modal = byId("tx-workflow-editor-modal");
  txWorkflowEditorModalOpen = false;
  if (modal) {
    if (typeof modal.close === "function" && modal.open) {
      modal.close();
    }
    modal.classList.remove("modal-open");
  }
  if (clearSelection) {
    txWorkflowEditingBlockId = "";
  }
  syncTxSharedEditorMount();
  if (rerender) {
    renderTxWorkflowBuilder();
  } else {
    renderTxWorkflowEditorBridge();
  }
}

function clearTxWorkflowEditorBridge() {
  hideTxWorkflowEditorModal({ clearSelection: true });
}

function renderTxWorkflowEditorBridge() {
  const item = txWorkflowEditingBlock();
  const title = byId("tx-workflow-editor-bridge-title");
  const current = byId("tx-workflow-editor-current");
  const cancelBtn = byId("tx-workflow-editor-cancel-btn");
  if (title) {
    title.textContent = t("txWorkflowEditorBridgeTitle");
  }
  if (cancelBtn) {
    cancelBtn.disabled = !item;
  }
  if (!current) return;
  if (!item) {
    current.textContent = t("txWorkflowEditorBridgeNoTarget");
    return;
  }
  const blockIndex = txWorkflowBlocks.findIndex((block) => block.id === item.id) + 1;
  const blockName = safeString(item.name || "").trim() || "tx-block";
  if (title) {
    title.textContent = `${t("txWorkflowEditorBridgeTitle")} #${blockIndex}`;
  }
  current.textContent = `${blockName} · ${t("txWorkflowSummarySource")}: ${
    item.sourceKind === "tx_block_template"
      ? t("txWorkflowBlockSourceTemplate")
      : t("txWorkflowBlockSourceDirect")
  }`;
}

async function loadTxWorkflowBlockIntoEditor(item) {
  if (!item) return;
  suppressTxWorkflowEditorSync = true;
  if (item.sourceKind === "tx_block_template") {
    txBlockViewMode = "template";
    applyTxBlockViewMode();
    ensureSelectValue("tx-block-template-name", item.txBlockTemplateName || "");
    byId("tx-block-template-vars").value = item.txBlockTemplateVarsText || "{}";
    txVarsAssistantSyncFromTextarea("tx-block-template-vars", { silent: true });
    if (item.txBlockTemplateName) {
      await loadSelectedTxBlockTemplateForExecution();
    }
  } else {
    txBlockViewMode = "direct";
    applyTxBlockViewMode();
    applyTxBlockTemplatePayloadToEditor(
      item.txBlockJsonText ? JSON.parse(item.txBlockJsonText) : defaultTxBlockTemplatePayload()
    );
  }
  suppressTxWorkflowEditorSync = false;
}

async function startTxWorkflowBlockEditor(blockId) {
  const item = txWorkflowBlocks.find((block) => block.id === blockId);
  if (!item) return;
  txWorkflowEditingBlockId = blockId;
  await loadTxWorkflowBlockIntoEditor(item);
  showTxWorkflowEditorModal();
  renderTxWorkflowBuilder();
  setStatusMessage("tx-workflow-plan-out", t("txWorkflowEditorBridgeLoaded"), "success");
}

function applyTxEditorToWorkflowBlock({ silent = false } = {}) {
  const item = txWorkflowEditingBlock();
  if (!item) {
    if (!silent) {
      setStatusMessage("tx-workflow-plan-out", t("txWorkflowEditorBridgeNoTarget"), "error");
    }
    return;
  }
  if (txBlockViewMode === "template") {
    const templateName = safeString(byId("tx-block-template-name")?.value || "").trim();
    if (!templateName) {
      if (!silent) {
        setStatusMessage(
          "tx-workflow-plan-out",
          t("txWorkflowBlockTemplateNameRequired"),
          "error"
        );
      }
      return;
    }
    item.sourceKind = "tx_block_template";
    item.txBlockTemplateName = templateName;
    item.txBlockTemplateVarsText =
      safeString(byId("tx-block-template-vars")?.value || "").trim() || "{}";
    sanitizeTxWorkflowBlock(item);
    renderTxWorkflowBuilder();
    if (!silent) {
      setStatusMessage("tx-workflow-plan-out", t("txWorkflowEditorBridgeApplied"), "success");
    }
    return;
  }

  const payload = buildTxBlockTemplatePayloadFromEditor();
  item.sourceKind = "direct";
  item.txBlockJsonText = JSON.stringify(payload, null, 2);
  item.name = safeString(payload.name || "").trim() || item.name || "";
  item.failFast = payload.fail_fast !== false;
  sanitizeTxWorkflowBlock(item);
  renderTxWorkflowBuilder();
  if (!silent) {
    setStatusMessage("tx-workflow-plan-out", t("txWorkflowEditorBridgeApplied"), "success");
  }
}

function syncSelectedTxWorkflowBlockFromEditor() {
  if (suppressTxWorkflowEditorSync) return;
  if (currentTxStage !== "workflow") return;
  if (!txWorkflowEditingBlockId) return;
  applyTxEditorToWorkflowBlock({ silent: true });
}

function renderTxWorkflowBuilder() {
  const wrap = byId("tx-workflow-blocks");
  if (!wrap) return;
  txWorkflowBlocks.forEach((block) => sanitizeTxWorkflowBlock(block));
  if (
    txWorkflowEditingBlockId &&
    !txWorkflowBlocks.some((block) => block.id === txWorkflowEditingBlockId)
  ) {
    txWorkflowEditingBlockId = "";
  }
  syncTxSharedEditorMount();
  if (!txWorkflowBlocks.length) {
    wrap.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowBuilderEmpty")
    )}</div>`;
    renderTxWorkflowEditorBridge();
    return;
  }
  const filteredBlocks = getFilteredTxWorkflowBlocks();
  if (!filteredBlocks.length) {
    wrap.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowFilterNoMatch")
    )}</div>`;
    renderTxWorkflowEditorBridge();
    return;
  }
  wrap.innerHTML = filteredBlocks
    .map(
      (block) => {
        const fullIdx = txWorkflowBlocks.findIndex((b) => b.id === block.id);
        const editing = txWorkflowEditingBlockId === block.id;
        const summary = txWorkflowBlockSummary(block);
        const sourceKind = summary.sourceKind;
        const templateName = summary.templateName;
        const modeText = summary.modeText;
        const rollbackText = summary.rollbackText;
        const rollbackPreview = summary.rollbackPreview;
        const commandsList = summary.commandsList;
        const commandCount = summary.commandCount;
        return `
      <div class="group-card ${
        editing ? "border-cyan-300 bg-cyan-50/40" : ""
      } js-tx-workflow-select-block cursor-pointer" data-tx-block-id="${escapeHtml(
        block.id
      )}" aria-selected="${editing ? "true" : "false"}">
        <div class="field-tools">
          <div class="grid gap-1">
            <span>#${fullIdx + 1}</span>
            <div class="inline-flex flex-wrap items-center gap-1">
              <span class="tx-workflow-chip">${escapeHtml(t("txWorkflowSummarySource"))}: ${escapeHtml(
                sourceKind === "tx_block_template"
                  ? t("txWorkflowBlockSourceTemplate")
                  : t("txWorkflowBlockSourceDirect")
              )}</span>
              ${
                sourceKind === "tx_block_template"
                  ? `<span class="tx-workflow-chip">${escapeHtml(
                      t("txWorkflowSummaryTemplate")
                    )}: ${escapeHtml(templateName || "-")}</span>`
                  : `<span class="tx-workflow-chip">${escapeHtml(
                      t("txWorkflowSummaryCommands")
                    )}: ${commandCount}</span>
              <span class="tx-workflow-chip">${escapeHtml(
                t("txWorkflowSummaryMode")
              )}: ${escapeHtml(modeText)}</span>
              <span class="tx-workflow-chip">${escapeHtml(
                t("txWorkflowSummaryRollback")
              )}: ${escapeHtml(rollbackText)}</span>`
              }
            </div>
          </div>
          <div class="inline-flex items-center gap-2">
            <button type="button" data-workflow-action="true" class="mini-btn js-tx-workflow-edit-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(t("txWorkflowEditWithTxEditorBtn"))}</button>
            <button type="button" data-workflow-action="true" class="mini-btn js-tx-workflow-toggle-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(block.collapsed ? t("expand") : t("collapse"))}</button>
            <button type="button" data-workflow-action="true" class="mini-btn js-tx-workflow-drag-block" data-tx-block-id="${escapeHtml(
              block.id
            )}" draggable="true">${escapeHtml(t("txWorkflowDragBtn"))}</button>
            <button type="button" data-workflow-action="true" class="mini-btn js-tx-workflow-move-up-block" data-tx-block-id="${escapeHtml(
              block.id
            )}" ${fullIdx === 0 ? "disabled" : ""}>${escapeHtml(t("txWorkflowMoveUpBtn"))}</button>
            <button type="button" data-workflow-action="true" class="mini-btn js-tx-workflow-move-down-block" data-tx-block-id="${escapeHtml(
              block.id
            )}" ${fullIdx === txWorkflowBlocks.length - 1 ? "disabled" : ""}>${escapeHtml(
        t("txWorkflowMoveDownBtn")
      )}</button>
            <button type="button" data-workflow-action="true" class="mini-btn js-tx-workflow-copy-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(t("txWorkflowCopyBlockBtn"))}</button>
            <button type="button" data-workflow-action="true" class="mini-btn delete js-tx-workflow-delete-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(t("txWorkflowDeleteBlockBtn"))}</button>
          </div>
        </div>
        <div class="group-body grid gap-2" ${block.collapsed ? "hidden" : ""}>
          <div class="grid gap-2">
            <div class="text-sm font-semibold text-slate-700">${escapeHtml(
              summary.displayName || `tx-block-${fullIdx + 1}`
            )}</div>
            ${
              sourceKind === "tx_block_template"
                ? `<div class="text-xs text-slate-500">${escapeHtml(
                    t("txWorkflowTemplateRefHint")
                  )}</div>
            <pre class="output text-xs whitespace-pre-wrap break-words">${escapeHtml(
              `template: ${templateName || "-"}\nvars: ${
                safeString(block.txBlockTemplateVarsText || "").trim() || "{}"
              }`
            )}</pre>`
                : `<pre class="output text-xs whitespace-pre-wrap break-words">${escapeHtml(
                    summary.invalidMessage
                      ? summary.invalidMessage
                      : commandsList.length
                      ? commandsList.join("\n")
                      : t("txWorkflowBlockCommandsPlaceholder")
                  )}</pre>
            <pre class="output text-xs whitespace-pre-wrap break-words">${escapeHtml(
              `${t("txWorkflowSummaryRollback")}: ${rollbackText}\n${rollbackPreview}`
            )}</pre>`
            }
          </div>
        </div>
      </div>
    `;
      }
    )
    .join("");
  renderTxWorkflowEditorBridge();
}

function parseTxWorkflowDirectBlock(block) {
  const raw = safeString(block && block.txBlockJsonText).trim();
  if (!raw) {
    return { value: null, error: t("txBlockJsonRequired") };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { value: null, error: t("txBlockJsonInvalidShape") };
    }
    return { value: parsed, error: "" };
  } catch (e) {
    return { value: null, error: e && e.message ? e.message : t("requestFailed") };
  }
}

function txWorkflowRollbackValue(rollbackPolicy) {
  if (typeof rollbackPolicy === "string") {
    if (
      rollbackPolicy === "none" ||
      rollbackPolicy === "per_step" ||
      rollbackPolicy === "whole_resource"
    ) {
      return rollbackPolicy;
    }
    return "per_step";
  }
  if (
    rollbackPolicy &&
    typeof rollbackPolicy === "object" &&
    rollbackPolicy.whole_resource
  ) {
    return "whole_resource";
  }
  return "per_step";
}

function txWorkflowBlockSummary(block) {
  const sourceKind = block.sourceKind === "tx_block_template" ? "tx_block_template" : "direct";
  const templateName = safeString(block.txBlockTemplateName || "").trim();
  const fallbackName = safeString(block.name || "").trim() || "tx-block";
  if (sourceKind === "tx_block_template") {
    return {
      sourceKind,
      templateName,
      displayName: fallbackName,
      commandCount: 0,
      modeText: "-",
      rollbackValue: "per_step",
      rollbackText: "per_step",
      commandsList: [],
      rollbackList: [],
      rollbackPreview: "",
      queryText: `${fallbackName} ${templateName}`.toLowerCase(),
      invalidMessage: "",
      parsedBlock: null,
    };
  }

  const { value: parsedBlock, error } = parseTxWorkflowDirectBlock(block);
  if (!parsedBlock) {
    const invalidMessage = `${t("txWorkflowVisualInvalid")}: ${error}`;
    return {
      sourceKind,
      templateName: "",
      displayName: fallbackName,
      commandCount: 0,
      modeText: "-",
      rollbackValue: "per_step",
      rollbackText: "per_step",
      commandsList: [],
      rollbackList: [],
      rollbackPreview: invalidMessage,
      queryText: `${fallbackName} ${invalidMessage}`.toLowerCase(),
      invalidMessage,
      parsedBlock: null,
    };
  }

  const steps = Array.isArray(parsedBlock.steps) ? parsedBlock.steps : [];
  const commandsList = steps
    .map((step) => txOperationDescription(txStepRunOperation(step)))
    .filter((line) => !!safeString(line).trim());
  const rollbackList = steps
    .map((step) => txOperationDescription(txStepRollbackOperation(step)))
    .filter((line) => !!safeString(line).trim());
  const rollbackValue = txWorkflowRollbackValue(parsedBlock.rollback_policy);
  const wholeResourceOp = txWholeResourceRollbackOperation(parsedBlock.rollback_policy);
  const wholeResourceRollback = txOperationDescription(wholeResourceOp);
  const rollbackPreview =
    rollbackValue === "none"
      ? t("txWorkflowBlockRollbackNone")
      : rollbackValue === "whole_resource"
        ? safeString(wholeResourceRollback || "").trim() || t("txWorkflowBlockUndoPlaceholder")
        : rollbackList.length
          ? rollbackList.join("\n")
          : t("txWorkflowVisualNoRollback");
  const firstRun = txStepRunOperation(steps[0]);
  const modeText = txOperationMode(firstRun) || txWorkflowAvailableModes()[0] || "User";
  const displayName =
    safeString(parsedBlock.name || "").trim() || fallbackName || "tx-block";

  return {
    sourceKind,
    templateName: "",
    displayName,
    commandCount: steps.length,
    modeText,
    rollbackValue,
    rollbackText: rollbackValue,
    commandsList,
    rollbackList,
    rollbackPreview,
    queryText: `${displayName} ${commandsList.join(" ")}`.toLowerCase(),
    invalidMessage: "",
    parsedBlock,
  };
}

function txStepRunOperation(step) {
  if (!step || typeof step !== "object") return null;
  return step.run && typeof step.run === "object" ? step.run : null;
}

function txStepRollbackOperation(step) {
  if (!step || typeof step !== "object") return null;
  return step.rollback && typeof step.rollback === "object" ? step.rollback : null;
}

function txWholeResourceRollbackOperation(rollbackPolicy) {
  if (!rollbackPolicy || typeof rollbackPolicy !== "object") return null;
  const wholeResource = rollbackPolicy.whole_resource;
  if (!wholeResource || typeof wholeResource !== "object") return null;
  return wholeResource.rollback && typeof wholeResource.rollback === "object"
    ? wholeResource.rollback
    : null;
}

function txOperationMode(operation) {
  if (!operation || typeof operation !== "object") return "";
  if (typeof operation.mode === "string") return operation.mode.trim();
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    return safeString(steps[0] && steps[0].mode).trim();
  }
  if (operation.kind === "template") {
    return safeString(operation.runtime && operation.runtime.default_mode).trim();
  }
  return "";
}

function txOperationTimeoutSeconds(operation) {
  if (!operation || typeof operation !== "object") return null;
  if (operation.timeout != null && String(operation.timeout).trim()) {
    return Number(operation.timeout);
  }
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    return steps[0] && steps[0].timeout != null ? Number(steps[0].timeout) : null;
  }
  return null;
}

function txOperationDescription(operation) {
  if (!operation || typeof operation !== "object") return "";
  if (operation.kind === "command" || operation.command != null) {
    return safeString(operation.command).trim();
  }
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    const first = safeString(steps[0] && steps[0].command).trim();
    if (!steps.length) return "flow";
    if (steps.length === 1) return first || "flow";
    return first ? `${first} ... (${steps.length} steps)` : `${steps.length} steps`;
  }
  if (operation.kind === "template") {
    const templateName = safeString(operation.template && operation.template.name).trim();
    const runtimeMode = safeString(
      operation.runtime && operation.runtime.default_mode
    ).trim();
    if (templateName && runtimeMode) return `${templateName} (${runtimeMode})`;
    return templateName || "template";
  }
  return "";
}

function autoScrollDuringDrag(event, container) {
  const y = event.clientY;
  const threshold = 96;
  const step = 22;
  if (!Number.isFinite(y)) return;

  if (container && container.scrollHeight > container.clientHeight) {
    const rect = container.getBoundingClientRect();
    if (y < rect.top + threshold) {
      container.scrollTop -= step;
      return;
    }
    if (y > rect.bottom - threshold) {
      container.scrollTop += step;
      return;
    }
  }

  const vpHeight = window.innerHeight || document.documentElement.clientHeight;
  if (y < threshold) {
    window.scrollBy(0, -step);
  } else if (y > vpHeight - threshold) {
    window.scrollBy(0, step);
  }
}

function clearTxWorkflowDropMarkers(container) {
  if (!container) return;
  container
    .querySelectorAll(
      ".tx-workflow-drop-target, .tx-workflow-drop-before, .tx-workflow-drop-after"
    )
    .forEach((el) => {
      el.classList.remove("tx-workflow-drop-target");
      el.classList.remove("tx-workflow-drop-before");
      el.classList.remove("tx-workflow-drop-after");
    });
}

function getFilteredTxWorkflowBlocks() {
  const query = txWorkflowFilterQuery.trim().toLowerCase();
  return txWorkflowBlocks.filter((block) => {
    const summary = txWorkflowBlockSummary(block);
    const rollbackOk =
      txWorkflowFilterRollback === "all" ||
      summary.rollbackValue === txWorkflowFilterRollback;
    const queryOk =
      !query ||
      summary.queryText.includes(query);
    return rollbackOk && queryOk;
  });
}

function setAllTxWorkflowBlocksCollapsed(collapsed) {
  txWorkflowBlocks.forEach((block) => {
    block.collapsed = !!collapsed;
  });
  renderTxWorkflowBuilder();
}

function normalizeTxWorkflowJsonFromEditor() {
  const raw = txWorkflowEditorRaw().trim();
  if (!raw) return;
  const workflow = JSON.parse(raw);
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    throw new Error(t("txWorkflowLoadInvalidJsonShape"));
  }
  setTxWorkflowEditorJson(workflow);
  renderTxWorkflowPreviewFromEditor();
}

function generateTxWorkflowJsonFromBuilder() {
  normalizeTxWorkflowJsonFromEditor();
}

function loadTxWorkflowBuilderFromJson() {
  normalizeTxWorkflowJsonFromEditor();
}

function downloadTxWorkflowJson() {
  normalizeTxWorkflowJsonFromEditor();
  const content = txWorkflowEditorRaw();
  let nameRaw = "tx-workflow";
  try {
    const parsed = JSON.parse(content || "{}");
    nameRaw = safeString(parsed && parsed.name).trim() || "tx-workflow";
  } catch (_) {}
  const safeName = nameRaw.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const fileName = `${safeName}.json`;
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importTxWorkflowFromFile() {
  const input = byId("tx-workflow-import-file-input");
  const file = input && input.files && input.files[0] ? input.files[0] : null;
  if (!file) {
    throw new Error(t("txWorkflowImportFileInvalid"));
  }
  const text = await file.text();
  setTxWorkflowEditorText(text, { notify: false });
  normalizeTxWorkflowJsonFromEditor();
  renderTxWorkflowPreviewFromEditor();
  setStatusMessage("tx-workflow-plan-out", t("txWorkflowImportFileDone"), "success");
  input.value = "";
}

function downloadTxWorkflowJsonFromBuilder() {
  downloadTxWorkflowJson();
}

async function importTxWorkflowBuilderFromFile() {
  await importTxWorkflowFromFile();
}

function downloadOrchestrationJson() {
  const content = byId("orchestration-json").value || "";
  const raw = content.trim();
  let safeName = "orchestration";
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const nameRaw = (parsed && parsed.name ? String(parsed.name) : "").trim();
      if (nameRaw) {
        safeName = nameRaw.replace(/[^a-zA-Z0-9._-]+/g, "-");
      }
    } catch (_) {
      safeName = "orchestration";
    }
  }
  const fileName = `${safeName || "orchestration"}.json`;
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importOrchestrationFromFile() {
  const input = byId("orchestration-import-file-input");
  const file = input && input.files && input.files[0] ? input.files[0] : null;
  if (!file) {
    throw new Error(t("orchestrationImportFileInvalid"));
  }
  const text = await file.text();
  byId("orchestration-json").value = text;
  renderOrchestrationPreviewFromEditor();
  setStatusMessage(
    "orchestration-plan-out",
    t("orchestrationImportFileDone"),
    "success"
  );
  input.value = "";
}

async function importTxBlockIntoWorkflowBuilder() {
  if (!ensureConnectionTargetSelected("tx-workflow-plan-out")) {
    return;
  }
  setStatusMessage("tx-workflow-plan-out", t("running"), "running");
  try {
    const data = await request("POST", "/api/tx/block", txPayload(true));
    const block = data && data.tx_block ? data.tx_block : null;
    if (!block) {
      setStatusMessage("tx-workflow-plan-out", t("txWorkflowImportEmpty"), "error");
      return;
    }
    const importedBlock = createTxWorkflowBlock({
      name: (block && block.name) || "",
      failFast: block && block.fail_fast !== false,
      txBlockJsonText: JSON.stringify(block, null, 2),
    });
    txWorkflowBlocks.push(importedBlock);
    await startTxWorkflowBlockEditor(importedBlock.id);
    setStatusMessage("tx-workflow-plan-out", t("txWorkflowImportDone"), "success");
  } catch (e) {
    setStatusMessage("tx-workflow-plan-out", e.message, "error");
  }
}
