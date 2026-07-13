import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import { createTxBlockCommandEditorWorkspace } from "../src/modules/transactionBlockDisplays.js";
import {
  notifySavedConnectionsRefreshed,
  setCurrentConnectionTarget,
} from "../src/modules/connectionTargetStoreState.js";

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail("timed out waiting for transaction mode options");
}

function commandModeValues(workspace) {
  const display = get(workspace.commandDisplayStateStore);
  const modeField = display.fieldRows.find(
    (fieldRow) => fieldRow.fieldKey === "mode",
  );
  return modeField.optionRows.map((optionRow) => optionRow.optionValue);
}

test("transaction command modes follow the current connection profile", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path) => {
    const profileName = decodeURIComponent(
      String(path).match(/device-profiles\/([^/]+)\/modes/)?.[1] || "",
    );
    const profileModes = {
      "test-ios": ["User", " Enable ", "Config", "Enable", "Config"],
      "test-junos": ["Operational", "Configuration"],
    };
    const modes = profileModes[profileName] || ["Root"];
    return new Response(
      JSON.stringify({
        default_mode: modes[0],
        modes,
        name: profileName,
      }),
      { headers: { "content-type": "application/json" } },
    );
  };

  setCurrentConnectionTarget(null);
  const workspace = createTxBlockCommandEditorWorkspace();
  workspace.setCommandEditorContext({
    command: { command: "show version", mode: "Legacy" },
  });

  try {
    setCurrentConnectionTarget({ kind: "saved", profile: "test-ios" }, null);
    notifySavedConnectionsRefreshed();
    await waitFor(() => commandModeValues(workspace).includes("Config"));
    assert.deepEqual(commandModeValues(workspace), [
      "Legacy",
      "User",
      "Enable",
      "Config",
    ]);

    setCurrentConnectionTarget({ kind: "saved", profile: "test-junos" }, null);
    await waitFor(() => commandModeValues(workspace).includes("Configuration"));
    assert.deepEqual(commandModeValues(workspace), [
      "Legacy",
      "Operational",
      "Configuration",
    ]);
  } finally {
    workspace.destroy();
    setCurrentConnectionTarget(null);
    globalThis.fetch = originalFetch;
  }
});

test("blank transaction command mode initializes from the profile default", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        default_mode: "Operational",
        modes: ["Operational", "Configuration"],
        name: "test-initial-junos",
      }),
      { headers: { "content-type": "application/json" } },
    );

  setCurrentConnectionTarget(
    { kind: "saved", profile: "test-initial-junos" },
    null,
  );
  let initializedCommand = null;
  const workspace = createTxBlockCommandEditorWorkspace();
  workspace.setCommandEditorContext({
    command: { command: "show version", mode: "" },
    onChange(nextCommand) {
      initializedCommand = nextCommand;
    },
  });

  try {
    await waitFor(() => initializedCommand?.mode === "Operational");
    assert.deepEqual(commandModeValues(workspace), [
      "Operational",
      "Configuration",
    ]);
  } finally {
    workspace.destroy();
    setCurrentConnectionTarget(null);
    globalThis.fetch = originalFetch;
  }
});
