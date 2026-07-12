import assert from "node:assert/strict";
import test from "node:test";
import { loadI18nLanguage } from "../src/lib/i18n.js";

import {
  connectionBasicFieldWiring,
  connectionBasicFieldsPresentation,
  connectionTimeoutSecsValue,
  savedConnectionEditorDraftDefaults,
  temporaryConnectionDraftDefaults,
} from "../src/modules/connectionFieldState.js";

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
