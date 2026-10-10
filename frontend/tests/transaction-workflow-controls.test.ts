import assert from "node:assert/strict";
import test from "node:test";
import { t } from "../src/lib/i18n.js";
import {
  txWorkflowAddBlock,
  txWorkflowDuplicateBlock,
  txWorkflowFlowGraph,
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
  txWorkflowVisualEditorBindings,
  txWorkflowFindBlock,
  txWorkflowBranchModel,
  txWorkflowReplaceBranch,
  txWorkflowAddChoiceBranch,
  txWorkflowMoveChoiceBranch,
  txWorkflowRemoveChoiceBranch,
  txWorkflowChangeChoiceBranch,
  txWorkflowReplaceBlock,
} from "../src/domains/transactions/index.js";
import type {
  TxWorkflowFormModel,
  TxWorkflowBranch,
} from "../src/domains/transactions/index.js";
import {
  flowWorkflowBlockHeight,
  flowWorkflowBlockWidth,
} from "../src/components/fragments/flowWorkflowLayout.js";

const source = {
  name: "configure-ports",
  fail_fast: true,
  blocks: [
    {
      kind: "loop",
      iterations: "vars.ports",
      item_variable: "port",
      blocks: [
        {
          kind: "choice",
          name: "Enabled ports",
          branches: [
            {
              condition: "port.enabled",
              blocks: [
                {
                  tx_block_template_name: "configure",
                  tx_block_template_vars: { name: "{{ port.name }}" },
                },
              ],
            },
          ],
          else: [
            {
              name: "skip",
              rollback_policy: "none",
              fail_fast: true,
              steps: [],
            },
          ],
        },
      ],
    },
  ],
};

test("nested workflow controls survive JSON form round trips with template references", () => {
  const model = txWorkflowFormModelFromJson(source);
  assert.equal(model.blocks[0].control?.kind, "loop");
  assert.deepEqual(JSON.parse(txWorkflowFormModelToJsonText(model)), source);
});

test("legacy binary choices import as a single ordered condition with a default branch", () => {
  const model = txWorkflowFormModelFromJson({
    blocks: [
      {
        kind: "choice",
        condition: "vars.enabled",
        then: [{ tx_block_template_name: "configure" }],
        else: [],
      },
    ],
  });
  assert.deepEqual(JSON.parse(txWorkflowFormModelToJsonText(model)).blocks[0], {
    kind: "choice",
    name: "",
    branches: [
      {
        condition: "vars.enabled",
        blocks: [{ tx_block_template_name: "configure" }],
      },
    ],
    else: [],
  });
});

test("multi-condition choice cards show full operations in every branch and reserve their complete height", () => {
  const commands = [
    {
      name: "Configure",
      rollback_policy: "per_step",
      steps: [
        {
          run: {
            kind: "command",
            command: "configure\ninterface port\ncommit",
          },
          rollback: { kind: "command", command: "restore\nverify" },
        },
      ],
    },
  ];
  const choice = {
    kind: "choice",
    name: "",
    branches: [
      { condition: "vars.role == 'edge'", blocks: commands },
      {
        condition: "vars.role == 'core'",
        blocks: [{ kind: "loop", iterations: "2", blocks: commands }],
      },
    ],
    else: commands,
  };
  const model = txWorkflowFormModelFromJson({
    blocks: [choice, { name: "Finish" }],
  });
  const graph = txWorkflowFlowGraph(model);
  const branches = graph.blocks[0].data.structure!.branches;
  assert.equal(branches.length, 3);
  assert.equal(branches[0].conditionText, choice.branches[0].condition);
  assert.equal(branches[1].conditionText, choice.branches[1].condition);
  assert.equal(branches[2].conditionText, undefined);
  assert.equal(branches[2].title, t("txWorkflowChoiceElse"));
  assert.ok(branches.every((branch) => branch.canAddBlock));
  assert.equal(graph.blocks[0].data.structure!.canAddBranch, true);
  const ordinary = txWorkflowFlowGraph(
    txWorkflowFormModelFromJson({ blocks: commands }),
  ).blocks[0];
  assert.deepEqual(
    branches[0].entries[0].commandRows,
    ordinary.data.commandRows,
  );
  assert.deepEqual(
    branches[2].entries[0].commandRows,
    ordinary.data.commandRows,
  );
  assert.equal(branches[1].entries[0].structure?.kind, "loop");
  assert.ok(
    graph.blocks[0].height >
      branches.reduce(
        (sum, branch) => sum + flowWorkflowBlockHeight(branch.entries[0]),
        0,
      ),
  );
  assert.ok(
    graph.blocks[0].width >=
      flowWorkflowBlockWidth(branches[1].entries[0]) + 44,
  );
  assert.ok(
    graph.blocks[1].position.y >=
      graph.blocks[0].position.y + graph.blocks[0].height + 12,
  );
  const serialized = JSON.parse(txWorkflowFormModelToJsonText(model));
  assert.deepEqual(
    serialized.blocks[0].branches.map(
      (branch: { condition: string }) => branch.condition,
    ),
    choice.branches.map((branch) => branch.condition),
  );
  assert.equal(
    serialized.blocks[0].branches[0].blocks[0].steps[0].run.command,
    commands[0].steps[0].run.command,
  );
  assert.deepEqual(
    JSON.parse(
      txWorkflowFormModelToJsonText(txWorkflowFormModelFromJson(serialized)),
    ),
    serialized,
  );
  assert.ok(!JSON.stringify(serialized).includes("editorId"));
});

