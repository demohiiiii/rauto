import {
  getBuiltinProfileDetail,
  getBuiltinProfileForm,
  getDeviceProfilesOverview,
} from "../../api/client.js";
import {
  getCachedDeviceProfiles,
  setCachedDeviceProfiles,
} from "../templates/templatesShowObjects.js";
import { safeString, statusPresentation } from "../../lib/ui.js";
import { currentLanguageState, t, tr } from "../../lib/i18n.js";
import { showToast } from "../overlays/overlays.js";
import {
  addProfileDetectInitialRule,
  addProfileDetectProbe,
  addProfileDetectProbeErrorPattern,
  addProfileDetectProbeRule,
  createCustomProfileDetectPanelWorkspace,
  createProfileDiagnosePanelWorkspace,
  createProfileDiagnoseState,
  customProfileDetectPanelDisplay,
  diagnoseSelectedCustomProfile,
  ensureProfileDetectDefaults,
  patchProfileDetectInitialRule,
  patchProfileDetectProbe,
  patchProfileDetectProbeRule,
  profileDiagnoseDisplay,
  profileDiagnoseOptionsState,
  profileDiagnosePanelDisplay,
  profileDetectFormStateStore,
  removeProfileDetectInitialRule,
  removeProfileDetectProbe,
  removeProfileDetectProbeErrorPattern,
  removeProfileDetectProbeRule,
  setProfileDetectEnabled,
  setProfileDetectProbeErrorPattern,
  setProfileDiagnoseSelected,
} from "./profilesDiagnostics.js";
import { refreshConnectionProfileOptions } from "../connections/connections.js";
import {
  defaultPromptMode,
  normalizePromptMode,
  PROMPT_MODE,
} from "../../config/dashboardModes.js";
import { derived, get as getStore, writable } from "svelte/store";
import { builtinProfileReadonlyDisplay as builtinProfileReadonlyDisplayFromEditor } from "./profilesEditorState.js";
import {
  builtinProfileFormValue as builtinProfileFormValueFromEditor,
  customProfileStatusState as customProfileStatusStateFromEditor,
  emptyProfileForm as emptyProfileFormFromEditor,
  refreshCustomProfileOptions as refreshCustomProfileOptionsFromEditor,
  setCustomProfileNames as setCustomProfileNamesFromEditor,
  setCustomProfilesReloadHandler as setCustomProfilesReloadHandlerFromEditor,
  setProfileForm as setProfileFormFromEditor,
} from "./profilesCustomEditorState.js";
import {
  refreshExecutionModeOptionsForCurrentConnection,
  refreshTextfsmPlatformOptions,
  resetProfileModesCache,
} from "./promptProfileExecutionState.js";

export {
  addProfileDetectInitialRule,
  addProfileDetectProbe,
  addProfileDetectProbeErrorPattern,
  addProfileDetectProbeRule,
  createCustomProfileDetectPanelWorkspace,
  createProfileDiagnosePanelWorkspace,
  createProfileDiagnoseState,
  customProfileDetectPanelDisplay,
  diagnoseSelectedCustomProfile,
  ensureProfileDetectDefaults,
  patchProfileDetectInitialRule,
  patchProfileDetectProbe,
  patchProfileDetectProbeRule,
  profileDiagnoseDisplay,
  profileDiagnoseOptionsState,
  profileDiagnosePanelDisplay,
  profileDetectFormStateStore,
  removeProfileDetectInitialRule,
  removeProfileDetectProbe,
  removeProfileDetectProbeErrorPattern,
  removeProfileDetectProbeRule,
  setProfileDetectEnabled,
  setProfileDetectProbeErrorPattern,
  setProfileDiagnoseSelected,
} from "./profilesDiagnostics.js";

export const promptModePresentation = (mode = "") => ({
  builtinActive: normalizePromptMode(mode) === PROMPT_MODE.builtin,
  diagnoseActive: normalizePromptMode(mode) === PROMPT_MODE.diagnose,
  editActive: false,
  profilesActive: normalizePromptMode(mode) === PROMPT_MODE.builtin,
});

function profileStatusDisplay(statusState = {}) {
  const status = statusPresentation(
    statusState.message || "",
    statusState.tone || "info",
    { suppressPassiveLoaded: false },
  );
  return {
    message: status.text,
    show: !!status.text && status.text !== "-",
    tone: status.tone,
  };
}

export function promptProfilesPagePresentation(statusState = {}) {
  return {
    customTitle: tr("customTitle"),
    customStatus: profileStatusDisplay(statusState),
    hooksHint: tr("profileHooksHint"),
    hooksTitle: tr("labelHooks"),
    tabAriaLabel: tr("promptProfilesTitle"),
  };
}

export function promptProfilesPageDisplay(mode = "", statusState = {}) {
  return {
    ...promptModePresentation(mode),
    ...promptProfilesPagePresentation(statusState),
  };
}

