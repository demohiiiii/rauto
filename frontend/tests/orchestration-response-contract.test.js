import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("orchestration execution responses contain no legacy inventory snapshot", () => {
  const responseSource = read("src/web/models/execution.rs");
  const handlerSource = read("src/web/handlers/execute/orchestration.rs");

  assert.doesNotMatch(responseSource, /pub inventory: Value/);
  assert.doesNotMatch(handlerSource, /inventory_value|&inventory/);
});
