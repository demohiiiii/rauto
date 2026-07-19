import { tr as translate } from "../../lib/i18n.js";
import { borderedPillClass, classNames, displayText } from "../../lib/ui.js";

function taskOption(optionValue, optionLabel) {
  return { label: optionLabel, value: optionValue };
}

const taskLabelText = (key, fallback = key) => translate(key, fallback);

function taskSearchField(value, placeholderKey, placeholderFallback) {
  const placeholder = taskLabelText(placeholderKey, placeholderFallback);
  return {
    ariaLabelText: placeholder,
    placeholder,
    value: displayText(value || ""),
  };
}

function badgeToneClass(tone = "slate") {
  if (tone === "emerald") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "cyan") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function taskBadgeClass(tone = "slate") {
  return borderedPillClass(badgeToneClass(tone));
}

function taskStatusDisplayRow(labelKey, fallback, tone) {
  return { label: taskLabelText(labelKey, fallback), tone };
}

function taskStatusDisplay(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "queued") {
    return taskStatusDisplayRow("tasksStatusQueued", "queued", "slate");
  }
  if (normalized === "running") {
    return taskStatusDisplayRow("tasksStatusRunning", "running", "cyan");
  }
  if (normalized === "success" || normalized === "completed") {
    return taskStatusDisplayRow("tasksStatusSuccess", "success", "emerald");
  }
  if (normalized === "failed" || normalized === "error") {
    return taskStatusDisplayRow("tasksStatusFailed", "failed", "rose");
  }
  return { label: displayText(status || "-"), tone: "slate" };
}

function taskOutcomeDisplay(outcome) {
  const normalized = String(outcome || "").toLowerCase();
  if (normalized === "success") {
    return taskStatusDisplayRow("tasksOutcomeSuccess", "success", "emerald");
  }
  if (
    normalized === "failure" ||
    normalized === "failed" ||
    normalized === "error"
  ) {
    return taskStatusDisplayRow("tasksOutcomeFailure", "failure", "rose");
  }
  if (normalized === "partial_success" || normalized === "partial") {
    return taskStatusDisplayRow("tasksOutcomePartial", "partial", "slate");
  }
  return { label: displayText(outcome || "-"), tone: "rose" };
}

function taskRunBadgeRows(taskRun) {
  const statusDisplay = taskStatusDisplay(taskRun.status);
  const badgeRows = [
    {
      badgeClass: taskBadgeClass(statusDisplay.tone),
      label: statusDisplay.label,
    },
  ];
  if (taskRun.outcome) {
    const outcomeDisplay = taskOutcomeDisplay(taskRun.outcome);
    badgeRows.push({
      badgeClass: taskBadgeClass(outcomeDisplay.tone),
      label: outcomeDisplay.label,
    });
  }
  return badgeRows;
}

function taskFilterOptions() {
  return {
    error: [
      taskOption("all", taskLabelText("tasksErrorAll", "All errors")),
      taskOption("yes", taskLabelText("tasksErrorYes", "Has error")),
      taskOption("no", taskLabelText("tasksErrorNo", "No error")),
    ],
    limit: [
      taskOption("20", "20"),
      taskOption("50", "50"),
      taskOption("100", "100"),
      taskOption("200", "200"),
    ],
    operation: [
      taskOption("", taskLabelText("tasksOperationAll", "All operations")),
      taskOption("exec", "exec"),
      taskOption("template", "template"),
      taskOption("command_flow", "command_flow"),
      taskOption("file_transfer", "file_transfer"),
      taskOption("upload", "upload"),
      taskOption("tx_block", "tx_block"),
      taskOption("tx_workflow", "tx_workflow"),
      taskOption("orchestration", "orchestration"),
    ],
    outcome: [
      taskOption("all", taskLabelText("tasksOutcomeAll", "All outcomes")),
      taskOption("success", taskLabelText("tasksOutcomeSuccess", "success")),
      taskOption(
        "partial_success",
        taskLabelText("tasksOutcomePartial", "partial"),
      ),
      taskOption("failed", taskLabelText("tasksOutcomeFailure", "failure")),
      taskOption("none", taskLabelText("tasksOutcomeNone", "none")),
    ],
    recording: [
      taskOption("all", taskLabelText("tasksRecordingAll", "All recordings")),
      taskOption("yes", taskLabelText("tasksRecordingYes", "Has recording")),
      taskOption("no", taskLabelText("tasksRecordingNo", "No recording")),
    ],
    status: [
      taskOption("", taskLabelText("tasksStatusAll", "All statuses")),
      taskOption("queued", "queued"),
      taskOption("running", "running"),
      taskOption("success", "success"),
      taskOption("failed", "failed"),
    ],
    timeRange: [
      taskOption("all", taskLabelText("tasksTimeRangeAll", "All time")),
      taskOption("1h", taskLabelText("tasksTimeRange1h", "Last 1h")),
      taskOption("6h", taskLabelText("tasksTimeRange6h", "Last 6h")),
      taskOption("24h", taskLabelText("tasksTimeRange24h", "Last 24h")),
      taskOption("7d", taskLabelText("tasksTimeRange7d", "Last 7d")),
    ],
  };
}

