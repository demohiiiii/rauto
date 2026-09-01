import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  executionResultFailed,
  executionResultOutputText,
  parsedOutputBlockDisplay,
  parsedOutputSheetsFromBatchShow,
} from "../src/domains/execution/index.ts";

test("execution results use the execution domain boundary", () => {
  const domainIndex = readFileSync(
    "frontend/src/domains/execution/index.ts",
    "utf8",
  );
  const resultModel = readFileSync(
    "frontend/src/domains/execution/model/executionResult.ts",
    "utf8",
  );
  const exportApplication = readFileSync(
    "frontend/src/domains/execution/application/exportParsedOutput.ts",
    "utf8",
  );

  assert.match(domainIndex, /model\/executionResult\.js/);
  assert.match(domainIndex, /presentation\/executionResultPresentation\.js/);
  assert.match(domainIndex, /application\/exportParsedOutput\.js/);
  assert.doesNotMatch(resultModel, /api\/client|modules\//);
  assert.match(exportApplication, /infrastructure\/executionResultApi\.js/);
});

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

test("batch show parsed sheets preserve source metadata and conflicting fields", () => {
  assert.deepEqual(
    parsedOutputSheetsFromBatchShow({
      object: "interfaces",
      results: [
        {
          command: "show interfaces",
          object: "interfaces",
          parsed_output: [{ device: "parsed-device", status: "up" }],
          profile: "cisco_ios",
          target: "edge-1",
        },
      ],
    }),
    [
      {
        name: "interfaces",
        parsed_output: [
          {
            command: "show interfaces",
            device: "edge-1",
            object: "interfaces",
            parsed_device: "parsed-device",
            profile: "cisco_ios",
            status: "up",
          },
        ],
      },
    ],
  );
});

test("parsed output presentation distinguishes tables, JSON, and parse errors", () => {
  const table = parsedOutputBlockDisplay({
    exportItem: { parsed_output: [] },
    parsedOutput: [{ name: "Gi0/1", tags: ["wan", "up"] }],
  });
  assert.equal(table.canExport, true);
  assert.equal(table.showTable, true);
  assert.deepEqual(table.tableColumns, ["name", "tags"]);
  assert.deepEqual(table.tableRows, [{ cells: ["Gi0/1", "wan, up"] }]);

  const json = parsedOutputBlockDisplay({ parsedOutput: { count: 1 } });
  assert.equal(json.showJson, true);
  assert.equal(json.jsonOutput, '{\n  "count": 1\n}');

  const error = parsedOutputBlockDisplay({ parseError: "invalid row" });
  assert.equal(error.hasParseError, true);
  assert.equal(error.parseErrorText, "invalid row");
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
