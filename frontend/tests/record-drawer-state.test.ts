import assert from "node:assert/strict";
import test from "node:test";

import { get } from "svelte/store";
import {
  closeRecordDrawer,
  historyDrawerPresentation,
  openRecordDrawer,
  overlayDrawerState,
  replayJsonlTransferState,
} from "../src/domains/overlays/index.js";
import {
  historyDrawerState,
  historyFilterStateStore,
  loadConnectionHistory,
  openConnectionHistory,
  replayConnectionHistoryItem,
  setHistoryFilterDevice,
  setHistoryFilterLimit,
} from "../src/domains/connections/application/connectionsHistory.js";
import { setCurrentConnectionTarget } from "../src/domains/connections/application/connectionTargetStoreState.js";
import { connectionApi } from "../src/domains/connections/infrastructure/connectionApi.js";
import type {
  ConnectionHistoryItem,
  ConnectionHistoryTargetQuery,
} from "../src/domains/connections/model/types.js";

function historyItem(id: string): ConnectionHistoryItem {
  return {
    command_label: `show ${id}`,
    connection_key: `adhoc_${id}`,
    connection_name: null,
    device_profile: "h3c_comware",
    host: "192.0.2.20",
    id,
    mode: "Enable",
    operation: "show",
    port: 22,
    record_level: "key-events-only",
    record_path: `db://history/${id}`,
    ts_ms: 100,
    username: "audit-user",
  };
}

test("opening session records opens the unified history drawer", () => {
  openRecordDrawer();

  assert.equal(get(overlayDrawerState).recordDrawerOpen, true);
  closeRecordDrawer();
});

test("session history sends the original recording JSONL to replay", async () => {
  const originalGetHistoryDetail = connectionApi.getHistoryDetail;
  const originalTransfer = get(replayJsonlTransferState);
  const recordingJsonl =
    '{"ts_ms":1,"event":{"kind":"connection_closed","reason":"done"}}\n';
  connectionApi.getHistoryDetail = async () => ({
    entries: [],
    meta: historyItem("replay-source"),
    recording_jsonl: recordingJsonl,
  });

  try {
    replayJsonlTransferState.set({ jsonl: "", version: 0 });
    openRecordDrawer();

    assert.equal(await replayConnectionHistoryItem("replay-source"), true);
    assert.equal(get(replayJsonlTransferState).jsonl, recordingJsonl);
    assert.equal(get(overlayDrawerState).recordDrawerOpen, false);
  } finally {
    connectionApi.getHistoryDetail = originalGetHistoryDetail;
    replayJsonlTransferState.set(originalTransfer);
    closeRecordDrawer();
  }
});

test("session history stays open when a record has no replay data", async () => {
  const originalGetHistoryDetail = connectionApi.getHistoryDetail;
  const originalTransfer = get(replayJsonlTransferState);
  connectionApi.getHistoryDetail = async () => ({
    entries: [],
    meta: historyItem("empty-replay-source"),
    recording_jsonl: "  \n",
  });

  try {
    replayJsonlTransferState.set({ jsonl: "previous", version: 1 });
    openRecordDrawer();

    assert.equal(
      await replayConnectionHistoryItem("empty-replay-source"),
      false,
    );
    assert.equal(get(replayJsonlTransferState).jsonl, "previous");
    assert.equal(get(overlayDrawerState).recordDrawerOpen, true);
  } finally {
    connectionApi.getHistoryDetail = originalGetHistoryDetail;
    replayJsonlTransferState.set(originalTransfer);
    closeRecordDrawer();
  }
});

test("session history includes temporary targets and keeps newest records first", () => {
  const temporaryDeviceKey = "temporary:192.0.2.20:22";
  const historyItems = [
    {
      command_label: "show older",
      connection_name: "edge-1",
      host: "192.0.2.10",
      id: "older",
      port: 22,
      ts_ms: 100,
    },
    {
      command_label: "show newer",
      connection_name: null,
      host: "192.0.2.20",
      id: "newer",
      port: 22,
      ts_ms: 200,
    },
  ];
  const presentation = historyDrawerPresentation({
    drawerState: {
      connectionLabel: "All connections",
      currentDeviceKey: temporaryDeviceKey,
      devices: [
        {
          connectionName: null,
          deviceProfile: "h3c_comware",
          host: "192.0.2.20",
          kind: "temporary",
          port: 22,
          value: temporaryDeviceKey,
        },
      ],
      historyItems,
    },
    filterState: { limit: 30, operation: "all", query: "" },
  });

  assert.deepEqual(
    presentation.filteredRows.map((row) => row.historyId),
    ["newer", "older"],
  );
  assert.notEqual(presentation.filteredRows[0]?.connectionName, "-");
  assert.equal(presentation.filteredRows[0]?.isTemporary, true);
  assert.equal(presentation.filteredRows[0]?.isCurrent, true);
  assert.equal(
    presentation.filteredRows[0]?.connectionName,
    presentation.filteredRows[0]?.temporaryLabel,
  );
  assert.deepEqual(
    historyItems.map((item) => item.id),
    ["older", "newer"],
  );
  assert.equal(
    presentation.filtersDisplay.deviceOptionRows[1]?.isCurrent,
    true,
  );
});

