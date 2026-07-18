import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  orchestrationDuplicateJob,
  orchestrationDuplicateStage,
  orchestrationInsertStage,
  orchestrationMoveJob,
  orchestrationMoveStage,
  orchestrationReplaceJobStringList,
} from "../src/modules/orchestrationStageMutations.js";
import {
  orchestrationFlowGraph,
  orchestrationNormalizeFlowSelection,
} from "../src/modules/orchestrationFlowCanvasState.js";
import { orchestrationInlineExecutionPayload } from "../src/modules/orchestratedExecutionState.js";
import { createOrchestrationSourceChangeGuard } from "../src/modules/orchestrationEditorState.js";
import { orchestrationUpdateInlineWorkflow } from "../src/modules/orchestrationTxWorkflowActions.js";

function orchestrationModel() {
  return {
    stages: [
      {
        name: "prepare",
        jobs: [
          {
            name: "backup",
            targets: [{ kind: "connection", connection: "edge-01" }],
            action: {
              kind: "tx_workflow",
              txWorkflow: {
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
          },
          { name: "validate", targets: [], action: { kind: "tx_workflow" } },
        ],
      },
      { name: "deploy", jobs: [{ name: "apply", targets: [] }] },
    ],
  };
}

function read(path) {
  return readFileSync(path, "utf8");
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
  duplicated.stages[1].jobs[0].action.txWorkflow.workflow.blocks[0].steps[0].run.command =
    "configure terminal";
  assert.equal(
    duplicated.stages[0].jobs[0].action.txWorkflow.workflow.blocks[0].steps[0]
      .run.command,
    "show version",
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
  duplicated.stages[0].jobs[1].targets[0].connection = "edge-02";
  assert.equal(duplicated.stages[0].jobs[0].targets[0].connection, "edge-01");
  assert.equal(model.stages[0].jobs[0].targets[0].connection, "edge-01");
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
  assert.equal(model.stages[0].jobs[0].targetGroups, undefined);
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
    (node) => node.type === "job" && node.data.stageIndex === 0,
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
  model.stages[0].jobs[0].action.txWorkflow.workflow.blocks.push({
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
  model.stages[0].jobs[0].action.txWorkflow.workflow.blocks[0].steps.push(
    { run: { kind: "command", command: "show inventory" } },
    { run: { kind: "command", command: "show clock" } },
  );
  model.stages[0].jobs[0].action.txWorkflow.workflow.blocks.push({
    name: "next-block",
    steps: [{ run: { kind: "command", command: "show interfaces" } }],
  });
  const graph = orchestrationFlowGraph(model);
  const blockNodes = graph.nodes.filter(
    (node) => node.type === "workflowBlock" && node.data.stageIndex === 0,
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
    updated.stages[0].jobs[0].action.txWorkflow.workflow.name,
    "updated-workflow",
  );
  assert.equal(
    model.stages[0].jobs[0].action.txWorkflow.workflow.name,
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

test("orchestration flow nodes expose hierarchy-aware canvas actions", () => {
  const stageNode = read(
    "frontend/src/pages/orchestrated/OrchestrationFlowStageNode.svelte",
  );
  const jobNode = read(
    "frontend/src/pages/orchestrated/OrchestrationFlowJobNode.svelte",
  );
  const workflowBlockNode = read(
    "frontend/src/pages/orchestrated/OrchestrationFlowWorkflowBlockNode.svelte",
  );
  const stageInsert = read(
    "frontend/src/pages/orchestrated/OrchestrationFlowStageInsertNode.svelte",
  );

  assert.match(stageNode, /ArrowLeftIcon/);
  assert.match(stageNode, /ArrowRightIcon/);
  assert.match(stageNode, /data\.onAddJob/);
  assert.match(stageNode, /data\.sequenceText/);
  assert.match(stageNode, /orchestration-stage-add-job/);
  assert.match(stageNode, /data\.onDuplicate/);
  assert.match(stageNode, /data\.onDelete/);
  assert.match(stageNode, /id="jobs-output"/);
  assert.doesNotMatch(stageNode, /jobsOutputTop/);
  assert.match(stageNode, /top:50%/);
  assert.match(stageNode, /Position\.Right/);
  assert.match(jobNode, /ArrowUpIcon/);
  assert.match(jobNode, /ArrowDownIcon/);
  assert.match(jobNode, /data\.onDuplicate/);
  assert.match(jobNode, /data\.onDelete/);
  assert.match(jobNode, /data\.sourceKind/);
  assert.match(jobNode, /data\.blockCountText/);
  assert.match(jobNode, /data\.emptyWorkflow/);
  assert.match(jobNode, /data\.onAddBlock/);
  assert.match(jobNode, /data\.addBlockLabel/);
  assert.match(jobNode, /data\.targetCount/);
  assert.match(jobNode, /id="serial-in"/);
  assert.match(jobNode, /id="serial-out"/);
  assert.match(jobNode, /id="stage-out"/);
  assert.match(workflowBlockNode, /orchestration-workflow-block-node/);
  assert.match(workflowBlockNode, /id="block-input"/);
  assert.match(workflowBlockNode, /id="block-output"/);
  assert.match(workflowBlockNode, /data\.commandRows/);
  assert.match(workflowBlockNode, /data\.onMovePrevious/);
  assert.match(workflowBlockNode, /data\.onMoveNext/);
  assert.match(workflowBlockNode, /data\.onDuplicate/);
  assert.match(workflowBlockNode, /data\.onDelete/);
  assert.match(stageInsert, /data\.onInsertStage/);
  assert.match(stageInsert, /PlusIcon/);
  assert.doesNotMatch(stageInsert, /hintText|rounded-2xl/);
});

test("orchestration flow inspector reuses stage and job field editors", () => {
  const inspector = read(
    "frontend/src/pages/orchestrated/OrchestrationFlowInspector.svelte",
  );
  assert.match(inspector, /OrchestrationStageSettingsEditor/);
  assert.match(inspector, /OrchestrationJobEditor/);
  assert.match(inspector, /selection\?\.kind === "stage"/);
  assert.match(inspector, /selection\?\.kind === "job"/);
  assert.match(inspector, /onMovePrevious/);
  assert.match(inspector, /onMoveNext/);
  assert.match(inspector, /onDuplicate/);
  assert.match(inspector, /onDelete/);
});

test("multi-device orchestration renders one full Svelte Flow canvas", () => {
  const canvas = read(
    "frontend/src/pages/orchestrated/OrchestrationFlowCanvas.svelte",
  );
  const formEditor = read(
    "frontend/src/pages/orchestrated/OrchestrationPlanFormEditor.svelte",
  );
  const viewportController = read(
    "frontend/src/pages/orchestrated/OrchestrationFlowViewportController.svelte",
  );

  assert.match(canvas, /SvelteFlow/);
  assert.match(canvas, /OrchestrationFlowStageNode/);
  assert.match(canvas, /OrchestrationFlowStageInsertNode/);
  assert.match(canvas, /orchestrationInsertStage/);
  assert.match(canvas, /OrchestrationFlowJobNode/);
  assert.match(canvas, /OrchestrationFlowWorkflowBlockNode/);
  assert.match(canvas, /OrchestrationPlanSettingsEditor/);
  assert.doesNotMatch(canvas, /OrchestrationInventoryPanel|inventoryCollapsed/);
  assert.match(canvas, /OrchestrationFlowInspector/);
  assert.match(canvas, /OrchestrationFlowViewportController/);
  assert.match(canvas, /let planCollapsed = \$state\(true\)/);
  assert.match(canvas, /let inspectorCollapsed = \$state\(true\)/);
  assert.match(canvas, /orchestrationFlowStageCount/);
  assert.match(canvas, /compactStagePositions/);
  assert.match(canvas, /position="top-center"/);
  assert.doesNotMatch(canvas, /stages\.length\s*\?\s*"stage-0"/);
  assert.match(canvas, /function stopPanelPointerEvent\(event\)/);
  assert.match(canvas, /function expandPlanWindow\(event\)/);
  assert.match(canvas, /function collapsePlanWindow\(event\)/);
  assert.match(canvas, /onpointerdown=\{stopPanelPointerEvent\}/);
  assert.match(canvas, /class=.*nopan.*nowheel/);
  assert.doesNotMatch(canvas, /onclick=\{stopPanelEvent\}/);
  assert.match(canvas, /onpaneclick=\{collapseCanvasWindows\}/);
  assert.match(canvas, /lg:h-\[calc\(100dvh-14rem\)\]/);
  assert.match(canvas, /lg:max-h-\[58rem\]/);
  assert.match(canvas, /aria-label=\{t\("orchestrationFlowToolbar"\)\}/);
  assert.doesNotMatch(canvas, /<Panel position="bottom-center"/);
  assert.match(canvas, /class="hidden sm:inline"/);
  assert.match(canvas, /onkeydown=\{resizeInspectorWithKeyboard\}/);
  assert.match(viewportController, /setCenter/);
  assert.match(viewportController, /inspectorOffset/);
  assert.match(viewportController, /topWindowOpen/);
  assert.match(canvas, /openCanvasView\("json"\)/);
  assert.match(canvas, /openCanvasView\("readonly"\)/);
  assert.doesNotMatch(canvas, /ScanSearchIcon|onPreview/);
  assert.match(canvas, /onExecute/);
  assert.doesNotMatch(formEditor, /OrchestrationStagesPanel/);
  assert.match(formEditor, /OrchestrationFlowCanvas/);
});

test("orchestration inspector explains stage, job, target, and action hierarchy", () => {
  const inspector = read(
    "frontend/src/pages/orchestrated/OrchestrationFlowInspector.svelte",
  );
  const stageEditor = read(
    "frontend/src/pages/orchestrated/OrchestrationStageSettingsEditor.svelte",
  );
  const jobEditor = read(
    "frontend/src/pages/orchestrated/OrchestrationJobEditor.svelte",
  );
  const jobActionEditor = read(
    "frontend/src/pages/orchestrated/OrchestrationJobActionEditor.svelte",
  );
  const blockInspector = read(
    "frontend/src/pages/orchestrated/OrchestrationFlowWorkflowBlockInspector.svelte",
  );
  const workflowEditor = read(
    "frontend/src/pages/orchestrated/TxWorkflowVisualEditor.svelte",
  );

  assert.match(inspector, /orchestrationFlowInspectorBreadcrumb/);
  assert.match(inspector, /OrchestrationFlowWorkflowBlockInspector/);
  assert.match(inspector, /selection\?\.kind === "workflow-block"/);
  assert.match(stageEditor, /orchestrationStageSettingsTitle/);
  assert.match(stageEditor, /orchestrationStageSettingsHint/);
  assert.match(jobEditor, /orchestrationJobSettingsTitle/);
  assert.match(jobEditor, /orchestrationJobTargetsTitle/);
  assert.match(jobEditor, /orchestrationJobActionTitle/);
  assert.match(jobActionEditor, /settingsOnly=\{true\}/);
  assert.match(workflowEditor, /\{#if !settingsOnly\}/);
  assert.match(blockInspector, /TxWorkflowBlockEditor/);
  assert.match(blockInspector, /orchestrationFlowTemplateBlockReadonlyHint/);
});

test("orchestration jobs use searchable saved target pickers", () => {
  const targetsEditor = read(
    "frontend/src/pages/orchestrated/OrchestrationJobTargetsEditor.svelte",
  );

  assert.match(targetsEditor, /ConnectionPickerField/);
  assert.match(targetsEditor, /orchestrationTargetGroups/);
  assert.match(targetsEditor, /orchestrationTargetTags/);
  assert.match(targetsEditor, /orchestrationTargets/);
  assert.doesNotMatch(targetsEditor, /StringListEditor/);
});

test("multi-device orchestration executes the current inline canvas snapshot", () => {
  assert.deepEqual(
    orchestrationInlineExecutionPayload({
      connection: { host: "edge-01" },
      dryRun: false,
      planText: '{"name":"campus","stages":[]}',
      planVars: { site: "dc-a" },
      recordLevel: "commands",
    }),
    {
      base_dir: null,
      connection: { host: "edge-01" },
      dry_run: false,
      plan: { name: "campus", stages: [] },
      plan_template_content: null,
      plan_template_name: null,
      plan_vars: { site: "dc-a" },
      record_level: "commands",
    },
  );
});

test("orchestration page removes execution mode tabs and outside result panels", () => {
  const input = read(
    "frontend/src/pages/orchestrated/OrchestrationInputPanel.svelte",
  );
  const surface = read(
    "frontend/src/pages/orchestrated/OrchestrationEditorSurface.svelte",
  );
  const runPanel = read(
    "frontend/src/pages/orchestrated/OrchestrationEditorRunPanel.svelte",
  );
  const stage = read(
    "frontend/src/pages/orchestrated/OrchestrationStage.svelte",
  );

  assert.doesNotMatch(input, /TabList|TxTemplateRunPanel|txTemplateModeTabs/);
  assert.doesNotMatch(input, /onDirectMode|onTemplateMode|templatePanelActive/);
  assert.match(runPanel, /createOrchestrationTemplateWorkspace/);
  assert.match(runPanel, /templateDisplayStateStore/);
  assert.match(runPanel, /browserConfirm/);
  assert.match(surface, /Card\.Root/);
  assert.match(surface, /WorkspaceActionHeader/);
  assert.match(surface, /Card\.Content/);
  assert.match(surface, /openNewDialog/);
  assert.match(surface, /saveTemplate/);
  assert.match(surface, /openSaveAsDialog/);
  assert.doesNotMatch(surface, /deleteTemplate|Trash2Icon/);
  assert.doesNotMatch(runPanel, /\{deleteTemplate\}/);
  assert.match(surface, /templateOptions/);
  assert.match(surface, /Dialog\.Root/);
  assert.match(surface, /OrchestrationPreviewPanel/);
  assert.match(surface, /OrchestrationExecutionPanel/);
  assert.match(surface, /immediateEditorInput/);
  assert.match(surface, /fillEditorHeight=\{editorDialog\.mode === "json"\}/);
  assert.doesNotMatch(surface, /previewDialogOpen|previewCurrentPlan/);
  assert.doesNotMatch(surface, /orchestrationPreviewDialogTitle/);
  assert.doesNotMatch(runPanel, /onPreview|previewDisplay/);
  assert.doesNotMatch(input, /onPreview|previewDisplay/);
  assert.doesNotMatch(stage, /onPreview|previewDisplay/);
  assert.doesNotMatch(stage, /<OrchestrationPreviewPanel/);
  assert.doesNotMatch(stage, /<OrchestrationExecutionPanel/);

  const canvas = read(
    "frontend/src/pages/orchestrated/OrchestrationFlowCanvas.svelte",
  );
  const formEditor = read(
    "frontend/src/pages/orchestrated/OrchestrationPlanFormEditor.svelte",
  );
  for (const source of [canvas, formEditor]) {
    assert.doesNotMatch(
      source,
      /CommandTemplateSourceField|sourceSelection|sourceOptions|sourceLoading|onSourceChange|onCreateDraft|onImportFile/,
    );
  }
});
