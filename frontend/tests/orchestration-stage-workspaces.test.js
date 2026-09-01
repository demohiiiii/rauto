import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";

import {
  createOrchestrationJobSettingsEditorWorkspace,
  createOrchestrationJobTargetsEditorWorkspace,
  createOrchestrationJobTargetsSectionWorkspace,
  createOrchestrationPlanSettingsEditorWorkspace,
  createOrchestrationStageEditorWorkspace,
  createOrchestrationStagesPanelWorkspace,
  orchestrationPlanFormModelFromJson,
} from "../src/domains/orchestration/index.js";

function planModel({ secondStage = false } = {}) {
  const stages = [
    {
      name: "prepare",
      strategy: "serial",
      jobs: [
        {
          name: "collect",
          strategy: "serial",
          targets: ["edge-1"],
          action: {
            kind: "tx_workflow",
            workflow: { name: "collect", blocks: [] },
          },
        },
      ],
    },
  ];
  if (secondStage) {
    stages.push({ name: "deploy", strategy: "serial", jobs: [] });
  }
  return orchestrationPlanFormModelFromJson({
    name: "rollout",
    stages,
  });
}

test("stage panel workspace adds and removes stages with the latest context", () => {
  const firstChanges = [];
  const secondChanges = [];
  const workspace = createOrchestrationStagesPanelWorkspace({
    model: planModel(),
    onChange: (model) => firstChanges.push(model),
  });

  get(workspace.panelCallbacksStateStore).addStage();
  assert.equal(firstChanges[0].stages.length, 2);

  workspace.setStagesPanelContext({
    model: planModel({ secondStage: true }),
    onChange: (model) => secondChanges.push(model),
  });
  get(workspace.panelCallbacksStateStore).removeStageHandler(0)();

  assert.equal(firstChanges.length, 1);
  assert.deepEqual(
    secondChanges[0].stages.map((stage) => stage.name),
    ["deploy"],
  );
});

test("stage and job editor workspaces patch the selected rows", () => {
  const stageChanges = [];
  const currentModel = planModel({ secondStage: true });
  const stageWorkspace = createOrchestrationStageEditorWorkspace();
  stageWorkspace.setStageContext({
    model: currentModel,
    onChange: (model) => stageChanges.push(model),
    stageRow: { stage: currentModel.stages[1], stageIndex: 1 },
  });

  const stageCallbacks = get(stageWorkspace.stageEditorCallbacksStateStore);
  stageCallbacks.addJob();
  stageCallbacks.fieldValueHandler("name")("release");

  assert.equal(stageChanges[0].stages[1].jobs.length, 1);
  assert.equal(stageChanges[1].stages[1].name, "release");
  assert.equal(stageChanges[1].stages[0].name, "prepare");

  const jobChanges = [];
  const jobWorkspace = createOrchestrationJobSettingsEditorWorkspace({
    job: currentModel.stages[0].jobs[0],
    jobIndex: 0,
    model: currentModel,
    onChange: (model) => jobChanges.push(model),
    stageIndex: 0,
  });
  get(jobWorkspace.jobSettingsCallbacksStateStore).fieldValueHandler("name")(
    "verify",
  );

  assert.equal(jobChanges[0].stages[0].jobs[0].name, "verify");
});

test("plan settings workspace patches root fields", () => {
  const changes = [];
  const workspace = createOrchestrationPlanSettingsEditorWorkspace({
    model: planModel(),
    onChange: (model) => changes.push(model),
  });

  get(workspace.planSettingsCallbacksStateStore).fieldValueHandler("name")(
    "maintenance",
  );

  assert.equal(changes[0].name, "maintenance");
});

test("target workspaces replace lists and refresh their callbacks", () => {
  const modelChanges = [];
  const sectionWorkspace = createOrchestrationJobTargetsSectionWorkspace();
  sectionWorkspace.setJobTargetsSectionContext({
    jobIndex: 0,
    model: planModel(),
    onChange: (model) => modelChanges.push(model),
    stageIndex: 0,
  });
  get(sectionWorkspace.sectionCallbacksStateStore).replaceStringList(
    "targets",
    ["edge-2", "edge-3"],
  );

  assert.deepEqual(modelChanges[0].stages[0].jobs[0].targets, [
    "edge-2",
    "edge-3",
  ]);

  const firstCalls = [];
  const secondCalls = [];
  const editorWorkspace = createOrchestrationJobTargetsEditorWorkspace({
    onReplaceStringList: (...args) => firstCalls.push(args),
  });
  editorWorkspace.setJobTargetsContext({
    onReplaceStringList: (...args) => secondCalls.push(args),
  });
  get(editorWorkspace.targetActionHandlersStateStore).replaceStringListHandler(
    "targetTags",
  )(["core"]);

  assert.deepEqual(firstCalls, []);
  assert.deepEqual(secondCalls, [["targetTags", ["core"]]]);
});
