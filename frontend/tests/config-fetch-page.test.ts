import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import {
  CONFIG_FETCH_CONTENT_VIEW,
  CONFIG_FETCH_TARGET_MODE,
  configFetchContent,
  configFetchCurrentPayload,
  configFetchDownloadDescriptor,
  configFetchKindAvailable,
  configFetchKindOptions,
  configFetchPayload,
  configFetchResultCounts,
  configFetchTimestamp,
  createConfigFetchWorkspace,
  normalizeConfigFetchMaxParallel,
  normalizeConfigFetchTargetMode,
  singleConfigFetchResultPayload,
} from "../src/domains/config-fetch/index.js";
import type {
  ConfigCommandRow,
  ConfigFetchCurrentPayload,
  ConfigFetchExecutionResponse,
  ConfigFetchResultRow,
  ConfigFetchSingleResult,
} from "../src/domains/config-fetch/model/types.js";
import type { TaskResultSummary } from "../src/domains/tasks/index.js";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function configCommand(
  kind: string,
  deviceProfile = "cisco_ios",
): ConfigCommandRow {
  return {
    command: `show ${kind}-config`,
    device_profile: deviceProfile,
    kind,
    mode: null,
    source: "builtin",
  };
}

function taskSummary(
  overrides: Partial<TaskResultSummary> = {},
): TaskResultSummary {
  return {
    counts: { failed: 0, succeeded: 1, total: 1 },
    operation: "exec",
    outcome: "success",
    success: true,
    summary: "Configuration fetched successfully",
    ...overrides,
  };
}

function executionResponse(
  resultSummary: TaskResultSummary,
  error: ConfigFetchExecutionResponse["error"] = null,
): ConfigFetchExecutionResponse {
  return {
    error,
    result_summary: resultSummary,
    success: resultSummary.success,
  };
}

function configResult(
  overrides: Partial<ConfigFetchResultRow> = {},
): ConfigFetchResultRow {
  return {
    all: "hostname edge-01\n",
    command: "show running-config",
    content: "hostname edge-01\n",
    error: null,
    fetched_at: "2026-07-28T04:15:00Z",
    host: "192.0.2.10",
    kind: "running",
    normalized_content: null,
    normalized_sha256: null,
    profile: "cisco_ios",
    sha256: "raw-sha256",
    target: "edge-01",
    ...overrides,
  };
}

function singleResult(
  rowOverrides: Partial<ConfigFetchResultRow> = {},
  summaryOverrides: Partial<TaskResultSummary> = {},
  error: ConfigFetchExecutionResponse["error"] = null,
): ConfigFetchSingleResult {
  const resultSummary = taskSummary(summaryOverrides);
  return {
    ...configResult(rowOverrides),
    execution_response: executionResponse(resultSummary, error),
    result_summary: resultSummary,
  };
}

test("configuration fetch ignores an obsolete command catalog response", async () => {
  const requests: Array<{
    profile: string | undefined;
    resolve: (rows: ConfigCommandRow[]) => void;
  }> = [];
  const workspace = createConfigFetchWorkspace({
    api: {
      listConfigCommands(profile) {
        const request = deferred<ConfigCommandRow[]>();
        requests.push({ profile, resolve: request.resolve });
        return request.promise;
      },
    },
  });

  const first = workspace.loadKindOptions("cisco_ios");
  const second = workspace.loadKindOptions("huawei_vrp");
  requests[1].resolve([configCommand("startup", "huawei_vrp")]);
  await second;
  requests[0].resolve([configCommand("running")]);
  await first;

  assert.deepEqual(get(workspace.kindCatalogState), {
    kind: "ready",
    options: [{ label: "startup", value: "startup" }],
    profile: "huawei_vrp",
  });
  assert.equal(get(workspace.formState).kind, "startup");
});

test("configuration fetch executes the current target through domain ports", async () => {
  let receivedPayload: ConfigFetchCurrentPayload | null = null;
  const workspace = createConfigFetchWorkspace({
    api: {
      async fetchConfig(payload) {
        receivedPayload = payload;
        return singleResult({ kind: payload.kind });
      },
      async listConfigCommands() {
        return [configCommand("running")];
      },
    },
    runtime: {
      connectionPayload: () => ({ connection_name: "edge-01" }),
      ensureConnectionTargetSelected: () => true,
      recordLevelPayload: () => "full",
      retryRequestFields: () => ({}),
    },
  });

  await workspace.loadKindOptions("cisco_ios");
  await workspace.execute();

  assert.deepEqual(receivedPayload, {
    kind: "running",
    include_normalized: false,
    connection: { connection_name: "edge-01" },
    record_level: "full",
  });
  assert.equal(get(workspace.resultState).kind, "result");
});

test("configuration fetch payload matches the batch API contract", () => {
  assert.deepEqual(
    configFetchPayload(
      {
        includeNormalized: true,
        kind: " running ",
        maxParallel: "6",
      },
      {
        targets: ["edge-01"],
        groups: ["campus"],
        labels: ["core"],
      },
      "full",
    ),
    {
      kind: "running",
      include_normalized: true,
      targets: ["edge-01"],
      groups: ["campus"],
      labels: ["core"],
      max_parallel: 6,
      record_level: "full",
    },
  );

  assert.equal(normalizeConfigFetchMaxParallel("0"), null);
  assert.equal(normalizeConfigFetchMaxParallel("invalid"), null);
});

