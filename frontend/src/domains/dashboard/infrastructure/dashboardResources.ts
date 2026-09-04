import {
  loadSavedConnections,
  refreshConnectionProfileOptions,
  refreshSidebarConnectionSelector,
  setSavedConnectionStatus,
} from "$domains/connections/index.js";
import { showToast } from "$domains/overlays/index.js";

export const dashboardResources = {
  loadSavedConnections(): Promise<void> {
    return loadSavedConnections();
  },
  refreshConnectionProfileOptions(): void {
    refreshConnectionProfileOptions();
  },
  refreshSidebarConnectionSelector(): void {
    refreshSidebarConnectionSelector();
  },
  setSavedConnectionStatus(message: string, tone: string): void {
    setSavedConnectionStatus(message, tone);
  },
  showToast(message: string, tone: string): void {
    showToast(message, tone);
  },
};
