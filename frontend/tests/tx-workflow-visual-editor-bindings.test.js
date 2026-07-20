import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  txWorkflowDuplicateBlock,
  txWorkflowMoveBlock,
  txWorkflowTemplateRefEditorBindings,
  txWorkflowVisualEditorBindings,
  txWorkflowVisualEditorDisplay,
} from "../src/modules/transactions/transactionWorkflowEditorState.js";

const visualEditorPath = path.resolve(
  "frontend/src/pages/orchestrated/TxWorkflowVisualEditor.svelte",
);
const flowNodePath = path.resolve(
  "frontend/src/pages/orchestrated/TxWorkflowFlowNode.svelte",
);
const flowViewportControllerPath = path.resolve(
  "frontend/src/pages/orchestrated/TxWorkflowFlowViewportController.svelte",
);

const valueEvent = (value) => ({ currentTarget: { value } });
const checkedEvent = (checked) => ({ currentTarget: { checked } });

test("tx workflow visual editor uses the exported block bindings helper name", async () => {
  const source = await readFile(visualEditorPath, "utf8");

  assert.equal(
    source.includes("workflowActionHandlers.blockActionHandlers("),
    false,
  );
  assert.equal(source.includes("workflowActionHandlers.blockBindings("), true);
});

test("tx workflow blocks duplicate and move without mutating the source", () => {
  const model = {
    blocks: [
      { sourceKind: "inline", inlineBlock: { name: "one" } },
      { sourceKind: "inline", inlineBlock: { name: "two" } },
    ],
  };

  const duplicated = txWorkflowDuplicateBlock(model, 0);
  assert.deepEqual(
    duplicated.blocks.map((block) => block.inlineBlock.name),
    ["one", "one", "two"],
  );
  duplicated.blocks[1].inlineBlock.name = "copy";
  assert.equal(duplicated.blocks[0].inlineBlock.name, "one");

  const moved = txWorkflowMoveBlock(model, 1, 0);
  assert.deepEqual(
    moved.blocks.map((block) => block.inlineBlock.name),
    ["two", "one"],
  );
  assert.deepEqual(
    model.blocks.map((block) => block.inlineBlock.name),
    ["one", "two"],
  );
});

test("workflow editor omits empty structured metadata controls", async () => {
  const model = {
    blocks: [
      {
        sourceKind: "inline",
        inlineBlock: { extra: {} },
        templateRef: { extra: {} },
      },
    ],
  };
  const display = txWorkflowVisualEditorDisplay(model);
  const bindings = txWorkflowVisualEditorBindings(model, () => {});
  const blockBindings = bindings.blockBindings(0);
  const blockEditor = await readFile(
    path.resolve(
      "frontend/src/pages/orchestrated/TxWorkflowBlockEditor.svelte",
    ),
    "utf8",
  );

  assert.equal(Object.hasOwn(display, "rootMetadataFieldRows"), false);
  assert.equal(Object.hasOwn(display, "rootMetadataSource"), false);
  assert.equal(Object.hasOwn(display.blockRows[0], "metadataFieldRows"), false);
  assert.equal(
    Object.hasOwn(display.blockRows[0], "metadataExtraSource"),
    false,
  );
  assert.equal(Object.hasOwn(bindings, "extraPresenceHandler"), false);
  assert.equal(Object.hasOwn(bindings, "extraValueHandler"), false);
  assert.equal(Object.hasOwn(bindings, "setRootExtra"), false);
  assert.equal(Object.hasOwn(blockBindings, "setMetadataPresence"), false);
  assert.equal(Object.hasOwn(blockBindings, "setMetadataValue"), false);
  assert.doesNotMatch(blockEditor, /metadataFieldRows|blockMetadata/);
});

test("template ref editor bindings preserve source and presence patches", () => {
  const patches = [];
  const fieldPresenceChanges = [];
  const varsPresenceChanges = [];
  const bindings = txWorkflowTemplateRefEditorBindings(
    {
      hasTxBlockTemplateContent: false,
      hasTxBlockTemplateName: true,
      txBlockTemplateContent: null,
      txBlockTemplateName: "base",
    },
    {
      patchTemplateRef: (patch) => patches.push(patch),
      setTemplateRefFieldPresence: (field, enabled) =>
        fieldPresenceChanges.push([field, enabled]),
      setTemplateRefVarsPresence: (enabled) =>
        varsPresenceChanges.push(enabled),
    },
  );

  bindings.valueHandler("name")(valueEvent("custom"));
  bindings.sourceModeHandler()(valueEvent("content"));
  bindings.templateContentHandler()(valueEvent('{"name":"inline"}'));
  bindings.templateNameHandler()(valueEvent("saved"));
  bindings.setTemplateVars({ site: "edge" });
  bindings.setExtra({ owner: "network" });
  bindings.presenceToggle("name")(checkedEvent(false));
  bindings.varsToggle()(checkedEvent(true));

  assert.deepEqual(patches, [
    { hasName: true, name: "custom" },
    { hasTxBlockTemplateName: false, txBlockTemplateName: null },
    {
      hasTxBlockTemplateContent: true,
      hasTxBlockTemplateName: false,
      txBlockTemplateContent: '{"name":"inline"}',
      txBlockTemplateName: null,
    },
    {
      hasTxBlockTemplateContent: false,
      hasTxBlockTemplateName: true,
      txBlockTemplateContent: null,
      txBlockTemplateName: "saved",
    },
    { hasTxBlockTemplateVars: true, txBlockTemplateVars: { site: "edge" } },
    { extra: { owner: "network" } },
  ]);
  assert.deepEqual(fieldPresenceChanges, [["name", false]]);
  assert.deepEqual(varsPresenceChanges, [true]);
});

