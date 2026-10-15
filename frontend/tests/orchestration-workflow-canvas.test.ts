import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import {
  createOrchestrationWorkflowCanvasRegistry,
  orchestrationFlowGraph,
  orchestrationPlanFormModelFromJson,
  orchestrationPlanFormModelToJsonText,
  orchestrationMoveJob,
  orchestrationDuplicateJob,
  orchestrationMoveStage,
  orchestrationRemoveJob,
  orchestrationUpdateInlineWorkflow,
  orchestrationTemplateWorkflowPreview,
  orchestrationNormalizeFlowSelection,
} from "../src/domains/orchestration/index.js";
import {
  txWorkflowFlowGraph,
  txWorkflowFindBlock,
  txWorkflowFormModelFromJson,
} from "../src/domains/transactions/index.js";
import type { TxBlockCommandTarget } from "../src/domains/transactions/index.js";
import type {
  JsonObject,
  OrchestrationPlanFormModel,
  OrchestrationWorkflowPreview,
} from "../src/domains/orchestration/index.js";

const command = {
  name: "configure",
  rollback_policy: "per_step",
  steps: [
    {
      run: { kind: "command", command: "configure\ninterface port\ncommit" },
      rollback: { kind: "command", command: "restore\nverify" },
    },
  ],
};
const workflow: JsonObject = {
  name: "deploy",
  blocks: [
    {
      kind: "loop",
      iterations: "vars.ports",
      blocks: [
        {
          kind: "choice",
          branches: [
            { condition: "vars.enabled", blocks: [command] },
            {
              condition: "vars.preview",
              blocks: [{ tx_block_template_name: "base" }],
            },
          ],
          else: [command],
        },
      ],
    },
    command,
  ],
};
function harness({ delayedPublication = false } = {}) {
  let model = orchestrationPlanFormModelFromJson({
    stages: [
      {
        name: "prepare",
        jobs: [
          { name: "deploy", action: { kind: "tx_workflow", workflow } },
          {
            name: "verify",
            action: { kind: "tx_workflow", workflow: { blocks: [] } },
          },
        ],
      },
      { name: "finish", jobs: [] },
    ],
  });
  let unlocked = true;
  let pendingModel: OrchestrationPlanFormModel | null = null;
  let selected: {
    jobId: string;
    id: string | null;
    stepIndex?: number;
    operation?: TxBlockCommandTarget;
  } | null = null;
  let load = async (name: string) => ({
    name,
    content: JSON.stringify(command),
  });
  const writes: string[] = [];
  const registry = createOrchestrationWorkflowCanvasRegistry({
    getModel: () => model,
    onChange: (next) => {
      if (delayedPublication) pendingModel = next;
      else model = next;
    },
    canModify: () => unlocked,
    getSelectedId: (jobId) => (selected?.jobId === jobId ? selected.id : null),
    onSelect: (jobId, id) => {
      selected = { jobId, id };
    },
    getSelectedStepIndex: (jobId) =>
      selected?.jobId === jobId ? (selected.stepIndex ?? null) : null,
    getSelectedOperation: (jobId) =>
      selected?.jobId === jobId ? (selected.operation ?? "run") : "run",
    onSelectStep: (jobId, id, stepIndex, operation) => {
      selected = { jobId, id, stepIndex, ...(operation ? { operation } : {}) };
    },
    onSelectWholeRollback: (jobId, id) => {
      selected = { jobId, id, operation: "whole_resource_rollback" };
    },
    templateOptions: {
      listTemplateResource: async () => [{ name: "base" }],
      getTemplateResource: (_, name) => load(name),
      updateTemplateResource: async (_, name, content) => {
        writes.push(content);
        return { name, content };
      },
    },
  });
  registry.models({});
  const jobId = model.stages[0].jobs[0].editorId;
  return {
    registry,
    jobId,
    writes,
    model: () => model,
    workspace: () => registry.get(jobId)!,
    sync: () => registry.models({}),
    publish: () => {
      if (pendingModel) model = pendingModel;
      pendingModel = null;
      registry.models({});
    },
    replace: (next: OrchestrationPlanFormModel) => {
      model = next;
      registry.models({});
    },
    lock: () => {
      unlocked = false;
    },
    selected: () => selected,
    loadWith: (next: typeof load) => {
      load = next;
    },
  };
}

