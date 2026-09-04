import { derived, get, writable } from "svelte/store";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import { displayText } from "../../../lib/ui.js";
import { tasksApi } from "../infrastructure/tasksApi.js";
import {
  newTaskState,
  resetTaskFilters,
  setTaskErrorFilter,
  setTaskEventGroupFilter,
  setTaskEventSearchQuery,
  setTaskLimit,
  setTaskOperation,
  setTaskOutcome,
  setTaskRecording,
  setTaskRefreshLoading,
  setTaskSearch,
  setTaskStatus,
  setTaskTimeRange,
} from "../model/tasks.js";
import type {
  TaskState,
  TasksApi,
  TasksPageWorkspace,
  TasksWorkspaceOptions,
} from "../model/types.js";
import {
  taskPagePresentation,
  type TaskPageDisplay,
} from "../presentation/tasksPresentation.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createTasksPageWorkspace(
  options: TasksWorkspaceOptions = {},
): TasksPageWorkspace<TaskPageDisplay> {
  const api = Object.assign({}, tasksApi, options.api) as TasksApi;
  const taskStateStore = writable<TaskState>(newTaskState());
  const taskDisplayStateStore = derived(
    [taskStateStore, currentLanguageState],
    ([$state]) => taskPagePresentation($state),
  );
  let didInitialLoad = false;
  let refreshRunning = false;
  let listRequestVersion = 0;
  let detailRequestVersion = 0;

  function updateState(mutation: (state: TaskState) => void): void {
    const state = get(taskStateStore);
    mutation(state);
    taskStateStore.set(state);
  }

  async function loadTaskList(): Promise<void> {
    const requestVersion = ++listRequestVersion;
    const current = get(taskStateStore);
    const query = {
      limit: Number(current.limit || 50),
      operation: current.operation,
      status: current.status,
    };
    updateState((state) => {
      state.listStatus = { message: tr("running", "running"), tone: "running" };
    });
    try {
      const runs = await api.listTasks(query);
      if (requestVersion !== listRequestVersion) return;
      updateState((state) => {
        const keepCurrentTask = runs.some(
          (taskRun) => taskRun.task_id === state.currentTaskId,
        );
        if (!keepCurrentTask && state.currentTaskId) {
          detailRequestVersion += 1;
          state.detailStatus = null;
        }
        state.currentTaskDetail = keepCurrentTask
          ? state.currentTaskDetail
          : null;
        state.currentTaskId = keepCurrentTask ? state.currentTaskId : "";
        state.listStatus = null;
        state.runs = runs;
      });
    } catch (error) {
      if (requestVersion !== listRequestVersion) return;
      updateState((state) => {
        state.listStatus = { message: errorMessage(error), tone: "error" };
        state.runs = [];
      });
    }
  }

  async function loadTaskDetail(taskId = ""): Promise<void> {
    const requestVersion = ++detailRequestVersion;
    const selectedTaskId = displayText(taskId);
    updateState((state) => {
      state.currentTaskDetail = null;
      state.currentTaskId = selectedTaskId;
      state.detailStatus = {
        message: tr("running", "running"),
        tone: "running",
      };
    });
    try {
      const detail = await api.getTask(selectedTaskId);
      if (requestVersion !== detailRequestVersion) return;
      updateState((state) => {
        state.currentTaskDetail = detail;
        state.detailStatus = null;
      });
    } catch (error) {
      if (requestVersion !== detailRequestVersion) return;
      updateState((state) => {
        state.currentTaskDetail = null;
        state.detailStatus = { message: errorMessage(error), tone: "error" };
      });
    }
  }

  async function setPageContext({ active = false } = {}): Promise<void> {
    if (!active) {
      didInitialLoad = false;
      return;
    }
    if (didInitialLoad) return;
    didInitialLoad = true;
    await loadTaskList();
  }

  async function clearFilters(): Promise<void> {
    updateState(resetTaskFilters);
    await loadTaskList();
  }

  async function refreshTasks(): Promise<void> {
    if (refreshRunning) return;
    refreshRunning = true;
    updateState((state) => setTaskRefreshLoading(state, true));
    try {
      await loadTaskList();
    } finally {
      updateState((state) => setTaskRefreshLoading(state, false));
      refreshRunning = false;
    }
  }

  function updateAndReload(mutation: (state: TaskState) => void): void {
    updateState(mutation);
    void loadTaskList();
  }

  function destroy(): void {
    didInitialLoad = false;
    refreshRunning = false;
    listRequestVersion += 1;
    detailRequestVersion += 1;
    taskStateStore.set(newTaskState());
  }

  return {
    clearFilters,
    destroy,
    refreshTasks,
    selectTask:
      (taskId = "") =>
      () =>
        loadTaskDetail(taskId),
    setPageContext,
    taskDisplayStateStore,
    taskStateStore,
    updateTaskErrorFilter: (value = "") =>
      updateState((state) => setTaskErrorFilter(state, value)),
    updateTaskEventGroupFilter: (value = "") =>
      updateState((state) => setTaskEventGroupFilter(state, value)),
    updateTaskEventSearch: (value = "") =>
      updateState((state) => setTaskEventSearchQuery(state, value)),
    updateTaskLimit: (value = "") =>
      updateAndReload((state) => setTaskLimit(state, value)),
    updateTaskOperation: (value = "") =>
      updateAndReload((state) => setTaskOperation(state, value)),
    updateTaskOutcome: (value = "") =>
      updateState((state) => setTaskOutcome(state, value)),
    updateTaskRecording: (value = "") =>
      updateState((state) => setTaskRecording(state, value)),
    updateTaskSearch: (value = "") =>
      updateState((state) => setTaskSearch(state, value)),
    updateTaskStatus: (value = "") =>
      updateAndReload((state) => setTaskStatus(state, value)),
    updateTaskTimeRange: (value = "") =>
      updateState((state) => setTaskTimeRange(state, value)),
  };
}
