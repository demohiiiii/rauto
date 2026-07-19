import {
  createBackup,
  downloadBackupBlob,
  listBackups,
  restoreBackup,
} from "../../api/client.js";
import { stopEventPropagation } from "../../lib/events.js";
import { createLoadingRunner } from "../../lib/svelte.js";
import {
  classNames,
  confirmUserChoice,
  displayText,
  downloadBlob,
  formatTimestamp,
  statusPresentation,
} from "../../lib/ui.js";
import { currentLanguageState, tr } from "../../lib/i18n.js";
import { derived, get as getStore, writable } from "svelte/store";
import { refreshProtectedDashboardResources } from "../dashboard/dashboardApp.js";

function createBackupState() {
  return {
    archiveInput: "",
    backups: [],
    loadingKeys: [],
    outputPath: "",
    status: { message: "-", tone: "info" },
  };
}

const normalizeBackupItems = (backupItemsPayload) =>
  Array.isArray(backupItemsPayload) ? backupItemsPayload : [];

function formatBackupBytes(byteValue) {
  const bytes = Number(byteValue || 0);
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

function selectedBackupFromInput(backupItems, rawInput) {
  const raw = String(rawInput || "").trim();
  if (!raw) return null;
  const tail = raw.split("/").pop();
  if (!tail) return null;
  const matchesRaw = (backupItem) =>
    (backupItem.path || "") === raw || (backupItem.name || "") === raw;
  const matchesTail = (backupItem) => (backupItem.name || "") === tail;
  return backupItems.find(matchesRaw) || backupItems.find(matchesTail) || null;
}

function backupArchiveSuggestions(backup = {}) {
  const q = `${backup.archiveInput || ""}`.trim().toLowerCase();
  const backups = normalizeBackupItems(backup.backups);
  if (!q) return backups;
  return backups.filter((backupItem) =>
    String(backupItem.path || "")
      .toLowerCase()
      .includes(q),
  );
}

function backupSelectedItem(backup = {}) {
  return selectedBackupFromInput(
    normalizeBackupItems(backup.backups),
    backup.archiveInput || "",
  );
}

function selectedBackupName(backup = {}) {
  const selected = backupSelectedItem(backup);
  if (selected?.name) return selected.name;
  return `${backup.archiveInput || ""}`.trim().split("/").pop() || "";
}

function backupSelectedMetaText(backup = {}) {
  const selected = backupSelectedItem(backup);
  if (!selected) return "-";
  return `${tr("backupSelectedMetaLabel", "Selected")}: ${selected.name || "-"} · ${tr(
    "backupMetaSize",
    "Size",
  )}: ${formatBackupBytes(selected.size_bytes)} · ${tr(
    "backupMetaTime",
    "Time",
  )}: ${formatTimestamp(selected.modified_ms)}`;
}

function isBackupLoading(backup = {}, key = "") {
  return Array.isArray(backup.loadingKeys) && backup.loadingKeys.includes(key);
}

function backupArchiveRow(backup, backupItem, index, selected) {
  const rowSelected =
    selected &&
    ((selected.name || "") === (backupItem.name || "") ||
      (selected.path || "") === (backupItem.path || ""));
  const downloadKey = backupOperationKey("download", backupItem);
  const mergeKey = backupOperationKey("restore-merge", backupItem);
  const replaceKey = backupOperationKey("restore-replace", backupItem);
  return {
    downloadLoading: isBackupLoading(backup, downloadKey),
    index,
    mergeLoading: isBackupLoading(backup, mergeKey),
    name: backupItem.name || "-",
    path: backupItem.path || "-",
    replaceLoading: isBackupLoading(backup, replaceKey),
    rowClass: classNames(
      "w-full rounded-xl border px-3 py-2 text-left transition",
      rowSelected
        ? "border-teal-300 bg-teal-50/70"
        : "border-slate-200 bg-white hover:border-slate-300",
    ),
    sizeText: formatBackupBytes(backupItem.size_bytes),
    timeText: formatTimestamp(backupItem.modified_ms),
  };
}

function backupArchivePresentation(backup = {}) {
  const selected = backupSelectedItem(backup);
  const archiveInputLabelText = tr("backupArchivePlaceholder");
  const backupRows = normalizeBackupItems(backup.backups).map(
    (backupItem, index) =>
      backupArchiveRow(backup, backupItem, index, selected),
  );
  return {
    archiveInput: displayText(backup.archiveInput),
    archiveInputLabelText,
    archiveOptionValues: backupArchiveSuggestions(backup)
      .map((backupItem) => backupItem.path || "")
      .filter(Boolean),
    archivePlaceholder: archiveInputLabelText,
    backupRows,
    downloadButtonLabel: tr("backupDownloadBtn"),
    downloadLoading: isBackupLoading(backup, "backup-download"),
    emptyMessage: "-",
    hasBackupRows: backupRows.length > 0,
    listTitle: tr("backupListTitle"),
    metaTimeLabel: tr("backupMetaTime", "Time"),
    restoreMergeButtonLabel: tr("backupRestoreMergeBtn"),
    restoreMergeLoading: isBackupLoading(backup, "backup-restore-merge"),
    restoreReplaceButtonLabel: tr("backupRestoreReplaceBtn"),
    restoreReplaceLoading: isBackupLoading(backup, "backup-restore-replace"),
    selectedMetaText: backupSelectedMetaText(backup),
  };
}

function backupStatusPresentation(backup = {}) {
  const status = backup.status || {};
  return statusPresentation(status.message || "-", status.tone || "info", {
    suppressPassiveLoaded: false,
  });
}

function backupCreatePresentation(backup = {}) {
  const outputPathLabelText = tr("backupOutputPlaceholder");
  return {
    createButtonLabel: tr("backupCreateBtn"),
    createLoading: isBackupLoading(backup, "backup-create"),
    outputPath: displayText(backup.outputPath),
    outputPathLabelText,
    outputPlaceholder: outputPathLabelText,
    refreshButtonLabel: tr("backupRefreshBtn"),
    refreshLoading: isBackupLoading(backup, "backup-refresh"),
    status: backupStatusPresentation(backup),
    title: tr("backupCreateTitle"),
  };
}

const backupPageDisplay = (backup = {}) => ({
  archiveDisplay: backupArchivePresentation(backup),
  createDisplay: backupCreatePresentation(backup),
});

function backupOperationKey(operation, backupItem = null) {
  const suffix =
    backupItem && typeof backupItem === "object"
      ? backupItem.path || backupItem.name || ""
      : "";
  return suffix ? `${operation}:${suffix}` : operation;
}

function setBackupLoadingKeys(backup = {}, keys = []) {
  backup.loadingKeys = Array.isArray(keys) ? keys : [];
}

function updateBackupState(backupStateStore, backupMutation) {
  const backupState = getStore(backupStateStore);
  backupMutation(backupState);
  backupStateStore.set(backupState);
}

async function runBackupMutation(backupStateStore, backupMutation) {
  const backupState = getStore(backupStateStore);
  const backupMutationPromise = backupMutation(backupState);
  backupStateStore.set(backupState);
  await backupMutationPromise;
  backupStateStore.set(backupState);
}

function setBackupStatus(backup = {}, message, tone = "info") {
  backup.status = { message: message || "-", tone };
}

function setBackupArchiveInput(backup = {}, archiveInput = "") {
  backup.archiveInput = archiveInput || "";
}
function setBackupOutputPath(backup = {}, outputPath = "") {
  backup.outputPath = outputPath || "";
}
function selectBackupItem(backup = {}, backupItem = null) {
  const selectedPath = backupItem?.path || "";
  if (!selectedPath) return false;
  setBackupArchiveInput(backup, selectedPath);
  return true;
}
function selectBackupItemByIndex(backup = {}, index = 0) {
  return selectBackupItem(
    backup,
    normalizeBackupItems(backup.backups)[index] || null,
  );
}
function backupArchiveRowOperationRequest(
  backup = {},
  index = 0,
  operation = "",
) {
  const backupItem = normalizeBackupItems(backup.backups)[index] || null;
  if (!backupItem) return null;
  if (operation === "download") {
    return {
      backupItem,
      loadingKey: backupOperationKey("download", backupItem),
      type: "download",
    };
  }
  if (operation === "restore-merge" || operation === "restore-replace") {
    return {
      backupItem,
      loadingKey: backupOperationKey(operation, backupItem),
      replace: operation === "restore-replace",
      type: "restore",
    };
  }
  return null;
}

function backupRowDownloadLoadingKey(backup = {}, index = 0) {
  const request = backupArchiveRowOperationRequest(backup, index, "download");
  return request ? request.loadingKey : "download";
}

function backupRowRestoreMergeLoadingKey(backup = {}, index = 0) {
  const request = backupArchiveRowOperationRequest(
    backup,
    index,
    "restore-merge",
  );
  return request ? request.loadingKey : "restore-merge";
}

function backupRowRestoreReplaceLoadingKey(backup = {}, index = 0) {
  const request = backupArchiveRowOperationRequest(
    backup,
    index,
    "restore-replace",
  );
  return request ? request.loadingKey : "restore-replace";
}

async function loadBackups(backup = {}) {
  try {
    backup.backups = normalizeBackupItems(await listBackups());
  } catch (error) {
    backup.backups = [];
    setBackupStatus(backup, error.message, "error");
  }
}

async function createBackupArchive(backup = {}) {
  setBackupStatus(backup, tr("running", "running"), "running");
  try {
    const backupPayload = await createBackup(backup.outputPath);
    const path = backupPayload?.path || "-";
    setBackupStatus(
      backup,
      `${tr("backupCreated", "Backup created")}: ${path}`,
      "success",
    );
    if (path && path !== "-") setBackupArchiveInput(backup, path);
    await loadBackups(backup);
  } catch (error) {
    setBackupStatus(backup, error.message, "error");
  }
}

async function selectedBackupDownloadBlob(backup = {}) {
  const name = selectedBackupName(backup);
  if (!name) {
    setBackupStatus(
      backup,
      tr("backupPickOne", "pick a backup first"),
      "error",
    );
    return null;
  }
  try {
    const backupBlobPayload = await downloadBackupBlob(name);
    return {
      blob: backupBlobPayload.blob,
      filename: backupBlobPayload.filename || name,
    };
  } catch (error) {
    setBackupStatus(backup, error.message, "error");
    return null;
  }
}

async function downloadSelectedBackupArchive(backup = {}) {
  const backupBlob = await selectedBackupDownloadBlob(backup);
  if (!backupBlob) return;
  downloadBlob(backupBlob.blob, backupBlob.filename);
}

async function restoreBackupArchive(
  backup = {},
  replace,
  {
    confirmRestore = confirmUserChoice,
    onRestored = refreshProtectedDashboardResources,
  } = {},
) {
  const archive = String(backup.archiveInput || "").trim();
  if (!archive) {
    setBackupStatus(
      backup,
      tr("backupArchiveRequired", "backup archive is required"),
      "error",
    );
    return;
  }
  const confirmText = replace
    ? tr("backupRestoreConfirmReplace", "Restore and replace current data?")
    : tr("backupRestoreConfirmMerge", "Restore and merge into current data?");
  if (!confirmRestore(confirmText)) return;
  setBackupStatus(backup, tr("running", "running"), "running");
  try {
    const restorePayload = await restoreBackup(archive, replace);
    setBackupStatus(
      backup,
      `${tr("backupRestored", "Backup restored")}: ${
        restorePayload.archive || archive
      }`,
      "success",
    );
    await loadBackups(backup);
    await onRestored();
  } catch (error) {
    setBackupStatus(backup, error.message, "error");
  }
}

const restoreBackupArchiveMerge = (backup = {}) =>
  restoreBackupArchive(backup, false);
const restoreBackupArchiveReplace = (backup = {}) =>
  restoreBackupArchive(backup, true);

function downloadBackupArchiveRow(backup = {}, index = 0) {
  if (!selectBackupItemByIndex(backup, index)) return null;
  return downloadSelectedBackupArchive(backup);
}

function restoreBackupArchiveRowMerge(backup = {}, index = 0) {
  if (!selectBackupItemByIndex(backup, index)) return null;
  return restoreBackupArchiveMerge(backup);
}

function restoreBackupArchiveRowReplace(backup = {}, index = 0) {
  if (!selectBackupItemByIndex(backup, index)) return null;
  return restoreBackupArchiveReplace(backup);
}

export function createBackupPageWorkspace() {
  const backupStateStore = writable(createBackupState());
  const backupDisplayStateStore = derived(
    [backupStateStore, currentLanguageState],
    ([$backupStateStore, _currentLanguageState]) =>
      backupPageDisplay($backupStateStore),
  );
  let didInitialLoad = false;

  const backupLoadingRunner = createLoadingRunner(
    () => getStore(backupStateStore).loadingKeys,
    (nextKeys) => {
      updateBackupState(backupStateStore, (backupState) => {
        setBackupLoadingKeys(backupState, nextKeys);
      });
    },
  );

  function runBackupLoading(loadingKey, backupAction) {
    return runBackupMutation(backupStateStore, (backupState) =>
      backupLoadingRunner.run(loadingKey, () => backupAction(backupState)),
    );
  }

  async function setPageContext({ active = false } = {}) {
    if (!active) {
      didInitialLoad = false;
      return;
    }
    if (didInitialLoad) return;
    didInitialLoad = true;
    await runBackupMutation(backupStateStore, loadBackups);
  }

  function updateArchiveInput(archiveInput = "") {
    updateBackupState(backupStateStore, (backupState) => {
      setBackupArchiveInput(backupState, archiveInput);
    });
  }

  function updateOutputPath(outputPath = "") {
    updateBackupState(backupStateStore, (backupState) => {
      setBackupOutputPath(backupState, outputPath);
    });
  }

  function createBackup() {
    return runBackupLoading("backup-create", createBackupArchive);
  }

  function refreshBackups() {
    return runBackupLoading("backup-refresh", loadBackups);
  }

  function downloadSelectedBackup() {
    return runBackupLoading("backup-download", downloadSelectedBackupArchive);
  }

  function restoreBackupMerge() {
    return runBackupLoading("backup-restore-merge", restoreBackupArchiveMerge);
  }

  function restoreBackupReplace() {
    return runBackupLoading(
      "backup-restore-replace",
      restoreBackupArchiveReplace,
    );
  }

  function selectBackupRow(backupRowIndex = 0) {
    return () => {
      updateBackupState(backupStateStore, (backupState) => {
        selectBackupItemByIndex(backupState, backupRowIndex);
      });
    };
  }

  function downloadBackupRow(backupRowIndex = 0) {
    return (event) => {
      stopEventPropagation(event);
      return runBackupLoading(
        backupRowDownloadLoadingKey(getStore(backupStateStore), backupRowIndex),
        (backupState) => downloadBackupArchiveRow(backupState, backupRowIndex),
      );
    };
  }

  function restoreBackupRowMerge(backupRowIndex = 0) {
    return (event) => {
      stopEventPropagation(event);
      return runBackupLoading(
        backupRowRestoreMergeLoadingKey(
          getStore(backupStateStore),
          backupRowIndex,
        ),
        (backupState) =>
          restoreBackupArchiveRowMerge(backupState, backupRowIndex),
      );
    };
  }

  function restoreBackupRowReplace(backupRowIndex = 0) {
    return (event) => {
      stopEventPropagation(event);
      return runBackupLoading(
        backupRowRestoreReplaceLoadingKey(
          getStore(backupStateStore),
          backupRowIndex,
        ),
        (backupState) =>
          restoreBackupArchiveRowReplace(backupState, backupRowIndex),
      );
    };
  }

  function destroy() {
    didInitialLoad = false;
    backupStateStore.set(createBackupState());
  }

  return {
    backupStateStore,
    backupDisplayStateStore,
    createBackup,
    destroy,
    downloadBackupRow,
    downloadSelectedBackup,
    refreshBackups,
    restoreBackupMerge,
    restoreBackupReplace,
    restoreBackupRowMerge,
    restoreBackupRowReplace,
    selectBackupRow,
    setPageContext,
    updateArchiveInput,
    updateOutputPath,
  };
}
