import type { Readable, Writable } from "svelte/store";
import type {
  CommandFlowDraftWorkspace,
  CommandFlowTemplateModel,
} from "$domains/command/index.js";
import type { ConnectionRequestPayload } from "$domains/connections/index.js";
import type {
  ParsedOutputSheet,
  SessionRetryPayload,
  SessionRetryState,
} from "$domains/execution/index.js";
import type { RecordLevel } from "$domains/overlays/index.js";
import type {
  ModeSelectState,
  TextfsmPlatformSelectState,
} from "$domains/profiles/index.js";
import type {
  CommandFlowTemplateDetail,
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
  enabled: boolean;
  platform: string;
  platformOptions: string[];
  strictErrors: boolean;
  template: string;
}

export interface StandardCommandTextfsmPayload {
  parse_textfsm: boolean;
  textfsm_platform: string | null;
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
  | { kind: "result"; resultPayload: TPayload };

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
  textfsm_platform?: string | null;
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
  applyRecording(payload: StandardCommandExecutionResponse): void;
  clearTimer(timer: number): void;
  commandModePicker(): StandardPicker<ModeSelectState>;
  confirm(message: string): boolean | Promise<boolean>;
  connection(): ConnectionRequestPayload;
  createRetryState(): SessionRetryState;
  ensureTarget(): boolean;
  platformPicker(): StandardPicker<TextfsmPlatformSelectState>;
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
  initialize(): Promise<boolean>;
  preview(): Promise<boolean>;
  selectSource(sourceValue?: string): Promise<boolean>;
  stateStore: Writable<StandardCommandWorkspaceState>;
}

export type StandardFlowSelectionKind = "builtin" | "custom" | "new";
export type StandardFlowNameDialogAction = "new" | "saveAs";

export interface StandardFlowSelection {
  kind: StandardFlowSelectionKind;
  name: string;
  value: string;
}

export interface StandardFlowAuthoringOperationState {
  loadingAction: string;
  statusMessage: string;
  statusTone: StandardCommandStatusTone;
}

export interface StandardFlowNameDialogState {
  action: StandardFlowNameDialogAction;
  errorMessage: string;
  open: boolean;
  value: string;
}

export interface StandardFlowAuthoringActionState extends StandardFlowAuthoringOperationState {
  canRun: boolean;
  canSave: boolean;
  canSaveAs: boolean;
  dirty: boolean;
}

export type StandardFlowTemplateDetail = CommandFlowTemplateDetail;

export interface StandardFlowAuthoringOptions {
  confirmDiscard?: (message: string) => boolean | Promise<boolean>;
  createTemplate?: (
    name: string,
    content: string,
  ) => Promise<StandardTemplateDetail>;
  getTemplate?: (
    name: string,
    options: { builtin: boolean },
  ) => Promise<StandardFlowTemplateDetail>;
  inspectTemplate?: (content: string) => Promise<StandardFlowTemplateDetail>;
  onInspection?: (detail: StandardFlowTemplateDetail | null) => void;
  parseBuiltinSelection?: (value: string) => string | null;
  refreshTemplates?: () => Promise<void>;
  updateTemplate?: (
    name: string,
    content: string,
  ) => Promise<StandardTemplateDetail>;
}

export interface StandardFlowExecutionSource {
  content: string;
  kind: "temporary";
}

export interface StandardCommandFlowAuthoringState {
  actionStateStore: Readable<StandardFlowAuthoringActionState>;
  closeNameDialog(): void;
  createNewDraft(name?: string): boolean;
  draft: CommandFlowDraftWorkspace;
  executeSource(): StandardFlowExecutionSource;
  inspectCurrent(): Promise<boolean>;
  nameDialogStateStore: Writable<StandardFlowNameDialogState>;
  openNewDialog(): void;
  openSaveAsDialog(): void;
  operationStateStore: Writable<StandardFlowAuthoringOperationState>;
  save(): Promise<boolean>;
  saveAs(name?: string): Promise<boolean>;
  selectionStateStore: Writable<StandardFlowSelection>;
  selectTemplate(value?: string): Promise<boolean>;
  setModel(model: CommandFlowTemplateModel): void;
  setNameDialogValue(value?: string): void;
  setTomlText(tomlText?: string): boolean;
  submitNameDialog(): Promise<boolean>;
}

export interface StandardCommandFlowSavedExecutionSource {
  builtinTemplateName: string | null;
  kind: "saved";
  templateSelection: string;
}

export interface StandardCommandFlowTemporaryExecutionSource {
  content: string;
  kind: "temporary";
}

export type StandardCommandFlowNormalizedExecutionSource =
  | StandardCommandFlowSavedExecutionSource
  | StandardCommandFlowTemporaryExecutionSource;

export type StandardCommandFlowExecutionSourceInput =
  | { content?: string; kind: "temporary" }
  | { kind: "saved"; templateSelection?: string };

