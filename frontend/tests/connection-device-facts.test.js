import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applySavedConnectionEditorDraftFromFormState,
  applyTemporaryConnectionDraftFromFormState,
  savedConnectionEditorDraftDefaults,
  temporaryConnectionDraftDefaults,
} from "../src/modules/connections/connectionFieldState.js";
import { detectedConnectionFactsPatch } from "../src/modules/connections/connectionsEditor.js";

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
    "frontend/src/modules/connections/connectionsEditor.js",
    "utf8",
  );

  assert.match(source, /device_model:/);
  assert.match(source, /software_version:/);
  assert.match(source, /detectConnectionFacts/);
});

test("temporary connection detection uses current form and persists detected facts", () => {
  const source = readFileSync(
    "frontend/src/modules/connections/connectionTargetRuntimeState.js",
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
    "frontend/src/components/connections/SavedConnectionEditorForm.svelte",
    "utf8",
  );

  assert.match(source, /editorDraft\.deviceModel/);
  assert.match(source, /onValueInput=\{onSavedEditorDeviceModelInput\}/);
  assert.match(source, /editorDraft\.softwareVersion/);
  assert.match(source, /onValueInput=\{onSavedEditorSoftwareVersionInput\}/);
});

test("temporary connection panel exposes autodetect and editable device facts", () => {
  const source = readFileSync(
    "frontend/src/components/connections/TemporaryConnectionPanel.svelte",
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
    "frontend/src/modules/connections/connectionPanelFormState.js",
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
    "frontend/src/components/connections/SavedConnectionEditorForm.svelte",
    "utf8",
  );
  const temporarySource = readFileSync(
    "frontend/src/components/connections/TemporaryConnectionPanel.svelte",
    "utf8",
  );
  const factsSource = readFileSync(
    "frontend/src/components/connections/ConnectionDetectedFacts.svelte",
    "utf8",
  );

  assert.match(savedSource, /<ConnectionDetectedFacts/);
  assert.match(temporarySource, /<ConnectionDetectedFacts/);
  assert.match(factsSource, /aria-live="polite"/);
});
