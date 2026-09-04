import assert from "node:assert/strict";
import test from "node:test";

import {
  orchestrationDuplicateJob,
  orchestrationDuplicateStage,
  orchestrationInsertStage,
  orchestrationMoveJob,
  orchestrationMoveStage,
  orchestrationPlanFormModelFromJson,
  orchestrationReplaceJobStringList,
} from "../src/domains/orchestration/index.js";
import type {
  JsonObject,
  OrchestrationJobFlowNode,
  OrchestrationWorkflowBlockFlowNode,
} from "../src/domains/orchestration/index.js";
import {
  createOrchestrationSourceChangeGuard,
  orchestrationFlowGraph,
  orchestrationNormalizeFlowSelection,
} from "../src/domains/orchestration/index.js";
import { orchestrationInlineExecutionPayload } from "../src/domains/orchestration/index.js";
import { orchestrationUpdateInlineWorkflow } from "../src/domains/orchestration/index.js";

function orchestrationModel() {
  return orchestrationPlanFormModelFromJson({
    stages: [
      {
        name: "prepare",
        jobs: [
          {
            name: "backup",
            targets: ["edge-01"],
            action: {
              kind: "tx_workflow",
              workflow: {
                name: "backup-workflow",
                blocks: [
                  {
                    name: "show-version",
                    steps: [
                      {
                        run: { kind: "command", command: "show version" },
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            name: "validate",
            targets: [],
            action: {
              kind: "tx_workflow",
              workflow: { name: "validate-workflow", blocks: [] },
            },
          },
        ],
      },
      {
        name: "deploy",
        jobs: [
          {
            name: "apply",
            targets: [],
            action: {
              kind: "tx_workflow",
              workflow: { name: "apply-workflow", blocks: [] },
            },
          },
        ],
      },
    ],
  });
}

interface InlineWorkflowBlock {
  name: string;
  steps: Array<{ run: { command: string; kind: "command" } }>;
}

interface InlineWorkflow extends JsonObject {
  blocks: InlineWorkflowBlock[];
  name: string;
}

function inlineWorkflow(model: ReturnType<typeof orchestrationModel>) {
  const workflow = model.stages[0].jobs[0].action.txWorkflow.workflow;
  assert.ok(workflow);
  return workflow as InlineWorkflow;
}

test("orchestration stages move and duplicate without mutating the source", () => {
  const model = orchestrationModel();
  const moved = orchestrationMoveStage(model, 1, 0);
  assert.deepEqual(
    moved.stages.map((stage) => stage.name),
    ["deploy", "prepare"],
  );

  const duplicated = orchestrationDuplicateStage(model, 0);
  assert.deepEqual(
    duplicated.stages.map((stage) => stage.name),
    ["prepare", "prepare", "deploy"],
  );
  const duplicatedWorkflow =
    duplicated.stages[1].jobs[0].action.txWorkflow.workflow;
  assert.ok(duplicatedWorkflow);
  duplicatedWorkflow.name = "changed-workflow";
  assert.equal(
    duplicated.stages[0].jobs[0].action.txWorkflow.workflow?.name,
    "backup-workflow",
  );
  assert.deepEqual(
    model.stages.map((stage) => stage.name),
    ["prepare", "deploy"],
  );
});

test("orchestration stages insert at any boundary without mutating the source", () => {
  const model = orchestrationModel();
  const inserted = orchestrationInsertStage(model, 1);

  assert.equal(inserted.stages.length, 3);
  assert.equal(inserted.stages[0].name, "prepare");
  assert.equal(inserted.stages[2].name, "deploy");
  assert.equal(model.stages.length, 2);
});

test("orchestration jobs move and duplicate within their stage", () => {
  const model = orchestrationModel();
  const moved = orchestrationMoveJob(model, 0, 1, 0);
  assert.deepEqual(
    moved.stages[0].jobs.map((job) => job.name),
    ["validate", "backup"],
  );

  const duplicated = orchestrationDuplicateJob(model, 0, 0);
  assert.deepEqual(
    duplicated.stages[0].jobs.map((job) => job.name),
    ["backup", "backup", "validate"],
  );
  duplicated.stages[0].jobs[1].targets[0] = "edge-02";
  assert.equal(duplicated.stages[0].jobs[0].targets[0], "edge-01");
  assert.equal(model.stages[0].jobs[0].targets[0], "edge-01");
});

test("orchestration job selectors replace atomically and normalize values", () => {
  const model = orchestrationModel();
  const replaced = orchestrationReplaceJobStringList(
    model,
    0,
    0,
    "targetGroups",
    ["core", "", " core ", "access"],
  );

  assert.deepEqual(replaced.stages[0].jobs[0].targetGroups, ["core", "access"]);
  assert.equal(replaced.stages[0].jobs[0].hasTargetGroups, true);
  assert.deepEqual(model.stages[0].jobs[0].targetGroups, []);
  assert.equal(model.stages[0].jobs[0].hasTargetGroups, false);
});

test("orchestration flow graph derives stage groups and child job nodes", () => {
  const graph = orchestrationFlowGraph(orchestrationModel());
  const stageNodes = graph.nodes.filter((node) => node.type === "stage");
  const jobNodes = graph.nodes.filter((node) => node.type === "job");
  const workflowBlockNodes = graph.nodes.filter(
    (node) => node.type === "workflowBlock",
  );
  const stageInsertNodes = graph.nodes.filter(
    (node) => node.type === "stageInsert",
  );

  assert.equal(stageNodes.length, 2);
  assert.equal(jobNodes.length, 3);
  assert.equal(workflowBlockNodes.length, 1);
  assert.equal(stageInsertNodes.length, 2);
  assert.deepEqual(
    stageInsertNodes.map((node) => node.data.insertIndex),
    [1, 2],
  );
  assert.equal(jobNodes[0].parentId, "stage-0");
  assert.equal(jobNodes[0].extent, "parent");
  assert.equal(stageNodes[0].data.jobCount, 2);
  assert.equal(stageNodes[0].data.sequence, 1);
  assert.equal(stageNodes[0].data.empty, false);
  assert.equal(stageNodes[0].width, 380);
  assert.equal(stageNodes[0].height, 726);
  assert.equal(stageNodes[0].position.y, 96);
  assert.equal(stageNodes[1].position.y, 250);
  assert.equal(jobNodes[0].width, 340);
  assert.equal(jobNodes[0].height, 280);
  assert.equal(workflowBlockNodes[0].parentId, jobNodes[0].id);
  assert.equal(workflowBlockNodes[0].extent, "parent");
  assert.equal(workflowBlockNodes[0].width, 308);
  assert.equal(workflowBlockNodes[0].height, 82);
  assert.equal(workflowBlockNodes[0].position.y, 136);
  assert.equal(workflowBlockNodes[0].data.title, "show-version");
  assert.equal(workflowBlockNodes[0].data.operationText, "show version");
  assert.deepEqual(workflowBlockNodes[0].data.commandRows, ["show version"]);
  assert.equal(stageNodes[0].style, undefined);
  assert.equal(jobNodes[0].style, undefined);
  assert.equal(jobNodes[0].data.sourceKind, "manual");
  assert.equal(jobNodes[0].data.workflowName, "backup-workflow");
  assert.deepEqual(jobNodes[0].data.previewRows, [
    {
      blockName: "show-version",
      operationText: "show version",
      operationTexts: ["show version"],
    },
  ]);
  assert.equal(jobNodes[0].data.canAddBlock, true);
  assert.equal(jobNodes[0].data.targetCount, 1);
  assert.equal(jobNodes[0].data.stageStrategy, "serial");
  assert.equal(jobNodes[0].data.connectsToStageOutput, false);
  assert.equal(jobNodes[1].data.connectsToStageOutput, true);
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.source === "stage-0-job-0" &&
        edge.sourceHandle === "serial-out" &&
        edge.target === "stage-0-job-1" &&
        edge.targetHandle === "serial-in",
    ),
  );
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.kind === "serial-job-output" &&
        edge.source === "stage-0-job-1" &&
        edge.sourceHandle === "stage-out" &&
        edge.target === "stage-0" &&
        edge.targetHandle === "jobs-output",
    ),
  );
  assert.ok(
    graph.edges.some(
      (edge) => edge.source === "stage-0" && edge.target === "stage-insert-1",
    ),
  );
  assert.equal(stageInsertNodes[0].position.y, 437);
  assert.ok(
    stageNodes.every(
      (node) =>
        node.position.y + node.height / 2 ===
        stageInsertNodes[0].position.y + stageInsertNodes[0].height / 2,
    ),
  );
  assert.ok(
    graph.edges
      .filter(
        (edge) =>
          edge.kind === "stage-insert-link" || edge.kind === "stage-sequence",
      )
      .every((edge) => edge.type === "straight"),
  );
  assert.ok(
    graph.edges.some(
      (edge) => edge.source === "stage-insert-1" && edge.target === "stage-1",
    ),
  );
});

test("parallel stage jobs converge on the stage right output", () => {
  const model = orchestrationModel();
  model.stages[0].strategy = "parallel";
  const graph = orchestrationFlowGraph(model);
  const parallelEdges = graph.edges.filter(
    (edge) => edge.kind === "parallel-job",
  );
  const parallelJobNodes = graph.nodes.filter(
    (node): node is OrchestrationJobFlowNode =>
      node.type === "job" && node.data.stageIndex === 0,
  );

  assert.ok(
    parallelJobNodes.every(
      (node) =>
        node.data.stageStrategy === "parallel" &&
        node.data.connectsToStageOutput,
    ),
  );

  assert.deepEqual(
    parallelEdges.map((edge) => [
      edge.source,
      edge.sourceHandle,
      edge.target,
      edge.targetHandle,
    ]),
    [
      ["stage-0-job-0", "stage-out", "stage-0", "jobs-output"],
      ["stage-0-job-1", "stage-out", "stage-0", "jobs-output"],
    ],
  );
});

test("workflow blocks are nested in jobs and connected in execution order", () => {
  const model = orchestrationModel();
  inlineWorkflow(model).blocks.push({
    name: "validate-version",
    steps: [{ run: { kind: "command", command: "show inventory" } }],
  });
  const graph = orchestrationFlowGraph(model);
  const blockNodes = graph.nodes.filter(
    (node) => node.type === "workflowBlock",
  );

  assert.equal(blockNodes.length, 2);
  assert.ok(
    blockNodes.every(
      (node) => node.parentId === "stage-0-job-0" && node.extent === "parent",
    ),
  );
  assert.ok(
    graph.edges.some(
      (edge) =>
        edge.kind === "workflow-block" &&
        edge.source === "stage-0-job-0-block-0" &&
        edge.sourceHandle === "block-output" &&
        edge.target === "stage-0-job-0-block-1" &&
        edge.targetHandle === "block-input",
    ),
  );
});

test("workflow block nodes display every command and expand without overlap", () => {
  const model = orchestrationModel();
  const workflow = inlineWorkflow(model);
  workflow.blocks[0].steps.push(
    { run: { kind: "command", command: "show inventory" } },
    { run: { kind: "command", command: "show clock" } },
  );
  workflow.blocks.push({
    name: "next-block",
    steps: [{ run: { kind: "command", command: "show interfaces" } }],
  });
  const graph = orchestrationFlowGraph(model);
  const blockNodes = graph.nodes.filter(
    (node): node is OrchestrationWorkflowBlockFlowNode =>
      node.type === "workflowBlock" && node.data.stageIndex === 0,
  );

  assert.deepEqual(blockNodes[0].data.commandRows, [
    "show version",
    "show inventory",
    "show clock",
  ]);
  assert.equal(blockNodes[0].height, 134);
  assert.equal(blockNodes[1].position.y, 282);
  assert.ok(
    blockNodes[1].position.y >=
      blockNodes[0].position.y + blockNodes[0].height + 12,
  );
});

test("orchestration flow selection rejects stale stage and job indexes", () => {
  const model = orchestrationModel();
  const validJobSelection = {
    kind: "job",
    stageIndex: 0,
    jobIndex: 1,
  };
  assert.equal(
    orchestrationNormalizeFlowSelection(model, validJobSelection),
    validJobSelection,
  );
  const validStageSelection = { kind: "stage", stageIndex: 1 };
  assert.equal(
    orchestrationNormalizeFlowSelection(model, validStageSelection),
    validStageSelection,
  );
  assert.deepEqual(
    orchestrationNormalizeFlowSelection(model, {
      kind: "job",
      stageIndex: "0",
      jobIndex: "1",
    }),
    validJobSelection,
  );
  assert.equal(
    orchestrationNormalizeFlowSelection(model, {
      kind: "job",
      stageIndex: 8,
      jobIndex: 0,
    }),
    null,
  );
  assert.equal(
    orchestrationNormalizeFlowSelection(model, {
      kind: "stage",
      stageIndex: -1,
    }),
    null,
  );

  const validBlockSelection = {
    kind: "workflow-block",
    stageIndex: 0,
    jobIndex: 0,
    blockIndex: 0,
  };
  assert.equal(
    orchestrationNormalizeFlowSelection(model, validBlockSelection),
    validBlockSelection,
  );
  assert.equal(
    orchestrationNormalizeFlowSelection(model, {
      ...validBlockSelection,
      blockIndex: 8,
    }),
    null,
  );
});

test("inline workflow block updates stay scoped to the selected job", () => {
  const model = orchestrationModel();
  const nextWorkflow = {
    ...model.stages[0].jobs[0].action.txWorkflow.workflow,
    name: "updated-workflow",
  };
  const updated = orchestrationUpdateInlineWorkflow(model, 0, 0, nextWorkflow);

  assert.equal(
    updated.stages[0].jobs[0].action.txWorkflow.workflow?.name,
    "updated-workflow",
  );
  assert.equal(
    model.stages[0].jobs[0].action.txWorkflow.workflow?.name,
    "backup-workflow",
  );
  assert.deepEqual(
    updated.stages[0].jobs[1].action,
    model.stages[0].jobs[1].action,
  );
});

test("orchestration source loads cannot overwrite newer manual edits", () => {
  const guard = createOrchestrationSourceChangeGuard();
  const staleLoad = guard.begin();
  guard.markEdited();
  assert.equal(staleLoad.isCurrent(), false);

  const currentLoad = guard.begin();
  currentLoad.runOwnedEditorMutation(() => guard.markEdited());
  assert.equal(currentLoad.isCurrent(), true);

  guard.invalidate();
  assert.equal(currentLoad.isCurrent(), false);
});

test("multi-device orchestration executes the current inline canvas snapshot", () => {
  assert.deepEqual(
    orchestrationInlineExecutionPayload({
      connection: { host: "edge-01" },
      dryRun: false,
      planText: '{"name":"campus","stages":[]}',
      planVars: { site: "dc-a" },
      recordLevel: "full",
    }),
    {
      base_dir: null,
      connection: { host: "edge-01" },
      dry_run: false,
      plan: { name: "campus", stages: [] },
      plan_template_content: null,
      plan_template_name: null,
      plan_vars: { site: "dc-a" },
      record_level: "full",
    },
  );
});

test("orchestration execution rejects non-object JSON roots", () => {
  assert.throws(() => orchestrationInlineExecutionPayload({ planText: "[]" }));
});
