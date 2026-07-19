import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { commandExecutionPayload } from "../src/modules/standard/standardCommandExecutionWorkspace.js";

function read(path) {
  return readFileSync(path, "utf8");
}

test("standard command payload includes explicit multiline mode", () => {
  assert.deepEqual(
    commandExecutionPayload({
      content: "show version\nshow inventory",
      connection: { connection_name: "edge-01" },
      mode: "Enable",
      multilineMode: "whole",
      recordLevel: "key_events",
      textfsm: { parse_textfsm: false },
    }),
    {
      template_content: "show version\nshow inventory",
      vars: {},
      connection: { connection_name: "edge-01" },
      mode: "Enable",
      multiline_mode: "whole",
      parse_textfsm: false,
      record_level: "key_events",
    },
  );
});

test("standard command payload defaults invalid multiline modes to split lines", () => {
  const payload = commandExecutionPayload({ content: "show version" });

  assert.equal(payload.multiline_mode, "split_lines");
});

test("standard command workspace retains rendered child outputs", () => {
  const panel = read(
    "frontend/src/pages/standard/CommandExecutionPanel.svelte",
  );
  const workspace = read(
    "frontend/src/modules/standard/standardCommandExecutionWorkspace.js",
  );

  assert.match(workspace, /resultPayload: response/);
  assert.match(panel, /resultPayload\?\.executed/);
  assert.match(panel, /\{#each executedItems as item/);
});

test("standard command editor uses shared multiline command controls", () => {
  const panel = read(
    "frontend/src/pages/standard/CommandExecutionPanel.svelte",
  );
  const workspace = read(
    "frontend/src/modules/standard/standardCommandExecutionWorkspace.js",
  );

  assert.match(panel, /CommandEditor/);
  assert.match(panel, /changeMultilineMode/);
  assert.match(workspace, /multilineMode: "split_lines"/);
});
