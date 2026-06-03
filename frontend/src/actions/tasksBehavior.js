import { getTask, listTasks } from "../api/client.js";

function tr(key, fallback = key) {
  return typeof window.t === "function" ? window.t(key) : fallback;
}

function safeString(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
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
        : "border-slate-200 bg-slate-50 text-slate-600";
  return `<div class="rounded-xl border ${toneClass} px-3 py-2 text-sm">${escapeHtml(message)}</div>`;
}

function formatTaskTimestamp(value) {
  const text = safeString(value || "-");
  if (!value) return text;
  return text.replace("T", " ").replace("Z", " UTC");
}

function formatTaskDuration(ms) {
  if (ms === null || ms === undefined || ms === "") return "-";
  const num = Number(ms);
  if (!Number.isFinite(num)) return safeString(ms);
  if (num < 1000) return `${num} ms`;
  if (num < 60000) return `${(num / 1000).toFixed(num < 10000 ? 1 : 0)} s`;
  return `${(num / 60000).toFixed(1)} min`;
}

function taskStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "queued") return tr("tasksStatusQueued", "queued");
  if (normalized === "running") return tr("tasksStatusRunning", "running");
  if (normalized === "success" || normalized === "completed") {
    return tr("tasksStatusSuccess", "success");
  }
  if (normalized === "failed" || normalized === "error")
    return tr("tasksStatusFailed", "failed");
  return safeString(status || "-");
}

