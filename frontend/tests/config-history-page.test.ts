import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { get, writable } from "svelte/store";
import {
  activeSavedDeviceName,
  createConfigHistoryWorkspace,
  localDateTimeToIso,
  mergeConfigHistoryDevices,
  prioritizeConfigHistoryDevices,
} from "../src/domains/config-history/index.js";
import type {
  ConfigHistoryApi,
  ConnectionTarget,
  DeviceConfigHistoryFilters,
  DeviceConfigHistoryResponse,
  DeviceConfigSnapshotSummary,
} from "../src/domains/config-history/model/types.js";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const deleteSnapshot: ConfigHistoryApi["deleteDeviceConfigSnapshot"] = async (
  id,
) => ({ deleted: true, id });

function emptyHistoryResponse(): DeviceConfigHistoryResponse {
  return { connection_names: [], kinds: [], snapshots: [] };
}

test("configuration history is a dedicated local management page", () => {
  const navigation = read("frontend/src/domains/dashboard/model/navigation.ts");
  const shell = read(
    "frontend/src/domains/dashboard/application/createDashboardShellWorkspaces.ts",
  );
  const sidebar = read(
    "frontend/src/domains/dashboard/presentation/components/DashboardSidebar.svelte",
  );
  const routePage = read("frontend/src/pages/ConfigHistoryPage.svelte");
  const page = read(
    "frontend/src/domains/config-history/presentation/components/ConfigHistoryWorkspace.svelte",
  );
  const application = read(
    "frontend/src/domains/config-history/application/createConfigHistoryWorkspace.ts",
  );
  const infrastructure = read(
    "frontend/src/domains/config-history/infrastructure/configHistoryApi.ts",
  );
  const runtime = read(
    "frontend/src/domains/config-history/infrastructure/configHistoryRuntime.ts",
  );
  const presentation = read(
    "frontend/src/domains/config-history/presentation/configHistoryPresentation.ts",
  );
  const domainSource = [
    application,
    infrastructure,
    runtime,
    presentation,
  ].join("\n");

  assert.match(navigation, /id: "config-history"/);
  assert.match(navigation, /path: "\/app\/config-history"/);
  assert.match(navigation, /import\(".*\/pages\/ConfigHistoryPage\.svelte"\)/);
  assert.match(
    shell,
    /tab !== "config-history" \|\| !dashboard\.managedAgentMode/,
  );
  assert.match(sidebar, /"config-history": FileClockIcon/);
  assert.match(routePage, /ConfigHistoryWorkspace/);
  assert.match(page, /createConfigHistoryWorkspace/);
  assert.match(page, /workspace\.selectDevice\(device\.name\)/);
  assert.match(page, /workspace\.selectSnapshot\(snapshot\.id\)/);
  assert.match(page, /<Dialog\.Root/);
  assert.match(page, /<DateTimePickerField/);
  assert.match(page, /defaultTime="00:00:00"/);
  assert.match(page, /defaultTime="23:59:59"/);
  assert.doesNotMatch(page, /type="datetime-local"/);
  const dateTimePicker = read(
    "frontend/src/domains/config-history/presentation/components/DateTimePickerField.svelte",
  );
  assert.match(dateTimePicker, /<script lang="ts">/);
  assert.match(dateTimePicker, /YYYY-MM-DD HH:mm:ss/);
  assert.match(dateTimePicker, /<Calendar/);
  assert.match(dateTimePicker, /type="time"/);
  assert.match(dateTimePicker, /dateTimePickerDone/);
  assert.match(page, /<ToggleGroup\.Root/);
  assert.equal((page.match(/<Card\.Root/g) || []).length, 2);
  assert.match(page, /<OutputBlock/);
  assert.doesNotMatch(page, /normalized/);
  assert.match(page, /workspace\.downloadSelected/);
  assert.match(infrastructure, /listDeviceConfigHistory/);
  assert.match(infrastructure, /listDeviceConfigHistoryDevices/);
  assert.match(infrastructure, /listConnections/);
  assert.match(runtime, /activeConnectionTarget/);
  assert.match(infrastructure, /getDeviceConfigSnapshot/);
  assert.match(infrastructure, /deleteDeviceConfigSnapshot/);
  assert.doesNotMatch(application, /snapshots\[0\]/);
  assert.doesNotMatch(domainSource, /normalized/);
  assert.equal(
    existsSync("frontend/src/modules/operations/configHistory.js"),
    false,
  );
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
  assert.deepEqual(
    mergeConfigHistoryDevices(
      [{ name: "edge-live", host: "192.0.2.10" }],
      [
        { name: "edge-live", host: "192.0.2.1" },
        { name: "edge-deleted", host: "192.0.2.2" },
      ],
    ),
    [
      { name: "edge-live", host: "192.0.2.10" },
      { name: "edge-deleted", host: "192.0.2.2" },
    ],
  );
});

