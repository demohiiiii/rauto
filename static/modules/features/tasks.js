/**
 * tasks.js - task center list/detail rendering
 */

function formatTaskTimestamp(value) {
  const text = safeString(value || "-");
  if (!value) return text;
  return text.replace("T", " ").replace("Z", " UTC");
}

function formatTaskDuration(ms) {
  if (ms === null || ms === undefined || ms === "") {
    return "-";
  }
  const num = Number(ms);
  if (!Number.isFinite(num)) return safeString(ms);
  if (num < 1000) return `${num} ms`;
  if (num < 60000) return `${(num / 1000).toFixed(num < 10000 ? 1 : 0)} s`;
  return `${(num / 60000).toFixed(1)} min`;
}

function taskStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "queued") return t("tasksStatusQueued");
  if (normalized === "running") return t("tasksStatusRunning");
  if (normalized === "success" || normalized === "completed") return t("tasksStatusSuccess");
  if (normalized === "failed" || normalized === "error") return t("tasksStatusFailed");
  return safeString(status || "-");
}

function taskOutcomeLabel(outcome) {
  const normalized = String(outcome || "").toLowerCase();
  if (normalized === "success") return t("tasksOutcomeSuccess");
  if (normalized === "failure" || normalized === "failed" || normalized === "error") {
    return t("tasksOutcomeFailure");
  }
  if (normalized === "partial_success" || normalized === "partial") {
    return t("tasksOutcomePartial");
  }
  return safeString(outcome || "-");
}

function renderTaskStatusBadge(status) {
  const normalized = String(status || "").toLowerCase();
  const cls =
    normalized === "success" || normalized === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalized === "failed" || normalized === "error"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : normalized === "running"
          ? "border-cyan-200 bg-cyan-50 text-cyan-700"
          : "border-slate-200 bg-slate-50 text-slate-600";
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}">${escapeHtml(
    taskStatusLabel(status)
  )}</span>`;
}

function renderTaskOutcomeBadge(outcome) {
  if (!outcome) return "";
  const normalized = String(outcome || "").toLowerCase();
  const cls =
    normalized === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : normalized === "partial_success" || normalized === "partial"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-rose-200 bg-rose-50 text-rose-700";
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}">${escapeHtml(
    taskOutcomeLabel(outcome)
  )}</span>`;
}

