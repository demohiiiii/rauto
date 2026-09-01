import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";

import {
  createOrchestrationInputPanelWorkspace,
  orchestratedActiveStageDefinition,
  orchestrationStagePresentation,
} from "../src/domains/orchestration/index.js";

test("orchestration stage presentation selects the active page", () => {
  const definitions = [
    { id: "block", load: async () => ({}) },
    { id: "workflow", load: async () => ({}) },
    { id: "orchestrate", load: async () => ({}) },
  ];

  const workflowDisplay = orchestrationStagePresentation("workflow");
  assert.equal(workflowDisplay.workflowActive, true);
  assert.equal(
    orchestratedActiveStageDefinition(workflowDisplay, definitions)?.id,
    "workflow",
  );

  const fallbackDisplay = orchestrationStagePresentation("unsupported");
  assert.equal(fallbackDisplay.blockActive, true);
  assert.equal(
    orchestratedActiveStageDefinition(fallbackDisplay, definitions)?.id,
    "block",
  );
});

test("orchestration input workspace refreshes callbacks and sync version", async () => {
  const calls = [];
  const workspace = createOrchestrationInputPanelWorkspace({
    onExecute: () => calls.push("first"),
  });

  workspace.setInputPanelContext({
    onExecute: () => calls.push("second"),
    onLoadJsonTemplate: async (name) => calls.push(`load:${name}`),
  });

  await workspace.executeOrchestration();
  await workspace.loadJsonTemplate("campus", { isCurrent: () => true });

  assert.deepEqual(calls, ["second", "load:campus"]);
  assert.equal(get(workspace.editorSyncVersionStateStore), 1);
  assert.deepEqual(get(workspace.loadingKeysStore), []);
});
