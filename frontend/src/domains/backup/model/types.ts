import type { Readable, Writable } from "svelte/store";

export type BackupStatusTone =
  | "error"
  | "info"
  | "running"
  | "success"
  | "warning";
export type BackupRestoreOperation = "restore-merge" | "restore-replace";
export type BackupRowOperation = "download" | BackupRestoreOperation;

export interface BackupStatus {
  message: string;
  tone: BackupStatusTone;
}

export interface BackupItem {
  modified_ms: number;
  name: string;
  path: string;
  size_bytes: number;
}

export interface BackupCreateResponse {
  path: string;
}

export interface BackupRestoreResponse {
  archive: string;
  replace: boolean;
  restored: boolean;
}

export interface BackupState {
  archiveInput: string;
  backups: BackupItem[];
  loadingKeys: string[];
  outputPath: string;
  status: BackupStatus;
}

export interface BackupArchiveRow {
  downloadLoading: boolean;
  index: number;
  mergeLoading: boolean;
  name: string;
  path: string;
  replaceLoading: boolean;
  rowClass: string;
  selected: boolean;
  showPath: boolean;
  sizeText: string;
  timeText: string;
}

export interface BackupStatusPresentation {
  inlineMessage: string;
  shouldToast: boolean;
  text: string;
  tone: BackupStatusTone;
}

export interface BackupArchiveDisplay {
  archiveInput: string;
  archiveInputLabelText: string;
  archiveOptionValues: string[];
  archivePlaceholder: string;
  backupRows: BackupArchiveRow[];
  downloadButtonLabel: string;
  downloadLoading: boolean;
  emptyMessage: string;
  hasBackupRows: boolean;
  listTitle: string;
  metaSizeLabel: string;
  metaTimeLabel: string;
  restoreMergeButtonLabel: string;
  restoreMergeLoading: boolean;
  restoreReplaceButtonLabel: string;
  restoreReplaceLoading: boolean;
  selectedMetaText: string;
}

export interface BackupCreateDisplay {
  createButtonLabel: string;
  createLoading: boolean;
  outputPath: string;
  outputPathLabelText: string;
  outputPlaceholder: string;
  refreshButtonLabel: string;
  refreshLoading: boolean;
  status: BackupStatusPresentation;
  title: string;
}

export interface BackupPageDisplay {
  archiveDisplay: BackupArchiveDisplay;
  createDisplay: BackupCreateDisplay;
}

export interface BackupRowOperationRequest {
  backupItem: BackupItem;
  loadingKey: string;
  replace?: boolean;
  type: "download" | "restore";
}

export interface BackupBlobPayload {
  blob: Blob;
  filename: string;
}

export interface BackupApi {
  createBackup(): Promise<BackupCreateResponse>;
  downloadBackupBlob(name: string): Promise<BackupBlobPayload>;
  listBackups(): Promise<BackupItem[]>;
  restoreBackup(
    archive: string,
    replace?: boolean,
  ): Promise<BackupRestoreResponse>;
}

export interface BackupRuntime {
  confirmRestore(message: string): boolean;
  download(blob: Blob, filename: string): void;
  onRestored(): Promise<void>;
  stopEventPropagation(event: Event | null | undefined): void;
}

export interface BackupWorkspaceOptions {
  api?: Partial<BackupApi>;
  runtime?: Partial<BackupRuntime>;
}

export interface BackupPageWorkspace {
  backupDisplayStateStore: Readable<BackupPageDisplay>;
  backupStateStore: Writable<BackupState>;
  createBackup(): Promise<void>;
  destroy(): void;
  downloadBackupRow(index?: number): (event: Event) => Promise<void>;
  downloadSelectedBackup(): Promise<void>;
  refreshBackups(): Promise<void>;
  restoreBackupMerge(): Promise<void>;
  restoreBackupReplace(): Promise<void>;
  restoreBackupRowMerge(index?: number): (event: Event) => Promise<void>;
  restoreBackupRowReplace(index?: number): (event: Event) => Promise<void>;
  selectBackupRow(index?: number): () => void;
  setPageContext(context?: { active?: boolean }): Promise<void>;
  updateArchiveInput(value?: string): void;
  updateOutputPath(value?: string): void;
}