test("tx workflow editor uses a focused flow canvas and live read-only view", async () => {
  const visualSource = await readFile(visualEditorPath, "utf8");
  const flowNodeSource = await readFile(flowNodePath, "utf8");
  const flowViewportControllerSource = await readFile(
    flowViewportControllerPath,
    "utf8",
  );
  const inputSource = await readFile(
    path.resolve("frontend/src/pages/orchestrated/TxWorkflowInputPanel.svelte"),
    "utf8",
  );
  const runSource = await readFile(
    path.resolve("frontend/src/pages/orchestrated/TxWorkflowRunPanel.svelte"),
    "utf8",
  );
  const jsonSurfaceSource = await readFile(
    path.resolve("frontend/src/pages/orchestrated/TxJsonFormSurface.svelte"),
    "utf8",
  );

  assert.match(visualSource, /data-testid="tx-workflow-editor-layout"/);
  assert.match(visualSource, /SvelteFlow/);
  assert.match(visualSource, /nodesDraggable=\{false\}/);
  assert.match(visualSource, /nodesConnectable=\{false\}/);
  assert.match(visualSource, /onnodeclick=\{selectGraphNode\}/);
  assert.match(visualSource, /txBlockTimelineDisplay/);
  assert.doesNotMatch(visualSource, /workflow-root/);
  assert.doesNotMatch(visualSource, /TxBlockRootSettingsEditor/);
  assert.match(visualSource, /PresenceFieldGrid/);
  assert.match(visualSource, /tx-workflow-inspector/);
  assert.match(visualSource, /embedded = false/);
  assert.match(visualSource, /data-testid="tx-workflow-embedded-editor"/);
  assert.match(visualSource, /<TxWorkflowBlockEditor[\s\S]*embedded=\{true\}/);
  assert.ok(
    visualSource.indexOf('data-testid="tx-workflow-embedded-editor"') <
      visualSource.indexOf("<SvelteFlow"),
  );
  assert.match(visualSource, /startInspectorResize/);
  assert.match(visualSource, /collapseInspector/);
  assert.match(visualSource, /settingsCollapsed/);
  assert.match(visualSource, /collapseCanvasWindows/);
  assert.match(visualSource, /onpaneclick=\{collapseCanvasWindows\}/);
  assert.match(visualSource, /txWorkflowCanvasViewToolbar/);
  assert.doesNotMatch(visualSource, /data-sync-status/);
  assert.match(visualSource, /openCanvasView\("json"\)/);
  assert.match(visualSource, /openCanvasView\("readonly"\)/);
  assert.match(visualSource, /border-t border-border bg-background\/95/);
  assert.match(visualSource, /txWorkflowMoveBlockLeft/);
  assert.match(visualSource, /txWorkflowMoveBlockRight/);
  assert.match(flowNodeSource, /Handle/);
  assert.match(flowNodeSource, /NodeToolbar/);
  assert.match(flowNodeSource, /ArrowLeftIcon/);
  assert.match(flowNodeSource, /ArrowRightIcon/);
  assert.match(flowNodeSource, /data\.onDuplicate/);
  assert.match(flowNodeSource, /data\.onDelete/);
  assert.match(flowNodeSource, /data\.sequenceText/);
  assert.match(flowNodeSource, /data\.commandRows/);
  assert.match(flowViewportControllerSource, /useSvelteFlow/);
  assert.match(flowViewportControllerSource, /setCenter/);
  assert.match(visualSource, /selectedBlockRow/);
  assert.match(visualSource, /duplicateBlock/);
  assert.match(visualSource, /moveBlock/);
  assert.doesNotMatch(visualSource, /JsonObjectFieldsEditor/);
  assert.match(inputSource, /Dialog\.Root/);
  assert.match(inputSource, /canvasViewDialog/);
  assert.match(inputSource, /navigationMode="hidden"/);
  assert.match(inputSource, /onOpenView=\{openCanvasViewDialog\}/);
  assert.match(inputSource, /editorDisplayMode=\{canvasViewDialog\.mode\}/);
  assert.match(inputSource, /immediateEditorInput/);
  assert.match(inputSource, /fillEditorHeight/);
  assert.match(inputSource, /#snippet readonlyContent/);
  assert.match(inputSource, /txWorkflowPreviewPresentation/);
  assert.match(jsonSurfaceSource, /hideNavigation/);
  assert.doesNotMatch(jsonSurfaceSource, /actionViewRows/);
  assert.doesNotMatch(runSource, /TxWorkflowPreviewPanel|onPreview/);
  assert.match(runSource, /txWorkflowRunTitle/);
});
