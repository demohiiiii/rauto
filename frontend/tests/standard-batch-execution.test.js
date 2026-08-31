import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  batchFlowTemplatePayload,
  buildStandardBatchExecPayload,
  buildStandardBatchFlowPayload,
  normalizeBatchExecMaxParallel,
  parseBatchFlowVars,
} from "../src/domains/standard/index.ts";

const selection = {
  targets: ["edge-01"],
  groups: ["branch"],
  labels: ["production"],
};

test("standard batch execution normalizes positive parallelism", () => {
  assert.equal(normalizeBatchExecMaxParallel(" 4 "), 4);
  assert.equal(normalizeBatchExecMaxParallel("0"), null);
  assert.equal(normalizeBatchExecMaxParallel("-2"), null);
  assert.equal(normalizeBatchExecMaxParallel("invalid"), null);
});

test("batch command payload keeps targets and retry fields", () => {
  assert.deepEqual(
    buildStandardBatchExecPayload(
      {
        command: " show version ",
        maxParallel: "8",
        mode: "Enable",
        retry: {},
      },
      selection,
      { retry: { max_retries: 2 } },
    ),
    {
      command: "show version",
      mode: "Enable",
      targets: ["edge-01"],
      groups: ["branch"],
      labels: ["production"],
      max_parallel: 8,
      retry: { max_retries: 2 },
    },
  );
});

test("batch flow payload distinguishes builtin templates and parses vars", () => {
  assert.deepEqual(batchFlowTemplatePayload("builtin:backup"), {
    builtin_template_name: "backup",
  });
  assert.deepEqual(parseBatchFlowVars('{"path":"/tmp/config"}'), {
    vars: { path: "/tmp/config" },
  });
  assert.equal("error" in parseBatchFlowVars("{"), true);
  assert.deepEqual(
    buildStandardBatchFlowPayload(
      {
        maxParallel: "",
        retry: {},
        template: "deploy",
        varsJson: "",
      },
      selection,
      null,
    ),
    {
      template_name: "deploy",
      targets: ["edge-01"],
      groups: ["branch"],
      labels: ["production"],
    },
  );
});

test("batch pages use the standard domain boundary", () => {
  const pages = [
    "frontend/src/pages/batch/BatchExecPanel.svelte",
    "frontend/src/pages/batch/BatchFlowPanel.svelte",
  ].map((path) => readFileSync(path, "utf8"));
  const model = readFileSync(
    "frontend/src/domains/standard/model/standardBatch.ts",
    "utf8",
  );

  for (const page of pages) {
    assert.match(page, /\$domains\/standard\/index\.js/);
    assert.doesNotMatch(page, /modules\/standard/);
  }
  assert.doesNotMatch(
    model,
    /api\/client|modules\/connections|modules\/overlays/,
  );
});
