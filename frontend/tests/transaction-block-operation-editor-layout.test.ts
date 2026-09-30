import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";

import {
  createTxBlockCommandDynParamsEditorWorkspace,
  txBlockCommandDraft,
  txBlockCommandEditorDisplay,
  txBlockFieldRowsWithValidation,
} from "../src/domains/transactions/index.js";
import { collapsibleGroupBindings } from "../src/lib/events.js";

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

test("dynamic parameter workspace preserves its display and binding contracts", () => {
  const dynParams = createTxBlockCommandDynParamsEditorWorkspace();
  dynParams.setDynParamsContext({
    command: { ...txBlockCommandDraft(), hasDynParams: true },
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

test("field validation matches only the exact form-model path", () => {
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

test("collapsible persistence reads active keys without initialization writes", () => {
  const reads: string[] = [];
  const writes: Array<[string, boolean]> = [];
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
