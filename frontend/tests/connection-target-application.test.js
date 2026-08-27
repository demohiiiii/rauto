import assert from "node:assert/strict";
import test from "node:test";
import { loadI18nLanguage } from "../src/lib/i18n.js";
import { temporaryConnectionDraftDefaults } from "../src/modules/connections/connectionFieldState.js";
import {
  applyTemporaryConnection,
  connectionPayload,
  temporaryConnectionBasicFieldWiring,
} from "../src/modules/connections/connectionTargetRuntimeState.js";
import {
  setCurrentConnectionTarget,
  setSavedConnectionSelectValue,
} from "../src/modules/connections/connectionTargetStoreState.js";

test("saved execution ignores unapplied temporary draft changes", async () => {
  await loadI18nLanguage("en");
  setSavedConnectionSelectValue("saved-edge");
  setCurrentConnectionTarget({
    kind: "saved",
    name: "saved-edge",
    host: "192.0.2.10",
    profile: "cisco_ios",
  });

  const draft = temporaryConnectionDraftDefaults();
  const wiring = temporaryConnectionBasicFieldWiring(draft);
  wiring.onHostInput("198.51.100.20");
  wiring.onCredentialChange("temporary-credential");
  wiring.onDeviceProfileChange("juniper_junos");
  setSavedConnectionSelectValue("another-unapplied-selection");

  assert.deepEqual(connectionPayload(), { connection_name: "saved-edge" });
});

test("temporary execution uses the last explicitly applied draft", async () => {
  await loadI18nLanguage("en");
  setCurrentConnectionTarget(null);
  setSavedConnectionSelectValue("");

  const draft = temporaryConnectionDraftDefaults();
  const wiring = temporaryConnectionBasicFieldWiring(draft);
  wiring.onHostInput("192.0.2.30");
  wiring.onCredentialChange("temporary-credential");
  wiring.onPortInput("2222");
  wiring.onOutputEncodingChange("gbk");
  applyTemporaryConnection();

  wiring.onHostInput("198.51.100.40");
  wiring.onCredentialChange("unapplied-credential");
  wiring.onPortInput("22");
  wiring.onOutputEncodingChange("utf8");

  const payload = connectionPayload();
  assert.equal(payload.connection_name, null);
  assert.equal(payload.host, "192.0.2.30");
  assert.equal(payload.credential_id, "temporary-credential");
  assert.equal(payload.port, 2222);
  assert.equal(payload.output_encoding, "gbk");

  applyTemporaryConnection();
  const reappliedPayload = connectionPayload();
  assert.equal(reappliedPayload.host, "198.51.100.40");
  assert.equal(reappliedPayload.credential_id, "unapplied-credential");
  assert.equal(reappliedPayload.port, 22);
  assert.equal(reappliedPayload.output_encoding, "utf8");
});
