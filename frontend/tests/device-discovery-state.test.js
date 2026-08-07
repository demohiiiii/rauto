import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultDiscoveryConnectionName,
  discoveryResultCanImport,
  discoveryResultKey,
  discoveryResultStatus,
  discoveryRunIsActive,
  filterDiscoveryResults,
  parseDiscoveryPorts,
  retainImportableDiscoveryResultKeys,
} from "../src/modules/inventory/deviceDiscoveryState.js";

test("discovery ports accept lists and ranges with sorted deduplication", () => {
  assert.deepEqual(
    parseDiscoveryPorts("2222, 22 22, 2200-2202"),
    [22, 2200, 2201, 2202, 2222],
  );
});

test("discovery ports reject invalid and oversized expressions", () => {
  assert.throws(() => parseDiscoveryPorts(""), /ports_required/);
  assert.throws(() => parseDiscoveryPorts("0"), /invalid_port/);
  assert.throws(() => parseDiscoveryPorts("23-22"), /invalid_port_range/);
  assert.throws(() => parseDiscoveryPorts("1-17"), /too_many_ports/);
});

test("discovery result helpers preserve endpoints and import eligibility", () => {
  const result = {
    host: "192.0.2.8",
    port: 2222,
    status: "identified",
    device_profile: "cisco_ios",
  };
  assert.equal(discoveryResultKey(result), "192.0.2.8:2222");
  assert.equal(
    defaultDiscoveryConnectionName(result),
    "cisco_ios-192-0-2-8-2222",
  );
  assert.equal(discoveryResultCanImport(result), true);
  assert.equal(
    discoveryResultCanImport({ ...result, imported_connection_name: "edge-8" }),
    false,
  );
  assert.equal(
    discoveryResultCanImport({
      ...result,
      existing_connection_name: "existing-edge",
    }),
    false,
  );
  assert.equal(discoveryResultStatus(result), "identified");
  assert.equal(
    discoveryResultStatus({
      ...result,
      existing_connection_name: "existing-edge",
    }),
    "existing",
  );
  assert.equal(
    discoveryResultStatus({
      ...result,
      existing_connection_name: "existing-edge",
      imported_connection_name: "edge-8",
    }),
    "imported",
  );
  assert.equal(
    defaultDiscoveryConnectionName({
      ...result,
      existing_connection_name: "existing-edge",
    }),
    "existing-edge",
  );
});

test("discovery import selection retains failed and newly identified devices", () => {
  const results = [
    {
      host: "192.0.2.1",
      port: 22,
      status: "identified",
      imported_connection_name: "saved-device",
    },
    { host: "192.0.2.2", port: 22, status: "identified" },
    { host: "192.0.2.3", port: 22, status: "identified" },
    {
      host: "192.0.2.4",
      port: 22,
      status: "identified",
      existing_connection_name: "existing-device",
    },
  ];

  assert.deepEqual(
    retainImportableDiscoveryResultKeys(
      ["192.0.2.1:22", "192.0.2.2:22", "192.0.2.3:22", "192.0.2.4:22"],
      results,
    ),
    ["192.0.2.2:22", "192.0.2.3:22"],
  );
});

test("discovery run activity and result filters follow persisted states", () => {
  assert.equal(discoveryRunIsActive({ status: "queued" }), true);
  assert.equal(discoveryRunIsActive({ status: "cancelling" }), true);
  assert.equal(discoveryRunIsActive({ status: "completed" }), false);

  const rows = [
    {
      host: "192.0.2.1",
      port: 22,
      status: "identified",
      device_model: "Router A",
    },
    {
      host: "192.0.2.2",
      port: 22,
      status: "identified",
      existing_connection_name: "saved-router",
    },
    { host: "192.0.2.3", port: 22, status: "probe_failed" },
    { host: "192.0.2.5", port: 22, status: "not_ssh" },
    { host: "192.0.2.6", port: 22, status: "cancelled" },
    {
      host: "192.0.2.4",
      port: 22,
      status: "identified",
      imported_connection_name: "new-router",
    },
  ];

  assert.deepEqual(
    filterDiscoveryResults(rows, "identified").map((row) => row.host),
    ["192.0.2.1"],
  );
  assert.deepEqual(
    filterDiscoveryResults(rows, "reachable").map((row) => row.host),
    ["192.0.2.1", "192.0.2.2", "192.0.2.3", "192.0.2.4"],
  );
  assert.deepEqual(
    filterDiscoveryResults(rows, "ready").map((row) => row.host),
    ["192.0.2.1"],
  );
  assert.deepEqual(
    filterDiscoveryResults(rows, "existing").map((row) => row.host),
    ["192.0.2.2"],
  );
  assert.deepEqual(
    filterDiscoveryResults(rows, "failed").map((row) => row.host),
    ["192.0.2.3", "192.0.2.5"],
  );
  assert.deepEqual(
    filterDiscoveryResults(rows, "imported").map((row) => row.host),
    ["192.0.2.4"],
  );
  assert.deepEqual(
    filterDiscoveryResults(rows, "all", "router a").map((row) => row.host),
    ["192.0.2.1"],
  );
  assert.deepEqual(
    filterDiscoveryResults(rows, "all", "", "existing").map((row) => row.host),
    ["192.0.2.2"],
  );
  assert.deepEqual(
    filterDiscoveryResults(rows, "all", "", "identified").map(
      (row) => row.host,
    ),
    ["192.0.2.1"],
  );
});
