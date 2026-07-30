import assert from "node:assert/strict";
import test from "node:test";

import { unwrapExecutionResponse } from "../src/api/client.js";

test("execution response unwraps data and retains authoritative metadata", () => {
  const data = unwrapExecutionResponse({
    success: true,
    error: null,
    result_summary: { outcome: "success", success: true },
    data: { output: "ok" },
  });

  assert.equal(data.output, "ok");
  assert.deepEqual(data.result_summary, {
    outcome: "success",
    success: true,
  });
  assert.equal(Object.keys(data).includes("result_summary"), false);
  assert.deepEqual(data.execution_response, {
    success: true,
    error: null,
    result_summary: { outcome: "success", success: true },
  });
});

test("business failure preserves partial data instead of throwing", () => {
  const data = unwrapExecutionResponse({
    success: false,
    error: { code: "partial_failure", message: "One target failed" },
    result_summary: { outcome: "partial_success", success: false },
    data: { results: [{ target: "edge-1", error: "timed out" }] },
  });

  assert.equal(data.results.length, 1);
  assert.equal(data.execution_response.success, false);
  assert.equal(data.execution_response.error.code, "partial_failure");
});

test("malformed execution response is rejected", () => {
  assert.throws(
    () => unwrapExecutionResponse({ success: true, data: {} }),
    /Invalid execution response/,
  );
});
