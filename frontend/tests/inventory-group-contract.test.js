import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("device groups are membership-only resources", () => {
  const panel = read(
    "frontend/src/pages/inventory/InventoryCollectionPanel.svelte",
  );
  const storeState = read("frontend/src/domains/inventory/model/inventory.ts");
  const collectionState = read(
    "frontend/src/domains/inventory/application/createInventoryPageWorkspace.ts",
  );
  const pageWorkspace = read(
    "frontend/src/domains/inventory/application/createInventoryPageWorkspace.ts",
  );

  assert.doesNotMatch(panel, /TextAreaField|formVarsValue|onVarsInput/);
  assert.doesNotMatch(storeState, /formVars|updateInventoryGroupVars/);
  assert.doesNotMatch(collectionState, /updateInventoryGroupVars/);
  assert.doesNotMatch(pageWorkspace, /updateInventoryGroupVars/);
});

test("device management uses a searchable responsive catalog workspace", () => {
  const page = read("frontend/src/pages/InventoryPage.svelte");
  const panel = read(
    "frontend/src/pages/inventory/InventoryCollectionPanel.svelte",
  );
  const zh = read("frontend/src/i18n/zh.js");

  assert.match(zh, /tabInventory: "设备管理"/);
  assert.match(zh, /inventoryTitle: "设备管理"/);
  assert.match(page, /<Tabs\.Root/);
  assert.match(page, /value=\{INVENTORY_KIND\.devices\}/);
  assert.match(page, /value=\{INVENTORY_KIND\.groups\}/);
  assert.match(page, /value=\{INVENTORY_KIND\.labels\}/);
  assert.doesNotMatch(page, /INVENTORY_KIND\.discovery/);
  assert.match(page, /savedConnectionCount/);
  assert.match(page, /collectionCount/);
  assert.match(page, /<SavedConnectionLibraryPanel[\s\S]*variant="management"/);
  assert.match(panel, /collectionSearch = \$state\(""\)/);
  assert.match(panel, /filteredCollectionRows/);
  assert.match(panel, /browserConfirm\(collectionList\.deleteConfirmText\)/);
  assert.match(panel, /disabled=\{!editorDisplay\.canEdit\}/);
  assert.match(panel, /selectedHostCount/);
  assert.match(panel, /lg:grid-cols-\[17rem_minmax\(0,1fr\)\]/);
  assert.match(panel, /h-9 rounded-lg pl-9 text-sm/);
  assert.match(panel, /bg-muted\/10 p-3/);
  assert.doesNotMatch(panel, /StringSelectField/);
});

test("inventory creation uses one in-page dialog instead of browser prompts", () => {
  const panel = read(
    "frontend/src/pages/inventory/InventoryCollectionPanel.svelte",
  );
  const collectionState = read(
    "frontend/src/domains/inventory/application/createInventoryPageWorkspace.ts",
  );

  assert.match(panel, /<Dialog\.Root/);
  assert.match(panel, /<Dialog\.Title>/);
  assert.match(panel, /<Dialog\.Description>/);
  assert.match(panel, /<Dialog\.Footer>/);
  assert.match(panel, /await onCreateDraft\(normalizedName\)/);
  assert.match(panel, /createDialogSubmitting/);
  assert.match(panel, /role="alert"/);
  assert.doesNotMatch(collectionState, /promptForResourceName|browserPrompt/);
  assert.match(
    collectionState,
    /async function createDraft\(kind: InventoryKind, rawName = ""\)/,
  );
});