test("configuration fetch supports the current console connection", () => {
  assert.deepEqual(
    configFetchCurrentPayload(
      { includeNormalized: false, kind: " startup " },
      {
        connection_name: null,
        host: "192.0.2.10",
        credential_id: "lab",
        device_profile: "cisco_ios",
      },
      "key-events-only",
    ),
    {
      kind: "startup",
      include_normalized: false,
      connection: {
        connection_name: null,
        host: "192.0.2.10",
        credential_id: "lab",
        device_profile: "cisco_ios",
      },
      record_level: "key-events-only",
    },
  );

  assert.deepEqual(
    configFetchKindOptions([
      configCommand("startup"),
      configCommand("running"),
      configCommand("running", "huawei_vrp"),
      configCommand("", "huawei_vrp"),
    ]),
    [
      { label: "running", value: "running" },
      { label: "startup", value: "startup" },
    ],
  );
});

test("configuration fetch keeps a required target mode", () => {
  assert.equal(
    normalizeConfigFetchTargetMode(CONFIG_FETCH_TARGET_MODE.batch),
    CONFIG_FETCH_TARGET_MODE.batch,
  );
  assert.equal(
    normalizeConfigFetchTargetMode(""),
    CONFIG_FETCH_TARGET_MODE.current,
  );
  assert.equal(normalizeConfigFetchTargetMode("", ""), "");
});

test("configuration fetch only enables catalog-backed kinds", () => {
  const readyCatalog = {
    kind: "ready" as const,
    options: [
      { label: "running", value: "running" },
      { label: "startup", value: "startup" },
    ],
  };

  assert.equal(configFetchKindAvailable(readyCatalog, "running"), true);
  assert.equal(configFetchKindAvailable(readyCatalog, "candidate"), false);
  assert.equal(
    configFetchKindAvailable({ ...readyCatalog, kind: "loading" }, "running"),
    false,
  );
  assert.equal(
    configFetchKindAvailable(
      { ...readyCatalog, kind: "error", options: [] },
      "running",
    ),
    false,
  );
});

test("configuration fetch results support summary fallback and both content views", () => {
  const resultRows = [
    configResult({
      content: "raw config\n",
      normalized_content: "normalized config\n",
    }),
    configResult({
      all: null,
      content: null,
      error: "connection failed",
      target: "edge-02",
    }),
  ];

  assert.deepEqual(configFetchResultCounts({ results: resultRows }), {
    total: 2,
    succeeded: 1,
    failed: 1,
  });
  assert.equal(
    configFetchContent(resultRows[0], CONFIG_FETCH_CONTENT_VIEW.raw),
    "raw config\n",
  );
  assert.equal(
    configFetchContent(resultRows[0], CONFIG_FETCH_CONTENT_VIEW.normalized),
    "normalized config\n",
  );
  assert.equal(
    configFetchContent(
      configResult({
        all: "show running-config\nERROR: forced failure\nRouter#",
        content: "ERROR: forced failure",
        error: "config fetch failed",
      }),
      CONFIG_FETCH_CONTENT_VIEW.raw,
    ),
    "show running-config\nERROR: forced failure\nRouter#",
  );
  assert.equal(
    configFetchContent(
      configResult({ all: null, content: null, error: "connection failed" }),
    ),
    "connection failed",
  );
  assert.notEqual(configFetchTimestamp("2026-07-28T12:00:00Z"), "-");
  assert.equal(configFetchTimestamp("not-a-time"), "-");

  const failedSummary = taskSummary({
    counts: { total: 1, succeeded: 0, failed: 1 },
    outcome: "failed",
    success: false,
    summary: "Configuration fetch command failed",
  });
  const singleFailure = singleConfigFetchResultPayload({
    ...configResult({ error: "connection failed" }),
    result_summary: failedSummary,
    execution_response: executionResponse(failedSummary, {
      code: "execution_failed",
      message: "fetch failed",
    }),
  });
  assert.deepEqual(configFetchResultCounts(singleFailure), {
    total: 1,
    succeeded: 0,
    failed: 1,
  });
  assert.equal(singleFailure.execution_response.success, false);
  assert.equal(singleFailure.result_summary.success, false);
});

test("configuration fetch downloads the selected raw or normalized content", () => {
  const row = configResult({
    target: "edge core/01",
    normalized_content: "hostname edge-01\n",
  });

  assert.deepEqual(
    configFetchDownloadDescriptor(row, CONFIG_FETCH_CONTENT_VIEW.raw),
    {
      content: "hostname edge-01\n",
      filename: "edge_core_01_running_20260728T041500Z.cfg",
    },
  );
  assert.deepEqual(
    configFetchDownloadDescriptor(row, CONFIG_FETCH_CONTENT_VIEW.normalized),
    {
      content: "hostname edge-01\n",
      filename: "edge_core_01_running_normalized_20260728T041500Z.cfg",
    },
  );
  assert.equal(
    configFetchDownloadDescriptor(
      { ...row, normalized_content: null },
      CONFIG_FETCH_CONTENT_VIEW.normalized,
    ),
    null,
  );
});
