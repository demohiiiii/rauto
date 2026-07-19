import { derived, get } from "svelte/store";
import {
  closeConnectionModal,
  connectionOverlayState,
  hideSavedConnectionEditorModal,
} from "../connections/connections.js";
import {
  applyOverlayBodyLock,
  closeDetailModal,
  closeEntryDrawer,
  closeHistoryDrawer,
  closeRecordDrawer,
  dashboardRecordToolsPresentation,
  detailModal,
  entryDrawer,
  openRecordDrawer,
  overlayDrawerState,
  recordLevelState,
  toggleRecordLevel,
} from "../overlays/overlays.js";
import { createLazyComponentRegistry } from "../../lib/svelte.js";
import { eventKeyIs } from "../../lib/events.js";
import { dashboardOverlayDefinitions } from "../../config/dashboardNavigation.js";

export const dashboardOverlayDrawerState = overlayDrawerState;
export const dashboardRecordLevelState = recordLevelState;

const dashboardOverlayConnectionState = connectionOverlayState;
const dashboardOverlayDetailState = detailModal;
const dashboardOverlayEntryState = entryDrawer;

const applyDashboardOverlayBodyLock = (locked) => applyOverlayBodyLock(locked);

export const closeDashboardEntryDrawer = () => closeEntryDrawer();
export const closeDashboardHistoryDrawer = () => closeHistoryDrawer();
export const closeDashboardRecordDrawer = () => closeRecordDrawer();
export const closeDashboardOverlayOnEscape = (event) =>
  closeTopDashboardOverlayOnEscape(event);
export const openDashboardRecordDrawer = () => openRecordDrawer();
export const toggleDashboardRecordLevel = () => toggleRecordLevel();

export { dashboardRecordToolsPresentation };

function closeTopDashboardOverlayOnEscape(event) {
  if (!eventKeyIs(event, "Escape")) return false;

  const connectionState = get(connectionOverlayState);
  if (connectionState.savedEditorOpen) {
    hideSavedConnectionEditorModal();
    return true;
  }

  if (get(entryDrawer).open) {
    closeEntryDrawer();
    return true;
  }

  if (connectionState.modalOpen) {
    closeConnectionModal();
    return true;
  }

  if (get(detailModal).open) {
    closeDetailModal();
    return true;
  }

  const drawerState = get(overlayDrawerState);
  if (drawerState.recordDrawerOpen) {
    closeRecordDrawer();
    return true;
  }

  if (drawerState.historyDrawerOpen) {
    closeHistoryDrawer();
    return true;
  }

  return false;
}

function dashboardOverlayHostPresentation({
  connectionState = {},
  detailState = {},
  entryState = {},
  overlayState = {},
} = {}) {
  const connectionModalOpen = !!connectionState.modalOpen;
  const detailModalOpen = !!detailState.open;
  const entryDrawerOpen = !!entryState.open;
  const historyDrawerOpen = !!overlayState.historyDrawerOpen;
  const recordDrawerOpen = !!overlayState.recordDrawerOpen;
  const savedConnectionEditorOpen = !!connectionState.savedEditorOpen;

  return {
    bodyLocked:
      recordDrawerOpen ||
      historyDrawerOpen ||
      detailModalOpen ||
      entryDrawerOpen,
    connectionModalOpen,
    detailModalOpen,
    entryDrawerOpen,
    historyDrawerOpen,
    recordDrawerOpen,
    savedConnectionEditorOpen,
  };
}

export function createDashboardOverlayHostWorkspace() {
  const overlayRegistry = createLazyComponentRegistry({
    resolveId: (id) => id,
    resolveLoad: (id) => dashboardOverlayDefinitions[id],
  });
  const hostDisplayStateStore = derived(
    [
      dashboardOverlayConnectionState,
      dashboardOverlayDetailState,
      dashboardOverlayEntryState,
      dashboardOverlayDrawerState,
    ],
    ([
      $dashboardOverlayConnectionState,
      $dashboardOverlayDetailState,
      $dashboardOverlayEntryState,
      $dashboardOverlayDrawerState,
    ]) =>
      dashboardOverlayHostPresentation({
        connectionState: $dashboardOverlayConnectionState,
        detailState: $dashboardOverlayDetailState,
        entryState: $dashboardOverlayEntryState,
        overlayState: $dashboardOverlayDrawerState,
      }),
  );
  const overlayComponentsStateStore = derived(
    overlayRegistry.components,
    ($loadedOverlayComponents) => ({
      connectionModal: $loadedOverlayComponents.connectionModal || null,
      detailModal: $loadedOverlayComponents.detailModal || null,
      entryDrawer: $loadedOverlayComponents.entryDrawer || null,
      historyDrawer: $loadedOverlayComponents.historyDrawer || null,
      recordDrawer: $loadedOverlayComponents.recordDrawer || null,
      savedConnectionEditModal:
        $loadedOverlayComponents.savedConnectionEditModal || null,
    }),
  );

  function ensureLoadedOverlays(hostDisplay = {}) {
    if (hostDisplay.connectionModalOpen) {
      overlayRegistry.ensure("connectionModal");
    }
    if (hostDisplay.detailModalOpen) {
      overlayRegistry.ensure("detailModal");
    }
    if (hostDisplay.entryDrawerOpen) {
      overlayRegistry.ensure("entryDrawer");
    }
    if (hostDisplay.historyDrawerOpen) {
      overlayRegistry.ensure("historyDrawer");
    }
    if (hostDisplay.recordDrawerOpen) {
      overlayRegistry.ensure("recordDrawer");
    }
    if (hostDisplay.savedConnectionEditorOpen) {
      overlayRegistry.ensure("savedConnectionEditModal");
    }
  }

  function applyHostDisplay(hostDisplay = {}) {
    ensureLoadedOverlays(hostDisplay);
    return applyDashboardOverlayBodyLock(hostDisplay.bodyLocked);
  }

  return {
    applyHostDisplay,
    hostDisplayStateStore,
    overlayComponentsStateStore,
  };
}