const taskFilterCurrentValue = (filters = {}, field = "") =>
  filters[field] ?? "";

function taskFilterField(label, optionRows, filters, field) {
  return {
    currentValue: taskFilterCurrentValue(filters, field),
    label,
    options: optionRows,
  };
}

function taskFiltersPresentation(filters = {}) {
  const filterOptions = taskFilterOptions();
  return {
    clearButtonLabel: taskLabelText("tasksClearBtn", "Clear"),
    fields: {
      errorFilter: taskFilterField(
        taskLabelText("tasksErrorTitle", "Task Error"),
        filterOptions.error,
        filters,
        "errorFilter",
      ),
      limit: taskFilterField(
        taskLabelText("tasksLimitTitle", "Task Limit"),
        filterOptions.limit,
        filters,
        "limit",
      ),
      operation: taskFilterField(
        taskLabelText("tasksOperationTitle", "Task Operation"),
        filterOptions.operation,
        filters,
        "operation",
      ),
      outcome: taskFilterField(
        taskLabelText("tasksOutcomeTitle", "Task Outcome"),
        filterOptions.outcome,
        filters,
        "outcome",
      ),
      recording: taskFilterField(
        taskLabelText("tasksRecordingTitle", "Task Recording"),
        filterOptions.recording,
        filters,
        "recording",
      ),
      status: taskFilterField(
        taskLabelText("tasksStatusTitle", "Task Status"),
        filterOptions.status,
        filters,
        "status",
      ),
      timeRange: taskFilterField(
        taskLabelText("tasksTimeRangeTitle", "Task Time Range"),
        filterOptions.timeRange,
        filters,
        "timeRange",
      ),
    },
    refreshButtonLabel: taskLabelText("tasksRefreshBtn", "Refresh"),
    refreshLoading: !!filters.refreshLoading,
    searchField: taskSearchField(
      filters.search,
      "tasksSearchPlaceholder",
      "search task/target/summary",
    ),
    title: taskLabelText("tasksFiltersTitle", "Filters"),
  };
}

function taskEventGroupOptions() {
  return [
    taskOption("all", taskLabelText("tasksEventGroupAll", "All")),
    taskOption(
      "lifecycle",
      taskLabelText("tasksEventGroupLifecycle", "Lifecycle"),
    ),
    taskOption(
      "execution",
      taskLabelText("tasksEventGroupExecution", "Execution"),
    ),
    taskOption("audit", taskLabelText("tasksEventGroupAudit", "Audit")),
  ];
}

function artifactGroupLabel(groupName) {
  const normalized = String(groupName || "").toLowerCase();
  if (normalized === "recording_jsonl") {
    return taskLabelText("tasksArtifactGroupRecording", "Recording");
  }
  if (normalized === "rendered_commands") {
    return taskLabelText("tasksArtifactGroupRendered", "Rendered");
  }
  if (normalized === "tx_result_json") {
    return taskLabelText("tasksArtifactGroupTx", "TX");
  }
  if (normalized === "workflow_result_json") {
    return taskLabelText("tasksArtifactGroupWorkflow", "Workflow");
  }
  if (normalized === "orchestration_result_json") {
    return taskLabelText("tasksArtifactGroupOrchestration", "Orchestration");
  }
  if (normalized === "execution_result_json") {
    return taskLabelText("tasksArtifactGroupExecution", "Execution");
  }
  return displayText(groupName || "-");
}