test("orchestration reuses complete workflow cards and sizes stages around nested controls and rollback", () => {
  const h = harness();
  const models = h.sync();
  const graph = orchestrationFlowGraph(h.model(), {}, models);
  const standalone = txWorkflowFlowGraph(models[h.jobId]);
  const blocks = graph.nodes.filter((node) => node.type === "workflowBlock");
  assert.equal(blocks.length, standalone.blocks.length);
  blocks.forEach((node, index) => {
    assert.deepEqual(
      node.data.commandRows,
      standalone.blocks[index].data.commandRows,
    );
    assert.deepEqual(
      node.data.structure,
      standalone.blocks[index].data.structure,
    );
    assert.deepEqual(
      node.data.wholeResourceRollback,
      standalone.blocks[index].data.wholeResourceRollback,
    );
    assert.equal(node.height, standalone.blocks[index].height);
    assert.equal(node.width, standalone.blocks[index].width);
  });
  const stage = graph.nodes.find((node) => node.id === "stage-0")!;
  const nextStage = graph.nodes.find((node) => node.id === "stage-1")!;
  const job = graph.nodes.find((node) => node.id === "stage-0-job-0")!;
  assert.equal(job.height, standalone.group.height);
  assert.equal(job.width, standalone.group.width);
  assert.ok(stage.width >= job.width + 40);
  assert.ok(nextStage.position.x >= stage.position.x + stage.width + 132);
  assert.ok(stage.height > job.position.y + job.height);
  h.registry.destroy();
});

test("shared canvas actions edit nested choice branches and retain selection across JSON publication", () => {
  const h = harness();
  const w = h.workspace();
  const graph = txWorkflowFlowGraph(w.model());
  const loop = w.decorateBlock(graph.blocks[0].data);
  const choice = loop.structure!.branches[0].entries[0];
  const branch = choice.structure!.branches[1];
  const childId = branch.entries[0].id!;
  branch.onChangeCondition!("vars.enabled and vars.preview");
  branch.onAddBlock!();
  const addedId = h.selected()!.id!;
  assert.equal(txWorkflowFindBlock(w.model(), addedId)?.blocks.length, 2);
  w.moveBlock(addedId, 0);
  assert.equal(txWorkflowFindBlock(w.model(), addedId)?.blockIndex, 0);
  w.duplicateBlock(addedId);
  assert.equal(txWorkflowFindBlock(w.model(), addedId)?.blocks.length, 3);
  w.removeBlock(addedId);
  assert.equal(txWorkflowFindBlock(w.model(), addedId), null);
  assert.ok(txWorkflowFindBlock(w.model(), childId));
  h.sync();
  assert.equal(w.model().blocks[0].editorId, loop.id);
  const chosen = txWorkflowFindBlock(w.model(), childId)!;
  const normalized = orchestrationNormalizeFlowSelection(
    h.model(),
    {
      kind: "workflow-block",
      stageIndex: 0,
      jobIndex: 0,
      blockIndex: 0,
      editorId: childId,
    },
    {},
    h.sync(),
  );
  assert.equal(normalized?.kind, "workflow-block");
  assert.ok(chosen.parentId);
  const json = orchestrationPlanFormModelToJsonText(h.model());
  assert.ok(!json.includes("editorId"));
  assert.ok(json.includes("vars.enabled and vars.preview"));
  h.registry.destroy();
});

test("canvas edits and selection survive delayed parent publication", () => {
  const h = harness({ delayedPublication: true });
  const workspace = h.workspace();
  const firstId = workspace.model().blocks[0].editorId;
  workspace.addNode("block");
  const addedId = h.selected()!.id!;
  const models = h.sync();
  assert.equal(models[h.jobId].blocks.length, 3);
  assert.equal(models[h.jobId].blocks[0].editorId, firstId);
  assert.ok(txWorkflowFindBlock(models[h.jobId], addedId));
  assert.equal(
    orchestrationNormalizeFlowSelection(
      h.model(),
      {
        kind: "workflow-block",
        stageIndex: 0,
        jobIndex: 0,
        blockIndex: 2,
        editorId: addedId,
      },
      {},
      models,
    )?.kind,
    "workflow-block",
  );
  workspace.addNode("choice");
  const choiceId = h.selected()!.id!;
  h.sync();
  h.publish();
  assert.equal(workspace.model().blocks.length, 4);
  assert.equal(workspace.model().blocks[0].editorId, firstId);
  assert.ok(txWorkflowFindBlock(workspace.model(), addedId));
  assert.equal(
    txWorkflowFindBlock(workspace.model(), choiceId)?.block.control?.kind,
    "choice",
  );
  const savedBlocks =
    h.model().stages[0].jobs[0].action.txWorkflow.workflow!.blocks;
  assert.ok(Array.isArray(savedBlocks));
  assert.equal(savedBlocks.length, 4);
  h.registry.destroy();
});