test("condition branch reordering preserves nested selection and stale branch writes cannot replace siblings", () => {
  let model = txWorkflowFormModelFromJson({
    blocks: [
      {
        kind: "choice",
        branches: [
          { condition: "vars.enabled", blocks: [{ name: "first" }] },
          { condition: "vars.fallback", blocks: [{ name: "second" }] },
        ],
        else: [{ name: "default" }],
      },
    ],
  });
  const original = structuredClone(model);
  const choiceBlock = model.blocks[0];
  let choice = choiceBlock.control!;
  if (choice.kind !== "choice") throw new Error("missing choice");
  const branchId = choice.branches[0].editorId;
  const childId = choice.branches[0].blocks[0].editorId;
  const scope = { choiceBranchId: branchId };
  const changed = txWorkflowChangeChoiceBranch(choice, branchId, {
    condition: "vars.new_enabled",
  });
  assert.equal(changed.branches[0].condition, "vars.new_enabled");
  assert.equal(changed.branches[1], choice.branches[1]);
  assert.equal(txWorkflowMoveChoiceBranch(choice, branchId, -1), choice);
  choice = txWorkflowMoveChoiceBranch(changed, branchId, 1);
  model = txWorkflowReplaceBlock(model, choiceBlock.editorId, {
    ...choiceBlock,
    control: choice,
  });
  assert.deepEqual(txWorkflowFindBlock(model, childId)?.branch, scope);
  assert.equal(
    txWorkflowBranchModel(model, choiceBlock.editorId, scope)?.blocks[0]
      .editorId,
    childId,
  );
  const added = txWorkflowAddChoiceBranch(choice);
  assert.equal(added.branches.length, 3);
  assert.ok(added.branches[2].editorId);
  assert.equal(added.branches[2].condition, "");
  assert.deepEqual(added.branches[2].blocks, []);
  choice = txWorkflowRemoveChoiceBranch(added, branchId);
  model = txWorkflowReplaceBlock(model, choiceBlock.editorId, {
    ...choiceBlock,
    control: choice,
  });
  assert.equal(txWorkflowFindBlock(model, childId), null);
  assert.equal(txWorkflowBranchModel(model, choiceBlock.editorId, scope), null);
  assert.equal(
    txWorkflowReplaceBranch(model, choiceBlock.editorId, scope, original),
    model,
  );
  assert.equal(
    txWorkflowChangeChoiceBranch(choice, branchId, { condition: "true" }),
    choice,
  );
  assert.deepEqual(
    model.blocks[0].control?.otherwise,
    original.blocks[0].control?.otherwise,
  );
  const last = txWorkflowRemoveChoiceBranch(
    choice,
    choice.branches[1].editorId,
  );
  assert.equal(
    txWorkflowRemoveChoiceBranch(last, last.branches[0].editorId),
    last,
  );
  const originalChoice = original.blocks[0].control!;
  if (originalChoice.kind !== "choice")
    throw new Error("missing original choice");
  assert.deepEqual(
    originalChoice.branches.map((branch) => branch.condition),
    ["vars.enabled", "vars.fallback"],
  );
});

