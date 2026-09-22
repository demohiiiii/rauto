import type { Readable, Writable } from "svelte/store";
import type {
  InteractiveDraftWorkspace,
  InteractiveTemplateModel,
} from "$domains/command/index.js";
import type {
  ConnectionRequestPayload,
  SavedConnection,
} from "$domains/connections/index.js";
import type {
  ParsedOutputSheet,
  SessionRetryPayload,
  SessionRetryState,
} from "$domains/execution/index.js";
import type { RecordLevel } from "$domains/overlays/index.js";
import type { ModeSelectState } from "$domains/profiles/index.js";
import type {
  InteractiveTemplateDetail,
  CommandTemplateInspection,
  TemplateVariableField,
} from "$domains/templates/index.js";
import type { TaskResultSummary } from "$domains/tasks/index.js";
import type { JsonObject, JsonValue } from "$lib/jsonValue.js";

export type StandardCommandMultilineMode = "split_lines" | "whole";
export type StandardCommandStatusTone = "error" | "info" | "success";
export type StandardJsonValue = JsonValue;

export type StandardCommandVariableField = TemplateVariableField;

export interface StandardCommandTextfsmState {
  autoDownloadExcel: boolean;
  autoDownloadOutput: boolean;
  enabled: boolean;
  strictErrors: boolean;
  template: string;
}

export interface StandardCommandTextfsmPayload {
  parse_textfsm: boolean;
  textfsm_strict_errors: boolean;
  textfsm_template: string | null;
}

export interface StandardTemplateMeta {
  name: string;
}

export interface StandardTemplateDetail {
  content: string;
  name: string;
}

export type StandardCommandTemplateInspection = CommandTemplateInspection;

export interface StandardCommandRenderPayload {
  connection?: ConnectionRequestPayload;
  template_content: string;
  vars: JsonObject;
}

export interface StandardCommandRenderResponse {
  rendered_commands: string;
}

export type StandardCommandPreview =
  | { kind: "empty"; message: string; text: string }
  | { kind: "running"; message: string; text: string }
  | { kind: "error"; message: string; text: string }
  | { kind: "result"; message: string; text: string };

export type StandardCommandExecutionResult<TPayload> =
  | { kind: "empty" }
  | { kind: "running" }
  | { kind: "error"; message: string }
  | { kind: "result"; resultPayload: TPayload; deviceName?: string };

export interface StandardCommandResult {
  all: string | null;
  command: string;
  error: string | null;
  exit_code: number | null;
  output: string | null;
  parse_error: string | null;
  parsed_output: StandardJsonValue | null;
  success: boolean;
}

export interface StandardCommandExecutionResponse {
  executed: StandardCommandResult[];
  recording_jsonl: string | null;
  rendered_commands: string;
  result_summary: TaskResultSummary;
}

export interface StandardTaskResultSummary {
  counts?: {
    failed: number;
    skipped?: number;
    succeeded: number;
    total: number;
  };
  details?: StandardJsonValue;
  operation: string;
  outcome: string;
  recording_available?: boolean;
  success: boolean;
  summary: string;
}

export interface StandardCommandWorkspaceState {
  baselineContent: string;
  content: string;
  dirty: boolean;
  executionResult: StandardCommandExecutionResult<StandardCommandExecutionResponse>;
  loadingActions: string[];
  mode: string;
  modeOptions: string[];
  multilineMode: StandardCommandMultilineMode;
  preview: StandardCommandPreview;
  retry: SessionRetryState;
  sourceOptions: string[];
  sourceSelection: string;
  status: { message: string; tone: StandardCommandStatusTone };
  textfsm: StandardCommandTextfsmState;
  vars: JsonObject;
  varsSchema: StandardCommandVariableField[];
}

export interface StandardCommandExecutionInput {
  connection?: ConnectionRequestPayload;
  content?: string;
  mode?: string;
  multilineMode?: StandardCommandMultilineMode;
  recordLevel?: RecordLevel;
  retry?: SessionRetryState;
  textfsm?: Partial<StandardCommandTextfsmPayload>;
  vars?: JsonObject;
}

