import { getProfileModes } from "../../api/client.js";
import { getCachedDeviceProfiles } from "../templates/templates.js";
import { safeString } from "../../lib/ui.js";
import { t } from "../../lib/i18n.js";
import {
  currentExecutionConnectionProfile,
  connectionTargetState,
  temporaryConnectionFormStateStore,
} from "../connections/connections.js";
import { derived, get as getStore, writable } from "svelte/store";

function profileValues(listRows) {
  return Array.isArray(listRows) ? listRows : [];
}

const modeSelectState = new Map();
const textfsmPlatformSelectState = new Map();
const modeSelectStates = new Map();
const textfsmPlatformSelectStates = new Map();
let profileModesCache = new Map();
let watchedExecutionProfileName = null;
let executionModeRefreshQueue = null;

export const executionModeOptionsVersion = writable(0);

export const MODE_SELECT = Object.freeze({
  showBatch: "showBatch",
  showSingle: "showSingle",
  standardDirect: "standardDirect",
  standardFlow: "standardFlow",
  standardTemplate: "standardTemplate",
});
const MODE_SELECT_KEYS = new Set(Object.values(MODE_SELECT));

export const TEXTFSM_PLATFORM_SELECT = Object.freeze({
  batchShow: "batchShow",
  standard: "standard",
});
const TEXTFSM_SELECT_KEYS = new Set(Object.values(TEXTFSM_PLATFORM_SELECT));

export const executionConnectionProfileState = derived(
  [connectionTargetState, temporaryConnectionFormStateStore],
  () => currentExecutionConnectionProfile() || "autodetect",
);

function normalizeSemanticKey(rawKey, validKeys, fallback = "") {
  const key = safeString(rawKey || "").trim();
  if (!key) return fallback;
  return validKeys.has(key) ? key : fallback || key;
}

export function resetProfileModesCache() {
  profileModesCache = new Map();
}

async function fetchProfileModes(profileName) {
  const normalized = (profileName || "").trim() || "autodetect";
  if (profileModesCache.has(normalized)) {
    return profileModesCache.get(normalized);
  }
  try {
    const modePayload = await getProfileModes(normalized);
    const modes = profileValues(modePayload.modes).filter(Boolean);
    const defaultMode = modePayload.default_mode || modes[0] || "Root";
    const resolved = {
      name: modePayload.name || normalized,
      default_mode: defaultMode,
      modes: modes.length > 0 ? modes : [defaultMode],
    };
    profileModesCache.set(normalized, resolved);
    return resolved;
  } catch (_) {
    return {
      name: normalized,
      default_mode: "Root",
      modes: ["Root"],
    };
  }
}

function normalizeModeSelectKey(modeSelectKey) {
  return normalizeSemanticKey(modeSelectKey, MODE_SELECT_KEYS);
}

function defaultModeSelectState(modeSelectKey) {
  const key = normalizeModeSelectKey(modeSelectKey);
  return (
    modeSelectState.get(key) || {
      allowEmpty: false,
      emptyLabel: "—",
      modes: [],
      selected: "",
    }
  );
}

function modeSelectStateFor(modeSelectKey) {
  const key = normalizeModeSelectKey(modeSelectKey);
  if (!modeSelectStates.has(key)) {
    modeSelectStates.set(key, writable(defaultModeSelectState(key)));
  }
  return modeSelectStates.get(key);
}

function setModeSelectValue(modeSelectKey, selectedMode = "") {
  const key = normalizeModeSelectKey(modeSelectKey);
  const selected = safeString(selectedMode || "").trim();
  modeSelectStateFor(key).update((state) => {
    const next = { ...defaultModeSelectState(key), ...state, selected };
    modeSelectState.set(key, next);
    return next;
  });
}

export function modeSelection(modeSelectKey) {
  const key = normalizeModeSelectKey(modeSelectKey);
  return {
    setValue: (selectedMode = "") => setModeSelectValue(key, selectedMode),
    state: modeSelectStateFor(key),
  };
}

function normalizeTextfsmPlatformSelectKey(platformSelectKey) {
  return normalizeSemanticKey(platformSelectKey, TEXTFSM_SELECT_KEYS);
}

