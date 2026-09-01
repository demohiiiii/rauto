import { writable } from "svelte/store";
import type { Writable } from "svelte/store";
import {
  safeString,
  selectOptionsWithCurrent,
  statusPresentation,
} from "../../../lib/ui.js";
import { showToast } from "$domains/overlays/index.js";
import { visibleConnectionProfileOptions } from "$domains/connections/application/connectionFieldState.js";
import { setConnectionPickerSavedConnections } from "$domains/connections/application/connectionFieldStoreState.js";
import {
  clearPersistedConnectionTarget,
  readConnectionTargetPersistence,
  writeConnectionTargetPersistence,
} from "../infrastructure/connectionTargetPersistence.js";
import type {
  ConnectionFocusRequest,
  ConnectionOverlayState,
  ConnectionStatus,
  ConnectionTargetDetails,
  ConnectionTargetState,
  PersistedConnectionTarget,
  SavedConnection,
  SavedConnectionDetail,
  SavedConnectionSelectState,
  SidebarConnectionCard,
  SidebarConnectionState,
} from "../model/types.js";

let savedConnectionsCache: SavedConnection[] = [];
let selectedSavedConnectionNameState = "";
const savedConnectionDetailsCacheState = new Map<
  string,
  SavedConnectionDetail
>();
let temporaryConnectionActiveState = false;
let temporaryConnectionLabelState = "";
let temporaryConnectionDetailsState: ConnectionTargetDetails | null = null;
let currentConnectionTargetState: ConnectionTargetState = {
  kind: "none",
  details: null,
};

export const connectionTargetState = writable<ConnectionTargetState>(
  currentConnectionTargetState,
);
export const connectionOverlayState = writable<ConnectionOverlayState>({
  modalMode: "saved",
  modalOpen: false,
  savedEditorOpen: false,
});
export const connectionModalFocusRequest = writable<ConnectionFocusRequest>({
  target: "",
  version: 0,
});
export const savedConnectionStatusState = writable<ConnectionStatus>({
  message: "",
  tone: "info",
});
export const savedConnectionSelectState = writable<SavedConnectionSelectState>({
  options: [],
  selected: "",
});
export const sidebarConnectionState = writable<SidebarConnectionState>({
  card: null,
  errorMessage: "",
});
export const savedConnectionsRefreshState = writable(0);

function savedConnectionSelectPayload() {
  const connectionNames = savedConnectionsCache
    .map((savedConnection) => savedConnection.name)
    .filter((name): name is string => Boolean(name));
  return {
    connections: savedConnectionsCache,
    options: visibleConnectionProfileOptions(
      connectionNames,
      selectedSavedConnectionNameState,
    ),
    selected: selectedSavedConnectionNameState,
  };
}

function updateSavedConnectionSelectState(): void {
  savedConnectionSelectState.set(savedConnectionSelectPayload());
}

function normalizeConnectionModalMode(mode: unknown): "saved" | "temporary" {
  return mode === "temporary" ? "temporary" : "saved";
}

function focusConnectionModalField(targetKey: unknown): void {
  const target = String(targetKey || "").trim();
  if (!target) return;
  connectionModalFocusRequest.update((state) => ({
    target,
    version: (state.version || 0) + 1,
  }));
}

function connectionModalFocusTarget(mode = "") {
  return mode === "temporary" ? "temporaryHostInput" : "savedConnectionSelect";
}

function persistedSavedConnectionTarget(
  details: ConnectionTargetDetails = {},
): PersistedConnectionTarget | null {
  const name = safeString(details.name || "").trim();
  return name
    ? {
        kind: "saved",
        name,
      }
    : null;
}

function defaultPersistedConnectionTarget(
  details: ConnectionTargetDetails | null = null,
): PersistedConnectionTarget | null {
  if (!details || !details.kind || details.kind === "none") {
    return null;
  }
  if (details.kind === "saved") {
    return persistedSavedConnectionTarget(details);
  }
  if (details.kind === "temporary") {
    return {
      kind: "temporary",
      device_profile:
        safeString(
          details.profile || details.device_profile || "autodetect",
        ).trim() || "autodetect",
      host: safeString(details.host || "").trim(),
      port: Number(details.port || 22) || 22,
      credential_id: safeString(
        details.credentialId || details.credential_id || "",
      ).trim(),
    };
  }
  return null;
}

function setConnectionStatus(
  statusStore: Writable<ConnectionStatus>,
  message = "-",
  tone = "info",
): void {
  const presentation = statusPresentation(message, tone);
  statusStore.set({
    message: presentation.inlineMessage,
    tone: presentation.tone,
  });
  if (presentation.shouldToast) {
    showToast(presentation.text, presentation.tone);
  }
}

