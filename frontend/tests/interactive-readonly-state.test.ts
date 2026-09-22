import assert from "node:assert/strict";
import test from "node:test";
import {
  interactiveReadonlyPresentation,
  defaultInteractiveTemplateModel,
} from "../src/domains/command/index.js";
import type {
  InteractiveTemplateModel,
  CommandTranslate,
} from "../src/domains/command/model/types.js";

const keyTranslator: CommandTranslate = (key) => key;

const model: InteractiveTemplateModel = {
  name: "backup-interactive",
  command: "copy running-config {{target}}",
  multilineMode: "whole",
  hasMode: false,
  hasTimeoutSecs: true,
  mode: null,
  timeoutSecs: 45,
  prompts: [
    {
      appendNewline: true,
      patterns: ["Destination filename", "Overwrite"],
      recordInput: false,
      response: "{{target}}",
    },
  ],
};

test("interactive command read-only presentation covers one command, settings, and prompts", () => {
  const display = interactiveReadonlyPresentation(model, keyTranslator);

  assert.equal(
    display.summaryRows[0]?.valueText,
    "interactiveReadonlyInherited",
  );
  assert.equal(display.summaryRows[1]?.valueText, "45s");
  assert.equal(display.summaryRows[2]?.valueText, "1");
  assert.equal(display.command.commandText, "copy running-config {{target}}");
  assert.equal(display.command.modeText, "interactiveReadonlyInherited");
  assert.equal(display.command.timeoutText, "45s");
  assert.equal(display.command.multilineModeLabelText, "commandMultilineMode");
  assert.equal(display.command.multilineModeText, "commandMultilineModeWhole");
  assert.deepEqual(display.command.promptRows[0]?.patternRows, [
    "Destination filename",
    "Overwrite",
  ]);
  assert.equal(display.command.promptRows[0]?.responseText, "{{target}}");
  assert.equal(display.command.promptRows[0]?.appendNewlineText, "enabled");
  assert.equal(display.command.promptRows[0]?.recordInputText, "disabled");
});

test("interactive command read-only presentation preserves an empty draft command", () => {
  const display = interactiveReadonlyPresentation(
    defaultInteractiveTemplateModel(),
    keyTranslator,
  );

  assert.equal(display.command.commandText, "");
});
