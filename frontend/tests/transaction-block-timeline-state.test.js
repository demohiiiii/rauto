import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import { loadI18nLanguage, setCurrentLanguage } from "../src/lib/i18n.js";
import { txBlockEditorBindings } from "../src/modules/transactionBlockBindingState.js";
import { txBlockTimelineDisplay } from "../src/modules/transactionBlockDisplayState.js";
import { createTxBlockVisualEditorWorkspace } from "../src/modules/transactionBlockDisplays.js";
import {
  txBlockDuplicateStep,
  txBlockMoveStep,
  txBlockSetStepRollbackEnabled,
} from "../src/modules/transactionBlockMutations.js";

function operation(kind, value = "") {
  if (kind === "flow") {
    return {
      kind,
      flow: { steps: [{ command: "show version" }, { command: "show clock" }] },
    };
  }
  if (kind === "template") {
    return { kind, template: { template: { name: value } } };
  }
  return { kind: "command", command: { command: value } };
}

function step(kind, value, rollback = null) {
  return {
    run: operation(kind, value),
    rollback,
    hasRollback: rollback !== null,
    extra: { nested: { value } },
  };
}

function model(steps = []) {
  return {
    name: "deploy edge",
    failFast: true,
    rollbackPolicy: { kind: "per_step" },
    steps,
  };
}

test("step rollback switch creates and clears the compensating operation", () => {
  const source = model([step("command", "configure terminal")]);
  const enabled = txBlockSetStepRollbackEnabled(source, 0, true);

  assert.equal(enabled.steps[0].hasRollback, true);
  assert.equal(enabled.steps[0].rollback.kind, "command");

  enabled.steps[0].rollbackOnFailure = true;
  enabled.steps[0].hasRollbackOnFailure = true;
  const disabled = txBlockSetStepRollbackEnabled(enabled, 0, false);

  assert.equal(disabled.steps[0].hasRollback, true);
  assert.equal(disabled.steps[0].rollback, null);
  assert.equal(disabled.steps[0].rollbackOnFailure, false);
  assert.equal(disabled.steps[0].hasRollbackOnFailure, true);
  assert.equal(source.steps[0].rollback, null);
});

test("duplicates a deeply independent step immediately after its source", () => {
  const source = model([step("command", "one"), step("command", "two")]);
  const duplicate = txBlockDuplicateStep(source, 0);

  assert.deepEqual(
    duplicate.steps.map((item) => item.run.command.command),
    ["one", "one", "two"],
  );
  duplicate.steps[1].run.command.command = "changed";
  duplicate.steps[1].extra.nested.value = "changed";
  assert.equal(duplicate.steps[0].run.command.command, "one");
  assert.equal(duplicate.steps[0].extra.nested.value, "one");
  assert.equal(source.steps.length, 2);
  assert.equal(source.steps[0].run.command.command, "one");
});

test("moves steps immutably and leaves the source model unchanged", () => {
  const source = model([
    step("command", "one"),
    step("command", "two"),
    step("command", "three"),
  ]);
  const moved = txBlockMoveStep(source, 0, 2);

  assert.deepEqual(
    moved.steps.map((item) => item.run.command.command),
    ["two", "three", "one"],
  );
  moved.steps[2].extra.nested.value = "changed";
  assert.equal(source.steps[0].extra.nested.value, "one");
  assert.deepEqual(
    source.steps.map((item) => item.run.command.command),
    ["one", "two", "three"],
  );
});

test("invalid duplicate and move boundaries return independent unchanged clones", () => {
  const source = model([step("command", "one"), step("command", "two")]);
  const invalidResults = [
    txBlockDuplicateStep(source, -1),
    txBlockDuplicateStep(source, 2),
    txBlockDuplicateStep(source, 0.5),
    txBlockMoveStep(source, -1, 0),
    txBlockMoveStep(source, 0, 2),
    txBlockMoveStep(source, 1, 1),
  ];

  for (const result of invalidResults) {
    assert.deepEqual(result, source);
    assert.notEqual(result, source);
    assert.notEqual(result.steps, source.steps);
  }
});

test("editor bindings expose semantic duplicate and move actions", () => {
  const source = model([step("command", "one"), step("command", "two")]);
  const changes = [];
  const bindings = txBlockEditorBindings(source, (next) => changes.push(next));

  assert.equal(bindings.duplicateStep(0), true);
  assert.equal(bindings.moveStep(1, 0), true);
  assert.equal(bindings.moveStep(0, 0), false);
  assert.equal(changes.length, 2);
  assert.equal(changes[0].steps.length, 3);
  assert.deepEqual(
    changes[1].steps.map((item) => item.run.command.command),
    ["two", "one"],
  );
});

