export function tr(key, fallback = key) {
  return typeof window.t === "function" ? window.t(key) : fallback;
}

export function safeString(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function escapeHtml(value) {
  return safeString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function statusCard(message, tone = "info") {
  if (typeof window.renderStatusMessageCard === "function") {
    return window.renderStatusMessageCard(message, tone);
  }
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return `<div class="rounded-xl border ${toneClass} px-3 py-2 text-sm">${escapeHtml(message)}</div>`;
}

export function formatTaskTimestamp(value) {
  const text = safeString(value || "-");
  if (!value) return text;
  return text.replace("T", " ").replace("Z", " UTC");
}

export function formatTaskDuration(ms) {
  if (ms === null || ms === undefined || ms === "") return "-";
  const num = Number(ms);
  if (!Number.isFinite(num)) return safeString(ms);
  if (num < 1000) return `${num} ms`;
  if (num < 60000) return `${(num / 1000).toFixed(num < 10000 ? 1 : 0)} s`;
  return `${(num / 60000).toFixed(1)} min`;
}

export function taskStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "queued") return tr("tasksStatusQueued", "queued");
  if (normalized === "running") return tr("tasksStatusRunning", "running");
  if (normalized === "success" || normalized === "completed") {
    return tr("tasksStatusSuccess", "success");
  }
  if (normalized === "failed" || normalized === "error") {
    return tr("tasksStatusFailed", "failed");
  }
  return safeString(status || "-");
}

export function taskOutcomeLabel(outcome) {
  const normalized = String(outcome || "").toLowerCase();
  if (normalized === "success") return tr("tasksOutcomeSuccess", "success");
  if (
    normalized === "failure" ||
    normalized === "failed" ||
    normalized === "error"
  ) {
    return tr("tasksOutcomeFailure", "failure");
  }
  if (normalized === "partial_success" || normalized === "partial") {
    return tr("tasksOutcomePartial", "partial");
  }
  return safeString(outcome || "-");
}

export function badge(label, tone = "slate") {
  const palette =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : tone === "cyan"
          ? "border-cyan-200 bg-cyan-50 text-cyan-700"
          : "border-slate-200 bg-slate-50 text-slate-600";
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${palette}">${escapeHtml(
    label,
  )}</span>`;
}

export function renderTaskStatusBadge(status) {
  const normalized = String(status || "").toLowerCase();
  const tone =
    normalized === "success" || normalized === "completed"
      ? "emerald"
      : normalized === "failed" || normalized === "error"
        ? "rose"
        : normalized === "running"
          ? "cyan"
          : "slate";
  return badge(taskStatusLabel(status), tone);
}

export function renderTaskOutcomeBadge(outcome) {
  if (!outcome) return "";
  const normalized = String(outcome || "").toLowerCase();
  const tone =
    normalized === "success"
      ? "emerald"
      : normalized === "partial_success" || normalized === "partial"
        ? "slate"
        : "rose";
  return badge(taskOutcomeLabel(outcome), tone);
}

export function artifactGroupLabel(groupName) {
  const normalized = String(groupName || "").toLowerCase();
  if (normalized === "recording_jsonl")
    return tr("tasksArtifactGroupRecording", "Recording");
  if (normalized === "rendered_commands")
    return tr("tasksArtifactGroupRendered", "Rendered");
  if (normalized === "tx_result_json") return tr("tasksArtifactGroupTx", "TX");
  if (normalized === "workflow_result_json")
    return tr("tasksArtifactGroupWorkflow", "Workflow");
  if (normalized === "orchestration_result_json") {
    return tr("tasksArtifactGroupOrchestration", "Orchestration");
  }
  if (normalized === "execution_result_json")
    return tr("tasksArtifactGroupExecution", "Execution");
  return safeString(groupName || "-");
}

export function eventAuditGroup(event) {
  const eventType = String(event?.event_type || "").toLowerCase();
  const stage = String(event?.stage || "").toLowerCase();
  const message = String(event?.message || "").toLowerCase();
  if (["started", "progress", "completed", "failed"].includes(eventType)) {
    return "lifecycle";
  }
  if (
    stage.includes("audit") ||
    stage.includes("callback") ||
    stage.includes("record") ||
    stage.includes("report") ||
    message.includes("callback") ||
    message.includes("recording saved")
  ) {
    return "audit";
  }
  return "execution";
}

export function eventAuditGroupLabel(group) {
  if (group === "lifecycle") return tr("tasksEventGroupLifecycle", "Lifecycle");
  if (group === "audit") return tr("tasksEventGroupAudit", "Audit");
  return tr("tasksEventGroupExecution", "Execution");
}
