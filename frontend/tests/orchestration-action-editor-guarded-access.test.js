import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("frontend/src/pages/orchestrated");
const files = ["OrchestrationTxWorkflowActionEditor.svelte"];

test("orchestration action editors avoid unguarded job.action access", async () => {
  const entries = await Promise.all(
    files.map(async (fileName) => ({
      fileName,
      source: await readFile(path.join(root, fileName), "utf8"),
    })),
  );

  for (const { fileName, source } of entries) {
    assert.equal(
      source.includes(".job.action."),
      false,
      `${fileName} should guard job/action lookups during initial render`,
    );
  }
});
