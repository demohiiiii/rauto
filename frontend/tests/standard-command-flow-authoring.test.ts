import assert from "node:assert/strict";
import test from "node:test";

import {
  commandFlowExecutionPayload,
  normalizeCommandFlowExecutionSource,
} from "../src/domains/standard/index.js";
import type { StandardCommandFlowExecutionInput } from "../src/domains/standard/index.js";

const commonPayload = {
  connection: { connection_name: "edge-01" },
  recordLevel: "key-events-only",
  textfsm: {
    parse_textfsm: false,
    textfsm_platform: null,
    textfsm_strict_errors: false,
    textfsm_template: null,
  },
  vars: { destination: "/tmp/config" },
} satisfies StandardCommandFlowExecutionInput;

test("saved command flow execution sends template identity without inline content", () => {
  assert.deepEqual(
    commandFlowExecutionPayload({
      ...commonPayload,
      source: {
        kind: "saved",
        templateSelection: "deploy-config",
      },
    }),
    {
      template_name: "deploy-config",
      builtin_template_name: null,
      vars: { destination: "/tmp/config" },
      parse_textfsm: false,
      textfsm_platform: null,
      textfsm_strict_errors: false,
      textfsm_template: null,
      connection: { connection_name: "edge-01" },
      record_level: "key-events-only",
    },
  );
});

test("temporary command flow execution sends inline content without template identity", () => {
  assert.deepEqual(
    commandFlowExecutionPayload({
      ...commonPayload,
      source: {
        content: 'name = "temporary"\nsteps = []\n',
        kind: "temporary",
      },
    }),
    {
      content: 'name = "temporary"\nsteps = []\n',
      vars: { destination: "/tmp/config" },
      parse_textfsm: false,
      textfsm_platform: null,
      textfsm_strict_errors: false,
      textfsm_template: null,
      connection: { connection_name: "edge-01" },
      record_level: "key-events-only",
    },
  );
});

test("command flow execution source rejects incomplete saved and temporary drafts", () => {
  assert.throws(
    () => normalizeCommandFlowExecutionSource({ kind: "saved" }),
    /template/i,
  );
  assert.throws(
    () => normalizeCommandFlowExecutionSource({ kind: "temporary" }),
    /content/i,
  );
});
