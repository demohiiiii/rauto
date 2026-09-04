import assert from "node:assert/strict";
import test from "node:test";
import {
  dashboardNavigationItems,
  routeById,
} from "../src/domains/dashboard/index.js";

test("auto discovery is a dedicated operations page", () => {
  const navigationItem = dashboardNavigationItems.find(
    (item) => item.routeId === "device-discovery",
  );

  assert.ok(navigationItem);
  assert.equal(navigationItem.group, "operations");
  assert.equal(navigationItem.labelKey, "deviceDiscoveryTitle");
  assert.deepEqual(routeById("device-discovery"), {
    id: "device-discovery",
    path: "/app/device-discovery",
    tab: "device-discovery",
    txStage: undefined,
  });
});
