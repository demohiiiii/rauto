import {
  artifactGroupLabel,
  badge,
  escapeHtml,
  eventAuditGroup,
  eventAuditGroupLabel,
  formatTaskDuration,
  formatTaskTimestamp,
  renderTaskOutcomeBadge,
  renderTaskStatusBadge,
  safeString,
  statusCard,
  taskOutcomeLabel,
  tr,
} from "./taskFormat.js";

function renderTaskSummaryMeta(item) {
  const parts = [
    safeString(item.operation || "-"),
    formatTaskTimestamp(item.started_at),
  ];
  if (item.agent_name) {
    parts.push(
      `${tr("tasksFieldAgent", "Agent")}: ${safeString(item.agent_name)}`,
    );
  }
  if (item.target_label) {
    parts.push(
      `${tr("tasksFieldTarget", "Target")}: ${safeString(item.target_label)}`,
    );
  }
  if (item.source) {
    parts.push(
      `${tr("tasksFieldSource", "Source")}: ${safeString(item.source)}`,
    );
  }
  if (item.execution_time_ms !== null && item.execution_time_ms !== undefined) {
    parts.push(
      `${tr("tasksFieldDuration", "Duration")}: ${formatTaskDuration(item.execution_time_ms)}`,
    );
  }
  return parts.map((part) => escapeHtml(part)).join(" · ");
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
      cards.push([tr("tasksCountSkipped", "Skipped"), String(counts.skipped)]);
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

function matchesTaskEventFilter(event, groupFilter, searchQuery) {
  if (groupFilter !== "all" && eventAuditGroup(event) !== groupFilter) {
    return false;
  }
  const query = searchQuery.trim().toLowerCase();
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

function renderTaskEvents(detail, { groupFilter, searchQuery }) {
  const events = Array.isArray(detail.events) ? detail.events : [];
  const filtered = events.filter((event) =>
    matchesTaskEventFilter(event, groupFilter, searchQuery),
  );
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
            <option value="all" ${groupFilter === "all" ? "selected" : ""}>${escapeHtml(
              tr("tasksEventGroupAll", "All"),
            )}</option>
            <option value="lifecycle" ${
              groupFilter === "lifecycle" ? "selected" : ""
            }>${escapeHtml(tr("tasksEventGroupLifecycle", "Lifecycle"))}</option>
            <option value="execution" ${
              groupFilter === "execution" ? "selected" : ""
            }>${escapeHtml(tr("tasksEventGroupExecution", "Execution"))}</option>
            <option value="audit" ${groupFilter === "audit" ? "selected" : ""}>${escapeHtml(
              tr("tasksEventGroupAudit", "Audit"),
            )}</option>
          </select>
          <input class="input js-task-event-search" type="text" value="${escapeHtml(
            searchQuery,
          )}" placeholder="${escapeHtml(tr("tasksEventSearchPlaceholder", "search events"))}" />
        </div>
        <div class="mt-3 grid gap-2">${sections}</div>
      </section>`;
}

export function renderTaskListView({
  currentTaskId = "",
  empty,
  list,
  meta,
  rows = [],
  totalCount = 0,
}) {
  if (!list || !meta || !empty) return;
  meta.textContent = `${rows.length} / ${totalCount} ${tr("tasksListMetaCount", "tasks")}`;
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

export function renderTaskDetailView({
  detail,
  empty,
  eventGroupFilter = "all",
  eventSearchQuery = "",
  wrap,
}) {
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
      ${renderTaskEvents(detail, {
        groupFilter: eventGroupFilter,
        searchQuery: eventSearchQuery,
      })}`;
}
