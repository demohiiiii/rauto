import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { writable } from "svelte/store";
import {
  activeSavedDeviceName,
  createConfigHistoryWorkspace,
  localDateTimeToIso,
  prioritizeConfigHistoryDevices,
} from "../src/modules/operations/configHistory.js";

function read(path) {
  return readFileSync(path, "utf8");
}

test("configuration history is a dedicated local management page", () => {
  const navigation = read("frontend/src/config/dashboardNavigation.js");
  const shell = read("frontend/src/modules/dashboard/dashboardShell.js");
  const sidebar = read(
    "frontend/src/components/layout/DashboardSidebar.svelte",
  );
  const page = read("frontend/src/pages/ConfigHistoryPage.svelte");
  const state = read("frontend/src/modules/operations/configHistory.js");

  assert.match(navigation, /id: "config-history"/);
  assert.match(navigation, /path: "\/app\/config-history"/);
  assert.match(
    navigation,
    /import\("\.\.\/pages\/ConfigHistoryPage\.svelte"\)/,
  );
  assert.match(
    shell,
    /tab !== "config-history" \|\| !dashboard\.managedAgentMode/,
  );
  assert.match(sidebar, /"config-history": FileClockIcon/);
  assert.match(page, /workspace\.selectDevice\(device\.name\)/);
  assert.match(page, /workspace\.selectSnapshot\(snapshot\.id\)/);
  assert.match(page, /<Dialog\.Root/);
  assert.match(page, /type="datetime-local"/);
  assert.match(page, /<ToggleGroup\.Root/);
  assert.equal((page.match(/<Card\.Root/g) || []).length, 2);
  assert.match(page, /<OutputBlock/);
  assert.doesNotMatch(page, /normalized/);
  assert.match(page, /workspace\.downloadSelected/);
  assert.match(state, /listDeviceConfigHistory/);
  assert.match(state, /listConnections/);
  assert.match(state, /activeConnectionTarget/);
  assert.match(state, /getDeviceConfigSnapshot/);
  assert.match(state, /deleteDeviceConfigSnapshot/);
  assert.doesNotMatch(state, /snapshots\[0\]/);
  assert.doesNotMatch(state, /normalized/);
});

test("configuration history prioritizes the active saved device", () => {
  assert.equal(
    activeSavedDeviceName({
      kind: "saved",
      details: { name: " edge-2 " },
    }),
    "edge-2",
  );
  assert.equal(
    activeSavedDeviceName({ kind: "temporary", details: { name: "edge-2" } }),
    "",
  );
  assert.deepEqual(
    prioritizeConfigHistoryDevices(
      [{ name: "edge-1" }, { name: "edge-2" }],
      "edge-2",
    ).map((device) => device.name),
    ["edge-2", "edge-1"],
  );
});

test("configuration history loads each level only after its parent selection", async () => {
  const calls = { details: [], histories: [] };
  const snapshot = {
    id: "snapshot-1",
    connection_name: "edge-2",
    fetched_at: "2026-08-25T10:00:00Z",
    kind: "running",
  };
  const api = {
    deleteDeviceConfigSnapshot: async () => {},
    getDeviceConfigSnapshot: async (id) => {
      calls.details.push(id);
      return { ...snapshot, content: "hostname edge-2\n" };
    },
    listConnections: async () => [
      { name: "edge-1", host: "192.0.2.1" },
      { name: "edge-2", host: "192.0.2.2" },
    ],
    listDeviceConfigHistory: async ({ connectionName }) => {
      calls.histories.push(connectionName);
      return { kinds: ["running"], snapshots: [snapshot] };
    },
  };
  const workspace = createConfigHistoryWorkspace({
    api,
    getActiveConnectionTarget: () => ({
      kind: "saved",
      details: { name: "edge-2" },
    }),
  });

  await workspace.setPageContext({ active: true });
  let display;
  const unsubscribe = workspace.displayStateStore.subscribe((value) => {
    display = value;
  });
  assert.equal(display.connectionName, "edge-2");
  assert.equal(display.deviceRows[0].name, "edge-2");
  assert.equal(display.deviceRows[0].preferred, true);
  assert.deepEqual(calls.histories, ["edge-2"]);
  assert.deepEqual(calls.details, []);
  assert.equal(display.detailOpen, false);

  await workspace.selectSnapshot("snapshot-1")();
  assert.deepEqual(calls.details, ["snapshot-1"]);
  assert.equal(display.detailOpen, true);
  assert.equal(display.detailDisplay.content, "hostname edge-2\n");
  workspace.closeDetail();
  assert.equal(display.detailOpen, false);
  assert.equal(display.detailDisplay.hasDetail, false);
  unsubscribe();

  const unselectedCalls = [];
  const unselectedWorkspace = createConfigHistoryWorkspace({
    api: {
      ...api,
      listDeviceConfigHistory: async ({ connectionName }) => {
        unselectedCalls.push(connectionName);
        return { kinds: [], snapshots: [] };
      },
    },
    getActiveConnectionTarget: () => ({ kind: "none", details: null }),
  });
  await unselectedWorkspace.setPageContext({ active: true });
  assert.deepEqual(unselectedCalls, []);
  await unselectedWorkspace.selectDevice("edge-1");
  assert.deepEqual(unselectedCalls, ["edge-1"]);
});

