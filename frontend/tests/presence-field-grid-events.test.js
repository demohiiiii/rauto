import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  txBlockVisualEditorBindings,
} from "../src/modules/transactions/transactionBlockBindingState.js";

function valueEvent(value) {
  return {
    currentTarget: { value },
    target: { value },
  };
}

function gridInput(controlBindings, valueHandlerMode, event) {
  const fieldBindings =
    valueHandlerMode === "event"
      ? plainInputFieldBindings({ onInput: controlBindings.valueChangeHandler })
      : plainInputFieldBindings({
          onValueInput: controlBindings.valueChangeHandler,
        });
  return fieldBindings.inputHandler(event);
}

function gridSelect(handler, valueHandlerMode, event) {
  const fieldBindings =
    valueHandlerMode === "event"
      ? plainSelectFieldBindings({ onChange: handler })
      : plainSelectFieldBindings({ onValueChange: handler });
  return fieldBindings.changeHandler(event);
}

function interactionGridModes() {
  const source = readFileSync(
    "frontend/src/pages/orchestrated/TxBlockCommandInteractionEditor.svelte",
    "utf8",
  );
  return (source.match(/<PresenceFieldGrid[\s\S]*?\/>/g) || []).map((grid) =>
    grid.includes('valueHandlerMode="event"') ? "event" : "value",
  );
}

test("PresenceFieldGrid preserves raw values by default", () => {
  const source = readFileSync(
    "frontend/src/components/fragments/PresenceFieldGrid.svelte",
    "utf8",
  );
  const workflowSource = readFileSync(
    "frontend/src/pages/orchestrated/TxWorkflowBlockEditor.svelte",
    "utf8",
  );
  const observed = [];
  const control = presenceFieldRowBindings({
    fieldRow: { fieldKey: "source", enabled: true },
    onValueChange: (value) => observed.push(["input", value]),
  });
  const nullableControl = presenceFieldRowBindings({
    fieldRow: {
      fieldKey: "source",
      enabled: true,
      showNullableModeSelect: true,
    },
    onNullableModeChange: (value) => observed.push(["nullable", value]),
  });

  gridInput(control, "value", valueEvent("inline"));
  gridSelect(control.valueChangeHandler, "value", valueEvent("template_ref"));
  gridSelect(
    nullableControl.nullableModeChangeHandler,
    "value",
    valueEvent("null"),
  );

  assert.deepEqual(observed, [
    ["input", "inline"],
    ["input", "template_ref"],
    ["nullable", "null"],
  ]);
  assert.match(source, /valueHandlerMode = "value"/);
  assert.equal(
    (source.match(/onChange=\{valueHandlerMode === "event"/g) || []).length,
    2,
  );
  assert.equal(
    (source.match(/onValueChange=\{valueHandlerMode === "event"/g) || [])
      .length,
    2,
  );
  assert.equal(
    (source.match(/onInput=\{valueHandlerMode === "event"/g) || []).length,
    1,
  );
  assert.equal(
    (source.match(/onValueInput=\{valueHandlerMode === "event"/g) || []).length,
    1,
  );
  assert.match(
    workflowSource,
    /onValueChange=\{blockActionHandlers\.setSource\}/,
  );
  assert.doesNotMatch(workflowSource, /valueHandlerMode="event"/);
});

test("PresenceFieldGrid event mode passes one DOM event to transaction handlers", () => {
  const presenceValues = [];
  const nullableEvents = [];
  const selectValues = [];
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
    onNullableModeChange: (event) => nullableEvents.push(event),
    onPresenceChange: (enabled) => presenceValues.push(enabled),
  });

  gridSelect(selectControl.valueChangeHandler, "event", valueEvent("Enable"));
  const nullableEvent = valueEvent("value");
  gridSelect(nullableControl.nullableModeChangeHandler, "event", nullableEvent);
  nullableControl.presenceChangeHandler(false);

  assert.deepEqual(selectValues, ["Enable"]);
  assert.equal(nullableEvents[0], nullableEvent);
  assert.deepEqual(presenceValues, [false]);
});

test("transaction prompt metadata preserves raw string input", () => {
  const command = {
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
        },
      ],
    },
    hasInteraction: true,
  };
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

  gridInput(
    metadataControl,
    interactionGridModes()[0],
    valueEvent("console-session"),
  );

  assert.equal(
    nextCommand.interaction.prompts[0].extra.session_label,
    "console-session",
  );
});