export interface StandardCommandExecutionPayload {
  connection?: ConnectionRequestPayload;
  dry_run?: boolean;
  mode: string | null;
  multiline_mode: StandardCommandMultilineMode;
  parse_textfsm?: boolean;
  record_level?: RecordLevel;
  retry?: SessionRetryPayload;
  task_id?: string;
  template_content: string;
  template_dir?: string | null;
  textfsm_strict_errors?: boolean;
  textfsm_template?: string | null;
  textfsm_vendor?: string | null;
  vars: JsonObject;
}

export interface StandardCommandApi {
  executeTemplate(
    payload: StandardCommandExecutionPayload,
  ): Promise<StandardCommandExecutionResponse>;
  getTemplate(name: string): Promise<StandardTemplateDetail>;
  inspectCommandTemplate(
    content: string,
  ): Promise<StandardCommandTemplateInspection>;
  listTemplates(): Promise<StandardTemplateMeta[]>;
  renderTemplate(
    payload: StandardCommandRenderPayload,
  ): Promise<StandardCommandRenderResponse>;
}

export interface StandardPicker<TState> {
  setValue(value?: string): void;
  state: Readable<TState>;
}

export interface StandardCommandRuntime {
  subscribeConnectionChange(listener: () => void): () => void;
  clearTimer(timer: number): void;
  commandModePicker(): StandardPicker<ModeSelectState>;
  confirm(message: string): boolean | Promise<boolean>;
  connection(): ConnectionRequestPayload;
  createRetryState(): SessionRetryState;
  ensureTarget(): boolean;
  recordLevel(): RecordLevel;
  retryRequestFields(retry: SessionRetryState): StandardBatchRetryFields;
  setTimer(callback: () => void, delay: number): number;
}

export interface StandardCommandWorkspaceOptions {
  api?: Partial<StandardCommandApi>;
  confirmReplace?: (message: string) => boolean | Promise<boolean>;
  inspectionDelay?: number;
  runtime?: Partial<StandardCommandRuntime>;
}

export interface StandardCommandExecutionWorkspace {
  changeContent(content?: string): Promise<boolean>;
  changeMode(mode?: string): void;
  changeMultilineMode(multilineMode?: StandardCommandMultilineMode): void;
  changeRetry(retry?: Partial<SessionRetryState>): void;
  changeTextfsm(patch?: Partial<StandardCommandTextfsmState>): void;
  changeVars(vars?: JsonObject): void;
  destroy(): void;
  execute(): Promise<boolean>;
  downloadOutput(): Promise<void>;
  initialize(): Promise<boolean>;
  preview(): Promise<boolean>;
  selectSource(sourceValue?: string): Promise<boolean>;
  stateStore: Writable<StandardCommandWorkspaceState>;
}

export type StandardInteractiveSelectionKind = "builtin" | "custom" | "new";
export type StandardInteractiveNameDialogAction = "new" | "saveAs";

export interface StandardInteractiveSelection {
  kind: StandardInteractiveSelectionKind;
  name: string;
  value: string;
}

export interface StandardInteractiveAuthoringOperationState {
  loadingAction: string;
  statusMessage: string;
  statusTone: StandardCommandStatusTone;
}

export interface StandardInteractiveNameDialogState {
  action: StandardInteractiveNameDialogAction;
  errorMessage: string;
  open: boolean;
  value: string;
}

export interface StandardInteractiveAuthoringActionState extends StandardInteractiveAuthoringOperationState {
  canRun: boolean;
  canSave: boolean;
  canSaveAs: boolean;
  dirty: boolean;
}

export type StandardInteractiveTemplateDetail = InteractiveTemplateDetail;

export interface StandardInteractiveAuthoringOptions {
  confirmDiscard?: (message: string) => boolean | Promise<boolean>;
  createTemplate?: (
    name: string,
    content: string,
  ) => Promise<StandardTemplateDetail>;
  getTemplate?: (
    name: string,
    options: { builtin: boolean },
  ) => Promise<StandardInteractiveTemplateDetail>;
  inspectTemplate?: (
    content: string,
  ) => Promise<StandardInteractiveTemplateDetail>;
  onInspection?: (detail: StandardInteractiveTemplateDetail | null) => void;
  parseBuiltinSelection?: (value: string) => string | null;
  refreshTemplates?: () => Promise<void>;
  updateTemplate?: (
    name: string,
    content: string,
  ) => Promise<StandardTemplateDetail>;
}

