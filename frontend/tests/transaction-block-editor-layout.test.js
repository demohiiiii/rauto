import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(path, "utf8");
}

test("transaction block editor composes the approved responsive workspace", () => {
  const visualEditor = source(
    "frontend/src/pages/orchestrated/TxBlockVisualEditor.svelte",
  );

  assert.match(visualEditor, /import TxBlockTimeline from/);
  assert.match(visualEditor, /import TxBlockRootInspector from/);
  assert.match(visualEditor, /data-testid="tx-block-editor-layout"/);
  assert.match(
    visualEditor,
    /lg:grid-cols-\[minmax\(18rem,34%\)_minmax\(0,66%\)\]/,
  );
  assert.match(visualEditor, /lg:gap-0/);
  assert.match(
    visualEditor,
    /<div class="min-w-0 lg:pr-4">\s*<TxBlockTimeline/,
  );
  assert.match(visualEditor, /editorSummary\.cellRows/);
  assert.match(visualEditor, /<TxBlockTimeline/);
  assert.match(visualEditor, /<TxBlockRootInspector/);
});

test("timeline owns semantic step actions and local delete confirmation", () => {
  const timeline = source(
    "frontend/src/pages/orchestrated/TxBlockTimeline.svelte",
  );

  assert.match(timeline, /moveSelectedStep/);
  assert.match(timeline, /duplicateSelectedStep/);
  assert.match(timeline, /confirmDelete/);
  assert.match(timeline, /PlusIcon/);
  assert.match(timeline, /CopyIcon/);
  assert.match(timeline, /Trash2Icon/);
  assert.match(timeline, /ArrowUpIcon/);
  assert.match(timeline, /ArrowDownIcon/);
  assert.match(timeline, /aria-pressed=\{display\.rootSelected\}/);
  assert.match(timeline, /aria-pressed=\{stepRow\.selected\}/);
  assert.match(timeline, /role="status"/);
  assert.match(timeline, /aria-live="polite"/);
  assert.match(timeline, /bind:ref=\{confirmButton\}/);
  assert.match(timeline, /confirmButton\?\.focus\(\)/);
  assert.match(timeline, /requestAnimationFrame/);
  assert.match(timeline, /bind:ref=\{deleteButton\}/);
  assert.match(timeline, /deleteButton\?\.focus\(\)/);
  assert.match(timeline, /bind:this=\{timelineHost\}/);
  assert.match(
    timeline,
    /querySelector\(\s*["']\[aria-pressed="true"\]["']\s*,?\s*\)/,
  );
  assert.match(timeline, /timelineHost\?\.isConnected/);
  assert.match(timeline, /selectedTarget\?\.isConnected/);
  assert.match(timeline, /flex-wrap items-center justify-end gap-2/);
  assert.doesNotMatch(timeline, /flex-wrap items-center justify-end gap-1/);
  assert.ok((timeline.match(/class="min-h-11 min-w-11/g) || []).length >= 7);
  assert.doesNotMatch(timeline, /<svg/);
});

test("root and step inspectors have a single outer card owner", () => {
  const visualEditor = source(
    "frontend/src/pages/orchestrated/TxBlockVisualEditor.svelte",
  );
  const rootInspector = source(
    "frontend/src/pages/orchestrated/TxBlockRootInspector.svelte",
  );
  const rollbackEditor = source(
    "frontend/src/pages/orchestrated/TxBlockRollbackPolicyEditor.svelte",
  );
  const stepEditor = source(
    "frontend/src/pages/orchestrated/TxBlockStepEditor.svelte",
  );

  const inspectorComposition = [
    visualEditor,
    rootInspector,
    rollbackEditor,
    stepEditor,
  ].join("\n");

  assert.equal(inspectorComposition.match(/<Card\.Root/g)?.length, 1);
  assert.match(rootInspector, /TxBlockRollbackPolicyEditor/);
  assert.doesNotMatch(rootInspector, /<Card\.Root/);
  assert.doesNotMatch(rollbackEditor, /ui\/card/);
  assert.doesNotMatch(rollbackEditor, /<Card\.(Root|Header|Content)/);
  assert.doesNotMatch(stepEditor, /<Card\.Root/);
  assert.doesNotMatch(stepEditor, /onRemove/);
});

test("transaction block inspectors do not expose advanced JSON presence controls", () => {
  const editorPaths = [
    "frontend/src/pages/orchestrated/TxBlockCommandEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockCommandInteractionEditor.svelte",
    "frontend/src/components/command-flow/CommandFlowSettings.svelte",
    "frontend/src/pages/orchestrated/TxBlockRollbackPolicyEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockRootSettingsEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockStepEditor.svelte",
  ];

  for (const path of editorPaths) {
    const editor = source(path);
    const grids = editor.match(/<PresenceFieldGrid[\s\S]*?\/>/g) || [];
    assert.ok(grids.length > 0, `${path} must contain a field grid`);
    for (const grid of grids) {
      assert.match(grid, /presenceControlsMode="hidden"/, path);
      assert.doesNotMatch(grid, /showPresenceToggleFallback=\{true\}/, path);
    }
  }

  assert.doesNotMatch(
    source("frontend/src/components/fragments/PresenceFieldGrid.svelte"),
    /txBlockFormAdvancedFields/,
  );
});

test("selected transaction inspector remounts when language changes", () => {
  const visualEditor = source(
    "frontend/src/pages/orchestrated/TxBlockVisualEditor.svelte",
  );

  assert.match(visualEditor, /currentLanguageState/);
  assert.match(visualEditor, /\{#key currentLanguage\}/);
});

test("transaction block editors do not expose JSON presence toggles", () => {
  const presenceOnlyEditors = [
    "frontend/src/pages/orchestrated/TxBlockCommandDynParamsEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockCommandInteractionEditor.svelte",
  ];

  for (const path of presenceOnlyEditors) {
    assert.doesNotMatch(source(path), /PresenceToggle/, path);
  }
});

test("transaction block structure omits unsupported transaction metadata", () => {
  const structure = source("frontend/src/modules/transactionStructure.js");
  const visualEditor = source(
    "frontend/src/pages/orchestrated/TxBlockVisualEditor.svelte",
  );
  const displayState = source(
    "frontend/src/modules/transactionBlockDisplayState.js",
  );

  assert.doesNotMatch(structure, /txBlockRootMetadataFieldDefs/);
  assert.doesNotMatch(structure, /txBlockCommandMetadataFieldDefs/);
  assert.doesNotMatch(structure, /txBlockInteractionMetadataFieldDefs/);
  assert.doesNotMatch(structure, /txBlockWholeResourceMetadataFieldDefs/);
  assert.doesNotMatch(structure, /txBlockRollbackCommandMetadataFieldDefs/);
  assert.doesNotMatch(structure, /txBlockStepMetadataFieldDefs/);
  assert.doesNotMatch(visualEditor, /txBlockCommandMetadataFieldDefs/);
  assert.doesNotMatch(visualEditor, /txBlockRollbackCommandMetadataFieldDefs/);
  assert.doesNotMatch(displayState, /txBlockRootMetadataFieldDefs/);
  assert.doesNotMatch(displayState, /txBlockInteractionMetadataFieldDefs/);
  assert.doesNotMatch(displayState, /txBlockWholeResourceMetadataFieldDefs/);
  assert.doesNotMatch(displayState, /txBlockStepMetadataFieldDefs/);
});

test("per-step rollback uses one policy-aware switch", () => {
  const visualEditor = source(
    "frontend/src/pages/orchestrated/TxBlockVisualEditor.svelte",
  );
  const stepEditor = source(
    "frontend/src/pages/orchestrated/TxBlockStepEditor.svelte",
  );

  assert.match(
    visualEditor,
    /perStepRollbackEnabled=\{model\.rollbackPolicy\?\.kind === "per_step"\}/,
  );
  assert.match(stepEditor, /import PlainCheckboxField from/);
  assert.match(stepEditor, /\{#if perStepRollbackEnabled\}/);
  assert.match(stepEditor, /controlKind="switch"/);
  assert.match(stepEditor, /txBlockFormEnableStepRollback/);
  assert.match(stepEditor, /rollbackEnabled/);
  assert.doesNotMatch(stepEditor, /rollbackState/);
  assert.doesNotMatch(stepEditor, /txBlockFormStepRollbackField/);
});

test("transaction step editor exposes only backend-supported step fields", () => {
  const stepEditor = source(
    "frontend/src/pages/orchestrated/TxBlockStepEditor.svelte",
  );

  assert.doesNotMatch(stepEditor, /JsonObjectFieldsEditor/);
  assert.doesNotMatch(stepEditor, /txBlockFormStepExtra/);
  assert.doesNotMatch(stepEditor, /step\.extra/);
  assert.doesNotMatch(stepEditor, /stepActionHandlers\.setExtra/);
});

test("transaction root editor exposes only backend-supported root fields", () => {
  const rootEditor = source(
    "frontend/src/pages/orchestrated/TxBlockRootInspector.svelte",
  );
  const bindings = source(
    "frontend/src/modules/transactionBlockBindingState.js",
  );

  assert.doesNotMatch(rootEditor, /JsonObjectFieldsEditor/);
  assert.doesNotMatch(rootEditor, /txBlockFormRootExtra/);
  assert.doesNotMatch(rootEditor, /rootPanel\.extraSource/);
  assert.doesNotMatch(rootEditor, /editorActionHandlers\.setRootExtra/);
  assert.doesNotMatch(bindings, /setRootExtra/);
  assert.doesNotMatch(bindings, /rootExtraPresenceHandler/);
  assert.doesNotMatch(bindings, /rootExtraValueHandler/);
});
