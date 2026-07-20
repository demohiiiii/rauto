import assert from "node:assert/strict";
import test from "node:test";

import { get } from "svelte/store";
import {
  createRecordDrawerContentWorkspace,
  createRecordDrawerWorkspace,
} from "../src/modules/overlays/overlaysDrawerState.js";

function inputEvent(value, checked = false) {
  return { currentTarget: { checked, value } };
}

test("record drawer content handlers preserve value and checked event contracts", () => {
  const calls = [];
  const workspace = createRecordDrawerContentWorkspace({
    onEventKindChange: (value) => calls.push(["kind", value]),
    onFailedOnlyChange: (value) => calls.push(["failed", value]),
    onRawInput: (value) => calls.push(["raw", value]),
    onRecordLevelChange: (value) => calls.push(["level", value]),
    onSearchInput: (value) => calls.push(["search", value]),
  });

  workspace.recordEventKindChangeHandler()(inputEvent("command_output"));
  workspace.recordFailedOnlyChangeHandler()(inputEvent("", true));
  workspace.recordRawInputChangeHandler()(inputEvent("jsonl"));
  workspace.recordLevelChangeHandler()(inputEvent("full"));
  workspace.recordSearchInputChangeHandler()(inputEvent("router"));

  assert.deepEqual(calls, [
    ["kind", "command_output"],
    ["failed", true],
    ["raw", "jsonl"],
    ["level", "full"],
    ["search", "router"],
  ]);
});

test("record drawer preferences load once and setters save normalized snapshots", () => {
  let loadCount = 0;
  const savedPreferences = [];
  const workspace = createRecordDrawerWorkspace({
    onLoadRecordDrawerPreferences() {
      loadCount += 1;
      return {
        displayMode: "raw",
        eventKind: "command_output",
        failedOnly: true,
        searchQuery: "router",
      };
    },
    onSaveRecordDrawerPreferences: (preferences) =>
      savedPreferences.push(preferences),
  });

  workspace.ensurePreferencesLoaded();
  workspace.ensurePreferencesLoaded();
  assert.equal(loadCount, 1);
  assert.equal(get(workspace.displayModeStore), "raw");
  assert.equal(get(workspace.eventKindStore), "command_output");
  assert.equal(get(workspace.failedOnlyStore), true);
  assert.equal(get(workspace.searchQueryStore), "router");
  assert.deepEqual(
    {
      displayMode: get(workspace.drawerContentDisplayStateStore).controls
        .displayMode,
      eventKind: get(workspace.drawerContentDisplayStateStore).controls
        .eventKind,
      failedOnly: get(workspace.drawerContentDisplayStateStore).controls
        .failedOnly,
      searchQuery: get(workspace.drawerContentDisplayStateStore).controls
        .searchField.value,
    },
    {
      displayMode: "raw",
      eventKind: "command_output",
      failedOnly: true,
      searchQuery: "router",
    },
  );

  workspace.selectDisplayMode("unsupported");
  workspace.setEventKind("unsupported");
  workspace.setFailedOnly(false);
  workspace.setSearchQuery("edge");

  assert.deepEqual(savedPreferences.at(-1), {
    displayMode: "list",
    eventKind: "all",
    failedOnly: false,
    searchQuery: "edge",
  });
  assert.equal(
    get(workspace.drawerContentDisplayStateStore).controls.displayMode,
    "list",
  );
});