test("interactive history uses the persisted operation value when filtering", () => {
  const drawerState = {
    historyItems: [
      { ...historyItem("interactive"), operation: "interactive" },
      historyItem("show"),
    ],
  };
  const options = historyDrawerPresentation({ drawerState }).filtersDisplay
    .operationOptionRows;
  const option = options.find((item) => item.label === "Interactive");
  assert.equal(option?.value, "interactive");

  const presentation = historyDrawerPresentation({
    drawerState,
    filterState: { operation: option?.value },
  });
  assert.deepEqual(
    presentation.filteredRows.map((row) => row.historyId),
    ["interactive"],
  );
  assert.equal(presentation.filteredRows[0]?.operationLabel, "Interactive");
});

test("an older session history response cannot replace a newer limit request", async () => {
  const originalListHistory = connectionApi.listHistory;
  const originalListHistoryDevices = connectionApi.listHistoryDevices;
  const pending = new Map<number, (items: ConnectionHistoryItem[]) => void>();
  connectionApi.listHistory = (limit) =>
    new Promise((resolve) => pending.set(limit, resolve));
  connectionApi.listHistoryDevices = async () => [];

  try {
    setHistoryFilterLimit(10);
    const olderRequest = loadConnectionHistory();
    setHistoryFilterLimit(20);
    const newerRequest = loadConnectionHistory();

    pending.get(20)?.([historyItem("newer")]);
    await newerRequest;
    pending.get(10)?.([historyItem("older")]);
    await olderRequest;

    assert.deepEqual(
      get(historyDrawerState).historyItems.map((item) => item.id),
      ["newer"],
    );
  } finally {
    connectionApi.listHistory = originalListHistory;
    connectionApi.listHistoryDevices = originalListHistoryDevices;
    setHistoryFilterLimit(30);
  }
});

test("session history opens on the active saved device and can switch scope", async () => {
  const originalListHistory = connectionApi.listHistory;
  const originalListHistoryDevices = connectionApi.listHistoryDevices;
  const requests: ConnectionHistoryTargetQuery[] = [];
  const currentItem = {
    ...historyItem("current"),
    connection_key: "edge-current",
    connection_name: "edge-current",
    host: "192.0.2.10",
  };
  const otherItem = {
    ...historyItem("other"),
    connection_key: "edge-other",
    connection_name: "edge-other",
    host: "192.0.2.11",
  };
  connectionApi.listHistoryDevices = async () => [currentItem, otherItem];
  connectionApi.listHistory = async (_limit, target) => {
    const requested = target || {};
    requests.push(requested);
    if (requested.connectionName === "edge-current") return [];
    if (requested.connectionName === "edge-other") return [otherItem];
    return [currentItem, otherItem];
  };

  try {
    setCurrentConnectionTarget({
      kind: "saved",
      name: "edge-current",
      host: "192.0.2.10",
      port: 22,
      profile: "h3c_comware",
    });
    await openConnectionHistory();

    assert.equal(get(historyFilterStateStore).deviceKey, "saved:edge-current");
    assert.equal(
      get(historyDrawerState).currentDeviceKey,
      "saved:edge-current",
    );
    assert.equal(requests.at(-1)?.connectionName, "edge-current");
    assert.deepEqual(get(historyDrawerState).historyItems, []);

    setHistoryFilterDevice("saved:edge-other");
    await loadConnectionHistory();
    assert.equal(requests.at(-1)?.connectionName, "edge-other");
    assert.deepEqual(
      get(historyDrawerState).historyItems.map((item) => item.id),
      ["other"],
    );

    setHistoryFilterDevice("all");
    await loadConnectionHistory();
    assert.deepEqual(requests.at(-1), {});
    assert.deepEqual(
      get(historyDrawerState).historyItems.map((item) => item.id),
      ["current", "other"],
    );
  } finally {
    connectionApi.listHistory = originalListHistory;
    connectionApi.listHistoryDevices = originalListHistoryDevices;
    setCurrentConnectionTarget(null);
    setHistoryFilterDevice("all");
  }
});

test("session history opens on the active temporary device", async () => {
  const originalListHistory = connectionApi.listHistory;
  const originalListHistoryDevices = connectionApi.listHistoryDevices;
  let requestedTarget: ConnectionHistoryTargetQuery = {};
  connectionApi.listHistoryDevices = async () => [];
  connectionApi.listHistory = async (_limit, target) => {
    requestedTarget = target || {};
    return [];
  };

  try {
    setCurrentConnectionTarget({
      kind: "temporary",
      host: "2001:db8::20",
      port: 2222,
      profile: "h3c_comware",
    });
    await openConnectionHistory();

    assert.equal(
      get(historyFilterStateStore).deviceKey,
      "temporary:2001%3Adb8%3A%3A20:2222",
    );
    assert.equal(
      get(historyDrawerState).currentDeviceKey,
      "temporary:2001%3Adb8%3A%3A20:2222",
    );
    assert.deepEqual(requestedTarget, {
      temporaryHost: "2001:db8::20",
      temporaryPort: 2222,
    });
    assert.equal(get(historyDrawerState).devices.length, 1);
  } finally {
    connectionApi.listHistory = originalListHistory;
    connectionApi.listHistoryDevices = originalListHistoryDevices;
    setCurrentConnectionTarget(null);
    setHistoryFilterDevice("all");
  }
});
