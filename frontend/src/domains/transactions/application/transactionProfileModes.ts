import { writable } from "svelte/store";
import { stringValue } from "../../../lib/jsonValue.js";
import { transactionProfileModeRuntime } from "../infrastructure/transactionProfileModeRuntime.js";
import type {
  TxProfileModeLoader,
  TxProfileModeState,
} from "../model/types.js";

const txStringValue = stringValue;
let txProfileModesCache = new Map<string, TxProfileModeState>();

function normalizedModeOptions(modeValues: unknown = []): string[] {
  return Array.from(
    new Set(
      (Array.isArray(modeValues) ? modeValues : [])
        .map((modeValue) => txStringValue(modeValue).trim())
        .filter(Boolean),
    ),
  );
}

function txProfileModeFallback(
  profileName: unknown = "",
  currentValue: unknown = "",
): TxProfileModeState {
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

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function loadTxProfileModes(
  profileName: unknown = "",
  currentValue: unknown = "",
): Promise<TxProfileModeState> {
  const normalizedProfile = txStringValue(profileName).trim();
  if (!normalizedProfile) {
    return txProfileModeFallback("", currentValue);
  }
  const cached = txProfileModesCache.get(normalizedProfile);
  if (cached) return cached;
  try {
    const modePayload = recordValue(
      await transactionProfileModeRuntime.getProfileModes(normalizedProfile),
    );
    const modeOptions = normalizedModeOptions(modePayload.modes);
    const defaultMode =
      txStringValue(modePayload.default_mode).trim() ||
      modeOptions[0] ||
      txStringValue(currentValue).trim();
    const resolved = {
      defaultMode,
      modes:
        modeOptions.length > 0 ? modeOptions : defaultMode ? [defaultMode] : [],
      name: txStringValue(modePayload.name).trim() || normalizedProfile,
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
  currentMode?: () => unknown;
  explicitProfile?: () => unknown;
} = {}): TxProfileModeLoader {
  let currentConnectionProfile = "autodetect";
  let currentRequestVersion = 0;
  const state = writable(txProfileModeInitialState());

  async function refresh(): Promise<TxProfileModeState> {
    const profileName =
      txStringValue(explicitProfile()).trim() || currentConnectionProfile;
    currentRequestVersion += 1;
    const requestVersion = currentRequestVersion;
    const nextValue = await loadTxProfileModes(profileName, currentMode());
    if (requestVersion === currentRequestVersion) state.set(nextValue);
    return nextValue;
  }

  const unsubscribeProfile =
    transactionProfileModeRuntime.executionConnectionProfileState.subscribe(
      (profileName) => {
        currentConnectionProfile =
          txStringValue(profileName).trim() || "autodetect";
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
