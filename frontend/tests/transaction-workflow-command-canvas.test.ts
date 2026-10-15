import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import { flowWorkflowBlockHeight } from "../src/components/fragments/flowWorkflowLayout.js";
import {
  createTransactionWorkflowCanvasWorkspace,
  txWorkflowFindBlock,
  txWorkflowFlowGraph,
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
} from "../src/domains/transactions/index.js";
import type {
  JsonObject,
  TxBlockCommandTarget,
} from "../src/domains/transactions/index.js";

const block = {
  rollback_policy: "per_step",
  steps: [
    {
      run: { kind: "command", command: "configure\ncommit" },
      rollback: { kind: "command", command: "restore" },
      rollback_on_failure: true,
    },
    { run: { kind: "command", command: "verify" } },
  ],
};

function harness(
  source: JsonObject = { blocks: [block] },
  templateContent: JsonObject = block,
) {
  let model = txWorkflowFormModelFromJson(source);
  let selectedId: string | null = null;
  let selectedIndex: number | null = null;
  let selectedOperation: TxBlockCommandTarget = "run";
  let unlocked = true;
  const workspace = createTransactionWorkflowCanvasWorkspace({
    getModel: () => model,
    onChange: (next) => {
      model = next;
      workspace.sync();
    },
    canModify: () => unlocked,
    getSelectedId: () => selectedId,
    getSelectedStepIndex: () => selectedIndex,
    getSelectedOperation: () => selectedOperation,
    onSelect: (id) => {
      selectedId = id;
      selectedIndex = null;
      selectedOperation = "run";
    },
    onSelectStep: (id, index, operation = "run") => {
      selectedId = id;
      selectedIndex = index;
      selectedOperation = operation;
    },
    onSelectWholeRollback: (id) => {
      selectedId = id;
      selectedIndex = null;
      selectedOperation = "whole_resource_rollback";
    },
    templateOptions: {
      listTemplateResource: async () => [{ name: "base" }],
      getTemplateResource: async (_, name) => ({
        name,
        content: JSON.stringify(templateContent),
      }),
    },
  });
  return {
    workspace,
    model: () => model,
    graph: () =>
      txWorkflowFlowGraph(model, {
        blockStates: get(workspace.templates.canvasStateStore),
      }),
    selection: () => ({ id: selectedId, index: selectedIndex }),
    operation: () => selectedOperation,
    lock: () => {
      unlocked = false;
    },
  };
}

test("canvas block and command clicks select distinct inspectors without editing data", () => {
  const h = harness();
  const before = txWorkflowFormModelToJsonText(h.model());
  const node = h.workspace.decorateBlock(h.graph().blocks[0].data);
  node.commandRows[1].onSelect!();
  assert.deepEqual(h.selection(), { id: node.id, index: 1 });
  assert.equal(
    h.workspace.decorateBlock(h.graph().blocks[0].data).commandRows[1].selected,
    true,
  );
  node.onSelect!();
  assert.deepEqual(h.selection(), { id: node.id, index: null });
  assert.equal(txWorkflowFormModelToJsonText(h.model()), before);
  h.workspace.destroy();
});

test("adding commands from a block footer selects an empty command and grows the canvas", () => {
  const h = harness({ blocks: [{ steps: [] }, block] });
  const graph = h.graph();
  const node = h.workspace.decorateBlock(graph.blocks[0].data);
  assert.equal(node.canAddCommand, true);
  node.onAddCommand!();
  const added = txWorkflowFindBlock(h.model(), node.id!)!.block.inlineBlock
    .steps;
  assert.equal(added.length, 1);
  assert.equal(added[0].run.command.command, "");
  assert.deepEqual(h.selection(), { id: node.id, index: 0 });
  node.onAddCommand!();
  assert.deepEqual(h.selection(), { id: node.id, index: 1 });
  assert.ok(h.graph().blocks[1].position.y > graph.blocks[1].position.y);
  h.workspace.destroy();
});

