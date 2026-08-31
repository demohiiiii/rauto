import type { Readable, Writable } from "svelte/store";

export interface ReplayEvent {
  all?: unknown;
  command?: unknown;
  content?: unknown;
  device_addr?: unknown;
  fsm_prompt_after?: unknown;
  fsm_prompt_before?: unknown;
  kind?: unknown;
  mode?: unknown;
  prompt_after?: unknown;
  prompt_before?: unknown;
  reason?: unknown;
  success?: boolean;
  [key: string]: unknown;
}

export interface ReplayEntry {
  event?: ReplayEvent | null;
  [key: string]: unknown;
}

export interface ReplayResult {
  context?: {
    device_addr?: unknown;
    fsm_prompt?: unknown;
    prompt?: unknown;
    [key: string]: unknown;
  } | null;
  entries?: ReplayEntry[] | null;
  output?: {
    content?: unknown;
    prompt?: unknown;
    success?: boolean;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
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
  replayEntryRows: unknown[];
  replayStatCards: ReplayStatCard[];
  replayTableHeaderCells: unknown[];
  showListMode: boolean;
  showRawMode: boolean;
  statusText: string;
}

export interface ReplayPageDisplay {
  controlsDisplay: ReplayControlsDisplay;
  replayEntries: ReplayEntry[];
  resultsDisplay: ReplayResultsDisplay;
}

export interface ReplayApi {
  replaySession(payload: {
    command?: string;
    jsonl: string;
    list?: boolean;
    mode?: string | null;
  }): Promise<ReplayResult>;
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
  replayCommand(): Promise<unknown>;
  replayDisplayStateStore: Readable<ReplayPageDisplay>;
  replayEntryOpenIndexHandlerStateStore: Readable<(index: number) => void>;
  replayList(): Promise<unknown>;
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
