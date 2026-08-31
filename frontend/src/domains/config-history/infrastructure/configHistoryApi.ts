import {
  deleteDeviceConfigSnapshot,
  getDeviceConfigSnapshot,
  listConnections,
  listDeviceConfigHistory,
  listDeviceConfigHistoryDevices,
} from "../../../api/client.js";
import type { ConfigHistoryApi } from "../model/types.js";

export const configHistoryApi: ConfigHistoryApi = {
  deleteDeviceConfigSnapshot,
  getDeviceConfigSnapshot,
  listConnections,
  listDeviceConfigHistory,
  listDeviceConfigHistoryDevices,
};
