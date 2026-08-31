import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  executionResultFailed,
  executionResultOutputText,
} from "../src/modules/operations/results.js";

test("execution result failures include errors, false success, and non-zero exits", () => {
  assert.equal(
    executionResultFailed({
      success: true,
      execution_response: { success: false },
    }),
    true,
  );
  assert.equal(
    executionResultFailed({
      error: "legacy error",
      execution_response: { success: true },
    }),
    false,
  );
  assert.equal(executionResultFailed({ error: "connection closed" }), true);
  assert.equal(executionResultFailed({ success: false }), true);
  assert.equal(
    executionResultFailed({ result_summary: { success: false } }),
    true,
  );
  assert.equal(executionResultFailed({ exit_code: 1 }), true);
  assert.equal(executionResultFailed({ exit_code: "2" }), true);
  assert.equal(executionResultFailed({ success: true, exit_code: 0 }), false);
  assert.equal(executionResultFailed({ error: null, exit_code: null }), false);
});

test("execution result output selects diagnostic or prompt-free content explicitly", () => {
  assert.equal(
    executionResultOutputText({
      all: "command\nfull output\nprompt",
      output: "full output",
      error: "failed",
    }),
    "command\nfull output\nprompt",
  );
  assert.equal(
    executionResultOutputText(
      { all: "command\nprompt", output: "" },
      "output",
      { preferTranscript: false },
    ),
    "",
  );
  assert.equal(
    executionResultOutputText(
      {
        all: "command\nfull output\nprompt",
        output: "full output",
        error: "failed",
      },
      "output",
      { preferTranscript: false },
    ),
    "full output",
  );
  assert.equal(
    executionResultOutputText({ output: "command output", error: "failed" }),
    "command output",
  );
  assert.equal(
    executionResultOutputText({ error: "connection failed" }),
    "connection failed",
  );
  assert.equal(
    executionResultOutputText({ content: "config output" }, "content"),
    "config output",
  );
});

test("batch command and show result views use the shared failure decision", () => {
  const batchExec = readFileSync(
    "frontend/src/pages/batch/BatchExecPanel.svelte",
    "utf8",
  );
  const showWorkspace = readFileSync(
    "frontend/src/domains/show/application/createShowWorkspaces.ts",
    "utf8",
  );
  const singleShow = readFileSync(
    "frontend/src/pages/show/SingleShowPanel.svelte",
    "utf8",
  );
  const batchShow = readFileSync(
    "frontend/src/pages/show/BatchShowResultsPanel.svelte",
    "utf8",
  );

  assert.match(batchExec, /executionResultFailed/);
  assert.equal(showWorkspace.match(/executionResultFailed\(/g)?.length, 2);
  assert.match(singleShow, /row\.failed/);
  assert.match(batchShow, /objectRow\.failed/);
});