test("canvas move, duplicate and delete actions keep rollback paired with its command", () => {
  const h = harness();
  const id = h.model().blocks[0].editorId;
  const original = structuredClone(h.model().blocks[0].inlineBlock.steps[0]);
  h.workspace.moveCommand(id, 0, 1);
  assert.deepEqual(h.model().blocks[0].inlineBlock.steps[1], original);
  assert.deepEqual(h.selection(), { id, index: 1 });
  h.workspace.duplicateCommand(id, 1);
  assert.deepEqual(h.selection(), { id, index: 2 });
  assert.deepEqual(h.model().blocks[0].inlineBlock.steps[2], original);
  h.model().blocks[0].inlineBlock.steps[2].rollback!.command.command =
    "independent";
  assert.equal(
    h.model().blocks[0].inlineBlock.steps[1].rollback!.command.command,
    "restore",
  );
  h.workspace.removeCommand(id, 2);
  assert.deepEqual(h.selection(), { id, index: 1 });
  h.workspace.removeCommand(id, 1);
  h.workspace.removeCommand(id, 0);
  assert.deepEqual(h.selection(), { id, index: null });
  assert.equal(h.model().blocks[0].inlineBlock.steps.length, 0);
  assert.equal(h.graph().blocks[0].data.canAddCommand, true);
  h.workspace.destroy();
});

test("command canvas actions target full blocks nested inside loops and choices", () => {
  const h = harness({
    blocks: [
      block,
      {
        kind: "loop",
        iterations: "2",
        blocks: [
          {
            kind: "choice",
            branches: [{ condition: "true", blocks: [block] }],
            else: [],
          },
        ],
      },
    ],
  });
  const outer = structuredClone(h.model().blocks[0]);
  const node = h.workspace.decorateBlock(h.graph().blocks[1].data).structure!
    .branches[0].entries[0].structure!.branches[0].entries[0];
  node.onAddCommand!();
  assert.deepEqual(h.selection(), { id: node.id, index: 2 });
  const nested = txWorkflowFindBlock(h.model(), node.id!)!.block;
  assert.equal(nested.inlineBlock.steps.length, 3);
  assert.deepEqual(h.model().blocks[0], outer);
  h.workspace.removeCommand(node.id!, 0);
  assert.equal(
    txWorkflowFindBlock(h.model(), node.id!)!.block.inlineBlock.steps[0].run
      .command.command,
    "verify",
  );
  h.workspace.destroy();
});

test("readonly canvases and invalid command indexes cannot mutate workflow data", () => {
  const h = harness();
  const id = h.model().blocks[0].editorId;
  const before = txWorkflowFormModelToJsonText(h.model());
  h.workspace.removeCommand(id, -1);
  h.workspace.duplicateCommand(id, 20);
  h.workspace.moveCommand(id, 0, -1);
  h.workspace.moveCommand(id, 1, 1);
  assert.equal(txWorkflowFormModelToJsonText(h.model()), before);
  h.lock();
  h.workspace.addCommand(id);
  h.workspace.removeCommand(id, 0);
  h.workspace.duplicateCommand(id, 0);
  h.workspace.moveCommand(id, 0, 1);
  assert.equal(txWorkflowFormModelToJsonText(h.model()), before);
  const node = h.workspace.decorateBlock(h.graph().blocks[0].data);
  assert.equal(node.readonly, true);
  assert.equal(node.commandRows[0].editable, false);
  node.commandRows[0].onSelect!();
  assert.deepEqual(h.selection(), { id, index: 0 });
  h.workspace.destroy();
});

