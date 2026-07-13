import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("transaction block editor adds one live read-only view", () => {
  const configSource = read("frontend/src/config/dashboardModes.js");
  const inputSource = read(
    "frontend/src/pages/orchestrated/TxBlockInputPanel.svelte",
  );
  const surfaceSource = read(
    "frontend/src/pages/orchestrated/TxJsonFormSurface.svelte",
  );

  assert.match(configSource, /txBlockReadonlyEditorViewTabs/);
  assert.match(
    configSource,
    /\{ value: "readonly", labelKey: "txBlockEditorReadonlyTab" \}/,
  );
  assert.match(inputSource, /tabItems=\{txBlockReadonlyEditorViewTabs\}/);
  assert.match(inputSource, /#snippet readonlyContent/);
  assert.match(inputSource, /txBlockPreviewPresentation/);
  assert.match(inputSource, /previewPresentation=\{txBlockReadonlyPreview\}/);
  assert.match(surfaceSource, /editorDisplayMode === "readonly"/);
  assert.match(surfaceSource, /@render readonlyContent\(\)/);
});

test("transaction block run panel only exposes execution and results", () => {
  const runPanelSource = read(
    "frontend/src/pages/orchestrated/TxBlockRunPanel.svelte",
  );
  const stageSource = read(
    "frontend/src/pages/orchestrated/TxBlockStage.svelte",
  );

  assert.doesNotMatch(runPanelSource, /onDirectPlan|onTemplatePlan/);
  assert.doesNotMatch(runPanelSource, /planStatusDisplayStateStore/);
  assert.doesNotMatch(runPanelSource, /TxBlockPreviewPanel/);
  assert.match(runPanelSource, /TxBlockResultPanel/);
  assert.equal((runPanelSource.match(/<LoadingButton/g) || []).length, 2);
  assert.doesNotMatch(stageSource, /onDirectPlan|onTemplatePlan/);
});
