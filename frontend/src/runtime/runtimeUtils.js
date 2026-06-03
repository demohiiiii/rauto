import {
  byId,
  runtimeValue,
  setRuntimeValue,
} from "../services/runtimeGlobals.js";

const STORAGE_KEYS = {
  recordViewMode: "rauto_record_view_mode",
  replayViewMode: "rauto_replay_view_mode",
  recordFailedOnly: "rauto_record_failed_only",
  replayFailedOnly: "rauto_replay_failed_only",
  recordEventKind: "rauto_record_event_kind",
  replayEventKind: "rauto_replay_event_kind",
  recordSearchQuery: "rauto_record_search_query",
  replaySearchQuery: "rauto_replay_search_query",
  historyFilterQuery: "rauto_history_filter_query",
  historyFilterOperation: "rauto_history_filter_operation",
  historyFilterLimit: "rauto_history_filter_limit",
};

const ALLOWED_EVENT_KINDS = new Set([
  "all",
  "command_output",
  "connection_established",
  "connection_closed",
  "prompt_changed",
  "state_changed",
  "raw_chunk",
  "tx_block_started",
  "tx_step_succeeded",
  "tx_step_failed",
  "tx_rollback_started",
  "tx_rollback_step_succeeded",
  "tx_rollback_step_failed",
  "tx_block_finished",
  "tx_workflow_started",
  "tx_workflow_finished",
]);

const FLOW_BUILTIN_PREFIX = "builtin:";

function saveFilterPrefs() {
  localStorage.setItem(
    STORAGE_KEYS.recordViewMode,
    runtimeValue("recordViewMode"),
  );
  localStorage.setItem(
    STORAGE_KEYS.replayViewMode,
    runtimeValue("replayViewMode"),
  );
  localStorage.setItem(
    STORAGE_KEYS.recordFailedOnly,
    String(!!runtimeValue("recordFailedOnly")),
  );
  localStorage.setItem(
    STORAGE_KEYS.replayFailedOnly,
    String(!!runtimeValue("replayFailedOnly")),
  );
  localStorage.setItem(
    STORAGE_KEYS.recordEventKind,
    runtimeValue("recordEventKind"),
  );
  localStorage.setItem(
    STORAGE_KEYS.replayEventKind,
    runtimeValue("replayEventKind"),
  );
  localStorage.setItem(
    STORAGE_KEYS.recordSearchQuery,
    runtimeValue("recordSearchQuery"),
  );
  localStorage.setItem(
    STORAGE_KEYS.replaySearchQuery,
    runtimeValue("replaySearchQuery"),
  );
}

function normalizeFilterPrefs() {
  if (
    runtimeValue("recordViewMode") !== "list" &&
    runtimeValue("recordViewMode") !== "raw"
  ) {
    setRuntimeValue("recordViewMode", "list");
  }
  if (
    runtimeValue("replayViewMode") !== "list" &&
    runtimeValue("replayViewMode") !== "raw"
  ) {
    setRuntimeValue("replayViewMode", "list");
  }
  if (!ALLOWED_EVENT_KINDS.has(runtimeValue("recordEventKind"))) {
    setRuntimeValue("recordEventKind", "all");
  }
  if (!ALLOWED_EVENT_KINDS.has(runtimeValue("replayEventKind"))) {
    setRuntimeValue("replayEventKind", "all");
  }
}

function saveHistoryFilterPrefs() {
  localStorage.setItem(
    STORAGE_KEYS.historyFilterQuery,
    runtimeValue("historyFilterQuery"),
  );
  localStorage.setItem(
    STORAGE_KEYS.historyFilterOperation,
    runtimeValue("historyFilterOperation"),
  );
  localStorage.setItem(
    STORAGE_KEYS.historyFilterLimit,
    String(runtimeValue("historyFilterLimit")),
  );
}

function normalizeHistoryFilters() {
  if (!runtimeValue("historyFilterQuery"))
    setRuntimeValue("historyFilterQuery", "");
  if (
    ![
      "all",
      "exec",
      "template_execute",
      "tx_block",
      "tx_workflow",
      "orchestrate_tx_block",
      "orchestrate_tx_workflow",
      "orchestrate_compensation",
    ].includes(runtimeValue("historyFilterOperation"))
  ) {
    setRuntimeValue("historyFilterOperation", "all");
  }
  const limit = Number(runtimeValue("historyFilterLimit"));
  if (!Number.isFinite(limit) || limit <= 0) {
    setRuntimeValue("historyFilterLimit", 30);
  }
}

function t(key) {
  const i18n = window.i18n || {};
  const currentLang = runtimeValue("currentLang") || "zh";
  return i18n[currentLang]?.[key] || i18n.en?.[key] || key;
}

function setPanelVisible(el, visible, displayValue = "block") {
  if (!el) return;
  el.hidden = !visible;
  el.classList.toggle("hidden", !visible);
  el.style.display = visible ? displayValue : "none";
}

