import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { get } from "svelte/store";
import { txBlockCommandEditorDisplay } from "../src/modules/transactionBlockDisplayState.js";
import { collapsibleGroupBindings } from "../src/lib/events.js";
import {
  createTxBlockTemplateStepEditorWorkspace,
  createTxBlockTemplateVarEditorWorkspace,
} from "../src/modules/transactionBlockTemplateWorkspaces.js";

function read(path) {
  return readFileSync(path, "utf8");
}

test("template row editors are safe before context and preserve complete rows", () => {
  const variableSource = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateVarEditor.svelte",
  );
  const stepSource = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateStepEditor.svelte",
  );
  assert.match(
    variableSource,
    /let variable = \$derived\(syncedVariableRow\.variable \?\? \{\}\)/,
  );
  assert.match(
    stepSource,
    /let templateStep = \$derived\(syncedTemplateStepRow\.step \?\? \{\}\)/,
  );

  const variable = {
    name: "hostname",
    type: "string",
    extra: { variable_label: "hostname-var" },
  };
  const variableWorkspace = createTxBlockTemplateVarEditorWorkspace();
  variableWorkspace.setTemplateVarContext({
    variableRow: { varIndex: 2, variable },
  });
  assert.deepEqual(get(variableWorkspace.variableRowStateStore), {
    varIndex: 2,
    variable,
  });

  const step = {
    command: "show {{hostname}}",
    mode: "Enable",
    extra: { template_step_label: "verify-step" },
  };
  const stepWorkspace = createTxBlockTemplateStepEditorWorkspace();
  stepWorkspace.setTemplateStepContext({
    templateStepRow: { stepIndex: 3, step },
  });
  assert.deepEqual(get(stepWorkspace.templateStepRowStateStore), {
    stepIndex: 3,
    step,
  });
});

