import assert from "node:assert/strict";
import test from "node:test";

import { commandExecutionPayload } from "../src/domains/standard/index.js";

test("standard command payload includes explicit multiline mode", () => {
  assert.deepEqual(
    commandExecutionPayload({
      content: "show version\nshow inventory",
      connection: { connection_name: "edge-01" },
      mode: "Enable",
      multilineMode: "whole",
      recordLevel: "key-events-only",
      textfsm: { parse_textfsm: false },
    }),
    {
      template_content: "show version\nshow inventory",
      vars: {},
      connection: { connection_name: "edge-01" },
      mode: "Enable",
      multiline_mode: "whole",
      parse_textfsm: false,
      record_level: "key-events-only",
    },
  );
});

test("standard command payload defaults an omitted multiline mode to split lines", () => {
  const payload = commandExecutionPayload({ content: "show version" });

  assert.equal(payload.multiline_mode, "split_lines");
});
