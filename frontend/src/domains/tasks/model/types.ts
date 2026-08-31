import type { Readable, Writable } from "svelte/store";

export type TaskStatusTone = "error" | "running";
export type TaskValueHandler = (value: string) => unknown;

export interface TaskStatusMessage {
  message: string;
  tone: TaskStatusTone;
}

export interface TaskRun {
  agent_name: string | null;
  completed_at: string | null;
  execution_time_ms: number | null;
  has_error: boolean;
  has_recording: boolean;
  operation: string;
  outcome: string | null;
  source: string | null;
  started_at: string;
  status: string;
  success: boolean;
  summary: string;
  target_label: string | null;
  task_id: string;
}

export interface TaskEvent {
  details: unknown | null;
  event_type: string;
  level: string;
  message: string;
  occurred_at: string;
  operation: string;
  progress: number | null;
  seq: number;
  stage: string | null;
  task_id: string;
}

export interface TaskArtifact {
  artifact_type: string;
  content_text: string | null;
  content_type: string | null;
  created_at: string;
  id: number;
  name: string;
  size_bytes: number | null;
  storage_ref: string | null;
}

export interface TaskResultCounts {
  failed: number;
  skipped?: number | null;
  succeeded: number;
  total: number;
}

export interface TaskResultSummary {
  counts?: TaskResultCounts | null;
  details?: unknown;
  operation?: string | null;
  outcome?: string | null;
  recording_available?: boolean | null;
  success?: boolean | null;
  summary?: string | null;
}

export interface TaskRunDetail extends TaskRun {
  artifacts: TaskArtifact[];
  created_at: string;
  error: unknown | null;
  events: TaskEvent[];
  result: unknown | null;
  result_summary: TaskResultSummary | null;
  updated_at: string;
}

export interface TaskState {
  currentTaskDetail: TaskRunDetail | null;
  currentTaskId: string;
  detailStatus: TaskStatusMessage | null;
  errorFilter: string;
  eventGroupFilter: string;
  eventSearchQuery: string;
  limit: string;
  listStatus: TaskStatusMessage | null;
  operation: string;
  outcome: string;
  recording: string;
  refreshLoading: boolean;
  runs: TaskRun[];
  search: string;
  status: string;
  timeRange: string;
}

export interface TaskQuery {
  limit?: number;
  operation?: string;
  status?: string;
}

export interface TasksApi {
  getTask(taskId: string): Promise<TaskRunDetail>;
  listTasks(query?: TaskQuery): Promise<TaskRun[]>;
}

export interface TasksWorkspaceOptions {
  api?: Partial<TasksApi>;
}

export interface TaskFilterActionOptions {
  onErrorFilterChange?: TaskValueHandler | null;
  onLimitChange?: TaskValueHandler | null;
  onOperationChange?: TaskValueHandler | null;
  onOutcomeChange?: TaskValueHandler | null;
  onRecordingChange?: TaskValueHandler | null;
  onSearchInput?: TaskValueHandler | null;
  onStatusChange?: TaskValueHandler | null;
  onTimeRangeChange?: TaskValueHandler | null;
}

export interface TaskEventFilterActionOptions {
  onGroupFilterChange?: TaskValueHandler | null;
  onSearchInput?: TaskValueHandler | null;
}

export interface TasksPageWorkspace<TDisplay> {
  clearFilters(): Promise<void>;
  destroy(): void;
  refreshTasks(): Promise<void>;
  selectTask(taskId?: string): () => Promise<void>;
  setPageContext(context?: { active?: boolean }): Promise<void>;
  taskDisplayStateStore: Readable<TDisplay>;
  taskStateStore: Writable<TaskState>;
  updateTaskErrorFilter(value?: string): void;
  updateTaskEventGroupFilter(value?: string): void;
  updateTaskEventSearch(value?: string): void;
  updateTaskLimit(value?: string): void;
  updateTaskOperation(value?: string): void;
  updateTaskOutcome(value?: string): void;
  updateTaskRecording(value?: string): void;
  updateTaskSearch(value?: string): void;
  updateTaskStatus(value?: string): void;
  updateTaskTimeRange(value?: string): void;
}
