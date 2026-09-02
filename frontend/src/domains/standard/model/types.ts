import type { Readable, Writable } from "svelte/store";
import type {
  CommandFlowDraftWorkspace,
  CommandFlowTemplateModel,
} from "$domains/command/index.js";

export type StandardCommandMultilineMode = "split_lines" | "whole";
export type StandardCommandStatusTone = "error" | "info" | "success";
export type StandardJsonValue =
  | boolean
  | number
  | string
  | null
  | StandardJsonValue[]
  | { [key: string]: StandardJsonValue };

export interface StandardSessionRetryState {
  [key: string]: unknown;
}

export interface StandardCommandVariableField {
  name?: unknown;
  [key: string]: unknown;
}

export interface StandardCommandTextfsmState {
  enabled: boolean;
  platform: string;
  platformOptions: string[];
  strictErrors: boolean;
  template: string;
}

export interface StandardCommandTextfsmPayload extends Record<string, unknown> {
  parse_textfsm: boolean;
  textfsm_platform: string | null;
  textfsm_strict_errors: boolean;
  textfsm_template: string | null;
}

export type StandardCommandPreview =
  | { kind: "empty"; message: string; text: string }
  | { kind: "running"; message: string; text: string }
  | { kind: "error"; message: string; text: string }
  | { kind: "result"; message: string; text: string };

export type StandardCommandExecutionResult<TPayload = Record<string, unknown>> =
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
  result_summary: StandardTaskResultSummary;
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
  retry: StandardSessionRetryState;
  sourceOptions: string[];
  sourceSelection: string;
  status: { message: string; tone: StandardCommandStatusTone };
  textfsm: StandardCommandTextfsmState;
  vars: Record<string, unknown>;
  varsSchema: unknown[];
}

export interface StandardCommandExecutionInput {
  connection?: unknown;
  content?: unknown;
  mode?: unknown;
  multilineMode?: unknown;
  recordLevel?: unknown;
  retry?: StandardSessionRetryState;
  textfsm?: Record<string, unknown>;
  vars?: unknown;
}

export interface StandardCommandExecutionPayload extends Record<
  string,
  unknown
> {
  connection: unknown;
  mode: string | null;
  multiline_mode: StandardCommandMultilineMode;
  record_level: unknown;
  template_content: string;
  vars: Record<string, unknown>;
}

