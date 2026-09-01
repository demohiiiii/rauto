import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";

import {
  createOrchestrationTxWorkflowActionEditorWorkspace,
  orchestrationPlanFormModelFromJson,
} from "../src/domains/orchestration/index.js";

function planModel() {
  return orchestrationPlanFormModelFromJson({
    name: "rollout",
    stages: [
      {
        name: "prepare",
        strategy: "serial",
        jobs: [
          {
            name: "collect",
            strategy: "serial",
            action: {
              kind: "tx_workflow",
              workflow: { name: "collect", blocks: [] },
            },
          },
        ],
      },
    ],
  });
}

test("workflow action workspace normalizes template options", async () => {
  const requestedPaths = [];
  const workspace = createOrchestrationTxWorkflowActionEditorWorkspace({
    apiListTemplates: async (path) => {
      requestedPaths.push(path);
      return ["zeta", { name: "alpha" }, { name: "" }, null];
    },
  });

  await workspace.refreshTemplateOptions();

  assert.deepEqual(requestedPaths, ["/api/tx-workflow-templates"]);
  assert.deepEqual(get(workspace.templateOptionsStateStore), [
    { label: "", value: "" },
    { label: "alpha", value: "alpha" },
    { label: "zeta", value: "zeta" },
  ]);
  assert.equal(get(workspace.templateErrorStateStore), "");
});

test("workflow action callbacks use the latest plan context", () => {
  const firstChanges = [];
  const secondChanges = [];
  const errors = [];
  const workspace = createOrchestrationTxWorkflowActionEditorWorkspace({
    model: planModel(),
    onChange: (model) => firstChanges.push(model),
  });
  workspace.setTxWorkflowActionContext({
    jobIndex: 0,
    model: planModel(),
    onChange: (model) => secondChanges.push(model),
    onErrorChange: (error) => errors.push(error),
    stageIndex: 0,
  });

  const callbacks = get(workspace.actionCallbacksStateStore);
  callbacks.sourceChange("workflow_template_name");

  assert.deepEqual(firstChanges, []);
  assert.equal(secondChanges.length, 1);
  assert.equal(
    secondChanges[0].stages[0].jobs[0].action.txWorkflow.hasWorkflow,
    false,
  );
  assert.equal(
    secondChanges[0].stages[0].jobs[0].action.txWorkflow
      .hasWorkflowTemplateName,
    true,
  );

  callbacks.sourceBindings.setJsonText("{");
  assert.equal(secondChanges.length, 2);
  assert.notEqual(errors.at(-1), "");
});
