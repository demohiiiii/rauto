import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";

import { createStandardInteractiveAuthoringState } from "../src/domains/standard/index.js";
import type {
  StandardInteractiveAuthoringState,
  StandardCommandVariableField,
  StandardInteractiveAuthoringOptions,
  StandardInteractiveTemplateDetail,
  StandardTemplateDetail,
} from "../src/domains/standard/index.js";

interface TemplateWriteCall {
  content: string;
  name: string;
}

interface AuthoringHarness {
  calls: {
    create: TemplateWriteCall[];
    inspect: string[];
    refresh: number;
    update: TemplateWriteCall[];
  };
  details: {
    builtin: StandardInteractiveTemplateDetail;
    custom: StandardInteractiveTemplateDetail;
  };
  inspections: Array<StandardInteractiveTemplateDetail | null>;
  state: StandardInteractiveAuthoringState;
}

function templateContent(name: string, command = "show version"): string {
  return `name = "${name}"
command = "${command}"
`;
}

function variableField(name: string): StandardCommandVariableField {
  return {
    allow_empty: false,
    default: null,
    description: null,
    label: name,
    name,
    options: [],
    placeholder: null,
    required: true,
    type: "string",
  };
}

function createHarness(
  overrides: Partial<StandardInteractiveAuthoringOptions> = {},
): AuthoringHarness {
  const calls = {
    create: [] as TemplateWriteCall[],
    inspect: [] as string[],
    refresh: 0,
    update: [] as TemplateWriteCall[],
  };
  const details = {
    custom: {
      content: templateContent("custom"),
      name: "custom",
      vars_schema: [variableField("site")],
    },
    builtin: {
      content: templateContent("builtin"),
      name: "builtin",
      vars_schema: [variableField("target")],
    },
  } satisfies AuthoringHarness["details"];
  const inspections: Array<StandardInteractiveTemplateDetail | null> = [];
  const state = createStandardInteractiveAuthoringState({
    confirmDiscard: () => true,
    createTemplate: async (name, content): Promise<StandardTemplateDetail> => {
      calls.create.push({ content, name });
      return { content, name };
    },
    getTemplate: async (name, { builtin }) =>
      builtin ? details.builtin : { ...details.custom, name },
    inspectTemplate: async (content) => {
      calls.inspect.push(content);
      return {
        content,
        name: "inspected",
        vars_schema: [variableField("inspected")],
      };
    },
    onInspection: (detail) => inspections.push(detail),
    parseBuiltinSelection: (value) =>
      value.startsWith("builtin:") ? value.slice(8) : null,
    refreshTemplates: async () => {
      calls.refresh += 1;
    },
    updateTemplate: async (name, content): Promise<StandardTemplateDetail> => {
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
  assert.deepEqual(inspections.at(-1)?.vars_schema, [variableField("site")]);
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

test("loaded templates reject legacy fields without replacing the current draft", async () => {
  const { state } = createHarness({
    getTemplate: async () => ({
      content: `name = "builtin"
description = "legacy server metadata"
command = "show version"
`,
      name: "builtin",
      vars_schema: [],
    }),
  });

  const previous = get(state.draft.tomlTextStateStore);
  assert.equal(await state.selectTemplate("builtin:builtin"), false);
  assert.equal(get(state.draft.tomlTextStateStore), previous);
});

test("manual drafts can run without naming, and save asks for a new template name", async () => {
  const { calls, state } = createHarness();
  assert.equal(get(state.actionStateStore).canSave, false);
  state.setModel({
    ...get(state.draft.modelStateStore),
    command: "show clock",
  });
  await state.inspectCurrent();
  assert.equal(get(state.actionStateStore).canRun, true);
  assert.equal(get(state.actionStateStore).canSave, true);
  assert.equal(state.executeSource().kind, "temporary");
  await state.save();
  assert.equal(get(state.nameDialogStateStore).open, true);
  assert.equal(calls.create.length, 0);
  state.setNameDialogValue("new-interactive");
  assert.equal(await state.submitNameDialog(), true);
  assert.equal(calls.create[0].name, "new-interactive");
  assert.match(calls.create[0].content, /command = "show clock"/);
  assert.equal(calls.refresh, 1);
  assert.equal(get(state.selectionStateStore).value, "new-interactive");
  assert.equal(get(state.actionStateStore).readonly, true);
  assert.equal(state.draft.isDirty(), false);
});

test("custom save overwrites selection while save-as creates a new template", async () => {
  const { calls, state } = createHarness();
  await state.selectTemplate("custom");
  state.startEditing();
  const model = get(state.draft.modelStateStore);
  state.setModel({
    ...model,
    command: "show clock",
  });
  await state.inspectCurrent();

  assert.equal(await state.save(), true);
  assert.equal(calls.update[0].name, "custom");
  assert.match(calls.update[0].content, /command = "show clock"/);

  assert.equal(await state.saveAs("custom-copy"), true);
  assert.equal(calls.create.at(-1)?.name, "custom-copy");
  assert.equal(get(state.selectionStateStore).value, "custom-copy");
  assert.equal(get(state.draft.modelStateStore).name, "custom-copy");
});

test("dirty confirmation cancellation preserves selection and draft", async () => {
  const { state } = createHarness({ confirmDiscard: () => false });
  await state.selectTemplate("custom");
  state.startEditing();
  const model = get(state.draft.modelStateStore);
  state.setModel({ ...model, command: "show clock" });
  const before = get(state.draft.tomlTextStateStore);

  assert.equal(await state.selectTemplate("builtin:builtin"), false);
  assert.equal(get(state.selectionStateStore).value, "custom");
  assert.equal(get(state.draft.tomlTextStateStore), before);
});

test("stale template loads cannot replace the latest selection", async () => {
  let releaseFirst!: (detail: StandardInteractiveTemplateDetail) => void;
  const first = new Promise<StandardInteractiveTemplateDetail>((resolve) => {
    releaseFirst = resolve;
  });
  const { state } = createHarness({
    getTemplate: async (name) => {
      if (name === "first") return first;
      return {
        content: templateContent("second"),
        name: "second",
        vars_schema: [],
      };
    },
  });

  const firstLoad = state.selectTemplate("first");
  const secondLoad = state.selectTemplate("second");
  assert.equal(await secondLoad, true);
  releaseFirst({
    content: templateContent("first"),
    name: "first",
    vars_schema: [],
  });
  assert.equal(await firstLoad, false);

  assert.equal(get(state.selectionStateStore).value, "second");
  assert.equal(get(state.draft.modelStateStore).name, "second");
});

test("save dialog validates a manual draft name without clearing its content", async () => {
  const { calls, state } = createHarness();
  state.setModel({
    ...get(state.draft.modelStateStore),
    command: "show clock",
  });
  await state.inspectCurrent();
  await state.save();
  state.setNameDialogValue("  ");
  assert.equal(await state.submitNameDialog(), false);
  assert.notEqual(get(state.nameDialogStateStore).error, "");
  state.setNameDialogValue("dialog-copy");
  assert.equal(await state.submitNameDialog(), true);
  assert.equal(calls.create.at(-1)?.name, "dialog-copy");
  assert.match(calls.create[0].content, /show clock/);
});

test("selected templates reject visual and TOML changes until editing begins", async () => {
  const { state, calls } = createHarness();
  await state.selectTemplate("custom");
  const before = get(state.draft.tomlTextStateStore);
  state.setModel({ ...get(state.draft.modelStateStore), command: "erase" });
  assert.equal(state.setTomlText(templateContent("custom", "erase")), false);
  assert.equal(get(state.draft.tomlTextStateStore), before);
  assert.equal(await state.save(), false);
  assert.equal(calls.update.length, 0);
  state.startEditing();
  assert.equal(get(state.actionStateStore).editing, true);
  assert.equal(get(state.actionStateStore).readonly, false);
  state.setModel({
    ...get(state.draft.modelStateStore),
    command: "show clock",
  });
  await state.inspectCurrent();
  assert.equal(await state.save(), true);
  assert.equal(get(state.actionStateStore).readonly, true);
  assert.equal(get(state.actionStateStore).editing, false);
});

test("cancel restores content and variables and rejects an obsolete inspection", async () => {
  let resolveInspection!: (detail: StandardInteractiveTemplateDetail) => void;
  const { state, inspections, details } = createHarness({
    inspectTemplate: () =>
      new Promise((resolve) => {
        resolveInspection = resolve;
      }),
  });
  await state.selectTemplate("custom");
  const original = get(state.draft.tomlTextStateStore);
  state.startEditing();
  state.setModel({
    ...get(state.draft.modelStateStore),
    command: "show {{other}}",
  });
  const pending = state.inspectCurrent();
  state.cancelEditing();
  assert.equal(get(state.draft.tomlTextStateStore), original);
  assert.equal(state.draft.isDirty(), false);
  assert.equal(get(state.actionStateStore).readonly, true);
  resolveInspection({
    name: "custom",
    content: "",
    vars_schema: [variableField("other")],
  });
  assert.equal(await pending, false);
  assert.deepEqual(
    get(state.draft.inspectionStateStore).varsSchema,
    details.custom.vars_schema,
  );
  assert.deepEqual(inspections.at(-1)?.vars_schema, details.custom.vars_schema);
  state.startEditing();
  state.setTomlText("invalid = [");
  state.cancelEditing();
  assert.equal(get(state.draft.errorStateStore), "");
  assert.equal(get(state.draft.tomlTextStateStore), original);
});

for (const selection of ["custom", "builtin:builtin"]) {
  test(`copying ${selection} switches to manual with the complete template and only creates on save`, async () => {
    const { state, calls } = createHarness();
    await state.selectTemplate(selection);
    const content = get(state.draft.tomlTextStateStore);
    const schema = get(state.draft.inspectionStateStore).varsSchema;
    assert.equal(state.copyToManual(), true);
    assert.equal(get(state.selectionStateStore).value, "");
    assert.equal(get(state.actionStateStore).readonly, false);
    assert.equal(get(state.draft.tomlTextStateStore), content);
    assert.deepEqual(get(state.draft.inspectionStateStore).varsSchema, schema);
    assert.equal(calls.create.length, 0);
    await state.save();
    state.setNameDialogValue("copy");
    assert.equal(await state.submitNameDialog(), true);
    assert.equal(calls.create[0].name, "copy");
    assert.equal(calls.update.length, 0);
  });
}

test("failed saves preserve edits; pending saves block replacement and duplicate writes", async () => {
  let rejectSave!: (error: Error) => void;
  const { state } = createHarness({
    updateTemplate: () =>
      new Promise((_, reject) => {
        rejectSave = reject;
      }),
  });
  await state.selectTemplate("custom");
  state.startEditing();
  state.setModel({
    ...get(state.draft.modelStateStore),
    command: "show clock",
  });
  await state.inspectCurrent();
  const pending = state.save();
  assert.equal(await state.selectTemplate(""), false);
  assert.equal(await state.save(), false);
  state.cancelEditing();
  state.setModel({ ...get(state.draft.modelStateStore), command: "erase" });
  rejectSave(new Error("save unavailable"));
  assert.equal(await pending, false);
  assert.equal(get(state.actionStateStore).editing, true);
  assert.equal(get(state.draft.modelStateStore).command, "show clock");
  assert.match(get(state.actionStateStore).statusMessage, /save unavailable/);
  state.cancelEditing();
  assert.equal(get(state.draft.modelStateStore).command, "show version");
});

test("built-in templates reject editing and saving until copied to manual input", async () => {
  const { state, calls } = createHarness();
  await state.selectTemplate("builtin:builtin");
  const original = get(state.draft.tomlTextStateStore);
  assert.equal(get(state.actionStateStore).canEditTemplate, false);
  state.startEditing();
  assert.equal(get(state.actionStateStore).editing, false);
  assert.equal(get(state.actionStateStore).readonly, true);
  state.setModel({
    ...get(state.draft.modelStateStore),
    command: "show clock",
  });
  assert.equal(
    state.setTomlText(templateContent("builtin", "show clock")),
    false,
  );
  assert.equal(get(state.draft.tomlTextStateStore), original);
  assert.equal(await state.save(), false);
  assert.equal(get(state.nameDialogStateStore).open, false);
  assert.equal(calls.update.length, 0);
  assert.equal(calls.create.length, 0);
  assert.equal(state.copyToManual(), true);
  state.setModel({
    ...get(state.draft.modelStateStore),
    command: "show clock",
  });
  await state.inspectCurrent();
  await state.save();
  state.setNameDialogValue("builtin-copy");
  assert.equal(await state.submitNameDialog(), true);
  assert.equal(calls.create[0].name, "builtin-copy");
  assert.equal(calls.update.length, 0);
  assert.equal(get(state.actionStateStore).canEditTemplate, true);
});

test("failed template creation keeps the save dialog and draft ready for retry", async () => {
  let fail = true;
  const { state } = createHarness({
    createTemplate: async (name, content) => {
      if (fail) throw new Error("name already exists");
      return { name, content };
    },
  });
  state.setModel({
    ...get(state.draft.modelStateStore),
    command: "show version",
  });
  await state.inspectCurrent();
  await state.save();
  state.setNameDialogValue("taken");
  assert.equal(await state.submitNameDialog(), false);
  assert.equal(get(state.nameDialogStateStore).open, true);
  assert.equal(get(state.nameDialogStateStore).error, "name already exists");
  assert.equal(get(state.selectionStateStore).kind, "new");
  assert.equal(get(state.draft.modelStateStore).command, "show version");
  fail = false;
  state.setNameDialogValue("available");
  assert.equal(await state.submitNameDialog(), true);
  assert.equal(get(state.nameDialogStateStore).open, false);
  assert.equal(get(state.actionStateStore).readonly, true);
});
