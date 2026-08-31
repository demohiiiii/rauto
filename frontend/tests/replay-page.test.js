import assert from "node:assert/strict";
import test from "node:test";
import { get, writable } from "svelte/store";

import {
  createReplayPageWorkspace,
  newReplayState,
  replayFilteredEntries,
} from "../src/domains/replay/index.ts";

function replayRuntime(overrides = {}) {
  return {
    loadPreferences: () => ({
      displayMode: "list",
      eventKind: "all",
      failedOnly: false,
      searchQuery: "",
    }),
    openEntry() {},
    replayJsonlTransferState: writable({ jsonl: "", version: 0 }),
    replayStatusTextState: writable({ text: "", version: 0 }),
    savePreferences() {},
    ...overrides,
  };
}

test("replay filters combine event kind, failure, and text search", () => {
  const state = newReplayState();
  state.eventKind = "command_output";
  state.failedOnly = true;
  state.searchQuery = "show version";
  state.lastReplayResult = {
    entries: [
      {
        event: {
          command: "show version",
          kind: "command_output",
          success: false,
        },
      },
      {
        event: {
          command: "show version",
          kind: "command_output",
          success: true,
        },
      },
      { event: { kind: "prompt_changed", reason: "show version" } },
    ],
  };

  const entries = replayFilteredEntries(state);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].event.success, false);
});

test("replay workspace normalizes list and command request payloads", async () => {
  const requests = [];
  const workspace = createReplayPageWorkspace({
    api: {
      async replaySession(payload) {
        requests.push(payload);
        return { entries: [] };
      },
    },
    runtime: replayRuntime(),
  });

  try {
    workspace.setJsonl("  recording\n");
    await workspace.replayList();
    workspace.setCommandInput("  show clock  ");
    workspace.setMode("   ");
    await workspace.replayCommand();

    assert.deepEqual(requests, [
      { jsonl: "recording", list: true },
      { command: "show clock", jsonl: "recording", mode: null },
    ]);
    assert.equal(get(workspace.replayStateStore).statusText, "");
  } finally {
    workspace.destroy();
  }
});

test("replay workspace suppresses duplicate operations while loading", async () => {
  let requestCalls = 0;
  let resolveRequest;
  const request = new Promise((resolve) => {
    resolveRequest = resolve;
  });
  const workspace = createReplayPageWorkspace({
    api: {
      async replaySession() {
        requestCalls += 1;
        await request;
        return { entries: [] };
      },
    },
    runtime: replayRuntime(),
  });

  try {
    workspace.setJsonl("recording");
    const firstRun = workspace.replayList();
    const duplicateRun = workspace.replayList();

    assert.equal(requestCalls, 1);
    assert.equal(get(workspace.replayStateStore).listLoading, true);
    resolveRequest();
    await Promise.all([firstRun, duplicateRun]);
    assert.equal(get(workspace.replayStateStore).listLoading, false);
  } finally {
    workspace.destroy();
  }
});