function sidebarConnectionPayload(
  config: {
    currentTemporaryConnectionDetails?: () => ConnectionTargetDetails;
    errorMessage?: string;
    savedConnectionDetails?: (
      connection: SavedConnection,
    ) => ConnectionTargetDetails;
    target?: ConnectionTargetState;
  } = {},
): SidebarConnectionState {
  const {
    currentTemporaryConnectionDetails,
    errorMessage = "",
    savedConnectionDetails,
    target,
  } = config;

  if (errorMessage) {
    return { errorMessage, card: null };
  }

  if (target?.kind === "temporary" && target.details) {
    const details =
      typeof currentTemporaryConnectionDetails === "function"
        ? currentTemporaryConnectionDetails()
        : {};
    return {
      errorMessage: "",
      card: {
        ...details,
        ...target.details,
        kind: "temporary",
      },
    };
  }

  if (target?.kind === "saved" && target.details) {
    const targetName = safeString(target.details.name || "").trim();
    const selected = savedConnectionsCache.find(
      (savedConnection) => savedConnection.name === targetName,
    );
    const savedDetails =
      selected && typeof savedConnectionDetails === "function"
        ? savedConnectionDetails(selected)
        : {};
    return {
      errorMessage: "",
      card: selected
        ? {
            ...savedDetails,
            ...target.details,
            kind: "saved",
          }
        : {
            ...target.details,
            kind: "saved",
          },
    };
  }

  return { errorMessage: "", card: null };
}

function updateSidebarConnectionState(
  config: Parameters<typeof sidebarConnectionPayload>[0] = {},
): void {
  sidebarConnectionState.set(sidebarConnectionPayload(config));
}

export function activeConnectionTarget() {
  return currentConnectionTargetState;
}

export function clearSavedConnectionDetailCache() {
  savedConnectionDetailsCacheState.clear();
}

export function closeConnectionModal() {
  connectionOverlayState.update((state) => ({
    ...state,
    modalOpen: false,
  }));
}

export function currentSavedConnections() {
  return savedConnectionsCache;
}

export function isTemporaryConnectionActive() {
  return temporaryConnectionActiveState;
}

export function notifySavedConnectionsRefreshed() {
  savedConnectionsRefreshState.update((version) => version + 1);
}

export function openConnectionModal(mode = "saved", focusTarget = "") {
  const modalMode = normalizeConnectionModalMode(mode);
  connectionOverlayState.update((state) => ({
    ...state,
    modalMode,
    modalOpen: true,
  }));
  setSavedConnectionStatus("", "info");
  focusConnectionModalField(
    focusTarget || connectionModalFocusTarget(modalMode),
  );
}

export function readPersistedConnectionTarget() {
  return readConnectionTargetPersistence();
}

export function refreshSidebarConnectionState({
  currentTemporaryConnectionDetails,
  errorMessage = "",
  savedConnectionDetails,
}: {
  currentTemporaryConnectionDetails?: () => ConnectionTargetDetails;
  errorMessage?: string;
  savedConnectionDetails?: (
    connection: SavedConnection,
  ) => ConnectionTargetDetails;
} = {}) {
  updateSidebarConnectionState({
    currentTemporaryConnectionDetails,
    errorMessage,
    savedConnectionDetails,
    target: activeConnectionTarget(),
  });
}

export function savedConnectionDetailsCache() {
  return savedConnectionDetailsCacheState;
}

export function selectedSavedConnectionName() {
  return selectedSavedConnectionNameState;
}

export function setCachedSavedConnections(connections: SavedConnection[] = []) {
  savedConnectionsCache = Array.isArray(connections) ? connections : [];
  setConnectionPickerSavedConnections(savedConnectionsCache);
  updateSavedConnectionSelectState();
  return savedConnectionsCache;
}

export function setConnectionModalMode(mode: unknown, focusTarget = "") {
  const modalMode = normalizeConnectionModalMode(mode);
  connectionOverlayState.update((state) => ({
    ...state,
    modalMode,
  }));
  focusConnectionModalField(
    focusTarget || connectionModalFocusTarget(modalMode),
  );
}

export function setCurrentConnectionTarget(
  details: ConnectionTargetDetails | null = null,
  persistedTarget: PersistedConnectionTarget | null | undefined = undefined,
) {
  if (!details) {
    currentConnectionTargetState = { kind: "none", details: null };
    connectionTargetState.set(currentConnectionTargetState);
    clearPersistedConnectionTarget();
    return;
  }
  const connection =
    persistedTarget === undefined
      ? defaultPersistedConnectionTarget(details)
      : persistedTarget;
  currentConnectionTargetState = {
    kind: details.kind || "saved",
    details: { ...details },
    connection:
      connection && typeof connection === "object"
        ? { ...connection }
        : connection,
  };
  connectionTargetState.set(currentConnectionTargetState);
  writeConnectionTargetPersistence(connection);
}

export function setSavedConnectionSelectValue(savedConnectionName = "") {
  selectedSavedConnectionNameState = safeString(
    savedConnectionName || "",
  ).trim();
  updateSavedConnectionSelectState();
}

export function setSavedConnectionStatus(message = "-", tone = "info") {
  setConnectionStatus(savedConnectionStatusState, message, tone);
}

export function setTemporaryConnectionState(
  active: unknown,
  label = "",
  details: ConnectionTargetDetails | null = null,
) {
  temporaryConnectionActiveState = !!active;
  temporaryConnectionLabelState = label || "";
  temporaryConnectionDetailsState = details || null;
}

export function storedTemporaryConnectionDetails() {
  return temporaryConnectionDetailsState;
}

export function storedTemporaryConnectionLabel() {
  return temporaryConnectionLabelState;
}

export function visibleSavedConnectionNames(selected = "") {
  const savedConnectionNames = savedConnectionsCache
    .map((savedConnection) => safeString(savedConnection?.name).trim())
    .filter(Boolean);
  return selectOptionsWithCurrent(
    savedConnectionNames,
    safeString(selected || "").trim(),
  );
}