test("configuration history loads each level only after its parent selection", async () => {
  const calls: { details: string[]; histories: string[] } = {
    details: [],
    histories: [],
  };
  const snapshot: DeviceConfigSnapshotSummary = {
    changed_from_previous: null,
    command: "show running-config",
    id: "snapshot-1",
    connection_name: "edge-2",
    content_size_bytes: 16,
    fetched_at: "2026-08-25T10:00:00Z",
    host: "192.0.2.2",
    kind: "running",
    previous_snapshot_id: null,
    profile: "cisco_ios",
    sha256: "snapshot-sha256",
    source: "manual",
    task_id: null,
  };
  const api: ConfigHistoryApi = {
    deleteDeviceConfigSnapshot: deleteSnapshot,
    getDeviceConfigSnapshot: async (id) => {
      calls.details.push(id);
      return { ...snapshot, content: "hostname edge-2\n" };
    },
    listConnections: async () => [
      { name: "edge-1", host: "192.0.2.1" },
      { name: "edge-2", host: "192.0.2.2" },
    ],
    listDeviceConfigHistoryDevices: async () => [],
    listDeviceConfigHistory: async ({ connectionName }) => {
      calls.histories.push(connectionName);
      return {
        connection_names: ["edge-2"],
        kinds: ["running"],
        snapshots: [snapshot],
      };
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
  let display = get(workspace.displayStateStore);
  assert.equal(display.connectionName, "edge-2");
  assert.equal(display.deviceRows[0].name, "edge-2");
  assert.equal(display.deviceRows[0].preferred, true);
  assert.deepEqual(calls.histories, ["edge-2"]);
  assert.deepEqual(calls.details, []);
  assert.equal(display.detailOpen, false);

  await workspace.selectSnapshot("snapshot-1")();
  display = get(workspace.displayStateStore);
  assert.deepEqual(calls.details, ["snapshot-1"]);
  assert.equal(display.detailOpen, true);
  assert.equal(display.detailDisplay.content, "hostname edge-2\n");
  workspace.closeDetail();
  display = get(workspace.displayStateStore);
  assert.equal(display.detailOpen, false);
  assert.equal(display.detailDisplay.hasDetail, false);

  const unselectedCalls: string[] = [];
  const unselectedWorkspace = createConfigHistoryWorkspace({
    api: {
      ...api,
      listDeviceConfigHistory: async ({ connectionName }) => {
        unselectedCalls.push(connectionName);
        return emptyHistoryResponse();
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
  const targetStore = writable<ConnectionTarget>({
    kind: "none",
    details: null,
  });
  const historyCalls: string[] = [];
  const workspace = createConfigHistoryWorkspace({
    activeConnectionTargetStore: targetStore,
    api: {
      deleteDeviceConfigSnapshot: deleteSnapshot,
      getDeviceConfigSnapshot: async () => null,
      listConnections: async () => [{ name: "edge-1" }, { name: "edge-2" }],
      listDeviceConfigHistoryDevices: async () => [],
      listDeviceConfigHistory: async ({ connectionName }) => {
        historyCalls.push(connectionName);
        return emptyHistoryResponse();
      },
    },
    getActiveConnectionTarget: () => ({ kind: "none", details: null }),
  });

  await workspace.setPageContext({ active: true });
  assert.deepEqual(historyCalls, []);
  targetStore.set({ kind: "saved", details: { name: "edge-2" } });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const display = get(workspace.displayStateStore);
  assert.equal(display.connectionName, "edge-2");
  assert.equal(display.deviceRows[0].name, "edge-2");
  assert.deepEqual(historyCalls, ["edge-2"]);
  workspace.destroy();
});

test("configuration history applies time range and stable time ordering", async () => {
  const historyCalls: DeviceConfigHistoryFilters[] = [];
  const workspace = createConfigHistoryWorkspace({
    api: {
      deleteDeviceConfigSnapshot: deleteSnapshot,
      getDeviceConfigSnapshot: async () => null,
      listConnections: async () => [{ name: "edge-1" }],
      listDeviceConfigHistoryDevices: async () => [],
      listDeviceConfigHistory: async (filters) => {
        historyCalls.push(filters);
        return emptyHistoryResponse();
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
  const display = get(workspace.displayStateStore);
  assert.equal(display.listStatus?.tone, "error");
  await workspace.clearTimeRange();
  assert.equal(historyCalls.at(-1)?.fetchedFrom, "");
  assert.equal(historyCalls.at(-1)?.fetchedTo, "");
  workspace.destroy();
});

test("configuration history keeps deleted devices without eagerly loading history", async () => {
  const historyCalls: string[] = [];
  const workspace = createConfigHistoryWorkspace({
    api: {
      deleteDeviceConfigSnapshot: deleteSnapshot,
      getDeviceConfigSnapshot: async () => null,
      listConnections: async () => [{ name: "edge-live", host: "192.0.2.10" }],
      listDeviceConfigHistoryDevices: async () => [
        { name: "edge-live", host: "192.0.2.1" },
        { name: "edge-deleted", host: "192.0.2.2" },
      ],
      listDeviceConfigHistory: async ({ connectionName }) => {
        historyCalls.push(connectionName);
        return emptyHistoryResponse();
      },
    },
    getActiveConnectionTarget: () => ({ kind: "none", details: null }),
  });

  await workspace.setPageContext({ active: true });
  const display = get(workspace.displayStateStore);
  assert.deepEqual(
    display.deviceRows.map((device) => device.name),
    ["edge-deleted", "edge-live"],
  );
  assert.equal(
    display.deviceRows.find((device) => device.name === "edge-live")?.host,
    "192.0.2.10",
  );
  assert.deepEqual(historyCalls, []);

  await workspace.selectDevice("edge-deleted");
  assert.deepEqual(historyCalls, ["edge-deleted"]);
  workspace.destroy();
});

test("configuration history client helpers match backend routes", () => {
  const client = read("frontend/src/api/client.ts");

  assert.match(client, /export function listDeviceConfigHistory/);
  assert.match(client, /export function listDeviceConfigHistoryDevices/);
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
