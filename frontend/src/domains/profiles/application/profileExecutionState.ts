import { derived, get, writable } from "svelte/store";
import { t } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import { profileExecutionRuntime } from "../infrastructure/profileExecutionRuntime.js";
import { profileModeExpressionMatchesOptions } from "../model/modeExpression.js";
import type {
  ModeSelectConfig,
  ModeSelection,
  ModeSelectState,
  ProfileModeOverrides,
  ProfileModes,
  TextfsmPlatformSelectState,
} from "../model/types.js";

function profileValues(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const modeSelectState = new Map<string, ModeSelectState>();
const textfsmPlatformSelectState = new Map<
  string,
  TextfsmPlatformSelectState
>();
const modeSelectStates = new Map<
  string,
  ReturnType<typeof writable<ModeSelectState>>
>();
const textfsmPlatformSelectStates = new Map<
  string,
  ReturnType<typeof writable<TextfsmPlatformSelectState>>
>();
let profileModesCache = new Map<string, ProfileModes>();
let watchedExecutionProfileName: string | null = null;
let executionModeRefreshQueue: Promise<void> | null = null;

export const executionModeOptionsVersion = writable(0);

export const MODE_SELECT = Object.freeze({
  showBatch: "showBatch",
  batchExec: "batchExec",
  showSingle: "showSingle",
  standardDirect: "standardDirect",
  standardFlow: "standardFlow",
  standardTemplate: "standardTemplate",
});
const MODE_SELECT_KEYS = new Set<string>(Object.values(MODE_SELECT));

export const TEXTFSM_PLATFORM_SELECT = Object.freeze({
  batchShow: "batchShow",
  standard: "standard",
});
const TEXTFSM_SELECT_KEYS = new Set<string>(
  Object.values(TEXTFSM_PLATFORM_SELECT),
);

export const executionConnectionProfileState = derived(
  [
    profileExecutionRuntime.connectionTargetState,
    profileExecutionRuntime.temporaryConnectionFormStateStore,
  ],
  () =>
    profileExecutionRuntime.currentExecutionConnectionProfile() || "autodetect",
);

function normalizeSemanticKey(
  rawKey: unknown,
  validKeys: ReadonlySet<string>,
  fallback = "",
): string {
  const key = safeString(rawKey || "").trim();
  if (!key) return fallback;
  return validKeys.has(key) ? key : fallback || key;
}

export function resetProfileModesCache(): void {
  profileModesCache = new Map();
}

async function fetchProfileModes(profileName: unknown): Promise<ProfileModes> {
  const normalized = safeString(profileName).trim() || "autodetect";
  const cached = profileModesCache.get(normalized);
  if (cached) return cached;

  try {
    const modePayload = recordValue(
      await profileExecutionRuntime.getProfileModes(normalized),
    );
    if (!Object.keys(modePayload).length) {
      throw new Error("Invalid profile modes response");
    }
    const modes = profileValues(modePayload.modes)
      .filter(Boolean)
      .map(safeString);
    const defaultMode =
      safeString(modePayload.default_mode || modes[0] || "Root") || "Root";
    const resolved = {
      default_mode: defaultMode,
      modes: modes.length > 0 ? modes : [defaultMode],
      name: safeString(modePayload.name || normalized) || normalized,
    };
    profileModesCache.set(normalized, resolved);
    return resolved;
  } catch {
    return {
      default_mode: "Root",
      modes: ["Root", "User"],
      name: normalized,
    };
  }
}

function normalizeModeSelectKey(modeSelectKey: unknown): string {
  return normalizeSemanticKey(modeSelectKey, MODE_SELECT_KEYS);
}

function defaultModeSelectState(modeSelectKey: unknown): ModeSelectState {
  const key = normalizeModeSelectKey(modeSelectKey);
  return (
    modeSelectState.get(key) || {
      allowEmpty: false,
      emptyLabel: "\u2014",
      modes: [],
      selected: "",
    }
  );
}

function modeSelectStateFor(modeSelectKey: unknown) {
  const key = normalizeModeSelectKey(modeSelectKey);
  let state = modeSelectStates.get(key);
  if (!state) {
    state = writable(defaultModeSelectState(key));
    modeSelectStates.set(key, state);
  }
  return state;
}

function setModeSelectValue(
  modeSelectKey: unknown,
  selectedMode: unknown = "",
): void {
  const key = normalizeModeSelectKey(modeSelectKey);
  const selected = safeString(selectedMode || "").trim();
  modeSelectStateFor(key).update((state) => {
    const next = { ...defaultModeSelectState(key), ...state, selected };
    modeSelectState.set(key, next);
    return next;
  });
}

export function modeSelection(
  modeSelectKey: unknown,
): ModeSelection<ModeSelectState> {
  const key = normalizeModeSelectKey(modeSelectKey);
  return {
    setValue: (selectedMode: unknown = "") =>
      setModeSelectValue(key, selectedMode),
    state: modeSelectStateFor(key),
  };
}

function normalizeTextfsmPlatformSelectKey(platformSelectKey: unknown): string {
  return normalizeSemanticKey(platformSelectKey, TEXTFSM_SELECT_KEYS);
}

function defaultTextfsmPlatformSelectState(
  platformSelectKey: unknown,
): TextfsmPlatformSelectState {
  const key = normalizeTextfsmPlatformSelectKey(platformSelectKey);
  return (
    textfsmPlatformSelectState.get(key) || {
      placeholder: t("textfsmPlatformPlaceholder"),
      profiles: [],
      selected: "",
    }
  );
}

function textfsmPlatformSelectStateFor(platformSelectKey: unknown) {
  const key = normalizeTextfsmPlatformSelectKey(platformSelectKey);
  let state = textfsmPlatformSelectStates.get(key);
  if (!state) {
    state = writable(defaultTextfsmPlatformSelectState(key));
    textfsmPlatformSelectStates.set(key, state);
  }
  return state;
}

function setTextfsmPlatformSelectValue(
  platformSelectKey: unknown,
  selectedProfile: unknown = "",
): void {
  const key = normalizeTextfsmPlatformSelectKey(platformSelectKey);
  const selected = safeString(selectedProfile || "").trim();
  textfsmPlatformSelectStateFor(key).update((state) => {
    const next = {
      ...defaultTextfsmPlatformSelectState(key),
      ...state,
      selected,
    };
    textfsmPlatformSelectState.set(key, next);
    return next;
  });
}

export function textfsmPlatformSelection(
  platformSelectKey: unknown,
): ModeSelection<TextfsmPlatformSelectState> {
  const key = normalizeTextfsmPlatformSelectKey(platformSelectKey);
  return {
    setValue: (selectedProfile: unknown = "") =>
      setTextfsmPlatformSelectValue(key, selectedProfile),
    state: textfsmPlatformSelectStateFor(key),
  };
}

function resolveModeSelectState(
  modes: string[],
  preferredMode: unknown,
  defaultMode: string,
  config: ModeSelectConfig = {},
): ModeSelectState {
  const { allowEmpty = false, emptyLabel = "\u2014" } = config;
  const normalizedModes = modes.filter(Boolean);
  const finalModes =
    normalizedModes.length > 0 ? normalizedModes : [defaultMode || "Enable"];
  const preferred = safeString(preferredMode || "").trim();
  const selected =
    preferred && profileModeExpressionMatchesOptions(preferred, finalModes)
      ? preferred
      : allowEmpty
        ? ""
        : defaultMode || finalModes[0] || "Enable";
  const resolvedSelected =
    allowEmpty && !selected
      ? ""
      : profileModeExpressionMatchesOptions(selected, finalModes)
        ? selected
        : finalModes[0] || "";

  return {
    allowEmpty,
    emptyLabel,
    modes: finalModes,
    selected: resolvedSelected,
  };
}

function applyModeOptions(
  modeSelectKey: unknown,
  modes: string[],
  preferredMode: unknown,
  defaultMode: string,
  config: ModeSelectConfig = {},
): void {
  const key = normalizeModeSelectKey(modeSelectKey);
  const state = resolveModeSelectState(
    modes,
    preferredMode,
    defaultMode,
    config,
  );
  modeSelectState.set(key, state);
  modeSelectStateFor(key).set(state);
}

function safeSelectValue(selectionKey: unknown): string {
  const modeKey = normalizeModeSelectKey(selectionKey);
  if (modeSelectStates.has(modeKey) || modeSelectState.has(modeKey)) {
    return safeString(get(modeSelectStateFor(modeKey)).selected || "").trim();
  }
  const platformKey = normalizeTextfsmPlatformSelectKey(selectionKey);
  if (
    textfsmPlatformSelectStates.has(platformKey) ||
    textfsmPlatformSelectState.has(platformKey)
  ) {
    return safeString(
      get(textfsmPlatformSelectStateFor(platformKey)).selected || "",
    ).trim();
  }
  return "";
}

function refreshTextfsmPlatformSelect(
  platformSelectKey: unknown,
  profiles: string[],
  selected: string,
): void {
  const key = normalizeTextfsmPlatformSelectKey(platformSelectKey);
  const state = {
    placeholder: t("textfsmPlatformPlaceholder"),
    profiles,
    selected,
  };
  textfsmPlatformSelectState.set(key, state);
  textfsmPlatformSelectStateFor(key).set(state);
}

export function refreshTextfsmPlatformOptions(): void {
  const profiles = Array.from(
    new Set(
      profileExecutionRuntime
        .getCachedDeviceProfiles()
        .map((name) => safeString(name).trim())
        .filter((name) => name && name !== "autodetect"),
    ),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  refreshTextfsmPlatformSelect(
    TEXTFSM_PLATFORM_SELECT.standard,
    profiles,
    safeSelectValue(TEXTFSM_PLATFORM_SELECT.standard),
  );
  refreshTextfsmPlatformSelect(
    TEXTFSM_PLATFORM_SELECT.batchShow,
    profiles,
    safeSelectValue(TEXTFSM_PLATFORM_SELECT.batchShow),
  );
}

async function refreshExecutionModeOptions(
  overrides: ProfileModeOverrides = {},
): Promise<void> {
  const profileName =
    profileExecutionRuntime.currentExecutionConnectionProfile() || "autodetect";
  const profileModes = await fetchProfileModes(profileName);
  const { modes, default_mode: defaultMode } = profileModes;
  const autoModeSelect = {
    allowEmpty: true,
    emptyLabel: t("showModeAutoPlaceholder"),
  };
  const modeSelectTargets: Array<[string, string, ModeSelectConfig?]> = [
    [MODE_SELECT.standardDirect, "execMode"],
    [MODE_SELECT.standardFlow, "flowMode"],
    [MODE_SELECT.standardTemplate, "templateMode"],
    [MODE_SELECT.batchExec, "batchExecMode", autoModeSelect],
    [MODE_SELECT.showSingle, "showMode", autoModeSelect],
    [MODE_SELECT.showBatch, "batchShowMode", autoModeSelect],
  ];
  for (const [selectKey, overrideKey, selectOptions] of modeSelectTargets) {
    applyModeOptions(
      selectKey,
      modes,
      overrides[overrideKey] ?? safeSelectValue(selectKey),
      defaultMode,
      selectOptions,
    );
  }
  executionModeOptionsVersion.update((version) => version + 1);
}

export async function refreshExecutionModeOptionsForCurrentConnection({
  force = false,
}: {
  force?: boolean;
} = {}): Promise<void> {
  const profileName =
    profileExecutionRuntime.currentExecutionConnectionProfile() || "autodetect";
  if (!force && profileName === watchedExecutionProfileName) return;

  watchedExecutionProfileName = profileName;
  const previousRefresh = executionModeRefreshQueue;
  executionModeRefreshQueue = (async () => {
    try {
      if (previousRefresh) await previousRefresh;
    } catch {}
    try {
      await refreshExecutionModeOptions();
    } catch {}
  })();
  return executionModeRefreshQueue;
}
