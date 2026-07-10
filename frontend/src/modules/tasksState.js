import { getTask, listTasks } from "../api/client.js";
import { currentLanguageState, tr as translate } from "../lib/i18n.js";
import { displayText } from "../lib/ui.js";
import { derived, get as getStore, writable } from "svelte/store";
import { taskPageDisplay } from "./tasksDisplayState.js";

function normalizeOptionalHandler(handler) {
  return typeof handler === "function" ? handler : null;
}

const TASK_STATE_DEFAULTS = {
  currentTaskDetail: null,
  currentTaskId: "",
  detailStatus: null,
  errorFilter: "all",
  eventGroupFilter: "all",
  eventSearchQuery: "",
  limit: "50",
  listStatus: null,
  operation: "",
  outcome: "all",
  recording: "all",
  refreshLoading: false,
  runs: [],
  search: "",
  status: "",
  timeRange: "all",
};

function createTaskState() {
  return { ...TASK_STATE_DEFAULTS };
}

async function loadTaskRuns(taskQuery = {}) {
  const taskRunsPayload = await listTasks(taskQuery);
  return Array.isArray(taskRunsPayload) ? taskRunsPayload : [];
}

async function fetchTaskDetail(taskId) {
  return getTask(displayText(taskId));
}

function setTaskRefreshLoading(tasks = {}, keys = []) {
  tasks.refreshLoading = Array.isArray(keys) && keys.includes("refresh");
}

function setTaskLimit(tasks = {}, limit = "") {
  tasks.limit = limit;
}

function setTaskOperation(tasks = {}, operation = "") {
  tasks.operation = operation;
}

function setTaskStatus(tasks = {}, status = "") {
  tasks.status = status;
}

function setTaskOutcome(tasks = {}, outcome = "") {
  tasks.outcome = outcome;
}

function setTaskTimeRange(tasks = {}, timeRange = "") {
  tasks.timeRange = timeRange;
}

function setTaskRecording(tasks = {}, recording = "") {
  tasks.recording = recording;
}

function setTaskErrorFilter(tasks = {}, errorFilter = "") {
  tasks.errorFilter = errorFilter;
}

function setTaskSearch(tasks = {}, searchQuery = "") {
  tasks.search = searchQuery;
}

function setTaskEventGroupFilter(tasks = {}, eventGroupFilter = "") {
  tasks.eventGroupFilter = eventGroupFilter;
}

function setTaskEventSearchQuery(tasks = {}, eventSearchQuery = "") {
  tasks.eventSearchQuery = eventSearchQuery;
}

function resetTaskFilters(tasks = {}) {
  Object.assign(tasks, {
    errorFilter: TASK_STATE_DEFAULTS.errorFilter,
    limit: TASK_STATE_DEFAULTS.limit,
    operation: TASK_STATE_DEFAULTS.operation,
    outcome: TASK_STATE_DEFAULTS.outcome,
    recording: TASK_STATE_DEFAULTS.recording,
    search: TASK_STATE_DEFAULTS.search,
    status: TASK_STATE_DEFAULTS.status,
    timeRange: TASK_STATE_DEFAULTS.timeRange,
  });
}

async function loadTasks(tasks = {}) {
  tasks.listStatus = {
    message: translate("running", "running"),
    tone: "running",
  };
  try {
    const runs = await loadTaskRuns({
      limit: Number(tasks.limit || 50),
      operation: tasks.operation,
      status: tasks.status,
    });
    const keepCurrentTask = runs.some(
      (taskRun) => taskRun.task_id === tasks.currentTaskId,
    );
    tasks.currentTaskDetail = keepCurrentTask ? tasks.currentTaskDetail : null;
    tasks.currentTaskId = keepCurrentTask ? tasks.currentTaskId : "";
    tasks.listStatus = null;
    tasks.runs = runs;
  } catch (error) {
    tasks.listStatus = { message: error.message, tone: "error" };
    tasks.runs = [];
  }
}

async function loadTaskDetail(tasks = {}, taskId = "") {
  tasks.currentTaskDetail = null;
  tasks.currentTaskId = displayText(taskId);
  tasks.detailStatus = {
    message: translate("running", "running"),
    tone: "running",
  };
  try {
    tasks.currentTaskDetail = await fetchTaskDetail(tasks.currentTaskId);
    tasks.detailStatus = null;
  } catch (error) {
    tasks.currentTaskDetail = null;
    tasks.detailStatus = { message: error.message, tone: "error" };
  }
}

async function clearTaskFiltersAndLoad(tasks = {}) {
  resetTaskFilters(tasks);
  await loadTasks(tasks);
}

async function runTaskMutation(taskStateStore, taskMutation) {
  const taskState = getStore(taskStateStore);
  const taskMutationPromise = taskMutation(taskState);
  taskStateStore.set(taskState);
  await taskMutationPromise;
  taskStateStore.set(taskState);
}

function updateTaskState(taskStateStore, taskMutation) {
  const taskState = getStore(taskStateStore);
  taskMutation(taskState);
  taskStateStore.set(taskState);
}