export interface StandardCommandApi {
  executeTemplate(
    payload: StandardCommandExecutionPayload,
  ): Promise<StandardCommandExecutionResponse>;
  getTemplate(name: string): Promise<Record<string, unknown>>;
  inspectCommandTemplate(content: string): Promise<Record<string, unknown>>;
  listTemplates(): Promise<unknown>;
  renderTemplate(
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}

export interface StandardPicker {
  setValue(value: unknown): void;
  state: Readable<Record<string, unknown>>;
}

export interface StandardCommandRuntime {
  applyRecording(payload: unknown): void;
  clearTimer(timer: number): void;
  commandModePicker(): StandardPicker;
  confirm(message: string): boolean | Promise<boolean>;
  connection(): unknown;
  createRetryState(): StandardSessionRetryState;
  ensureTarget(): boolean;
  platformPicker(): StandardPicker;
  recordLevel(): unknown;
  retryRequestFields(retry: StandardSessionRetryState): Record<string, unknown>;
  setTimer(callback: () => void, delay: number): number;
}

export interface StandardCommandWorkspaceOptions {
  api?: Partial<StandardCommandApi>;
  confirmReplace?: (message: string) => boolean | Promise<boolean>;
  inspectionDelay?: number;
  runtime?: Partial<StandardCommandRuntime>;
}

export interface StandardCommandExecutionWorkspace {
  changeContent(content?: unknown): Promise<boolean>;
  changeMode(mode?: unknown): void;
  changeMultilineMode(multilineMode?: unknown): void;
  changeRetry(retry?: StandardSessionRetryState): void;
  changeTextfsm(patch?: Partial<StandardCommandTextfsmState>): void;
  changeVars(vars?: unknown): void;
  destroy(): void;
  execute(): Promise<boolean>;
  initialize(): Promise<boolean>;
  preview(): Promise<boolean>;
  selectSource(sourceValue?: unknown): Promise<boolean>;
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

export interface StandardFlowTemplateDetail extends Record<string, unknown> {
  content?: unknown;
  vars_schema?: unknown;
}

export interface StandardFlowAuthoringOptions {
  confirmDiscard?: (message: string) => boolean | Promise<boolean>;
  createTemplate?: (name: string, content: string) => Promise<unknown>;
  getTemplate?: (
    name: string,
    options: { builtin: boolean },
  ) => Promise<StandardFlowTemplateDetail>;
  inspectTemplate?: (content: string) => Promise<StandardFlowTemplateDetail>;
  onInspection?: (detail: StandardFlowTemplateDetail | null) => unknown;
  parseBuiltinSelection?: (value: string) => string | null;
  refreshTemplates?: () => Promise<unknown>;
  updateTemplate?: (name: string, content: string) => Promise<unknown>;
}

export interface StandardFlowExecutionSource {
  content: string;
  kind: "temporary";
}

export interface StandardCommandFlowAuthoringState {
  actionStateStore: Readable<StandardFlowAuthoringActionState>;
  closeNameDialog(): void;
  createNewDraft(name?: unknown): boolean;
  draft: CommandFlowDraftWorkspace;
  executeSource(): StandardFlowExecutionSource;
  inspectCurrent(): Promise<boolean>;
  nameDialogStateStore: Writable<StandardFlowNameDialogState>;
  openNewDialog(): void;
  openSaveAsDialog(): void;
  operationStateStore: Writable<StandardFlowAuthoringOperationState>;
  save(): Promise<boolean>;
  saveAs(name?: unknown): Promise<boolean>;
  selectionStateStore: Writable<StandardFlowSelection>;
  selectTemplate(value?: unknown): Promise<boolean>;
  setModel(model: CommandFlowTemplateModel): void;
  setNameDialogValue(value?: unknown): void;
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

export interface StandardCommandFlowExecutionInput {
  connection?: unknown;
  recordLevel?: unknown;
  retry?: StandardSessionRetryState;
  source?: unknown;
  textfsm?: unknown;
  vars?: unknown;
}

export interface StandardCommandFlowExecutionPayload extends Record<
  string,
  unknown
> {
  connection: unknown;
  record_level: unknown;
  vars: unknown;
}

export interface StandardCommandFlowTextfsmFields {
  enabled?: unknown;
  platform?: unknown;
  strictErrors?: unknown;
  template?: unknown;
}

export interface StandardCommandFlowTextfsmState {
  enabled: boolean;
  strictErrors: boolean;
  template: string;
}

export interface StandardParsedOutputSheet extends Record<string, unknown> {
  name: string;
  parsed_output: unknown;
}

export interface StandardCommandFlowApi {
  executeFlow(
    payload: StandardCommandFlowExecutionPayload,
  ): Promise<Record<string, unknown>>;
}

export interface StandardCommandFlowRuntime {
  applyRecording(payload: unknown): void;
  buildVarsPayload(): unknown;
  connectionPayload(): unknown;
  createRetryState(): StandardSessionRetryState;
  ensureTarget(): boolean;
  ensureTemplateDetail(
    templateName: string,
    options: { silent: boolean },
  ): Promise<unknown>;
  parsedOutputSheets(
    outputs: unknown[],
    options: {
      sheetName: (item: Record<string, unknown>, index: number) => string;
    },
  ): StandardParsedOutputSheet[];
  recordLevelPayload(): unknown;
  refreshModeOptions(): Promise<unknown>;
  retryRequestFields(retry: StandardSessionRetryState): Record<string, unknown>;
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
  retry: StandardSessionRetryState;
}

export interface StandardBatchFlowForm {
  maxParallel: string;
  retry: StandardSessionRetryState;
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
  result_summary: StandardTaskResultSummary;
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
  result_summary: StandardTaskResultSummary;
  results: StandardBatchFlowTargetResponse[];
  targets: string[];
  template_name: string;
}

export interface StandardBatchExecPayload extends Record<string, unknown> {
  command: string;
  groups: string[];
  labels: string[];
  mode: string | null;
  targets: string[];
}

export interface StandardBatchFlowPayload extends Record<string, unknown> {
  groups: string[];
  labels: string[];
  targets: string[];
}

export interface StandardBatchApi {
  executeCommand(
    payload: StandardBatchExecPayload,
  ): Promise<StandardBatchExecResponse>;
  executeFlow(
    payload: StandardBatchFlowPayload,
  ): Promise<StandardBatchFlowResponse>;
  listTemplates(basePath: string): Promise<unknown>;
}

export interface StandardBatchRuntime {
  batchExecTargets(): StandardBatchTargetSelection;
  batchFlowTargets(): StandardBatchTargetSelection;
  createRetryState(): StandardSessionRetryState;
  recordLevelPayload(): unknown;
  retryRequestFields(retry: StandardSessionRetryState): Record<string, unknown>;
}