function renderTaskFlagBadge(label, tone = "slate") {
  const palette =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${palette}">${escapeHtml(
    label
  )}</span>`;
}

function renderTaskSummaryMeta(item) {
  const parts = [safeString(item.operation || "-"), formatTaskTimestamp(item.started_at)];
  if (item.agent_name) {
    parts.push(`${t("tasksFieldAgent")}: ${safeString(item.agent_name)}`);
  }
  if (item.target_label) {
    parts.push(`${t("tasksFieldTarget")}: ${safeString(item.target_label)}`);
  }
  if (item.source) {
    parts.push(`${t("tasksFieldSource")}: ${safeString(item.source)}`);
  }
  if (item.execution_time_ms !== null && item.execution_time_ms !== undefined) {
    parts.push(`${t("tasksFieldDuration")}: ${formatTaskDuration(item.execution_time_ms)}`);
  }
  return parts.map((part) => escapeHtml(part)).join(" · ");
}

function parseTaskTimestamp(value) {
  const ts = Date.parse(String(value || ""));
  return Number.isFinite(ts) ? ts : null;
}

function matchesTaskTimeRange(item) {
  if (taskTimeRangeFilter === "all") return true;
  const startedAt = parseTaskTimestamp(item.started_at) ?? parseTaskTimestamp(item.completed_at);
  if (startedAt === null) return false;
  const now = Date.now();
  const ranges = {
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  };
  const windowMs = ranges[taskTimeRangeFilter];
  if (!windowMs) return true;
  return startedAt >= now - windowMs;
}

function matchesTaskSearch(item) {
  const query = String(taskSearchQuery || "").trim().toLowerCase();
  if (!query) return true;
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
  return haystack.includes(query);
}

function matchesTaskListFilter(item) {
  if (!matchesTaskSearch(item)) return false;
  if (!matchesTaskTimeRange(item)) return false;

  if (taskOutcomeFilter === "none") {
    if (item.outcome) return false;
  } else if (taskOutcomeFilter !== "all") {
    const normalizedOutcome = String(item.outcome || "").toLowerCase();
    if (normalizedOutcome !== taskOutcomeFilter) return false;
  }

  if (taskRecordingFilter === "yes" && !item.has_recording) return false;
  if (taskRecordingFilter === "no" && item.has_recording) return false;

  if (taskErrorFilter === "yes" && !item.has_error) return false;
  if (taskErrorFilter === "no" && item.has_error) return false;

  return true;
}

function renderTaskList(items = lastTaskRuns) {
  const list = byId("tasks-list");
  const meta = byId("tasks-list-meta");
  const empty = byId("tasks-empty-state");
  if (!list || !meta || !empty) return;

  const allRows = Array.isArray(items) ? items : [];
  const rows = allRows.filter(matchesTaskListFilter);
  meta.textContent = `${rows.length} / ${allRows.length} ${t("tasksListMetaCount")}`;
  empty.hidden = rows.length > 0;

  if (!rows.length) {
    list.innerHTML = "";
    return;
  }

  list.innerHTML = rows
    .map((item) => {
      const selected = currentTaskId && item.task_id === currentTaskId;
      return `
        <article class="rounded-xl border px-3 py-3 ${
          selected ? "border-cyan-300 bg-cyan-50/60" : "border-slate-200 bg-white"
        }">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="grid gap-1">
              <div class="flex flex-wrap items-center gap-2">
                <div class="font-mono text-xs text-slate-500">${escapeHtml(safeString(item.task_id))}</div>
                ${renderTaskStatusBadge(item.status)}
                ${renderTaskOutcomeBadge(item.outcome)}
                ${item.has_recording ? renderTaskFlagBadge(t("tasksFlagRecording"), "emerald") : ""}
                ${item.has_error ? renderTaskFlagBadge(t("tasksFlagError"), "rose") : ""}
              </div>
              <div class="text-sm font-semibold text-slate-900">${escapeHtml(
                safeString(item.summary || "-")
              )}</div>
              <div class="text-xs text-slate-500">${renderTaskSummaryMeta(item)}</div>
            </div>
            <button class="btn btn-sm js-task-detail-btn" type="button" data-task-id="${escapeHtml(
              safeString(item.task_id)
            )}">${escapeHtml(t("tasksActionView"))}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTaskSummaryCards(detail) {
  const summary = detail && detail.result_summary ? detail.result_summary : null;
  const counts = summary && summary.counts ? summary.counts : null;
  const cards = [
    [t("tasksFieldOutcome"), taskOutcomeLabel(detail.outcome)],
    [t("tasksFieldDuration"), formatTaskDuration(detail.execution_time_ms)],
    [
      t("tasksFieldRecording"),
      summary && summary.recording_available === true
        ? t("tasksRecordingAvailable")
        : detail.has_recording
          ? t("tasksRecordingAvailable")
          : t("tasksRecordingUnavailable"),
    ],
    [t("tasksFieldEventCount"), Array.isArray(detail.events) ? String(detail.events.length) : "0"],
  ];
  if (counts) {
    cards.push([t("tasksCountTotal"), String(counts.total ?? "-")]);
    cards.push([t("tasksCountSucceeded"), String(counts.succeeded ?? "-")]);
    cards.push([t("tasksCountFailed"), String(counts.failed ?? "-")]);
    if (counts.skipped !== null && counts.skipped !== undefined) {
      cards.push([t("tasksCountSkipped"), String(counts.skipped)]);
    }
  }
  return `
    <section class="grid gap-2 md:grid-cols-2">
      ${cards
        .map(
          ([label, value]) => `
            <div class="rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(
                label
              )}</div>
              <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(value)}</div>
            </div>
          `
        )
        .join("")}
    </section>
  `;
}

