import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import { loadI18nLanguage } from "../src/lib/i18n.js";

import {
  connectionBasicFieldWiring,
  connectionBasicFieldsPresentation,
  connectionTimeoutSecsValue,
  savedConnectionEditorDraftDefaults,
  temporaryConnectionDraftDefaults,
} from "../src/modules/connections/connectionFieldState.js";
import {
  CONNECTION_PICKER,
  CONNECTION_VARS,
  connectionPickerChoices,
  connectionVarsState,
  getConnectionVarsValue,
  setConnectionInventorySnapshots,
  setConnectionPickerSavedConnections,
  setConnectionVarRowValue,
  setConnectionVarsValue,
} from "../src/modules/connections/connectionFieldStoreState.js";

test("connection timeout defaults remain blank and display the 60 second fallback", async () => {
  await loadI18nLanguage("en");
  assert.equal(savedConnectionEditorDraftDefaults().connectTimeoutSecs, "");
  assert.equal(temporaryConnectionDraftDefaults().connectTimeoutSecs, "");

  const display = connectionBasicFieldsPresentation({
    fieldValues: { connectTimeoutSecs: "23" },
  });
  assert.equal(display.values.connectTimeoutSecs, "23");
  assert.match(display.connectTimeoutSecsInput.placeholder, /60/);
});

test("connection timeout converts blank and positive integer values", () => {
  assert.equal(connectionTimeoutSecsValue(""), null);
  assert.equal(connectionTimeoutSecsValue("  "), null);
  assert.equal(connectionTimeoutSecsValue("23"), 23);
  assert.throws(() => connectionTimeoutSecsValue("0"));
  assert.throws(() => connectionTimeoutSecsValue("1.5"));
  assert.throws(() => connectionTimeoutSecsValue("invalid"));
});

test("connection timeout input updates the shared draft", () => {
  const draft = savedConnectionEditorDraftDefaults();
  const wiring = connectionBasicFieldWiring(draft, (target, patch) =>
    Object.assign(target, patch),
  );
  wiring.onConnectTimeoutSecsInput("41");
  assert.equal(draft.connectTimeoutSecs, "41");
});

test("connection picker configs preserve resource kinds and custom rules", () => {
  setConnectionInventorySnapshots({
    groups: [{ name: "production" }],
    labels: [{ name: "edge" }],
  });
  setConnectionPickerSavedConnections([{ name: "router-01" }]);

  assert.equal(
    connectionPickerChoices(CONNECTION_PICKER.savedGroups).kind,
    "groups",
  );
  assert.equal(
    connectionPickerChoices(CONNECTION_PICKER.savedLabels).kind,
    "labels",
  );
  assert.equal(
    connectionPickerChoices(CONNECTION_PICKER.batchShowTargets).kind,
    "devices",
  );
  assert.equal(
    connectionPickerChoices(CONNECTION_PICKER.orchestrationTargetTags, {
      query: "new-label",
    }).canAddCustom,
    false,
  );
});

test("connection vars publish one synchronized row and object state", () => {
  setConnectionVarsValue(CONNECTION_VARS.savedEdit, { attempts: 2 });
  const initialState = get(connectionVarsState(CONNECTION_VARS.savedEdit));
  const [attemptsRow] = initialState.connectionVarRows;

  setConnectionVarRowValue(CONNECTION_VARS.savedEdit, attemptsRow.id, "3");
  const nextState = get(connectionVarsState(CONNECTION_VARS.savedEdit));

  assert.equal(nextState.version, initialState.version + 1);
  assert.equal(nextState.connectionVarRows[0].value, "3");
  assert.deepEqual(getConnectionVarsValue(CONNECTION_VARS.savedEdit), {
    attempts: 3,
  });
});
