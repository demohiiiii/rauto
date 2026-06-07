import { getTask, listTasks } from "../api/client.js";
import {
  renderTaskDetailView,
  renderTaskListView,
} from "../services/taskRender.js";
import { safeString, statusCard, tr } from "../services/taskFormat.js";

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
      if (String(item.outcome || "").toLowerCase() !== current.outcome) {
        return false;
      }
    }
    if (current.recording === "yes" && !item.has_recording) return false;
    if (current.recording === "no" && item.has_recording) return false;
    if (current.error === "yes" && !item.has_error) return false;
    if (current.error === "no" && item.has_error) return false;
    return true;
  }

  function renderTaskList(items = lastTaskRuns) {
    const allRows = Array.isArray(items) ? items : [];
    renderTaskListView({
      currentTaskId,
      empty: byId("tasks-empty-state"),
      list: byId("tasks-list"),
      meta: byId("tasks-list-meta"),
      rows: allRows.filter(matchesTaskListFilter),
      totalCount: allRows.length,
    });
  }

  function renderTaskDetail(detail = currentTaskDetail) {
    renderTaskDetailView({
      detail,
      empty: byId("tasks-detail-empty"),
      eventGroupFilter: taskEventGroupFilter,
      eventSearchQuery: taskEventSearchQuery,
      wrap: byId("tasks-detail"),
    });
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
