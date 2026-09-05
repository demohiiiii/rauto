import { writable } from "svelte/store";
import { transactionProfileModeRuntime } from "../infrastructure/transactionProfileModeRuntime.js";
import type {
  TxProfileModeLoader,
  TxProfileModeState,
} from "../model/types.js";

let txProfileModesCache = new Map<string, TxProfileModeState>();

function normalizedModeOptions(modeValues: readonly string[] = []): string[] {
  return Array.from(
    new Set(modeValues.map((modeValue) => modeValue.trim()).filter(Boolean)),
  );
}

function txProfileModeFallback(
  profileName = "",
  currentValue = "",
): TxProfileModeState {
  const normalizedProfile = profileName.trim();
  const fallbackMode = currentValue.trim();
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

async function loadTxProfileModes(
  profileName = "",
  currentValue = "",
): Promise<TxProfileModeState> {
  const normalizedProfile = profileName.trim();
  if (!normalizedProfile) {
    return txProfileModeFallback("", currentValue);
  }
  const cached = txProfileModesCache.get(normalizedProfile);
  if (cached) return cached;
  try {
    const modePayload =
      await transactionProfileModeRuntime.getProfileModes(normalizedProfile);
    const modeOptions = normalizedModeOptions(modePayload.modes);
    const defaultMode =
      modePayload.default_mode.trim() || modeOptions[0] || currentValue.trim();
    const resolved = {
      defaultMode,
      modes:
        modeOptions.length > 0 ? modeOptions : defaultMode ? [defaultMode] : [],
      name: modePayload.name.trim() || normalizedProfile,
    };
    txProfileModesCache.set(normalizedProfile, resolved);
    return resolved;
  } catch {
    return txProfileModeFallback(normalizedProfile, currentValue);
  }
}

function txProfileModeInitialState(): TxProfileModeState {
  return {
    defaultMode: "",
    modes: [],
    name: "",
  };
}

export function createTxProfileModeLoader({
  currentMode = () => "",
  explicitProfile = () => "",
}: {
  currentMode?: () => string;
  explicitProfile?: () => string;
} = {}): TxProfileModeLoader {
  let currentConnectionProfile = "autodetect";
  let currentRequestVersion = 0;
  const state = writable(txProfileModeInitialState());

  async function refresh(): Promise<TxProfileModeState> {
    const profileName = explicitProfile().trim() || currentConnectionProfile;
    currentRequestVersion += 1;
    const requestVersion = currentRequestVersion;
    const nextValue = await loadTxProfileModes(profileName, currentMode());
    if (requestVersion === currentRequestVersion) state.set(nextValue);
    return nextValue;
  }

  const unsubscribeProfile =
    transactionProfileModeRuntime.executionConnectionProfileState.subscribe(
      (profileName) => {
        currentConnectionProfile = profileName.trim() || "autodetect";
        void refresh();
      },
    );
  const unsubscribeSavedConnectionsRefresh =
    transactionProfileModeRuntime.savedConnectionsRefreshState.subscribe(() => {
      void refresh();
    });

  return {
    destroy() {
      unsubscribeProfile();
      unsubscribeSavedConnectionsRefresh();
    },
    refresh,
    state,
  };
}