test("invalid duplicate bindings do not notify onChange", () => {
  const source = model([step("command", "one")]);
  const changes = [];
  const bindings = txBlockEditorBindings(source, (next) => changes.push(next));

  assert.equal(bindings.duplicateStep(-1), false);
  assert.equal(bindings.duplicateStep(1), false);
  assert.equal(bindings.duplicateStep(0.5), false);
  assert.equal(changes.length, 0);
});

test("timeline rows expose localized operation summaries and movement flags", async () => {
  await loadI18nLanguage("en");
  const display = txBlockTimelineDisplay(
    model([
      step("command", "show interfaces", operation("command", "undo")),
      step("flow"),
      step("template", "saved-template"),
      step("template", ""),
      step("command", ""),
    ]),
  );

  assert.deepEqual(
    display.stepRows.map((row) => ({
      canMoveDown: row.canMoveDown,
      canMoveUp: row.canMoveUp,
      rollbackConfigured: row.rollbackConfigured,
      stepIndex: row.stepIndex,
    })),
    [
      {
        canMoveDown: true,
        canMoveUp: false,
        rollbackConfigured: true,
        stepIndex: 0,
      },
      {
        canMoveDown: true,
        canMoveUp: true,
        rollbackConfigured: false,
        stepIndex: 1,
      },
      {
        canMoveDown: true,
        canMoveUp: true,
        rollbackConfigured: false,
        stepIndex: 2,
      },
      {
        canMoveDown: true,
        canMoveUp: true,
        rollbackConfigured: false,
        stepIndex: 3,
      },
      {
        canMoveDown: false,
        canMoveUp: true,
        rollbackConfigured: false,
        stepIndex: 4,
      },
    ],
  );
  assert.equal(display.stepRows[0].titleText, "Step 1");
  assert.equal(display.stepRows[0].kindText, "Command");
  assert.equal(display.stepRows[0].summaryText, "show interfaces");
  assert.match(display.stepRows[1].summaryText, /Flow steps/);
  assert.match(display.stepRows[1].summaryText, /2/);
  assert.equal(display.stepRows[2].summaryText, "saved-template");
  assert.equal(display.stepRows[3].summaryText, "Unnamed template");
  assert.equal(display.stepRows[4].summaryText, "Empty command");
});

test("workspace selection follows add, duplicate, move, and delete actions", () => {
  const changes = [];
  const source = model([step("command", "one"), step("command", "two")]);
  const workspace = createTxBlockVisualEditorWorkspace({
    model: source,
    onChange: (next) => changes.push(next),
  });

  assert.deepEqual(get(workspace.selectedTargetStateStore), {
    kind: "step",
    stepIndex: 0,
  });
  assert.equal(workspace.addAndSelectStep(), true);
  assert.deepEqual(get(workspace.selectedTargetStateStore), {
    kind: "step",
    stepIndex: 2,
  });
  assert.equal(workspace.duplicateSelectedStep(), true);
  assert.deepEqual(get(workspace.selectedTargetStateStore), {
    kind: "step",
    stepIndex: 3,
  });
  assert.equal(workspace.moveSelectedStep(-1), true);
  assert.deepEqual(get(workspace.selectedTargetStateStore), {
    kind: "step",
    stepIndex: 2,
  });
  assert.equal(workspace.removeSelectedStep(), true);
  assert.deepEqual(get(workspace.selectedTargetStateStore), {
    kind: "step",
    stepIndex: 2,
  });
  assert.equal(changes.length, 4);
  assert.equal(source.steps.length, 2);
});

test("workspace falls back to the previous step and then root after deletion", () => {
  const workspace = createTxBlockVisualEditorWorkspace({
    model: model([step("command", "one"), step("command", "two")]),
  });

  assert.equal(workspace.selectStep(1), true);
  assert.equal(workspace.removeSelectedStep(), true);
  assert.deepEqual(get(workspace.selectedTargetStateStore), {
    kind: "step",
    stepIndex: 0,
  });
  assert.equal(workspace.removeSelectedStep(), true);
  assert.deepEqual(get(workspace.selectedTargetStateStore), {
    kind: "root",
    stepIndex: -1,
  });
});

