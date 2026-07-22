import {
  deleteCustomProfile as deleteCustomProfileRequest,
  getCustomProfileForm,
  saveCustomProfileForm,
} from "../../api/client.js";
import {
  promptForResourceName as promptForResourceNameValue,
  safeString,
  statusPresentation,
} from "../../lib/ui.js";
import { currentLanguageState, t } from "../../lib/i18n.js";
import { derived, get as getStore, writable } from "svelte/store";
import { showToast } from "../overlays/overlays.js";
import {
  addHookListFlowStep,
  addHookListRow,
  addProfileListItem,
  addProfileListPattern,
  changeHookListKind,
  customProfileHookSectionDisplays,
  customProfileListSectionDisplays,
  hookListRowsState,
  hookModeOptionsVersion,
  patchHookListCommand,
  patchHookListFlow,
  patchHookListFlowStep,
  patchHookListRow,
  patchProfileListRow,
  profileListRowsState,
  removeHookListFlowStep,
  removeHookListRow,
  removeProfileListPattern,
  removeProfileListRow,
  setProfileListPattern,
  setProfileListPatternState,
  setProfileListSimpleValue,
} from "./profilesListState.js";
import {
  applyCustomProfileForm,
  builtinProfileFormValue,
  collectCustomProfileForm,
  customCommandExecutionModeFormPatch,
  customProfileNameRequiredError,
  customProfileRunningText,
  customProfileSettingsDisplay,
  customShellExitMarkerFormPatch,
  emptyProfileForm,
  normalizeCustomProfileBaseForm,
  refreshCustomProfileOptionsState,
} from "./profilesCustomFormState.js";

let customProfilesReloadHandler = null;
let cachedCustomProfileNames = [];

export const customProfileBaseState = writable({
  commandExecution: {
    marker: "",
    mode: "prompt_driven",
  },
  name: "",
});

export const customProfileOptionsState = writable({
  names: [],
  selected: "",
});

export const customProfileStatusState = writable({
  message: "",
  tone: "info",
});

export function setCustomProfilesReloadHandler(handler = null) {
  customProfilesReloadHandler = typeof handler === "function" ? handler : null;
}

export function setCustomProfileNames(names = []) {
  cachedCustomProfileNames = Array.isArray(names) ? names.filter(Boolean) : [];
}

async function reloadCustomProfilesIfNeeded() {
  if (typeof customProfilesReloadHandler !== "function") {
    return;
  }
  await customProfilesReloadHandler();
}

function setCustomProfileStatus(message = "-", tone = "info") {
  const presentation = statusPresentation(message, tone);
  customProfileStatusState.set({
    message: presentation.inlineMessage,
    tone: presentation.tone,
  });
  if (presentation.shouldToast) {
    showToast(presentation.text, presentation.tone);
  }
}

function setCustomProfileOptions(names = [], selected = "") {
  customProfileOptionsState.set(
    refreshCustomProfileOptionsState(names, selected),
  );
}

function readCustomProfileBaseForm() {
  const normalized = normalizeCustomProfileBaseForm(
    getStore(customProfileBaseState),
  );
  customProfileBaseState.set(normalized);
  return normalized;
}

function setCustomProfileBaseForm(formPatch = {}) {
  const next = normalizeCustomProfileBaseForm(formPatch);
  customProfileBaseState.set(next);
  return next;
}

function updateCustomProfileBaseForm(formPatch = {}) {
  return setCustomProfileBaseForm({
    ...readCustomProfileBaseForm(),
    ...formPatch,
  });
}

function applySavedCustomProfile(savedProfilePayload, profile, profileName) {
  const savedName = savedProfilePayload.name || profileName;
  setCustomProfileBaseForm({
    commandExecution: profile.command_execution,
    name: savedName,
  });
  setCustomProfileStatus(`${t("saved")}: ${savedName}`, "success");
  return savedName;
}

async function loadCustomProfile() {
  const name = readCustomProfileBaseForm().name;
  if (!name) {
    setCustomProfileStatus(customProfileNameRequiredError(), "error");
    return;
  }
  setCustomProfileStatus(customProfileRunningText(), "running");
  try {
    const customProfilePayload = await getCustomProfileForm(name);
    setProfileForm(customProfilePayload);
    setCustomProfileStatus(`${t("loaded")}: ${name}`, "success");
  } catch (error) {
    setCustomProfileStatus(error.message, "error");
  }
}

export function refreshCustomProfileOptions() {
  const selected = readCustomProfileBaseForm().name;
  setCustomProfileOptions(cachedCustomProfileNames, selected);
}

export function setProfileForm(profile) {
  applyCustomProfileForm(profile, setCustomProfileBaseForm);
}

export async function loadSelectedCustomProfile(profileName = "") {
  const selected = safeString(profileName || "").trim();
  updateCustomProfileBaseForm({ name: selected });
  if (!selected) {
    return;
  }
  await loadCustomProfile();
}

