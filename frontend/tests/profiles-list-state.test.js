import assert from "node:assert/strict";
import test from "node:test";

import {
  HOOK_LIST,
  PROFILE_LIST,
  addHookListFlowStep,
  addHookListRow,
  addInteractionRow,
  addPromptRow,
  addSysPromptRow,
  addTransitionRow,
  clearProfileEditorList,
  collectHookRows,
  collectInteractionRows,
  collectPromptRows,
  collectSysPromptRows,
  collectTransitionRows,
  patchHookListFlowStep,
} from "../src/modules/profiles/profilesListState.js";

const PROFILE_KEYS = Object.values(PROFILE_LIST);
const HOOK_KEYS = Object.values(HOOK_LIST);

function clearLists() {
  [...PROFILE_KEYS, ...HOOK_KEYS].forEach(clearProfileEditorList);
}

test("profile list rows preserve defaults and collect trimmed backend values", () => {
  clearLists();
  addPromptRow({ state: " Enable ", patterns: [" #$ ", ""] });
  addSysPromptRow({
    state: " User ",
    pattern: " >$ ",
    sys_name_group: " host ",
  });
  addInteractionRow({ state: " Enable ", input: " y ", patterns: ["yes"] });
  addTransitionRow({ from: " User ", command: " enable ", to: " Enable " });

  assert.deepEqual(collectPromptRows(), [
    { state: "Enable", patterns: ["#$"] },
  ]);
  assert.deepEqual(collectSysPromptRows(), [
    { state: "User", pattern: ">$", sys_name_group: "host" },
  ]);
  assert.deepEqual(collectInteractionRows(), [
    {
      state: "Enable",
      input: "y",
      is_dynamic: false,
      patterns: ["yes"],
      record_input: true,
    },
  ]);
  assert.deepEqual(collectTransitionRows(), [
    {
      from: "User",
      command: "enable",
      to: "Enable",
      is_exit: false,
      format_sys: false,
    },
  ]);
});

test("hook flow editing collects the complete command flow", () => {
  clearLists();
  addHookListRow(HOOK_LIST.afterConnect, {
    name: "prepare",
    failure_policy: "fail_fast",
    record_output: true,
    operation: {
      kind: "flow",
      stop_on_error: true,
      max_steps: 4,
      steps: [{ mode: "User", command: "first", timeout: 10 }],
    },
  });
  addHookListFlowStep(HOOK_LIST.afterConnect, 0, {
    mode: "Enable",
    command: "second",
    timeout: 20,
  });
  patchHookListFlowStep(HOOK_LIST.afterConnect, 0, 1, {
    command: "second updated",
  });

  assert.deepEqual(collectHookRows(HOOK_LIST.afterConnect, "after_connect"), [
    {
      name: "prepare",
      failure_policy: "fail_fast",
      record_output: true,
      operation: {
        kind: "flow",
        stop_on_error: true,
        max_steps: 4,
        steps: [
          { mode: "User", command: "first", timeout: 10 },
          { mode: "Enable", command: "second updated", timeout: 20 },
        ],
      },
    },
  ]);
});
