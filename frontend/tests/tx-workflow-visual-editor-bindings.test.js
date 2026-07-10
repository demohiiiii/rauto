import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const visualEditorPath = path.resolve(
  "frontend/src/pages/orchestrated/TxWorkflowVisualEditor.svelte",
);

test("tx workflow visual editor uses the exported block bindings helper name", async () => {
  const source = await readFile(visualEditorPath, "utf8");

  assert.equal(
    source.includes("workflowActionHandlers.blockActionHandlers("),
    false,
  );
  assert.equal(source.includes("workflowActionHandlers.blockBindings("), true);
});
