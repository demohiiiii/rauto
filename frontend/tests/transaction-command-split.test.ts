import assert from "node:assert/strict";
import test from "node:test";
import {
  txBlockCanSplitStep,
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
  txBlockSplitStep,
  txBlockStepSplitStatus,
} from "../src/domains/transactions/index.js";

function model(command = "first\nsecond\nthird") {
  return txBlockFormModelFromJson({
    fail_fast: false,
    rollback_policy: "per_step",
    steps: [
      { run: { kind: "command", mode: "Root,User", command: "before" } },
      {
        run: {
          kind: "command",
          mode: "Root,User",
          command,
          multiline_mode: "whole",
          timeout: 42,
          dyn_params: { path: "{{ vars.path }}" },
        },
        rollback: {
          kind: "command",
          mode: "Root,User",
          command: "undo first\nundo second",
        },
        rollback_on_failure: true,
      },
      { run: { kind: "command", mode: "Root,User", command: "after" } },
    ],
  });
}

test("splitting commands preserves order, execution parameters, whitespace and source data", () => {
  const source = model("\n first\r\n  \t\rsecond\nthird  \n");
  const original = structuredClone(source);
  const next = txBlockSplitStep(source, 1);
  assert.deepEqual(source, original);
  assert.deepEqual(
    next.steps.map((step) => step.run.command.command),
    ["before", " first", "second", "third  ", "after"],
  );
  assert.equal(next.failFast, false);
  for (const step of next.steps.slice(1, 4)) {
    assert.equal(step.run.command.mode, "Root,User");
    assert.equal(step.run.command.timeout, 42);
    assert.equal(step.run.command.multilineMode, "split_lines");
    assert.deepEqual(step.run.command.dynParams, { path: "{{ vars.path }}" });
  }
  next.steps[2].run.command.dynParams.path = "changed";
  assert.equal(next.steps[1].run.command.dynParams.path, "{{ vars.path }}");
  assert.equal(next.steps[3].run.command.dynParams.path, "{{ vars.path }}");
});

test("splitting pairs rollback lines with run lines and leaves missing rollbacks empty", () => {
  const source = model();
  const next = txBlockSplitStep(source, 1);
  assert.equal(next.steps[1].rollback?.command.command, "undo first");
  assert.equal(next.steps[2].rollback?.command.command, "undo second");
  for (const index of [1, 2]) {
    assert.equal(next.steps[index].rollbackOnFailure, true);
    assert.equal(next.steps[index].hasRollbackOnFailure, true);
    assert.equal(
      next.steps[index].rollback?.command.multilineMode,
      "split_lines",
    );
  }
  assert.equal(next.steps.filter((step) => step.rollback !== null).length, 2);
  const saved = JSON.parse(txBlockFormModelToJsonText(next));
  assert.equal(saved.steps[1].rollback.command, "undo first");
  assert.equal(saved.steps[1].rollback_on_failure, true);
  assert.equal(saved.steps[2].rollback.command, "undo second");
  assert.equal(saved.steps[2].rollback_on_failure, true);
  assert.equal(next.steps[3].rollback, null);
  assert.equal(next.steps[3].rollbackOnFailure, false);
  assert.equal(saved.steps[3].rollback, null);
  assert.equal(saved.steps[3].rollback_on_failure, false);
});

test("equal rollback and run line counts preserve independent rollback settings and skip blank lines", () => {
  const source = model("first\r\nsecond\nthird");
  const rollback = source.steps[1].rollback!.command;
  rollback.command = "\n undo first\r\n \t\rundo second\nundo third  \n";
  rollback.mode = "Config";
  rollback.timeout = 77;
  rollback.hasTimeout = true;
  rollback.dynParams = { target: "{{ vars.rollback_target }}" };
  rollback.hasDynParams = true;
  const original = structuredClone(source);
  assert.equal(txBlockStepSplitStatus(source.steps[1]), "ready");
  const next = txBlockSplitStep(source, 1);
  assert.deepEqual(source, original);
  assert.deepEqual(
    next.steps.slice(1, 4).map((step) => step.rollback?.command.command),
    [" undo first", "undo second", "undo third  "],
  );
  for (const step of next.steps.slice(1, 4)) {
    assert.equal(step.rollback!.command.mode, "Config");
    assert.equal(step.rollback!.command.timeout, 77);
    assert.deepEqual(step.rollback!.command.dynParams, {
      target: "{{ vars.rollback_target }}",
    });
  }
  next.steps[2].rollback!.command.dynParams.target = "changed";
  assert.equal(
    next.steps[1].rollback!.command.dynParams.target,
    "{{ vars.rollback_target }}",
  );
  assert.equal(
    next.steps[3].rollback!.command.dynParams.target,
    "{{ vars.rollback_target }}",
  );
});

