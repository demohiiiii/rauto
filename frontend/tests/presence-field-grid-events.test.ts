import assert from "node:assert/strict";
import test from "node:test";

import {
  formValueHandler,
  plainInputFieldBindings,
  plainSelectFieldBindings,
  presenceFieldRowBindings,
} from "../src/lib/events.js";
import {
  txBlockCommandEditorBindings,
  txBlockCommandInteractionEditorBindings,
  txBlockFormModelFromJson,
  txBlockVisualEditorBindings,
} from "../src/domains/transactions/index.js";
import type {
  TxCommandModel,
  TxRuntimePromptModel,
} from "../src/domains/transactions/index.js";

interface ValueEvent {
  currentTarget: { value: string };
  target: { value: string };
}

function valueEvent(value: string): ValueEvent {
  return {
    currentTarget: { value },
    target: { value },
  };
}

function promptCommand(prompt: Partial<TxRuntimePromptModel>): TxCommandModel {
  return {
    command: "copy running-config startup-config",
    dynParams: {},
    extra: {},
    hasDynParams: false,
    hasInteraction: true,
    hasTimeout: false,
    interaction: {
      extra: {},
      hasPrompts: true,
      prompts: [
        {
          extra: {},
          hasRecordInput: false,
          patterns: [],
          recordInput: false,
          response: "",
          ...prompt,
        },
      ],
    },
    mode: "Enable",
    multilineMode: "split_lines",
    timeout: null,
  };
}

test("PresenceFieldGrid bindings preserve raw values by default", () => {
  const observed: Array<[string, string]> = [];
  const control = presenceFieldRowBindings({
    fieldRow: { fieldKey: "source", enabled: true },
    onValueChange: (value: string) => observed.push(["input", value]),
  });
  const nullableControl = presenceFieldRowBindings({
    fieldRow: {
      fieldKey: "source",
      enabled: true,
      showNullableModeSelect: true,
    },
    onNullableModeChange: (value: string) => observed.push(["nullable", value]),
  });
  const input = plainInputFieldBindings({
    onValueInput: control.valueChangeHandler,
  });
  const select = plainSelectFieldBindings({
    onValueChange: control.valueChangeHandler,
  });
  const nullableSelect = plainSelectFieldBindings({
    onValueChange: nullableControl.nullableModeChangeHandler,
  });

  input.inputHandler(valueEvent("inline"));
  select.changeHandler(valueEvent("template_ref"));
  nullableSelect.changeHandler(valueEvent("null"));

  assert.deepEqual(observed, [
    ["input", "inline"],
    ["input", "template_ref"],
    ["nullable", "null"],
  ]);
});

test("event-mode controls pass one DOM event to transaction handlers", () => {
  const presenceValues: boolean[] = [];
  const nullableEvents: ValueEvent[] = [];
  const selectValues: string[] = [];
  const selectControl = presenceFieldRowBindings({
    fieldRow: { fieldKey: "mode", enabled: true },
    onValueChange: formValueHandler((value) => selectValues.push(value)),
  });
  const nullableControl = presenceFieldRowBindings({
    fieldRow: {
      fieldKey: "description",
      enabled: true,
      showNullableModeSelect: true,
    },
    showPresenceToggle: true,
    onNullableModeChange: (event: ValueEvent) => nullableEvents.push(event),
    onPresenceChange: (enabled) => presenceValues.push(enabled),
  });
  const select = plainSelectFieldBindings({
    onChange: selectControl.valueChangeHandler,
  });
  const nullableSelect = plainSelectFieldBindings({
    onChange: nullableControl.nullableModeChangeHandler,
  });

  select.changeHandler(valueEvent("Enable"));
  const nullableEvent = valueEvent("value");
  nullableSelect.changeHandler(nullableEvent);
  nullableControl.presenceChangeHandler(false);

  assert.deepEqual(selectValues, ["Enable"]);
  assert.equal(nullableEvents[0], nullableEvent);
  assert.deepEqual(presenceValues, [false]);
});