export interface StandardCommandFlowExecutionInput {
  connection?: ConnectionRequestPayload;
  recordLevel?: RecordLevel | null;
  retry?: SessionRetryState;
  source?: StandardCommandFlowExecutionSourceInput;
  textfsm?: Partial<StandardCommandFlowTextfsmPayload>;
  vars?: JsonValue;
}

export type StandardCommandFlowSourcePayload =
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

export interface StandardCommandFlowExecutionFields {
  connection?: ConnectionRequestPayload;
  parse_textfsm?: boolean;
  record_level?: RecordLevel | null;
  retry?: SessionRetryPayload;
  textfsm_platform?: string | null;
  textfsm_strict_errors?: boolean;
  textfsm_template?: string | null;
  textfsm_vendor?: string | null;
  vars: JsonValue;
}

export type StandardCommandFlowExecutionPayload =
  StandardCommandFlowSourcePayload & StandardCommandFlowExecutionFields;

export interface StandardCommandFlowTextfsmFields {
  enabled?: boolean;
  platform?: string;
  strictErrors?: boolean;
  template?: string;
}

export interface StandardCommandFlowTextfsmState {
  enabled: boolean;
  strictErrors: boolean;
  template: string;
}

export interface StandardCommandFlowTextfsmPayload {
  parse_textfsm: boolean;
  textfsm_platform: string | null;
  textfsm_strict_errors: boolean;
  textfsm_template: string | null;
}

export type StandardParsedOutputSheet = ParsedOutputSheet;

export interface StandardCommandFlowExecutionResponse {
  outputs: StandardCommandResult[];
  recording_jsonl: string | null;
  result_summary: TaskResultSummary;
  success: boolean;
  template_name: string;
}

export interface StandardCommandFlowApi {
  executeFlow(
    payload: StandardCommandFlowExecutionPayload,
  ): Promise<StandardCommandFlowExecutionResponse>;
}

export interface StandardCommandFlowRuntime {
  applyRecording(payload: StandardCommandFlowExecutionResponse): void;
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

export type StandardBatchExecField = "command" | "maxParallel" | "mode";
export type StandardBatchFlowField = "maxParallel" | "template" | "varsJson";

export interface StandardBatchTargetSelection {
  groups: string[];
  labels: string[];
  targets: string[];
}

export interface StandardBatchExecForm {
  command: string;
  maxParallel: string;
  mode: string;
  retry: SessionRetryState;
}

export interface StandardBatchFlowForm {
  maxParallel: string;
  retry: SessionRetryState;
  template: string;
  varsJson: string;
}

export interface StandardBatchTemplateOption {
  labelText: string;
  valueText: string;
}

export type StandardBatchExecutionResult<TPayload> =
  | { kind: "empty" }
  | { kind: "running" }
  | { kind: "error"; message: string }
  | { kind: "result"; resultPayload: TPayload };

export interface StandardBatchExecTargetResponse {
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

export interface StandardBatchFlowTargetResponse {
  error: string | null;
  host: string;
  outputs: StandardCommandResult[];
  profile: string;
  success: boolean | null;
  target: string;
}

export interface StandardBatchFlowResponse {
  result_summary: TaskResultSummary;
  results: StandardBatchFlowTargetResponse[];
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
  command: string;
  multiline_mode?: StandardCommandMultilineMode;
  mode: string | null;
  parse_textfsm?: boolean;
  textfsm_platform?: string | null;
  textfsm_strict_errors?: boolean;
  textfsm_template?: string | null;
  textfsm_vendor?: string | null;
}

export type StandardBatchFlowTemplatePayload =
  | { builtin_template_name: string; template_name?: never }
  | { builtin_template_name?: never; template_name: string };

export type StandardBatchFlowSourcePayload =
  | (StandardBatchFlowTemplatePayload & { content?: never })
  | {
      builtin_template_name?: never;
      content: string;
      template_name?: never;
    };

export type StandardBatchFlowPayload = StandardBatchTargetPayload &
  StandardBatchFlowSourcePayload & {
    parse_textfsm?: boolean;
    textfsm_platform?: string | null;
    textfsm_strict_errors?: boolean;
    textfsm_template?: string | null;
    textfsm_vendor?: string | null;
    vars?: JsonValue;
  };

export interface StandardBatchApi {
  executeCommand(
    payload: StandardBatchExecPayload,
  ): Promise<StandardBatchExecResponse>;
  executeFlow(
    payload: StandardBatchFlowPayload,
  ): Promise<StandardBatchFlowResponse>;
  listTemplates(basePath: string): Promise<StandardTemplateMeta[]>;
}

export interface StandardBatchRuntime {
  batchExecTargets(): StandardBatchTargetSelection;
  batchFlowTargets(): StandardBatchTargetSelection;
  createRetryState(): SessionRetryState;
  recordLevelPayload(): RecordLevel;
  retryRequestFields(retry: SessionRetryState): StandardBatchRetryFields;
}