export function taskFiltersActionHandlers({
  onErrorFilterChange = null,
  onLimitChange = null,
  onOperationChange = null,
  onOutcomeChange = null,
  onRecordingChange = null,
  onSearchInput = null,
  onStatusChange = null,
  onTimeRangeChange = null,
} = {}) {
  return {
    errorFilterChangeHandler: normalizeOptionalHandler(onErrorFilterChange),
    limitChangeHandler: normalizeOptionalHandler(onLimitChange),
    operationChangeHandler: normalizeOptionalHandler(onOperationChange),
    outcomeChangeHandler: normalizeOptionalHandler(onOutcomeChange),
    recordingChangeHandler: normalizeOptionalHandler(onRecordingChange),
    searchChangeHandler: normalizeOptionalHandler(onSearchInput),
    statusChangeHandler: normalizeOptionalHandler(onStatusChange),
    timeRangeChangeHandler: normalizeOptionalHandler(onTimeRangeChange),
  };
}

export function taskEventFilterActionHandlers({
  onGroupFilterChange = null,
  onSearchInput = null,
} = {}) {
  return {
    groupFilterChangeHandler: normalizeOptionalHandler(onGroupFilterChange),
    searchChangeHandler: normalizeOptionalHandler(onSearchInput),
  };
}

export function createTasksPageWorkspace() {
  const taskStateStore = writable(createTaskState());
  const taskDisplayStateStore = derived(
    [taskStateStore, currentLanguageState],
    ([$taskStateStore, _currentLanguageState]) =>
      taskPageDisplay($taskStateStore),
  );
  let didInitialLoad = false;
  let refreshRunning = false;

  async function loadTaskList() {
    await runTaskMutation(taskStateStore, loadTasks);
  }

  async function setPageContext({ active = false } = {}) {
    if (!active) {
      didInitialLoad = false;
      return;
    }
    if (didInitialLoad) return;
    didInitialLoad = true;
    await loadTaskList();
  }

  async function clearFilters() {
    await runTaskMutation(taskStateStore, clearTaskFiltersAndLoad);
  }

  async function refreshTasks() {
    if (refreshRunning) return;
    refreshRunning = true;
    updateTaskState(taskStateStore, (taskState) => {
      setTaskRefreshLoading(taskState, ["refresh"]);
    });
    try {
      await runTaskMutation(taskStateStore, loadTasks);
    } finally {
      updateTaskState(taskStateStore, (taskState) => {
        setTaskRefreshLoading(taskState, []);
      });
      refreshRunning = false;
    }
  }

  function selectTask(taskId = "") {
    return () =>
      runTaskMutation(taskStateStore, (taskState) =>
        loadTaskDetail(taskState, taskId),
      );
  }

  function updateTaskErrorFilter(errorFilter = "") {
    updateTaskState(taskStateStore, (taskState) => {
      setTaskErrorFilter(taskState, errorFilter);
    });
  }

  function updateTaskEventGroupFilter(eventGroupFilter = "") {
    updateTaskState(taskStateStore, (taskState) => {
      setTaskEventGroupFilter(taskState, eventGroupFilter);
    });
  }

  function updateTaskEventSearch(eventSearchQuery = "") {
    updateTaskState(taskStateStore, (taskState) => {
      setTaskEventSearchQuery(taskState, eventSearchQuery);
    });
  }

  function reloadTasksAfter(taskMutation) {
    return runTaskMutation(taskStateStore, async (taskState) => {
      if (typeof taskMutation === "function") {
        taskMutation(taskState);
      }
      await loadTasks(taskState);
    });
  }

  function updateTaskLimit(limit = "") {
    void reloadTasksAfter((taskState) => {
      setTaskLimit(taskState, limit);
    });
  }

  function updateTaskOperation(operation = "") {
    void reloadTasksAfter((taskState) => {
      setTaskOperation(taskState, operation);
    });
  }

  function updateTaskOutcome(outcome = "") {
    updateTaskState(taskStateStore, (taskState) => {
      setTaskOutcome(taskState, outcome);
    });
  }

  function updateTaskRecording(recording = "") {
    updateTaskState(taskStateStore, (taskState) => {
      setTaskRecording(taskState, recording);
    });
  }

  function updateTaskSearch(searchQuery = "") {
    updateTaskState(taskStateStore, (taskState) => {
      setTaskSearch(taskState, searchQuery);
    });
  }

  function updateTaskStatus(status = "") {
    void reloadTasksAfter((taskState) => {
      setTaskStatus(taskState, status);
    });
  }

  function updateTaskTimeRange(timeRange = "") {
    updateTaskState(taskStateStore, (taskState) => {
      setTaskTimeRange(taskState, timeRange);
    });
  }

  function destroy() {
    didInitialLoad = false;
    refreshRunning = false;
    taskStateStore.set(createTaskState());
  }

  return {
    clearFilters,
    destroy,
    refreshTasks,
    selectTask,
    setPageContext,
    taskDisplayStateStore,
    taskStateStore,
    updateTaskErrorFilter,
    updateTaskEventGroupFilter,
    updateTaskEventSearch,
    updateTaskLimit,
    updateTaskOperation,
    updateTaskOutcome,
    updateTaskRecording,
    updateTaskSearch,
    updateTaskStatus,
    updateTaskTimeRange,
  };
}