function resolveButtonElement(buttonOrId) {
  if (!buttonOrId) return null;
  if (typeof buttonOrId === "string") return byId(buttonOrId);
  if (buttonOrId instanceof HTMLElement) return buttonOrId;
  return null;
}

async function withButtonLoading(buttonOrId, action) {
  const button = resolveButtonElement(buttonOrId);
  if (!button) {
    return await action();
  }
  if (button.dataset.loading === "1") {
    return undefined;
  }
  const wasDisabled = button.disabled;
  const hadDisabledClass = button.classList.contains("btn-disabled");
  const originalHtml = button.innerHTML;
  const originalMinWidth = button.style.minWidth || "";
  const buttonWidth = Math.ceil(button.getBoundingClientRect().width);
  button.dataset.loading = "1";
  button.dataset.loadingOriginalHtml = originalHtml;
  button.dataset.loadingOriginalMinWidth = originalMinWidth;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.classList.add("btn-disabled");
  if (buttonWidth > 0) {
    button.style.minWidth = `${buttonWidth}px`;
  }
  button.innerHTML = `<span class="inline-flex items-center gap-2"><span class="loading loading-spinner loading-xs" aria-hidden="true"></span><span class="js-btn-label">${originalHtml}</span></span>`;
  try {
    return await action();
  } finally {
    delete button.dataset.loading;
    button.disabled = wasDisabled;
    button.removeAttribute("aria-busy");
    button.innerHTML = button.dataset.loadingOriginalHtml || originalHtml;
    button.style.minWidth = button.dataset.loadingOriginalMinWidth || "";
    delete button.dataset.loadingOriginalHtml;
    delete button.dataset.loadingOriginalMinWidth;
    if (!hadDisabledClass) {
      button.classList.remove("btn-disabled");
    }
  }
}

function setEventKindOptions(id, selected) {
  const sel = byId(id);
  if (!sel) return;
  const options = [
    ["all", t("eventTypeAll")],
    ["command_output", "command_output"],
    ["connection_established", "connection_established"],
    ["connection_closed", "connection_closed"],
    ["prompt_changed", "prompt_changed"],
    ["state_changed", "state_changed"],
    ["raw_chunk", "raw_chunk"],
    ["tx_block_started", "tx_block_started"],
    ["tx_step_succeeded", "tx_step_succeeded"],
    ["tx_step_failed", "tx_step_failed"],
    ["tx_rollback_started", "tx_rollback_started"],
    ["tx_rollback_step_succeeded", "tx_rollback_step_succeeded"],
    ["tx_rollback_step_failed", "tx_rollback_step_failed"],
    ["tx_block_finished", "tx_block_finished"],
    ["tx_workflow_started", "tx_workflow_started"],
    ["tx_workflow_finished", "tx_workflow_finished"],
  ];
  sel.innerHTML = options
    .map(
      ([value, label]) =>
        `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`,
    )
    .join("");
  sel.value = selected || "all";
}

