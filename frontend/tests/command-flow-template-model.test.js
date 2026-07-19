import assert from "node:assert/strict";
import test from "node:test";
import {
  commandFlowTemplateDocumentFromModel,
  commandFlowTemplateModelFromDocument,
  commandFlowTemplateModelFromToml,
  commandFlowTemplateModelToToml,
  defaultCommandFlowTemplateModel,
} from "../src/modules/command/commandFlowTemplateModel.js";

const completeToml = `name = "temporary-copy"
stop_on_error = false
default_mode = "Enable"

[[steps]]
command = "copy {{source}} flash:{{destination}}"
mode = "Enable"
timeout_secs = 300

[[steps.prompts]]
patterns = ['(?i)address.*\\?$']
response = "{{server_addr}}"
append_newline = true
record_input = false
`;

test("command flow TOML maps every supported field into the visual model", () => {
  const model = commandFlowTemplateModelFromToml(completeToml);

  assert.equal(model.name, "temporary-copy");
  assert.equal(Object.hasOwn(model, "description"), false);
  assert.equal(Object.hasOwn(model, "hasDescription"), false);
  assert.equal(Object.hasOwn(model, "currentConnectionAlias"), false);
  assert.equal(Object.hasOwn(model, "hasCurrentConnectionAlias"), false);
  assert.equal(model.stopOnError, false);
  assert.equal(model.defaultMode, "Enable");
  assert.equal(model.hasDefaultMode, true);
  assert.deepEqual(model.steps, [
    {
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
    },
  ]);
});

test("visual model serializes to stable TOML and round trips", () => {
  const model = commandFlowTemplateModelFromToml(completeToml);
  const toml = commandFlowTemplateModelToToml(model);

  assert.doesNotMatch(toml, /\[\[vars\]\]/);
  assert.match(toml, /^name = "temporary-copy"/);
  assert.doesNotMatch(toml, /description|current_connection_alias/);
  assert.match(toml, /\[\[steps\.prompts\]\]/);
  assert.deepEqual(commandFlowTemplateModelFromToml(toml), model);
});

test("removed vars declarations and unknown fields are rejected", () => {
  assert.throws(
    () =>
      commandFlowTemplateModelFromToml(`name = "old"
[[vars]]
name = "site"
[[steps]]
command = "show {{site}}"
`),
    /unsupported command flow field: vars/,
  );
  assert.throws(
    () =>
      commandFlowTemplateModelFromToml(`name = "legacy"
description = "removed"
[[steps]]
command = "show version"
`),
    /unsupported command flow field: description/,
  );
  assert.throws(
    () =>
      commandFlowTemplateModelFromToml(`name = "legacy"
current_connection_alias = "current"
[[steps]]
command = "show version"
`),
    /unsupported command flow field: current_connection_alias/,
  );
  assert.throws(
    () =>
      commandFlowTemplateModelFromToml(`name = "unknown"
unexpected = true
[[steps]]
command = "show version"
`),
    /unsupported command flow field: unexpected/,
  );
});

test("default temporary command flow contains one editable step", () => {
  const model = defaultCommandFlowTemplateModel();

  assert.equal(model.name, "temporary-flow");
  assert.equal(model.stopOnError, true);
  assert.equal(model.steps.length, 1);
  assert.equal(model.steps[0].command, "");
  assert.equal(model.steps[0].multilineMode, "split_lines");
});

test("command flow steps normalize and serialize multiline modes", () => {
  const model = commandFlowTemplateModelFromDocument({
    name: "multiline",
    steps: [
      { command: "show version\nshow inventory" },
      { command: "cat <<'EOF'\na\nEOF", multiline_mode: "whole" },
    ],
  });

  assert.equal(model.steps[0].multilineMode, "split_lines");
  assert.equal(model.steps[1].multilineMode, "whole");
  assert.deepEqual(
    commandFlowTemplateDocumentFromModel(model).steps.map(
      (step) => step.multiline_mode,
    ),
    ["split_lines", "whole"],
  );
});

test("command flow steps reject unsupported multiline modes", () => {
  assert.throws(
    () =>
      commandFlowTemplateModelFromDocument({
        name: "invalid-multiline",
        steps: [{ command: "show version", multiline_mode: "batch" }],
      }),
    /steps\[0\]\.multiline_mode must be split_lines or whole/,
  );
});
