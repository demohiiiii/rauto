import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("device groups are membership-only resources", () => {
  const panel = read(
    "frontend/src/pages/inventory/InventoryCollectionPanel.svelte",
  );
  const storeState = read(
    "frontend/src/modules/inventoryCollectionStoreState.js",
  );
  const collectionState = read(
    "frontend/src/modules/inventoryCollectionState.js",
  );
  const pageWorkspace = read("frontend/src/modules/inventoryPageWorkspace.js");

  assert.doesNotMatch(panel, /TextAreaField|formVarsValue|onVarsInput/);
  assert.doesNotMatch(storeState, /formVars|updateInventoryGroupVars/);
  assert.doesNotMatch(collectionState, /updateInventoryGroupVars/);
  assert.doesNotMatch(pageWorkspace, /updateInventoryGroupVars/);
});
