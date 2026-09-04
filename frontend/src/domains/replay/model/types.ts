import type { Readable, Writable } from "svelte/store";

export type ReplayJsonValue =
  | boolean
  | number
  | string
  | null
  | ReplayJsonValue[]
  | ReplayJsonObject;

export interface ReplayJsonObject {
  [key: string]: ReplayJsonValue | undefined;
}

export type ReplayEventKind =
  | "command_output"
  | "connection_closed"
  | "connection_established"
  | "file_upload_finished"
  | "file_upload_started"
  | "hook_failed"
  | "hook_started"
  | "hook_succeeded"
  | "prompt_changed"
  | "raw_chunk"
  | "state_changed"
  | "tx_block_finished"
  | "tx_block_started"
  | "tx_rollback_started"
  | "tx_rollback_step_failed"
  | "tx_rollback_step_succeeded"
  | "tx_step_failed"
  | "tx_step_succeeded"
  | "tx_workflow_finished"
  | "tx_workflow_started";

export interface ReplayOperationStepOutput extends ReplayJsonObject {
  all: string;
  content: string;
  exit_code: number | null;
  mode: string;
  operation_summary: string;
  prompt: string | null;
  step_index: number;
  success: boolean;
}

export interface ReplayEvent extends ReplayJsonObject {
  all?: string;
  block_name?: string;
  command?: string;
  committed?: boolean;
  content?: string;
  data?: string;
  device_addr?: string;
  error?: string | null;
  exit_code?: number | null;
  fsm_prompt_after?: string;
  fsm_prompt_before?: string | null;
  hook_name?: string;
  kind: ReplayEventKind;
  local_path?: string;
  mode?: string;
  operation_steps?: ReplayOperationStepOutput[];
  operation_summary?: string;
  output_summary?: string | null;
  prompt?: string;
  prompt_after?: string | null;
  prompt_before?: string | null;
  reason?: string;
  remote_path?: string;
  rollback_attempted?: boolean;
  rollback_succeeded?: boolean;
  state?: string | null;
  step_index?: number | null;
  success?: boolean;
  total_blocks?: number;
  trigger?: string;
  workflow_name?: string;
}

export interface ReplayEntry extends ReplayJsonObject {
  event: ReplayEvent;
  ts_ms: number;
}

export interface ReplayResult {
  context: {
    device_addr: string;
    fsm_prompt: string;
    prompt: string;
  } | null;
  entries: ReplayEntry[];
  output: {
    all: string;
    content: string;
    prompt: string | null;
    success: boolean;
  } | null;
}

export interface ReplayState {
  commandInput: string;
  displayMode: string;
  eventKind: string;
  failedOnly: boolean;
  jsonl: string;
  lastReplayResult: ReplayResult | null;
  listLoading: boolean;
  mode: string;
  runLoading: boolean;
  searchQuery: string;
  statusText: string;
}

export interface ReplayPreferences {
  displayMode: "list" | "raw";
  eventKind: string;
  failedOnly: boolean;
  searchQuery: string;
}

export interface ReplayTransferState {
  jsonl: string;
  version: number;
}

export interface ReplayStatusState {
  text: string;
  version: number;
}

export interface ReplaySyncState {
  status: ReplayStatusState;
  transfer: ReplayTransferState;
}

export interface ReplayModeTab {
  label?: string;
  labelKey?: string;
  value: string;
}

export interface ReplayOption {
  label: string;
  value: string;
}

export interface ReplayInputField {
  ariaLabelText: string;
  labelText?: string;
  placeholder: string;
  value: string;
}