function renderTaskSummaryDetails(detail) {
  const summary = detail && detail.result_summary ? detail.result_summary : null;
  const details = summary && summary.details ? summary.details : null;
  return `
    <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div class="text-sm font-semibold text-slate-900">${escapeHtml(t("tasksFieldResultSummary"))}</div>
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
          2
        )
      )}</pre>
      <div class="mt-3 text-sm font-semibold text-slate-900">${escapeHtml(t("tasksFieldSummaryDetails"))}</div>
      <pre class="output mt-2">${escapeHtml(JSON.stringify(details ?? null, null, 2))}</pre>
    </section>
  `;
}

function renderTaskArtifacts(detail) {
  const artifacts = Array.isArray(detail.artifacts) ? detail.artifacts : [];
  const grouped = new Map();
  for (const artifact of artifacts) {
    const key = safeString(artifact.artifact_type || "other");
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(artifact);
  }
  const rows = artifacts.length
    ? Array.from(grouped.entries())
        .map(([groupName, items]) => {
          const itemRows = items
            .map(
              (artifact, index) => `
                <details class="rounded-xl border border-slate-200 bg-white" ${
                  index === 0 ? "open" : ""
                }>
                  <summary class="cursor-pointer list-none px-3 py-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="grid gap-1">
                        <div class="text-sm font-semibold text-slate-900">${escapeHtml(
                          safeString(artifact.name || artifact.artifact_type)
                        )}</div>
                        <div class="text-xs text-slate-500">${escapeHtml(
                          [
                            artifact.size_bytes != null ? `${artifact.size_bytes} bytes` : "",
                            artifact.created_at ? formatTaskTimestamp(artifact.created_at) : "",
                            artifact.storage_ref ? `ref: ${artifact.storage_ref}` : "",
                          ]
                            .filter(Boolean)
                            .join(" · ") || "-"
                        )}</div>
                      </div>
                      <div class="flex flex-wrap items-center gap-2">
                        ${
                          artifact.content_type
                            ? renderTaskFlagBadge(safeString(artifact.content_type), "emerald")
                            : ""
                        }
                      </div>
                    </div>
                  </summary>
                  <div class="border-t border-slate-200 px-3 py-3">
                    <pre class="output">${escapeHtml(safeString(artifact.content_text || "-"))}</pre>
                  </div>
                </details>
              `
            )
            .join("");
          return `
            <section class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div class="text-sm font-semibold text-slate-900">${escapeHtml(
                  artifactGroupLabel(groupName)
                )}</div>
                <div class="flex flex-wrap items-center gap-2">
                  ${renderTaskFlagBadge(safeString(groupName))}
                  ${renderTaskFlagBadge(`${items.length} ${t("tasksArtifactItems")}`, "emerald")}
                </div>
              </div>
              <div class="grid gap-2">${itemRows}</div>
            </section>
          `;
        })
        .join("")
    : renderStatusMessageCard(t("tasksArtifactsEmpty"), "info");
  return `
    <section class="grid gap-2">
      <div class="text-sm font-semibold text-slate-900">${escapeHtml(t("tasksFieldArtifacts"))}</div>
      ${rows}
    </section>
  `;
}

function artifactGroupLabel(groupName) {
  const normalized = String(groupName || "").toLowerCase();
  if (normalized === "recording_jsonl") return t("tasksArtifactGroupRecording");
  if (normalized === "rendered_commands") return t("tasksArtifactGroupRendered");
  if (normalized === "tx_result_json") return t("tasksArtifactGroupTx");
  if (normalized === "workflow_result_json") return t("tasksArtifactGroupWorkflow");
  if (normalized === "orchestration_result_json") return t("tasksArtifactGroupOrchestration");
  if (normalized === "execution_result_json") return t("tasksArtifactGroupExecution");
  return safeString(groupName || "-");
}

function eventAuditGroup(event) {
  const eventType = String(event && event.event_type ? event.event_type : "").toLowerCase();
  const stage = String(event && event.stage ? event.stage : "").toLowerCase();
  const message = String(event && event.message ? event.message : "").toLowerCase();
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
  if (group === "lifecycle") return t("tasksEventGroupLifecycle");
  if (group === "audit") return t("tasksEventGroupAudit");
  return t("tasksEventGroupExecution");
}

