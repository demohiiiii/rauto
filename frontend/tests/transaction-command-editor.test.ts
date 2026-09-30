import assert from "node:assert/strict";
import test from "node:test";
import {
  createTransactionEditorPrompt,
  changeTransactionOperationEditorKind,
  transactionOperationEditorKind,
  transactionCommandEditorModel,
  transactionCommandFromEditor,
} from "../src/domains/transactions/model/transactionCommandEditor.js";
import {
  txBlockCommandDraft,
  txBlockOperationDraft,
  txBlockStepDraft,
  validateTxBlockFormModel,
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
} from "../src/domains/transactions/index.js";

function commandWithResponses(responses: string[]) {
  return {
    ...txBlockCommandDraft(),
    command: "configure",
    dynParams: { EnablePassword: "{{ password }}" },
    interaction: {
      extra: { extension: "keep" },
      hasPrompts: true,
      prompts: responses.map((response, index) => ({
        patterns: [`prompt-${index}`],
        response,
        recordInput: index === 0,
        hasRecordInput: true,
        extra: { marker: index },
      })),
    },
  };
}

test("shared editor preserves runtime responses including trailing and embedded newlines", () => {
  const responses = ["", "yes", "yes\n", "\n", "line 1\nline 2\n\n", "yes\r\n"];
  const command = commandWithResponses(responses);
  const editor = transactionCommandEditorModel(command);
  assert.deepEqual(
    editor.prompts.map((prompt) => prompt.appendNewline),
    [false, false, true, true, true, true],
  );
  const next = transactionCommandFromEditor(command, editor);
  assert.deepEqual(next.interaction.prompts, command.interaction.prompts);
  assert.deepEqual(next.dynParams, command.dynParams);
  assert.deepEqual(next.interaction.extra, command.interaction.extra);
});

test("moving, copying and editing rules keeps extension fields with their rule", () => {
  const command = commandWithResponses(["first\n", "second"]);
  const editor = transactionCommandEditorModel(command);
  editor.prompts = [
    editor.prompts[1],
    { ...editor.prompts[0], response: "updated" },
    { ...editor.prompts[0], patterns: ["copy"] },
  ];
  const next = transactionCommandFromEditor(command, editor);
  assert.deepEqual(
    next.interaction.prompts.map((prompt) => prompt.extra.marker),
    [1, 0, 0],
  );
  assert.deepEqual(
    next.interaction.prompts.map((prompt) => prompt.response),
    ["second", "updated\n", "first\n"],
  );
  assert.equal(command.interaction.prompts[0].response, "first\n");
});

test("new prompt newline switch is serialized into the runtime response only", () => {
  const command = txBlockCommandDraft();
  const editor = transactionCommandEditorModel(command);
  editor.command = "reboot";
  editor.prompts = [
    {
      ...createTransactionEditorPrompt(),
      patterns: ["Continue?"],
      response: "yes",
    },
  ];
  editor.timeoutSecs = 0;
  editor.hasTimeoutSecs = true;
  const next = transactionCommandFromEditor(command, editor);
  assert.equal(next.timeout, 0);
  assert.equal(next.hasInteraction, true);
  const block = txBlockFormModelFromJson({ name: "test", steps: [] });
  block.steps.push({
    hasRollback: false,
    hasRollbackOnFailure: false,
    rollback: null,
    rollbackOnFailure: false,
    run: {
      kind: "command",
      command: next,
      flow: {
        steps: [],
        extra: {},
        hasMaxSteps: false,
        hasStopOnError: false,
        maxSteps: null,
        stopOnError: true,
      },
    },
  });
  const result = JSON.parse(txBlockFormModelToJsonText(block));
  assert.deepEqual(result.steps[0].run.interaction.prompts[0], {
    patterns: ["Continue?"],
    response: "yes\n",
    record_input: false,
  });
  editor.prompts[0].appendNewline = false;
  editor.hasTimeoutSecs = false;
  const changed = transactionCommandFromEditor(next, editor);
  assert.equal(changed.interaction.prompts[0].response, "yes");
  assert.equal(changed.timeout, null);
  editor.prompts = [];
  assert.deepEqual(
    transactionCommandFromEditor(changed, editor).interaction.prompts,
    [],
  );
});

test("shared prompt editor preserves metadata edits", () => {
  const command = commandWithResponses(["yes"]);
  const editor = transactionCommandEditorModel(command);
  editor.prompts[0] = {
    ...editor.prompts[0],
    extra: { session_label: "console-session" },
  };
  assert.deepEqual(
    transactionCommandFromEditor(command, editor).interaction.prompts[0].extra,
    { session_label: "console-session" },
  );
});

test("shared prompt editor persists both record-input switch states", () => {
  const command = commandWithResponses(["yes"]);
  const editor = transactionCommandEditorModel(command);
  for (const recordInput of [false, true]) {
    editor.prompts[0] = { ...editor.prompts[0], recordInput };
    assert.equal(
      transactionCommandFromEditor(command, editor).interaction.prompts[0]
        .recordInput,
      recordInput,
    );
  }
});