test("add and duplicate controls keep independent nested editor identities and drafts", () => {
  const model = txWorkflowFormModelFromJson(source);
  const duplicate = txWorkflowDuplicateBlock(model, 0) as TxWorkflowFormModel;
  assert.notEqual(duplicate.blocks[0].editorId, duplicate.blocks[1].editorId);
  const a = duplicate.blocks[0].control!;
  const b = duplicate.blocks[1].control!;
  assert.equal(a.kind, "loop");
  assert.equal(b.kind, "loop");
  if (a.kind !== "loop" || b.kind !== "loop") throw new Error("missing loop");
  assert.notEqual(a.blocks[0].editorId, b.blocks[0].editorId);
  const choiceA = a.blocks[0].control!;
  const choiceB = b.blocks[0].control!;
  if (choiceA.kind !== "choice" || choiceB.kind !== "choice")
    throw new Error("missing choice");
  assert.notEqual(choiceA.branches[0].editorId, choiceB.branches[0].editorId);
  assert.notEqual(
    choiceA.branches[0].blocks[0].editorId,
    choiceB.branches[0].blocks[0].editorId,
  );
  assert.notEqual(choiceA.otherwise[0].editorId, choiceB.otherwise[0].editorId);
  b.iterations = "4";
  assert.equal(a.iterations, "vars.ports");
  assert.equal(model.blocks.length, 1);
  const added = txWorkflowAddBlock(model, "choice") as TxWorkflowFormModel;
  assert.equal(added.blocks[1].control?.kind, "choice");
});

test("control bindings update the selected node without changing siblings or child drafts", () => {
  const model = txWorkflowFormModelFromJson(source);
  let changed: TxWorkflowFormModel | undefined;
  const bindings = txWorkflowVisualEditorBindings(model, (next) => {
    changed = next;
  });
  const control = model.blocks[0].control!;
  if (control.kind !== "loop") throw new Error("missing loop");
  bindings.blockBindings(0).updateControl({ ...control, iterations: "4" });
  assert.equal(changed?.blocks[0].control?.iterations, "4");
  assert.equal(model.blocks[0].control?.iterations, "vars.ports");
  assert.deepEqual(
    changed?.blocks[0].control?.kind,
    model.blocks[0].control?.kind,
  );
});

test("canvas shows loop bodies and both choice branches and grows without overlap", () => {
  const model = txWorkflowFormModelFromJson({
    ...source,
    blocks: [
      ...source.blocks,
      {
        kind: "choice",
        name: "Environment",
        condition: "vars.production",
        then: [{ name: "Deploy" }],
        else: [{ name: "Preview" }, { name: "Verify" }],
      },
    ],
  });
  const graph = txWorkflowFlowGraph(model);
  assert.equal(graph.blocks[0].data.structure?.kind, "loop");
  assert.deepEqual(
    graph.blocks[0].data.structure?.branches[0].entries.map(
      (entry) => entry.title,
    ),
    ["Enabled ports"],
  );
  assert.deepEqual(
    graph.blocks[1].data.structure?.branches.map((branch) =>
      branch.entries.map((entry) => entry.title),
    ),
    [
      [t("txWorkflowFormBlock")],
      [t("txWorkflowFormBlock"), t("txWorkflowFormBlock")],
    ],
  );
  assert.ok(graph.group.width >= 600);
  assert.ok(
    graph.blocks[1].position.y >
      graph.blocks[0].position.y + graph.blocks[0].height,
  );
  const before = graph.group.height;
  const choice = model.blocks[1].control!;
  if (choice.kind !== "choice") throw new Error("missing choice");
  choice.branches[0].blocks.push(
    ...Array.from({ length: 8 }, () => choice.branches[0].blocks[0]),
  );
  const expanded = txWorkflowFlowGraph(model);
  assert.ok(expanded.group.height > before);
  assert.ok(
    expanded.blocks[1].position.y + expanded.blocks[1].height <
      expanded.group.height - 44,
  );
});

