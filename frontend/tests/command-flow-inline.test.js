import assert from "node:assert/strict";
import test from "node:test";
import { txBlockFlowEditorBindings } from "../src/modules/transactions/transactionBlockBindingState.js";
import {
  txBlockAddCommandPrompt,
  txBlockUpdateCommandPrompt,
  txBlockDuplicateFlowStep,
  txBlockMoveFlowStep,
  txBlockPatchFlow,
} from "../src/modules/transactions/transactionBlockMutations.js";

function flowOperation() {
  return {
    kind: "flow",
    flow: {
      steps: [
        { command: "show version", extra: { nested: "one" } },
        { command: "show clock", extra: { nested: "two" } },
      ],
      stopOnError: true,
      hasStopOnError: true,
      maxSteps: null,
      hasMaxSteps: false,
      extra: {},
    },
  };
}

test("inline command flow steps move immutably", () => {
  const source = flowOperation();
  const moved = txBlockMoveFlowStep(source, 0, 1);

  assert.deepEqual(
    moved.flow.steps.map((step) => step.command),
    ["show clock", "show version"],
  );
  assert.deepEqual(
    source.flow.steps.map((step) => step.command),
    ["show version", "show clock"],
  );
});

test("inline command flow steps duplicate deeply", () => {
  const source = flowOperation();
  const duplicate = txBlockDuplicateFlowStep(source, 0);

  assert.deepEqual(
    duplicate.flow.steps.map((step) => step.command),
    ["show version", "show version", "show clock"],
  );
  duplicate.flow.steps[1].extra.nested = "changed";
  assert.equal(duplicate.flow.steps[0].extra.nested, "one");
});

test("inline flow settings preserve the rneter command flow shape", () => {
  const source = flowOperation();
  const patched = txBlockPatchFlow(source, {
    stopOnError: false,
    hasStopOnError: true,
    maxSteps: 4,
    hasMaxSteps: true,
  });

  assert.equal(patched.flow.stopOnError, false);
  assert.equal(patched.flow.maxSteps, 4);
  assert.equal(patched.flow.steps.length, 2);
});

test("inline flow bindings notify once and keep the source operation unchanged", () => {
  const source = flowOperation();
  const changes = [];
  const bindings = txBlockFlowEditorBindings(source, (next) =>
    changes.push(next),
  );

  bindings.setStopOnError("false");
  bindings.addStep();

  assert.equal(changes.length, 2);
  assert.equal(changes[0].flow.stopOnError, false);
  assert.equal(changes[1].flow.steps.length, 3);
  assert.equal(source.flow.stopOnError, true);
  assert.equal(source.flow.steps.length, 2);
});

test("transaction interaction mutations preserve prompts and extra snapshots", () => {
  const source = {
    interaction: {
      extra: { session: "one" },
      hasPrompts: true,
      prompts: [{ response: "ready", extra: {} }],
    },
    hasInteraction: true,
  };

  const added = txBlockAddCommandPrompt(source);
  const updated = txBlockUpdateCommandPrompt(added, 0, {
    response: "updated",
  });
  assert.equal(added.interaction.prompts.length, 2);
  assert.equal(updated.interaction.prompts[0].response, "updated");
  assert.equal(source.interaction.prompts[0].response, "ready");
  assert.notEqual(added.interaction.extra, source.interaction.extra);
});
