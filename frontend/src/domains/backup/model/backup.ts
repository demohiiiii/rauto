import type {
  BackupItem,
  BackupRowOperation,
  BackupRowOperationRequest,
  BackupState,
  BackupStatusTone,
} from "./types.js";

export function newBackupState(): BackupState {
  return {
    archiveInput: "",
    backups: [],
    loadingKeys: [],
    outputPath: "",
    status: { message: "-", tone: "info" },
  };
}

export function normalizeBackupItems(value: unknown): BackupItem[] {
  return Array.isArray(value) ? (value as BackupItem[]) : [];
}

export function selectedBackupFromInput(
  backupItems: readonly BackupItem[] = [],
  rawInput: unknown = "",
): BackupItem | null {
  const raw = String(rawInput || "").trim();
  if (!raw) return null;
  const tail = raw.split("/").pop();
  if (!tail) return null;
  const matchesRaw = (item: BackupItem) =>
    (item.path || "") === raw || (item.name || "") === raw;
  const matchesTail = (item: BackupItem) => (item.name || "") === tail;
  return backupItems.find(matchesRaw) || backupItems.find(matchesTail) || null;
}

export function selectedBackupItem(state: BackupState): BackupItem | null {
  return selectedBackupFromInput(state.backups, state.archiveInput);
}

export function selectedBackupName(state: BackupState): string {
  const selected = selectedBackupItem(state);
  if (selected?.name) return selected.name;
  return state.archiveInput.trim().split("/").pop() || "";
}

export function backupOperationKey(
  operation: string,
  backupItem: BackupItem | null = null,
): string {
  const suffix = backupItem?.path || backupItem?.name || "";
  return suffix ? `${operation}:${suffix}` : operation;
}

export function isBackupLoading(state: BackupState, key: string): boolean {
  return state.loadingKeys.includes(key);
}

export function setBackupStatus(
  state: BackupState,
  message: unknown,
  tone: BackupStatusTone = "info",
): void {
  state.status = { message: String(message || "-"), tone };
}

export function setBackupArchiveInput(
  state: BackupState,
  archiveInput: unknown = "",
): void {
  state.archiveInput = String(archiveInput || "");
}

export function setBackupOutputPath(
  state: BackupState,
  outputPath: unknown = "",
): void {
  state.outputPath = String(outputPath || "");
}

export function selectBackupItem(
  state: BackupState,
  backupItem: BackupItem | null = null,
): boolean {
  const selectedPath = backupItem?.path || "";
  if (!selectedPath) return false;
  setBackupArchiveInput(state, selectedPath);
  return true;
}

export function selectBackupItemByIndex(
  state: BackupState,
  index = 0,
): boolean {
  return selectBackupItem(state, state.backups[index] || null);
}

export function backupArchiveRowOperationRequest(
  state: BackupState,
  index = 0,
  operation: BackupRowOperation,
): BackupRowOperationRequest | null {
  const backupItem = state.backups[index] || null;
  if (!backupItem) return null;
  if (operation === "download") {
    return {
      backupItem,
      loadingKey: backupOperationKey("download", backupItem),
      type: "download",
    };
  }
  return {
    backupItem,
    loadingKey: backupOperationKey(operation, backupItem),
    replace: operation === "restore-replace",
    type: "restore",
  };
}
