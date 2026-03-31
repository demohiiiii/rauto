/**
 * utils.js - Pure utility functions (extracted from app.js)
 */

function saveFilterPrefs() {
  localStorage.setItem(STORAGE_KEYS.recordViewMode, recordViewMode);
  localStorage.setItem(STORAGE_KEYS.replayViewMode, replayViewMode);
  localStorage.setItem(STORAGE_KEYS.recordFailedOnly, String(recordFailedOnly));
  localStorage.setItem(STORAGE_KEYS.replayFailedOnly, String(replayFailedOnly));
  localStorage.setItem(STORAGE_KEYS.recordEventKind, recordEventKind);
  localStorage.setItem(STORAGE_KEYS.replayEventKind, replayEventKind);
  localStorage.setItem(STORAGE_KEYS.recordSearchQuery, recordSearchQuery);
  localStorage.setItem(STORAGE_KEYS.replaySearchQuery, replaySearchQuery);
}

function normalizeFilterPrefs() {
  if (recordViewMode !== "list" && recordViewMode !== "raw") recordViewMode = "list";
  if (replayViewMode !== "list" && replayViewMode !== "raw") replayViewMode = "list";
  if (!ALLOWED_EVENT_KINDS.has(recordEventKind)) recordEventKind = "all";
  if (!ALLOWED_EVENT_KINDS.has(replayEventKind)) replayEventKind = "all";
}

function saveHistoryFilterPrefs() {
  localStorage.setItem(STORAGE_KEYS.historyFilterQuery, historyFilterQuery);
  localStorage.setItem(
    STORAGE_KEYS.historyFilterOperation,
    historyFilterOperation
  );
  localStorage.setItem(
    STORAGE_KEYS.historyFilterLimit,
    String(historyFilterLimit)
  );
}

function normalizeHistoryFilters() {
  if (!historyFilterQuery) historyFilterQuery = "";
  if (
    ![
      "all",
      "exec",
      "template_execute",
      "tx_block",
      "tx_workflow",
      "orchestrate_tx_block",
      "orchestrate_tx_workflow",
      "interactive",
    ].includes(historyFilterOperation)
  ) {
    historyFilterOperation = "all";
  }
  if (!Number.isFinite(historyFilterLimit) || historyFilterLimit <= 0) {
    historyFilterLimit = 30;
  }
}

function t(key) {
  return i18n[currentLang][key] || i18n.en[key] || key;
}

function setPanelVisible(el, visible, displayValue = "block") {
  if (!el) return;
  el.hidden = !visible;
  el.classList.toggle("hidden", !visible);
  el.style.display = visible ? displayValue : "none";
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
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
  sel.value = selected || "all";
}

function loadRollbackTemplateLibrary() {
  const raw = localStorage.getItem(STORAGE_KEYS.rollbackTemplateLibrary);
  if (!raw) {
    rollbackTemplateLibrary = [];
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    rollbackTemplateLibrary = Array.isArray(parsed)
      ? parsed.filter((item) => item && item.name && item.template)
      : [];
  } catch (_) {
    rollbackTemplateLibrary = [];
  }
}

function saveRollbackTemplateLibrary() {
  localStorage.setItem(
    STORAGE_KEYS.rollbackTemplateLibrary,
    JSON.stringify(rollbackTemplateLibrary)
  );
}

function upsertRollbackTemplate(name, template) {
  const normalized = name.trim();
  if (!normalized || !template.trim()) return;
  const idx = rollbackTemplateLibrary.findIndex((t) => t.name === normalized);
  const item = { name: normalized, template };
  if (idx >= 0) {
    rollbackTemplateLibrary[idx] = item;
  } else {
    rollbackTemplateLibrary.push(item);
  }
  saveRollbackTemplateLibrary();
}

function deleteRollbackTemplate(name) {
  const normalized = name.trim();
  if (!normalized) return;
  rollbackTemplateLibrary = rollbackTemplateLibrary.filter((t) => t.name !== normalized);
  saveRollbackTemplateLibrary();
}

function rollbackTemplateOptionsHtml(selectedName = "") {
  const options = rollbackTemplateLibrary
    .map((item) => {
      const selected = item.name === selectedName ? "selected" : "";
      return `<option value="${escapeHtml(item.name)}" ${selected}>${escapeHtml(
        item.name
      )}</option>`;
    })
    .join("");
  return `<option value="">${escapeHtml(t("txWorkflowRollbackLibraryPick"))}</option>${options}`;
}

function safeString(value) {
  if (value == null) return "-";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function displayMode(mode) {
  const raw = String(mode || "").trim();
  return raw;
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
    /^invalid mode '([^']+)' for profile '([^']+)'; default_mode='([^']+)'; available_modes=\[(.*)\]$/
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
    } catch (err) {
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
    const kindOk = !kindFilter || kindFilter === "all" ? true : event.kind === kindFilter;
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
    return currentLang === "zh" ? "命令执行" : "Execute";
  }
  if (op === "template_execute") {
    return currentLang === "zh" ? "模板执行" : "Template Execute";
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
    label
  )}</span>`;
}

function historyModeBadge(mode) {
  const value = displayMode(mode);
  if (!value) {
    return '<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">-</span>';
  }
  return `<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">${escapeHtml(
    value
  )}</span>`;
}

function historyRecordLevelBadge(level) {
  const value = safeString(level).toLowerCase();
  const cls =
    value === "full"
      ? "border-violet-200 bg-violet-100 text-violet-800"
      : value === "off"
        ? "border-slate-200 bg-slate-100 text-slate-600"
        : "border-emerald-200 bg-emerald-100 text-emerald-800";
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}">${escapeHtml(
    value || "-"
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
          name
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
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
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

function parseTxCommands() {
  const lines = (byId("tx-commands").value || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => !!s);
  return lines;
}

function parseRollbackLinesRaw(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim());
}

function linesToArray(raw) {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