test("configuration history follows a saved device restored after page activation", async () => {
  const targetStore = writable({ kind: "none", details: null });
  const historyCalls = [];
  const workspace = createConfigHistoryWorkspace({
    activeConnectionTargetStore: targetStore,
    api: {
      deleteDeviceConfigSnapshot: async () => {},
      getDeviceConfigSnapshot: async () => null,
      listConnections: async () => [{ name: "edge-1" }, { name: "edge-2" }],
      listDeviceConfigHistory: async ({ connectionName }) => {
        historyCalls.push(connectionName);
        return { kinds: [], snapshots: [] };
      },
    },
    getActiveConnectionTarget: () => ({ kind: "none", details: null }),
  });

  await workspace.setPageContext({ active: true });
  assert.deepEqual(historyCalls, []);
  targetStore.set({ kind: "saved", details: { name: "edge-2" } });
  await new Promise((resolve) => setTimeout(resolve, 0));

  let display;
  const unsubscribe = workspace.displayStateStore.subscribe((value) => {
    display = value;
  });
  assert.equal(display.connectionName, "edge-2");
  assert.equal(display.deviceRows[0].name, "edge-2");
  assert.deepEqual(historyCalls, ["edge-2"]);
  unsubscribe();
  workspace.destroy();
});

test("configuration history applies time range and stable time ordering", async () => {
  const historyCalls = [];
  const workspace = createConfigHistoryWorkspace({
    api: {
      deleteDeviceConfigSnapshot: async () => {},
      getDeviceConfigSnapshot: async () => null,
      listConnections: async () => [{ name: "edge-1" }],
      listDeviceConfigHistory: async (filters) => {
        historyCalls.push(filters);
        return { kinds: [], snapshots: [] };
      },
    },
    getActiveConnectionTarget: () => ({ kind: "none", details: null }),
  });

  await workspace.setPageContext({ active: true });
  await workspace.selectDevice("edge-1");
  await workspace.setFetchedFrom("2026-08-25T08:00:00");
  await workspace.setFetchedTo("2026-08-25T18:00:00");
  await workspace.setSortOrder("asc");

  assert.deepEqual(historyCalls.at(-1), {
    connectionName: "edge-1",
    fetchedFrom: localDateTimeToIso("2026-08-25T08:00:00"),
    fetchedTo: localDateTimeToIso("2026-08-25T18:00:00"),
    kind: "",
    limit: 100,
    sortOrder: "asc",
  });

  const callCount = historyCalls.length;
  await workspace.setFetchedFrom("2026-08-26T08:00:00");
  assert.equal(historyCalls.length, callCount);
  let display;
  const unsubscribe = workspace.displayStateStore.subscribe((value) => {
    display = value;
  });
  assert.equal(display.listStatus.tone, "error");
  await workspace.clearTimeRange();
  assert.equal(historyCalls.at(-1).fetchedFrom, "");
  assert.equal(historyCalls.at(-1).fetchedTo, "");
  unsubscribe();
  workspace.destroy();
});

test("configuration history client helpers match backend routes", () => {
  const client = read("frontend/src/api/client.js");

  assert.match(client, /export function listDeviceConfigHistory/);
  assert.match(client, /params\.set\("fetched_from", fetchedFrom\)/);
  assert.match(client, /params\.set\("fetched_to", fetchedTo\)/);
  assert.match(client, /params\.set\("sort_order", sortOrder\)/);
  assert.match(
    client,
    /`\/api\/device-config-history\?\$\{params\.toString\(\)\}`/,
  );
  assert.match(client, /export function getDeviceConfigSnapshot/);
  assert.match(client, /export function deleteDeviceConfigSnapshot/);
  assert.match(
    client,
    /`\/api\/device-config-history\/\$\{encodeURIComponent\(snapshotId\)\}`/,
  );
});

test("device configuration snapshots start with the raw-only schema", () => {
  const migration = read("migrations/202608250002_device_config_snapshots.sql");

  assert.doesNotMatch(migration, /normalized_(content|sha256)/);
  assert.equal(
    existsSync("migrations/202608250003_remove_normalized_device_configs.sql"),
    false,
  );
});