function safeString(value) {
  if (value == null) return "-";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function buildBuiltinFlowTemplateValue(name) {
  const normalized = safeString(name || "").trim();
  if (!normalized) return "";
  return `${FLOW_BUILTIN_PREFIX}${normalized}`;
}

function parseBuiltinFlowTemplateValue(value) {
  const raw = safeString(value || "").trim();
  if (!raw) return null;
  if (!raw.toLowerCase().startsWith(FLOW_BUILTIN_PREFIX)) return null;
  const name = raw.slice(FLOW_BUILTIN_PREFIX.length).trim();
  return name || null;
}

function populateSelectOptions(selectId, values, config = {}) {
  const select = byId(selectId);
  if (!select) return;
  const {
    placeholder = "—",
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

function ensureSelectValue(selectId, value, config = {}) {
  const select = byId(selectId);
  if (!select) return;
  const normalized = safeString(value || "").trim();
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

function promptForResourceName(message, initialValue = "") {
  const result = window.prompt(message, initialValue);
  if (result == null) return null;
  const normalized = result.trim();
  return normalized || null;
}

function splitCsvValues(rawValue) {
  return String(rawValue ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function displayMode(mode) {
  return String(mode || "").trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseModeValidationMessage(message) {
  const text = safeString(message || "").trim();
  const match = text.match(
    /^invalid mode '([^']+)' for profile '([^']+)'; default_mode='([^']+)'; available_modes=\[(.*)\]$/,
  );
  if (!match) return null;
  const [, invalidMode, profile, defaultMode, rawModes] = match;
  return {
    invalidMode,
    profile,
    defaultMode,
    availableModes: rawModes
      .split(",")
      .map((mode) => mode.trim())
      .filter(Boolean),
  };
}

function parseJsonl(jsonl) {
  const rows = [];
  const text = (jsonl || "").trim();
  if (!text) {
    return { ok: true, rows };
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      rows.push(JSON.parse(line));
    } catch (_) {
      return { ok: false, error: `${t("recordParseError")}: line ${i + 1}` };
    }
  }
  return { ok: true, rows };
}

function isFailedCommandEvent(entry) {
  const event = (entry && entry.event) || {};
  return event.kind === "command_output" && event.success === false;
}

function matchesSearch(entry, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return true;
  const event = (entry && entry.event) || {};
  const fields = [
    event.kind,
    event.command,
    event.mode,
    event.content,
    event.all,
    event.prompt_before,
    event.prompt_after,
    event.fsm_prompt_before,
    event.fsm_prompt_after,
    event.device_addr,
    event.reason,
  ];
  const haystack = fields
    .filter((v) => v != null)
    .map((v) => String(v).toLowerCase())
    .join("\n");
  return haystack.includes(q);
}

function filterEntries(entries, kindFilter, failedOnly, query) {
  return (entries || []).filter((entry) => {
    const event = (entry && entry.event) || {};
    const kindOk =
      !kindFilter || kindFilter === "all" ? true : event.kind === kindFilter;
    const failedOk = failedOnly ? isFailedCommandEvent(entry) : true;
    const queryOk = matchesSearch(entry, query);
    return kindOk && failedOk && queryOk;
  });
}

function buildEventStats(entries) {
  const kinds = new Set();
  let commandEvents = 0;
  let failedEvents = 0;
  for (const entry of entries) {
    const event = (entry && entry.event) || {};
    const kind = event.kind || "unknown";
    kinds.add(kind);
    if (kind === "command_output") {
      commandEvents += 1;
      if (event.success === false) {
        failedEvents += 1;
      }
    }
  }
  return {
    total: entries.length,
    commandEvents,
    failedEvents,
    kinds: kinds.size,
  };
}

function formatHistoryTime(tsMs) {
  const n = Number(tsMs);
  if (!Number.isFinite(n) || n <= 0) return "-";
  return new Date(n).toLocaleString();
}

function historyOperationLabel(raw) {
  const op = safeString(raw).toLowerCase();
  if (op === "exec") {
    return runtimeValue("currentLang") === "zh" ? "命令执行" : "Execute";
  }
  if (op === "template_execute") {
    return runtimeValue("currentLang") === "zh"
      ? "模板执行"
      : "Template Execute";
  }
  return op || "-";
}

function historyOperationBadge(raw) {
  const op = safeString(raw).toLowerCase();
  const label = historyOperationLabel(op);
  const cls =
    op === "template_execute"
      ? "bg-cyan-100 text-cyan-800 border-cyan-200"
      : "bg-indigo-100 text-indigo-800 border-indigo-200";
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}">${escapeHtml(
    label,
  )}</span>`;
}

function historyModeBadge(mode) {
  const value = displayMode(mode);
  if (!value) {
    return '<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">-</span>';
  }
  return `<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">${escapeHtml(
    value,
  )}</span>`;
}

function historyRecordLevelBadge(level) {
  const value = safeString(level).toLowerCase();
  const cls =
    value === "full"
      ? "border-violet-200 bg-violet-100 text-violet-800"
      : "border-emerald-200 bg-emerald-100 text-emerald-800";
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}">${escapeHtml(
    value || "-",
  )}</span>`;
}

function historyTargetCell(item) {
  const name = safeString(item.connection_name || "-");
  const host = safeString(item.host);
  const port = safeString(item.port);
  const profile = safeString(item.device_profile);
  return `
    <div class="grid gap-1">
      <div>
        <span class="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">${escapeHtml(
          name,
        )}</span>
      </div>
      <div class="font-mono text-xs text-slate-700 break-all">${escapeHtml(`${host}:${port}`)}</div>
      <div class="text-xs text-slate-500 break-all">${escapeHtml(profile)}</div>
    </div>
  `;
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024)
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function parseVars() {
  const raw = byId("vars").value.trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function parseJsonById(id) {
  const raw = byId(id).value.trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

export function installRuntimeUtils() {
  Object.assign(window, {
    saveFilterPrefs,
    normalizeFilterPrefs,
    saveHistoryFilterPrefs,
    normalizeHistoryFilters,
    t,
    setPanelVisible,
    resolveButtonElement,
    withButtonLoading,
    setEventKindOptions,
    safeString,
    buildBuiltinFlowTemplateValue,
    parseBuiltinFlowTemplateValue,
    populateSelectOptions,
    ensureSelectValue,
    promptForResourceName,
    splitCsvValues,
    displayMode,
    escapeHtml,
    parseModeValidationMessage,
    parseJsonl,
    isFailedCommandEvent,
    matchesSearch,
    filterEntries,
    buildEventStats,
    formatHistoryTime,
    historyOperationLabel,
    historyOperationBadge,
    historyModeBadge,
    historyRecordLevelBadge,
    historyTargetCell,
    formatBytes,
    parseVars,
    parseJsonById,
  });
}
