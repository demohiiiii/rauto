import type { Readable, Writable } from "svelte/store";
import type { ConnectionRequestPayload } from "$domains/connections/index.js";

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
  record_level: unknown | null;
  targets: string[];
}

export interface ConfigFetchCurrentPayload extends ConfigFetchRetryPayload {
  connection: ConfigFetchConnectionPayload;
  include_normalized: boolean;
  kind: string;
  record_level: unknown | null;
}

export interface ConfigFetchResultSummary {
  counts?: {
    failed?: number | string;
    succeeded?: number | string;
    total?: number | string;
  };
  success?: boolean;
  [key: string]: unknown;
}

export interface ConfigFetchResultRow {
  all?: unknown;
  command?: string | null;
  content?: string | null;
  error?: unknown;
  execution_response?: unknown;
  fetched_at?: string | null;
  host?: string | null;
  kind?: string | null;
  normalized_content?: string | null;
  normalized_sha256?: string | null;
  profile?: string | null;
  result_summary?: ConfigFetchResultSummary;
  sha256?: string | null;
  target?: string | null;
  [key: string]: unknown;
}

export interface ConfigFetchResultPayload {
  execution_response?: unknown;
  kind?: unknown;
  results?: ConfigFetchResultRow[];
  result_summary?: ConfigFetchResultSummary;
  targets?: unknown[];
  [key: string]: unknown;
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

export interface ConfigFetchConnectionTargetDetails {
  device_profile?: string | null;
  host?: string | null;
  label?: string | null;
  name?: string | null;
  profile?: string | null;
  [key: string]: unknown;
}

export interface ConfigFetchConnectionTarget {
  details?: ConfigFetchConnectionTargetDetails | null;
  kind?: string;
}

export interface ConfigFetchTargetPickerField {
  key: string;
  keyName: string;
  labelKey: string;
  placeholderKey: string;
  [key: string]: unknown;
}

export interface ConfigFetchApi {
  fetchConfig(
    payload: ConfigFetchCurrentPayload,
  ): Promise<ConfigFetchResultRow>;
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
    outputField: string,
  ): string;
  recordLevelPayload(): unknown;
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
    value: ConfigFetchForm[K] | unknown,
  ): void;
  setRetry(retry?: Partial<SessionRetryState>): void;
}

export interface ConfigFetchWorkspaceOptions {
  api?: Partial<ConfigFetchApi>;
  runtime?: Partial<ConfigFetchRuntime>;
}

export type ConfigFetchConnectionTargetStore =
  Readable<ConfigFetchConnectionTarget>;
