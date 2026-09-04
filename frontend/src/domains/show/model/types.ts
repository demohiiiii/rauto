import type { Readable, Writable } from "svelte/store";
import type {
  ConnectionRequestPayload,
  ConnectionTargetState,
  SavedConnectionSelectState,
  ShowObjectOption,
} from "$domains/connections/index.js";
import type {
  ParsedOutputSheet,
  SessionRetryPayload,
  SessionRetryState,
  TextfsmExcelExportPayload,
} from "$domains/execution/index.js";
import type { RecordLevel } from "$domains/overlays/index.js";
import type { TaskResultSummary } from "$domains/tasks/index.js";
import type { JsonValue } from "$lib/jsonValue.js";

export interface ShowConnectionSummary {
  device_profile?: string | null;
  groups?: string[];
  labels?: string[];
  name?: string;
}

export interface ShowObjectDefinition {
  command: string;
  mode: string | null;
  object: string;
  source: string;
  textfsm_mapping_command: string | null;
  textfsm_template_name: string | null;
}

export interface ShowObjectsPayload {
  objects: ShowObjectDefinition[];
  platform: string | null;
}

export interface ShowObjectQuery {
  deviceProfile?: string;
  textfsmPlatform?: string;
}

export interface BatchShowTargetSelection {
  connections?: ShowConnectionSummary[];
  groups?: string[];
  labels?: string[];
  targets?: string[];
}

export interface ShowExecutionResponseMetadata {
  error: { code: string; message: string } | null;
  result_summary: TaskResultSummary;
  success: boolean;
}

export interface ShowExecuteBasePayload {
  connection: ConnectionRequestPayload;
  mode: string | null;
  no_parse: boolean;
  record_level: RecordLevel;
  retry?: SessionRetryPayload;
  textfsm_platform: string | null;
  textfsm_strict_errors: boolean;
}

export interface ShowExecutePayload extends ShowExecuteBasePayload {
  object: string;
}

export interface ShowExecuteResponse {
  all: string;
  command: string;
  execution_response: ShowExecutionResponseMetadata;
  exit_code: number | null;
  mode: string;
  object: string;
  output: string;
  parse_error: string | null;
  parsed_output: JsonValue | null;
  platform: string;
  recording_jsonl: string | null;
  result_summary: TaskResultSummary;
  source: string;
  success: boolean;
  textfsm_mapping_command: string | null;
  textfsm_template_name: string | null;
}

export interface ShowBatchExecutePayload {
  groups: string[];
  labels: string[];
  max_parallel?: number;
  mode: string | null;
  no_parse: boolean;
  object: string;
  objects: string[];
  record_level: RecordLevel;
  retry?: SessionRetryPayload;
  targets: string[];
  textfsm_platform: string | null;
  textfsm_strict_errors: boolean;
}

export interface ShowBatchTargetResponse {
  all: string | null;
  command: string;
  error: string | null;
  exit_code: number | null;
  host: string;
  mode: string;
  object: string;
  output: string | null;
  parse_error: string | null;
  parsed_output: JsonValue | null;
  platform: string;
  profile: string;
  source: string;
  success: boolean;
  target: string;
  textfsm_mapping_command: string | null;
  textfsm_template_name: string | null;
}

export interface ShowBatchExecuteResponse {
  execution_response: ShowExecutionResponseMetadata;
  object: string;
  results: ShowBatchTargetResponse[];
  result_summary: TaskResultSummary;
  targets: string[];
}

export interface ShowExcelExportPayload extends TextfsmExcelExportPayload {
  filename: string;
  sheets: ParsedOutputSheet[];
}

export interface ShowApi {
  execute(payload: ShowExecutePayload): Promise<ShowExecuteResponse>;
  executeBatch(
    payload: ShowBatchExecutePayload,
  ): Promise<ShowBatchExecuteResponse>;
  exportExcel(payload: ShowExcelExportPayload): Promise<{
    blob: Blob;
    filename?: string;
  }>;
  listObjects(payload?: ShowObjectQuery): Promise<ShowObjectsPayload>;
}

