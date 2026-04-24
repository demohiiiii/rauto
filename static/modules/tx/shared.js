/**
 * tx_shared.js — tx defaults and vars assistant
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

function defaultOrchestrationTemplatePayload() {
  return {
    name: "campus-rollout-demo",
    fail_fast: true,
    rollback_on_stage_failure: true,
    rollback_completed_stages_on_failure: false,
    inventory: {
      groups: {
        edge_nodes: {
          defaults: {
            vars: {
              site: "dc-a",
            },
          },
          targets: [
            {
              name: "edge-01",
              connection: "edge-01",
            },
          ],
        },
      },
    },
    stages: [
      {
        name: "deploy-phase",
        strategy: "parallel",
        max_parallel: 2,
        jobs: [
          {
            name: "transfer-image",
            strategy: "serial",
            target_groups: ["edge_nodes"],
            target_tags: ["edge"],
            action: {
              kind: "tx_block",
              name: "scp-transfer",
              flow_template_name: "scp",
              flow_vars: {
                peer: "edge94",
                local_path: "/tmp/app.tar",
                remote_path: "/tmp/app.tar",
              },
              timeout_secs: 1200,
            },
          },
          {
            name: "precheck",
            strategy: "parallel",
            max_parallel: 4,
            target_groups: ["edge_nodes"],
            action: {
              kind: "tx_block",
              tx_block_template_name: "precheck",
              tx_block_template_vars: {},
            },
          },
          {
            name: "deploy",
            strategy: "parallel",
            max_parallel: 4,
            target_groups: ["edge_nodes"],
            action: {
              kind: "tx_workflow",
              workflow_template_name: "safe-deploy",
              workflow_vars: {},
            },
          },
        ],
      },
    ],
  };
}

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
    key: "orchestration-direct-vars",
    textareaId: "orchestration-vars-json",
    formId: "orchestration-direct-vars-form",
    addBtnId: "orchestration-direct-vars-add-btn",
    syncBtnId: "orchestration-direct-vars-sync-btn",
    clearBtnId: "orchestration-direct-vars-clear-btn",
    statusId: "orchestration-plan-out",
  },
  {
    key: "orchestration-template-vars",
    textareaId: "orchestration-template-vars-json",
    formId: "orchestration-template-vars-form",
    addBtnId: "orchestration-template-vars-add-btn",
    syncBtnId: "orchestration-template-vars-sync-btn",
    clearBtnId: "orchestration-template-vars-clear-btn",
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
