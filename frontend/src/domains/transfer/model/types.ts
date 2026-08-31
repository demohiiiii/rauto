import type { Readable, Writable } from "svelte/store";

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

export interface TransferConnectionPayload {
  [key: string]: unknown;
}

export interface TransferUploadPayload {
  buffer_size: number | null;
  connection: TransferConnectionPayload;
  local_path: string;
  record_level: string;
  remote_path: string;
  show_progress: boolean;
  timeout_secs: number;
}

export interface TransferUploadResult {
  local_path?: string | null;
  ok?: boolean;
  recording_jsonl?: string | null;
  remote_path?: string | null;
  [key: string]: unknown;
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
  recordLevelPayload(): string;
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
