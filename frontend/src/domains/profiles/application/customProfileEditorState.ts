import { currentLanguageState, t } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import { derived, get as getStore, writable } from "svelte/store";
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
} from "./profileListState.js";
import {
  applyCustomProfileForm,
  collectCustomProfileForm,
} from "./customProfileFormState.js";
import { profileEditorRuntime } from "../infrastructure/profileEditorRuntime.js";
import {
  builtinProfileFormValue,
  customCommandExecutionModeFormPatch,
  customShellExitMarkerFormPatch,
  emptyProfileForm,
  normalizeCustomProfileBaseForm,
  refreshCustomProfileOptionsState,
} from "../model/customProfileForm.js";
import type {
  CustomProfileBaseForm,
  CustomProfileDetail,
  CustomProfileForm,
  CustomProfileStatusState,
  UnknownRecord,
} from "../model/types.js";
import {
  customProfileNameRequiredError,
  customProfileRunningText,
  customProfileSettingsDisplay,
} from "../presentation/customProfilePresentation.js";

type ReloadHandler = (() => unknown | Promise<unknown>) | null;

let customProfilesReloadHandler: ReloadHandler = null;
let cachedCustomProfileNames: string[] = [];

export const customProfileBaseState = writable({
  commandExecution: {
    marker: "",
    mode: "prompt_driven",
  },
  name: "",
});

export const customProfileOptionsState = writable({
  names: [] as string[],
  selected: "",
});

export const customProfileStatusState = writable<CustomProfileStatusState>({
  message: "",
  tone: "info",
});

export function setCustomProfilesReloadHandler(handler: unknown = null): void {
  customProfilesReloadHandler =
    typeof handler === "function" ? (handler as ReloadHandler) : null;
}

export function setCustomProfileNames(names: unknown = []): void {
  cachedCustomProfileNames = Array.isArray(names)
    ? names.map((name) => safeString(name)).filter(Boolean)
    : [];
}

async function reloadCustomProfilesIfNeeded(): Promise<void> {
  await customProfilesReloadHandler?.();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : safeString(error);
}

function setCustomProfileStatus(message = "-", tone = "info"): void {
  customProfileStatusState.set(
    profileEditorRuntime.publishStatus(message, tone),
  );
}

function setCustomProfileOptions(names: unknown = [], selected = ""): void {
  customProfileOptionsState.set(
    refreshCustomProfileOptionsState(names, selected),
  );
}

function readCustomProfileBaseForm(): CustomProfileBaseForm {
  const normalized = normalizeCustomProfileBaseForm(
    getStore(customProfileBaseState),
  );
  customProfileBaseState.set(normalized);
  return normalized;
}

function setCustomProfileBaseForm(
  formPatch: unknown = {},
): CustomProfileBaseForm {
  const next = normalizeCustomProfileBaseForm(formPatch);
  customProfileBaseState.set(next);
  return next;
}

function updateCustomProfileBaseForm(
  formPatch: UnknownRecord = {},
): CustomProfileBaseForm {
  return setCustomProfileBaseForm({
    ...readCustomProfileBaseForm(),
    ...formPatch,
  });
}

function applySavedCustomProfile(
  savedProfilePayload: CustomProfileDetail,
  profile: CustomProfileForm,
  profileName: string,
): string {
  const savedName = safeString(savedProfilePayload.name || profileName);
  setCustomProfileBaseForm({
    commandExecution: profile.command_execution,
    name: savedName,
  });
  setCustomProfileStatus(`${t("saved")}: ${savedName}`, "success");
  return savedName;
}

async function loadCustomProfile(): Promise<void> {
  const name = readCustomProfileBaseForm().name;
  if (!name) {
    setCustomProfileStatus(customProfileNameRequiredError(), "error");
    return;
  }
  setCustomProfileStatus(customProfileRunningText(), "running");
  try {
    const customProfilePayload =
      await profileEditorRuntime.getCustomProfileForm(name);
    setProfileForm(customProfilePayload);
    setCustomProfileStatus(`${t("loaded")}: ${name}`, "success");
  } catch (error) {
    setCustomProfileStatus(errorMessage(error), "error");
  }
}

