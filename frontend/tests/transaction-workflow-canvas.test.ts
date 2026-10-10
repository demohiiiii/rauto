import assert from "node:assert/strict";
import test from "node:test";
import { t } from "../src/lib/i18n.js";
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
    Array(3).fill(t("txWorkflowFormBlock")),
  );
  assert.deepEqual(
    graph.blocks.map((block) => block.data.sequenceText),
    ["1", "2", "3"],
  );
  assert.deepEqual(
    graph.blocks.map((block) => block.data.commandRows[0].summaryText),
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
  assert.ok(cleared.group.width < graph.group.width);
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
  assert.ok(disabled.group.width < graph.group.width);
});

test("multiline run and rollback commands keep blank lines and expand nested blocks", () => {
  const model = txWorkflowFormModelFromJson({
    blocks: [
      {
        name: "write-config",
        rollback_policy: "per_step",
        steps: [
          {
            run: { kind: "command", command: "write config" },
            rollback: { kind: "command", command: "restore config" },
          },
        ],
      },
      { name: "verify", steps: [] },
    ],
  });
  const singleLine = txWorkflowFlowGraph(model);
  const run = "cat <<'EOF'\n  first\n\n  last\nEOF";
  const rollback = "restore checkpoint\r\nverify checkpoint\rcleanup";
  model.blocks[0].inlineBlock.steps[0].run.command.command = run;
  model.blocks[0].inlineBlock.steps[0].rollback!.command.command = rollback;
  const multiline = txWorkflowFlowGraph(model);

  assert.equal(multiline.blocks[0].data.commandRows[0].summaryText, run);
  assert.equal(
    multiline.blocks[0].data.commandRows[0].rollbackSummaryText,
    rollback,
  );
  assert.equal(multiline.blocks[0].height - singleLine.blocks[0].height, 64);
  assert.equal(multiline.group.height - singleLine.group.height, 64);
  assert.equal(
    multiline.blocks[1].position.y - singleLine.blocks[1].position.y,
    64,
  );
  assert.ok(
    multiline.blocks[1].position.y >=
      multiline.blocks[0].position.y + multiline.blocks[0].height + 12,
  );

  model.blocks[0].inlineBlock.steps[0].rollback!.command.command =
    "restore\nverify\ncleanup\nrestart\ncheck\ncommit\nfinish";
  const longerRollback = txWorkflowFlowGraph(model);
  assert.equal(
    longerRollback.blocks[0].height - singleLine.blocks[0].height,
    96,
  );
  assert.equal(longerRollback.group.height - singleLine.group.height, 96);
  assert.equal(
    longerRollback.blocks[1].position.y - singleLine.blocks[1].position.y,
    96,
  );

  model.blocks[0].inlineBlock.steps[0].run.command.command = "write config";
  model.blocks[0].inlineBlock.steps[0].rollback!.command.command =
    "restore config";
  assert.deepEqual(txWorkflowFlowGraph(model), singleLine);
});

test("multiline whole-resource rollback keeps following blocks inside the workflow", () => {
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
      { name: "verify", steps: [] },
    ],
  });
  const singleLine = txWorkflowFlowGraph(model);
  const rollback = "restore checkpoint\n\nverify checkpoint";
  model.blocks[0].inlineBlock.rollbackPolicy.wholeResource!.rollback.command.command =
    rollback;
  const multiline = txWorkflowFlowGraph(model);

  assert.equal(
    multiline.blocks[0].data.wholeResourceRollback?.summaryText,
    rollback,
  );
  assert.equal(multiline.blocks[0].height - singleLine.blocks[0].height, 32);
  assert.equal(multiline.group.height - singleLine.group.height, 32);
  assert.equal(
    multiline.blocks[1].position.y - singleLine.blocks[1].position.y,
    32,
  );
  assert.ok(
    multiline.blocks[1].position.y + multiline.blocks[1].height <
      multiline.group.height - 44,
  );
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
