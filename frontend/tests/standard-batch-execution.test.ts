import assert from "node:assert/strict";
import test from "node:test";

import {
  batchFlowTemplatePayload,
  buildStandardBatchExecPayload,
  buildStandardBatchFlowPayload,
  normalizeBatchExecMaxParallel,
  parseBatchFlowVars,
} from "../src/domains/standard/index.js";
import type { StandardBatchTargetSelection } from "../src/domains/standard/index.js";
import type { SessionRetryPayload } from "../src/domains/execution/index.js";

const selection: StandardBatchTargetSelection = {
  targets: ["edge-01"],
  groups: ["branch"],
  labels: ["production"],
};

const retry: SessionRetryPayload = {
  initial_backoff_ms: 200,
  max_backoff_ms: 2000,
  max_retries: 2,
  retry_authentication_errors: false,
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
        retry: {
          enabled: true,
          initialBackoffMs: "200",
          maxBackoffMs: "2000",
          maxRetries: "2",
          retryAuthenticationErrors: false,
        },
      },
      selection,
      { retry },
    ),
    {
      command: "show version",
      mode: "Enable",
      targets: ["edge-01"],
      groups: ["branch"],
      labels: ["production"],
      max_parallel: 8,
      retry,
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
        retry: {
          enabled: false,
          initialBackoffMs: "200",
          maxBackoffMs: "2000",
          maxRetries: "1",
          retryAuthenticationErrors: false,
        },
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

test("batch flow payload keeps structured JSON variables and retry options", () => {
  const parsed = parseBatchFlowVars(
    '{"interfaces":["GigabitEthernet0/1"],"enabled":true}',
  );
  assert.ok("vars" in parsed);
  assert.deepEqual(
    buildStandardBatchFlowPayload(
      {
        maxParallel: "3",
        retry: {
          enabled: true,
          initialBackoffMs: "200",
          maxBackoffMs: "2000",
          maxRetries: "2",
          retryAuthenticationErrors: false,
        },
        template: "builtin:deploy",
        varsJson: "",
      },
      selection,
      parsed.vars,
      { retry },
    ),
    {
      builtin_template_name: "deploy",
      groups: ["branch"],
      labels: ["production"],
      max_parallel: 3,
      retry,
      targets: ["edge-01"],
      vars: {
        enabled: true,
        interfaces: ["GigabitEthernet0/1"],
      },
    },
  );
});
