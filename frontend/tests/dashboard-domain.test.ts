import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultDashboardRoute,
  routeById,
  routeByPath,
  refreshProtectedDashboardResources,
} from "../src/domains/dashboard/index.js";
import { dashboardApi } from "../src/domains/dashboard/infrastructure/dashboardApi.js";
import { dashboardResources } from "../src/domains/dashboard/infrastructure/dashboardResources.js";
import { inventoryRuntime } from "../src/domains/inventory/infrastructure/inventoryRuntime.js";
import {
  CONNECTION_PICKER,
  connectionPickerChoices,
  setConnectionInventorySnapshots,
} from "../src/domains/connections/application/connectionFieldStoreState.js";

function pickerOptions(key: string): string[] {
  const rows = connectionPickerChoices(key).optionRows;
  assert.ok(rows);
  return rows.map((row) => row.value);
}

test("dashboard routes normalize paths and ids through the domain model", () => {
  assert.equal(routeById("schedules")?.path, "/app/schedules");
  assert.equal(routeById("missing"), null);
  assert.equal(routeByPath("/app/templates").id, "templates");
  assert.equal(routeByPath("/missing"), defaultDashboardRoute);
});

test("dashboard startup populates query groups and labels without visiting inventory", async (t) => {
  setConnectionInventorySnapshots();
  t.after(() => setConnectionInventorySnapshots());
  t.mock.method(dashboardApi, "listInventoryGroups", async () => [
    { name: "production", description: null, hosts: ["router-01"] },
    { name: "empty-group", description: null, hosts: [] },
  ]);
  t.mock.method(dashboardApi, "listInventoryLabels", async () => [
    { name: "critical", hosts: ["router-01"] },
  ]);
  t.mock.method(dashboardResources, "loadSavedConnections", async () => {});
  t.mock.method(globalThis, "fetch", async () => Response.json([]));

  await refreshProtectedDashboardResources();

  assert.deepEqual(pickerOptions(CONNECTION_PICKER.batchShowGroups), [
    "empty-group",
    "production",
  ]);
  assert.deepEqual(pickerOptions(CONNECTION_PICKER.batchShowLabels), [
    "critical",
  ]);
  assert.deepEqual(pickerOptions(CONNECTION_PICKER.configFetchGroups), [
    "empty-group",
    "production",
  ]);
});

test("older inventory loads cannot replace newer startup catalogs", async (t) => {
  setConnectionInventorySnapshots();
  t.after(() => setConnectionInventorySnapshots());
  type Groups = Awaited<ReturnType<typeof dashboardApi.listInventoryGroups>>;
  let resolveOldGroups!: (groups: Groups) => void;
  const oldGroups = new Promise<Groups>((resolve) => {
    resolveOldGroups = resolve;
  });
  let calls = 0;
  t.mock.method(dashboardApi, "listInventoryGroups", () => {
    calls += 1;
    return calls === 1
      ? oldGroups
      : Promise.resolve([{ name: "current", description: null, hosts: [] }]);
  });
  t.mock.method(dashboardApi, "listInventoryLabels", async () => []);

  const older = dashboardResources.loadConnectionInventory();
  await dashboardResources.loadConnectionInventory();
  resolveOldGroups([{ name: "old", description: null, hosts: [] }]);
  await older;

  assert.deepEqual(pickerOptions(CONNECTION_PICKER.batchShowGroups), [
    "current",
  ]);
});

test("failed inventory refresh preserves the last loaded catalogs", async (t) => {
  setConnectionInventorySnapshots({
    groups: [{ name: "production" }],
    labels: [{ name: "critical" }],
  });
  t.after(() => setConnectionInventorySnapshots());
  t.mock.method(dashboardApi, "listInventoryGroups", async () => {
    throw new Error("inventory unavailable");
  });
  t.mock.method(dashboardApi, "listInventoryLabels", async () => []);

  await assert.rejects(
    dashboardResources.loadConnectionInventory(),
    /inventory unavailable/,
  );
  assert.deepEqual(pickerOptions(CONNECTION_PICKER.batchShowGroups), [
    "production",
  ]);
  assert.deepEqual(pickerOptions(CONNECTION_PICKER.batchShowLabels), [
    "critical",
  ]);
});

test("pending startup inventory cannot overwrite groups and labels saved on the inventory page", async (t) => {
  setConnectionInventorySnapshots();
  t.after(() => setConnectionInventorySnapshots());
  type Groups = Awaited<ReturnType<typeof dashboardApi.listInventoryGroups>>;
  let resolveGroups!: (groups: Groups) => void;
  t.mock.method(
    dashboardApi,
    "listInventoryGroups",
    () =>
      new Promise<Groups>((resolve) => {
        resolveGroups = resolve;
      }),
  );
  t.mock.method(dashboardApi, "listInventoryLabels", async () => [
    { name: "deleted-label", hosts: [] },
  ]);

  const startup = dashboardResources.loadConnectionInventory();
  inventoryRuntime.syncConnectionInventory(
    [{ name: "new-group", description: null, hosts: ["router-01"] }],
    [{ name: "new-label", hosts: ["router-01"] }],
  );
  resolveGroups([{ name: "deleted-group", description: null, hosts: [] }]);
  await startup;

  for (const key of [
    CONNECTION_PICKER.batchShowGroups,
    CONNECTION_PICKER.configFetchGroups,
  ]) {
    assert.deepEqual(pickerOptions(key), ["new-group"]);
  }
  for (const key of [
    CONNECTION_PICKER.batchShowLabels,
    CONNECTION_PICKER.configFetchLabels,
  ]) {
    assert.deepEqual(pickerOptions(key), ["new-label"]);
  }
});

test("pending startup inventory cannot restore deleted groups and a subsequent refresh still works", async (t) => {
  setConnectionInventorySnapshots({ groups: [{ name: "deleted" }] });
  t.after(() => setConnectionInventorySnapshots());
  type Groups = Awaited<ReturnType<typeof dashboardApi.listInventoryGroups>>;
  let resolveGroups!: (groups: Groups) => void;
  let calls = 0;
  t.mock.method(dashboardApi, "listInventoryGroups", () => {
    calls += 1;
    return calls === 1
      ? new Promise<Groups>((resolve) => {
          resolveGroups = resolve;
        })
      : Promise.resolve([{ name: "current", description: null, hosts: [] }]);
  });
  t.mock.method(dashboardApi, "listInventoryLabels", async () => []);

  const startup = dashboardResources.loadConnectionInventory();
  inventoryRuntime.syncConnectionInventory([], []);
  resolveGroups([{ name: "deleted", description: null, hosts: [] }]);
  await startup;
  assert.deepEqual(pickerOptions(CONNECTION_PICKER.batchShowGroups), []);

  await dashboardResources.loadConnectionInventory();
  assert.deepEqual(pickerOptions(CONNECTION_PICKER.batchShowGroups), [
    "current",
  ]);
});
