import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import {
  blacklistPagePresentation,
  createBlacklistPageWorkspace,
  newBlacklistState,
  normalizeBlacklistPatterns,
} from "../src/domains/blacklist/index.ts";

test("blacklist model normalizes API entries and legacy string rows", () => {
  assert.deepEqual(
    normalizeBlacklistPatterns([
      { pattern: "reload*" },
      "write erase",
      { pattern: "" },
      null,
    ]),
    ["reload*", "write erase"],
  );
  assert.deepEqual(normalizeBlacklistPatterns({ pattern: "reload*" }), []);

  const state = {
    ...newBlacklistState(),
    patterns: ["reload*"],
  };
  const display = blacklistPagePresentation(state);
  assert.equal(
    display.patternDisplay.blacklistPatternRows[0].patternText,
    "reload*",
  );
  assert.equal(display.patternDisplay.isEmpty, false);
});

test("blacklist workspace loads patterns once after first activation", async () => {
  let listCalls = 0;
  const workspace = createBlacklistPageWorkspace({
    api: {
      async listPatterns() {
        listCalls += 1;
        return [{ pattern: `pattern-${listCalls}` }];
      },
    },
  });

  await workspace.setPageContext({ active: false });
  await workspace.setPageContext({ active: true });
  await workspace.setPageContext({ active: true });

  assert.equal(listCalls, 1);
  assert.deepEqual(get(workspace.blacklistStateStore).patterns, ["pattern-1"]);
});

test("blacklist workspace adds, checks, and deletes patterns through its ports", async () => {
  const patterns = ["reload*"];
  const added = [];
  const checked = [];
  const deleted = [];
  const workspace = createBlacklistPageWorkspace({
    api: {
      async addPattern(pattern) {
        added.push(pattern);
        patterns.push(pattern);
        return { added: true, path: "blacklist.db", pattern };
      },
      async checkCommand(command) {
        checked.push(command);
        return { blocked: true, command, pattern: "reload*" };
      },
      async deletePattern(pattern) {
        deleted.push(pattern);
        patterns.splice(patterns.indexOf(pattern), 1);
        return { deleted: true, pattern };
      },
      async listPatterns() {
        return patterns.map((pattern) => ({ pattern }));
      },
    },
    runtime: {
      confirmDelete: () => true,
    },
  });

  workspace.updatePatternInput("  write erase  ");
  await workspace.addPattern();
  assert.deepEqual(added, ["write erase"]);
  assert.equal(get(workspace.blacklistStateStore).patternInput, "");
  assert.deepEqual(get(workspace.blacklistStateStore).patterns, [
    "reload*",
    "write erase",
  ]);

  workspace.updateCommandInput("reload in 5");
  await workspace.checkCommand();
  assert.deepEqual(checked, ["reload in 5"]);
  assert.equal(get(workspace.blacklistStateStore).checkResult?.blocked, true);

  await workspace.deletePattern("reload*");
  assert.deepEqual(deleted, ["reload*"]);
  assert.equal(get(workspace.blacklistStateStore).checkResult, null);
  assert.deepEqual(get(workspace.blacklistStateStore).patterns, [
    "write erase",
  ]);
});

test("blacklist workspace does not delete after confirmation is cancelled", async () => {
  let deleteCalls = 0;
  const workspace = createBlacklistPageWorkspace({
    api: {
      async deletePattern(pattern) {
        deleteCalls += 1;
        return { deleted: true, pattern };
      },
    },
    runtime: {
      confirmDelete: () => false,
    },
  });

  await workspace.deletePattern("reload*");
  assert.equal(deleteCalls, 0);
  assert.deepEqual(get(workspace.blacklistStateStore), newBlacklistState());
});