test("shared prompt editor persists pattern edits and removals", () => {
  const command = commandWithResponses(["yes"]);
  const editor = transactionCommandEditorModel(command);
  editor.prompts[0] = {
    ...editor.prompts[0],
    patterns: ["Login:", "Password:"],
  };
  let next = transactionCommandFromEditor(command, editor);
  assert.deepEqual(next.interaction.prompts[0].patterns, [
    "Login:",
    "Password:",
  ]);
  editor.prompts[0] = { ...editor.prompts[0], patterns: ["Password:"] };
  next = transactionCommandFromEditor(next, editor);
  assert.deepEqual(next.interaction.prompts[0].patterns, ["Password:"]);
});

test("interactive selection keeps one command and restores interaction rules when toggled", () => {
  const operation = txBlockOperationDraft();
  operation.command.command = "reboot";
  operation.command.mode = "Root,User";
  const interactive = changeTransactionOperationEditorKind(
    operation,
    "interactive",
  );
  assert.equal(interactive.kind, "command");
  assert.equal(transactionOperationEditorKind(interactive), "interactive");
  assert.equal(interactive.command.command, "reboot");
  assert.equal(interactive.command.mode, "Root,User");
  assert.deepEqual(interactive.flow, operation.flow);
  interactive.command.interaction = commandWithResponses(["yes\n"]).interaction;
  const plain = changeTransactionOperationEditorKind(interactive, "command");
  assert.equal(transactionOperationEditorKind(plain), "command");
  assert.equal(plain.command.command, "reboot");
  assert.deepEqual(plain.command.interaction.prompts, []);
  plain.command.command = "reboot now";
  const restored = changeTransactionOperationEditorKind(plain, "interactive");
  assert.equal(restored.command.command, "reboot now");
  assert.equal(restored.command.interaction.prompts[0].response, "yes\n");
  assert.equal(operation.kind, "command");
});

test("existing interactive command responses remain accessible and survive switching to plain commands", () => {
  const operation = txBlockOperationDraft();
  operation.command = commandWithResponses(["confirm\n"]);
  assert.equal(transactionOperationEditorKind(operation), "interactive");
  const plain = changeTransactionOperationEditorKind(operation, "command");
  const interactive = changeTransactionOperationEditorKind(
    plain,
    "interactive",
  );
  assert.equal(
    interactive.command.interaction.prompts[0].response,
    "confirm\n",
  );
  assert.equal(operation.command.interaction.prompts[0].response, "confirm\n");
});

test("interactive run and rollback serialize as commands and reload with their rules", () => {
  const block = txBlockFormModelFromJson({
    name: "test",
    rollback_policy: "per_step",
    steps: [],
  });
  const step = txBlockStepDraft();
  for (const field of ["run", "rollback"] as const) {
    const operation = changeTransactionOperationEditorKind(
      txBlockOperationDraft(),
      "interactive",
    );
    operation.command = commandWithResponses(["yes\n", "no"]);
    operation.command.multilineMode = "whole";
    operation.command.timeout = 17;
    step[field] = operation;
  }
  block.steps.push(step);
  assert.deepEqual(validateTxBlockFormModel(block), []);
  const payload = JSON.parse(txBlockFormModelToJsonText(block));
  const restored = txBlockFormModelFromJson(payload);
  for (const field of ["run", "rollback"] as const) {
    const output = payload.steps[0][field];
    assert.equal(output.kind, "command");
    assert.equal(output.command, "configure");
    assert.equal(output.mode, "User");
    assert.equal(output.multiline_mode, "whole");
    assert.equal(output.timeout, 17);
    assert.deepEqual(output.dyn_params, step[field]!.command.dynParams);
    assert.deepEqual(
      output.interaction.prompts.map(
        (prompt: { response: string }) => prompt.response,
      ),
      ["yes\n", "no"],
    );
    for (const key of [
      "steps",
      "stop_on_error",
      "max_steps",
      "commandEditorKind",
      "interactionDraft",
    ]) {
      assert.equal(Object.hasOwn(output, key), false);
    }
    assert.equal(
      transactionOperationEditorKind(restored.steps[0][field]!),
      "interactive",
    );
  }
});

test("removing the last interaction rule keeps the editor selected and plain execution excludes cached rules", () => {
  let operation = changeTransactionOperationEditorKind(
    txBlockOperationDraft(),
    "interactive",
  );
  operation.command = commandWithResponses(["yes\n"]);
  const editor = transactionCommandEditorModel(operation.command);
  editor.prompts = [];
  operation.command = transactionCommandFromEditor(operation.command, editor);
  assert.equal(transactionOperationEditorKind(operation), "interactive");
  operation.command = commandWithResponses(["confirm\n"]);
  operation = changeTransactionOperationEditorKind(operation, "command");
  const block = txBlockFormModelFromJson({ steps: [] });
  block.steps.push({ ...txBlockStepDraft(), run: operation });
  const text = txBlockFormModelToJsonText(block);
  assert.deepEqual(JSON.parse(text).steps[0].run.interaction.prompts, []);
  assert.equal(text.includes("confirm"), false);
  assert.equal(text.includes("interactionDraft"), false);
  const interactive = changeTransactionOperationEditorKind(
    operation,
    "interactive",
  );
  assert.equal(
    interactive.command.interaction.prompts[0].response,
    "confirm\n",
  );
});
