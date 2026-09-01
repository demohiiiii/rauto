import { currentLanguageState, tr } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import {
  defaultPromptMode,
  normalizePromptMode,
  PROMPT_MODE,
} from "../../../config/dashboardModes.js";
import { derived, get as getStore, writable } from "svelte/store";
import {
  builtinProfileFormValue,
  customProfileStatusState,
  emptyProfileForm,
  refreshCustomProfileOptions,
  setCustomProfileNames,
  setCustomProfilesReloadHandler,
  setProfileForm,
} from "./customProfileEditorState.js";
import { profileDiagnoseOptionsState } from "./profileDiagnosticsState.js";
import {
  refreshExecutionModeOptionsForCurrentConnection,
  refreshTextfsmPlatformOptions,
  resetProfileModesCache,
} from "./profileExecutionState.js";
import { profileCatalogApi } from "../infrastructure/profileCatalogApi.js";
import { profileCatalogRuntime } from "../infrastructure/profileCatalogRuntime.js";
import { profileEditorRuntime } from "../infrastructure/profileEditorRuntime.js";
import { recordValue } from "../model/customProfileForm.js";
import {
  cloneBuiltinProfileAsCustom,
  emptyBuiltinProfileDetail,
  emptyBuiltinProfileOverview,
  normalizeBuiltinProfileDetail,
  normalizeBuiltinProfileOverview,
  selectBuiltinProfile,
} from "../model/profileCatalog.js";
import type {
  BuiltinProfileDetailState,
  BuiltinProfileOverviewState,
  ProfileCatalogStatusState,
} from "../model/profileCatalog.js";
import type { CustomProfileForm, UnknownRecord } from "../model/types.js";
import { builtinProfileReadonlyDisplay } from "../presentation/profileEditorPresentation.js";
import {
  builtinProfilesPanelDisplay,
  promptProfilesPageDisplay,
} from "../presentation/profileCatalogPresentation.js";

let cachedCustomProfiles: string[] = [];
let lastBuiltinProfileState: UnknownRecord | null = null;

export const builtinOverviewState = writable<BuiltinProfileOverviewState>(
  emptyBuiltinProfileOverview(),
);
export const builtinDetailState = writable<BuiltinProfileDetailState>(
  emptyBuiltinProfileDetail(),
);
export const builtinDetailStatusState = writable<ProfileCatalogStatusState>({
  message: "-",
  tone: "info",
});
export const builtinProfileForm =
  writable<CustomProfileForm>(emptyProfileForm());

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : safeString(error);
}

function setBuiltinDetailStatus(message = "-", tone = "info"): void {
  builtinDetailStatusState.set({
    message: message || "-",
    tone: tone || "info",
  });
}

function setCustomProfileStatus(message = "-", tone = "info"): void {
  customProfileStatusState.set(
    profileEditorRuntime.publishStatus(message, tone),
  );
}

function builtinOverviewSelectedName(): string {
  return safeString(getStore(builtinOverviewState).selected).trim();
}

function setBuiltinOverviewSelected(profileName: unknown = ""): void {
  builtinOverviewState.update((state) =>
    selectBuiltinProfile(state, profileName),
  );
}

function setBuiltinOverview(builtins: unknown, selectedName: string): void {
  builtinOverviewState.set(
    normalizeBuiltinProfileOverview(builtins, selectedName),
  );
}

function setBuiltinForm(profile: unknown): void {
  builtinProfileForm.set(
    profile ? (profile as CustomProfileForm) : emptyProfileForm(),
  );
}

function clearBuiltinProfileDetail({
  resetStatus = true,
}: { resetStatus?: boolean } = {}): void {
  lastBuiltinProfileState = null;
  builtinDetailState.set(emptyBuiltinProfileDetail());
  setBuiltinForm(null);
  if (resetStatus) setBuiltinDetailStatus();
}

async function loadBuiltinProfileDetail(nameOverride = ""): Promise<void> {
  const name = safeString(nameOverride || builtinOverviewSelectedName()).trim();
  if (!name) {
    clearBuiltinProfileDetail();
    return;
  }
  try {
    const [detailPayload, profilePayload] = await Promise.all([
      profileCatalogApi.getBuiltinProfileDetail(name),
      profileCatalogApi.getBuiltinProfileForm(name),
    ]);
    lastBuiltinProfileState = recordValue(profilePayload);
    builtinDetailState.set(normalizeBuiltinProfileDetail(detailPayload));
    setBuiltinForm(profilePayload);
    setBuiltinDetailStatus();
  } catch (error) {
    clearBuiltinProfileDetail({ resetStatus: false });
    setBuiltinDetailStatus(errorMessage(error), "error");
  }
}

export async function changeBuiltinProfileSelection(
  builtinProfileName = "",
): Promise<void> {
  setBuiltinOverviewSelected(builtinProfileName);
  await loadBuiltinProfileDetail(builtinProfileName);
}

