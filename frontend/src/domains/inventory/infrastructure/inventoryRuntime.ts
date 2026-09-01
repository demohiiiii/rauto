import {
  loadSavedConnections,
  savedConnectionsRefreshState,
} from "$domains/connections/index.js";
import { setConnectionInventorySnapshots } from "$domains/connections/index.js";
import { protectedDashboardResourcesRefreshState } from "$domains/dashboard/index.js";
import type { InventoryRuntime } from "../model/types.js";

export const inventoryRuntime: InventoryRuntime = {
  protectedResourcesRefreshState: protectedDashboardResourcesRefreshState,
  reloadSavedConnections: loadSavedConnections,
  savedConnectionsRefreshState,
  syncConnectionInventory(groups, labels) {
    setConnectionInventorySnapshots({ groups, labels });
  },
};