test("rollback lines cannot exceed run lines and rejection leaves all data intact", () => {
  const source = model("first\nsecond");
  source.steps[1].rollback!.command.command =
    "undo first\nundo second\nundo third";
  const original = structuredClone(source);
  assert.equal(txBlockStepSplitStatus(source.steps[1]), "rollback_exceeds_run");
  assert.equal(txBlockCanSplitStep(source.steps[1]), false);
  assert.equal(txBlockSplitStep(source, 1), source);
  assert.deepEqual(source, original);
});

test("absent and blank rollback commands leave all split commands without compensation", () => {
  for (const command of [null, "\n \r\n\t"]) {
    const source = model();
    if (command === null) source.steps[1].rollback = null;
    else source.steps[1].rollback!.command.command = command;
    const next = txBlockSplitStep(source, 1);
    assert.equal(next.steps.length, 5);
    for (const step of next.steps.slice(1, 4)) {
      assert.equal(step.rollback, null);
      assert.equal(step.rollbackOnFailure, false);
    }
  }
});

test("interactive rollback operations cannot be split or silently redistributed", () => {
  const source = model();
  const rollback = source.steps[1].rollback!;
  rollback.commandEditorKind = "interactive";
  assert.equal(txBlockStepSplitStatus(source.steps[1]), "interactive_rollback");
  assert.equal(txBlockSplitStep(source, 1), source);
  rollback.commandEditorKind = "command";
  rollback.command.interaction.prompts = [
    {
      patterns: ["confirm"],
      response: "yes\n",
      recordInput: false,
      hasRecordInput: true,
      extra: {},
    },
  ];
  assert.equal(txBlockStepSplitStatus(source.steps[1]), "interactive_rollback");
  assert.equal(txBlockSplitStep(source, 1), source);
  rollback.kind = "flow";
  assert.equal(txBlockSplitStep(source, 1), source);
});

test("splitting keeps whole-resource rollback triggers attached to their original commands", () => {
  for (const [trigger, expected] of [
    [0, 0],
    [1, 1],
    [2, 4],
  ]) {
    const source = model();
    source.rollbackPolicy = {
      kind: "whole_resource",
      wholeResource: {
        hasTriggerStepIndex: true,
        triggerStepIndex: trigger,
        extra: {},
        rollback: source.steps[1].rollback!,
      },
    };
    const next = txBlockSplitStep(source, 1);
    assert.equal(next.rollbackPolicy.wholeResource!.triggerStepIndex, expected);
    assert.equal(
      source.rollbackPolicy.wholeResource!.triggerStepIndex,
      trigger,
    );
    assert.deepEqual(
      next.rollbackPolicy.wholeResource!.rollback,
      source.rollbackPolicy.wholeResource!.rollback,
    );
  }
});

test("single commands, blank commands, interactive commands and invalid indexes are unchanged", () => {
  for (const command of ["first", "first\n\t\n", " \r\n\r "]) {
    const source = model(command);
    assert.equal(txBlockCanSplitStep(source.steps[1]), false);
    assert.equal(txBlockSplitStep(source, 1), source);
  }
  const source = model();
  for (const index of [-1, 8, 0.5, Number.NaN])
    assert.equal(txBlockSplitStep(source, index), source);
  assert.equal(txBlockCanSplitStep(undefined), false);
  source.steps[1].run.commandEditorKind = "interactive";
  assert.equal(txBlockCanSplitStep(source.steps[1]), false);
  assert.equal(txBlockSplitStep(source, 1), source);
  source.steps[1].run.commandEditorKind = "command";
  source.steps[1].run.command.interaction.prompts = [
    {
      patterns: ["confirm"],
      response: "yes\n",
      recordInput: false,
      hasRecordInput: true,
      extra: {},
    },
  ];
  assert.equal(txBlockCanSplitStep(source.steps[1]), false);
  assert.equal(txBlockSplitStep(source, 1), source);
  source.steps[1].run.kind = "flow";
  assert.equal(txBlockCanSplitStep(source.steps[1]), false);
  assert.equal(txBlockSplitStep(source, 1), source);
});