export type ShowExecutionResult =
  | { kind: "empty" }
  | { kind: "running" }
  | { kind: "error"; message: string }
  | {
      basePayload: ShowExecuteBasePayload;
      kind: "result";
      results: ShowExecuteResponse[];
    };

export type BatchShowExecutionResult =
  | { kind: "empty" }
  | { kind: "running" }
  | { kind: "error"; message: string }
  | {
      kind: "result";
      resultPayload: ShowBatchExecuteResponse;
    };

export type BatchShowObjectAvailabilityStatus =
  | "empty"
  | "error"
  | "loading"
  | "missing-profile"
  | "no-targets"
  | "ready"
  | "waiting";

export interface BatchShowObjectAvailability {
  connectionCount: number;
  errorMessage?: string;
  missingProfileNames: string[];
  objectCount: number;
  profiles: string[];
  status: BatchShowObjectAvailabilityStatus;
}

export interface ShowCommandPreviewRow {
  commandText: string;
  fields: {
    command: string;
    mapping: string;
    mode: string;
    platform: string;
    source: string;
    textfsm: string;
  };
  objectName: string;
}

export interface ShowStoredTextfsmFields {
  excelName: string;
  parseTextfsm: boolean;
  textfsmPlatform: string;
  textfsmStrictErrors: boolean;
  textfsmTemplate: string;
}

export interface ShowStoredBatchFields extends ShowStoredTextfsmFields {
  maxParallel: string;
  mode: string;
}

export interface ShowFormFieldsState {
  batchRetry: SessionRetryState;
  batchShow: ShowStoredBatchFields;
  show: { mode: string };
  singleRetry: SessionRetryState;
  textfsm: ShowStoredTextfsmFields;
}

export interface ShowStateContext {
  batchShowExecutionResult: Writable<BatchShowExecutionResult>;
  batchShowObjectAvailability: Writable<BatchShowObjectAvailability>;
  batchShowObjectsRequestSeq: number;
  showCommandPreviewRows: Writable<Record<string, ShowCommandPreviewRow[]>>;
  showExecutionResult: Writable<ShowExecutionResult>;
  showFormFieldsState: ShowFormFieldsState;
  showObjectPlatformState: Map<string, string>;
  showObjectsRequestSeq: number;
}

export interface SavedConnectionSelectSnapshot {
  connections?: ShowConnectionSummary[];
  options?: string[];
  selected?: string;
}

export interface ShowRuntime {
  applyRecording(payload: ShowExecuteResponse): void;
  connectionPayload(): ConnectionRequestPayload;
  connectionTargetState: Readable<ConnectionTargetState>;
  currentExecutionProfile(): string;
  ensureConnectionTargetSelected(): boolean;
  executionConnectionProfileState: Readable<string>;
  hidePickerMenu(key: string): void;
  pickerValues(key: string): string[];
  recordLevelPayload(): RecordLevel;
  refreshExecutionModeOptions(): Promise<void>;
  refreshPickerSelected(key: string): void;
  savedConnectionSelectState: Readable<SavedConnectionSelectState>;
  setCustomObjectsChangedCallback(callback: () => void | Promise<void>): void;
  setObjectPickerOptions(
    key: string,
    objects: ShowObjectDefinition[],
    selected: string[],
    onRefreshed: () => void,
  ): boolean;
  showObjectOptionMeta(pickerKey: string, objectName: string): ShowObjectOption;
}

export interface ShowModeOptionRow {
  labelText: string;
  valueText: string;
}

export interface ShowPageDisplay {
  batchActive: boolean;
  queryAriaLabel: string;
  singleActive: boolean;
  title: string;
}

export interface ShowObjectSelectionDisplay {
  commandLabel: string;
  mappingLabel: string;
  modeOptionRows: ShowModeOptionRow[];
  modePlaceholder: string;
  objectLabel: string;
  objectPlaceholder: string;
  platformLabel: string;
  previewEmptyText: string;
  previewTitle: string;
  sourceLabel: string;
  textfsmLabel: string;
}