function renderEventLevelBadge(level) {
  const normalized = String(level || "").toLowerCase();
  const tone =
    normalized === "success"
      ? "emerald"
      : normalized === "error"
        ? "rose"
        : normalized === "warning"
          ? "rose"
          : "slate";
  return renderTaskFlagBadge(safeString(level || "-"), tone);
}

function matchesTaskEventFilter(event) {
  if (taskEventGroupFilter !== "all" && eventAuditGroup(event) !== taskEventGroupFilter) {
    return false;
  }
  const query = String(taskEventSearchQuery || "").trim().toLowerCase();
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
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group).push(event);
  }
  const groupOrder = ["lifecycle", "execution", "audit"];
  const sections = filtered.length
    ? groupOrder
        .filter((group) => groups.has(group))
        .map((group) => {
          const items = groups.get(group) || [];
          const rows = items
            .map(
              (event, index) => `
                <details class="rounded-xl border border-slate-200 bg-white" ${
                  index === 0 ? "open" : ""
                }>
                  <summary class="cursor-pointer list-none px-3 py-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="grid gap-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <div class="text-xs font-semibold text-slate-700">${escapeHtml(
                            safeString(event.event_type)
                          )}</div>
                          ${renderEventLevelBadge(event.level)}
                          ${
                            event.stage
                              ? renderTaskFlagBadge(safeString(event.stage), "emerald")
                              : ""
                          }
                        </div>
                        <div class="text-sm text-slate-900">${escapeHtml(
                          safeString(event.message || "-")
                        )}</div>
                        <div class="text-[11px] text-slate-500">${escapeHtml(
                          formatTaskTimestamp(event.occurred_at)
                        )}</div>
                      </div>
                    </div>
                  </summary>
                  <div class="border-t border-slate-200 px-3 py-3">
                    ${
                      event.details
                        ? `<pre class="output">${escapeHtml(JSON.stringify(event.details, null, 2))}</pre>`
                        : `<div class="text-xs text-slate-500">${escapeHtml(t("tasksEventNoDetails"))}</div>`
                    }
                  </div>
                </details>
              `
            )
            .join("");
          return `
            <section class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div class="text-sm font-semibold text-slate-900">${escapeHtml(
                  eventAuditGroupLabel(group)
                )}</div>
                <div class="flex flex-wrap items-center gap-2">
                  ${renderTaskFlagBadge(`${items.length} ${t("tasksEventItems")}`, "emerald")}
                </div>
              </div>
              <div class="grid gap-2">${rows}</div>
            </section>
          `;
        })
        .join("")
    : renderStatusMessageCard(t("tasksEventsEmpty"), "info");

  return `
    <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-sm font-semibold text-slate-900">${escapeHtml(t("tasksFieldEvents"))}</div>
        <div class="text-xs text-slate-500">${escapeHtml(
          `${filtered.length} / ${events.length} ${t("tasksEventItems")}`
        )}</div>
      </div>
      <div class="mt-3 grid gap-2 md:grid-cols-[180px_1fr]">
        <select
          class="input"
          aria-label="${escapeHtml(t("tasksEventFilterGroup"))}"
          onchange="taskEventGroupFilter=this.value; renderTaskDetail(currentTaskDetail);"
        >
          <option value="all" ${taskEventGroupFilter === "all" ? "selected" : ""}>${escapeHtml(
            t("tasksEventGroupAll")
          )}</option>
          <option value="lifecycle" ${
            taskEventGroupFilter === "lifecycle" ? "selected" : ""
          }>${escapeHtml(t("tasksEventGroupLifecycle"))}</option>
          <option value="execution" ${
            taskEventGroupFilter === "execution" ? "selected" : ""
          }>${escapeHtml(t("tasksEventGroupExecution"))}</option>
          <option value="audit" ${taskEventGroupFilter === "audit" ? "selected" : ""}>${escapeHtml(
            t("tasksEventGroupAudit")
          )}</option>
        </select>
        <input
          class="input"
          type="text"
          value="${escapeHtml(taskEventSearchQuery)}"
          placeholder="${escapeHtml(t("tasksEventSearchPlaceholder"))}"
          oninput="taskEventSearchQuery=this.value; renderTaskDetail(currentTaskDetail);"
        />
      </div>
      <div class="mt-3 grid gap-2">${sections}</div>
    </section>
  `;
}

