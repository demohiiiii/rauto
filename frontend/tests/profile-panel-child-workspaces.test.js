import assert from "node:assert/strict";
import test from "node:test";

import {
  createProfileHookRowEditorWorkspace,
  createProfileListRowEditorWorkspace,
} from "../src/modules/profiles/profilePanelChildWorkspaces.js";

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
    onHookRowChange: (...args) => calls.push(["row", ...args]),
  });

  workspace.setRowContext({ hookRow: {}, modeOptions: [], rowIndex: 3 });
  workspace.hookNameChangeHandler()("prepare");
  workspace.flowStepCommandChangeHandler(1)("terminal length 0");

  assert.deepEqual(calls, [
    ["row", 3, { name: "prepare" }],
    ["step", 3, 1, { command: "terminal length 0" }],
  ]);
});