test("template command canvas respects edit locks and cancellation restores the original commands", async () => {
  const h = harness({ blocks: [{ tx_block_template_name: "base" }] });
  const id = h.model().blocks[0].editorId;
  const template = h.workspace.templates.getWorkspace(h.model().blocks[0]);
  const before = txWorkflowFormModelToJsonText(h.model());
  h.workspace.addCommand(id);
  assert.equal(txWorkflowFormModelToJsonText(h.model()), before);
  await template.initialize();
  assert.equal(h.graph().blocks[0].data.commandRows.length, 2);
  assert.equal(h.graph().blocks[0].data.canAddCommand, false);
  h.workspace.removeCommand(id, 0);
  assert.equal(h.graph().blocks[0].data.commandRows.length, 2);
  template.startEditing();
  assert.equal(h.graph().blocks[0].data.canAddCommand, true);
  h.workspace.addCommand(id);
  assert.equal(h.graph().blocks[0].data.commandRows.length, 3);
  assert.equal(get(template.displayStateStore).dirty, true);
  await template.cancelEditing();
  assert.equal(h.graph().blocks[0].data.commandRows.length, 2);
  assert.equal(h.graph().blocks[0].data.canAddCommand, false);
  assert.equal(h.model().blocks[0].templateRef.txBlockTemplateName, "base");
  h.workspace.destroy();
});

test("template canvas subscriptions are removed with blocks and destroyed workspaces", () => {
  const h = harness();
  const id = h.model().blocks[0].editorId;
  const template = h.workspace.templates.getWorkspace(h.model().blocks[0]);
  assert.ok(get(h.workspace.templates.canvasStateStore)[id]);
  h.workspace.removeBlock(id);
  assert.deepEqual(get(h.workspace.templates.canvasStateStore), {});
  template.startEditing();
  assert.deepEqual(get(h.workspace.templates.canvasStateStore), {});
  h.workspace.destroy();
  assert.deepEqual(get(h.workspace.templates.canvasStateStore), {});
});

test("canvas splitting selects the first new command and keeps following commands in order", () => {
  const h = harness();
  const node = h.workspace.decorateBlock(h.graph().blocks[0].data);
  assert.equal(node.commandRows[0].canSplit, true);
  assert.equal(node.commandRows[1].canSplit, false);
  node.commandRows[0].onSplit!();
  assert.deepEqual(h.selection(), { id: node.id, index: 0 });
  assert.deepEqual(
    h.graph().blocks[0].data.commandRows.map((row) => row.summaryText),
    ["configure", "commit", "verify"],
  );
  assert.equal(
    h.graph().blocks[0].data.commandRows[0].rollbackSummaryText,
    "restore",
  );
  assert.equal(h.graph().blocks[0].data.commandRows[1].rollbackSummaryText, "");
  const before = txWorkflowFormModelToJsonText(h.model());
  h.workspace.splitCommand(node.id!, 1);
  assert.equal(txWorkflowFormModelToJsonText(h.model()), before);
  assert.deepEqual(h.selection(), { id: node.id, index: 0 });
  h.workspace.destroy();
});

test("splitting nested commands remains scoped and respects readonly canvases", () => {
  const h = harness({
    blocks: [block, { kind: "loop", iterations: "2", blocks: [block] }],
  });
  const outer = structuredClone(h.model().blocks[0]);
  const nested = h.workspace.decorateBlock(h.graph().blocks[1].data).structure!
    .branches[0].entries[0];
  nested.commandRows[0].onSplit!();
  assert.deepEqual(h.model().blocks[0], outer);
  assert.equal(
    txWorkflowFindBlock(h.model(), nested.id!)!.block.inlineBlock.steps.length,
    3,
  );
  assert.deepEqual(h.selection(), { id: nested.id, index: 0 });
  h.lock();
  h.workspace.splitCommand(outer.editorId, 0);
  assert.deepEqual(h.model().blocks[0], outer);
  h.workspace.destroy();
});

test("splitting template commands requires editing and can be cancelled", async () => {
  const h = harness({ blocks: [{ tx_block_template_name: "base" }] });
  const id = h.model().blocks[0].editorId;
  const template = h.workspace.templates.getWorkspace(h.model().blocks[0]);
  await template.initialize();
  h.workspace.splitCommand(id, 0);
  assert.equal(h.graph().blocks[0].data.commandRows.length, 2);
  template.startEditing();
  h.workspace.splitCommand(id, 0);
  assert.equal(h.graph().blocks[0].data.commandRows.length, 3);
  assert.equal(get(template.displayStateStore).dirty, true);
  await template.cancelEditing();
  assert.equal(h.graph().blocks[0].data.commandRows.length, 2);
  assert.equal(
    h.graph().blocks[0].data.commandRows[0].summaryText,
    "configure\ncommit",
  );
  h.workspace.destroy();
});

