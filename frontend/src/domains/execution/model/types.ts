export interface SessionRetryState {
  enabled: boolean;
  initialBackoffMs: string;
  maxBackoffMs: string;
  maxRetries: string;
  retryAuthenticationErrors: boolean;
  [key: string]: unknown;
}

export interface SessionRetryPayload {
  initial_backoff_ms: number;
  max_backoff_ms: number;
  max_retries: number;
  retry_authentication_errors: boolean;
}

export type SessionRetryValidation =
  | { errorKey: ""; valid: true; value?: SessionRetryPayload }
  | { errorKey: string; valid: false };

export interface ParsedOutputSheet extends Record<string, unknown> {
  name: string;
  parsed_output: unknown;
}

export interface TextfsmExcelExportPayload {
  filename?: string;
  parsed_output?: unknown;
  sheet_name?: string;
  sheets?: ParsedOutputSheet[];
}

export interface ParsedOutputSheetConfig {
  sheetName?(item: Record<string, unknown>, index: number): unknown;
}

export interface ParsedOutputCellRow {
  cells: string[];
}

export interface ParsedOutputBlockDisplay {
  canExport: boolean;
  exportItem: unknown;
  hasParsedOutput: boolean;
  hasParseError: boolean;
  jsonOutput: string;
  parseErrorText: string;
  showEmptyColumns: boolean;
  showEmptyRows: boolean;
  showJson: boolean;
  showTable: boolean;
  tableColumns: string[];
  tableRows: ParsedOutputCellRow[];
}

export interface ExecutionResultDisplay {
  kind: string;
  resultPayload: Record<string, unknown> | null;
  statusMessage: string;
  statusTone: "error" | "info" | "running";
}

export interface ExecutionResultApi {
  exportExcel(payload: TextfsmExcelExportPayload): Promise<{
    blob: Blob;
    filename?: string;
  }>;
}

export interface ExecutionResultRuntime {
  deviceName(): string;
  download(blob: Blob, filename: string): void;
  notifyError(message: unknown): Promise<unknown>;
}

export interface ExportParsedOutputConfig {
  filename?: unknown;
}
