import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import { createTemplateAuthoringSession } from "../src/domains/templates/index.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

test("template sessions lock builtins, preserve snapshots and require copying before manual edits", () => {
  let busy = false;
  let content = "original";
  const session = createTemplateAuthoringSession<string>({
    isBusy: () => busy,
  });
  session.adoptSource("builtin");
  assert.equal(
    session.startEditing(() => content),
    false,
  );
  assert.equal(session.canEdit(), false);
  assert.equal(
    session.copyToManual(() => {
      content += " copy";
    }),
    true,
  );
  assert.equal(session.canEdit(), true);
  session.adoptSource("custom");
  assert.equal(
    session.startEditing(() => content),
    true,
  );
  content = "modified";
  busy = true;
  assert.equal(
    session.cancelEditing((snapshot) => {
      content = snapshot;
    }),
    false,
  );
  busy = false;
  assert.equal(
    session.cancelEditing((snapshot) => {
      content = snapshot;
    }),
    true,
  );
  assert.equal(content, "original copy");
  assert.equal(get(session.stateStore).readonly, true);
});

test("failed async cancellation keeps the edit snapshot; stale completion cannot finish a newer edit", async () => {
  const session = createTemplateAuthoringSession<string>();
  session.adoptSource("custom");
  session.startEditing(() => "alpha");
  assert.equal(await session.cancelEditingAsync(async () => false), false);
  assert.equal(get(session.stateStore).editing, true);
  const pending = deferred<boolean>();
  const cancellation = session.cancelEditingAsync(async (snapshot) => {
    assert.equal(snapshot, "alpha");
    return pending.promise;
  });
  session.adoptSource("manual");
  pending.resolve(true);
  assert.equal(await cancellation, false);
  assert.equal(get(session.stateStore).readonly, false);
  assert.equal(get(session.stateStore).editing, false);
});

test("name dialog trims names, keeps failed input and blocks duplicate submission", async () => {
  const session = createTemplateAuthoringSession<string>();
  session.openNameDialog();
  assert.equal(
    await session.submitNameDialog(
      async () => true,
      () => "",
    ),
    false,
  );
  assert.equal(get(session.nameDialogStateStore).error, "name_required");
  session.changeNameDialogValue("  duplicate  ");
  const pending = deferred<boolean>();
  const save = session.submitNameDialog(
    async (name) => {
      assert.equal(name, "duplicate");
      return pending.promise;
    },
    () => "already exists",
  );
  session.closeNameDialog();
  session.changeNameDialogValue("other");
  assert.equal(get(session.nameDialogStateStore).value, "  duplicate  ");
  assert.equal(
    await session.submitNameDialog(
      async () => true,
      () => "",
    ),
    false,
  );
  pending.resolve(false);
  assert.equal(await save, false);
  assert.equal(get(session.nameDialogStateStore).error, "already exists");
  session.changeNameDialogValue("new-template");
  assert.equal(
    await session.submitNameDialog(
      async () => true,
      () => "",
    ),
    true,
  );
  assert.equal(get(session.nameDialogStateStore).open, false);
});

test("destroyed sessions ignore a pending save failure and reject further editing", async () => {
  const session = createTemplateAuthoringSession<string>();
  session.openNameDialog();
  session.changeNameDialogValue("template");
  const pending = deferred<boolean>();
  const save = session.submitNameDialog(
    () => pending.promise,
    () => "late failure",
  );
  session.destroy();
  pending.resolve(false);
  await save;
  assert.equal(get(session.nameDialogStateStore).error, "");
  assert.equal(session.canEdit(), false);
  assert.equal(
    session.startEditing(() => "content"),
    false,
  );
});
