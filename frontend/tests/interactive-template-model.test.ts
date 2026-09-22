import assert from "node:assert/strict";
import test from "node:test";
import {
  interactiveTemplateDocumentFromModel,
  interactiveTemplateModelFromDocument,
  interactiveTemplateModelFromToml,
  interactiveTemplateModelToToml,
  defaultInteractiveTemplateModel,
} from "../src/domains/command/index.js";

const completeToml = `name = "temporary-copy"

command = "copy {{source}} flash:{{destination}}"
mode = "Enable"
timeout_secs = 300

[[prompts]]
patterns = ['(?i)address.*\\?$']
response = "{{server_addr}}"
append_newline = true
record_input = false
`;

test("interactive command TOML maps every supported field into the visual model", () => {
  const model = interactiveTemplateModelFromToml(completeToml);

  assert.equal(model.name, "temporary-copy");
  assert.equal(Object.hasOwn(model, "description"), false);
  assert.equal(Object.hasOwn(model, "hasDescription"), false);
  assert.equal(Object.hasOwn(model, "currentConnectionAlias"), false);
  assert.equal(Object.hasOwn(model, "hasCurrentConnectionAlias"), false);
  assert.deepEqual(model, {
    name: "temporary-copy",
    command: "copy {{source}} flash:{{destination}}",
    multilineMode: "split_lines",
    mode: "Enable",
    hasMode: true,
    timeoutSecs: 300,
    hasTimeoutSecs: true,
    prompts: [
      {
        patterns: ["(?i)address.*\\?$"],
        response: "{{server_addr}}",
        appendNewline: true,
        recordInput: false,
      },
    ],
  });
});

test("visual model serializes to stable TOML and round trips", () => {
  const model = interactiveTemplateModelFromToml(completeToml);
  const toml = interactiveTemplateModelToToml(model);

  assert.doesNotMatch(toml, /\[\[vars\]\]/);
  assert.match(toml, /^name = "temporary-copy"/);
  assert.doesNotMatch(toml, /description|current_connection_alias/);
  assert.match(toml, /\[\[prompts\]\]/);
  assert.deepEqual(interactiveTemplateModelFromToml(toml), model);
});

test("removed vars declarations and unknown fields are rejected", () => {
  assert.throws(
    () =>
      interactiveTemplateModelFromToml(`name = "old"
[[vars]]
name = "site"
command = "show {{site}}"
`),
    /unsupported interactive command field: vars/,
  );
  assert.throws(
    () =>
      interactiveTemplateModelFromToml(`name = "legacy"
description = "removed"
command = "show version"
`),
    /unsupported interactive command field: description/,
  );
  assert.throws(
    () =>
      interactiveTemplateModelFromToml(`name = "legacy"
current_connection_alias = "current"
command = "show version"
`),
    /unsupported interactive command field: current_connection_alias/,
  );
  assert.throws(
    () =>
      interactiveTemplateModelFromToml(`name = "unknown"
unexpected = true
command = "show version"
`),
    /unsupported interactive command field: unexpected/,
  );
});

test("interactive command draft has one command and no workflow settings", () => {
  const model = defaultInteractiveTemplateModel();
  assert.equal(model.command, "");
  assert.equal(model.multilineMode, "split_lines");
  assert.equal(Object.hasOwn(model, "steps"), false);
  assert.equal(Object.hasOwn(model, "stopOnError"), false);
});

test("interactive command serializes each multiline mode without steps", () => {
  for (const mode of ["split_lines", "whole"] as const) {
    const model = interactiveTemplateModelFromDocument({
      name: "multiline",
      command: "cat <<'EOF'\na\nEOF",
      multiline_mode: mode,
    });
    assert.equal(
      interactiveTemplateDocumentFromModel(model).multiline_mode,
      mode,
    );
    assert.equal(
      Object.hasOwn(interactiveTemplateDocumentFromModel(model), "steps"),
      false,
    );
  }
});

test("interactive command rejects legacy steps and interactive settings", () => {
  for (const field of ["steps", "default_mode", "stop_on_error"]) {
    assert.throws(
      () =>
        interactiveTemplateModelFromDocument({
          name: "invalid",
          command: "show version",
          [field]: field === "steps" ? [{ command: "show clock" }] : true,
        }),
      /unsupported interactive command field/,
    );
  }
  assert.throws(
    () =>
      interactiveTemplateModelFromDocument({
        name: "invalid",
        command: "show version",
        multiline_mode: "batch",
      }),
    /multiline_mode must be split_lines or whole/,
  );
});

test("interactive command rejects malformed command and prompt fields", () => {
  for (const patch of [
    { command: 42 },
    { prompts: "invalid" },
    { prompts: [{ patterns: [42], response: "yes" }] },
    { prompts: [{ patterns: ["Continue?"], response: 42 }] },
    {
      prompts: [
        { patterns: ["Continue?"], response: "yes", append_newline: "true" },
      ],
    },
    {
      prompts: [{ patterns: ["Continue?"], response: "yes", unexpected: true }],
    },
  ]) {
    assert.throws(() =>
      interactiveTemplateModelFromDocument({
        name: "invalid",
        command: "copy image",
        ...patch,
      }),
    );
  }
});
