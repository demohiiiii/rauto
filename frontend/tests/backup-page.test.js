import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import {
  backupArchiveRowOperationRequest,
  createBackupPageWorkspace,
  formatBackupBytes,
  newBackupState,
  selectedBackupFromInput,
} from "../src/domains/backup/index.ts";

test("backup model resolves managed archives by path or filename", () => {
  const backups = [
    {
      name: "rauto-20260831.tar.zst",
      path: "/var/lib/rauto/backups/rauto-20260831.tar.zst",
    },
  ];

  assert.equal(selectedBackupFromInput(backups, backups[0].path), backups[0]);
  assert.equal(selectedBackupFromInput(backups, backups[0].name), backups[0]);
  assert.equal(selectedBackupFromInput(backups, "missing.tar.zst"), null);
  assert.equal(formatBackupBytes(1536), "1.5 KiB");

  const state = { ...newBackupState(), backups };
  assert.deepEqual(
    backupArchiveRowOperationRequest(state, 0, "restore-replace"),
    {
      backupItem: backups[0],
      loadingKey:
        "restore-replace:/var/lib/rauto/backups/rauto-20260831.tar.zst",
      replace: true,
      type: "restore",
    },
  );
});

test("backup workspace loads once for each active page lifecycle", async () => {
  let listCalls = 0;
  const workspace = createBackupPageWorkspace({
    api: {
      async listBackups() {
        listCalls += 1;
        return [{ name: `backup-${listCalls}`, path: `/backup-${listCalls}` }];
      },
    },
  });

  await workspace.setPageContext({ active: true });
  await workspace.setPageContext({ active: true });
  assert.equal(listCalls, 1);
  assert.equal(get(workspace.backupStateStore).backups[0].name, "backup-1");

  await workspace.setPageContext({ active: false });
  await workspace.setPageContext({ active: true });
  assert.equal(listCalls, 2);

  workspace.destroy();
  assert.deepEqual(get(workspace.backupStateStore), newBackupState());
});

test("backup row actions use the selected managed archive", async () => {
  const backups = [
    {
      name: "rauto-latest.tar.zst",
      path: "/managed/rauto-latest.tar.zst",
    },
  ];
  const downloads = [];
  const restores = [];
  let stopped = 0;
  let refreshed = 0;
  const workspace = createBackupPageWorkspace({
    api: {
      async downloadBackupBlob(name) {
        assert.equal(name, "rauto-latest.tar.zst");
        return { blob: new Blob(["backup"]), filename: name };
      },
      async listBackups() {
        return backups;
      },
      async restoreBackup(archive, replace) {
        restores.push({ archive, replace });
        return { archive };
      },
    },
    runtime: {
      confirmRestore: () => true,
      download: (_blob, filename) => downloads.push(filename),
      onRestored: async () => {
        refreshed += 1;
      },
      stopEventPropagation: () => {
        stopped += 1;
      },
    },
  });

  await workspace.setPageContext({ active: true });
  await workspace.downloadBackupRow(0)({});
  await workspace.restoreBackupRowReplace(0)({});

  assert.deepEqual(downloads, ["rauto-latest.tar.zst"]);
  assert.deepEqual(restores, [
    { archive: "/managed/rauto-latest.tar.zst", replace: true },
  ]);
  assert.equal(stopped, 2);
  assert.equal(refreshed, 1);
});

test("backup workspace suppresses duplicate operations by loading key", async () => {
  let createCalls = 0;
  let resolveCreate;
  const workspace = createBackupPageWorkspace({
    api: {
      createBackup() {
        createCalls += 1;
        return new Promise((resolve) => {
          resolveCreate = resolve;
        });
      },
      async listBackups() {
        return [];
      },
    },
  });

  const first = workspace.createBackup();
  const duplicate = workspace.createBackup();
  assert.equal(createCalls, 1);
  assert.deepEqual(get(workspace.backupStateStore).loadingKeys, [
    "backup-create",
  ]);

  resolveCreate({ path: "/backup-created" });
  await Promise.all([first, duplicate]);
  assert.deepEqual(get(workspace.backupStateStore).loadingKeys, []);
});
