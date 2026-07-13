import { getProfileModes } from "../api/client.js";
import { stringValue } from "../lib/jsonValue.js";
import { createLatestAsyncValueLoader } from "../lib/svelte.js";
import { savedConnectionsRefreshState } from "./connectionTargetStoreState.js";
import { executionConnectionProfileState } from "./promptProfileExecutionState.js";

const txStringValue = stringValue;
let txProfileModesCache = new Map();

function normalizedModeOptions(modeValues = []) {
  return Array.from(
    new Set(
      (Array.isArray(modeValues) ? modeValues : [])
        .map((modeValue) => txStringValue(modeValue).trim())
        .filter(Boolean),
    ),
  );
}

function txProfileModeFallback(profileName = "", currentValue = "") {
  const normalizedProfile = txStringValue(profileName).trim();
  const fallbackMode = txStringValue(currentValue).trim();
  if (normalizedProfile === "autodetect") {
    return {
      defaultMode: fallbackMode || "Root",
      modes: fallbackMode ? [fallbackMode] : ["Root"],
      name: normalizedProfile,
    };
  }
  return {
    defaultMode: fallbackMode,
    modes: fallbackMode ? [fallbackMode] : [],
    name: normalizedProfile,
  };
}

async function loadTxProfileModes(profileName = "", currentValue = "") {
  const normalizedProfile = txStringValue(profileName).trim();
  if (!normalizedProfile) {
    return txProfileModeFallback("", currentValue);
  }
  if (txProfileModesCache.has(normalizedProfile)) {
    return txProfileModesCache.get(normalizedProfile);
  }
  try {
    const modePayload = await getProfileModes(normalizedProfile);
    const modeOptions = normalizedModeOptions(modePayload?.modes);
    const defaultMode =
      txStringValue(modePayload?.default_mode).trim() ||
      modeOptions[0] ||
      txStringValue(currentValue).trim();
    const resolved = {
      defaultMode,
      modes:
        modeOptions.length > 0 ? modeOptions : defaultMode ? [defaultMode] : [],
      name: txStringValue(modePayload?.name).trim() || normalizedProfile,
    };
    txProfileModesCache.set(normalizedProfile, resolved);
    return resolved;
  } catch (_) {
    return txProfileModeFallback(normalizedProfile, currentValue);
  }
}

function txProfileModeInitialState() {
  return {
    defaultMode: "",
    modes: [],
    name: "",
  };
}

export function createTxProfileModeLoader({
  currentMode = () => "",
  explicitProfile = () => "",
} = {}) {
  let currentConnectionProfile = "autodetect";
  const loader = createLatestAsyncValueLoader({
    initialValue: txProfileModeInitialState(),
    loadValue: ({ mode, profileName }) => loadTxProfileModes(profileName, mode),
  });

  function refresh() {
    const profileName =
      txStringValue(explicitProfile()).trim() || currentConnectionProfile;
    return loader.refresh({ mode: currentMode(), profileName });
  }

  const unsubscribeProfile = executionConnectionProfileState.subscribe(
    (profileName) => {
      currentConnectionProfile =
        txStringValue(profileName).trim() || "autodetect";
      void refresh();
    },
  );
  const unsubscribeSavedConnectionsRefresh =
    savedConnectionsRefreshState.subscribe(() => {
      void refresh();
    });

  return {
    destroy() {
      unsubscribeProfile();
      unsubscribeSavedConnectionsRefresh();
    },
    refresh,
    state: loader.state,
  };
}
