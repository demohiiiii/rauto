import { notifySavedConnectionsRefreshed } from "../../../modules/connections/connectionTargetStoreState.js";
import type { DeviceDiscoveryRuntime } from "../model/types.js";

export const deviceDiscoveryRuntime: DeviceDiscoveryRuntime = {
  notifyConnectionsRefreshed: notifySavedConnectionsRefreshed,
};