test("transaction interaction record input select preserves true", () => {
  const command = {
    interaction: {
      extra: {},
      hasPrompts: true,
      prompts: [
        {
          extra: {},
          hasRecordInput: true,
          patterns: [],
          recordInput: false,
          response: "",
        },
      ],
    },
    hasInteraction: true,
  };
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

  gridSelect(
    recordControl.valueChangeHandler,
    interactionGridModes()[2],
    valueEvent("true"),
  );

  assert.equal(nextCommand.interaction.prompts[0].recordInput, true);
});

test("transaction prompt list callbacks use direct StringListEditor signatures", () => {
  const command = {
    interaction: {
      extra: {},
      hasPrompts: true,
      prompts: [
        {
          extra: {},
          hasRecordInput: false,
          patterns: ["Password:", "Username:"],
          recordInput: false,
          response: "",
        },
      ],
    },
    hasInteraction: true,
  };
  const emittedCommands = [];
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

test("transaction block grids declare their event or raw value contract", () => {
  const txBlockEditorPaths = [
    "frontend/src/pages/orchestrated/TxBlockCommandEditor.svelte",
    "frontend/src/components/command-flow/CommandFlowSettings.svelte",
    "frontend/src/pages/orchestrated/TxBlockRollbackPolicyEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockRootSettingsEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockStepEditor.svelte",
  ];

  for (const path of txBlockEditorPaths) {
    const source = readFileSync(path, "utf8");
    const grids = source.match(/<PresenceFieldGrid[\s\S]*?\/>/g) || [];
    assert.ok(grids.length > 0, `${path} must contain a field grid`);
    for (const grid of grids) {
      assert.match(grid, /valueHandlerMode="event"/, path);
    }
  }

  const interactionPath =
    "frontend/src/pages/orchestrated/TxBlockCommandInteractionEditor.svelte";
  const interactionSource = readFileSync(interactionPath, "utf8");
  const interactionGrids =
    interactionSource.match(/<PresenceFieldGrid[\s\S]*?\/>/g) || [];
  assert.equal(interactionGrids.length, 2);
  assert.doesNotMatch(
    interactionSource,
    /interactionMetadataFieldRows/,
    interactionPath,
  );
  for (const grid of interactionGrids) {
    assert.doesNotMatch(grid, /valueHandlerMode="event"/, interactionPath);
  }
});

test("PresenceFieldGrid event flow preserves root names and nested commands", () => {
  const model = {
    name: "tx-block",
    steps: [{ run: { kind: "command", command: "show version" } }],
  };
  let nextModel = model;
  const rootBindings = txBlockVisualEditorBindings(model, (value) => {
    nextModel = value;
  });
  const rootControl = presenceFieldRowBindings({
    fieldRow: { fieldKey: "name", enabled: true },
    onValueChangeForKey: rootBindings.rootValueHandler,
  });

  gridInput(rootControl, "event", valueEvent("campus-change"));
  assert.equal(nextModel.name, "campus-change");

  const command = model.steps[0].run;
  const commandBindings = txBlockCommandEditorBindings(
    command,
    rootBindings.stepRunChangeAction(0),
  );
  const commandControl = presenceFieldRowBindings({
    fieldRow: { fieldKey: "command", enabled: true },
    onValueChangeForKey: commandBindings.fieldValueHandler,
  });

  gridInput(commandControl, "event", valueEvent("show interfaces status"));
  assert.equal(nextModel.steps[0].run.command, "show interfaces status");
});