test("nested template drafts follow moved jobs and duplicated jobs get independent workspaces", async () => {
  const h = harness();
  const w = h.workspace();
  const child = txWorkflowFlowGraph(w.model()).blocks[0].data.structure!
    .branches[0].entries[0].structure!.branches[1].entries[0];
  const block = txWorkflowFindBlock(w.model(), child.id!)!.block;
  const template = w.templates.getWorkspace(block);
  await template.initialize();
  template.startEditing();
  template.changeJson('{"name":"edited","steps":[]}');
  h.replace(orchestrationMoveJob(h.model(), 0, 0, 1));
  h.replace(orchestrationMoveStage(h.model(), 0, 1));
  assert.equal(h.registry.get(h.jobId), w);
  assert.equal(
    w.templates.getWorkspace(txWorkflowFindBlock(w.model(), child.id!)!.block),
    template,
  );
  assert.equal(get(template.displayStateStore).editing, true);
  h.replace(orchestrationDuplicateJob(h.model(), 1, 1));
  const copiedJob = h.model().stages[1].jobs[2];
  assert.notEqual(copiedJob.editorId, h.jobId);
  const copied = h.registry.get(copiedJob.editorId)!;
  assert.notEqual(copied, w);
  assert.equal(txWorkflowFindBlock(copied.model(), child.id!), null);
  assert.equal(await template.saveTemplate(), true);
  assert.equal(JSON.parse(h.writes[0]).name, "edited");
  assert.ok(
    JSON.stringify(
      h.model().stages[1].jobs[1].action.txWorkflow.workflow,
    ).includes('"tx_block_template_name":"base"'),
  );
  assert.ok(
    JSON.stringify(copiedJob.action.txWorkflow.workflow).includes(
      "tx_block_template_content",
    ),
  );
  h.registry.destroy();
});