export async function copySelectedBuiltinProfileToCustom(
  onModeChange: unknown = null,
): Promise<string | undefined> {
  const selected = builtinOverviewSelectedName();
  if (!lastBuiltinProfileState && selected)
    await loadBuiltinProfileDetail(selected);
  if (!lastBuiltinProfileState) {
    setBuiltinDetailStatus(tr("needLoadBuiltinFirst"), "error");
    return;
  }
  const copied = cloneBuiltinProfileAsCustom(lastBuiltinProfileState);
  setProfileForm(copied);
  if (typeof onModeChange === "function") {
    (onModeChange as (mode: string) => unknown)("edit");
  }
  setBuiltinDetailStatus(tr("copiedToCustom"), "success");
  return copied.name;
}

function refreshDiagnoseProfileOptions(): void {
  const profiles = profileCatalogRuntime
    .getCachedDeviceProfiles()
    .filter((name) => name !== "autodetect");
  const current = safeString(
    getStore(profileDiagnoseOptionsState).selected,
  ).trim();
  profileDiagnoseOptionsState.set({
    profiles,
    selected: profiles.includes(current) ? current : "",
  });
}

export function refreshPromptProfileLanguageOptions(): void {
  refreshCustomProfileOptions();
  refreshDiagnoseProfileOptions();
}

function refreshProfileConsumers(): void {
  refreshCustomProfileOptions();
  refreshDiagnoseProfileOptions();
  profileCatalogRuntime.refreshConnectionProfileOptions();
  refreshTextfsmPlatformOptions();
}

export async function loadProfilesOverview(): Promise<void> {
  try {
    const payload = recordValue(
      await profileCatalogApi.getDeviceProfilesOverview(),
    );
    const builtins = Array.isArray(payload.builtins) ? payload.builtins : [];
    const custom = Array.isArray(payload.custom) ? payload.custom : [];
    resetProfileModesCache();
    profileCatalogRuntime.setCachedDeviceProfiles([
      "autodetect",
      ...builtins
        .map((profile) => safeString(recordValue(profile).name))
        .filter(Boolean),
      ...custom
        .map((profile) => safeString(recordValue(profile).name))
        .filter(Boolean),
    ]);

    setBuiltinOverview(builtins, builtinOverviewSelectedName());
    cachedCustomProfiles = custom
      .map((profile) => safeString(recordValue(profile).name))
      .filter(Boolean);
    setCustomProfileNames(cachedCustomProfiles);
    setCustomProfileStatus();
    refreshProfileConsumers();

    const selected = builtinOverviewSelectedName();
    if (selected) await loadBuiltinProfileDetail(selected);
    else clearBuiltinProfileDetail();
    await refreshExecutionModeOptionsForCurrentConnection({ force: true });
  } catch (error) {
    const message = errorMessage(error);
    resetProfileModesCache();
    cachedCustomProfiles = [];
    setCustomProfileNames([]);
    profileCatalogRuntime.setCachedDeviceProfiles([]);
    setCustomProfileStatus(message, "error");
    refreshProfileConsumers();
    clearBuiltinProfileDetail({ resetStatus: false });
    setBuiltinDetailStatus(message, "error");
    setBuiltinOverview([], "");
    await refreshExecutionModeOptionsForCurrentConnection({ force: true });
  }
}

export async function initializeProfiles(): Promise<void> {
  setCustomProfilesReloadHandler(loadProfilesOverview);
  setProfileForm(emptyProfileForm());
  await refreshExecutionModeOptionsForCurrentConnection({ force: true });
}

export function setNormalizedPromptMode(
  setPromptMode: (mode: string) => unknown,
  promptMode = "",
): void {
  setPromptMode(normalizePromptMode(promptMode));
}

export function createPromptProfilesPageWorkspace() {
  const currentPromptModeState = writable(
    normalizePromptMode(defaultPromptMode),
  );
  const pageDisplayStateStore = derived(
    [currentPromptModeState, customProfileStatusState, currentLanguageState],
    ([$mode, $status]) => promptProfilesPageDisplay($mode, $status),
  );
  const builtinPanelDisplayStateStore = derived(
    [
      builtinProfileForm,
      builtinOverviewState,
      builtinDetailState,
      builtinDetailStatusState,
      currentLanguageState,
    ],
    ([$form, $overview, $detail, $status]) =>
      builtinProfilesPanelDisplay({
        detailState: $detail,
        overviewState: $overview,
        readonlyDisplay: builtinProfileReadonlyDisplay(
          builtinProfileFormValue($form),
        ),
        statusState: $status,
      }),
  );
  const pageSyncStateStore = derived(currentLanguageState, (language) => ({
    language,
  }));
  let didInitialLoad = false;
  let lastLanguage = "";

  function setPromptMode(promptMode = ""): void {
    currentPromptModeState.set(normalizePromptMode(promptMode));
  }

  async function copyBuiltinProfileToCustomAndEdit() {
    const copiedName = await copySelectedBuiltinProfileToCustom();
    setPromptMode(PROMPT_MODE.builtin);
    return copiedName;
  }

  function setPageContext({ active = false }: { active?: boolean } = {}): void {
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

  return {
    builtinPanelDisplayStateStore,
    copyBuiltinProfileToCustomAndEdit,
    currentPromptModeState,
    destroy() {
      didInitialLoad = false;
      lastLanguage = "";
    },
    pageDisplayStateStore,
    setPromptMode,
    setPageContext,
  };
}

setCustomProfilesReloadHandler(loadProfilesOverview);
