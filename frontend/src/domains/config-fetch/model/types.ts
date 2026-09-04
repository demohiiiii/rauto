import type { Readable, Writable } from "svelte/store";
import type {
  ConnectionRequestPayload,
  ConnectionTargetState,
} from "$domains/connections/index.js";
import type { RecordLevel } from "$domains/overlays/index.js";
import type { TaskResultSummary } from "$domains/tasks/index.js";

export type ConfigFetchContentView = "normalized" | "raw";
export type ConfigFetchTargetMode = "batch" | "current";

export interface SessionRetryState {
  enabled: boolean;
  initialBackoffMs: string;
  maxBackoffMs: string;
  maxRetries: string;
  retryAuthenticationErrors: boolean;
}

export interface ConfigFetchForm {
  includeNormalized: boolean;
  kind: string;
  maxParallel: string;
  retry: SessionRetryState;
  targetMode: ConfigFetchTargetMode;
}

export interface ConfigFetchKindOption {
  label: string;
  value: string;
}

export interface ConfigFetchKindCatalog {
  kind: "error" | "idle" | "loading" | "ready";
  message?: string;
  options: ConfigFetchKindOption[];
  profile: string;
}

export interface ConfigCommandRow {
  command: string;
  device_profile: string;
  kind: string;
  mode: string | null;
  source: string;
}

export interface ConfigFetchTargetSelections {
  groups: string[];
  labels: string[];
  targets: string[];
}

export type ConfigFetchConnectionPayload = ConnectionRequestPayload;

export interface ConfigFetchRetryPayload {
  retry?: {
    initial_backoff_ms: number;
    max_backoff_ms: number;
    max_retries: number;
    retry_authentication_errors: boolean;
  };
}

export interface ConfigFetchBatchPayload extends ConfigFetchRetryPayload {
  groups: string[];
  include_normalized: boolean;
  kind: string;
  labels: string[];
  max_parallel?: number;
  record_level: RecordLevel | null;
  targets: string[];
}

export interface ConfigFetchCurrentPayload extends ConfigFetchRetryPayload {
  connection: ConfigFetchConnectionPayload;
  include_normalized: boolean;
  kind: string;
  record_level: RecordLevel | null;
}

export interface ConfigFetchExecutionError {
  code: string;
  message: string;
}

export interface ConfigFetchExecutionResponse {
  error: ConfigFetchExecutionError | null;
  result_summary: TaskResultSummary;
  success: boolean;
}

export interface ConfigFetchResultRow {
  all: string | null;
  command: string;
  content: string | null;
  error: string | null;
  fetched_at: string;
  host: string;
  kind: string;
  normalized_content?: string | null;
  normalized_sha256: string | null;
  profile: string;
  sha256: string | null;
  snapshot_id?: string;
  target: string;
}

export interface ConfigFetchSingleResult extends ConfigFetchResultRow {
  execution_response: ConfigFetchExecutionResponse;
  result_summary: TaskResultSummary;
}

export interface ConfigFetchResultPayload {
  execution_response: ConfigFetchExecutionResponse;
  kind: string;
  results: ConfigFetchResultRow[];
  result_summary: TaskResultSummary;
  targets: string[];
}

export interface ConfigFetchResultCounts {
  failed: number;
  succeeded: number;
  total: number;
}

export interface ConfigFetchDownloadDescriptor {
  content: string;
  filename: string;
}

export type ConfigFetchResultState =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "running" }
  | { kind: "result"; resultPayload: ConfigFetchResultPayload };

export type ConfigFetchConnectionTarget = ConnectionTargetState;

export interface ConfigFetchTargetPickerField {
  key: string;
  keyName: string;
  labelKey: string;
  placeholderKey: string;
}

export interface ConfigFetchApi {
  fetchConfig(
    payload: ConfigFetchCurrentPayload,
  ): Promise<ConfigFetchSingleResult>;
  fetchConfigBatch(
    payload: ConfigFetchBatchPayload,
  ): Promise<ConfigFetchResultPayload>;
  listConfigCommands(profile?: string): Promise<ConfigCommandRow[]>;
}

export interface ConfigFetchRuntime {
  connectionPayload(): ConfigFetchConnectionPayload;
  currentConnectionProfile(): string;
  download(blob: Blob, filename: string): void;
  ensureConnectionTargetSelected(): boolean;
  executionResultOutputText(
    row: ConfigFetchResultRow,
    outputField: keyof ConfigFetchResultRow,
  ): string;
  recordLevelPayload(): RecordLevel;
  retryRequestFields(retry: SessionRetryState): ConfigFetchRetryPayload;
  targetSelections(): ConfigFetchTargetSelections;
}

export interface ConfigFetchWorkspace {
  formState: Writable<ConfigFetchForm>;
  kindCatalogState: Writable<ConfigFetchKindCatalog>;
  resultState: Writable<ConfigFetchResultState>;
  execute(): Promise<void>;
  loadKindOptions(profile?: string): Promise<void>;
  refreshKindOptions(targetMode?: ConfigFetchTargetMode): Promise<void>;
  setField<K extends keyof ConfigFetchForm>(
    field: K,
    value: ConfigFetchForm[K],
  ): void;
  setRetry(retry?: Partial<SessionRetryState>): void;
}

export interface ConfigFetchWorkspaceOptions {
  api?: Partial<ConfigFetchApi>;
  runtime?: Partial<ConfigFetchRuntime>;
}

export type ConfigFetchConnectionTargetStore =
  Readable<ConfigFetchConnectionTarget>;
