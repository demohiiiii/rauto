import { derived, get, writable } from "svelte/store";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import { backupApi } from "../infrastructure/backupApi.js";
import { backupRuntime } from "../infrastructure/backupRuntime.js";
import {
  backupArchiveRowOperationRequest,
  newBackupState,
  normalizeBackupItems,
  selectBackupItem,
  selectBackupItemByIndex,
  selectedBackupName,
  setBackupArchiveInput,
  setBackupOutputPath,
  setBackupStatus,
} from "../model/backup.js";
import type {
  BackupApi,
  BackupPageWorkspace,
  BackupRestoreOperation,
  BackupRuntime,
  BackupState,
  BackupWorkspaceOptions,
} from "../model/types.js";
import { backupPagePresentation } from "../presentation/backupPresentation.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createBackupPageWorkspace(
  options: BackupWorkspaceOptions = {},
): BackupPageWorkspace {
  const api = Object.assign({}, backupApi, options.api) as BackupApi;
  const runtime = Object.assign(
    {},
    backupRuntime,
    options.runtime,
  ) as BackupRuntime;
  const backupStateStore = writable<BackupState>(newBackupState());
  const backupDisplayStateStore = derived(
    [backupStateStore, currentLanguageState],
    ([$state]) => backupPagePresentation($state),
  );
  let didInitialLoad = false;

  function updateState(mutation: (state: BackupState) => void): void {
    const state = get(backupStateStore);
    mutation(state);
    backupStateStore.set(state);
  }

  async function runMutation(
    mutation: (state: BackupState) => unknown | Promise<unknown>,
  ): Promise<unknown> {
    const state = get(backupStateStore);
    const result = mutation(state);
    backupStateStore.set(state);
    const resolved = await result;
    backupStateStore.set(state);
    return resolved;
  }

  async function runLoading(
    loadingKey: string,
    action: (state: BackupState) => unknown | Promise<unknown>,
  ): Promise<unknown> {
    if (get(backupStateStore).loadingKeys.includes(loadingKey)) return;
    updateState((state) => {
      state.loadingKeys = [...state.loadingKeys, loadingKey];
    });
    try {
      return await runMutation(action);
    } finally {
      updateState((state) => {
        state.loadingKeys = state.loadingKeys.filter(
          (key) => key !== loadingKey,
        );
      });
    }
  }

  async function loadBackups(state: BackupState): Promise<void> {
    try {
      state.backups = normalizeBackupItems(await api.listBackups());
    } catch (error) {
      state.backups = [];
      setBackupStatus(state, errorMessage(error), "error");
    }
  }

  async function createBackupArchive(state: BackupState): Promise<void> {
    setBackupStatus(state, tr("running", "running"), "running");
    try {
      const payload = await api.createBackup();
      const path = payload?.path || "-";
      setBackupStatus(
        state,
        `${tr("backupCreated", "Backup created")}: ${path}`,
        "success",
      );
      if (path !== "-") setBackupArchiveInput(state, path);
      await loadBackups(state);
    } catch (error) {
      setBackupStatus(state, errorMessage(error), "error");
    }
  }

  async function downloadSelectedBackupArchive(
    state: BackupState,
  ): Promise<void> {
    const name = selectedBackupName(state);
    if (!name) {
      setBackupStatus(
        state,
        tr("backupPickOne", "pick a backup first"),
        "error",
      );
      return;
    }
    try {
      const payload = await api.downloadBackupBlob(name);
      runtime.download(payload.blob, payload.filename || name);
    } catch (error) {
      setBackupStatus(state, errorMessage(error), "error");
    }
  }

  async function restoreBackupArchive(
    state: BackupState,
    replace: boolean,
  ): Promise<void> {
    const archive = state.archiveInput.trim();
    if (!archive) {
      setBackupStatus(
        state,
        tr("backupArchiveRequired", "backup archive is required"),
        "error",
      );
      return;
    }
    const confirmText = replace
      ? tr("backupRestoreConfirmReplace", "Restore and replace current data?")
      : tr("backupRestoreConfirmMerge", "Restore and merge into current data?");
    if (!runtime.confirmRestore(confirmText)) return;
    setBackupStatus(state, tr("running", "running"), "running");
    try {
      const payload = await api.restoreBackup(archive, replace);
      setBackupStatus(
        state,
        `${tr("backupRestored", "Backup restored")}: ${payload.archive || archive}`,
        "success",
      );
      await loadBackups(state);
      await runtime.onRestored();
    } catch (error) {
      setBackupStatus(state, errorMessage(error), "error");
    }
  }

  function runRowOperation(
    index: number,
    operation: "download" | BackupRestoreOperation,
    event: Event,
  ): Promise<unknown> {
    runtime.stopEventPropagation(event);
    const request = backupArchiveRowOperationRequest(
      get(backupStateStore),
      index,
      operation,
    );
    if (!request) return Promise.resolve();
    return runLoading(request.loadingKey, (state) => {
      if (!selectBackupItem(state, request.backupItem)) return;
      return request.type === "download"
        ? downloadSelectedBackupArchive(state)
        : restoreBackupArchive(state, Boolean(request.replace));
    });
  }

  async function setPageContext({ active = false } = {}): Promise<void> {
    if (!active) {
      didInitialLoad = false;
      return;
    }
    if (didInitialLoad) return;
    didInitialLoad = true;
    await runMutation(loadBackups);
  }

  function destroy(): void {
    didInitialLoad = false;
    backupStateStore.set(newBackupState());
  }

  return {
    backupDisplayStateStore,
    backupStateStore,
    createBackup: () => runLoading("backup-create", createBackupArchive),
    destroy,
    downloadBackupRow:
      (index = 0) =>
      (event) =>
        runRowOperation(index, "download", event),
    downloadSelectedBackup: () =>
      runLoading("backup-download", downloadSelectedBackupArchive),
    refreshBackups: () => runLoading("backup-refresh", loadBackups),
    restoreBackupMerge: () =>
      runLoading("backup-restore-merge", (state) =>
        restoreBackupArchive(state, false),
      ),
    restoreBackupReplace: () =>
      runLoading("backup-restore-replace", (state) =>
        restoreBackupArchive(state, true),
      ),
    restoreBackupRowMerge:
      (index = 0) =>
      (event) =>
        runRowOperation(index, "restore-merge", event),
    restoreBackupRowReplace:
      (index = 0) =>
      (event) =>
        runRowOperation(index, "restore-replace", event),
    selectBackupRow:
      (index = 0) =>
      () => {
        updateState((state) => {
          selectBackupItemByIndex(state, index);
        });
      },
    setPageContext,
    updateArchiveInput: (value = "") => {
      updateState((state) => setBackupArchiveInput(state, value));
    },
    updateOutputPath: (value = "") => {
      updateState((state) => setBackupOutputPath(state, value));
    },
  };
}
