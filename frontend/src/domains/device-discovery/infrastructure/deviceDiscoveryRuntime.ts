import { notifySavedConnectionsRefreshed } from "$domains/connections/index.js";
import type { DeviceDiscoveryRuntime } from "../model/types.js";

export const deviceDiscoveryRuntime: DeviceDiscoveryRuntime = {
  notifyConnectionsRefreshed: notifySavedConnectionsRefreshed,
};
