import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("auto discovery is a dedicated management page", () => {
  const modes = read("frontend/src/config/dashboardModes.js");
  const navigation = read("frontend/src/config/dashboardNavigation.js");
  const inventoryPage = read("frontend/src/pages/InventoryPage.svelte");
  const discoveryPage = read("frontend/src/pages/DeviceDiscoveryPage.svelte");
  const sidebar = read(
    "frontend/src/components/layout/DashboardSidebar.svelte",
  );
  const presentation = read(
    "frontend/src/modules/inventory/inventoryCollectionWorkspaces.js",
  );

  assert.match(modes, /devices: "devices"/);
  assert.match(modes, /defaultInventorySection = INVENTORY_KIND\.devices/);
  assert.doesNotMatch(modes, /discovery: "discovery"/);
  assert.doesNotMatch(
    inventoryPage,
    /DeviceDiscoveryPanel|INVENTORY_KIND\.discovery/,
  );
  assert.match(navigation, /id: "device-discovery"/);
  assert.match(navigation, /path: "\/app\/device-discovery"/);
  assert.match(navigation, /labelKey: "deviceDiscoveryTitle"/);
  assert.match(
    navigation,
    /import\("\.\.\/pages\/DeviceDiscoveryPage\.svelte"\)/,
  );
  assert.match(discoveryPage, /<DeviceDiscoveryPanel \{active\}/);
  assert.match(sidebar, /"device-discovery": ScanSearchIcon/);
  assert.match(presentation, /devicesActive:/);
  assert.doesNotMatch(presentation, /discoveryActive:/);
  assert.match(
    presentation,
    /labelsActive: normalizedSection === INVENTORY_KIND\.labels/,
  );
});

test("auto discovery provides tag selection, cancellation, results, and import", () => {
  const panel = read(
    "frontend/src/pages/inventory/DeviceDiscoveryPanel.svelte",
  );
  const multiSelect = read(
    "frontend/src/components/fragments/MultiSelectField.svelte",
  );

  assert.equal((panel.match(/<MultiSelectField/g) || []).length, 3);
  assert.match(panel, /maxSelected=\{3\}/);
  assert.match(panel, /cancelDeviceDiscoveryRun/);
  assert.match(panel, /importDeviceDiscoveryResults/);
  assert.match(panel, /<Table\.Root/);
  assert.match(panel, /overflow-x-auto/);
  assert.match(panel, /currentLanguageState/);
  assert.match(panel, /currentLanguage;\s+return translateText\(key\)/);
  assert.match(panel, /resultFilter = \$state\("identified"\)/);
  assert.match(panel, /identifiedResultCount/);
  assert.match(panel, /currentRun\?\.phase === "ssh_probe"/);
  assert.match(panel, /currentRun\.probed_targets/);
  assert.match(panel, /Number\(currentRun\.reachable_count\)/);
  assert.match(panel, /filter: "reachable"/);
  assert.match(panel, /aria-pressed=\{resultFilter === metric\.filter\}/);
  assert.match(
    panel,
    /onclick=\{\(\) => selectResultFilter\(metric\.filter\)\}/,
  );
  assert.doesNotMatch(panel, /deviceDiscoveryFilterIdentified/);
  assert.match(panel, /onValueChange=\{selectStatusFilter\}/);
  assert.match(
    panel,
    /function selectStatusFilter\(filter\) \{\s+statusFilter = filter;\s+resultFilter = "all";/,
  );
  assert.match(panel, /deviceDiscoveryStatus_existing/);
  assert.match(panel, /discoveryResultStatus/);
  assert.match(panel, /overwrite: false/);
  assert.match(panel, /result\.existing_connection_name/);
  assert.match(panel, /async function loadLatestRun\(\)/);
  assert.doesNotMatch(
    panel,
    /deviceDiscoveryHistory|runOptions|PlainSelectField/,
  );
  assert.match(multiSelect, /DropdownMenu\.CheckboxGroup/);
  assert.match(multiSelect, /closeOnSelect=\{false\}/);
  assert.match(multiSelect, /<Badge/);
});

test("device discovery client routes match the backend API", () => {
  const client = read("frontend/src/api/client.js");

  assert.match(client, /POST", "\/api\/device-discovery\/runs"/);
  assert.match(client, /GET", "\/api\/device-discovery\/runs"/);
  assert.match(
    client,
    /device-discovery\/runs\/\$\{encodeURIComponent\(runId\)\}\/cancel/,
  );
  assert.match(
    client,
    /device-discovery\/runs\/\$\{encodeURIComponent\(runId\)\}\/import/,
  );
});