test("loop body cards carry the same full command and rollback display as ordinary blocks", () => {
  const blocks = [
    {
      name: "Configure",
      rollback_policy: "per_step",
      steps: [
        {
          run: {
            kind: "command",
            command: "configure\n  interface {{ port }}\n\ncommit",
          },
          rollback: { kind: "command", command: "restore\nverify" },
        },
        { run: { kind: "command", command: "show interfaces" } },
      ],
    },
    {
      name: "Replace",
      steps: [{ run: { kind: "command", command: "replace\ncommit" } }],
      rollback_policy: {
        whole_resource: {
          rollback: {
            kind: "command",
            command: "restore checkpoint\nverify checkpoint",
          },
        },
      },
    },
    { tx_block_template_name: "inspect-port" },
  ];
  const model = txWorkflowFormModelFromJson({
    blocks: [
      { kind: "loop", iterations: "vars.ports", item_variable: "port", blocks },
    ],
  });
  const original = structuredClone(model);
  const graph = txWorkflowFlowGraph(model);
  const loop = graph.blocks[0];
  const children = loop.data.structure!.branches[0].entries;
  const ordinary = txWorkflowFlowGraph(txWorkflowFormModelFromJson({ blocks }));

  assert.equal(children.length, ordinary.blocks.length);
  children.forEach((child, index) => {
    const {
      kind,
      blockIndex,
      id: ordinaryId,
      ...expected
    } = ordinary.blocks[index].data;
    const { id: childId, ...childDisplay } = child;
    assert.deepEqual(childDisplay, {
      ...expected,
      hasSource: false,
      hasTarget: false,
    });
    assert.equal(flowWorkflowBlockHeight(child), ordinary.blocks[index].height);
    assert.equal(child.editable, undefined);
    assert.ok(loop.width >= ordinary.blocks[index].width + 44);
  });
  assert.ok(
    loop.height > ordinary.blocks.reduce((sum, block) => sum + block.height, 0),
  );
  assert.deepEqual(model, original);
});

test("loops are unnamed in the canvas and generated workflow JSON", () => {
  const model = txWorkflowFormModelFromJson({
    blocks: [{ kind: "loop", name: "Old label", iterations: "3", blocks: [] }],
  });
  const graph = txWorkflowFlowGraph(model);
  assert.notEqual(graph.blocks[0].data.title, "Old label");
  const loop = JSON.parse(txWorkflowFormModelToJsonText(model)).blocks[0];
  assert.equal(Object.hasOwn(loop, "name"), false);
  assert.equal(loop.iterations, "3");
  assert.equal(graph.blocks[0].data.structure?.branches[0].canAddBlock, true);
});

test("nested canvas operations reuse workflow bindings and remain scoped to the selected branch", () => {
  let model = txWorkflowFormModelFromJson({
    ...source,
    blocks: [...source.blocks, { name: "untouched", steps: [] }],
  });
  const original = structuredClone(model);
  const initialModel = model;
  const untouchedSibling = model.blocks[1];
  const parent = model.blocks[0].control!;
  if (parent.kind !== "loop") throw new Error("missing loop");
  const loopId = model.blocks[0].editorId;
  const choiceId = parent.blocks[0].editorId;
  const choice = parent.blocks[0].control!;
  if (choice.kind !== "choice") throw new Error("missing choice");
  const untouchedElse = choice.otherwise;
  function bindings(parentId: string, branch: TxWorkflowBranch) {
    const scope = txWorkflowBranchModel(model, parentId, branch);
    assert.ok(scope);
    return txWorkflowVisualEditorBindings(scope, (next) => {
      model = txWorkflowReplaceBranch(model, parentId, branch, next);
    });
  }
  bindings(loopId, "blocks").appendBlock();
  const added = txWorkflowBranchModel(model, loopId, "blocks")!.blocks[1];
  assert.equal(added.inlineBlock.steps[0].run.command.command, "");
  bindings(loopId, "blocks").moveBlock(1, 0);
  assert.equal(txWorkflowFindBlock(model, added.editorId)?.blockIndex, 0);
  bindings(loopId, "blocks").duplicateBlock(0);
  const copy = txWorkflowBranchModel(model, loopId, "blocks")!.blocks[1];
  assert.notEqual(copy.editorId, added.editorId);
  bindings(loopId, "blocks").removeBlock(0);
  assert.equal(txWorkflowFindBlock(model, added.editorId), null);
  assert.equal(txWorkflowFindBlock(model, copy.editorId)?.blockIndex, 0);
  const selectedBranch = { choiceBranchId: choice.branches[0].editorId };
  bindings(choiceId, selectedBranch).appendBlock("loop");
  assert.equal(
    txWorkflowBranchModel(model, choiceId, selectedBranch)?.blocks.length,
    2,
  );
  assert.deepEqual(
    txWorkflowBranchModel(model, choiceId, "otherwise")?.blocks,
    untouchedElse,
  );
  assert.equal(model.blocks[1], untouchedSibling);
  assert.deepEqual(model.blocks[1], original.blocks[1]);
  assert.deepEqual(initialModel, original);
});

