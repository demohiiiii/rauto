import { derived, get } from "svelte/store";
import type { Readable } from "svelte/store";
import {
  closeConnectionModal,
  connectionOverlayState,
  hideSavedConnectionEditorModal,
} from "$domains/connections/index.js";
import {
  applyOverlayBodyLock,
  closeDetailModal,
  closeEntryDrawer,
  closeRecordDrawer,
  dashboardRecordToolsPresentation as overlayRecordToolsPresentation,
  detailModal,
  entryDrawer,
  openRecordDrawer,
  overlayDrawerState,
  recordLevelState,
  toggleRecordLevel,
} from "$domains/overlays/index.js";
import { eventKeyIs } from "../../../lib/events.js";
import { createLazyComponentRegistry } from "../../../lib/svelte.js";
import { dashboardOverlayDefinitions } from "../model/navigation.js";
import type {
  DashboardConnectionOverlayState,
  DashboardDetailOverlayState,
  DashboardDrawerOverlayState,
  DashboardEntryOverlayState,
  DashboardOverlayComponents,
  DashboardOverlayHostDisplay,
  DashboardOverlayHostWorkspace,
  DashboardOverlayId,
  DashboardRecordToolsDisplay,
} from "../model/types.js";

interface DashboardOverlayPresentationInput {
  connectionState?: Partial<DashboardConnectionOverlayState>;
  detailState?: Partial<DashboardDetailOverlayState>;
  entryState?: Partial<DashboardEntryOverlayState>;
  overlayState?: Partial<DashboardDrawerOverlayState>;
}

export const dashboardOverlayDrawerState: Readable<DashboardDrawerOverlayState> =
  overlayDrawerState;
export const dashboardRecordLevelState: Readable<string> = recordLevelState;

const dashboardOverlayConnectionState =
  connectionOverlayState as Readable<DashboardConnectionOverlayState>;
const dashboardOverlayDetailState =
  detailModal as Readable<DashboardDetailOverlayState>;
const dashboardOverlayEntryState =
  entryDrawer as Readable<DashboardEntryOverlayState>;

const applyDashboardOverlayBodyLock = (locked: boolean): (() => void) =>
  applyOverlayBodyLock(locked);

export const closeDashboardEntryDrawer = () => closeEntryDrawer();
export const closeDashboardRecordDrawer = () => closeRecordDrawer();
export const closeDashboardOverlayOnEscape = (event: KeyboardEvent): boolean =>
  closeTopDashboardOverlayOnEscape(event);
export const openDashboardRecordDrawer = () => openRecordDrawer();
export const toggleDashboardRecordLevel = () => toggleRecordLevel();

export function dashboardRecordToolsPresentation({
  overlayState = {},
  recordLevel = "",
}: {
  overlayState?: Partial<DashboardDrawerOverlayState>;
  recordLevel?: string;
} = {}): DashboardRecordToolsDisplay {
  return overlayRecordToolsPresentation({
    overlayState,
    recordLevel,
  });
}

function closeTopDashboardOverlayOnEscape(event: KeyboardEvent): boolean {
  if (!eventKeyIs(event, "Escape")) return false;

  const connectionState = get(dashboardOverlayConnectionState);
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

  return false;
}

function dashboardOverlayHostPresentation({
  connectionState = {},
  detailState = {},
  entryState = {},
  overlayState = {},
}: DashboardOverlayPresentationInput = {}): DashboardOverlayHostDisplay {
  const connectionModalOpen = !!connectionState.modalOpen;
  const detailModalOpen = !!detailState.open;
  const entryDrawerOpen = !!entryState.open;
  const recordDrawerOpen = !!overlayState.recordDrawerOpen;
  const savedConnectionEditorOpen = !!connectionState.savedEditorOpen;

  return {
    bodyLocked: recordDrawerOpen || detailModalOpen || entryDrawerOpen,
    connectionModalOpen,
    detailModalOpen,
    entryDrawerOpen,
    recordDrawerOpen,
    savedConnectionEditorOpen,
  };
}

export function createDashboardOverlayHostWorkspace(): DashboardOverlayHostWorkspace {
  const overlayRegistry = createLazyComponentRegistry({
    resolveId: (id: DashboardOverlayId) => id,
    resolveLoad: (id: DashboardOverlayId) => dashboardOverlayDefinitions[id],
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
    ($loadedOverlayComponents): DashboardOverlayComponents => ({
      connectionModal: $loadedOverlayComponents.connectionModal || null,
      detailModal: $loadedOverlayComponents.detailModal || null,
      entryDrawer: $loadedOverlayComponents.entryDrawer || null,
      recordDrawer: $loadedOverlayComponents.recordDrawer || null,
      savedConnectionEditModal:
        $loadedOverlayComponents.savedConnectionEditModal || null,
    }),
  );

  function ensureLoadedOverlays(
    hostDisplay: Partial<DashboardOverlayHostDisplay> = {},
  ): void {
    if (hostDisplay.connectionModalOpen) {
      overlayRegistry.ensure("connectionModal");
    }
    if (hostDisplay.detailModalOpen) {
      overlayRegistry.ensure("detailModal");
    }
    if (hostDisplay.entryDrawerOpen) {
      overlayRegistry.ensure("entryDrawer");
    }
    if (hostDisplay.recordDrawerOpen) {
      overlayRegistry.ensure("recordDrawer");
    }
    if (hostDisplay.savedConnectionEditorOpen) {
      overlayRegistry.ensure("savedConnectionEditModal");
    }
  }

  function applyHostDisplay(
    hostDisplay: Partial<DashboardOverlayHostDisplay> = {},
  ): () => void {
    ensureLoadedOverlays(hostDisplay);
    return applyDashboardOverlayBodyLock(!!hostDisplay.bodyLocked);
  }

  return {
    applyHostDisplay,
    hostDisplayStateStore,
    overlayComponentsStateStore,
  };
}