function builtinProfilesPanelPresentation() {
  const selectPlaceholder = tr("builtinProfileSelectPlaceholder");
  return {
    copyButtonLabel: tr("builtinCopyBtn"),
    selectPlaceholder,
    title: tr("builtinTitle"),
  };
}

export function builtinProfilesPanelDisplay({
  detailState = {},
  overviewState = {},
  readonlyDisplay = {},
  statusState = {},
} = {}) {
  const panel = builtinProfilesPanelPresentation();
  const simpleSections = readonlyDisplay.simpleSections || [];
  return {
    ...panel,
    detail: {
      aliases: safeString(detailState.aliases || ""),
      commandExecution: readonlyDisplay.commandExecution,
      detectProfile: readonlyDisplay.detectProfile,
      detailDisplay: builtinProfileDetailsPresentation({ simpleSections }),
      hasHookRows: !!readonlyDisplay.hasHookRows,
      hookRows: readonlyDisplay.hookRows || [],
      interactionRows: readonlyDisplay.interactionRows || [],
      name: safeString(detailState.name || ""),
      notes: safeString(detailState.notes || ""),
      promptRows: readonlyDisplay.promptRows || [],
      simpleSections,
      source: safeString(detailState.source || ""),
      summary: safeString(detailState.summary || ""),
      sysPromptRows: readonlyDisplay.sysPromptRows || [],
      transitionRows: readonlyDisplay.transitionRows || [],
    },
    overview: {
      overviewText: safeString(overviewState.overviewText || "-"),
      profileRows: (Array.isArray(overviewState.builtins)
        ? overviewState.builtins
        : []
      ).map((profile) => ({
        aliases: Array.isArray(profile?.aliases)
          ? profile.aliases.filter(Boolean)
          : [],
        name: safeString(profile?.name || ""),
        summary: safeString(profile?.summary || ""),
      })),
      profileNames: Array.isArray(overviewState.options)
        ? overviewState.options
        : [],
      selectedName: safeString(overviewState.selected || ""),
    },
    status: profileStatusDisplay(statusState),
  };
}

const COMMAND_EXECUTION_MODE_OPTIONS = Object.freeze([
  ["prompt_driven", "commandExecutionModePromptDriven"],
  ["shell_exit_status", "commandExecutionModeShellExitStatus"],
]);

function commandExecutionModeOptionRows() {
  return COMMAND_EXECUTION_MODE_OPTIONS.map(([valueText, labelKey]) => ({
    labelText: tr(labelKey),
    valueText,
  }));
}

function builtinProfileDetailsPresentation({ simpleSections = [] } = {}) {
  return {
    commandExecutionMarkerPlaceholder: tr("commandExecutionMarkerPlaceholder"),
    commandExecutionModeOptionRows: commandExecutionModeOptionRows(),
    commandExecutionTitle: tr("commandExecutionTitle"),
    configurationDescription: tr("profileConfigurationDescription"),
    configurationTitle: tr("profileConfigurationTitle"),
    detectDescription: tr("profileBuiltinDetectDescription"),
    fieldPlaceholders: {
      aliases: tr("builtinFieldAliases"),
      name: tr("builtinFieldName"),
      source: tr("builtinFieldSource"),
      summary: tr("builtinFieldSummary"),
    },
    hooksDescription: tr("profileHooksDescription"),
    notesPlaceholder: tr("builtinFieldNotes"),
    overviewDescription: tr("profileOverviewDescription"),
    overviewTitle: tr("profileOverviewTitle"),
    readonlyHint: tr("profileReadonlyHint"),
    rulesEmpty: tr("profileRulesEmpty"),
    simpleSections: (Array.isArray(simpleSections) ? simpleSections : []).map(
      (section) => ({
        ...section,
        titleText: tr(section.i18nKey, section.title),
      }),
    ),
  };
}

export function setNormalizedPromptMode(setPromptMode, promptMode = "") {
  setPromptMode(normalizePromptMode(promptMode));
}

function profileValues(listRows) {
  return Array.isArray(listRows) ? listRows : [];
}

