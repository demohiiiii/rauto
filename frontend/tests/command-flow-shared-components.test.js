import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

const sharedComponentPaths = [
  "frontend/src/components/command-flow/CommandEditor.svelte",
  "frontend/src/components/command-flow/CommandFlowAuthoringViews.svelte",
  "frontend/src/components/command-flow/CommandMultilineModeField.svelte",
  "frontend/src/components/command-flow/CommandTextAreaField.svelte",
  "frontend/src/components/command-flow/CommandTemplateSourceField.svelte",
  "frontend/src/components/command-flow/CommandFlowRuntimeFields.svelte",
  "frontend/src/components/command-flow/CommandFlowReadonlyView.svelte",
  "frontend/src/components/command-flow/CommandFlowSettings.svelte",
  "frontend/src/components/command-flow/CommandFlowStepsEditor.svelte",
  "frontend/src/components/command-flow/CommandFlowSurface.svelte",
  "frontend/src/components/command-flow/CommandFlowTemplateSource.svelte",
  "frontend/src/components/command-flow/CommandFlowTemplateEditor.svelte",
  "frontend/src/components/command-flow/CommandFlowTemplateStepEditor.svelte",
  "frontend/src/components/command-flow/CommandFlowTemplatePromptEditor.svelte",
];

test("command flow components are controlled and feature agnostic", () => {
  for (const path of sharedComponentPaths) {
    const component = read(path);
    assert.match(component, /\$props\(\)/, path);
    assert.doesNotMatch(
      component,
      /modules\/(standard|transaction|orchestration)/,
      path,
    );
    assert.doesNotMatch(component, /from ["']svelte\/store["']/, path);
    assert.doesNotMatch(component, /writable\(/, path);
    assert.doesNotMatch(component, /bg-(slate|gray|zinc)-/, path);
    assert.doesNotMatch(component, /text-(slate|gray|zinc)-/, path);
  }
});

test("shared command flow surfaces keep defaults and expose opt-in workbench layouts", () => {
  const surface = read(
    "frontend/src/components/command-flow/CommandFlowSurface.svelte",
  );
  const templateSource = read(
    "frontend/src/components/command-flow/CommandFlowTemplateSource.svelte",
  );
  const templateEditor = read(
    "frontend/src/components/command-flow/CommandFlowTemplateEditor.svelte",
  );

  assert.match(surface, /variant = "section"/);
  assert.match(surface, /variant === "workbench-header"/);
  assert.match(surface, /variant === "workbench-section"/);
  assert.match(surface, /indexText/);
  assert.match(templateSource, /variant=\{surfaceVariant\}/);
  assert.match(templateEditor, /surfaceVariant = "section"/);
  assert.match(templateEditor, /settingsIndexText/);
  assert.match(templateEditor, /stepsIndexText/);
});

test("shared command flow barrel exports every surface", () => {
  const index = read("frontend/src/components/command-flow/index.js");

  for (const componentName of [
    "CommandEditor",
    "CommandFlowAuthoringViews",
    "CommandFlowRuntimeFields",
    "CommandMultilineModeField",
    "CommandTextAreaField",
    "CommandTemplateSourceField",
    "CommandFlowReadonlyView",
    "CommandFlowSettings",
    "CommandFlowStepsEditor",
    "CommandFlowSurface",
    "CommandFlowTemplateSource",
    "CommandFlowTemplateEditor",
    "CommandFlowTemplateStepEditor",
    "CommandFlowTemplatePromptEditor",
  ]) {
    assert.match(
      index,
      new RegExp(`export \\{ default as ${componentName} \\}`),
    );
  }
});

test("runtime fields default to inferred controls and expose explicit orchestration json", () => {
  const component = read(
    "frontend/src/components/command-flow/CommandFlowRuntimeFields.svelte",
  );
  const standard = read(
    "frontend/src/pages/standard/FlowExecutionPanel.svelte",
  );
  const orchestration = read(
    "frontend/src/pages/orchestrated/OrchestrationTxBlockFlowSourceEditor.svelte",
  );

  assert.match(component, /fieldRows/);
  assert.match(component, /controlKind === "options-select"/);
  assert.match(component, /controlKind === "boolean-select"/);
  assert.match(component, /controlKind === "json-editor"/);
  assert.match(component, /onFieldValueChange/);
  assert.match(component, /showJsonOverrides = false/);
  assert.match(component, /type=\{fieldRow\.inputType\}/);
  assert.doesNotMatch(standard, /onJsonOverridesChange/);
  assert.match(orchestration, /showJsonOverrides=\{true\}/);
});

test("flow steps use parent-owned rows and actions", () => {
  const component = read(
    "frontend/src/components/command-flow/CommandFlowStepsEditor.svelte",
  );

  assert.match(component, /stepRows/);
  assert.match(component, /onAddStep/);
  assert.match(component, /onRemoveStep/);
  assert.match(component, /renderStep/);
  assert.match(component, /aria-label/);
  assert.match(component, /min-h-11 min-w-11/);
  assert.match(component, /addStepPlacement = "header"/);
  assert.match(component, /addStepPlacement === "footer"/);
});

test("command flow item accents provide six distinct cycling colors", async () => {
  const { commandFlowAccentColor } =
    await import("../src/modules/commandFlowAccentState.js");
  const colors = Array.from({ length: 6 }, (_, itemIndex) =>
    commandFlowAccentColor(itemIndex),
  );

  assert.equal(new Set(colors).size, 6);
  assert.equal(commandFlowAccentColor(6), colors[0]);
  assert.equal(commandFlowAccentColor(-1), colors[5]);
});

test("command flow steps and prompts bind deterministic indexed accents", () => {
  const stepsEditor = read(
    "frontend/src/components/command-flow/CommandFlowStepsEditor.svelte",
  );
  const templateEditor = read(
    "frontend/src/components/command-flow/CommandFlowTemplateEditor.svelte",
  );
  const stepEditor = read(
    "frontend/src/components/command-flow/CommandFlowTemplateStepEditor.svelte",
  );
  const promptEditor = read(
    "frontend/src/components/command-flow/CommandFlowTemplatePromptEditor.svelte",
  );

  assert.match(stepsEditor, /commandFlowAccentColor\(stepPosition\)/);
  assert.match(stepsEditor, /style:--command-flow-accent=\{accentColor\}/);
  assert.match(stepsEditor, /accentIndex: stepPosition/);
  assert.match(templateEditor, /accentIndex=\{stepRow\.accentIndex\}/);
  assert.match(stepEditor, /accentIndex \* 2 \+ promptIndex \+ 1/);
  assert.match(promptEditor, /style:--command-flow-accent=\{accentColor\}/);
  assert.match(promptEditor, /data-command-flow-prompt/);
});

test("standard command flow execution composes shared surfaces", () => {
  const panel = read("frontend/src/pages/standard/FlowExecutionPanel.svelte");

  assert.match(panel, /CommandFlowSurface/);
  assert.match(panel, /CommandFlowTemplateSource/);
  assert.match(panel, /CommandFlowRuntimeFields/);
  assert.match(panel, /CommandFlowAuthoringViews/);
  assert.doesNotMatch(panel, /CommandFlowTemplateEditor/);
  assert.doesNotMatch(panel, /FlowVarsInputPanel/);
});

test("inline transaction flows compose the same editor as standard flows", () => {
  const editor = read(
    "frontend/src/pages/orchestrated/TxBlockFlowEditor.svelte",
  );
  const standard = read(
    "frontend/src/pages/standard/FlowExecutionPanel.svelte",
  );
  const authoringViews = read(
    "frontend/src/components/command-flow/CommandFlowAuthoringViews.svelte",
  );

  assert.match(editor, /CommandFlowTemplateEditor/);
  assert.match(standard, /CommandFlowAuthoringViews/);
  assert.match(authoringViews, /CommandFlowTemplateEditor/);
  assert.match(editor, /renderSettings/);
  assert.match(editor, /renderStepContent/);
  assert.match(editor, /showDefaultSettings=\{false\}/);
  assert.match(editor, /createStep=\{txBlockCommandDraft\}/);
  assert.match(
    editor,
    /flowStepRow\.onChange\(\{ \.\.\.flowStepRow\.flowStep, \.\.\.patch \}\)/,
  );
  assert.doesNotMatch(editor, /JsonObjectFieldsEditor/);
  assert.doesNotMatch(editor, /txBlockFlowMetadataFieldDefs/);
});

test("orchestration transaction flows compose shared source and runtime fields", () => {
  const editor = read(
    "frontend/src/pages/orchestrated/OrchestrationTxBlockFlowSourceEditor.svelte",
  );

  assert.match(editor, /CommandFlowTemplateSource/);
  assert.match(editor, /CommandFlowRuntimeFields/);
});

test("shared command flow template editor exposes only executable fields", () => {
  const editor = read(
    "frontend/src/components/command-flow/CommandFlowTemplateEditor.svelte",
  );
  const stepEditor = read(
    "frontend/src/components/command-flow/CommandFlowTemplateStepEditor.svelte",
  );
  const promptEditor = read(
    "frontend/src/components/command-flow/CommandFlowTemplatePromptEditor.svelte",
  );

  assert.match(editor, /CommandFlowSettings/);
  assert.match(editor, /CommandFlowStepsEditor/);
  assert.match(editor, /addStepPlacement = "header"/);
  for (const field of ["name", "stopOnError", "defaultMode"]) {
    assert.match(editor, new RegExp(field));
  }
  assert.doesNotMatch(editor, /hasDescription|model\.description/);
  assert.doesNotMatch(editor, /currentConnectionAlias/);
  for (const field of ["command", "mode", "timeoutSecs", "prompts"]) {
    assert.match(stepEditor, new RegExp(field));
  }
  assert.match(stepEditor, /CommandEditor/);
  assert.match(stepEditor, /multilineMode/);
  for (const field of [
    "patterns",
    "response",
    "appendNewline",
    "recordInput",
  ]) {
    assert.match(promptEditor, new RegExp(field));
  }
  assert.doesNotMatch(editor, /template\.vars|\[\[vars\]\]/);
});

test("shared template editor can hide its name field", () => {
  const editor = read(
    "frontend/src/components/command-flow/CommandFlowTemplateEditor.svelte",
  );

  assert.match(editor, /showNameField = true/);
  assert.match(editor, /\{#if showNameField\}/);
  assert.match(editor, /model\.name/);
});

test("all command surfaces compose one shared command editor", () => {
  const shared = read(
    "frontend/src/components/command-flow/CommandEditor.svelte",
  );
  const standard = read(
    "frontend/src/pages/standard/CommandExecutionPanel.svelte",
  );
  const transaction = read(
    "frontend/src/pages/orchestrated/TxBlockCommandEditor.svelte",
  );
  const flowStep = read(
    "frontend/src/components/command-flow/CommandFlowTemplateStepEditor.svelte",
  );

  assert.match(shared, /CommandTextAreaField/);
  assert.match(shared, /CommandMultilineModeField/);
  for (const surface of [standard, transaction, flowStep]) {
    assert.match(surface, /CommandEditor/);
    assert.doesNotMatch(surface, /CommandTextAreaField/);
    assert.doesNotMatch(surface, /CommandMultilineModeField/);
  }
});

test("standard and transaction commands share the template source field", () => {
  const standard = read(
    "frontend/src/pages/standard/CommandExecutionPanel.svelte",
  );
  const transaction = read(
    "frontend/src/pages/orchestrated/TxBlockCommandEditor.svelte",
  );

  assert.match(standard, /CommandTemplateSourceField/);
  assert.match(transaction, /CommandTemplateSourceField/);
  assert.match(transaction, /selectCommandTemplate/);
  assert.doesNotMatch(transaction, /template_name|templateName/);
});