test("missing or mismatched canvas branches cannot overwrite another control or the workflow root", () => {
  const model = txWorkflowFormModelFromJson(source);
  const loopId = model.blocks[0].editorId;
  const next = txWorkflowFormModelFromJson({ blocks: [] });
  assert.equal(txWorkflowBranchModel(model, "deleted", "blocks"), null);
  const missingBranch = { choiceBranchId: "deleted" };
  assert.equal(txWorkflowBranchModel(model, loopId, missingBranch), null);
  assert.equal(
    txWorkflowReplaceBranch(model, "deleted", "blocks", next),
    model,
  );
  assert.equal(
    txWorkflowReplaceBranch(model, loopId, missingBranch, next),
    model,
  );
  assert.equal(
    txWorkflowReplaceBranch(model, null, missingBranch, next),
    model,
  );
});

test("nested loop dimensions grow with multiline content and preserve following block spacing", () => {
  const model = txWorkflowFormModelFromJson({
    blocks: [
      {
        kind: "loop",
        iterations: "vars.racks",
        item_variable: "rack",
        blocks: [
          {
            kind: "loop",
            iterations: "rack.ports",
            item_variable: "port",
            blocks: [
              {
                name: "Configure",
                rollback_policy: "per_step",
                steps: [
                  {
                    run: { kind: "command", command: "configure" },
                    rollback: { kind: "command", command: "restore" },
                  },
                ],
              },
            ],
          },
          { name: "Verify", steps: [] },
        ],
      },
      { name: "Finish", steps: [] },
    ],
  });
  const singleLine = txWorkflowFlowGraph(model);
  const outer = model.blocks[0].control!;
  if (outer.kind !== "loop") throw new Error("missing loop");
  const inner = outer.blocks[0].control!;
  if (inner.kind !== "loop") throw new Error("missing nested loop");
  inner.blocks[0].inlineBlock.steps[0].run.command.command =
    "configure\n\ncommit";
  const expanded = txWorkflowFlowGraph(model);
  const loop = expanded.blocks[0];
  const innerLoop = loop.data.structure!.branches[0].entries[0];
  const child = innerLoop.structure!.branches[0].entries[0];

  assert.equal(loop.height - singleLine.blocks[0].height, 32);
  assert.equal(expanded.group.height - singleLine.group.height, 32);
  assert.equal(
    expanded.blocks[1].position.y - singleLine.blocks[1].position.y,
    32,
  );
  assert.equal(
    flowWorkflowBlockWidth(innerLoop),
    flowWorkflowBlockWidth(child) + 44,
  );
  assert.equal(loop.width, flowWorkflowBlockWidth(innerLoop) + 44);
  assert.ok(
    expanded.blocks[1].position.y >= loop.position.y + loop.height + 12,
  );
  assert.ok(
    expanded.blocks[1].position.y + expanded.blocks[1].height <
      expanded.group.height - 44,
  );

  inner.blocks = [];
  const emptied = txWorkflowFlowGraph(model);
  assert.ok(emptied.group.height < expanded.group.height);
  assert.ok(emptied.group.width < expanded.group.width);
});
