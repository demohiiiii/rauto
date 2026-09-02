import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createSessionRetryState,
  sessionRetryRequestFields,
  sessionRetryValidation,
} from "../src/domains/execution/index.ts";
import {
  commandExecutionPayload,
  commandFlowExecutionPayload,
} from "../src/domains/standard/index.ts";

const enabledRetry = {
  ...createSessionRetryState(),
  enabled: true,
  maxRetries: "3",
  initialBackoffMs: "250",
  maxBackoffMs: "4000",
  retryAuthenticationErrors: true,
};

test("disabled session retry keeps the server policy", () => {
  assert.deepEqual(sessionRetryRequestFields(createSessionRetryState()), {});
  assert.equal(sessionRetryValidation(createSessionRetryState()).valid, true);
});

test("enabled session retry serializes bounded integer fields", () => {
  assert.deepEqual(sessionRetryRequestFields(enabledRetry), {
    retry: {
      max_retries: 3,
      initial_backoff_ms: 250,
      max_backoff_ms: 4000,
      retry_authentication_errors: true,
    },
  });
});

test("session retry rejects invalid values before execution", () => {
  assert.equal(
    sessionRetryValidation({
      ...enabledRetry,
      initialBackoffMs: "4001",
      maxBackoffMs: "4000",
    }).valid,
    false,
  );
  assert.throws(() =>
    sessionRetryRequestFields({ ...enabledRetry, maxRetries: "21" }),
  );
});

test("command and command flow payloads share the retry contract", () => {
  assert.deepEqual(
    commandExecutionPayload({ content: "show version", retry: enabledRetry })
      .retry,
    sessionRetryRequestFields(enabledRetry).retry,
  );
  assert.deepEqual(
    commandFlowExecutionPayload({
      connection: {},
      recordLevel: null,
      retry: enabledRetry,
      source: { kind: "saved", templateSelection: "inventory" },
      vars: {},
    }).retry,
    sessionRetryRequestFields(enabledRetry).retry,
  );
});

test("all retryable execution pages mount the shared settings component", () => {
  for (const path of [
    "frontend/src/domains/standard/presentation/components/CommandExecutionPanel.svelte",
    "frontend/src/domains/standard/presentation/components/FlowExecutionPanel.svelte",
    "frontend/src/domains/show/presentation/components/SingleShowPanel.svelte",
    "frontend/src/domains/show/presentation/components/BatchShowInputPanel.svelte",
    "frontend/src/domains/standard/presentation/components/batch/BatchExecPanel.svelte",
    "frontend/src/domains/standard/presentation/components/batch/BatchFlowPanel.svelte",
    "frontend/src/domains/config-fetch/presentation/components/ConfigFetchWorkspace.svelte",
  ]) {
    assert.match(readFileSync(path, "utf8"), /<SessionRetryFields/);
  }
});

test("transaction and upload surfaces do not expose session retry settings", () => {
  for (const path of [
    "frontend/src/domains/transactions/presentation/components/block/TxBlockRunPanel.svelte",
    "frontend/src/domains/transactions/presentation/components/workflow/TxWorkflowRunPanel.svelte",
    "frontend/src/domains/transfer/presentation/components/TransferWorkspace.svelte",
  ]) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /SessionRetryFields/);
  }
});
