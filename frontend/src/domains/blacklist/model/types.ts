import type { Readable, Writable } from "svelte/store";

export type BlacklistStatusTone =
  | "error"
  | "info"
  | "running"
  | "success"
  | "warning";

export interface BlacklistStatus {
  message: string;
  tone: BlacklistStatusTone;
}

export interface BlacklistPatternEntry {
  pattern: string;
}

export interface BlacklistCheckResult {
  blocked: boolean;
  command: string;
  pattern?: string | null;
}

export interface BlacklistState {
  checkError: string;
  checkResult: BlacklistCheckResult | null;
  commandInput: string;
  listError: string;
  patternInput: string;
  patterns: string[];
  status: BlacklistStatus;
}

export interface BlacklistInputField {
  ariaLabelText: string;
  placeholder: string;
  value: string;
}

export interface BlacklistPatternRow {
  deleteValue: string;
  patternClass: string;
  patternText: string;
  rowClass: string;
}

export interface BlacklistCheckDisplay {
  checkBlocked: boolean;
  checkButtonLabel: string;
  checkError: string;
  checkedCommand: string;
  checkedCommandLabel: string;
  commandField: BlacklistInputField;
  errorStatus: { tone: "error" };
  hasCheckResult: boolean;
  matchedPattern: string;
  matchedPatternLabel: string;
  placeholder: string;
  resultAllowedLabel: string;
  resultBlockedLabel: string;
  showAllowed: boolean;
  showBlocked: boolean;
  showError: boolean;
  showPlaceholder: boolean;
  title: string;
}

export interface BlacklistPatternListDisplay {
  addButtonLabel: string;
  addTitle: string;
  blacklistPatternRows: BlacklistPatternRow[];
  deleteButtonLabel: string;
  emptyMessage: string;
  errorMessage: string;
  errorStatus: { tone: "error" };
  fileHint: string;
  hasError: boolean;
  isEmpty: boolean;
  patternField: BlacklistInputField;
  patternHint: string;
  refreshButtonLabel: string;
  title: string;
}

export interface BlacklistStatusDisplay {
  inlineMessage: string;
  shouldToast: boolean;
  text: string;
  tone: BlacklistStatusTone;
}

export interface BlacklistPageDisplay {
  checkDisplay: BlacklistCheckDisplay;
  patternDisplay: BlacklistPatternListDisplay;
  statusDisplay: BlacklistStatusDisplay;
}

export interface BlacklistUpsertResponse {
  added: boolean;
  path?: string;
  pattern: string;
}

export interface BlacklistDeleteResponse {
  deleted: boolean;
  pattern: string;
}

export interface BlacklistApi {
  addPattern(pattern: string): Promise<BlacklistUpsertResponse>;
  checkCommand(command: string): Promise<BlacklistCheckResult>;
  deletePattern(pattern: string): Promise<BlacklistDeleteResponse>;
  listPatterns(): Promise<BlacklistPatternEntry[]>;
}

export interface BlacklistRuntime {
  confirmDelete(message: string): boolean;
}

export interface BlacklistWorkspaceOptions {
  api?: Partial<BlacklistApi>;
  runtime?: Partial<BlacklistRuntime>;
}

export interface BlacklistPageWorkspace {
  blacklistDisplayStateStore: Readable<BlacklistPageDisplay>;
  blacklistStateStore: Writable<BlacklistState>;
  addPattern(): Promise<unknown>;
  checkCommand(): Promise<unknown>;
  deletePattern(pattern?: string): Promise<unknown>;
  refreshPatterns(): Promise<unknown>;
  setPageContext(context?: { active?: boolean }): Promise<unknown> | undefined;
  updateCommandInput(commandInput?: string): void;
  updatePatternInput(patternInput?: string): void;
}
