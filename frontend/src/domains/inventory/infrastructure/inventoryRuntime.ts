import {
  loadSavedConnections,
  savedConnectionsRefreshState,
} from "../../../modules/connections/connections.js";
import { setConnectionInventorySnapshots } from "../../../modules/connections/connectionFieldStoreState.js";
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
