import assert from "node:assert/strict";
import test from "node:test";
import { get, writable } from "svelte/store";
import {
  createInventoryPageWorkspace,
  newInventoryState,
} from "../src/domains/inventory/index.js";
import type {
  InventoryApi,
  InventoryGroup,
  InventoryGroupPayload,
  InventoryLabel,
  InventoryRuntime,
} from "../src/domains/inventory/model/types.js";

function deferred<T>(): {
  promise: Promise<T>;
  reject: (reason?: Error) => void;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function inventoryGroup(
  name: string,
  hosts: string[] = [],
  description: string | null = null,
): InventoryGroup {
  return { description, hosts, name };
}

function inventoryLabel(name: string, hosts: string[] = []): InventoryLabel {
  return { hosts, name };
}

interface TestWorkspaceOptions {
  api?: Partial<InventoryApi>;
  runtime?: Partial<InventoryRuntime>;
}

function createTestWorkspace({
  api = {},
  runtime = {},
}: TestWorkspaceOptions = {}) {
  const savedConnectionsRefreshState = writable(0);
  const protectedResourcesRefreshState = writable(0);
  const workspace = createInventoryPageWorkspace({
    api: {
      async deleteGroup() {
        return { deleted: true, ok: true };
      },
      async deleteLabel() {
        return { deleted: true, ok: true };
      },
      async getGroup(name) {
        return inventoryGroup(name);
      },
      async getLabel(name) {
        return inventoryLabel(name);
      },
      async listConnections() {
        return [];
      },
      async listGroups() {
        return [];
      },
      async listLabels() {
        return [];
      },
      async saveGroup(name, group) {
        return inventoryGroup(name, group.hosts, group.description);
      },
      async saveLabel(name, hosts) {
        return inventoryLabel(name, hosts);
      },
      ...api,
    },
    runtime: {
      protectedResourcesRefreshState,
      async reloadSavedConnections() {},
      savedConnectionsRefreshState,
      syncConnectionInventory() {},
      ...runtime,
    },
  });
  return {
    protectedResourcesRefreshState,
    savedConnectionsRefreshState,
    workspace,
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("inventory workspace loads each catalog once when activated", async () => {
  const calls = { connections: 0, groups: 0, labels: 0 };
  const { workspace } = createTestWorkspace({
    api: {
      async listConnections() {
        calls.connections += 1;
        return [{ name: "edge-01" }];
      },
      async listGroups() {
        calls.groups += 1;
        return [inventoryGroup("branch", ["edge-01"])];
      },
      async listLabels() {
        calls.labels += 1;
        return [inventoryLabel("critical", ["edge-01"])];
      },
    },
  });

  workspace.setPageContext({ active: true });
  workspace.setPageContext({ active: true });
  await settle();

  assert.deepEqual(calls, { connections: 1, groups: 1, labels: 1 });
  const state = get(workspace.inventoryStateStore);
  assert.equal(state.savedConnections[0].name, "edge-01");
  assert.equal(state.groups.items[0].name, "branch");
  assert.equal(state.labels.items[0].name, "critical");
  workspace.destroy();
});

test("group save includes its name, description, and sorted hosts", async () => {
  let savedPayload: InventoryGroupPayload | null = null;
  const { workspace } = createTestWorkspace({
    api: {
      async listGroups() {
        return [inventoryGroup("branch", ["edge-a", "edge-z"], "routers")];
      },
      async saveGroup(_name, payload) {
        savedPayload = payload;
        return inventoryGroup(payload.name, payload.hosts, payload.description);
      },
    },
  });
  workspace.inventoryStateStore.update((state) => {
    state.groups.selectedName = "branch";
    state.groups.description = "  routers  ";
    state.groups.hostSelection = new Set(["edge-z", "edge-a"]);
    return state;
  });

  await workspace.saveInventoryGroupSelection();

  assert.deepEqual(savedPayload, {
    description: "routers",
    hosts: ["edge-a", "edge-z"],
    name: "branch",
  });
  workspace.destroy();
});

test("label save sorts hosts and refreshes connection metadata", async () => {
  let savedHosts: string[] | null = null;
  let reloadCount = 0;
  const { workspace } = createTestWorkspace({
    api: {
      async listLabels() {
        return [inventoryLabel("critical", ["edge-a", "edge-z"])];
      },
      async saveLabel(_name, hosts) {
        savedHosts = hosts;
        return inventoryLabel("critical", hosts);
      },
    },
    runtime: {
      async reloadSavedConnections() {
        reloadCount += 1;
      },
    },
  });
  workspace.inventoryStateStore.update((state) => {
    state.labels.selectedName = "critical";
    state.labels.hostSelection = new Set(["edge-z", "edge-a"]);
    return state;
  });

  await workspace.saveInventoryLabelSelection();

  assert.deepEqual(savedHosts, ["edge-a", "edge-z"]);
  assert.equal(reloadCount, 1);
  workspace.destroy();
});

test("select all hosts only adds visible hosts and preserves existing choices", () => {
  const { workspace } = createTestWorkspace();
  workspace.inventoryStateStore.update((state) => {
    state.savedConnections = [
      { name: "branch-01" },
      { name: "core-01" },
      { name: "branch-02" },
    ];
    state.groups.hostSelection = new Set(["missing-01"]);
    return state;
  });

  workspace.updateGroupHostFilter("branch");
  workspace.selectAllGroupHosts();

  assert.deepEqual(
    [...get(workspace.inventoryStateStore).groups.hostSelection].sort(),
    ["branch-01", "branch-02", "missing-01"],
  );
  workspace.destroy();
});

test("active inventory reloads connections after an external refresh", async () => {
  let connectionLoads = 0;
  const { savedConnectionsRefreshState, workspace } = createTestWorkspace({
    api: {
      async listConnections() {
        connectionLoads += 1;
        return [];
      },
    },
  });

  workspace.setPageContext({ active: true });
  await settle();
  savedConnectionsRefreshState.set(1);
  await settle();

  assert.equal(connectionLoads, 2);
  workspace.destroy();
});

test("latest inventory detail response wins when selection changes quickly", async () => {
  const first = deferred<InventoryGroup>();
  const second = deferred<InventoryGroup>();
  const { workspace } = createTestWorkspace({
    api: {
      getGroup(name) {
        return name === "first" ? first.promise : second.promise;
      },
    },
  });

  workspace.selectInventoryGroupName("first");
  workspace.selectInventoryGroupName("second");
  second.resolve(inventoryGroup("second", ["edge-02"]));
  await settle();
  assert.equal(
    get(workspace.inventoryStateStore).groups.selectedName,
    "second",
  );

  first.resolve(inventoryGroup("first", ["edge-01"]));
  await settle();
  const group = get(workspace.inventoryStateStore).groups;
  assert.equal(group.selectedName, "second");
  assert.deepEqual([...group.hostSelection], ["edge-02"]);
  workspace.destroy();
});

test("destroyed inventory workspace ignores pending requests", async () => {
  const response = deferred<Array<{ name: string }>>();
  const { workspace } = createTestWorkspace({
    api: {
      listConnections() {
        return response.promise;
      },
    },
  });

  workspace.setPageContext({ active: true });
  workspace.destroy();
  response.resolve([{ name: "late-device" }]);
  await settle();

  assert.deepEqual(get(workspace.inventoryStateStore), newInventoryState());
});
