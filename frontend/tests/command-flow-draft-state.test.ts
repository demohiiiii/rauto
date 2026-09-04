import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import { commandFlowEditorViewTabs } from "../src/config/dashboardModes.js";
import { createCommandFlowDraftWorkspace } from "../src/domains/command/index.js";
import type { TemplateVariableField } from "../src/domains/templates/index.js";

function variableField(name: string): TemplateVariableField {
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

test("command flow editor exposes visual, TOML, and read-only views", () => {
  assert.deepEqual(
    commandFlowEditorViewTabs.map((tab) => tab.value),
    ["visual", "toml", "readonly"],
  );

  const workspace = createCommandFlowDraftWorkspace();
  workspace.selectTab("readonly");
  assert.equal(get(workspace.activeTabStateStore), "readonly");

  workspace.selectTab("unsupported");
  assert.equal(get(workspace.activeTabStateStore), "visual");
});

test("visual changes update the canonical TOML", () => {
  const workspace = createCommandFlowDraftWorkspace();
  const model = get(workspace.modelStateStore);

  workspace.setModel({
    ...model,
    name: "deploy",
    steps: [{ ...model.steps[0]!, command: "show version" }],
  });

  assert.match(get(workspace.tomlTextStateStore), /^name = "deploy"/);
  assert.match(get(workspace.tomlTextStateStore), /command = "show version"/);
  assert.equal(get(workspace.errorStateStore), "");
});

test("valid TOML updates the visual model", () => {
  const workspace = createCommandFlowDraftWorkspace();

  workspace.setTomlText(`name = "clock"
stop_on_error = true
[[steps]]
command = "show clock"
`);

  assert.equal(get(workspace.modelStateStore).name, "clock");
  assert.equal(get(workspace.modelStateStore).steps[0]?.command, "show clock");
});

test("invalid TOML keeps exact text and the last valid model", () => {
  const workspace = createCommandFlowDraftWorkspace();
  const previousModel = get(workspace.modelStateStore);

  workspace.setTomlText('name = "broken');

  assert.equal(get(workspace.tomlTextStateStore), 'name = "broken');
  assert.deepEqual(get(workspace.modelStateStore), previousModel);
  assert.notEqual(get(workspace.errorStateStore), "");
  assert.equal(workspace.canSubmit(), false);
});

test("only the latest inspection result updates runtime schema", () => {
  const workspace = createCommandFlowDraftWorkspace();
  const first = workspace.beginInspection();
  const second = workspace.beginInspection();
  const staleField = variableField("stale");
  const siteField = variableField("site");

  assert.equal(
    workspace.applyInspection(first, { vars_schema: [staleField] }),
    false,
  );
  assert.equal(
    workspace.applyInspection(second, { vars_schema: [siteField] }),
    true,
  );
  assert.deepEqual(get(workspace.inspectionStateStore).varsSchema, [siteField]);
});

test("draft cannot submit while backend inspection is pending", () => {
  const workspace = createCommandFlowDraftWorkspace();

  workspace.beginInspection();

  assert.equal(workspace.canSubmit(), false);
});

test("editing the draft invalidates an in-flight inspection result", () => {
  const workspace = createCommandFlowDraftWorkspace();
  const pending = workspace.beginInspection();

  workspace.setTomlText(`name = "newer"
[[steps]]
command = "show clock"
`);

  assert.equal(
    workspace.applyInspection(pending, {
      vars_schema: [variableField("stale")],
    }),
    false,
  );
  assert.deepEqual(get(workspace.inspectionStateStore).varsSchema, []);
});

test("draft clean baseline tracks edits and valid source replacement", () => {
  const workspace = createCommandFlowDraftWorkspace();

  workspace.markClean();
  assert.equal(workspace.isDirty(), false);

  const model = get(workspace.modelStateStore);
  workspace.setModel({ ...model, name: "changed" });
  assert.equal(workspace.isDirty(), true);

  assert.equal(
    workspace.replaceFromToml(`name = "loaded"
[[steps]]
command = "show version"
`),
    true,
  );
  assert.equal(workspace.isDirty(), false);

  workspace.markUnsaved();
  assert.equal(workspace.isDirty(), true);
});
