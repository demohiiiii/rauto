import assert from "node:assert/strict";
import test from "node:test";

import {
  createProfileHookRowEditorWorkspace,
  createProfileListRowEditorWorkspace,
} from "../src/modules/profiles/profilePanelChildWorkspaces.js";
import {
  builtinProfileReadonlyDisplay,
  hookOperationEditorDisplay,
} from "../src/modules/profiles/profilesEditorState.js";

test("profile list row handlers use the latest row context", () => {
  const calls = [];
  const workspace = createProfileListRowEditorWorkspace({
    onPatternChange: (...args) => calls.push(["pattern", ...args]),
    onProfileListRowChange: (...args) => calls.push(["row", ...args]),
  });

  workspace.setRowContext({
    kind: "interactions",
    profileListRow: {},
    rowIndex: 4,
  });
  workspace.interactionInputChangeHandler()("show version");
  workspace.patternChangeHandler(2)("prompt$");

  assert.deepEqual(calls, [
    ["row", 4, { input: "show version" }],
    ["pattern", 4, 2, "prompt$"],
  ]);
});

test("profile hook handlers patch rows and steps with the latest context", () => {
  const calls = [];
  const workspace = createProfileHookRowEditorWorkspace({
    onFlowStepChange: (...args) => calls.push(["step", ...args]),
    onCommandChange: (...args) => calls.push(["command", ...args]),
    onHookRowChange: (...args) => calls.push(["row", ...args]),
  });

  workspace.setRowContext({ hookRow: {}, modeOptions: [], rowIndex: 3 });
  workspace.hookNameChangeHandler()("prepare");
  workspace.flowStepCommandChangeHandler(1)("terminal length 0");
  workspace.commandInteractionChangeHandler()({
    prompts: [{ patterns: ["Password:"], response: "secret\n" }],
  });
  workspace.flowStepInteractionChangeHandler(1)({
    prompts: [{ patterns: ["confirm"], response: "yes\n" }],
  });

  assert.deepEqual(calls, [
    ["row", 3, { name: "prepare" }],
    ["step", 3, 1, { command: "terminal length 0" }],
    [
      "command",
      3,
      {
        interaction: {
          prompts: [
            {
              patterns: ["Password:"],
              record_input: false,
              response: "secret\n",
            },
          ],
        },
      },
    ],
    [
      "step",
      3,
      1,
      {
        interaction: {
          prompts: [
            {
              patterns: ["confirm"],
              record_input: false,
              response: "yes\n",
            },
          ],
        },
      },
    ],
  ]);
});

test("profile hook callbacks created before mount use the latest row context", () => {
  const calls = [];
  const workspace = createProfileHookRowEditorWorkspace({
    onRemoveFlowStep: (...args) => calls.push(["step", ...args]),
    onRemoveRow: (...args) => calls.push(["row", ...args]),
  });
  const removeRow = workspace.removeRowHandler();
  const removeFlowStep = workspace.removeFlowStepHandler(2);

  workspace.setRowContext({ hookRow: {}, modeOptions: [], rowIndex: 4 });
  removeRow();
  removeFlowStep();

  assert.deepEqual(calls, [
    ["row", 4],
    ["step", 4, 2],
  ]);
});

test("profile hook editor exposes only command and command flow operations", () => {
  const flowDisplay = hookOperationEditorDisplay({ kind: "flow" });
  const legacyDisplay = hookOperationEditorDisplay({ kind: "unsupported" });

  assert.deepEqual(
    flowDisplay.kindOptionRows.map((option) => option.value),
    ["command", "flow"],
  );
  assert.equal(flowDisplay.selectedKind, "flow");
  assert.equal(flowDisplay.showFlowEditor, true);
  assert.equal(legacyDisplay.selectedKind, "command");
  assert.equal(legacyDisplay.showCommandEditor, true);
  assert.equal("unsupportedDisplay" in legacyDisplay, false);
});

test("built-in hook display preserves command interaction prompts", () => {
  const display = builtinProfileReadonlyDisplay({
    hooks: {
      after_connect: [
        {
          name: "login",
          operation: {
            kind: "command",
            command: "copy config",
            interaction: {
              prompts: [
                {
                  patterns: ["Password:", "Continue\\?"],
                  response: "yes\n",
                  record_input: true,
                },
              ],
            },
          },
        },
      ],
    },
  });

  assert.deepEqual(display.hookRows[0].command.interactionDisplay.promptRows, [
    {
      patterns: ["Password:", "Continue\\?"],
      patternRows: [
        { pattern: "Password:", patternIndex: 0 },
        { pattern: "Continue\\?", patternIndex: 1 },
      ],
      promptIndex: 0,
      record_input: true,
      response: "yes\n",
    },
  ]);
});

test("profile inputs normalize DOM events before updating list state", () => {
  const calls = [];
  const workspace = createProfileListRowEditorWorkspace({
    onPatternChange: (...args) => calls.push(["pattern", ...args]),
    onProfileListRowChange: (...args) => calls.push(["row", ...args]),
    onSimpleValueChange: (...args) => calls.push(["simple", ...args]),
  });
  const inputEvent = (value) => ({ currentTarget: { value } });

  workspace.setRowContext({
    kind: "interactions",
    profileListRow: {},
    rowIndex: 2,
  });
  workspace.interactionStateChangeHandler()(inputEvent("Enable"));
  workspace.patternChangeHandler(1)(inputEvent("prompt$"));
  workspace.simpleValueChangeHandler()(inputEvent("--More--"));

  assert.deepEqual(calls, [
    ["row", 2, { state: "Enable" }],
    ["pattern", 2, 1, "prompt$"],
    ["simple", 2, "--More--"],
  ]);
});
