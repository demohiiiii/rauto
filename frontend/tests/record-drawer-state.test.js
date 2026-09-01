import assert from "node:assert/strict";
import test from "node:test";

import { get } from "svelte/store";
import {
  SESSION_RECORDS_VIEW,
  closeRecordDrawer,
  createRecordDrawerContentWorkspace,
  createRecordDrawerWorkspace,
  openRecordDrawer,
  overlayDrawerState,
  replayJsonlTransferState,
  replayStatusTextState,
  sessionRecordsViewState,
  setSessionRecordsView,
} from "../src/domains/overlays/index.js";
import { createReplayPageWorkspace } from "../src/domains/replay/index.ts";

test("opening session records always defaults to the recent recording", () => {
  setSessionRecordsView(SESSION_RECORDS_VIEW.history);
  assert.equal(get(sessionRecordsViewState), SESSION_RECORDS_VIEW.history);

  openRecordDrawer();

  assert.equal(get(sessionRecordsViewState), SESSION_RECORDS_VIEW.recent);
  assert.equal(get(overlayDrawerState).recordDrawerOpen, true);
  closeRecordDrawer();
});

test("record drawer content handlers accept bare values from Plain* field bindings", () => {
  const calls = [];
  const workspace = createRecordDrawerContentWorkspace({
    onEventKindChange: (value) => calls.push(["kind", value]),
    onFailedOnlyChange: (value) => calls.push(["failed", value]),
    onRawInput: (value) => calls.push(["raw", value]),
    onRecordLevelChange: (value) => calls.push(["level", value]),
    onSearchInput: (value) => calls.push(["search", value]),
  });

  // PlainSelectField / PlainInputField / PlainCheckboxField extract form values
  // before calling onValueChange / onValueInput / onCheckedChange.
  workspace.recordEventKindChangeHandler()("command_output");
  workspace.recordFailedOnlyChangeHandler()(true);
  workspace.recordRawInputChangeHandler()("jsonl");
  workspace.recordLevelChangeHandler()("full");
  workspace.recordSearchInputChangeHandler()("router");

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

test("copyRecording warns when recording JSONL is empty", async () => {
  const statuses = [];
  const toasts = [];
  const workspace = createRecordDrawerWorkspace({
    onCopyRecordDrawerRecording: async (jsonl) => {
      if (!String(jsonl || "").trim()) {
        statuses.push("empty");
        toasts.push("warning");
        return false;
      }
      statuses.push("copied");
      toasts.push("success");
      return true;
    },
  });

  const result = await workspace.copyRecording();
  assert.equal(result, false);
  assert.deepEqual(statuses, ["empty"]);
  assert.deepEqual(toasts, ["warning"]);
});

test("useInReplay requires recording JSONL before navigating", () => {
  const transfers = [];
  const workspace = createRecordDrawerWorkspace({
    onSetReplayJsonlFromRecording: (jsonl) => {
      if (!String(jsonl || "").trim()) {
        transfers.push("blocked");
        return false;
      }
      transfers.push(jsonl);
      return true;
    },
  });

  assert.equal(workspace.useInReplay(), false);
  assert.deepEqual(transfers, ["blocked"]);

  workspace.setRawRecordingText('{"kind":"command_output"}\n');
  assert.equal(workspace.useInReplay(), true);
  assert.equal(transfers.length, 2);
  assert.match(transfers[1], /command_output/);
});

test("an active replay workspace consumes recording transfers immediately", () => {
  const originalTransfer = get(replayJsonlTransferState);
  const originalStatus = get(replayStatusTextState);
  const replayWorkspace = createReplayPageWorkspace();
  const recordWorkspace = createRecordDrawerWorkspace();

  try {
    replayWorkspace.setPageContext({ active: true });
    replayWorkspace.setJsonl("previous recording");
    recordWorkspace.setRawRecordingText('{"kind":"command_output"}\n');

    assert.equal(recordWorkspace.useInReplay(), true);
    assert.equal(
      get(replayWorkspace.replayStateStore).jsonl,
      '{"kind":"command_output"}',
    );
  } finally {
    replayWorkspace.destroy();
    replayJsonlTransferState.set(originalTransfer);
    replayStatusTextState.set(originalStatus);
    closeRecordDrawer();
  }
});