function taskOutcomeLabel(outcome) {
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

function badge(label, tone = "slate") {
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

function renderTaskStatusBadge(status) {
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

function renderTaskOutcomeBadge(outcome) {
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

function artifactGroupLabel(groupName) {
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

function eventAuditGroup(event) {
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

function eventAuditGroupLabel(group) {
  if (group === "lifecycle") return tr("tasksEventGroupLifecycle", "Lifecycle");
  if (group === "audit") return tr("tasksEventGroupAudit", "Audit");
  return tr("tasksEventGroupExecution", "Execution");
}

export function tasksBehavior(node) {
  let lastTaskRuns = [];
  let currentTaskId = "";
  let currentTaskDetail = null;
  let taskEventGroupFilter = "all";
  let taskEventSearchQuery = "";

  const byId = (id) => node.querySelector(`#${id}`);

  function filters() {
    return {
      limit: Number(byId("tasks-limit")?.value || 50),
      operation: byId("tasks-operation")?.value || "",
      status: byId("tasks-status")?.value || "",
      outcome: byId("tasks-outcome")?.value || "all",
      timeRange: byId("tasks-time-range")?.value || "all",
      recording: byId("tasks-recording")?.value || "all",
      error: byId("tasks-error")?.value || "all",
      search: byId("tasks-search")?.value || "",
    };
  }

  function renderTaskSummaryMeta(item) {
    const parts = [
      safeString(item.operation || "-"),
      formatTaskTimestamp(item.started_at),
    ];
    if (item.agent_name)
      parts.push(
        `${tr("tasksFieldAgent", "Agent")}: ${safeString(item.agent_name)}`,
      );
    if (item.target_label) {
      parts.push(
        `${tr("tasksFieldTarget", "Target")}: ${safeString(item.target_label)}`,
      );
    }
    if (item.source)
      parts.push(
        `${tr("tasksFieldSource", "Source")}: ${safeString(item.source)}`,
      );
    if (
      item.execution_time_ms !== null &&
      item.execution_time_ms !== undefined
    ) {
      parts.push(
        `${tr("tasksFieldDuration", "Duration")}: ${formatTaskDuration(item.execution_time_ms)}`,
      );
    }
    return parts.map((part) => escapeHtml(part)).join(" · ");
  }

  function parseTaskTimestamp(value) {
    const ts = Date.parse(String(value || ""));
    return Number.isFinite(ts) ? ts : null;
  }

  function matchesTaskTimeRange(item, timeRange) {
    if (timeRange === "all") return true;
    const startedAt =
      parseTaskTimestamp(item.started_at) ??
      parseTaskTimestamp(item.completed_at);
    if (startedAt === null) return false;
    const ranges = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    };
    const windowMs = ranges[timeRange];
    return windowMs ? startedAt >= Date.now() - windowMs : true;
  }

  function matchesTaskListFilter(item) {
    const current = filters();
    const query = current.search.trim().toLowerCase();
    if (query) {
      const haystack = [
        item.task_id,
        item.operation,
        item.status,
        item.outcome,
        item.summary,
        item.agent_name,
        item.source,
        item.target_label,
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (!matchesTaskTimeRange(item, current.timeRange)) return false;
    if (current.outcome === "none") {
      if (item.outcome) return false;
    } else if (current.outcome !== "all") {
      if (String(item.outcome || "").toLowerCase() !== current.outcome)
        return false;
    }
    if (current.recording === "yes" && !item.has_recording) return false;
    if (current.recording === "no" && item.has_recording) return false;
    if (current.error === "yes" && !item.has_error) return false;
    if (current.error === "no" && item.has_error) return false;
    return true;
  }

  function renderTaskList(items = lastTaskRuns) {
    const list = byId("tasks-list");
    const meta = byId("tasks-list-meta");
    const empty = byId("tasks-empty-state");
    if (!list || !meta || !empty) return;
    const allRows = Array.isArray(items) ? items : [];
    const rows = allRows.filter(matchesTaskListFilter);
    meta.textContent = `${rows.length} / ${allRows.length} ${tr("tasksListMetaCount", "tasks")}`;
    empty.hidden = rows.length > 0;
    list.innerHTML = rows
      .map((item) => {
        const selected = currentTaskId && item.task_id === currentTaskId;
        return `
          <article class="rounded-xl border px-3 py-3 ${
            selected
              ? "border-cyan-300 bg-cyan-50/60"
              : "border-slate-200 bg-white"
          }">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="grid gap-1">
                <div class="flex flex-wrap items-center gap-2">
                  <div class="font-mono text-xs text-slate-500">${escapeHtml(safeString(item.task_id))}</div>
                  ${renderTaskStatusBadge(item.status)}
                  ${renderTaskOutcomeBadge(item.outcome)}
                  ${item.has_recording ? badge(tr("tasksFlagRecording", "recording"), "emerald") : ""}
                  ${item.has_error ? badge(tr("tasksFlagError", "error"), "rose") : ""}
                </div>
                <div class="text-sm font-semibold text-slate-900">${escapeHtml(
                  safeString(item.summary || "-"),
                )}</div>
                <div class="text-xs text-slate-500">${renderTaskSummaryMeta(item)}</div>
              </div>
              <button class="btn btn-sm js-task-detail-btn" type="button" data-task-id="${escapeHtml(
                safeString(item.task_id),
              )}">${escapeHtml(tr("tasksActionView", "View"))}</button>
            </div>
          </article>`;
      })
      .join("");
  }

  function renderTaskSummaryCards(detail) {
    const summary = detail?.result_summary || null;
    const counts = summary?.counts || null;
    const cards = [
      [tr("tasksFieldOutcome", "Outcome"), taskOutcomeLabel(detail.outcome)],
      [
        tr("tasksFieldDuration", "Duration"),
        formatTaskDuration(detail.execution_time_ms),
      ],
      [
        tr("tasksFieldRecording", "Recording"),
        summary?.recording_available === true || detail.has_recording
          ? tr("tasksRecordingAvailable", "available")
          : tr("tasksRecordingUnavailable", "unavailable"),
      ],
      [
        tr("tasksFieldEventCount", "Events"),
        Array.isArray(detail.events) ? String(detail.events.length) : "0",
      ],
    ];
    if (counts) {
      cards.push([tr("tasksCountTotal", "Total"), String(counts.total ?? "-")]);
      cards.push([
        tr("tasksCountSucceeded", "Succeeded"),
        String(counts.succeeded ?? "-"),
      ]);
      cards.push([
        tr("tasksCountFailed", "Failed"),
        String(counts.failed ?? "-"),
      ]);
      if (counts.skipped !== null && counts.skipped !== undefined) {
        cards.push([
          tr("tasksCountSkipped", "Skipped"),
          String(counts.skipped),
        ]);
      }
    }
    return `
      <section class="grid gap-2 md:grid-cols-2">
        ${cards
          .map(
            ([label, value]) => `
              <div class="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(
                  label,
                )}</div>
                <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(value)}</div>
              </div>`,
          )
          .join("")}
      </section>`;
  }

  function renderTaskArtifacts(detail) {
    const artifacts = Array.isArray(detail.artifacts) ? detail.artifacts : [];
    if (!artifacts.length) {
      return `
        <section class="grid gap-2">
          <div class="text-sm font-semibold text-slate-900">${escapeHtml(tr("tasksFieldArtifacts", "Artifacts"))}</div>
          ${statusCard(tr("tasksArtifactsEmpty", "no artifacts"), "info")}
        </section>`;
    }
    const grouped = new Map();
    for (const artifact of artifacts) {
      const key = safeString(artifact.artifact_type || "other");
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(artifact);
    }
    return `
      <section class="grid gap-2">
        <div class="text-sm font-semibold text-slate-900">${escapeHtml(tr("tasksFieldArtifacts", "Artifacts"))}</div>
        ${Array.from(grouped.entries())
          .map(([groupName, items]) => {
            const rows = items
              .map(
                (artifact, index) => `
                  <details class="rounded-xl border border-slate-200 bg-white" ${index === 0 ? "open" : ""}>
                    <summary class="cursor-pointer list-none px-3 py-3">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="grid gap-1">
                          <div class="text-sm font-semibold text-slate-900">${escapeHtml(
                            safeString(artifact.name || artifact.artifact_type),
                          )}</div>
                          <div class="text-xs text-slate-500">${escapeHtml(
                            [
                              artifact.size_bytes != null
                                ? `${artifact.size_bytes} bytes`
                                : "",
                              artifact.created_at
                                ? formatTaskTimestamp(artifact.created_at)
                                : "",
                              artifact.storage_ref
                                ? `ref: ${artifact.storage_ref}`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" · ") || "-",
                          )}</div>
                        </div>
                        ${artifact.content_type ? badge(safeString(artifact.content_type), "emerald") : ""}
                      </div>
                    </summary>
                    <div class="border-t border-slate-200 px-3 py-3">
                      <pre class="output">${escapeHtml(safeString(artifact.content_text || "-"))}</pre>
                    </div>
                  </details>`,
              )
              .join("");
            return `
              <section class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div class="text-sm font-semibold text-slate-900">${escapeHtml(
                    artifactGroupLabel(groupName),
                  )}</div>
                  <div class="flex flex-wrap items-center gap-2">
                    ${badge(safeString(groupName))}
                    ${badge(`${items.length} ${tr("tasksArtifactItems", "items")}`, "emerald")}
                  </div>
                </div>
                <div class="grid gap-2">${rows}</div>
              </section>`;
          })
          .join("")}
      </section>`;
  }

  function matchesTaskEventFilter(event) {
    if (
      taskEventGroupFilter !== "all" &&
      eventAuditGroup(event) !== taskEventGroupFilter
    ) {
      return false;
    }
    const query = taskEventSearchQuery.trim().toLowerCase();
    if (!query) return true;
    const haystack = [
      event.event_type,
      event.level,
      event.stage,
      event.message,
      event.details ? JSON.stringify(event.details) : "",
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    return haystack.includes(query);
  }

  function renderTaskEvents(detail) {
    const events = Array.isArray(detail.events) ? detail.events : [];
    const filtered = events.filter(matchesTaskEventFilter);
    const groups = new Map();
    for (const event of filtered) {
      const group = eventAuditGroup(event);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(event);
    }
    const sections = filtered.length
      ? ["lifecycle", "execution", "audit"]
          .filter((group) => groups.has(group))
          .map((group) => {
            const items = groups.get(group) || [];
            const rows = items
              .map(
                (event, index) => `
                  <details class="rounded-xl border border-slate-200 bg-white" ${index === 0 ? "open" : ""}>
                    <summary class="cursor-pointer list-none px-3 py-3">
                      <div class="grid gap-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <div class="text-xs font-semibold text-slate-700">${escapeHtml(
                            safeString(event.event_type),
                          )}</div>
                          ${badge(safeString(event.level || "-"), String(event.level || "").toLowerCase() === "error" ? "rose" : "slate")}
                          ${event.stage ? badge(safeString(event.stage), "emerald") : ""}
                        </div>
                        <div class="text-sm text-slate-900">${escapeHtml(safeString(event.message || "-"))}</div>
                        <div class="text-[11px] text-slate-500">${escapeHtml(formatTaskTimestamp(event.occurred_at))}</div>
                      </div>
                    </summary>
                    <div class="border-t border-slate-200 px-3 py-3">
                      ${
                        event.details
                          ? `<pre class="output">${escapeHtml(JSON.stringify(event.details, null, 2))}</pre>`
                          : `<div class="text-xs text-slate-500">${escapeHtml(
                              tr("tasksEventNoDetails", "no details"),
                            )}</div>`
                      }
                    </div>
                  </details>`,
              )
              .join("");
            return `
              <section class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div class="text-sm font-semibold text-slate-900">${escapeHtml(eventAuditGroupLabel(group))}</div>
                  ${badge(`${items.length} ${tr("tasksEventItems", "items")}`, "emerald")}
                </div>
                <div class="grid gap-2">${rows}</div>
              </section>`;
          })
          .join("")
      : statusCard(tr("tasksEventsEmpty", "no events"), "info");

    return `
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm font-semibold text-slate-900">${escapeHtml(tr("tasksFieldEvents", "Events"))}</div>
          <div class="text-xs text-slate-500">${escapeHtml(
            `${filtered.length} / ${events.length} ${tr("tasksEventItems", "items")}`,
          )}</div>
        </div>
        <div class="mt-3 grid gap-2 md:grid-cols-[180px_1fr]">
          <select class="input js-task-event-group" aria-label="${escapeHtml(
            tr("tasksEventFilterGroup", "Event group"),
          )}">
            <option value="all" ${taskEventGroupFilter === "all" ? "selected" : ""}>${escapeHtml(
              tr("tasksEventGroupAll", "All"),
            )}</option>
            <option value="lifecycle" ${
              taskEventGroupFilter === "lifecycle" ? "selected" : ""
            }>${escapeHtml(tr("tasksEventGroupLifecycle", "Lifecycle"))}</option>
            <option value="execution" ${
              taskEventGroupFilter === "execution" ? "selected" : ""
            }>${escapeHtml(tr("tasksEventGroupExecution", "Execution"))}</option>
            <option value="audit" ${taskEventGroupFilter === "audit" ? "selected" : ""}>${escapeHtml(
              tr("tasksEventGroupAudit", "Audit"),
            )}</option>
          </select>
          <input class="input js-task-event-search" type="text" value="${escapeHtml(
            taskEventSearchQuery,
          )}" placeholder="${escapeHtml(tr("tasksEventSearchPlaceholder", "search events"))}" />
        </div>
        <div class="mt-3 grid gap-2">${sections}</div>
      </section>`;
  }

  function renderTaskDetail(detail = currentTaskDetail) {
    const wrap = byId("tasks-detail");
    const empty = byId("tasks-detail-empty");
    if (!wrap || !empty) return;
    if (!detail) {
      empty.hidden = false;
      wrap.innerHTML = "";
      return;
    }
    empty.hidden = true;
    const summary = detail?.result_summary || null;
    wrap.innerHTML = `
      <section class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div class="flex flex-wrap items-center gap-2">
          ${renderTaskStatusBadge(detail.status)}
          ${renderTaskOutcomeBadge(detail.outcome)}
        </div>
        <div class="mt-2 font-mono text-xs text-slate-500 break-all">${escapeHtml(
          safeString(detail.task_id),
        )}</div>
        <div class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(
          safeString(detail.summary || "-"),
        )}</div>
        <div class="mt-3 grid gap-1 text-xs text-slate-600">
          <div><span class="font-semibold">${escapeHtml(tr("tasksFieldTarget", "Target"))}:</span> ${escapeHtml(
            safeString(detail.target_label || "-"),
          )}</div>
          <div><span class="font-semibold">${escapeHtml(tr("tasksFieldSource", "Source"))}:</span> ${escapeHtml(
            safeString(detail.source || "-"),
          )}</div>
          <div><span class="font-semibold">${escapeHtml(tr("tasksFieldAgent", "Agent"))}:</span> ${escapeHtml(
            safeString(detail.agent_name || "-"),
          )}</div>
          <div><span class="font-semibold">${escapeHtml(
            tr("tasksFieldDuration", "Duration"),
          )}:</span> ${escapeHtml(formatTaskDuration(detail.execution_time_ms))}</div>
          <div><span class="font-semibold">${escapeHtml(
            tr("tasksFieldOutcome", "Outcome"),
          )}:</span> ${escapeHtml(taskOutcomeLabel(detail.outcome))}</div>
        </div>
      </section>
      ${renderTaskSummaryCards(detail)}
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="text-sm font-semibold text-slate-900">${escapeHtml(
          tr("tasksFieldResultSummary", "Result Summary"),
        )}</div>
        <pre class="output mt-2">${escapeHtml(
          JSON.stringify(
            summary
              ? {
                  operation: summary.operation ?? null,
                  outcome: summary.outcome ?? null,
                  success: summary.success ?? null,
                  summary: summary.summary ?? null,
                  counts: summary.counts ?? null,
                  recording_available: summary.recording_available ?? null,
                }
              : null,
            null,
            2,
          ),
        )}</pre>
        <div class="mt-3 text-sm font-semibold text-slate-900">${escapeHtml(
          tr("tasksFieldSummaryDetails", "Summary Details"),
        )}</div>
        <pre class="output mt-2">${escapeHtml(JSON.stringify(summary?.details ?? null, null, 2))}</pre>
      </section>
      ${renderTaskArtifacts(detail)}
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="text-sm font-semibold text-slate-900">${escapeHtml(tr("tasksFieldError", "Error"))}</div>
        <pre class="output mt-2">${escapeHtml(JSON.stringify(detail.error ?? null, null, 2))}</pre>
      </section>
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="text-sm font-semibold text-slate-900">${escapeHtml(tr("tasksFieldResult", "Result"))}</div>
        <pre class="output mt-2">${escapeHtml(JSON.stringify(detail.result ?? null, null, 2))}</pre>
      </section>
      ${renderTaskEvents(detail)}`;
  }

  async function loadTasks() {
    const out = byId("tasks-out");
    if (out) out.innerHTML = statusCard(tr("running", "running"), "running");
    try {
      const current = filters();
      const data = await listTasks({
        limit: current.limit,
        operation: current.operation,
        status: current.status,
      });
      lastTaskRuns = Array.isArray(data) ? data : [];
      renderTaskList(lastTaskRuns);
      if (out) out.innerHTML = "";
      if (
        currentTaskId &&
        !lastTaskRuns.some((item) => item.task_id === currentTaskId)
      ) {
        currentTaskId = "";
        currentTaskDetail = null;
        renderTaskDetail();
      }
    } catch (error) {
      lastTaskRuns = [];
      renderTaskList(lastTaskRuns);
      if (out) out.innerHTML = statusCard(error.message, "error");
    }
  }

  async function loadTaskDetail(taskId) {
    currentTaskId = safeString(taskId);
    renderTaskList(lastTaskRuns);
    const wrap = byId("tasks-detail");
    const empty = byId("tasks-detail-empty");
    if (empty) empty.hidden = true;
    if (wrap) wrap.innerHTML = statusCard(tr("running", "running"), "running");
    try {
      currentTaskDetail = await getTask(currentTaskId);
      renderTaskDetail(currentTaskDetail);
      renderTaskList(lastTaskRuns);
    } catch (error) {
      currentTaskDetail = null;
      if (wrap) wrap.innerHTML = statusCard(error.message, "error");
    }
  }

  function clearFilters() {
    byId("tasks-search").value = "";
    byId("tasks-operation").value = "";
    byId("tasks-status").value = "";
    byId("tasks-outcome").value = "all";
    byId("tasks-time-range").value = "all";
    byId("tasks-recording").value = "all";
    byId("tasks-error").value = "all";
    byId("tasks-limit").value = "50";
    loadTasks();
  }

  function onListClick(event) {
    const detailBtn = event.target.closest(".js-task-detail-btn");
    if (!detailBtn) return;
    const taskId = detailBtn.getAttribute("data-task-id") || "";
    if (taskId) loadTaskDetail(taskId);
  }

  function onDetailChange(event) {
    if (event.target.matches(".js-task-event-group")) {
      taskEventGroupFilter = event.target.value || "all";
      renderTaskDetail(currentTaskDetail);
    }
  }

  function onDetailInput(event) {
    if (event.target.matches(".js-task-event-search")) {
      taskEventSearchQuery = event.target.value || "";
      renderTaskDetail(currentTaskDetail);
    }
  }

  const refreshBtn = byId("tasks-refresh-btn");
  const clearBtn = byId("tasks-clear-btn");
  const list = byId("tasks-list");
  const detail = byId("tasks-detail");
  const search = byId("tasks-search");
  const operation = byId("tasks-operation");
  const status = byId("tasks-status");
  const outcome = byId("tasks-outcome");
  const timeRange = byId("tasks-time-range");
  const recording = byId("tasks-recording");
  const errorFilter = byId("tasks-error");
  const limit = byId("tasks-limit");

  const onRefreshClick = () =>
    typeof window.withButtonLoading === "function"
      ? window.withButtonLoading("tasks-refresh-btn", loadTasks)
      : loadTasks();
  const onFilterRenderChange = () => renderTaskList();

  refreshBtn?.addEventListener("click", onRefreshClick);
  clearBtn?.addEventListener("click", clearFilters);
  list?.addEventListener("click", onListClick);
  detail?.addEventListener("change", onDetailChange);
  detail?.addEventListener("input", onDetailInput);
  search?.addEventListener("input", onFilterRenderChange);
  operation?.addEventListener("change", loadTasks);
  status?.addEventListener("change", loadTasks);
  outcome?.addEventListener("change", onFilterRenderChange);
  timeRange?.addEventListener("change", onFilterRenderChange);
  recording?.addEventListener("change", onFilterRenderChange);
  errorFilter?.addEventListener("change", onFilterRenderChange);
  limit?.addEventListener("change", loadTasks);

  window.loadTasks = loadTasks;
  window.loadTaskDetail = loadTaskDetail;
  window.renderTaskList = renderTaskList;
  window.renderTaskDetail = renderTaskDetail;

  renderTaskDetail();
  renderTaskList();

  return {
    destroy() {
      refreshBtn?.removeEventListener("click", onRefreshClick);
      clearBtn?.removeEventListener("click", clearFilters);
      list?.removeEventListener("click", onListClick);
      detail?.removeEventListener("change", onDetailChange);
      detail?.removeEventListener("input", onDetailInput);
      search?.removeEventListener("input", onFilterRenderChange);
      operation?.removeEventListener("change", loadTasks);
      status?.removeEventListener("change", loadTasks);
      outcome?.removeEventListener("change", onFilterRenderChange);
      timeRange?.removeEventListener("change", onFilterRenderChange);
      recording?.removeEventListener("change", onFilterRenderChange);
      errorFilter?.removeEventListener("change", onFilterRenderChange);
      limit?.removeEventListener("change", loadTasks);
    },
  };
}
