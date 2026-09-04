import assert from "node:assert/strict";
import test from "node:test";
import { get, writable } from "svelte/store";

import {
  createReplayPageWorkspace,
  newReplayState,
  replayFilteredEntries,
} from "../src/domains/replay/index.js";
import type {
  ReplayEntry,
  ReplayRequest,
  ReplayResult,
  ReplayRuntime,
} from "../src/domains/replay/index.js";

function replayResult(entries: ReplayEntry[] = []): ReplayResult {
  return { context: null, entries, output: null };
}

function replayRuntime(overrides: Partial<ReplayRuntime> = {}): ReplayRuntime {
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
  state.lastReplayResult = replayResult([
    {
      ts_ms: 1,
      event: {
        command: "show version",
        kind: "command_output",
        success: false,
      },
    },
    {
      ts_ms: 2,
      event: {
        command: "show version",
        kind: "command_output",
        success: true,
      },
    },
    {
      ts_ms: 3,
      event: { kind: "prompt_changed", prompt: "show version" },
    },
  ]);

  const entries = replayFilteredEntries(state);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].event.success, false);
});

test("replay workspace normalizes list and command request payloads", async () => {
  const requests: ReplayRequest[] = [];
  const workspace = createReplayPageWorkspace({
    api: {
      async replaySession(payload) {
        requests.push(payload);
        return replayResult();
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
  let resolveRequest!: () => void;
  const request = new Promise<void>((resolve) => {
    resolveRequest = resolve;
  });
  const workspace = createReplayPageWorkspace({
    api: {
      async replaySession() {
        requestCalls += 1;
        await request;
        return replayResult();
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