test("external workflow replacement and job deletion discard pending template loads", async () => {
  for (const remove of [false, true]) {
    const h = harness();
    const w = h.workspace();
    const block = w.model().blocks[1];
    const template = w.templates.getWorkspace(block);
    await template.initialize();
    let resolve!: (value: { name: string; content: string }) => void;
    h.loadWith(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = template.selectTemplate("base");
    await Promise.resolve();
    h.replace(
      remove
        ? orchestrationRemoveJob(h.model(), 0, 0)
        : orchestrationUpdateInlineWorkflow(h.model(), 0, 0, {
            name: "replacement",
            blocks: [],
          }),
    );
    const snapshot = orchestrationPlanFormModelToJsonText(h.model());
    resolve({ name: "base", content: JSON.stringify(command) });
    await pending;
    assert.equal(orchestrationPlanFormModelToJsonText(h.model()), snapshot);
    if (remove) assert.equal(h.registry.get(h.jobId), null);
    else assert.deepEqual(w.model().blocks, []);
    h.registry.destroy();
  }
});

test("plan readonly and template workflow sources block shared canvas mutations", () => {
  const h = harness();
  const w = h.workspace();
  h.lock();
  const before = orchestrationPlanFormModelToJsonText(h.model());
  const block = w.decorateBlock(txWorkflowFlowGraph(w.model()).blocks[0].data);
  assert.equal(block.editable, false);
  assert.equal(block.structure!.branches[0].readonly, true);
  w.addNode("choice");
  block.structure!.branches[0].onAddBlock!();
  assert.equal(orchestrationPlanFormModelToJsonText(h.model()), before);
  h.registry.destroy();

  let plan = orchestrationPlanFormModelFromJson({
    stages: [
      {
        jobs: [
          { action: { kind: "tx_workflow", workflow_template_name: "shared" } },
        ],
      },
    ],
  });
  const registry = createOrchestrationWorkflowCanvasRegistry({
    getModel: () => plan,
    onChange: (next) => {
      plan = next;
    },
    canModify: () => true,
    getSelectedId: () => null,
    onSelect: () => {},
  });
  const jobId = plan.stages[0].jobs[0].editorId;
  const models = registry.models({
    "0:0": orchestrationTemplateWorkflowPreview("shared", workflow),
  });
  assert.equal(models[jobId].blocks[0].control?.kind, "loop");
  const locked = registry.get(jobId)!;
  assert.equal(locked.addActions().readonly, true);
  locked.addNode("block");
  registry.update(jobId, txWorkflowFormModelFromJson({ blocks: [] }));
  assert.equal(
    plan.stages[0].jobs[0].action.txWorkflow.workflowTemplateName,
    "shared",
  );
  assert.equal(locked.model().blocks[0].control?.kind, "loop");
  registry.destroy();
});

test("unresolved template enums cannot crash the canvas or poison a later preview", () => {
  const model = orchestrationPlanFormModelFromJson({
    stages: [
      {
        jobs: [
          { action: { kind: "tx_workflow", workflow_template_name: "draft" } },
        ],
      },
    ],
  });
  const source: JsonObject = {
    name: "draft",
    blocks: [
      {
        name: "configure",
        steps: [
          {
            run: {
              kind: "command",
              command: "echo test",
              multiline_mode: "{{ vars.multiline }}",
            },
          },
        ],
      },
    ],
  };
  const unresolved = orchestrationTemplateWorkflowPreview("draft", source, [
    "$.blocks[0].steps[0].run.multiline_mode",
  ]);
  const resolved = orchestrationTemplateWorkflowPreview("draft", {
    name: "draft",
    blocks: [command],
  });
  const registry = createOrchestrationWorkflowCanvasRegistry({
    getModel: () => model,
    onChange: () => assert.fail("preview must not change the plan"),
    canModify: () => true,
    getSelectedId: () => null,
    onSelect: () => {},
  });
  const jobId = model.stages[0].jobs[0].editorId;
  for (const preview of [
    unresolved,
    unresolved,
    resolved,
    unresolved,
    resolved,
  ]) {
    const previews: Record<string, OrchestrationWorkflowPreview> = {
      "0:0": preview,
    };
    const models = registry.models(previews);
    const graph = orchestrationFlowGraph(model, previews, models);
    // The graph's independent fallback must be safe before the registry effect runs, too.
    assert.doesNotThrow(() => orchestrationFlowGraph(model, previews));
    const job = graph.nodes.find((node) => node.id === "stage-0-job-0")!;
    assert.ok(job.data.kind === "job");
    if (preview === unresolved) {
      assert.equal(job.data.previewStatus, "error");
      assert.match(String(job.data.previewError), /multiline_mode/);
      assert.equal(job.data.unresolvedCount, 1);
      assert.equal(models[jobId].blocks.length, 0);
      assert.deepEqual(preview.workflow, source);
    } else {
      assert.equal(job.data.previewStatus, "ready");
      assert.equal(models[jobId].blocks.length, 1);
      const block = graph.nodes.find((node) => node.type === "workflowBlock")!;
      assert.equal(
        block.data.commandRows[0].summaryText,
        "configure\ninterface port\ncommit",
      );
    }
  }
  registry.destroy();
});

test("orchestration command actions share workflow editing and keep nested command selection", () => {
  const h = harness();
  const workspace = h.workspace();
  const child = txWorkflowFlowGraph(workspace.model()).blocks[0].data.structure!
    .branches[0].entries[0].structure!.branches[0].entries[0];
  const childId = child.id!;
  workspace.addCommand(childId);
  const selection = h.selected()!;
  assert.equal(selection.stepIndex, 1);
  const models = h.sync();
  const normalized = orchestrationNormalizeFlowSelection(
    h.model(),
    {
      kind: "workflow-block",
      stageIndex: 0,
      jobIndex: 0,
      blockIndex: 0,
      editorId: childId,
      stepIndex: selection.stepIndex,
    },
    {},
    models,
    get(h.registry.canvasStateStore),
  );
  assert.equal(
    normalized?.kind === "workflow-block" ? normalized.stepIndex : null,
    1,
  );
  const graph = orchestrationFlowGraph(
    h.model(),
    {},
    models,
    get(h.registry.canvasStateStore),
  );
  const job = graph.nodes.find((node) => node.id === "stage-0-job-0")!;
  assert.equal(
    job.height,
    txWorkflowFlowGraph(workspace.model(), {
      blockStates: get(workspace.templates.canvasStateStore),
    }).group.height,
  );
  workspace.removeCommand(childId, 1);
  assert.equal(h.selected()?.stepIndex, 0);
  const invalid = orchestrationNormalizeFlowSelection(
    h.model(),
    normalized,
    {},
    h.sync(),
    get(h.registry.canvasStateStore),
  );
  assert.equal(
    invalid?.kind === "workflow-block" ? invalid.stepIndex : null,
    undefined,
  );
  h.registry.destroy();
  assert.deepEqual(get(h.registry.canvasStateStore), {});
});

test("orchestration splits nested commands with the shared workflow canvas and persists each line", () => {
  const h = harness();
  const workspace = h.workspace();
  const loop = workspace.decorateBlock(
    txWorkflowFlowGraph(workspace.model()).blocks[0].data,
  );
  const child =
    loop.structure!.branches[0].entries[0].structure!.branches[0].entries[0];
  assert.equal(child.commandRows[0].canSplit, true);
  child.commandRows[0].onSplit!();
  assert.equal(h.selected()?.id, child.id);
  assert.equal(h.selected()?.stepIndex, 0);
  h.sync();
  const split = txWorkflowFindBlock(workspace.model(), child.id!)!.block
    .inlineBlock;
  assert.deepEqual(
    split.steps.map((step) => step.run.command.command),
    ["configure", "interface port", "commit"],
  );
  assert.equal(split.steps[0].rollback?.command.command, "restore");
  assert.equal(split.steps[1].rollback?.command.command, "verify");
  assert.equal(split.steps[2].rollback, null);
  const saved = JSON.parse(orchestrationPlanFormModelToJsonText(h.model()));
  const savedSteps =
    saved.stages[0].jobs[0].action.workflow.blocks[0].blocks[0].branches[0]
      .blocks[0].steps;
  assert.deepEqual(
    savedSteps.map((step: { run: { command: string } }) => step.run.command),
    ["configure", "interface port", "commit"],
  );
  assert.equal(savedSteps[0].rollback.command, "restore");
  assert.equal(savedSteps[1].rollback.command, "verify");
  assert.equal(savedSteps[2].rollback, null);
  assert.equal(workspace.model().blocks[1].inlineBlock.steps.length, 1);
  h.registry.destroy();
});

test("orchestration preserves independent nested rollback selection and normalizes it when rollback is disabled", () => {
  const h = harness();
  const workspace = h.workspace();
  const nested = workspace.decorateBlock(
    txWorkflowFlowGraph(workspace.model()).blocks[0].data,
  ).structure!.branches[0].entries[0].structure!.branches[0].entries[0];
  const before = orchestrationPlanFormModelToJsonText(h.model());
  nested.commandRows[0].onSelectRollback!();
  assert.equal(h.selected()?.operation, "rollback");
  const selection = {
    kind: "workflow-block" as const,
    stageIndex: 0,
    jobIndex: 0,
    blockIndex: 0,
    editorId: nested.id!,
    stepIndex: 0,
    operation: "rollback" as const,
  };
  const normalized = orchestrationNormalizeFlowSelection(
    h.model(),
    selection,
    {},
    h.sync(),
    get(h.registry.canvasStateStore),
  );
  assert.equal(
    normalized?.kind === "workflow-block" ? normalized.operation : null,
    "rollback",
  );
  assert.equal(orchestrationPlanFormModelToJsonText(h.model()), before);
  const next = structuredClone(workspace.model());
  txWorkflowFindBlock(next, nested.id!)!.block.inlineBlock.rollbackPolicy.kind =
    "none";
  h.registry.update(h.jobId, next);
  const disabled = orchestrationNormalizeFlowSelection(
    h.model(),
    selection,
    {},
    h.sync(),
    get(h.registry.canvasStateStore),
  );
  assert.equal(
    disabled?.kind === "workflow-block" ? disabled.operation : null,
    "run",
  );
  h.registry.destroy();
});
