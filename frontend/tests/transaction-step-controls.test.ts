import assert from "node:assert/strict";
import test from "node:test";
import {
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
  validateTxBlockFormModel,
  txBlockStepSplitStatus,
  txBlockAddStep,
  txWorkflowFlowGraph,
  txWorkflowFormModelFromJson,
} from "../src/domains/transactions/index.js";
import {
  txStepScope,
  txStepAtPath,
  txStepReplaceScope,
} from "../src/domains/transactions/model/transactionStepTree.js";
import { flowWorkflowBlockHeight } from "../src/components/fragments/flowWorkflowLayout.js";

const operation = (command: string) => ({
  kind: "command",
  mode: "Config",
  command,
});
const source = {
  name: "one-transaction",
  fail_fast: true,
  rollback_policy: "per_step",
  steps: [
    {
      kind: "loop",
      iterations: "vars.addresses",
      item_variable: "address",
      steps: [
        {
          kind: "choice",
          branches: [
            {
              condition: "address.enabled",
              steps: [
                {
                  run: operation("set {{ address.value }}"),
                  rollback: operation("undo {{ address.value }}"),
                  rollback_on_failure: true,
                },
              ],
            },
            {
              condition: "vars.fallback",
              steps: [
                {
                  run: operation("fallback\nverify"),
                  rollback: operation("undo fallback\nundo verify"),
                },
              ],
            },
          ],
          else: [],
        },
      ],
    },
  ],
};

test("block-local controls round trip with ordered branches, interactive prompts and paired rollbacks", () => {
  const model = txBlockFormModelFromJson(source);
  const command = txStepAtPath(model, [0, 0, 0, 0, 0])!;
  assert.equal(command.rollbackOnFailure, true);
  command.run.command.interaction.prompts = [
    {
      patterns: ["Continue?"],
      response: "yes",
      hasRecordInput: true,
      recordInput: false,
      extra: {},
    },
  ];
  const json = JSON.parse(txBlockFormModelToJsonText(model));
  assert.equal(json.steps[0].kind, "loop");
  assert.equal(json.steps[0].steps[0].branches.length, 2);
  assert.equal(
    json.steps[0].steps[0].branches[0].steps[0].rollback_on_failure,
    true,
  );
  assert.equal(
    json.steps[0].steps[0].branches[0].steps[0].run.interaction.prompts[0]
      .response,
    "yes",
  );
  assert.equal(
    json.steps[0].steps[0].branches[0].steps[0].rollback.command,
    "undo {{ address.value }}",
  );
  assert.ok(!JSON.stringify(json).includes("editorId"));
  const again = txBlockFormModelFromJson(json);
  assert.deepEqual(JSON.parse(txBlockFormModelToJsonText(again)), json);
  assert.deepEqual(validateTxBlockFormModel(again), []);
  assert.equal(txBlockStepSplitStatus(model.steps[0]), "unavailable");
});

test("branch edits preserve sibling commands and the enclosing whole-resource policy", () => {
  const model = txBlockFormModelFromJson({
    ...source,
    rollback_policy: {
      whole_resource: { rollback: operation("restore"), trigger_step_index: 0 },
    },
  });
  const scope = txStepScope(model, [0, 0, 0, 1])!;
  const next = txStepReplaceScope(
    model,
    [0, 0, 0, 1],
    txBlockAddStep(scope).steps,
  );
  assert.equal(txStepScope(next, [0, 0, 0, 1])!.steps.length, 2);
  assert.deepEqual(
    txStepAtPath(next, [0, 0, 0, 0, 0]),
    txStepAtPath(model, [0, 0, 0, 0, 0]),
  );
  assert.equal(txStepScope(model, [0, 0, 0, 1])!.steps.length, 1);
  assert.equal(scope.rollbackPolicy.kind, "none");
  assert.deepEqual(next.rollbackPolicy, model.rollbackPolicy);
  assert.equal(txStepScope(model, [0, 9]), null);
  assert.equal(txStepAtPath(model, [0, 0, 0, 9, 0]), null);
  assert.equal(txStepReplaceScope(model, [0, 9], []), model);
});

test("control validation includes nested commands and expressions without inventing dummy commands", () => {
  const model = txBlockFormModelFromJson({
    steps: [
      {
        kind: "loop",
        iterations: "",
        item_variable: "vars",
        steps: [
          {
            kind: "choice",
            branches: [{ condition: "", steps: [{ run: operation("") }] }],
          },
        ],
      },
    ],
  });
  const errors = validateTxBlockFormModel(model);
  assert.ok(
    errors.some((error) => error.path === "steps[0].control.iterations"),
  );
  assert.ok(
    errors.some((error) => error.path === "steps[0].control.itemVariable"),
  );
  assert.ok(
    errors.some(
      (error) =>
        error.path ===
        "steps[0].control.blocks[0].control.branches[0].condition",
    ),
  );
  assert.ok(
    errors.some((error) =>
      error.path.endsWith(".blocks[0].run.command.command"),
    ),
  );
  assert.ok(
    !errors.some((error) => error.path === "steps[0].run.command.command"),
  );
});

test("nested control cards reserve all command lines and grow their enclosing transaction block", () => {
  const graph = txWorkflowFlowGraph(
    txWorkflowFormModelFromJson({ blocks: [source, source] }),
  );
  const block = graph.blocks[0];
  const loop = block.data.commandRows[0].controlNode!;
  const choice =
    loop.structure!.branches[0].entries[0].commandRows[0].controlNode!;
  const branch = choice.structure!.branches[1].entries[0];
  assert.equal(branch.commandsOnly, true);
  assert.equal(branch.commandRows[0].summaryText, "fallback\nverify");
  assert.equal(
    branch.commandRows[0].rollbackSummaryText,
    "undo fallback\nundo verify",
  );
  assert.ok(flowWorkflowBlockHeight(choice) > flowWorkflowBlockHeight(branch));
  assert.ok(block.height > flowWorkflowBlockHeight(loop));
  assert.ok(graph.blocks[1].position.y >= block.position.y + block.height);
});
