import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applySavedConnectionEditorDraftFromFormState,
  applyTemporaryConnectionDraftFromFormState,
  savedConnectionEditorDraftDefaults,
  temporaryConnectionDraftDefaults,
} from "../src/domains/connections/application/connectionFieldState.js";
import {
  detectedConnectionFactsPatch,
  savedConnectionEditorDetectionPayload,
  savedConnectionEditorTestPayload,
} from "../src/domains/connections/application/connectionEditorState.js";

test("saved connection draft carries optional device facts", () => {
  const draft = savedConnectionEditorDraftDefaults();
  applySavedConnectionEditorDraftFromFormState(draft, {
    device_model: "C9300-48P",
    software_version: "17.9.5",
  });

  assert.equal(draft.deviceModel, "C9300-48P");
  assert.equal(draft.softwareVersion, "17.9.5");
});

test("temporary connection draft carries optional device facts", () => {
  const draft = temporaryConnectionDraftDefaults();
  applyTemporaryConnectionDraftFromFormState(draft, {
    device_model: "CE6857-48S6CQ",
    software_version: "V300R023C10SPC500",
  });

  assert.equal(draft.deviceModel, "CE6857-48S6CQ");
  assert.equal(draft.softwareVersion, "V300R023C10SPC500");
  assert.equal(draft.deviceProfile, "autodetect");
});

test("detected facts only replace draft fields when values are non-empty", () => {
  assert.deepEqual(
    detectedConnectionFactsPatch({
      device_profile: "cisco_ios",
      device_model: "",
      software_version: null,
    }),
    { deviceProfile: "cisco_ios" },
  );
  assert.deepEqual(
    detectedConnectionFactsPatch({
      device_profile: "juniper_junos",
      device_model: "MX204",
      software_version: "23.4R1-S2.1",
    }),
    {
      deviceModel: "MX204",
      deviceProfile: "juniper_junos",
      softwareVersion: "23.4R1-S2.1",
    },
  );
});

test("saved connection payload includes model and software version", () => {
  const source = readFileSync(
    "frontend/src/domains/connections/application/connectionEditorState.ts",
    "utf8",
  );

  assert.match(source, /device_model:/);
  assert.match(source, /software_version:/);
  assert.match(source, /connectionApi\.detectFacts/);
});

test("saved connection detection uses the current draft without saved fallback", () => {
  const payload = savedConnectionEditorDetectionPayload({
    connectTimeoutSecs: "30",
    credentialId: "credential-new",
    deviceModel: "",
    deviceProfile: "cisco_ios",
    enabled: true,
    host: "192.0.2.10",
    linuxShellFlavor: "",
    outputEncoding: "gbk",
    name: "edge-1",
    port: "22",
    softwareVersion: "",
    sshSecurity: "",
  });

  assert.equal(payload.connection_name, null);
  assert.equal(payload.credential_id, "credential-new");
  assert.equal(payload.device_profile, "autodetect");
  assert.equal(payload.host, "192.0.2.10");
  assert.equal(payload.output_encoding, "gbk");
});

test("saved connection test uses the current draft without saved fallback", () => {
  const payload = savedConnectionEditorTestPayload({
    connectTimeoutSecs: "15",
    credentialId: "credential-current",
    deviceModel: "C9300-48P",
    deviceProfile: "cisco_ios",
    enabled: true,
    host: "198.51.100.25",
    linuxShellFlavor: "",
    outputEncoding: "gb18030",
    name: "edge-1",
    port: "2222",
    softwareVersion: "17.9.5",
    sshSecurity: "balanced",
  });

  assert.equal(payload.connection_name, null);
  assert.equal(payload.credential_id, "credential-current");
  assert.equal(payload.host, "198.51.100.25");
  assert.equal(payload.port, 2222);
  assert.equal(payload.device_profile, "cisco_ios");
  assert.equal(payload.output_encoding, "gb18030");
});

test("temporary connection detection uses current form and persists detected facts", () => {
  const source = readFileSync(
    "frontend/src/domains/connections/application/connectionTargetRuntimeState.ts",
    "utf8",
  );

  assert.match(source, /export async function detectTemporaryConnectionFacts/);
  assert.match(source, /payload\.connection_name = null/);
  assert.match(source, /payload\.device_profile = "autodetect"/);
  assert.match(source, /device_model:/);
  assert.match(source, /software_version:/);
});

test("saved connection editor exposes editable model and version fields", () => {
  const source = readFileSync(
    "frontend/src/domains/connections/presentation/components/SavedConnectionEditorForm.svelte",
    "utf8",
  );

  assert.match(source, /editorDraft\.deviceModel/);
  assert.match(source, /onValueInput=\{onSavedEditorDeviceModelInput\}/);
  assert.match(source, /editorDraft\.softwareVersion/);
  assert.match(source, /onValueInput=\{onSavedEditorSoftwareVersionInput\}/);
});

test("temporary connection panel exposes autodetect and editable device facts", () => {
  const source = readFileSync(
    "frontend/src/domains/connections/presentation/components/TemporaryConnectionPanel.svelte",
    "utf8",
  );

  assert.match(source, /onclick=\{detectProfile\}/);
  assert.match(source, /detectProfileLoading/);
  assert.match(source, /temporaryDraft\.deviceModel/);
  assert.match(source, /onValueInput=\{onTemporaryDeviceModelInput\}/);
  assert.match(source, /temporaryDraft\.softwareVersion/);
  assert.match(source, /onValueInput=\{onTemporarySoftwareVersionInput\}/);
  assert.match(source, /<ConnectionDetectedFacts/);
});

test("temporary autodetect does not render a separate status prompt", () => {
  const source = readFileSync(
    "frontend/src/domains/connections/application/connectionPanelFormState.ts",
    "utf8",
  );

  assert.doesNotMatch(source, /temporaryAutodetectStatusStateStore/);
  assert.match(
    source,
    /temporaryConnectionPanelPresentation\(\s*\$connectionTestStatusStateStore,/,
  );
});

test("saved and temporary connection editors share detected facts presentation", () => {
  const savedSource = readFileSync(
    "frontend/src/domains/connections/presentation/components/SavedConnectionEditorForm.svelte",
    "utf8",
  );
  const temporarySource = readFileSync(
    "frontend/src/domains/connections/presentation/components/TemporaryConnectionPanel.svelte",
    "utf8",
  );
  const factsSource = readFileSync(
    "frontend/src/domains/connections/presentation/components/fields/ConnectionDetectedFacts.svelte",
    "utf8",
  );

  assert.match(savedSource, /<ConnectionDetectedFacts/);
  assert.match(temporarySource, /<ConnectionDetectedFacts/);
  assert.match(factsSource, /aria-live="polite"/);
});
