import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import {
  createDeviceDiscoveryWorkspace,
  defaultDiscoveryConnectionName,
  discoveryResultCanImport,
  discoveryResultKey,
  discoveryResultStatus,
  discoveryRunIsActive,
  filterDiscoveryResults,
  parseDiscoveryPorts,
  retainImportableDiscoveryResultKeys,
} from "../src/domains/device-discovery/index.js";
import type {
  CreateDiscoveryRunPayload,
  DiscoveryResult,
  DiscoveryRun,
  ImportDiscoveryItem,
} from "../src/domains/device-discovery/index.js";

function discoveryRun(overrides: Partial<DiscoveryRun> = {}): DiscoveryRun {
  return {
    completed_at_ms: null,
    id: "run-1",
    status: "completed",
    phase: "completed",
    targets: ["192.0.2.0/24"],
    ports: [22],
    credential_ids: ["credential-1"],
    default_groups: [],
    default_labels: [],
    error: null,
    concurrency: 32,
    tcp_timeout_ms: 1000,
    probe_timeout_secs: 15,
    total_targets: 1,
    scanned_targets: 1,
    started_at_ms: null,
    reachable_count: 1,
    probed_targets: 1,
    identified_count: 1,
    failed_count: 0,
    created_at_ms: 1,
    ...overrides,
  };
}

function discoveryResult(
  overrides: Partial<DiscoveryResult> & Pick<DiscoveryResult, "host">,
): DiscoveryResult {
  return {
    credential_id: null,
    device_model: null,
    device_profile: null,
    error: null,
    existing_connection_name: null,
    imported_connection_name: null,
    latency_ms: null,
    port: 22,
    run_id: "run-1",
    software_version: null,
    status: "identified",
    updated_at_ms: 1,
    ...overrides,
  };
}

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
  const result = discoveryResult({
    host: "192.0.2.8",
    port: 2222,
    status: "identified",
    device_profile: "cisco_ios",
  });
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
  const results: DiscoveryResult[] = [
    discoveryResult({
      host: "192.0.2.1",
      imported_connection_name: "saved-device",
    }),
    discoveryResult({ host: "192.0.2.2" }),
    discoveryResult({ host: "192.0.2.3" }),
    discoveryResult({
      host: "192.0.2.4",
      existing_connection_name: "existing-device",
    }),
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

  const rows: DiscoveryResult[] = [
    discoveryResult({
      host: "192.0.2.1",
      device_model: "Router A",
    }),
    discoveryResult({
      host: "192.0.2.2",
      existing_connection_name: "saved-router",
    }),
    discoveryResult({ host: "192.0.2.3", status: "probe_failed" }),
    discoveryResult({ host: "192.0.2.5", status: "not_ssh" }),
    discoveryResult({ host: "192.0.2.6", status: "cancelled" }),
    discoveryResult({
      host: "192.0.2.4",
      imported_connection_name: "new-router",
    }),
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

test("discovery workspace initializes catalogs and the latest run once", async () => {
  let credentialCalls = 0;
  const run = discoveryRun();
  const workspace = createDeviceDiscoveryWorkspace({
    api: {
      async getRun() {
        return { run, results: [] };
      },
      async listCredentials() {
        credentialCalls += 1;
        return [{ id: "credential-1", name: "lab", username: "automation" }];
      },
      async listGroups() {
        return [{ name: "campus" }];
      },
      async listLabels() {
        return [{ name: "core" }];
      },
      async listRuns() {
        return [run];
      },
    },
  });

  await workspace.setPageContext({ active: true });
  await workspace.setPageContext({ active: true });

  const state = get(workspace.stateStore);
  assert.equal(credentialCalls, 1);
  assert.deepEqual(state.selectedCredentialIds, ["credential-1"]);
  assert.ok(state.currentDetail);
  assert.equal(state.currentDetail.run.id, "run-1");
  workspace.destroy();
});

test("discovery workspace creates runs from its typed form state", async () => {
  let receivedPayload: CreateDiscoveryRunPayload | null = null;
  const run = discoveryRun({
    id: "run-2",
    status: "queued",
    phase: "tcp_scan",
  });
  const workspace = createDeviceDiscoveryWorkspace({
    api: {
      async createRun(payload) {
        receivedPayload = payload;
        return { run, results: [] };
      },
    },
    pollIntervalMs: 60_000,
  });
  workspace.setFormField("targetsText", "192.0.2.10\n192.0.2.11");
  workspace.setFormField("portsText", "22, 2222");
  workspace.setFormField("selectedCredentialIds", ["credential-1"]);
  workspace.setFormField("selectedGroups", ["campus"]);
  workspace.setFormField("selectedLabels", ["core"]);

  await workspace.startDiscovery();

  assert.deepEqual(receivedPayload, {
    targets: ["192.0.2.10", "192.0.2.11"],
    ports: [22, 2222],
    credential_ids: ["credential-1"],
    default_groups: ["campus"],
    default_labels: ["core"],
    concurrency: 32,
    tcp_timeout_ms: 1000,
    probe_timeout_secs: 15,
  });
  const detail = get(workspace.stateStore).currentDetail;
  assert.ok(detail);
  assert.equal(detail.run.id, "run-2");
  workspace.destroy();
});

test("discovery workspace imports selected results and refreshes connections", async () => {
  const run = discoveryRun();
  const identified = discoveryResult({
    host: "192.0.2.8",
    device_profile: "cisco_ios",
    credential_id: "credential-1",
  });
  let importedItems: ImportDiscoveryItem[] | null = null;
  let getRunCalls = 0;
  let refreshCalls = 0;
  const workspace = createDeviceDiscoveryWorkspace({
    api: {
      async getRun() {
        getRunCalls += 1;
        return {
          run,
          results:
            getRunCalls === 1
              ? [identified]
              : [
                  {
                    ...identified,
                    imported_connection_name: "cisco_ios-192-0-2-8",
                  },
                ],
        };
      },
      async importResults(_runId, items) {
        importedItems = items;
        return {
          created: 1,
          failed: 0,
          results: [],
          skipped: 0,
          total: 1,
          updated: 0,
        };
      },
      async listCredentials() {
        return [];
      },
      async listGroups() {
        return [];
      },
      async listLabels() {
        return [];
      },
      async listRuns() {
        return [run];
      },
    },
    runtime: {
      notifyConnectionsRefreshed() {
        refreshCalls += 1;
      },
    },
  });

  await workspace.setPageContext({ active: true });
  await workspace.importSelected();

  assert.deepEqual(importedItems, [
    {
      host: "192.0.2.8",
      port: 22,
      connection_name: "cisco_ios-192-0-2-8",
      credential_id: "credential-1",
      overwrite: false,
    },
  ]);
  assert.equal(refreshCalls, 1);
  assert.deepEqual(get(workspace.stateStore).selectedResultKeys, []);
  workspace.destroy();
});