export function refreshCustomProfileOptions(): void {
  const selected = readCustomProfileBaseForm().name;
  setCustomProfileOptions(cachedCustomProfileNames, selected);
}

export function setProfileForm(profile: CustomProfileForm): void {
  applyCustomProfileForm(profile, setCustomProfileBaseForm);
}

export async function loadSelectedCustomProfile(
  profileName = "",
): Promise<void> {
  const selected = safeString(profileName).trim();
  updateCustomProfileBaseForm({ name: selected });
  if (!selected) return;
  await loadCustomProfile();
}

export async function saveCustomProfile(): Promise<void> {
  setCustomProfileStatus(customProfileRunningText(), "running");
  try {
    const profile = collectCustomProfileForm(readCustomProfileBaseForm());
    const name = safeString(profile.name).trim();
    if (!name) {
      setCustomProfileStatus(customProfileNameRequiredError(), "error");
      return;
    }
    const savedProfilePayload =
      await profileEditorRuntime.saveCustomProfileForm(name, profile);
    applySavedCustomProfile(savedProfilePayload, profile, name);
    await reloadCustomProfilesIfNeeded();
  } catch (error) {
    setCustomProfileStatus(errorMessage(error), "error");
  }
}

export async function createCustomProfileDraft(): Promise<string | undefined> {
  const name = profileEditorRuntime.promptForResourceName(
    t("profileNewPrompt"),
  );
  if (!name) return;
  setCustomProfileStatus(customProfileRunningText(), "running");
  try {
    const profile = collectCustomProfileForm(readCustomProfileBaseForm());
    profile.name = name;
    const savedProfilePayload =
      await profileEditorRuntime.saveCustomProfileForm(name, profile);
    const savedName = applySavedCustomProfile(
      savedProfilePayload,
      profile,
      name,
    );
    await reloadCustomProfilesIfNeeded();
    if (readCustomProfileBaseForm().name) await loadCustomProfile();
    return savedName;
  } catch (error) {
    setCustomProfileStatus(errorMessage(error), "error");
  }
}

export async function deleteCustomProfile(): Promise<void> {
  const name = readCustomProfileBaseForm().name;
  if (!name) {
    setCustomProfileStatus(customProfileNameRequiredError(), "error");
    return;
  }
  setCustomProfileStatus(customProfileRunningText(), "running");
  try {
    await profileEditorRuntime.deleteCustomProfile(name);
    setProfileForm(emptyProfileForm());
    setCustomProfileStatus(`${t("deleted")}: ${name}`, "success");
    await reloadCustomProfilesIfNeeded();
  } catch (error) {
    setCustomProfileStatus(errorMessage(error), "error");
  }
}

export function updateCustomCommandExecutionMode(
  commandExecutionMode = "",
): void {
  const current = readCustomProfileBaseForm();
  updateCustomProfileBaseForm(
    customCommandExecutionModeFormPatch(
      commandExecutionMode,
      current.commandExecution,
    ),
  );
}

export function updateCustomShellExitMarker(shellExitMarker = ""): void {
  updateCustomProfileBaseForm(customShellExitMarkerFormPatch(shellExitMarker));
}

export function createCustomProfilesEditorWorkspace() {
  const settingsDisplayStateStore = derived(
    [customProfileBaseState, customProfileOptionsState, currentLanguageState],
    ([$customProfileBaseState, $customProfileOptionsState]) =>
      customProfileSettingsDisplay(
        $customProfileBaseState,
        $customProfileOptionsState,
      ),
  );
  const profileListSectionDisplaysStateStore = derived(
    currentLanguageState,
    () => customProfileListSectionDisplays(),
  );
  const profileHookSectionDisplaysStateStore = derived(
    [hookListRowsState, hookModeOptionsVersion, currentLanguageState],
    ([$hookListRowsState]) =>
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
