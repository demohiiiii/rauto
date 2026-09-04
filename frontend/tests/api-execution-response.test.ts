import assert from "node:assert/strict";
import test from "node:test";

import { unwrapExecutionResponse } from "../src/api/client.js";

test("execution response unwraps data and retains authoritative metadata", () => {
  const resultSummary = {
    operation: "exec",
    outcome: "success",
    success: true,
    summary: "Execution completed",
  } as const;
  const data = unwrapExecutionResponse<{ output: string }>({
    success: true,
    error: null,
    result_summary: resultSummary,
    data: { output: "ok" },
  });

  assert.equal(data.output, "ok");
  assert.deepEqual(data.result_summary, resultSummary);
  assert.equal(Object.keys(data).includes("result_summary"), false);
  assert.deepEqual(data.execution_response, {
    success: true,
    error: null,
    result_summary: resultSummary,
  });
});

test("business failure preserves partial data instead of throwing", () => {
  const data = unwrapExecutionResponse<{
    results: Array<{ error: string; target: string }>;
  }>({
    success: false,
    error: { code: "partial_failure", message: "One target failed" },
    result_summary: {
      operation: "exec",
      outcome: "partial_success",
      success: false,
      summary: "One target failed",
    },
    data: { results: [{ target: "edge-1", error: "timed out" }] },
  });

  assert.equal(data.results.length, 1);
  assert.equal(data.execution_response.success, false);
  assert.equal(data.execution_response.error?.code, "partial_failure");
});

test("malformed execution response is rejected", () => {
  assert.throws(
    () => unwrapExecutionResponse({ success: true, data: {} }),
    /Invalid execution response/,
  );
});

test("execution response rejects malformed metadata", () => {
  assert.throws(
    () =>
      unwrapExecutionResponse({
        success: false,
        error: { code: "failed" },
        result_summary: null,
        data: {},
      }),
    /Invalid execution response/,
  );
  assert.throws(
    () =>
      unwrapExecutionResponse({
        success: true,
        error: null,
        result_summary: {
          operation: "unsupported",
          outcome: "success",
          success: true,
          summary: "Execution completed",
        },
        data: {},
      }),
    /Invalid execution response/,
  );
});
