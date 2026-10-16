import assert from "node:assert/strict";
import test from "node:test";
import { loadI18nLanguage } from "../src/lib/i18n.js";
import { temporaryConnectionDraftDefaults } from "../src/domains/connections/application/connectionFieldState.js";
import { connectionSession } from "../src/domains/connections/application/connectionSessionState.js";
import {
  applyTemporaryConnection,
  connectionPayload,
  temporaryConnectionBasicFieldWiring,
} from "../src/domains/connections/application/connectionTargetRuntimeState.js";
import {
  setCurrentConnectionTarget,
  setSavedConnectionSelectValue,
} from "../src/domains/connections/application/connectionTargetStoreState.js";

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

  assert.deepEqual(connectionPayload(), {
    connection_name: "saved-edge",
    keep_alive: { enabled: true, interval_secs: 30 },
  });
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
  assert.deepEqual(payload.keep_alive, { enabled: true, interval_secs: 30 });

  applyTemporaryConnection();
  const reappliedPayload = connectionPayload();
  assert.equal(reappliedPayload.host, "198.51.100.40");
  assert.equal(reappliedPayload.credential_id, "unapplied-credential");
  assert.equal(reappliedPayload.port, 22);
  assert.equal(reappliedPayload.output_encoding, "utf8");
});

test("execution still uses the selected target with keepalive disabled", async () => {
  await loadI18nLanguage("en");
  await connectionSession.setKeepAlive(false);
  try {
    setCurrentConnectionTarget({
      kind: "saved",
      name: "saved-edge",
      host: "192.0.2.10",
      profile: "linux",
    });
    assert.deepEqual(connectionPayload(), {
      connection_name: "saved-edge",
      keep_alive: { enabled: false, interval_secs: 30 },
    });

    const draft = temporaryConnectionDraftDefaults();
    const wiring = temporaryConnectionBasicFieldWiring(draft);
    wiring.onHostInput("192.0.2.30");
    wiring.onCredentialChange("temporary-credential");
    applyTemporaryConnection();
    const payload = connectionPayload();
    assert.equal(payload.connection_name, null);
    assert.equal(payload.host, "192.0.2.30");
    assert.equal(payload.credential_id, "temporary-credential");
    assert.deepEqual(payload.keep_alive, {
      enabled: false,
      interval_secs: 30,
    });
  } finally {
    await connectionSession.setKeepAlive(true);
  }
});
