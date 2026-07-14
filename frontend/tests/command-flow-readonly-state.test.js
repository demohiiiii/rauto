import assert from "node:assert/strict";
import test from "node:test";
import { commandFlowReadonlyPresentation } from "../src/modules/commandFlowReadonlyState.js";

const keyTranslator = (key) => key;

test("command flow read-only presentation covers settings, steps, and prompts", () => {
  const display = commandFlowReadonlyPresentation(
    {
      defaultMode: "enable",
      hasDefaultMode: true,
      name: "backup-flow",
      steps: [
        {
          command: "copy running-config {{target}}",
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
    },
    keyTranslator,
  );

  assert.equal(display.hasSteps, true);
  assert.equal(display.summaryRows[0].valueText, "enable");
  assert.equal(display.summaryRows[1].valueText, "enabled");
  assert.equal(display.summaryRows[2].valueText, "1");
  assert.equal(
    display.stepRows[0].commandText,
    "copy running-config {{target}}",
  );
  assert.equal(display.stepRows[0].modeText, "commandFlowReadonlyInherited");
  assert.equal(display.stepRows[0].timeoutText, "45s");
  assert.deepEqual(display.stepRows[0].promptRows[0].patternRows, [
    "Destination filename",
    "Overwrite",
  ]);
  assert.equal(display.stepRows[0].promptRows[0].responseText, "{{target}}");
  assert.equal(display.stepRows[0].promptRows[0].appendNewlineText, "enabled");
  assert.equal(display.stepRows[0].promptRows[0].recordInputText, "disabled");
});

test("command flow read-only presentation exposes an empty state", () => {
  const display = commandFlowReadonlyPresentation({ steps: [] }, keyTranslator);

  assert.equal(display.hasSteps, false);
  assert.deepEqual(display.stepRows, []);
  assert.equal(display.emptyText, "txBlockFormFlowStepsEmpty");
});
