import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { get } from "svelte/store";
import { txBlockCommandEditorDisplay } from "../src/modules/transactions/transactionBlockDisplayState.js";
import { collapsibleGroupBindings } from "../src/lib/events.js";
import {
  createTxBlockCommandDynParamsEditorWorkspace,
  createTxBlockCommandInteractionEditorWorkspace,
} from "../src/modules/transactions/transactionBlockDisplays.js";

function read(path) {
  return readFileSync(path, "utf8");
}

test("operation kinds expose only command and flow tabs", () => {
  const source = read(
    "frontend/src/pages/orchestrated/TxBlockOperationEditor.svelte",
  );

  assert.match(source, /import \* as Tabs from "\$lib\/components\/ui\/tabs/);
  assert.match(source, /<Tabs\.Root[\s\S]*value=\{operation\.kind\}/);
  assert.match(source, /onValueChange=\{operationActionHandlers\.setKind\}/);
  assert.match(source, /<Tabs\.List[^>]*grid-cols-2/);
  for (const kind of ["command", "flow"]) {
    assert.match(source, new RegExp(`<Tabs\\.Trigger[^>]*value="${kind}"`));
  }
  assert.doesNotMatch(source, /value="template"/);
  assert.doesNotMatch(source, /TxBlockTemplateEditor/);
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
  assert.match(source, /CommandEditor/);
  assert.match(source, /command\.multilineMode/);
});

test("nested operation editors are unframed and use repeated row separators", () => {
  const unframedPaths = [
    "frontend/src/pages/orchestrated/TxBlockCommandDynParamsEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockCommandInteractionEditor.svelte",
  ];

  for (const path of unframedPaths) {
    const source = read(path);
    assert.doesNotMatch(source, /ui\/card/);
    assert.doesNotMatch(source, /<Card\./);
    assert.doesNotMatch(source, /rounded-2xl/);
  }

  for (const path of [
    "frontend/src/pages/orchestrated/TxBlockFlowEditor.svelte",
    "frontend/src/pages/orchestrated/TxBlockRollbackPolicyEditor.svelte",
  ]) {
    assert.doesNotMatch(read(path), /<Card\./);
  }

  assert.match(
    read("frontend/src/components/command-flow/CommandFlowStepsEditor.svelte"),
    /rounded-lg/,
  );
});

test("transaction dynamic params use only the generic parameter editor", () => {
  const editor = read(
    "frontend/src/pages/orchestrated/TxBlockCommandDynParamsEditor.svelte",
  );
  const bindings = read(
    "frontend/src/modules/transactions/transactionBlockBindingState.js",
  );
  const displayState = read(
    "frontend/src/modules/transactions/transactionBlockDisplayState.js",
  );
  const mutations = read(
    "frontend/src/modules/transactions/transactionBlockMutations.js",
  );

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

test("command child workspaces preserve their public display and binding contracts", () => {
  const interaction = createTxBlockCommandInteractionEditorWorkspace();
  interaction.setInteractionEditorContext({
    command: {
      interaction: {
        prompts: [{ patterns: ["Password:"], response: "secret" }],
      },
    },
    onChange: () => {},
  });
  assert.equal(
    get(interaction.interactionDisplayStateStore).promptRows.length,
    1,
  );
  assert.equal(
    typeof get(
      interaction.interactionActionHandlersStateStore,
    ).promptActionHandlers(0).deletePromptAction,
    "function",
  );

  const dynParams = createTxBlockCommandDynParamsEditorWorkspace();
  dynParams.setDynParamsContext({
    command: { hasDynParams: true },
    commandDisplay: { dynParamExtraRows: [{ keyText: "Token" }] },
    onChange: () => {},
  });
  assert.equal(
    get(dynParams.dynParamsDisplayStateStore).dynParamsPresent,
    true,
  );
  assert.deepEqual(
    get(dynParams.dynParamsDisplayStateStore).dynParamExtraRows,
    [{ keyText: "Token" }],
  );
});

test("validation errors derive from the model and render inline alerts", () => {
  const displaysSource = read(
    "frontend/src/modules/transactions/transactionBlockDisplays.js",
  );
  const displayStateSource = read(
    "frontend/src/modules/transactions/transactionBlockDisplayState.js",
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
    "frontend/src/pages/orchestrated/TxBlockRollbackPolicyEditor.svelte",
  ]) {
    const source = read(path);
    assert.match(source, /validationErrors/);
    assert.match(source, /pathPrefix/);
  }
});

test("field row validation matches only the exact form-model path", async () => {
  const { txBlockFieldRowsWithValidation } =
    await import("../src/modules/transactions/transactionBlockDisplayState.js");
  const fieldRows = [
    { fieldKey: "command", labelText: "Command" },
    { fieldKey: "mode", labelText: "Mode" },
  ];
  const errors = [
    {
      path: "steps[0].run.flow.steps[2].command",
      messageKey: "txBlockValidationCommandText",
    },
  ];

  const rows = txBlockFieldRowsWithValidation(
    fieldRows,
    errors,
    "steps[0].run.flow.steps[2]",
  );

  assert.equal(rows[0].errorText.length > 0, true);
  assert.equal(rows[1].errorText, "");
  assert.equal(
    txBlockFieldRowsWithValidation(
      fieldRows,
      errors,
      "steps[0].run.flow.steps[20]",
    )[0].errorText,
    "",
  );
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

test("shared command flow surfaces use the transaction visual language", () => {
  const editor = read(
    "frontend/src/components/command-flow/CommandFlowTemplateEditor.svelte",
  );
  const steps = read(
    "frontend/src/components/command-flow/CommandFlowStepsEditor.svelte",
  );

  assert.match(editor, /CommandFlowSettings/);
  assert.match(editor, /CommandFlowStepsEditor/);
  assert.match(steps, /rounded-lg/);
  assert.match(steps, /border-border/);
  assert.match(steps, /bg-muted\/30/);
  assert.doesNotMatch(editor, /(?:slate|gray)-/);
  assert.doesNotMatch(steps, /(?:slate|gray)-/);
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
  const operation = read(
    "frontend/src/pages/orchestrated/TxBlockOperationEditor.svelte",
  );

  for (const labelKey of ["txBlockFormDynParams", "txBlockFormInteraction"]) {
    assert.match(command, new RegExp(`label=\\{t\\("${labelKey}"\\)\\}`));
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
