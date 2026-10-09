import assert from "node:assert/strict";
import test from "node:test";
import {
  txWorkflowFlowGraph,
  txWorkflowInspectorWidth,
  txWorkflowFormModelFromJson,
  TX_WORKFLOW_CANVAS_DESKTOP_ZOOM,
  TX_WORKFLOW_GROUP_ID,
} from "../src/domains/transactions/index.js";
import {
  flowWorkflowBlockHeight,
  flowWorkflowGroupLayout,
} from "../src/components/fragments/flowWorkflowLayout.js";

test("inspector width keeps the focused workflow visible across desktop sizes", () => {
  const graph = txWorkflowFlowGraph(txWorkflowFormModelFromJson());
  const workflowWidth = graph.group.width * TX_WORKFLOW_CANVAS_DESKTOP_ZOOM;
  for (const canvasWidth of [784, 1040, 1200, 1360]) {
    for (const preferredWidth of [380, 860, 1040]) {
      const inspectorWidth = txWorkflowInspectorWidth(
        canvasWidth,
        preferredWidth,
        graph.group.width,
      );
      assert.ok(inspectorWidth >= 380);
      assert.ok(inspectorWidth <= preferredWidth);
      assert.ok(canvasWidth - inspectorWidth >= workflowWidth + 48);
    }
  }
  assert.equal(txWorkflowInspectorWidth(1360, 860, graph.group.width), 860);
});

test("empty workflow has a container and room for adding its first block", () => {
  const graph = txWorkflowFlowGraph(txWorkflowFormModelFromJson());
  assert.equal(graph.group.id, TX_WORKFLOW_GROUP_ID);
  assert.equal(graph.group.data.emptyWorkflow, true);
  assert.equal(graph.group.data.canAddBlock, true);
  assert.equal(
    graph.group.height,
    flowWorkflowGroupLayout([], { width: 380 }).height,
  );
  assert.deepEqual(graph.blocks, []);
  assert.deepEqual(graph.edges, []);
});

test("workflow blocks nest vertically and connect in execution order", () => {
  const graph = txWorkflowFlowGraph(
    txWorkflowFormModelFromJson({
      name: "deploy",
      blocks: ["backup", "configure", "verify"].map((name) => ({
        name,
        steps: [{ run: { kind: "command", command: name } }],
      })),
    }),
  );
  assert.equal(graph.group.data.title, "deploy");
  assert.deepEqual(
    graph.blocks.map((block) => block.data.title),
    ["backup", "configure", "verify"],
  );
  assert.ok(
    graph.blocks.every(
      (block) => block.parentId === graph.group.id && block.extent === "parent",
    ),
  );
  for (const [index, block] of graph.blocks.entries()) {
    assert.equal(block.position.x, graph.blocks[0].position.x);
    assert.ok(block.position.x + block.width < graph.group.width);
    assert.ok(block.position.y + block.height < graph.group.height - 44);
    if (index > 0)
      assert.ok(
        block.position.y >=
          graph.blocks[index - 1].position.y +
            graph.blocks[index - 1].height +
            12,
      );
  }
  assert.deepEqual(
    graph.edges.map((edge) => [
      edge.source,
      edge.sourceHandle,
      edge.target,
      edge.targetHandle,
    ]),
    [
      ["workflow-block-0", "block-output", "workflow-block-1", "block-input"],
      ["workflow-block-1", "block-output", "workflow-block-2", "block-input"],
    ],
  );
  assert.equal(graph.blocks[0].data.hasTarget, false);
  assert.equal(graph.blocks.at(-1)?.data.hasSource, false);
});

test("all commands and rollback rows expand the shared container without overlap", () => {
  const model = txWorkflowFormModelFromJson({
    blocks: [
      {
        name: "configure",
        rollback_policy: "per_step",
        steps: Array.from({ length: 7 }, (_, index) => ({
          run: { kind: "command", command: `set ${index}` },
          rollback: { kind: "command", command: `undo ${index}` },
        })),
      },
      { name: "verify", steps: [] },
    ],
  });
  const source = structuredClone(model);
  const graph = txWorkflowFlowGraph(model);
  const first = graph.blocks[0];
  assert.equal(first.data.commandRows.length, 7);
  assert.equal(first.data.commandRows[6].rollbackSummaryText, "undo 6");
  assert.equal(first.height, flowWorkflowBlockHeight(first.data));
  assert.ok(graph.blocks[1].position.y >= first.position.y + first.height + 12);
  assert.deepEqual(model, source);

  model.blocks[0].inlineBlock.steps = [];
  const cleared = txWorkflowFlowGraph(model);
  assert.ok(cleared.group.height < graph.group.height);
  assert.ok(cleared.blocks[1].position.y < graph.blocks[1].position.y);
});

test("whole-resource rollback reserves space separately from step commands", () => {
  const model = txWorkflowFormModelFromJson({
    blocks: [
      {
        name: "replace",
        steps: [{ run: { kind: "command", command: "replace config" } }],
        rollback_policy: {
          whole_resource: {
            rollback: { kind: "command", command: "restore checkpoint" },
          },
        },
      },
    ],
  });
  const graph = txWorkflowFlowGraph(model);
  assert.equal(
    graph.blocks[0].data.wholeResourceRollback?.summaryText,
    "restore checkpoint",
  );
  const originalHeight = graph.group.height;
  model.blocks[0].inlineBlock.rollbackPolicy.kind = "none";
  const disabled = txWorkflowFlowGraph(model);
  assert.equal(disabled.blocks[0].data.wholeResourceRollback, null);
  assert.ok(disabled.group.height < originalHeight);
});

test("shared layout leaves footer space and handles template containers", () => {
  const editable = flowWorkflowGroupLayout([82, 138]);
  const template = flowWorkflowGroupLayout([82, 138], { canAddBlock: false });
  assert.equal(editable.height - template.height, 44);
  assert.deepEqual(editable.blocks, template.blocks);
  assert.equal(
    template.blocks[1].position.y,
    template.blocks[0].position.y + 82 + 12,
  );
  assert.ok(
    template.height > template.blocks[1].position.y + template.blocks[1].height,
  );
});