test("canvas splits nested run and rollback commands into matching rows", () => {
  const pairedBlock = {
    ...block,
    steps: [
      {
        ...block.steps[0],
        rollback: { kind: "command", command: "restore\nundo commit" },
      },
      block.steps[1],
    ],
  };
  const h = harness({
    blocks: [block, { kind: "loop", iterations: "2", blocks: [pairedBlock] }],
  });
  const outer = structuredClone(h.model().blocks[0]);
  const nested = h.workspace.decorateBlock(h.graph().blocks[1].data).structure!
    .branches[0].entries[0];
  assert.equal(nested.commandRows[0].splitDisabled, false);
  nested.commandRows[0].onSplit!();
  const updated = h.workspace.decorateBlock(h.graph().blocks[1].data).structure!
    .branches[0].entries[0];
  assert.deepEqual(
    updated.commandRows.map((row) => [
      row.summaryText,
      row.rollbackSummaryText,
    ]),
    [
      ["configure", "restore"],
      ["commit", "undo commit"],
      ["verify", ""],
    ],
  );
  assert.deepEqual(h.selection(), { id: nested.id, index: 0 });
  assert.deepEqual(h.model().blocks[0], outer);
  h.workspace.destroy();
});

test("canvas disables splitting excess rollback lines and its callback cannot modify data or selection", () => {
  const h = harness({
    blocks: [
      {
        ...block,
        steps: [
          {
            ...block.steps[0],
            rollback: {
              kind: "command",
              command: "restore\nundo commit\nextra",
            },
          },
          block.steps[1],
        ],
      },
    ],
  });
  const node = h.workspace.decorateBlock(h.graph().blocks[0].data);
  node.commandRows[1].onSelect!();
  const before = txWorkflowFormModelToJsonText(h.model());
  assert.equal(node.commandRows[0].canSplit, true);
  assert.equal(node.commandRows[0].splitDisabled, true);
  assert.ok(node.commandRows[0].splitHint);
  node.commandRows[0].onSplit!();
  assert.equal(txWorkflowFormModelToJsonText(h.model()), before);
  assert.deepEqual(h.selection(), { id: node.id, index: 1 });
  h.workspace.destroy();
});

test("template paired splitting requires edit mode and cancellation restores both multiline commands", async () => {
  const h = harness(
    { blocks: [{ tx_block_template_name: "base" }] },
    {
      ...block,
      steps: [
        {
          ...block.steps[0],
          rollback: { kind: "command", command: "restore\nundo commit" },
        },
        block.steps[1],
      ],
    },
  );
  const id = h.model().blocks[0].editorId;
  const template = h.workspace.templates.getWorkspace(h.model().blocks[0]);
  await template.initialize();
  h.workspace.splitCommand(id, 0);
  assert.equal(h.graph().blocks[0].data.commandRows.length, 2);
  template.startEditing();
  h.workspace.splitCommand(id, 0);
  assert.deepEqual(
    h
      .graph()
      .blocks[0].data.commandRows.map((row) => [
        row.summaryText,
        row.rollbackSummaryText,
      ]),
    [
      ["configure", "restore"],
      ["commit", "undo commit"],
      ["verify", ""],
    ],
  );
  await template.cancelEditing();
  const original = h.graph().blocks[0].data.commandRows;
  assert.equal(original.length, 2);
  assert.equal(original[0].summaryText, "configure\ncommit");
  assert.equal(original[0].rollbackSummaryText, "restore\nundo commit");
  h.workspace.destroy();
});

test("run and empty rollback commands have independent canvas selections without changing data", () => {
  const h = harness();
  const before = txWorkflowFormModelToJsonText(h.model());
  const node = h.workspace.decorateBlock(h.graph().blocks[0].data);
  assert.equal(node.perStepRollbackEnabled, true);
  assert.equal(node.commandRows[1].rollbackSummaryText, "");
  node.commandRows[1].onSelectRollback!();
  assert.deepEqual(h.selection(), { id: node.id, index: 1 });
  assert.equal(h.operation(), "rollback");
  const selected = h.workspace.decorateBlock(h.graph().blocks[0].data);
  assert.equal(selected.commandRows[1].selected, false);
  assert.equal(selected.commandRows[1].rollbackSelected, true);
  selected.commandRows[1].onSelect!();
  assert.equal(h.operation(), "run");
  assert.equal(txWorkflowFormModelToJsonText(h.model()), before);
  h.workspace.destroy();
});