export interface StandardInteractiveExecutionSource {
  content: string;
  kind: "temporary";
}

export interface StandardInteractiveAuthoringState {
  actionStateStore: Readable<StandardInteractiveAuthoringActionState>;
  closeNameDialog(): void;
  createNewDraft(name?: string): boolean;
  draft: InteractiveDraftWorkspace;
  executeSource(): StandardInteractiveExecutionSource;
  inspectCurrent(): Promise<boolean>;
  nameDialogStateStore: Writable<StandardInteractiveNameDialogState>;
  openNewDialog(): void;
  openSaveAsDialog(): void;
  operationStateStore: Writable<StandardInteractiveAuthoringOperationState>;
  save(): Promise<boolean>;
  saveAs(name?: string): Promise<boolean>;
  selectionStateStore: Writable<StandardInteractiveSelection>;
  selectTemplate(value?: string): Promise<boolean>;
  setModel(model: InteractiveTemplateModel): void;
  setNameDialogValue(value?: string): void;
  setTomlText(tomlText?: string): boolean;
  submitNameDialog(): Promise<boolean>;
}

export interface StandardInteractiveSavedExecutionSource {
  builtinTemplateName: string | null;
  kind: "saved";
  templateSelection: string;
}

export interface StandardInteractiveTemporaryExecutionSource {
  content: string;
  kind: "temporary";
}

export type StandardInteractiveNormalizedExecutionSource =
  | StandardInteractiveSavedExecutionSource
  | StandardInteractiveTemporaryExecutionSource;

export type StandardInteractiveExecutionSourceInput =
  | { content?: string; kind: "temporary" }
  | { kind: "saved"; templateSelection?: string };

export interface StandardInteractiveExecutionInput {
  connection?: ConnectionRequestPayload;
  recordLevel?: RecordLevel | null;
  retry?: SessionRetryState;
  source?: StandardInteractiveExecutionSourceInput;
  textfsm?: Partial<StandardInteractiveTextfsmPayload>;
  vars?: JsonValue;
}

export type StandardInteractiveSourcePayload =
  | {
      builtin_template_name: null;
      content?: never;
      template_name: string;
    }
  | {
      builtin_template_name: string;
      content?: never;
      template_name: null;
    }
  | {
      builtin_template_name?: never;
      content: string;
      template_name?: never;
    };

export interface StandardInteractiveExecutionFields {
  connection?: ConnectionRequestPayload;
  parse_textfsm?: boolean;
  record_level?: RecordLevel | null;
  retry?: SessionRetryPayload;
  textfsm_strict_errors?: boolean;
  textfsm_template?: string | null;
  textfsm_vendor?: string | null;
  vars: JsonValue;
}

export type StandardInteractiveExecutionPayload =
  StandardInteractiveSourcePayload & StandardInteractiveExecutionFields;

export interface StandardInteractiveTextfsmFields {
  autoDownloadExcel?: boolean;
  autoDownloadOutput?: boolean;
  enabled?: boolean;
  strictErrors?: boolean;
  template?: string;
}

export interface StandardInteractiveTextfsmState {
  autoDownloadExcel: boolean;
  autoDownloadOutput: boolean;
  enabled: boolean;
  strictErrors: boolean;
  template: string;
}

export interface StandardInteractiveTextfsmPayload {
  parse_textfsm: boolean;
  textfsm_strict_errors: boolean;
  textfsm_template: string | null;
}

export type StandardParsedOutputSheet = ParsedOutputSheet;

export interface StandardInteractiveExecutionResponse {
  outputs: StandardCommandResult[];
  recording_jsonl: string | null;
  result_summary: TaskResultSummary;
  success: boolean;
  template_name: string;
}

export interface StandardInteractiveApi {
  executeInteractive(
    payload: StandardInteractiveExecutionPayload,
  ): Promise<StandardInteractiveExecutionResponse>;
}

