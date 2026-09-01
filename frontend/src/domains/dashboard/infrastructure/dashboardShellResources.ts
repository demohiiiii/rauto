import type { Readable } from "svelte/store";
import {
  openConnectionModal,
  sidebarConnectionPresentation,
  sidebarConnectionState,
} from "$domains/connections/index.js";
import { createLazyComponentRegistry } from "../../../lib/svelte.js";
import type {
  DashboardPageRegistry,
  DashboardSidebarConnectionDisplay,
  DashboardSidebarConnectionState,
} from "../model/types.js";

export const dashboardShellResources = {
  createPageRegistry(errorMessage: () => string): DashboardPageRegistry {
    return createLazyComponentRegistry({
      errorMessage,
    }) as unknown as DashboardPageRegistry;
  },
  openConnectionEditor(): void {
    openConnectionModal();
  },
  sidebarConnectionPresentation(
    connectionState: DashboardSidebarConnectionState,
  ): DashboardSidebarConnectionDisplay {
    return sidebarConnectionPresentation(
      connectionState,
    ) as DashboardSidebarConnectionDisplay;
  },
  sidebarConnectionState:
    sidebarConnectionState as Readable<DashboardSidebarConnectionState>,
};
