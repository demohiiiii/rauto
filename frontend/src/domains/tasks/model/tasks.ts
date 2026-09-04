import type {
  TaskEventFilterActionOptions,
  TaskFilterActionOptions,
  TaskState,
  TaskValueHandler,
} from "./types.js";

const TASK_FILTER_DEFAULTS = {
  errorFilter: "all",
  limit: "50",
  operation: "",
  outcome: "all",
  recording: "all",
  search: "",
  status: "",
  timeRange: "all",
} as const;

export function newTaskState(): TaskState {
  return {
    currentTaskDetail: null,
    currentTaskId: "",
    detailStatus: null,
    ...TASK_FILTER_DEFAULTS,
    eventGroupFilter: "all",
    eventSearchQuery: "",
    listStatus: null,
    refreshLoading: false,
    runs: [],
  };
}

export function resetTaskFilters(state: TaskState): void {
  Object.assign(state, TASK_FILTER_DEFAULTS);
}

export function setTaskRefreshLoading(
  state: TaskState,
  loading: boolean,
): void {
  state.refreshLoading = loading;
}

export function setTaskLimit(state: TaskState, value = ""): void {
  state.limit = value;
}

export function setTaskOperation(state: TaskState, value = ""): void {
  state.operation = value;
}

export function setTaskStatus(state: TaskState, value = ""): void {
  state.status = value;
}

export function setTaskOutcome(state: TaskState, value = ""): void {
  state.outcome = value;
}

export function setTaskTimeRange(state: TaskState, value = ""): void {
  state.timeRange = value;
}

export function setTaskRecording(state: TaskState, value = ""): void {
  state.recording = value;
}

export function setTaskErrorFilter(state: TaskState, value = ""): void {
  state.errorFilter = value;
}

export function setTaskSearch(state: TaskState, value = ""): void {
  state.search = value;
}

export function setTaskEventGroupFilter(state: TaskState, value = ""): void {
  state.eventGroupFilter = value;
}

export function setTaskEventSearchQuery(state: TaskState, value = ""): void {
  state.eventSearchQuery = value;
}

function optionalHandler(
  handler: TaskValueHandler | null | undefined,
): TaskValueHandler | undefined {
  return typeof handler === "function" ? handler : undefined;
}

export function taskFiltersActionHandlers({
  onErrorFilterChange,
  onLimitChange,
  onOperationChange,
  onOutcomeChange,
  onRecordingChange,
  onSearchInput,
  onStatusChange,
  onTimeRangeChange,
}: TaskFilterActionOptions = {}) {
  return {
    errorFilterChangeHandler: optionalHandler(onErrorFilterChange),
    limitChangeHandler: optionalHandler(onLimitChange),
    operationChangeHandler: optionalHandler(onOperationChange),
    outcomeChangeHandler: optionalHandler(onOutcomeChange),
    recordingChangeHandler: optionalHandler(onRecordingChange),
    searchChangeHandler: optionalHandler(onSearchInput),
    statusChangeHandler: optionalHandler(onStatusChange),
    timeRangeChangeHandler: optionalHandler(onTimeRangeChange),
  };
}

export function taskEventFilterActionHandlers({
  onGroupFilterChange,
  onSearchInput,
}: TaskEventFilterActionOptions = {}) {
  return {
    groupFilterChangeHandler: optionalHandler(onGroupFilterChange),
    searchChangeHandler: optionalHandler(onSearchInput),
  };
}
