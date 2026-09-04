import assert from "node:assert/strict";
import test from "node:test";
import {
  commandFlowReadonlyPresentation,
  defaultCommandFlowTemplateModel,
} from "../src/domains/command/index.js";
import type {
  CommandFlowTemplateModel,
  CommandTranslate,
} from "../src/domains/command/model/types.js";

const keyTranslator: CommandTranslate = (key) => key;

const model: CommandFlowTemplateModel = {
  defaultMode: "enable",
  hasDefaultMode: true,
  name: "backup-flow",
  steps: [
    {
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
    },
  ],
  stopOnError: true,
};

test("command flow read-only presentation covers settings, steps, and prompts", () => {
  const display = commandFlowReadonlyPresentation(model, keyTranslator);

  assert.equal(display.hasSteps, true);
  assert.equal(display.summaryRows[0]?.valueText, "enable");
  assert.equal(display.summaryRows[1]?.valueText, "enabled");
  assert.equal(display.summaryRows[2]?.valueText, "1");
  assert.equal(
    display.stepRows[0]?.commandText,
    "copy running-config {{target}}",
  );
  assert.equal(display.stepRows[0]?.modeText, "commandFlowReadonlyInherited");
  assert.equal(display.stepRows[0]?.timeoutText, "45s");
  assert.equal(
    display.stepRows[0]?.multilineModeLabelText,
    "commandMultilineMode",
  );
  assert.equal(
    display.stepRows[0]?.multilineModeText,
    "commandMultilineModeWhole",
  );
  assert.deepEqual(display.stepRows[0]?.promptRows[0]?.patternRows, [
    "Destination filename",
    "Overwrite",
  ]);
  assert.equal(display.stepRows[0]?.promptRows[0]?.responseText, "{{target}}");
  assert.equal(
    display.stepRows[0]?.promptRows[0]?.appendNewlineText,
    "enabled",
  );
  assert.equal(display.stepRows[0]?.promptRows[0]?.recordInputText, "disabled");
});

test("command flow read-only presentation exposes an empty state", () => {
  const display = commandFlowReadonlyPresentation(
    { ...defaultCommandFlowTemplateModel(), steps: [] },
    keyTranslator,
  );

  assert.equal(display.hasSteps, false);
  assert.deepEqual(display.stepRows, []);
  assert.equal(display.emptyText, "txBlockFormFlowStepsEmpty");
});