test("external context replacement normalizes stale and empty selections", () => {
  const workspace = createTxBlockVisualEditorWorkspace({
    model: model([
      step("command", "one"),
      step("command", "two"),
      step("command", "three"),
    ]),
  });
  workspace.selectStep(2);

  workspace.setVisualEditorContext({
    model: model([step("command", "replacement")]),
  });
  assert.deepEqual(get(workspace.selectedTargetStateStore), {
    kind: "step",
    stepIndex: 0,
  });

  workspace.setVisualEditorContext({ model: model([]) });
  assert.deepEqual(get(workspace.selectedTargetStateStore), {
    kind: "root",
    stepIndex: -1,
  });
});

test("rejected workspace actions do not change selection or notify onChange", () => {
  const changes = [];
  const workspace = createTxBlockVisualEditorWorkspace({
    model: model([step("command", "one")]),
    onChange: (next) => changes.push(next),
  });

  assert.equal(workspace.selectStep(4), false);
  assert.equal(workspace.moveSelectedStep(-1), false);
  workspace.selectRoot();
  assert.equal(workspace.duplicateSelectedStep(), false);
  assert.equal(workspace.removeSelectedStep(), false);
  assert.deepEqual(get(workspace.selectedTargetStateStore), {
    kind: "root",
    stepIndex: -1,
  });
  assert.equal(changes.length, 0);
});

test("root selection is exact and selected target state is read-only", () => {
  const workspace = createTxBlockVisualEditorWorkspace({ model: model([]) });

  assert.deepEqual(get(workspace.selectedTargetStateStore), {
    kind: "root",
    stepIndex: -1,
  });
  assert.equal("set" in workspace.selectedTargetStateStore, false);
  assert.equal("update" in workspace.selectedTargetStateStore, false);
});

test("default empty workspace adds and selects its first step", () => {
  const changes = [];
  const workspace = createTxBlockVisualEditorWorkspace({
    onChange: (next) => changes.push(next),
  });

  assert.equal(workspace.addAndSelectStep(), true);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].steps.length, 1);
  assert.deepEqual(get(workspace.selectedTargetStateStore), {
    kind: "step",
    stepIndex: 0,
  });
});

test("timeline selection and localized displays react to language changes", async () => {
  await loadI18nLanguage("en");
  const workspace = createTxBlockVisualEditorWorkspace({
    model: model([step("flow"), step("template", ""), step("command", "")]),
  });

  assert.deepEqual(
    get(workspace.timelineDisplayStateStore).stepRows.map(
      (row) => row.selected,
    ),
    [true, false, false],
  );
  workspace.selectStep(1);
  assert.deepEqual(
    get(workspace.timelineDisplayStateStore).stepRows.map(
      (row) => row.selected,
    ),
    [false, true, false],
  );

  const englishTimeline = get(workspace.timelineDisplayStateStore).stepRows;
  assert.match(englishTimeline[0].summaryText, /Flow steps/);
  assert.equal(englishTimeline[1].summaryText, "Unnamed template");
  assert.equal(englishTimeline[2].summaryText, "Empty command");

  const english = get(workspace.editorSummaryStateStore).cellRows;
  assert.deepEqual(
    english.map((cell) => cell.labelText),
    ["Tx block name", "Rollback Policy", "Step Count", "Fail Fast"],
  );
  assert.deepEqual(
    english.map((cell) => cell.valueText),
    ["deploy edge", "per_step", "3", "Enabled"],
  );

  await loadI18nLanguage("zh");
  const chineseTimeline = get(workspace.timelineDisplayStateStore).stepRows;
  assert.match(chineseTimeline[0].summaryText, /命令流步骤/);
  assert.equal(chineseTimeline[1].summaryText, "未命名模板");
  assert.equal(chineseTimeline[2].summaryText, "空命令");

  const chinese = get(workspace.editorSummaryStateStore).cellRows;
  assert.deepEqual(
    chinese.map((cell) => cell.labelText),
    ["事务块名称", "回滚策略", "步骤数", "失败即停止"],
  );
  assert.deepEqual(
    chinese.map((cell) => cell.valueText),
    ["deploy edge", "per_step", "3", "已启用"],
  );
  setCurrentLanguage("en");
});

test("flow step titles publish language changes to active subscribers", async () => {
  await loadI18nLanguage("zh");
  const workspace = createTxBlockVisualEditorWorkspace({
    model: model([step("flow")]),
  });
  const timelineUpdates = [];
  const unsubscribe = workspace.timelineDisplayStateStore.subscribe((display) =>
    timelineUpdates.push(display.stepRows[0]?.titleText),
  );

  assert.equal(timelineUpdates.at(-1), "步骤 1");
  await loadI18nLanguage("en");
  assert.equal(timelineUpdates.at(-1), "Step 1");
  unsubscribe();
  setCurrentLanguage("en");
});
