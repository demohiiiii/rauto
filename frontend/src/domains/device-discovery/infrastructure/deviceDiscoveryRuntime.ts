import { loadSavedConnections } from "$domains/connections/index.js";
import type { DeviceDiscoveryRuntime } from "../model/types.js";

export const deviceDiscoveryRuntime: DeviceDiscoveryRuntime = {
  async notifyConnectionsRefreshed() {
    // Discovery imports are persisted by the API. Refresh the shared
    // connection cache so the connection workbench and pickers see them
    // without requiring a page reload.
    await loadSavedConnections();
  },
};
