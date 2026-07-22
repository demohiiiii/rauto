import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  normalizePromptMode,
  PROMPT_MODE,
  promptModeTabs,
} from "../src/config/dashboardModes.js";
import {
  builtinProfilesPanelDisplay,
  promptModePresentation,
} from "../src/modules/profiles/promptProfileState.js";

test("profile management keeps one profile mode and normalizes legacy modes", () => {
  assert.deepEqual(
    promptModeTabs.map((tab) => tab.value),
    [PROMPT_MODE.builtin],
  );
  assert.equal(normalizePromptMode(PROMPT_MODE.edit), PROMPT_MODE.builtin);
  assert.equal(normalizePromptMode(PROMPT_MODE.diagnose), PROMPT_MODE.builtin);
  assert.deepEqual(promptModePresentation(PROMPT_MODE.diagnose), {
    builtinActive: true,
    diagnoseActive: false,
    editActive: false,
    profilesActive: true,
  });
});

test("profile page renders built-in and custom resources in one catalog", () => {
  const pageSource = readFileSync(
    "frontend/src/pages/PromptsPage.svelte",
    "utf8",
  );
  const editorSource = readFileSync(
    "frontend/src/pages/prompts/CustomProfilesEditorPanel.svelte",
    "utf8",
  );

  assert.match(pageSource, /key: `builtin:\$\{row\.name\}`/);
  assert.match(pageSource, /key: `custom:\$\{name\}`/);
  assert.match(pageSource, /profileTypeBuiltin/);
  assert.match(pageSource, /profileTypeCustom/);
  assert.match(pageSource, /createCustomProfileDraft/);
  assert.match(pageSource, /onclick=\{createCustomProfile\}/);
  assert.match(pageSource, /catalogCollapsed = \$state\(false\)/);
  assert.match(pageSource, /lg:sticky lg:top-\[-1\.5rem\]/);
  assert.match(pageSource, /lg:max-h-\[calc\(100dvh-5rem\)\]/);
  assert.match(pageSource, /lg:min-h-0 lg:flex-1/);
  assert.match(pageSource, /lg:grid-cols-\[4rem_minmax\(0,1fr\)\]/);
  assert.match(pageSource, /onclick=\{toggleProfileCatalog\}/);
  assert.match(pageSource, /showProfilePicker=\{false\}/);
  assert.match(pageSource, /<Dialog\.Root/);
  assert.match(pageSource, /<ProfileDiagnosePanel embedded/);
  assert.match(pageSource, /setProfileDiagnoseSelected\(selectedProfileName\)/);
  assert.doesNotMatch(pageSource, /Tabs\.Root/);
  assert.doesNotMatch(pageSource, /pageDisplay\.editActive/);
  assert.match(editorSource, /showProfilePicker = true/);
  assert.match(editorSource, /onProfileIdentityChange/);
});

test("built-in details use the same sectioned form surface as custom profiles", () => {
  const builtInDetailsSource = readFileSync(
    "frontend/src/pages/prompts/BuiltinProfileDetailsPanel.svelte",
    "utf8",
  );
  const builtInOverviewSource = readFileSync(
    "frontend/src/pages/prompts/BuiltinProfileOverviewSection.svelte",
    "utf8",
  );
  const builtInDetectSource = readFileSync(
    "frontend/src/pages/prompts/BuiltinProfileDetectSection.svelte",
    "utf8",
  );
  const customEditorSource = readFileSync(
    "frontend/src/pages/prompts/CustomProfilesEditorPanel.svelte",
    "utf8",
  );

  for (const source of [
    builtInDetailsSource,
    builtInOverviewSource,
    builtInDetectSource,
    customEditorSource,
  ]) {
    assert.match(
      source,
      /overflow-hidden rounded-lg border border-border bg-card\/50/,
    );
  }
  assert.match(builtInDetailsSource, /configurationTitle/);
  assert.match(builtInOverviewSource, /commandExecutionTitle/);
  assert.match(builtInDetectSource, /detectDescription/);
  assert.equal(
    builtinProfilesPanelDisplay({ statusState: { message: "-" } }).status.show,
    false,
  );
});

test("profile hook forms provide a two-mode command flow workspace", () => {
  const hookEditorSource = readFileSync(
    "frontend/src/pages/prompts/ProfileHookRowEditor.svelte",
    "utf8",
  );
  const builtInHooksSource = readFileSync(
    "frontend/src/pages/prompts/BuiltinProfileHooksSection.svelte",
    "utf8",
  );
  const interactionEditorSource = readFileSync(
    "frontend/src/pages/prompts/ProfileHookInteractionEditor.svelte",
    "utf8",
  );

  assert.match(hookEditorSource, /<ToggleGroup\.Root/);
  assert.match(hookEditorSource, /value="command"/);
  assert.match(hookEditorSource, /value="flow"/);
  assert.match(hookEditorSource, /flowStopOnErrorChangeHandler/);
  assert.match(hookEditorSource, /flowMaxStepsChangeHandler/);
  assert.match(hookEditorSource, /flowStepCommandChangeHandler/);
  assert.match(hookEditorSource, /commandInteractionChangeHandler/);
  assert.match(hookEditorSource, /flowStepInteractionChangeHandler/);
  assert.match(hookEditorSource, /ProfileHookInteractionEditor/);
  assert.match(interactionEditorSource, /record_input/);
  assert.match(interactionEditorSource, /patterns/);
  assert.match(interactionEditorSource, /response/);
  assert.doesNotMatch(hookEditorSource, /unsupported/i);
  assert.match(builtInHooksSource, /flowStopOnError/);
  assert.match(builtInHooksSource, /flowMaxSteps/);
  assert.match(builtInHooksSource, /readonlyHookStep/);
  assert.match(builtInHooksSource, /readonlyHookInteraction/);
});