export function createPromptProfilesPageWorkspace() {
  const currentPromptModeState = writable(
    normalizePromptMode(defaultPromptMode),
  );
  const pageDisplayStateStore = derived(
    [
      currentPromptModeState,
      customProfileStatusStateFromEditor,
      currentLanguageState,
    ],
    ([
      $currentPromptModeState,
      $customProfileStatusState,
      _currentLanguageState,
    ]) =>
      promptProfilesPageDisplay(
        $currentPromptModeState,
        $customProfileStatusState,
      ),
  );
  const builtinPanelDisplayStateStore = derived(
    [
      builtinProfileForm,
      builtinOverviewState,
      builtinDetailState,
      builtinDetailStatusState,
      currentLanguageState,
    ],
    ([
      $builtinProfileForm,
      $builtinOverviewState,
      $builtinDetailState,
      $builtinDetailStatusState,
      _currentLanguageState,
    ]) => {
      const builtinProfile =
        builtinProfileFormValueFromEditor($builtinProfileForm);
      return builtinProfilesPanelDisplay({
        detailState: $builtinDetailState,
        overviewState: $builtinOverviewState,
        readonlyDisplay:
          builtinProfileReadonlyDisplayFromEditor(builtinProfile),
        statusState: $builtinDetailStatusState,
      });
    },
  );
  const pageSyncStateStore = derived(
    currentLanguageState,
    ($currentLanguageState) => ({
      language: $currentLanguageState,
    }),
  );
  let didInitialLoad = false;
  let lastLanguage = "";

  function setPromptMode(promptMode = "") {
    currentPromptModeState.set(normalizePromptMode(promptMode));
  }

  async function copyBuiltinProfileToCustomAndEdit() {
    const copiedName = await copySelectedBuiltinProfileToCustom();
    setPromptMode(PROMPT_MODE.builtin);
    return copiedName;
  }

  function setPageContext({ active = false } = {}) {
    if (!active) {
      didInitialLoad = false;
      lastLanguage = "";
      return;
    }
    const { language } = getStore(pageSyncStateStore);
    if (!didInitialLoad) {
      didInitialLoad = true;
      void loadProfilesOverview();
    }
    if (lastLanguage === language) return;
    lastLanguage = language;
    refreshPromptProfileLanguageOptions();
  }

  function destroy() {
    didInitialLoad = false;
    lastLanguage = "";
  }

  return {
    builtinPanelDisplayStateStore,
    copyBuiltinProfileToCustomAndEdit,
    currentPromptModeState,
    destroy,
    pageDisplayStateStore,
    setPromptMode,
    setPageContext,
  };
}

export async function changeBuiltinProfileSelection(builtinProfileName = "") {
  setBuiltinOverviewSelected(builtinProfileName);
  await loadBuiltinProfileDetail(builtinProfileName);
}

let cachedCustomProfiles = [],
  lastBuiltinProfileState = null;
export const builtinOverviewState = writable({
  builtins: [],
  options: [],
  overviewText: "-",
  selected: "",
});
export const builtinDetailState = writable({
  aliases: "",
  name: "",
  notes: "",
  source: "",
  summary: "",
});
export const builtinDetailStatusState = writable({
  message: "-",
  tone: "info",
});
export const builtinProfileForm = writable(emptyProfileFormFromEditor());

const getLastBuiltinProfile = () => lastBuiltinProfileState;
const setLastBuiltin = (profile) => (lastBuiltinProfileState = profile || null);
function setBuiltinDetailFields(detail = {}) {
  const next = {
    aliases: Array.isArray(detail.aliases) ? detail.aliases.join(", ") : "",
    name: detail.name || "",
    notes: Array.isArray(detail.notes) ? detail.notes.join("\n") : "",
    source: detail.source || "",
    summary: detail.summary || "",
  };
  builtinDetailState.set(next);
}

function setBuiltinDetailStatus(message = "-", tone = "info") {
  builtinDetailStatusState.set({
    message: message || "-",
    tone: tone || "info",
  });
}
function setCustomProfileStatus(message = "-", tone = "info") {
  const presentation = statusPresentation(message, tone);
  customProfileStatusStateFromEditor.set({
    message: presentation.inlineMessage,
    tone: presentation.tone,
  });
  if (presentation.shouldToast) {
    showToast(presentation.text, presentation.tone);
  }
}

function builtinOverviewLines(builtins) {
  return (Array.isArray(builtins) ? builtins : []).map((builtinProfile) => {
    const profileAliases = Array.isArray(builtinProfile.aliases)
      ? builtinProfile.aliases
      : [];
    const aliases =
      profileAliases.length > 0
        ? ` (aliases: ${profileAliases.join(",")})`
        : "";
    return `- ${builtinProfile.name}${aliases}: ${builtinProfile.summary}`;
  });
}

function builtinOverviewSelectedName() {
  return safeString(getStore(builtinOverviewState).selected || "").trim();
}

function setBuiltinOverviewSelected(profileName = "") {
  const selectedName = safeString(profileName).trim();
  builtinOverviewState.update((state) => ({
    ...state,
    selected: state.builtins.some(
      (builtinProfile) => builtinProfile.name === selectedName,
    )
      ? selectedName
      : "",
  }));
}

function setBuiltinOverview(builtins, selectedName) {
  const names = (Array.isArray(builtins) ? builtins : [])
    .map((builtinProfile) => builtinProfile.name)
    .filter(Boolean);
  builtinOverviewState.set({
    builtins: Array.isArray(builtins) ? builtins : [],
    options: names,
    overviewText: builtinOverviewLines(builtins).join("\n") || "-",
    selected: names.includes(selectedName) ? selectedName : "",
  });
}

