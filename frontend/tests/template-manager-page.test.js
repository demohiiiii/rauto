import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const templatesRoot = path.resolve("frontend/src/pages/templates");

test("template manager keeps only domain-level page components", async () => {
  const files = (await readdir(templatesRoot)).sort();
  assert.deepEqual(files, [
    "ShowObjectWorkspace.svelte",
    "TemplateCatalogPanel.svelte",
    "TextfsmMappingWorkspace.svelte",
  ]);
});

test("template page reuses one catalog workspace for every content resource", async () => {
  const source = await readFile(
    path.resolve("frontend/src/pages/TemplatesPage.svelte"),
    "utf8",
  );
  assert.equal(
    (source.match(/createContentTemplateWorkspace\(\)/g) || []).length,
    1,
  );
  assert.match(source, /contentTemplateKinds\.has\(activeSectionKey\)/);
  assert.match(source, /<Tabs\.Root/);
  assert.match(source, /<Tabs\.List/);
  assert.match(source, /<Tabs\.Trigger/);
  assert.match(source, /<Card\.Root class="gap-0[^"]*py-0/);
  assert.match(source, /grid-cols-2[^"]*md:grid-cols-4/);
  assert.match(source, /data-active:!border-primary\/60/);
  assert.match(source, /data-active:!bg-primary\/10/);
  assert.match(source, /data-active:!text-primary/);
  assert.match(source, /after:bg-primary/);
  assert.doesNotMatch(source, /xl:grid-cols-8|truncate/);
  assert.doesNotMatch(source, /<aside/);
  assert.doesNotMatch(
    source,
    /BuiltinFlowTemplatesPanel|TemplateResourcePickerPanel/,
  );
});

test("command flow templates reuse the shared three-view authoring surface", async () => {
  const source = await readFile(
    path.resolve("frontend/src/pages/templates/TemplateCatalogPanel.svelte"),
    "utf8",
  );
  const sharedViews = await readFile(
    path.resolve(
      "frontend/src/components/command-flow/CommandFlowAuthoringViews.svelte",
    ),
    "utf8",
  );

  assert.match(source, /createCommandFlowDraftWorkspace\(\)/);
  assert.match(source, /<CommandFlowAuthoringViews/);
  assert.match(source, /disabled=\{selected\.builtin\}/);
  assert.match(sharedViews, /commandFlowEditorViewTabs/);
  assert.match(sharedViews, /CommandFlowTemplateEditor/);
  assert.match(sharedViews, /CommandFlowReadonlyView/);
  assert.match(sharedViews, /TextAreaField/);
});
