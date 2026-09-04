import type { Readable, Writable } from "svelte/store";
import type { ConnectionRequestPayload } from "$domains/connections/index.js";

export type TransferStatusTone =
  | "error"
  | "info"
  | "running"
  | "success"
  | "warning";

export interface TransferStatus {
  message: string;
  tone: TransferStatusTone;
}

export interface TransferState {
  bufferSize: string;
  localPath: string;
  remotePath: string;
  showProgress: boolean;
  status: TransferStatus | null;
  timeoutSecs: string;
  uploadLoading: boolean;
}

export type TransferConnectionPayload = ConnectionRequestPayload;
export type TransferRecordLevel = "full" | "key-events-only";
export type TransferJsonValue =
  | boolean
  | number
  | string
  | null
  | TransferJsonValue[]
  | { [key: string]: TransferJsonValue };

export interface TransferResultSummary {
  counts?: {
    failed: number;
    skipped?: number;
    succeeded: number;
    total: number;
  };
  details?: TransferJsonValue;
  operation: string;
  outcome: string;
  recording_available?: boolean;
  success: boolean;
  summary: string;
}

export interface TransferUploadPayload {
  buffer_size: number | null;
  connection: TransferConnectionPayload;
  local_path: string;
  record_level: TransferRecordLevel;
  remote_path: string;
  show_progress: boolean;
  timeout_secs: number;
}

export interface TransferUploadResult {
  local_path: string;
  ok: boolean;
  recording_jsonl: string | null;
  remote_path: string;
  result_summary: TransferResultSummary;
}

export interface TransferInputFieldDisplay {
  ariaLabelText: string;
  placeholder: string;
  value: string;
}

export interface TransferUploadDisplay {
  transferUploadCardDisplay: {
    hint: string;
    title: string;
  };
  transferUploadInputFields: {
    bufferSize: TransferInputFieldDisplay;
    localPath: TransferInputFieldDisplay;
    remotePath: TransferInputFieldDisplay;
    showProgress: boolean;
    showProgressLabel: string;
    timeoutSecs: TransferInputFieldDisplay;
  };
  transferUploadRunButtonDisplay: {
    uploadButtonLabel: string;
    uploadLoading: boolean;
  };
  transferUploadStatusDisplay: {
    showStatus: boolean;
    statusText: string;
    statusTone: TransferStatusTone;
  };
}

export interface TransferApi {
  executeUpload(payload: TransferUploadPayload): Promise<TransferUploadResult>;
}

export interface TransferRuntime {
  applyRecording(result: TransferUploadResult): void;
  connectionPayload(): TransferConnectionPayload;
  ensureConnectionTargetSelected(): boolean;
  recordLevelPayload(): TransferRecordLevel;
}

export interface TransferWorkspaceOptions {
  api?: Partial<TransferApi>;
  runtime?: Partial<TransferRuntime>;
}

export interface TransferPageWorkspace {
  runUpload(): Promise<TransferUploadResult | null | undefined>;
  transferStateStore: Writable<TransferState>;
  transferUploadDisplayStateStore: Readable<TransferUploadDisplay>;
  updateBufferSize(bufferSize?: string): void;
  updateLocalPath(localPath?: string): void;
  updateRemotePath(remotePath?: string): void;
  updateShowProgress(showProgress?: boolean): void;
  updateTimeoutSecs(timeoutSecs?: string): void;
}