export interface ReplayControlsDisplay {
  clearFiltersLabel: string;
  commandField: ReplayInputField & { labelText: string };
  displayMode: string;
  displayModeLabel: string;
  eventKind: string;
  eventKindLabel: string;
  eventKindOptionRows: ReplayOption[];
  failedOnly: boolean;
  failedOnlyLabel: string;
  jsonlField: ReplayInputField & { labelText: string };
  listButtonLabel: string;
  listLoading: boolean;
  modeField: ReplayInputField & { labelText: string };
  panelTitle: string;
  replayModeTabs: ReplayModeTab[];
  runButtonLabel: string;
  runLoading: boolean;
  searchField: ReplayInputField;
}

export interface ReplayContextRow {
  detailValue: string;
  key: string;
  labelText: string;
}

export interface ReplayStatCard {
  label: string;
  statValue: string;
}

export interface ReplayEventFlowDisplay {
  after: string;
  afterCardClass: string;
  afterLabel: string;
  before: string;
  beforeCardClass: string;
  beforeLabel: string;
  markerDotClass: string;
  markerLineClass: string;
}

export interface ReplayEntryRow {
  commandText: string;
  detailButtonLabel: string;
  entryIndex: number;
  fsmPromptFlow: ReplayEventFlowDisplay;
  indexText: string;
  kindText: string;
  modeText: string;
  promptAfter: string;
  promptBefore: string;
  promptFlow: ReplayEventFlowDisplay;
  rowClass: string;
  showSuccessBadge: boolean;
  showSuccessEmpty: boolean;
  success: boolean;
  successBadgeClass: string;
  successLabelText: string;
}

export interface ReplayTableHeaderCell {
  labelText: string;
}

export interface ReplayResultsDisplay {
  contextTitle: string;
  emptyReplayText: string;
  emptyResultText: string;
  hasReplayContext: boolean;
  hasReplayEntries: boolean;
  hasReplayOutput: boolean;
  hasReplayResult: boolean;
  outputContent: string;
  outputPromptText: string;
  outputStatusClass: string;
  outputStatusLabel: string;
  outputTitle: string;
  rawResultText: string;
  replayContextRows: ReplayContextRow[];
  replayEntryRows: ReplayEntryRow[];
  replayStatCards: ReplayStatCard[];
  replayTableHeaderCells: ReplayTableHeaderCell[];
  showListMode: boolean;
  showRawMode: boolean;
  statusText: string;
}

export interface ReplayPageDisplay {
  controlsDisplay: ReplayControlsDisplay;
  replayEntries: ReplayEntry[];
  resultsDisplay: ReplayResultsDisplay;
}

export interface ReplayRequest {
  command?: string;
  jsonl: string;
  list?: boolean;
  mode?: string | null;
}

export interface ReplayApi {
  replaySession(payload: ReplayRequest): Promise<ReplayResult>;
}

export interface ReplayRuntime {
  loadPreferences(): ReplayPreferences;
  openEntry(entry: ReplayEntry): void;
  replayJsonlTransferState: Readable<ReplayTransferState>;
  replayStatusTextState: Readable<ReplayStatusState>;
  savePreferences(state: ReplayState): void;
}

export interface ReplayWorkspaceOptions {
  api?: Partial<ReplayApi>;
  modeTabs?: readonly ReplayModeTab[];
  runtime?: Partial<ReplayRuntime>;
}

export interface ReplayPageWorkspace {
  destroy(): void;
  replayCommand(): Promise<void>;
  replayDisplayStateStore: Readable<ReplayPageDisplay>;
  replayEntryOpenIndexHandlerStateStore: Readable<(index: number) => void>;
  replayList(): Promise<void>;
  replayResultsDisplayStateStore: Readable<ReplayResultsDisplay>;
  replayStateStore: Writable<ReplayState>;
  resetFilters(): void;
  selectReplayTab(displayMode?: string): void;
  setCommandInput(commandInput?: string): void;
  setEventKind(eventKind?: string): void;
  setFailedOnly(failedOnly?: boolean): void;
  setJsonl(jsonl?: string): void;
  setMode(mode?: string): void;
  setPageContext(context?: { active?: boolean }): void;
  setSearchQuery(searchQuery?: string): void;
}
