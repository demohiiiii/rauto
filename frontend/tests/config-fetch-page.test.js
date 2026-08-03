import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
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
  normalizeConfigFetchTargetMode,
  normalizeConfigFetchMaxParallel,
  singleConfigFetchResultPayload,
} from "../src/modules/operations/configFetch.js";

function read(path) {
  return readFileSync(path, "utf8");
}

test("configuration fetch is a dedicated dashboard operation", () => {
  const navigation = read("frontend/src/config/dashboardNavigation.js");
  const sidebar = read(
    "frontend/src/components/layout/DashboardSidebar.svelte",
  );
  const api = read("frontend/src/api/client.js");

  assert.match(navigation, /id: "config-fetch"/);
  assert.match(navigation, /path: "\/app\/config-fetch"/);
  assert.match(navigation, /import\("\.\.\/pages\/ConfigFetchPage\.svelte"\)/);
  assert.match(sidebar, /"config-fetch": FileDownIcon/);
  assert.match(api, /fetchConfigBatch/);
  assert.match(api, /POST", "\/api\/config\/batch-fetch"/);
  assert.match(api, /fetchConfig/);
  assert.match(api, /POST", "\/api\/config\/fetch"/);
  assert.match(api, /listConfigCommands/);
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
      { device_profile: "cisco_ios", kind: "startup" },
      { device_profile: "cisco_ios", kind: "running" },
      { device_profile: "huawei_vrp", kind: "running" },
      { device_profile: "huawei_vrp", kind: "" },
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
    kind: "ready",
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
  const resultPayload = {
    results: [
      {
        target: "edge-01",
        content: "raw config\n",
        normalized_content: "normalized config\n",
        error: null,
      },
      { target: "edge-02", content: null, error: "connection failed" },
    ],
  };

  assert.deepEqual(configFetchResultCounts(resultPayload), {
    total: 2,
    succeeded: 1,
    failed: 1,
  });
  assert.equal(
    configFetchContent(resultPayload.results[0], CONFIG_FETCH_CONTENT_VIEW.raw),
    "raw config\n",
  );
  assert.equal(
    configFetchContent(
      resultPayload.results[0],
      CONFIG_FETCH_CONTENT_VIEW.normalized,
    ),
    "normalized config\n",
  );
  assert.equal(
    configFetchContent(
      {
        all: "show running-config\nERROR: forced failure\nRouter#",
        content: "ERROR: forced failure",
        error: "config fetch failed",
      },
      CONFIG_FETCH_CONTENT_VIEW.raw,
    ),
    "show running-config\nERROR: forced failure\nRouter#",
  );
  assert.equal(
    configFetchContent({ error: "connection failed" }),
    "connection failed",
  );
  assert.notEqual(configFetchTimestamp("2026-07-28T12:00:00Z"), "-");
  assert.equal(configFetchTimestamp("not-a-time"), "-");

  assert.deepEqual(
    configFetchResultCounts(
      singleConfigFetchResultPayload({
        target: "edge-01",
        kind: "running",
        error: "connection failed",
      }),
    ),
    { total: 1, succeeded: 0, failed: 1 },
  );

  const singleFailure = singleConfigFetchResultPayload({
    target: "edge-01",
    kind: "running",
    error: "connection failed",
    result_summary: {
      success: false,
      counts: { total: 1, succeeded: 0, failed: 1 },
    },
    execution_response: {
      success: false,
      error: { code: "execution_failed", message: "fetch failed" },
    },
  });
  assert.equal(singleFailure.execution_response.success, false);
  assert.equal(singleFailure.result_summary.success, false);
});

test("configuration fetch downloads the selected raw or normalized content", () => {
  const row = {
    target: "edge core/01",
    kind: "running",
    fetched_at: "2026-07-28T04:15:00Z",
    content: "hostname edge-01\n",
    normalized_content: "hostname edge-01\n",
    error: null,
  };

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

test("configuration fetch page renders target controls and device results", () => {
  const page = read("frontend/src/pages/ConfigFetchPage.svelte");
  const connectionState = read(
    "frontend/src/modules/connections/connectionFieldStoreState.js",
  );

  assert.match(page, /<ConnectionPickerField/);
  assert.match(page, /<ValueLabelSelectField/);
  assert.match(page, /<DownloadIcon/);
  assert.match(page, /downloadConfigFetchResult/);
  assert.match(page, /<ToggleGroup\.Root/);
  assert.match(page, /bind:value=\{targetModeValue\}/);
  assert.match(page, /disabled=\{!kindAvailable \|\| !retryValid\}/);
  assert.match(page, /configFetchCommandMissingTitle/);
  assert.match(page, /id="config-fetch-command-missing"/);
  assert.match(page, /aria-describedby=\{configCommandMissing/);
  assert.match(page, /<Alert\.Root/);
  assert.match(page, /<SessionRetryFields/);
  assert.match(page, /<Separator/);
  assert.match(
    page,
    /grid min-w-0 items-start gap-4 xl:grid-cols-\[minmax\(0,5fr\)_minmax\(20rem,3fr\)\]/,
  );
  assert.match(page, /xl:grid-cols-\[minmax\(0,5fr\)_minmax\(20rem,3fr\)\]/);
  assert.match(page, /<Switch/);
  assert.match(page, /<LoadingButton/);
  assert.match(page, /<OutputBlock/);
  assert.match(page, /tone=\{activeResult\.error \? "error" : "default"\}/);
  assert.doesNotMatch(page, /<StatusCard/);
  assert.match(page, /<TabList/);
  assert.match(page, /ExecutionResultsPanel/);
  assert.match(page, /ExecutionResultMeta/);
  assert.match(page, /CONFIG_FETCH_TARGET_MODE\.current/);
  assert.match(page, /connectionTargetState/);
  assert.match(connectionState, /connectionPicker\.configFetch\.targets/);
  assert.match(connectionState, /connectionPicker\.configFetch\.groups/);
  assert.match(connectionState, /connectionPicker\.configFetch\.labels/);
});
