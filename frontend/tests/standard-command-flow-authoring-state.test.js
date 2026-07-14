import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import { createStandardCommandFlowAuthoringState } from "../src/modules/standardCommandFlowAuthoringState.js";

function templateContent(name, command = "show version") {
  return `name = "${name}"
[[steps]]
command = "${command}"
`;
}

function createHarness(overrides = {}) {
  const calls = {
    create: [],
    inspect: [],
    refresh: 0,
    update: [],
  };
  const details = {
    custom: {
      content: templateContent("custom"),
      name: "custom",
      vars_schema: [{ name: "site" }],
    },
    builtin: {
      content: templateContent("builtin"),
      name: "builtin",
      vars_schema: [{ name: "target" }],
    },
  };
  const inspections = [];
  const state = createStandardCommandFlowAuthoringState({
    confirmDiscard: () => true,
    createTemplate: async (name, content) => {
      calls.create.push({ content, name });
      return { content, name };
    },
    getTemplate: async (name, { builtin }) =>
      builtin ? details.builtin : { ...details.custom, name },
    inspectTemplate: async (content) => {
      calls.inspect.push(content);
      return { content, vars_schema: [{ name: "inspected" }] };
    },
    onInspection: (detail) => inspections.push(detail),
    parseBuiltinSelection: (value) =>
      value.startsWith("builtin:") ? value.slice(8) : null,
    refreshTemplates: async () => {
      calls.refresh += 1;
    },
    updateTemplate: async (name, content) => {
      calls.update.push({ content, name });
      return { content, name };
    },
    ...overrides,
  });
  return { calls, details, inspections, state };
}

test("selected custom template loads into one clean visual and TOML draft", async () => {
  const { inspections, state } = createHarness();

  assert.equal(await state.selectTemplate("custom"), true);

  assert.deepEqual(get(state.selectionStateStore), {
    kind: "custom",
    name: "custom",
    value: "custom",
  });
  assert.equal(get(state.draft.modelStateStore).name, "custom");
  assert.match(get(state.draft.tomlTextStateStore), /name = "custom"/);
  assert.equal(state.draft.isDirty(), false);
  assert.deepEqual(inspections.at(-1).vars_schema, [{ name: "site" }]);
});

test("built-in templates run current content but cannot overwrite", async () => {
  const { state } = createHarness();

  await state.selectTemplate("builtin:builtin");

  const actions = get(state.actionStateStore);
  assert.equal(actions.canSave, false);
  assert.equal(actions.canSaveAs, true);
  assert.deepEqual(state.executeSource(), {
    content: get(state.draft.tomlTextStateStore),
    kind: "temporary",
  });
});

test("loaded templates drop legacy descriptions before strict parsing", async () => {
  const { state } = createHarness({
    getTemplate: async () => ({
      content: `name = "builtin"
description = "legacy server metadata"
[[steps]]
command = "show version"
`,
      name: "builtin",
      vars_schema: [],
    }),
  });

  assert.equal(await state.selectTemplate("builtin:builtin"), true);
  assert.doesNotMatch(get(state.draft.tomlTextStateStore), /description/);
  assert.equal(get(state.draft.modelStateStore).name, "builtin");
});

test("an unnamed draft must be named before it can be saved directly", async () => {
  const { calls, state } = createHarness();

  const initialActions = get(state.actionStateStore);
  assert.equal(initialActions.canSave, false);
  assert.equal(initialActions.canSaveAs, false);
  assert.equal(initialActions.canRun, false);
  assert.equal(await state.save(), false);
  assert.equal(calls.create.length, 0);

  state.createNewDraft("named-draft");
  assert.equal(get(state.actionStateStore).canSave, true);
});

test("new named drafts create templates and become selected custom templates", async () => {
  const { calls, state } = createHarness();

  assert.equal(state.createNewDraft("new-flow"), true);
  assert.equal(get(state.selectionStateStore).kind, "new");
  assert.equal(get(state.draft.modelStateStore).name, "new-flow");
  assert.equal(state.draft.isDirty(), true);

  assert.equal(await state.save(), true);
  assert.equal(calls.create[0].name, "new-flow");
  assert.equal(calls.refresh, 1);
  assert.deepEqual(get(state.selectionStateStore), {
    kind: "custom",
    name: "new-flow",
    value: "new-flow",
  });
  assert.equal(state.draft.isDirty(), false);
});

test("custom save overwrites selection while save-as creates a new template", async () => {
  const { calls, state } = createHarness();
  await state.selectTemplate("custom");
  const model = get(state.draft.modelStateStore);
  state.setModel({
    ...model,
    steps: [{ ...model.steps[0], command: "show clock" }],
  });
  await state.inspectCurrent();

  assert.equal(await state.save(), true);
  assert.equal(calls.update[0].name, "custom");
  assert.match(calls.update[0].content, /command = "show clock"/);

  assert.equal(await state.saveAs("custom-copy"), true);
  assert.equal(calls.create.at(-1).name, "custom-copy");
  assert.equal(get(state.selectionStateStore).value, "custom-copy");
  assert.equal(get(state.draft.modelStateStore).name, "custom-copy");
});

test("dirty confirmation cancellation preserves selection and draft", async () => {
  const { state } = createHarness({ confirmDiscard: () => false });
  await state.selectTemplate("custom");
  const model = get(state.draft.modelStateStore);
  state.setModel({ ...model, stopOnError: !model.stopOnError });
  const before = get(state.draft.tomlTextStateStore);

  assert.equal(await state.selectTemplate("builtin:builtin"), false);
  assert.equal(get(state.selectionStateStore).value, "custom");
  assert.equal(get(state.draft.tomlTextStateStore), before);
});

test("stale template loads cannot replace the latest selection", async () => {
  let releaseFirst;
  const first = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const { state } = createHarness({
    getTemplate: async (name) => {
      if (name === "first") return first;
      return { content: templateContent("second"), name: "second" };
    },
  });

  const firstLoad = state.selectTemplate("first");
  const secondLoad = state.selectTemplate("second");
  assert.equal(await secondLoad, true);
  releaseFirst({ content: templateContent("first"), name: "first" });
  assert.equal(await firstLoad, false);

  assert.equal(get(state.selectionStateStore).value, "second");
  assert.equal(get(state.draft.modelStateStore).name, "second");
});

test("name dialog validates and dispatches new or save-as actions", async () => {
  const { calls, state } = createHarness();

  state.openNewDialog();
  state.setNameDialogValue("  ");
  assert.equal(await state.submitNameDialog(), false);
  assert.notEqual(get(state.nameDialogStateStore).errorMessage, "");

  state.setNameDialogValue("dialog-flow");
  assert.equal(await state.submitNameDialog(), true);
  assert.equal(get(state.selectionStateStore).kind, "new");

  state.openSaveAsDialog();
  state.setNameDialogValue("dialog-copy");
  assert.equal(await state.submitNameDialog(), true);
  assert.equal(calls.create.at(-1).name, "dialog-copy");
});