test("operation kinds use a three-column shadcn Tabs control", () => {
  const source = read(
    "frontend/src/pages/orchestrated/TxBlockOperationEditor.svelte",
  );

  assert.match(source, /import \* as Tabs from "\$lib\/components\/ui\/tabs/);
  assert.match(source, /<Tabs\.Root[\s\S]*value=\{operation\.kind\}/);
  assert.match(source, /onValueChange=\{operationActionHandlers\.setKind\}/);
  assert.match(source, /<Tabs\.List[^>]*grid-cols-3/);
  for (const kind of ["command", "flow", "template"]) {
    assert.match(source, new RegExp(`<Tabs\\.Trigger[^>]*value="${kind}"`));
  }
  assert.doesNotMatch(source, /rounded-2xl border border-border bg-muted/);
});

test("command progressive sections use plain collapsible section variants", () => {
  const source = read(
    "frontend/src/pages/orchestrated/TxBlockCommandEditor.svelte",
  );
  const collapsibleSource = read(
    "frontend/src/components/fragments/CollapsibleGroup.svelte",
  );

  assert.match(collapsibleSource, /variant = "card"/);
  assert.match(collapsibleSource, /variant === "section"/);
  assert.match(collapsibleSource, /<section/);
  assert.match(collapsibleSource, /border-b/);
  assert.match(source, /CollapsibleGroup/);
  assert.equal((source.match(/variant="section"/g) || []).length, 2);
  assert.match(source, /`tx-block-command-\$\{pathPrefix/);
  assert.match(source, /commandScopeKey\("dynamic"\)/);
  assert.match(source, /commandScopeKey\("interaction"\)/);
});

test("nested operation editors are unframed and use repeated row separators", () => {
  const unframedPaths = [
    "frontend/src/pages/orchestrated/TxBlockCommandDynParamsEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockCommandInteractionEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockTemplateRuntimeVarsEditor.svelte",
  ];

  for (const path of unframedPaths) {
    const source = read(path);
    assert.doesNotMatch(source, /ui\/card/);
    assert.doesNotMatch(source, /<Card\./);
    assert.doesNotMatch(source, /rounded-2xl/);
  }

  for (const path of [
    "frontend/src/pages/orchestrated/TxBlockFlowEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockTemplateEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockRollbackPolicyEditor.svelte",
  ]) {
    assert.doesNotMatch(read(path), /<Card\./);
  }

  assert.match(
    read("frontend/src/pages/orchestrated/TxBlockFlowEditor.svelte"),
    /rounded-lg/,
  );
  assert.equal(
    (
      read(
        "frontend/src/pages/orchestrated/TxBlockTemplateEditor.svelte",
      ).match(/variant="section"/g) || []
    ).length,
    4,
  );
});

test("transaction dynamic params use only the generic parameter editor", () => {
  const editor = read(
    "frontend/src/pages/orchestrated/TxBlockCommandDynParamsEditor.svelte",
  );
  const bindings = read("frontend/src/modules/transactionBlockBindingState.js");
  const displayState = read(
    "frontend/src/modules/transactionBlockDisplayState.js",
  );
  const mutations = read("frontend/src/modules/transactionBlockMutations.js");

  assert.doesNotMatch(editor, /fieldEnablePassword|fieldSudoPassword/);
  assert.doesNotMatch(editor, /specialFieldValueHandler/);
  assert.doesNotMatch(bindings, /specialFieldValueHandler/);
  assert.doesNotMatch(bindings, /setSpecialField/);
  assert.doesNotMatch(displayState, /dynParamEnablePassword/);
  assert.doesNotMatch(displayState, /dynParamSudoPassword/);
  assert.doesNotMatch(displayState, /TX_COMMAND_DYN_PARAM_RESERVED_KEYS/);
  assert.doesNotMatch(mutations, /TX_COMMAND_DYN_PARAM_ENABLE_PASSWORD_KEYS/);
  assert.doesNotMatch(mutations, /TX_COMMAND_DYN_PARAM_SUDO_PASSWORD_KEYS/);
});

test("legacy password dynamic params remain editable as generic rows", () => {
  const display = txBlockCommandEditorDisplay(
    {
      dynParams: {
        EnablePassword: "enable-secret",
        SudoPassword: "legacy-sudo-secret",
      },
    },
    {},
  );

  assert.deepEqual(
    display.dynParamExtraRows.map((row) => row.keyText),
    ["EnablePassword", "SudoPassword"],
  );
});

test("validation errors derive from the model and render inline alerts", () => {
  const displaysSource = read(
    "frontend/src/modules/transactionBlockDisplays.js",
  );
  const displayStateSource = read(
    "frontend/src/modules/transactionBlockDisplayState.js",
  );
  const fieldGridSource = read(
    "frontend/src/components/fragments/PresenceFieldGrid.svelte",
  );

  assert.match(displaysSource, /validateTxBlockFormModel/);
  assert.match(displaysSource, /validationErrorsStateStore/);
  assert.match(displayStateSource, /txBlockValidationErrorText/);
  assert.match(fieldGridSource, /fieldRow\.errorText/);
  assert.match(fieldGridSource, /role="alert"/);
  assert.match(fieldGridSource, /text-destructive/);
  assert.match(fieldGridSource, /aria-invalid/);
  assert.match(fieldGridSource, /use:invalidFieldControl/);
  assert.match(fieldGridSource, /setAttribute\("aria-invalid", "true"\)/);
  assert.match(fieldGridSource, /removeAttribute\("aria-invalid"\)/);

  for (const path of [
    "frontend/src/pages/orchestrated/TxBlockRootInspector.svelte",
    "frontend/src/pages/orchestrated/TxBlockStepEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockOperationEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockCommandEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockFlowEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockTemplateEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockRollbackPolicyEditor.svelte",
  ]) {
    const source = read(path);
    assert.match(source, /validationErrors/);
    assert.match(source, /pathPrefix/);
  }
});

test("field row validation matches only the exact form-model path", async () => {
  const { txBlockFieldRowsWithValidation } =
    await import("../src/modules/transactionBlockDisplayState.js");
  const fieldRows = [
    { fieldKey: "name", labelText: "Name" },
    { fieldKey: "mode", labelText: "Mode" },
  ];
  const errors = [
    {
      path: "steps[0].run.template.template.vars[2].name",
      messageKey: "txBlockValidationVariableName",
    },
  ];

  const rows = txBlockFieldRowsWithValidation(
    fieldRows,
    errors,
    "steps[0].run.template.template.vars[2]",
  );

  assert.equal(rows[0].errorText.length > 0, true);
  assert.equal(rows[1].errorText, "");
  assert.equal(
    txBlockFieldRowsWithValidation(
      fieldRows,
      errors,
      "steps[0].run.template.template.vars[20]",
    )[0].errorText,
    "",
  );
});

test("template validation paths thread through indexed child editors", () => {
  const template = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateEditor.svelte",
  );
  const vars = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateVarsEditor.svelte",
  );
  const variable = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateVarEditor.svelte",
  );
  const steps = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateStepsEditor.svelte",
  );
  const step = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateStepEditor.svelte",
  );
  const prompt = read(
    "frontend/src/pages/orchestrated/TxBlockTemplatePromptEditor.svelte",
  );
  const runtime = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateRuntimeEditor.svelte",
  );

  for (const source of [
    template,
    vars,
    variable,
    steps,
    step,
    prompt,
    runtime,
  ]) {
    assert.match(source, /validationErrors/);
    assert.match(source, /pathPrefix/);
  }
  assert.match(template, /pathPrefix=\{`\$\{pathPrefix\}\.template`\}/);
  assert.match(template, /pathPrefix=\{`\$\{pathPrefix\}\.template\.vars`\}/);
  assert.match(template, /pathPrefix=\{`\$\{pathPrefix\}\.template\.steps`\}/);
  assert.match(template, /pathPrefix=\{`\$\{pathPrefix\}\.runtime`\}/);
  assert.match(template, /<TxBlockTemplateRuntimeEditor/);
  assert.doesNotMatch(template, /templateDisplay\.runtime\.present/);
  assert.match(
    vars,
    /pathPrefix=\{`\$\{pathPrefix\}\[\$\{variableRow\.varIndex\}\]`\}/,
  );
  assert.match(
    steps,
    /pathPrefix=\{`\$\{pathPrefix\}\[\$\{templateStepRow\.stepIndex\}\]`\}/,
  );
  assert.match(
    step,
    /pathPrefix=\{`\$\{pathPrefix\}\.prompts\[\$\{promptRow\.promptIndex\}\]`\}/,
  );
  assert.match(prompt, /pathPrefix=\{`\$\{pathPrefix\}\.patterns`\}/);
});

test("template owning controls receive exact validation rows and alerts", () => {
  const definition = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateDefinitionEditor.svelte",
  );
  const variable = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateVarEditor.svelte",
  );
  const step = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateStepEditor.svelte",
  );
  const patterns = read(
    "frontend/src/pages/orchestrated/TxBlockTemplatePromptPatternsEditor.svelte",
  );
  const runtimeVars = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateRuntimeVarsEditor.svelte",
  );

  for (const source of [definition, variable, step]) {
    assert.match(source, /txBlockFieldRowsWithValidation/);
    assert.match(source, /fieldRows=\{validated/);
  }
  for (const source of [patterns, runtimeVars]) {
    assert.match(source, /txBlockValidationErrorText/);
    assert.match(source, /role="alert"/);
    assert.match(source, /text-destructive/);
  }
  assert.match(runtimeVars, /`\$\{pathPrefix\}\.vars`/);
  assert.match(patterns, /use:invalidPatternControl/);
  assert.match(patterns, /setAttribute\("aria-invalid", "true"\)/);
  assert.doesNotMatch(patterns, /role="group"/);
});

test("root inspector owns the empty steps validation alert", () => {
  const source = read(
    "frontend/src/pages/orchestrated/TxBlockRootInspector.svelte",
  );

  assert.match(source, /txBlockValidationErrorText/);
  assert.match(source, /pathPrefix \? `\$\{pathPrefix\}\.steps` : "steps"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /text-destructive/);
});

test("template surfaces flatten definition and retain approved repeated rows", () => {
  const definition = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateDefinitionEditor.svelte",
  );
  assert.doesNotMatch(definition, /rounded-(?:xl|lg)[^\n]*border/);
  assert.doesNotMatch(definition, /(?:slate|gray)-/);

  for (const path of [
    "frontend/src/pages/orchestrated/TxBlockTemplateVarEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockTemplateStepEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockTemplatePromptEditor.svelte",
  ]) {
    const source = read(path);
    assert.match(source, /rounded-lg/);
    assert.match(source, /border-border/);
    assert.match(source, /bg-muted\/20/);
    assert.doesNotMatch(source, /(?:slate|gray)-/);
  }
});

test("collapsible persistence reads each active key without initialization writes", () => {
  const reads = [];
  const writes = [];
  const preferences = new Map([
    ["alpha", true],
    ["beta", false],
  ]);
  const bindings = collapsibleGroupBindings({
    onReadCollapsedPreference(key) {
      reads.push(key);
      return preferences.get(key);
    },
    onWriteCollapsedPreference(key, value) {
      writes.push([key, value]);
    },
  });

  assert.equal(bindings.initialState("alpha").collapsed, true);
  assert.equal(bindings.initialState("beta").collapsed, false);
  assert.equal(bindings.initialState("alpha").collapsed, true);
  assert.deepEqual(reads, ["alpha", "beta", "alpha"]);
  assert.deepEqual(writes, []);
});

test("collapsible group reapplies persistence and links its disclosure control", () => {
  const source = read(
    "frontend/src/components/fragments/CollapsibleGroup.svelte",
  );

  assert.match(source, /label = ""/);
  assert.match(source, /appliedPersistenceKey/);
  assert.doesNotMatch(source, /collapsedPreferenceApplied/);
  assert.match(source, /appliedPersistenceKey === nextPersistenceKey/);
  assert.match(source, /bindings\.initialState\(nextPersistenceKey\)/);
  assert.match(source, /collapsibleBodyId\(persistenceKey\)/);
  assert.equal((source.match(/aria-controls=\{bodyId\}/g) || []).length, 2);
  assert.equal(
    (source.match(/aria-label=\{buttonAriaLabel\}/g) || []).length,
    2,
  );
  assert.equal((source.match(/id=\{bodyId\}/g) || []).length, 2);
});

test("Task 5 collapsibles and operation tabs have localized accessible labels", () => {
  const command = read(
    "frontend/src/pages/orchestrated/TxBlockCommandEditor.svelte",
  );
  const template = read(
    "frontend/src/pages/orchestrated/TxBlockTemplateEditor.svelte",
  );
  const operation = read(
    "frontend/src/pages/orchestrated/TxBlockOperationEditor.svelte",
  );

  for (const labelKey of ["txBlockFormDynParams", "txBlockFormInteraction"]) {
    assert.match(command, new RegExp(`label=\\{t\\("${labelKey}"\\)\\}`));
  }
  for (const labelKey of [
    "txBlockFormTemplateDefinition",
    "txBlockFormTemplateVars",
    "txBlockFormTemplateSteps",
    "txBlockFormTemplateRuntime",
  ]) {
    assert.match(template, new RegExp(`label=\\{t\\("${labelKey}"\\)\\}`));
  }
  assert.match(operation, /<Tabs\.List[^>]*aria-label=\{title\}/);
});

test("root rollback path conditionally joins a nonempty prefix", () => {
  const source = read(
    "frontend/src/pages/orchestrated/TxBlockRootInspector.svelte",
  );

  assert.match(
    source,
    /pathPrefix=\{`\$\{pathPrefix \? `\$\{pathPrefix\}\.` : ""\}rollbackPolicy\.wholeResource`\}/,
  );
  assert.doesNotMatch(
    source,
    /pathPrefix=\{`\$\{pathPrefix\}rollbackPolicy\.wholeResource`\}/,
  );
});
