import {
  beginConnectionInventoryRefresh,
  loadSavedConnections,
  refreshConnectionProfileOptions,
  refreshSidebarConnectionSelector,
  setSavedConnectionStatus,
  setConnectionInventorySnapshots,
} from "$domains/connections/index.js";
import { showToast } from "$domains/overlays/index.js";
import { dashboardApi } from "./dashboardApi.js";

export const dashboardResources = {
  async loadConnectionInventory(): Promise<void> {
    const version = beginConnectionInventoryRefresh();
    const [groups, labels] = await Promise.all([
      dashboardApi.listInventoryGroups(),
      dashboardApi.listInventoryLabels(),
    ]);
    setConnectionInventorySnapshots({ groups, labels }, version);
  },
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
