import { writable } from "svelte/store";
import { storageGet, storageRemove, storageSet } from "../lib/browser.js";
import {
  safeString,
  selectOptionsWithCurrent,
  statusPresentation,
} from "../lib/ui.js";
import { showToast } from "./overlays.js";
import {
  setConnectionPickerSavedConnections,
  visibleConnectionProfileOptions,
} from "./connectionFields.js";

const CONNECTION_TARGET_STORAGE_KEY = "rauto_connection_target";

let savedConnectionsCache = [];
let selectedSavedConnectionNameState = "";
let savedConnectionDetailsCacheState = new Map();
let temporaryConnectionActiveState = false;
let temporaryConnectionLabelState = "";
let temporaryConnectionDetailsState = null;
let currentConnectionTargetState = { kind: "none", details: null };

export const connectionTargetState = writable(currentConnectionTargetState);
export const connectionOverlayState = writable({
  modalMode: "saved",
  modalOpen: false,
  savedEditorOpen: false,
});
export const connectionModalFocusRequest = writable({
  target: "",
  version: 0,
});
export const savedConnectionStatusState = writable({
  message: "",
  tone: "info",
});
export const savedConnectionSelectState = writable({
  options: [],
  selected: "",
});
export const sidebarConnectionState = writable({
  card: null,
  errorMessage: "",
});
export const savedConnectionsRefreshState = writable(0);

function connectionTargetStorageKey() {
  return CONNECTION_TARGET_STORAGE_KEY;
}

function savedConnectionSelectPayload() {
  const connectionNames = savedConnectionsCache
    .map((savedConnection) => savedConnection.name)
    .filter(Boolean);
  return {
    connections: savedConnectionsCache,
    options: visibleConnectionProfileOptions(
      connectionNames,
      selectedSavedConnectionNameState,
    ),
    selected: selectedSavedConnectionNameState,
  };
}

function updateSavedConnectionSelectState() {
  savedConnectionSelectState.set(savedConnectionSelectPayload());
}

function normalizeConnectionModalMode(mode) {
  return mode === "temporary" ? "temporary" : "saved";
}

function focusConnectionModalField(targetKey) {
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

function removePersistedConnectionTarget() {
  storageRemove(connectionTargetStorageKey());
}

function persistedSavedConnectionTarget(details = {}) {
  const name = safeString(details.name || "").trim();
  return name
    ? {
        kind: "saved",
        name,
      }
    : null;
}

function defaultPersistedConnectionTarget(details = null) {
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
      username: safeString(details.username || "").trim(),
    };
  }
  return null;
}

function persistConnectionTargetValue(persistedTarget = null) {
  try {
    if (!persistedTarget || !persistedTarget.kind) {
      removePersistedConnectionTarget();
      return;
    }
    storageSet(connectionTargetStorageKey(), JSON.stringify(persistedTarget));
  } catch (_) {}
}

function setConnectionStatus(statusStore, message = "-", tone = "info") {
  const presentation = statusPresentation(message, tone);
  statusStore.set({
    message: presentation.inlineMessage,
    tone: presentation.tone,
  });
  if (presentation.shouldToast) {
    showToast(presentation.text, presentation.tone);
  }
}

function sidebarConnectionPayload(config = {}) {
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

function updateSidebarConnectionState(config = {}) {
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
  try {
    const raw = storageGet(connectionTargetStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    removePersistedConnectionTarget();
    return null;
  }
}

export function refreshSidebarConnectionState({
  currentTemporaryConnectionDetails,
  errorMessage = "",
  savedConnectionDetails,
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

export function setCachedSavedConnections(connections = []) {
  savedConnectionsCache = Array.isArray(connections) ? connections : [];
  setConnectionPickerSavedConnections(savedConnectionsCache);
  updateSavedConnectionSelectState();
  return savedConnectionsCache;
}

export function setConnectionModalMode(mode, focusTarget = "") {
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
  details = null,
  persistedTarget = undefined,
) {
  if (!details) {
    currentConnectionTargetState = { kind: "none", details: null };
    connectionTargetState.set(currentConnectionTargetState);
    removePersistedConnectionTarget();
    return;
  }
  currentConnectionTargetState = {
    kind: details.kind || "saved",
    details: { ...details },
  };
  connectionTargetState.set(currentConnectionTargetState);
  persistConnectionTargetValue(
    persistedTarget === undefined
      ? defaultPersistedConnectionTarget(currentConnectionTargetState.details)
      : persistedTarget,
  );
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
  active,
  label = "",
  details = null,
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
