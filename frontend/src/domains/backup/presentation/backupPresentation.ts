import { tr } from "../../../lib/i18n.js";
import {
  displayText,
  formatTimestamp,
  statusPresentation,
} from "../../../lib/ui.js";
import {
  backupOperationKey,
  isBackupLoading,
  selectedBackupItem,
} from "../model/backup.js";
import type {
  BackupArchiveRow,
  BackupItem,
  BackupPageDisplay,
  BackupState,
  BackupStatusPresentation,
} from "../model/types.js";

export function formatBackupBytes(value: unknown): string {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function archiveSuggestions(state: BackupState): BackupItem[] {
  const query = state.archiveInput.trim().toLowerCase();
  if (!query) return state.backups;
  return state.backups.filter((item) =>
    String(item.path || "")
      .toLowerCase()
      .includes(query),
  );
}

function selectedMetaText(state: BackupState): string {
  const selected = selectedBackupItem(state);
  if (!selected) return "-";
  return `${tr("backupSelectedMetaLabel", "Selected")}: ${selected.name || "-"} · ${tr(
    "backupMetaSize",
    "Size",
  )}: ${formatBackupBytes(selected.size_bytes)} · ${tr(
    "backupMetaTime",
    "Time",
  )}: ${formatTimestamp(selected.modified_ms)}`;
}

function archiveRow(
  state: BackupState,
  backupItem: BackupItem,
  index: number,
  selected: BackupItem | null,
): BackupArchiveRow {
  const name = backupItem.name || "-";
  const path = backupItem.path || "-";
  const rowSelected = Boolean(
    selected &&
    ((selected.name || "") === (backupItem.name || "") ||
      (selected.path || "") === (backupItem.path || "")),
  );
  return {
    downloadLoading: isBackupLoading(
      state,
      backupOperationKey("download", backupItem),
    ),
    index,
    mergeLoading: isBackupLoading(
      state,
      backupOperationKey("restore-merge", backupItem),
    ),
    name,
    path,
    replaceLoading: isBackupLoading(
      state,
      backupOperationKey("restore-replace", backupItem),
    ),
    rowClass: rowSelected ? "bg-primary/5" : "bg-card hover:bg-muted/30",
    selected: rowSelected,
    showPath: path !== name,
    sizeText: formatBackupBytes(backupItem.size_bytes),
    timeText: formatTimestamp(backupItem.modified_ms),
  };
}

function backupStatus(state: BackupState): BackupStatusPresentation {
  return statusPresentation(
    state.status.message || "-",
    state.status.tone || "info",
    { suppressPassiveLoaded: false },
  ) as BackupStatusPresentation;
}

export function backupPagePresentation(state: BackupState): BackupPageDisplay {
  const selected = selectedBackupItem(state);
  const archiveInputLabelText = tr("backupArchivePlaceholder");
  const outputPathLabelText = tr("backupOutputPlaceholder");
  const backupRows = state.backups.map((item, index) =>
    archiveRow(state, item, index, selected),
  );
  return {
    archiveDisplay: {
      archiveInput: displayText(state.archiveInput),
      archiveInputLabelText,
      archiveOptionValues: archiveSuggestions(state)
        .map((item) => item.path || "")
        .filter(Boolean),
      archivePlaceholder: archiveInputLabelText,
      backupRows,
      downloadButtonLabel: tr("backupDownloadBtn"),
      downloadLoading: isBackupLoading(state, "backup-download"),
      emptyMessage: "-",
      hasBackupRows: backupRows.length > 0,
      listTitle: tr("backupListTitle"),
      metaSizeLabel: tr("backupMetaSize", "Size"),
      metaTimeLabel: tr("backupMetaTime", "Time"),
      restoreMergeButtonLabel: tr("backupRestoreMergeBtn"),
      restoreMergeLoading: isBackupLoading(state, "backup-restore-merge"),
      restoreReplaceButtonLabel: tr("backupRestoreReplaceBtn"),
      restoreReplaceLoading: isBackupLoading(state, "backup-restore-replace"),
      selectedMetaText: selectedMetaText(state),
    },
    createDisplay: {
      createButtonLabel: tr("backupCreateBtn"),
      createLoading: isBackupLoading(state, "backup-create"),
      outputPath: displayText(state.outputPath),
      outputPathLabelText,
      outputPlaceholder: outputPathLabelText,
      refreshButtonLabel: tr("backupRefreshBtn"),
      refreshLoading: isBackupLoading(state, "backup-refresh"),
      status: backupStatus(state),
      title: tr("backupCreateTitle"),
    },
  };
}
