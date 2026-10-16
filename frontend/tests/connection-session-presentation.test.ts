import assert from "node:assert/strict";
import test from "node:test";
import { loadI18nLanguage } from "../src/lib/i18n.js";
import type { ConnectionSessionState } from "../src/domains/connections/model/types.js";
import { connectionSessionPresentation } from "../src/domains/connections/presentation/connectionSessionDisplay.js";
import { savedConnectionLibraryPresentation } from "../src/domains/connections/presentation/connectionTargetDisplayState.js";

const connections = [
  { name: "connected-edge", enabled: true },
  { name: "other-edge", enabled: true },
  { name: "disabled-edge", enabled: false },
];

function session(
  status: ConnectionSessionState["status"],
  connectionName: string | null = "connected-edge",
  error = "",
): ConnectionSessionState {
  return {
    connectionName,
    status,
    error,
    keepAlive: { enabled: true, interval_secs: 30 },
  };
}

test("enabled devices remain gray until they have a connected workbench session", async () => {
  await loadI18nLanguage("en");
  const display = savedConnectionLibraryPresentation({ connections });
  for (const row of display.connectionRows) {
    assert.equal(row.session.status, "idle");
    assert.equal(row.statusLabel, "Not connected");
    assert.equal(row.session.colorClass, "text-muted-foreground");
  }
});

test("only the connected device is green even when another device is selected for preview", async () => {
  await loadI18nLanguage("en");
  const display = savedConnectionLibraryPresentation(
    { connections, selected: "other-edge" },
    null,
    session("connected"),
  );
  assert.deepEqual(
    display.connectionRows.map((row) => row.session.status),
    ["connected", "idle", "idle"],
  );
  assert.equal(display.connectionRows[0].statusLabel, "Connected");
  assert.match(display.connectionRows[0].session.colorClass, /text-emerald-/);
  assert.equal(display.selectedConnectionRow?.session.status, "idle");
  assert.equal(display.selectedConnectionRow?.statusLabel, "Not connected");
});

test("connection errors and retries update only their device and localize the status", async () => {
  await loadI18nLanguage("zh");
  const failed = savedConnectionLibraryPresentation(
    { connections, selected: "other-edge" },
    null,
    session("error", "other-edge", "Authentication failed"),
  );
  assert.equal(failed.connectionRows[0].session.status, "idle");
  assert.equal(failed.connectionRows[0].session.error, "");
  assert.equal(failed.selectedConnectionRow?.statusLabel, "连接失败");
  assert.equal(
    failed.selectedConnectionRow?.session.colorClass,
    "text-destructive",
  );
  assert.equal(
    failed.selectedConnectionRow?.session.error,
    "Authentication failed",
  );

  const retry = savedConnectionLibraryPresentation(
    { connections, selected: "other-edge" },
    null,
    session("connecting", "other-edge"),
  );
  assert.equal(retry.selectedConnectionRow?.session.status, "connecting");
  assert.equal(retry.selectedConnectionRow?.session.error, "");
  assert.equal(retry.selectedConnectionRow?.statusLabel, "正在连接");
  assert.equal(
    retry.selectedConnectionRow?.session.colorClass,
    "text-muted-foreground",
  );
});

test("released and temporary sessions cannot mark saved devices as connected", async () => {
  await loadI18nLanguage("en");
  for (const state of [session("idle"), session("connected", null)]) {
    const display = savedConnectionLibraryPresentation(
      { connections },
      null,
      state,
    );
    assert.ok(
      display.connectionRows.every((row) => row.session.status === "idle"),
    );
  }
});

test("global and device indicators share status labels and colors", async () => {
  await loadI18nLanguage("en");
  for (const status of ["idle", "connecting", "connected", "error"] as const) {
    const state = session(status);
    const global = connectionSessionPresentation(state);
    const display = savedConnectionLibraryPresentation(
      { connections },
      null,
      state,
    );
    assert.deepEqual(display.connectionRows[0].session, global);
  }
});