function setBuiltinForm(profile) {
  builtinProfileForm.set(profile || emptyProfileFormFromEditor());
}

export async function initializeProfiles() {
  setCustomProfilesReloadHandlerFromEditor(loadProfilesOverview);
  setProfileFormFromEditor(emptyProfileFormFromEditor());
  await refreshExecutionModeOptionsForCurrentConnection({ force: true });
}

async function loadBuiltinProfileDetail(nameOverride = "") {
  const name = safeString(nameOverride || builtinOverviewSelectedName()).trim();
  if (!name) {
    clearBuiltinProfileDetail();
    return;
  }
  try {
    const detailPayload = await getBuiltinProfileDetail(name);
    const profile = await getBuiltinProfileForm(name);
    setLastBuiltin(profile);
    setBuiltinDetailFields(detailPayload);
    setBuiltinForm(profile);
    setBuiltinDetailStatus("-", "info");
  } catch (e) {
    clearBuiltinProfileDetail({ resetStatus: false });
    setBuiltinDetailStatus(e.message, "error");
  }
}

export async function copySelectedBuiltinProfileToCustom(onModeChange) {
  const selected = safeString(
    getStore(builtinOverviewState).selected || "",
  ).trim();
  if (!getLastBuiltinProfile() && selected) {
    await loadBuiltinProfileDetail(selected);
  }
  const lastBuiltinProfile = getLastBuiltinProfile();
  if (!lastBuiltinProfile) {
    setBuiltinDetailStatus(tr("needLoadBuiltinFirst"), "error");
    return;
  }
  const copied = JSON.parse(JSON.stringify(lastBuiltinProfile));
  copied.name = `${copied.name}_custom`;
  setProfileFormFromEditor(copied);
  if (typeof onModeChange === "function") {
    onModeChange("edit");
  }
  setBuiltinDetailStatus(tr("copiedToCustom"), "success");
  return copied.name;
}

function clearBuiltinProfileDetail({ resetStatus = true } = {}) {
  setLastBuiltin(null);
  setBuiltinDetailFields();
  setBuiltinForm(emptyProfileFormFromEditor());
  if (resetStatus) {
    setBuiltinDetailStatus("-", "info");
  }
}

function refreshDiagnoseProfileOptions() {
  const profiles = getCachedDeviceProfiles().filter(
    (name) => name !== "autodetect",
  );
  const current = safeString(
    getStore(profileDiagnoseOptionsState).selected || "",
  ).trim();
  profileDiagnoseOptionsState.set({
    profiles,
    selected: profiles.includes(current) ? current : "",
  });
}

export function refreshPromptProfileLanguageOptions() {
  refreshCustomProfileOptionsFromEditor();
  refreshDiagnoseProfileOptions();
}

function refreshProfileConsumers() {
  refreshCustomProfileOptionsFromEditor();
  refreshDiagnoseProfileOptions();
  refreshConnectionProfileOptions();
  refreshTextfsmPlatformOptions();
}

export async function loadProfilesOverview() {
  try {
    const overviewPayload = await getDeviceProfilesOverview();
    const builtins = profileValues(overviewPayload.builtins);
    const custom = profileValues(overviewPayload.custom);
    resetProfileModesCache();
    setCachedDeviceProfiles([
      "autodetect",
      ...builtins.map((builtinProfile) => builtinProfile.name),
      ...custom.map((customProfile) => customProfile.name),
    ]);

    const selectedBuiltinName = builtinOverviewSelectedName();
    setBuiltinOverview(builtins, selectedBuiltinName);

    cachedCustomProfiles = custom.map((customProfile) => customProfile.name);
    setCustomProfileNamesFromEditor(cachedCustomProfiles);
    setCustomProfileStatus("-", "info");
    refreshProfileConsumers();

    const selectedAfterRender = builtinOverviewSelectedName();
    if (selectedAfterRender) {
      await loadBuiltinProfileDetail(selectedAfterRender);
    } else {
      clearBuiltinProfileDetail();
    }
    await refreshExecutionModeOptionsForCurrentConnection({ force: true });
  } catch (e) {
    resetProfileModesCache();
    cachedCustomProfiles = [];
    setCustomProfileNamesFromEditor([]);
    setCachedDeviceProfiles([]);
    setCustomProfileStatus(e.message, "error");
    refreshProfileConsumers();
    clearBuiltinProfileDetail({ resetStatus: false });
    setBuiltinDetailStatus(e.message, "error");
    setBuiltinOverview([], "");
    await refreshExecutionModeOptionsForCurrentConnection({ force: true });
  }
}

setCustomProfilesReloadHandlerFromEditor(loadProfilesOverview);