function taskEventAuditGroup(taskEvent) {
  const eventType = String(taskEvent?.event_type || "").toLowerCase();
  const stage = String(taskEvent?.stage || "").toLowerCase();
  const message = String(taskEvent?.message || "").toLowerCase();
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

function formatTaskTimestamp(timestampValue) {
  const text = displayText(timestampValue || "-");
  if (!timestampValue) return text;
  return text.replace("T", " ").replace("Z", " UTC");
}

function formatTaskDuration(ms) {
  if (ms == null || ms === "") return "-";
  const num = Number(ms);
  if (!Number.isFinite(num)) return displayText(ms);
  if (num < 1000) return `${num} ms`;
  if (num < 60000) return `${(num / 1000).toFixed(num < 10000 ? 1 : 0)} s`;
  return `${(num / 60000).toFixed(1)} min`;
}

function taskSummaryMetaFields(taskRun) {
  const fields = [
    {
      detailValue: displayText(taskRun.operation || "-"),
      label: taskLabelText("tasksFieldOperation", "Operation"),
    },
    {
      detailValue: formatTaskTimestamp(taskRun.started_at),
      label: taskLabelText("tasksFieldStartedAt", "Started"),
    },
  ];
  if (taskRun.agent_name) {
    fields.push({
      detailValue: displayText(taskRun.agent_name),
      label: taskLabelText("tasksFieldAgent", "Agent"),
    });
  }
  if (taskRun.target_label) {
    fields.push({
      detailValue: displayText(taskRun.target_label),
      label: taskLabelText("tasksFieldTarget", "Target"),
    });
  }
  if (taskRun.source) {
    fields.push({
      detailValue: displayText(taskRun.source),
      label: taskLabelText("tasksFieldSource", "Source"),
    });
  }
  if (taskRun.execution_time_ms != null) {
    fields.push({
      detailValue: formatTaskDuration(taskRun.execution_time_ms),
      label: taskLabelText("tasksFieldDuration", "Duration"),
    });
  }
  return fields;
}

function taskRunListRows(taskRuns = [], currentTaskId = "") {
  const selectedTaskId = displayText(currentTaskId);
  return (Array.isArray(taskRuns) ? taskRuns : []).map((taskRun) => ({
    badgeRows: taskRunBadgeRows(taskRun),
    metaFields: taskSummaryMetaFields(taskRun),
    rowClass: classNames(
      "rounded-xl border px-3 py-3",
      selectedTaskId && taskRun.task_id === selectedTaskId
        ? "border-cyan-300 bg-cyan-50/60"
        : "border-slate-200 bg-white",
    ),
    summaryText: displayText(taskRun.summary || "-"),
    taskId: displayText(taskRun.task_id),
  }));
}

function taskRunListPresentation(taskRuns = [], tasks = {}) {
  const taskRows = taskRunListRows(taskRuns, tasks.currentTaskId);
  const total = Array.isArray(tasks.runs) ? tasks.runs.length : 0;
  return {
    countText: `${taskRows.length} / ${total} ${taskLabelText(
      "tasksListMetaCount",
      "tasks",
    )}`,
    detailButtonLabel: taskLabelText("tasksDetailBtn", "Details"),
    emptyMessage: taskLabelText("tasksEmptyState", "No task records yet."),
    hasTaskRows: taskRows.length > 0,
    taskRows,
    title: taskLabelText("tasksListTitle", "Tasks"),
  };
}

function jsonText(jsonValue) {
  return JSON.stringify(jsonValue ?? null, null, 2);
}

function groupTaskArtifacts(taskArtifacts) {
  const grouped = new Map();
  for (const taskArtifact of Array.isArray(taskArtifacts)
    ? taskArtifacts
    : []) {
    const artifactGroupName = displayText(
      taskArtifact.artifact_type || "other",
    );
    if (!grouped.has(artifactGroupName)) grouped.set(artifactGroupName, []);
    grouped.get(artifactGroupName).push(taskArtifact);
  }
  return Array.from(grouped.entries()).map(
    ([artifactGroupName, taskArtifactsForGroup]) => ({
      artifactGroupName,
      taskArtifacts: taskArtifactsForGroup,
    }),
  );
}

function taskArtifactSummaryText(taskArtifact) {
  return (
    [
      taskArtifact.size_bytes != null ? `${taskArtifact.size_bytes} bytes` : "",
      taskArtifact.created_at
        ? formatTaskTimestamp(taskArtifact.created_at)
        : "",
      taskArtifact.storage_ref ? `ref: ${taskArtifact.storage_ref}` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "-"
  );
}

function taskArtifactRow(taskArtifact) {
  const contentType = displayText(taskArtifact.content_type || "");
  return {
    badgeRows: contentType
      ? [{ badgeClass: taskBadgeClass("emerald"), label: contentType }]
      : [],
    contentText: displayText(taskArtifact.content_text || "-"),
    summaryText: taskArtifactSummaryText(taskArtifact),
    title: displayText(taskArtifact.name || taskArtifact.artifact_type),
  };
}

function taskArtifactGroupRows(taskArtifacts = []) {
  return groupTaskArtifacts(taskArtifacts).map((artifactGroup) => {
    const taskArtifactRows = (
      Array.isArray(artifactGroup.taskArtifacts)
        ? artifactGroup.taskArtifacts
        : []
    ).map(taskArtifactRow);
    const keyText = displayText(artifactGroup.artifactGroupName);
    const countText = `${taskArtifactRows.length} ${taskLabelText(
      "tasksArtifactItems",
      "items",
    )}`;
    return {
      artifactRows: taskArtifactRows,
      badgeRows: [
        { badgeClass: taskBadgeClass(), label: keyText },
        { badgeClass: taskBadgeClass("emerald"), label: countText },
      ],
      label: artifactGroupLabel(artifactGroup.artifactGroupName),
    };
  });
}

function matchesTaskEventFilter(taskEvent, groupFilter, searchQuery) {
  if (groupFilter !== "all" && taskEventAuditGroup(taskEvent) !== groupFilter) {
    return false;
  }
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;
  const haystack = [
    taskEvent.event_type,
    taskEvent.level,
    taskEvent.stage,
    taskEvent.message,
    taskEvent.details ? JSON.stringify(taskEvent.details) : "",
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return haystack.includes(query);
}

function groupTaskEvents(taskEvents) {
  const grouped = new Map();
  for (const taskEvent of taskEvents) {
    const eventGroupName = taskEventAuditGroup(taskEvent);
    if (!grouped.has(eventGroupName)) grouped.set(eventGroupName, []);
    grouped.get(eventGroupName).push(taskEvent);
  }
  return ["lifecycle", "execution", "audit"]
    .filter((eventGroupName) => grouped.has(eventGroupName))
    .map((eventGroupName) => ({
      eventGroupName,
      taskEvents: grouped.get(eventGroupName) || [],
    }));
}

function taskEventGroupLabel(groupName) {
  if (groupName === "lifecycle") {
    return taskLabelText("tasksEventGroupLifecycle", "Lifecycle");
  }
  if (groupName === "audit") {
    return taskLabelText("tasksEventGroupAudit", "Audit");
  }
  return taskLabelText("tasksEventGroupExecution", "Execution");
}

function taskEventRow(taskEvent) {
  const level = displayText(taskEvent.level || "-");
  const stage = displayText(taskEvent.stage || "");
  const levelTone = level.toLowerCase() === "error" ? "rose" : "slate";
  const badgeRows = [{ badgeClass: taskBadgeClass(levelTone), label: level }];
  if (stage) {
    badgeRows.push({ badgeClass: taskBadgeClass("emerald"), label: stage });
  }
  return {
    badgeRows,
    detailsPreview: taskEvent.details ? jsonText(taskEvent.details) : "",
    eventType: displayText(taskEvent.event_type),
    hasDetails: Boolean(taskEvent.details),
    message: displayText(taskEvent.message || "-"),
    occurredAtText: formatTaskTimestamp(taskEvent.occurred_at),
  };
}

function taskEventGroupRows(taskEvents = []) {
  return groupTaskEvents(taskEvents).map((eventGroup) => {
    const taskEventRows = (
      Array.isArray(eventGroup.taskEvents) ? eventGroup.taskEvents : []
    ).map(taskEventRow);
    const eventItemsText = taskLabelText("tasksEventItems", "items");
    const countText = `${taskEventRows.length} ${eventItemsText}`;
    return {
      badgeRows: [{ badgeClass: taskBadgeClass("emerald"), label: countText }],
      label: taskEventGroupLabel(eventGroup.eventGroupName),
      eventGroupName: eventGroup.eventGroupName,
      taskEventRows,
    };
  });
}

function taskEventsPresentation({
  eventGroupFilter = "all",
  eventSearchQuery = "",
  taskEvents = [],
} = {}) {
  const totalCount = Array.isArray(taskEvents) ? taskEvents.length : 0;
  const filteredTaskEvents = (
    Array.isArray(taskEvents) ? taskEvents : []
  ).filter((taskEvent) =>
    matchesTaskEventFilter(taskEvent, eventGroupFilter, eventSearchQuery),
  );
  const eventGroupRows = taskEventGroupRows(filteredTaskEvents);
  return {
    countText: `${filteredTaskEvents.length} / ${totalCount} ${taskLabelText("tasksEventItems", "items")}`,
    currentGroupValue: eventGroupFilter,
    emptyMessage: taskLabelText("tasksEventsEmpty", "no events"),
    eventGroupOptionRows: taskEventGroupOptions(),
    eventGroupRows,
    filterGroupLabel: taskLabelText("tasksEventFilterGroup", "Event group"),
    hasEventGroupRows: eventGroupRows.length > 0,
    noDetailsText: taskLabelText("tasksEventNoDetails", "no details"),
    searchField: taskSearchField(
      eventSearchQuery,
      "tasksEventSearchPlaceholder",
      "search events",
    ),
    title: taskLabelText("tasksFieldEvents", "Events"),
  };
}

function taskDetailLine(label, detailValue) {
  return { detailValue, label };
}

function taskSummaryCard(label, summaryValue) {
  return { label, summaryValue };
}

function resultSummaryPreview(summary) {
  return jsonText(
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
  );
}

function taskDetailOverviewLabels() {
  return {
    artifactsEmptyMessage: taskLabelText("tasksArtifactsEmpty", "no artifacts"),
    artifactsTitle: taskLabelText("tasksFieldArtifacts", "Artifacts"),
    errorTitle: taskLabelText("tasksFieldError", "Error"),
    resultSummaryTitle: taskLabelText(
      "tasksFieldResultSummary",
      "Result Summary",
    ),
    resultTitle: taskLabelText("tasksFieldResult", "Result"),
    summaryDetailsTitle: taskLabelText(
      "tasksFieldSummaryDetails",
      "Summary Details",
    ),
  };
}

function taskDetailPresentation(detail) {
  const emptyMessage = taskLabelText(
    "tasksDetailEmpty",
    "Select a task to inspect details.",
  );
  const title = taskLabelText("tasksDetailTitle", "Task Detail");
  const overviewLabels = taskDetailOverviewLabels();
  if (!detail) {
    return {
      artifactGroups: [],
      ...overviewLabels,
      detailLines: [],
      emptyMessage,
      errorPreview: jsonText(null),
      badgeRows: [],
      hasArtifactGroups: false,
      hasDetail: false,
      resultPreview: jsonText(null),
      summaryCards: [],
      summaryDetailsPreview: jsonText(null),
      summaryPreview: jsonText(null),
      summaryText: "-",
      taskEvents: [],
      taskId: "",
      title,
    };
  }

  const summary = detail.result_summary || null;
  const counts = summary?.counts || null;
  const taskEvents = Array.isArray(detail.events) ? detail.events : [];
  const outcomeLabel = taskOutcomeDisplay(detail.outcome).label;
  const summaryCards = [
    taskSummaryCard(
      taskLabelText("tasksFieldOutcome", "Outcome"),
      outcomeLabel,
    ),
    taskSummaryCard(
      taskLabelText("tasksFieldDuration", "Duration"),
      formatTaskDuration(detail.execution_time_ms),
    ),
    taskSummaryCard(
      taskLabelText("tasksFieldRecording", "Recording"),
      summary?.recording_available === true || detail.has_recording
        ? taskLabelText("tasksRecordingAvailable", "available")
        : taskLabelText("tasksRecordingUnavailable", "unavailable"),
    ),
    taskSummaryCard(
      taskLabelText("tasksFieldEventCount", "Events"),
      String(taskEvents.length),
    ),
  ];

  if (counts) {
    summaryCards.push(
      taskSummaryCard(
        taskLabelText("tasksCountTotal", "Total"),
        String(counts.total ?? "-"),
      ),
    );
    summaryCards.push(
      taskSummaryCard(
        taskLabelText("tasksCountSucceeded", "Succeeded"),
        String(counts.succeeded ?? "-"),
      ),
    );
    summaryCards.push(
      taskSummaryCard(
        taskLabelText("tasksCountFailed", "Failed"),
        String(counts.failed ?? "-"),
      ),
    );
    if (counts.skipped != null) {
      summaryCards.push(
        taskSummaryCard(
          taskLabelText("tasksCountSkipped", "Skipped"),
          String(counts.skipped),
        ),
      );
    }
  }

  const artifactGroups = taskArtifactGroupRows(detail.artifacts);
  return {
    artifactGroups,
    ...overviewLabels,
    badgeRows: taskRunBadgeRows(detail),
    detailLines: [
      taskDetailLine(
        taskLabelText("tasksFieldTarget", "Target"),
        displayText(detail.target_label || "-"),
      ),
      taskDetailLine(
        taskLabelText("tasksFieldSource", "Source"),
        displayText(detail.source || "-"),
      ),
      taskDetailLine(
        taskLabelText("tasksFieldAgent", "Agent"),
        displayText(detail.agent_name || "-"),
      ),
      taskDetailLine(
        taskLabelText("tasksFieldDuration", "Duration"),
        formatTaskDuration(detail.execution_time_ms),
      ),
      taskDetailLine(
        taskLabelText("tasksFieldOutcome", "Outcome"),
        outcomeLabel,
      ),
    ],
    emptyMessage,
    errorPreview: jsonText(detail.error ?? null),
    hasArtifactGroups: artifactGroups.length > 0,
    hasDetail: true,
    resultPreview: jsonText(detail.result ?? null),
    summaryCards,
    summaryDetailsPreview: jsonText(summary?.details ?? null),
    summaryPreview: resultSummaryPreview(summary),
    summaryText: displayText(detail.summary || "-"),
    taskEvents,
    taskId: displayText(detail.task_id),
    title,
  };
}

function parseTaskTimestamp(timestampValue) {
  const ts = Date.parse(String(timestampValue || ""));
  return Number.isFinite(ts) ? ts : null;
}

function matchesTaskTimeRange(taskRun, selectedRange) {
  if (selectedRange === "all") return true;
  const startedAt =
    parseTaskTimestamp(taskRun.started_at) ??
    parseTaskTimestamp(taskRun.completed_at);
  if (startedAt === null) return false;
  const ranges = {
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  };
  const windowMs = ranges[selectedRange];
  return windowMs ? startedAt >= Date.now() - windowMs : true;
}

function matchesTaskListFilter(taskRun, current) {
  const query = current.search.trim().toLowerCase();
  if (query) {
    const haystack = [
      taskRun.task_id,
      taskRun.operation,
      taskRun.status,
      taskRun.outcome,
      taskRun.summary,
      taskRun.agent_name,
      taskRun.source,
      taskRun.target_label,
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (!matchesTaskTimeRange(taskRun, current.timeRange)) return false;
  if (current.outcome === "none") {
    if (taskRun.outcome) return false;
  } else if (current.outcome !== "all") {
    if (String(taskRun.outcome || "").toLowerCase() !== current.outcome) {
      return false;
    }
  }
  if (current.recording === "yes" && !taskRun.has_recording) return false;
  if (current.recording === "no" && taskRun.has_recording) return false;
  if (current.error === "yes" && !taskRun.has_error) return false;
  if (current.error === "no" && taskRun.has_error) return false;
  return true;
}

function filteredTaskRuns(tasks = {}) {
  return (Array.isArray(tasks.runs) ? tasks.runs : []).filter((taskRun) =>
    matchesTaskListFilter(taskRun, {
      error: tasks.errorFilter,
      outcome: tasks.outcome,
      recording: tasks.recording,
      search: tasks.search,
      timeRange: tasks.timeRange,
    }),
  );
}

export function taskPageDisplay(tasks = {}) {
  const filteredTaskRunsForDisplay = filteredTaskRuns(tasks);
  const taskDetail = taskDetailPresentation(tasks.currentTaskDetail);
  const taskList = taskRunListPresentation(filteredTaskRunsForDisplay, tasks);
  return {
    detailStatus: tasks.detailStatus,
    taskDetail,
    taskEventsDisplay: taskEventsPresentation({
      eventGroupFilter: tasks.eventGroupFilter,
      eventSearchQuery: tasks.eventSearchQuery,
      taskEvents: taskDetail.taskEvents,
    }),
    taskFilters: taskFiltersPresentation({
      errorFilter: tasks.errorFilter,
      limit: tasks.limit,
      operation: tasks.operation,
      outcome: tasks.outcome,
      recording: tasks.recording,
      refreshLoading: tasks.refreshLoading,
      search: tasks.search,
      status: tasks.status,
      timeRange: tasks.timeRange,
    }),
    taskRunListDisplay: {
      listStatus: tasks.listStatus,
      taskList,
    },
  };
}