function defaultTextfsmPlatformSelectState(platformSelectKey) {
  const key = normalizeTextfsmPlatformSelectKey(platformSelectKey);
  return (
    textfsmPlatformSelectState.get(key) || {
      placeholder: t("textfsmPlatformPlaceholder"),
      profiles: [],
      selected: "",
    }
  );
}

function textfsmPlatformSelectStateFor(platformSelectKey) {
  const key = normalizeTextfsmPlatformSelectKey(platformSelectKey);
  if (!textfsmPlatformSelectStates.has(key)) {
    textfsmPlatformSelectStates.set(
      key,
      writable(defaultTextfsmPlatformSelectState(key)),
    );
  }
  return textfsmPlatformSelectStates.get(key);
}

function setTextfsmPlatformSelectValue(
  platformSelectKey,
  selectedProfile = "",
) {
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

export function textfsmPlatformSelection(platformSelectKey) {
  const key = normalizeTextfsmPlatformSelectKey(platformSelectKey);
  return {
    setValue: (selectedProfile = "") =>
      setTextfsmPlatformSelectValue(key, selectedProfile),
    state: textfsmPlatformSelectStateFor(key),
  };
}

function resolveModeSelectState(
  modes,
  preferredMode,
  defaultMode,
  config = {},
) {
  const { allowEmpty = false, emptyLabel = "—" } = config;
  const normalizedModes = (modes || []).filter(Boolean);
  const finalModes =
    normalizedModes.length > 0 ? normalizedModes : [defaultMode || "Enable"];
  const preferred = (preferredMode || "").trim();
  const selected =
    preferred && finalModes.includes(preferred)
      ? preferred
      : allowEmpty
        ? ""
        : defaultMode || finalModes[0] || "Enable";
  const resolvedSelected =
    allowEmpty && !selected
      ? ""
      : finalModes.includes(selected)
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
  modeSelectKey,
  modes,
  preferredMode,
  defaultMode,
  config = {},
) {
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

function safeSelectValue(selectionKey) {
  const modeKey = normalizeModeSelectKey(selectionKey);
  if (modeSelectStates.has(modeKey) || modeSelectState.has(modeKey)) {
    return safeString(
      getStore(modeSelectStateFor(modeKey)).selected || "",
    ).trim();
  }
  const platformKey = normalizeTextfsmPlatformSelectKey(selectionKey);
  if (
    textfsmPlatformSelectStates.has(platformKey) ||
    textfsmPlatformSelectState.has(platformKey)
  ) {
    return safeString(
      getStore(textfsmPlatformSelectStateFor(platformKey)).selected || "",
    ).trim();
  }
  return "";
}

function refreshTextfsmPlatformSelect(platformSelectKey, profiles, selected) {
  const key = normalizeTextfsmPlatformSelectKey(platformSelectKey);
  const state = {
    placeholder: t("textfsmPlatformPlaceholder"),
    profiles,
    selected,
  };
  textfsmPlatformSelectState.set(key, state);
  textfsmPlatformSelectStateFor(key).set(state);
}

export function refreshTextfsmPlatformOptions() {
  const profiles = Array.from(
    new Set(
      getCachedDeviceProfiles()
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

async function refreshExecutionModeOptions(overrides = {}) {
  const profileName = currentExecutionConnectionProfile() || "autodetect";
  const profileModes = await fetchProfileModes(profileName);
  const { modes, default_mode: defaultMode } = profileModes;
  const autoModeSelect = {
    allowEmpty: true,
    emptyLabel: t("showModeAutoPlaceholder"),
  };
  const modeSelectTargets = [
    [MODE_SELECT.standardDirect, "execMode"],
    [MODE_SELECT.standardFlow, "flowMode"],
    [MODE_SELECT.standardTemplate, "templateMode"],
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
} = {}) {
  const profileName = currentExecutionConnectionProfile() || "autodetect";
  if (!force && profileName === watchedExecutionProfileName) {
    return;
  }
  watchedExecutionProfileName = profileName;
  const previousRefresh = executionModeRefreshQueue;
  executionModeRefreshQueue = (async () => {
    try {
      if (previousRefresh) {
        await previousRefresh;
      }
    } catch (_) {}
    try {
      await refreshExecutionModeOptions();
    } catch (_) {}
  })();
  return executionModeRefreshQueue;
}
