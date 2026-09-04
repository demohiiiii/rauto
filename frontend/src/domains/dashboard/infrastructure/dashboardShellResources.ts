import {
  openConnectionModal,
  sidebarConnectionPresentation,
  sidebarConnectionState,
} from "$domains/connections/index.js";
import type { SidebarConnectionState } from "$domains/connections/index.js";
import { createLazyComponentRegistry } from "../../../lib/svelte.js";
import type { DashboardPageRegistry } from "../model/types.js";
import type {
  DashboardPageComponent,
  DashboardPageDefinition,
} from "../model/types.js";

type SidebarConnectionDisplay = ReturnType<
  typeof sidebarConnectionPresentation
>;

export const dashboardShellResources = {
  createPageRegistry(errorMessage: () => string): DashboardPageRegistry {
    return createLazyComponentRegistry<
      DashboardPageDefinition,
      DashboardPageComponent
    >({
      errorMessage,
    });
  },
  openConnectionEditor(): void {
    openConnectionModal();
  },
  sidebarConnectionPresentation(
    connectionState: SidebarConnectionState,
  ): SidebarConnectionDisplay {
    return sidebarConnectionPresentation(connectionState);
  },
  sidebarConnectionState,
};
