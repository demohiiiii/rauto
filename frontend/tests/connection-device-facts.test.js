import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applySavedConnectionEditorDraftFromFormState,
  savedConnectionEditorDraftDefaults,
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