export async function saveCustomProfile() {
  setCustomProfileStatus(customProfileRunningText(), "running");
  try {
    const profile = collectCustomProfileForm(readCustomProfileBaseForm());
    const name = (profile.name || "").trim();
    if (!name) {
      setCustomProfileStatus(customProfileNameRequiredError(), "error");
      return;
    }
    const savedProfilePayload = await saveCustomProfileForm(name, profile);
    applySavedCustomProfile(savedProfilePayload, profile, name);
    await reloadCustomProfilesIfNeeded();
  } catch (error) {
    setCustomProfileStatus(error.message, "error");
  }
}

export async function createCustomProfileDraft() {
  const name = promptForResourceNameValue(t("profileNewPrompt"));
  if (!name) return;
  setCustomProfileStatus(customProfileRunningText(), "running");
  try {
    const profile = collectCustomProfileForm(readCustomProfileBaseForm());
    profile.name = name;
    const savedProfilePayload = await saveCustomProfileForm(name, profile);
    const savedName = applySavedCustomProfile(
      savedProfilePayload,
      profile,
      name,
    );
    await reloadCustomProfilesIfNeeded();
    if (readCustomProfileBaseForm().name) {
      await loadCustomProfile();
    }
    return savedName;
  } catch (error) {
    setCustomProfileStatus(error.message, "error");
  }
}

export async function deleteCustomProfile() {
  const name = readCustomProfileBaseForm().name;
  if (!name) {
    setCustomProfileStatus(customProfileNameRequiredError(), "error");
    return;
  }
  setCustomProfileStatus(customProfileRunningText(), "running");
  try {
    await deleteCustomProfileRequest(name);
    setProfileForm(emptyProfileForm());
    setCustomProfileStatus(`${t("deleted")}: ${name}`, "success");
    await reloadCustomProfilesIfNeeded();
  } catch (error) {
    setCustomProfileStatus(error.message, "error");
  }
}

export function updateCustomCommandExecutionMode(commandExecutionMode = "") {
  const current = readCustomProfileBaseForm();
  updateCustomProfileBaseForm(
    customCommandExecutionModeFormPatch(
      commandExecutionMode,
      current.commandExecution,
    ),
  );
}

export function updateCustomShellExitMarker(shellExitMarker = "") {
  updateCustomProfileBaseForm(customShellExitMarkerFormPatch(shellExitMarker));
}

export function createCustomProfilesEditorWorkspace() {
  const settingsDisplayStateStore = derived(
    [customProfileBaseState, customProfileOptionsState, currentLanguageState],
    ([
      $customProfileBaseState,
      $customProfileOptionsState,
      _currentLanguageState,
    ]) =>
      customProfileSettingsDisplay(
        $customProfileBaseState,
        $customProfileOptionsState,
      ),
  );
  const profileListSectionDisplaysStateStore = derived(
    [currentLanguageState],
    ([_currentLanguageState]) => customProfileListSectionDisplays(),
  );
  const profileHookSectionDisplaysStateStore = derived(
    [hookListRowsState, hookModeOptionsVersion, currentLanguageState],
    ([$hookListRowsState, _hookModeOptionsVersion, _currentLanguageState]) =>
      customProfileHookSectionDisplays($hookListRowsState),
  );

  return {
    addFlowStep: addHookListFlowStep,
    addHookRow: addHookListRow,
    addListItem: addProfileListItem,
    addPattern: addProfileListPattern,
    baseStateStore: customProfileBaseState,
    changeHookKind: changeHookListKind,
    createDraft: createCustomProfileDraft,
    deleteProfile: deleteCustomProfile,
    hookModeVersionState: hookModeOptionsVersion,
    hookRowsStateStore: hookListRowsState,
    loadProfile: loadSelectedCustomProfile,
    optionsStateStore: customProfileOptionsState,
    patchCommand: patchHookListCommand,
    patchFlow: patchHookListFlow,
    patchFlowStep: patchHookListFlowStep,
    patchHookRow: patchHookListRow,
    patchListRow: patchProfileListRow,
    profileHookSectionDisplaysStateStore,
    profileListRowsStateStore: profileListRowsState,
    profileListSectionDisplaysStateStore,
    removeFlowStep: removeHookListFlowStep,
    removeHookRow: removeHookListRow,
    removePattern: removeProfileListPattern,
    removeRow: removeProfileListRow,
    saveProfile: saveCustomProfile,
    setPatternState: setProfileListPatternState,
    setPatternValue: setProfileListPattern,
    setSimpleValue: setProfileListSimpleValue,
    settingsDisplayStateStore,
    updateCommandExecutionMode: updateCustomCommandExecutionMode,
    updateShellExitMarker: updateCustomShellExitMarker,
  };
}

export {
  addHookListFlowStep,
  addHookListRow,
  addProfileListItem,
  addProfileListPattern,
  builtinProfileFormValue,
  changeHookListKind,
  customProfileHookSectionDisplays,
  customProfileListSectionDisplays,
  customProfileSettingsDisplay,
  emptyProfileForm,
  hookListRowsState,
  hookModeOptionsVersion,
  patchHookListCommand,
  patchHookListFlow,
  patchHookListFlowStep,
  patchHookListRow,
  patchProfileListRow,
  profileListRowsState,
  removeHookListFlowStep,
  removeHookListRow,
  removeProfileListPattern,
  removeProfileListRow,
  setProfileListPattern,
  setProfileListPatternState,
  setProfileListSimpleValue,
};
