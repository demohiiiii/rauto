import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  txWorkflowDuplicateBlock,
  txWorkflowMoveBlock,
} from "../src/modules/transactionWorkflowEditorState.js";

const visualEditorPath = path.resolve(
  "frontend/src/pages/orchestrated/TxWorkflowVisualEditor.svelte",
);
const flowNodePath = path.resolve(
  "frontend/src/pages/orchestrated/TxWorkflowFlowNode.svelte",
);
const flowViewportControllerPath = path.resolve(
  "frontend/src/pages/orchestrated/TxWorkflowFlowViewportController.svelte",
);

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
