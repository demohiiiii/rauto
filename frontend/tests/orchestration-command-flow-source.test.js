import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { orchestrationCommandFlowVarsPresentation } from "../src/modules/orchestrationActionDisplayState.js";
import {
  orchestrationCommandFlowVarPatch,
  orchestrationCommandFlowVarsFromJson,
} from "../src/modules/orchestrationEditorSourceState.js";

function read(path) {
  return readFileSync(path, "utf8");
}

test("orchestration flow source uses shared template and runtime surfaces", () => {
  const source = read(
    "frontend/src/pages/orchestrated/OrchestrationTxBlockFlowSourceEditor.svelte",
  );

  assert.match(source, /CommandFlowTemplateSource/);
  assert.match(source, /CommandFlowRuntimeFields/);
  assert.doesNotMatch(source, /JsonObjectFieldsEditor/);
});

test("orchestration runtime presentation preserves object order and value kinds", () => {
  const display = orchestrationCommandFlowVarsPresentation({
    username: "ops",
    retries: 3,
    strict: true,
    peer: { host: "192.0.2.10" },
  });

  assert.deepEqual(
    display.fieldRows.map((row) => [row.fieldName, row.controlKind]),
    [
      ["username", "input"],
      ["retries", "input"],
      ["strict", "boolean-select"],
      ["peer", "json-editor"],
    ],
  );
  assert.match(display.jsonOverridesText, /"username": "ops"/);
});

test("orchestration runtime field edits keep unrelated json values", () => {
  const source = { username: "ops", peer: { host: "192.0.2.10" } };
  const patched = orchestrationCommandFlowVarPatch(source, "username", "admin");

  assert.deepEqual(patched, {
    username: "admin",
    peer: { host: "192.0.2.10" },
  });
  assert.deepEqual(source, {
    username: "ops",
    peer: { host: "192.0.2.10" },
  });
});

test("orchestration runtime json rejects invalid or non-object values", () => {
  assert.throws(() => orchestrationCommandFlowVarsFromJson("{"));
  assert.throws(() => orchestrationCommandFlowVarsFromJson("[]"));
  assert.deepEqual(orchestrationCommandFlowVarsFromJson('{"site":"dc-a"}'), {
    site: "dc-a",
  });
});

test("orchestration runtime presentation keeps an invalid json draft visible", () => {
  const display = orchestrationCommandFlowVarsPresentation(
    { site: "dc-a" },
    "invalid JSON",
    '{"site":',
  );

  assert.equal(display.jsonOverridesText, '{"site":');
  assert.equal(display.errorMessage, "invalid JSON");
});