export interface StandardInteractiveRuntime {
  buildVarsPayload(): JsonObject | null;
  connectionPayload(): ConnectionRequestPayload;
  createRetryState(): SessionRetryState;
  ensureTarget(): boolean;
  ensureTemplateDetail(
    templateName: string,
    options: { silent: boolean },
  ): Promise<object | null>;
  parsedOutputSheets(
    outputs: StandardCommandResult[],
    options: {
      sheetName: (item: StandardCommandResult, index: number) => string;
    },
  ): StandardParsedOutputSheet[];
  recordLevelPayload(): RecordLevel;
  refreshModeOptions(): Promise<void>;
  retryRequestFields(retry: SessionRetryState): StandardBatchRetryFields;
}

export interface StandardLoadingRunner {
  run<T>(key: string, task: () => Promise<T> | T): Promise<T | undefined>;
}

export type StandardLoadingRunnerFactory = (
  readKeys: () => string[],
  writeKeys: (keys: string[]) => void,
) => StandardLoadingRunner;

export interface StandardBatchTargetSelection {
  groups: string[];
  labels: string[];
  targets: string[];
}

export type StandardBatchExecutionResult<TPayload> =
  | { kind: "empty" }
  | { kind: "running" }
  | { kind: "error"; message: string }
  | { kind: "result"; resultPayload: TPayload; deviceName?: string };

export interface StandardBatchExecTargetResponse {
  outputs: StandardCommandResult[];
  command: string;
  error: string | null;
  exit_code: number | null;
  host: string;
  mode: string;
  output: string | null;
  parse_error: string | null;
  parsed_output: StandardJsonValue | null;
  profile: string;
  target: string;
}

export interface StandardBatchExecResponse {
  command: string;
  result_summary: TaskResultSummary;
  results: StandardBatchExecTargetResponse[];
  targets: string[];
}

export interface StandardBatchInteractiveTargetResponse {
  error: string | null;
  host: string;
  outputs: StandardCommandResult[];
  profile: string;
  success: boolean | null;
  target: string;
}

export interface StandardBatchInteractiveResponse {
  result_summary: TaskResultSummary;
  results: StandardBatchInteractiveTargetResponse[];
  targets: string[];
  template_name: string;
}

export interface StandardBatchRetryFields {
  retry?: SessionRetryPayload;
}

export interface StandardBatchTargetPayload extends StandardBatchRetryFields {
  groups: string[];
  labels: string[];
  max_parallel?: number;
  record_level?: RecordLevel | null;
  targets: string[];
  task_id?: string;
}

export interface StandardBatchExecPayload extends StandardBatchTargetPayload {
  command?: string;
  template_content?: string;
  vars?: JsonObject;
  multiline_mode?: StandardCommandMultilineMode;
  mode: string | null;
  parse_textfsm?: boolean;
  textfsm_strict_errors?: boolean;
  textfsm_template?: string | null;
  textfsm_vendor?: string | null;
}

export type StandardBatchInteractiveTemplatePayload =
  | { builtin_template_name: string; template_name?: never }
  | { builtin_template_name?: never; template_name: string };

export type StandardBatchInteractiveSourcePayload =
  | (StandardBatchInteractiveTemplatePayload & { content?: never })
  | {
      builtin_template_name?: never;
      content: string;
      template_name?: never;
    };

export type StandardBatchInteractivePayload = StandardBatchTargetPayload &
  StandardBatchInteractiveSourcePayload & {
    parse_textfsm?: boolean;
    textfsm_strict_errors?: boolean;
    textfsm_template?: string | null;
    textfsm_vendor?: string | null;
    vars?: JsonValue;
  };

export interface StandardBatchApi {
  executeCommand(
    payload: StandardBatchExecPayload,
  ): Promise<StandardBatchExecResponse>;
  executeInteractive(
    payload: StandardBatchInteractivePayload,
  ): Promise<StandardBatchInteractiveResponse>;
  listConnections(): Promise<(SavedConnection & { name: string })[]>;
  renderTemplate(
    payload: StandardCommandRenderPayload,
  ): Promise<StandardCommandRenderResponse>;
}

export interface StandardBatchRuntime {
  batchExecTargets(): StandardBatchTargetSelection;
  batchInteractiveTargets(): StandardBatchTargetSelection;
  createRetryState(): SessionRetryState;
  recordLevelPayload(): RecordLevel;
  retryRequestFields(retry: SessionRetryState): StandardBatchRetryFields;
}