test("enabling a rollback policy reserves canvas space before any rollback command is entered", () => {
  const disabled = harness({ blocks: [{ ...block, rollback_policy: "none" }] });
  const enabled = harness({
    blocks: [
      { ...block, steps: block.steps.map((step) => ({ run: step.run })) },
    ],
  });
  assert.equal(disabled.graph().blocks[0].data.perStepRollbackEnabled, false);
  assert.equal(enabled.graph().blocks[0].data.perStepRollbackEnabled, true);
  assert.ok(enabled.graph().blocks[0].width > disabled.graph().blocks[0].width);
  assert.ok(
    enabled.graph().blocks[0].height > disabled.graph().blocks[0].height,
  );
  assert.ok(
    enabled
      .graph()
      .blocks[0].data.commandRows.every(
        (row) => row.rollbackSummaryText === "",
      ),
  );
  disabled.workspace.destroy();
  enabled.workspace.destroy();
});

test("whole-resource rollback has its own canvas selection even when the command is empty", () => {
  const h = harness({
    blocks: [
      {
        ...block,
        rollback_policy: {
          whole_resource: { rollback: { kind: "command", command: "" } },
        },
      },
    ],
  });
  const before = txWorkflowFormModelToJsonText(h.model());
  const node = h.workspace.decorateBlock(h.graph().blocks[0].data);
  assert.ok(node.wholeResourceRollback);
  node.wholeResourceRollback!.onSelect!();
  assert.deepEqual(h.selection(), { id: node.id, index: null });
  assert.equal(h.operation(), "whole_resource_rollback");
  assert.equal(
    h.workspace.decorateBlock(h.graph().blocks[0].data).wholeResourceRollback
      ?.selected,
    true,
  );
  assert.ok(
    h.workspace
      .decorateBlock(h.graph().blocks[0].data)
      .commandRows.every((row) => !row.selected && !row.rollbackSelected),
  );
  assert.equal(txWorkflowFormModelToJsonText(h.model()), before);
  h.workspace.destroy();
});

test("nested and readonly template rollback selections cannot mutate commands", async () => {
  const h = harness({
    blocks: [
      {
        kind: "loop",
        iterations: "2",
        blocks: [{ tx_block_template_name: "base" }],
      },
    ],
  });
  const node = h.workspace.decorateBlock(h.graph().blocks[0].data).structure!
    .branches[0].entries[0];
  const template = h.workspace.templates.getWorkspace(
    txWorkflowFindBlock(h.model(), node.id!)!.block,
  );
  await template.initialize();
  h.lock();
  const before = txWorkflowFormModelToJsonText(h.model());
  const loaded = h.workspace.decorateBlock(h.graph().blocks[0].data).structure!
    .branches[0].entries[0];
  loaded.commandRows[1].onSelectRollback!();
  assert.equal(h.operation(), "rollback");
  assert.deepEqual(h.selection(), { id: node.id, index: 1 });
  assert.equal(get(template.displayStateStore).readonly, true);
  assert.equal(txWorkflowFormModelToJsonText(h.model()), before);
  assert.equal(get(template.formStateStore).formModel!.steps[1].rollback, null);
  h.workspace.destroy();
});