test("transaction prompt metadata preserves raw string input", () => {
  const command = promptCommand({});
  let nextCommand = command;
  const interactionBindings = txBlockCommandInteractionEditorBindings(
    command,
    (value) => {
      nextCommand = value;
    },
  );
  const promptActions = interactionBindings.promptActionHandlers(0);
  const metadataControl = presenceFieldRowBindings({
    fieldRow: { fieldKey: "session_label", enabled: true },
    onValueChangeForKey: promptActions.metadataValueHandler,
  });
  const input = plainInputFieldBindings({
    onValueInput: metadataControl.valueChangeHandler,
  });

  input.inputHandler(valueEvent("console-session"));

  assert.deepEqual(nextCommand.interaction.prompts[0].extra, {
    session_label: "console-session",
  });
});

test("transaction interaction record input select preserves true", () => {
  const command = promptCommand({ hasRecordInput: true });
  let nextCommand = command;
  const interactionBindings = txBlockCommandInteractionEditorBindings(
    command,
    (value) => {
      nextCommand = value;
    },
  );
  const promptBindings = interactionBindings.promptActionHandlers(0);
  const recordControl = presenceFieldRowBindings({
    fieldRow: { fieldKey: "recordInput", enabled: true },
    onValueChange: promptBindings.recordValueHandler(),
  });
  const select = plainSelectFieldBindings({
    onValueChange: recordControl.valueChangeHandler,
  });

  select.changeHandler(valueEvent("true"));

  assert.equal(nextCommand.interaction.prompts[0].recordInput, true);
});

test("transaction prompt list callbacks use direct value signatures", () => {
  const command = promptCommand({ patterns: ["Password:", "Username:"] });
  const emittedCommands: TxCommandModel[] = [];
  const interactionBindings = txBlockCommandInteractionEditorBindings(
    command,
    (value) => emittedCommands.push(value),
  );
  const promptActions = interactionBindings.promptActionHandlers(0);

  promptActions.patternValueHandler(0, "Login:");
  promptActions.removePatternAction(1);

  assert.deepEqual(emittedCommands[0].interaction.prompts[0].patterns, [
    "Login:",
    "Username:",
  ]);
  assert.deepEqual(emittedCommands[1].interaction.prompts[0].patterns, [
    "Password:",
  ]);
});

test("field controls preserve root and command changes", () => {
  const model = txBlockFormModelFromJson({
    name: "tx-block",
    rollback_policy: "none",
    steps: [
      {
        run: {
          kind: "command",
          mode: "Enable",
          command: "show version",
        },
      },
    ],
  });
  let nextModel = model;
  const rootBindings = txBlockVisualEditorBindings(model, (value) => {
    nextModel = value;
  });
  const rootControl = presenceFieldRowBindings({
    fieldRow: { fieldKey: "name", enabled: true },
    onValueChangeForKey: rootBindings.rootValueHandler,
  });
  const rootInput = plainInputFieldBindings({
    onInput: rootControl.valueChangeHandler,
  });

  rootInput.inputHandler(valueEvent("campus-change"));
  assert.equal(nextModel.name, "campus-change");

  const command = model.steps[0].run.command;
  const commandPatches: Array<Partial<TxCommandModel>> = [];
  const commandBindings = txBlockCommandEditorBindings(command, (patch) => {
    commandPatches.push(patch);
  });
  const commandControl = presenceFieldRowBindings({
    fieldRow: { fieldKey: "command", enabled: true },
    onValueChangeForKey: commandBindings.fieldValueHandler,
  });
  const commandInput = plainInputFieldBindings({
    onInput: commandControl.valueChangeHandler,
  });

  commandInput.inputHandler(valueEvent("show interfaces status"));
  assert.deepEqual(commandPatches, [{ command: "show interfaces status" }]);
});