function renderTaskDetailData(detail) {
  return `
    <section class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div class="flex flex-wrap items-center gap-2">
        ${renderTaskStatusBadge(detail.status)}
        ${renderTaskOutcomeBadge(detail.outcome)}
      </div>
      <div class="mt-2 font-mono text-xs text-slate-500 break-all">${escapeHtml(
        safeString(detail.task_id)
      )}</div>
      <div class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(
        safeString(detail.summary || "-")
      )}</div>
      <div class="mt-3 grid gap-1 text-xs text-slate-600">
        <div><span class="font-semibold">${escapeHtml(t("tasksFieldTarget"))}:</span> ${escapeHtml(
          safeString(detail.target_label || "-")
        )}</div>
        <div><span class="font-semibold">${escapeHtml(t("tasksFieldSource"))}:</span> ${escapeHtml(
          safeString(detail.source || "-")
        )}</div>
        <div><span class="font-semibold">${escapeHtml(t("tasksFieldAgent"))}:</span> ${escapeHtml(
          safeString(detail.agent_name || "-")
        )}</div>
        <div><span class="font-semibold">${escapeHtml(t("tasksFieldDuration"))}:</span> ${escapeHtml(
          formatTaskDuration(detail.execution_time_ms)
        )}</div>
        <div><span class="font-semibold">${escapeHtml(t("tasksFieldOutcome"))}:</span> ${escapeHtml(
          taskOutcomeLabel(detail.outcome)
        )}</div>
      </div>
    </section>
    ${renderTaskSummaryCards(detail)}
    ${renderTaskSummaryDetails(detail)}
    ${renderTaskArtifacts(detail)}
    <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div class="text-sm font-semibold text-slate-900">${escapeHtml(t("tasksFieldError"))}</div>
      <pre class="output mt-2">${escapeHtml(JSON.stringify(detail.error ?? null, null, 2))}</pre>
    </section>
    <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div class="text-sm font-semibold text-slate-900">${escapeHtml(t("tasksFieldResult"))}</div>
      <pre class="output mt-2">${escapeHtml(JSON.stringify(detail.result ?? null, null, 2))}</pre>
    </section>
    ${renderTaskEvents(detail)}
  `;
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
  wrap.innerHTML = renderTaskDetailData(detail);
}

function collectTaskFilters() {
  return {
    limit: Number(byId("tasks-limit")?.value || 50),
    operation: byId("tasks-operation")?.value || "",
    status: byId("tasks-status")?.value || "",
  };
}

async function loadTasks() {
  const out = byId("tasks-out");
  if (out) {
    out.innerHTML = renderStatusMessageCard(t("running"), "running");
  }
  try {
    const data = await fetchTaskRuns(collectTaskFilters());
    lastTaskRuns = Array.isArray(data) ? data : [];
    renderTaskList(lastTaskRuns);
    if (out) {
      out.innerHTML = "";
    }
    if (currentTaskId) {
      const match = lastTaskRuns.find((item) => item.task_id === currentTaskId);
      if (!match) {
        currentTaskId = "";
        currentTaskDetail = null;
        renderTaskDetail();
      }
    }
  } catch (e) {
    lastTaskRuns = [];
    renderTaskList(lastTaskRuns);
    if (out) {
      out.innerHTML = renderStatusMessageCard(e.message, "error");
    }
  }
}

async function loadTaskDetail(taskId) {
  currentTaskId = safeString(taskId);
  renderTaskList(lastTaskRuns);
  const wrap = byId("tasks-detail");
  const empty = byId("tasks-detail-empty");
  if (empty) empty.hidden = true;
  if (wrap) {
    wrap.innerHTML = renderStatusMessageCard(t("running"), "running");
  }
  try {
    currentTaskDetail = await fetchTaskDetail(currentTaskId);
    renderTaskDetail(currentTaskDetail);
    renderTaskList(lastTaskRuns);
  } catch (e) {
    currentTaskDetail = null;
    if (wrap) {
      wrap.innerHTML = renderStatusMessageCard(e.message, "error");
    }
  }
}