test("block-local loops and choices add, select and mutate nested commands on the shared canvas", () => {
  const h = harness();
  const id = h.model().blocks[0].editorId;
  const original = structuredClone(h.model().blocks[0].inlineBlock.steps);
  const graph = () => h.workspace.decorateBlock(h.graph().blocks[0].data);
  graph().addCommandControlActions![0].onAdd();
  assert.equal(h.model().blocks[0].inlineBlock.steps[2].control?.kind, "loop");
  assert.deepEqual(h.selection(), { id, index: 2 });
  const loop = () => graph().commandRows[2].controlNode!;
  const body = () => loop().structure!.branches[0].entries[0];
  body().onAddCommand!();
  assert.deepEqual(
    get(h.workspace.commandSelectionStateStore)?.path,
    [2, 0, 0],
  );
  const loopModel = h.model().blocks[0].inlineBlock.steps[2].control;
  assert.ok(loopModel?.kind === "loop");
  assert.equal(loopModel.blocks[0].run.command.command, "");
  body().addCommandControlActions![1].onAdd();
  const choice = () => body().commandRows[1].controlNode!;
  choice().structure!.branches[0].onChangeCondition!("vars.enabled");
  choice().structure!.onAddBranch!();
  choice().structure!.branches[1].onChangeCondition!("vars.fallback");
  const branch = () => choice().structure!.branches[1].entries[0];
  branch().onAddCommand!();
  assert.deepEqual(
    get(h.workspace.commandSelectionStateStore)?.path,
    [2, 0, 1, 1, 0],
  );
  branch().commandRows[0].onSelectRollback!();
  assert.equal(h.operation(), "rollback");
  assert.deepEqual(
    get(h.workspace.commandSelectionStateStore)?.path,
    [2, 0, 1, 1, 0],
  );
  assert.equal(branch().commandRows[0].rollbackSelected, true);
  branch().commandRows[0].onDuplicate!();
  assert.equal(branch().commandRows.length, 2);
  assert.equal(flowWorkflowBlockHeight(graph()), h.graph().blocks[0].height);
  branch().commandRows[1].onMovePrevious!();
  assert.deepEqual(
    get(h.workspace.commandSelectionStateStore)?.path,
    [2, 0, 1, 1, 0],
  );
  branch().commandRows[0].onDelete!();
  branch().commandRows[0].onDelete!();
  assert.deepEqual(
    get(h.workspace.commandSelectionStateStore)?.path,
    [2, 0, 1],
  );
  assert.equal(choice().selected, true);
  assert.deepEqual(h.model().blocks[0].inlineBlock.steps.slice(0, 2), original);
  const json = JSON.parse(txWorkflowFormModelToJsonText(h.model()));
  assert.equal(json.blocks.length, 1);
  assert.equal(
    json.blocks[0].steps[2].steps[1].branches[1].condition,
    "vars.fallback",
  );
  assert.equal(json.blocks[0].steps[2].steps[1].branches[1].steps.length, 0);
  h.workspace.destroy();
});

test("nested control canvas actions respect template locks and cancellation restores nested bodies", async () => {
  const controlledBlock = {
    ...block,
    steps: [{ kind: "loop", iterations: "vars.items", steps: block.steps }],
  };
  const h = harness(
    { blocks: [{ tx_block_template_name: "base" }] },
    controlledBlock,
  );
  const template = h.workspace.templates.getWorkspace(h.model().blocks[0]);
  await template.initialize();
  const graph = () => h.workspace.decorateBlock(h.graph().blocks[0].data);
  const body = () =>
    graph().commandRows[0].controlNode!.structure!.branches[0].entries[0];
  const before = JSON.stringify(
    body().commandRows.map((row) => [row.summaryText, row.rollbackSummaryText]),
  );
  assert.equal(body().canAddCommand, false);
  body().onAddCommand!();
  body().commandRows[0].onDelete!();
  assert.equal(
    JSON.stringify(
      body().commandRows.map((row) => [
        row.summaryText,
        row.rollbackSummaryText,
      ]),
    ),
    before,
  );
  template.startEditing();
  body().commandRows[0].onSplit!();
  assert.equal(body().commandRows.length, 3);
  assert.equal(get(template.displayStateStore).dirty, true);
  await template.cancelEditing();
  assert.equal(
    JSON.stringify(
      body().commandRows.map((row) => [
        row.summaryText,
        row.rollbackSummaryText,
      ]),
    ),
    before,
  );
  assert.equal(body().canAddCommand, false);
  h.workspace.destroy();
});
