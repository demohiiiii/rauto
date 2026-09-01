import assert from "node:assert/strict";
import test from "node:test";
import {
  customCommandExecutionModeFormPatch,
  customShellExitMarkerFormPatch,
  emptyProfileForm,
  normalizeCommandExecutionConfig,
  normalizeCustomProfileBaseForm,
  refreshCustomProfileOptionsState,
} from "../src/domains/profiles/model/customProfileForm.js";

test("custom profile command execution config preserves both backend forms", () => {
  assert.deepEqual(normalizeCommandExecutionConfig("prompt_driven"), {
    marker: "",
    mode: "prompt_driven",
    showShellExitMarker: false,
  });
  assert.deepEqual(
    normalizeCommandExecutionConfig({
      shell_exit_status: { marker: "__EXIT__:" },
    }),
    {
      marker: "__EXIT__:",
      mode: "shell_exit_status",
      showShellExitMarker: true,
    },
  );
});

test("custom profile base form and field patches normalize editor values", () => {
  assert.deepEqual(
    normalizeCustomProfileBaseForm({
      command_execution: "prompt_driven",
      name: " iosxe ",
    }),
    {
      commandExecution: {
        marker: "",
        mode: "prompt_driven",
        showShellExitMarker: false,
      },
      name: "iosxe",
    },
  );
  assert.deepEqual(
    customCommandExecutionModeFormPatch("shell_exit_status", {
      marker: "done:",
    }),
    { commandExecution: { shell_exit_status: { marker: "done:" } } },
  );
  assert.deepEqual(customShellExitMarkerFormPatch("exit:"), {
    commandExecution: { shell_exit_status: { marker: "exit:" } },
  });
});

test("custom profile defaults are isolated and options retain selection", () => {
  const first = emptyProfileForm();
  const second = emptyProfileForm();
  assert.notEqual(first.prompts, second.prompts);
  assert.notEqual(first.hooks, second.hooks);
  assert.deepEqual(refreshCustomProfileOptionsState(["ios", "junos"], "nxos"), {
    names: ["nxos", "ios", "junos"],
    selected: "nxos",
  });
});
