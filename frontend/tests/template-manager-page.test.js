import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("template page reuses one catalog workspace for every content resource", async () => {
  const source = await readFile(
    path.resolve(
      "frontend/src/domains/templates/presentation/components/TemplateManagerWorkspace.svelte",
    ),
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

test("config fetch command editor uses catalog-backed selectors", async () => {
  const source = await readFile(
    path.resolve(
      "frontend/src/domains/templates/presentation/components/ConfigCatalogWorkspace.svelte",
    ),
    "utf8",
  );

  assert.match(source, /getDeviceProfilesOverview/);
  assert.match(source, /getProfileModes/);
  assert.match(source, /profileNamesFromOverview/);
  assert.match(source, /configCatalogKindNames/);
  assert.match(source, /profileModeNames/);
  assert.match(source, /<ModeExpressionField/);
  assert.equal((source.match(/<PlainSelectField/g) || []).length, 2);
  assert.doesNotMatch(
    source,
    /commandForm\.profile = event\.currentTarget\.value/,
  );
  assert.doesNotMatch(
    source,
    /commandForm\.kind = event\.currentTarget\.value/,
  );
  assert.doesNotMatch(
    source,
    /commandForm\.mode = event\.currentTarget\.value/,
  );
});

test("command flow templates reuse the shared three-view authoring surface", async () => {
  const source = await readFile(
    path.resolve(
      "frontend/src/domains/templates/presentation/components/TemplateCatalogPanel.svelte",
    ),
    "utf8",
  );
  const sharedViews = await readFile(
    path.resolve(
      "frontend/src/domains/command/presentation/components/CommandFlowAuthoringViews.svelte",
    ),
    "utf8",
  );

  assert.match(source, /createCommandFlowDraftWorkspace\(\)/);
  assert.match(source, /<CommandFlowAuthoringViews/);
  assert.match(source, /disabled=\{selected\.builtin\}/);
  assert.match(source, /xl:grid-cols-\[17rem_minmax\(0,1fr\)\]/);
  assert.match(source, /<Card\.Header class="border-b bg-muted\/20 p-3">/);
  assert.match(source, /<Card\.Content class="flex flex-col gap-1 p-1\.5">/);
  assert.match(sharedViews, /commandFlowEditorViewTabs/);
  assert.match(sharedViews, /CommandFlowTemplateEditor/);
  assert.match(sharedViews, /CommandFlowReadonlyView/);
  assert.match(sharedViews, /TextAreaField/);
});

test("mapping and show-object workspaces keep compact resource catalogs", async () => {
  const [mappingSource, showObjectSource] = await Promise.all([
    readFile(
      path.resolve(
        "frontend/src/domains/templates/presentation/components/TextfsmMappingWorkspace.svelte",
      ),
      "utf8",
    ),
    readFile(
      path.resolve(
        "frontend/src/domains/templates/presentation/components/ShowObjectWorkspace.svelte",
      ),
      "utf8",
    ),
  ]);

  assert.match(mappingSource, /xl:grid-cols-\[17rem_minmax\(28rem,1fr\)\]/);
  assert.match(showObjectSource, /xl:grid-cols-\[17rem_minmax\(30rem,1fr\)\]/);
  for (const source of [mappingSource, showObjectSource]) {
    assert.match(source, /<Card\.Header class="border-b bg-muted\/20 p-3">/);
    assert.match(source, /<Card\.Content class="flex flex-col gap-1 p-1\.5">/);
    assert.match(source, /h-9 rounded-lg pl-9 text-sm/);
  }
});
