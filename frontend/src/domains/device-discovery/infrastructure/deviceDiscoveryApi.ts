import {
  cancelDeviceDiscoveryRun,
  createDeviceDiscoveryRun,
  getDeviceDiscoveryRun,
  importDeviceDiscoveryResults,
  listCredentials,
  listDeviceDiscoveryRuns,
  listInventoryGroups,
  listInventoryLabels,
} from "../../../api/client.js";
import type { DeviceDiscoveryApi } from "../model/types.js";

export const deviceDiscoveryApi: DeviceDiscoveryApi = {
  cancelRun: cancelDeviceDiscoveryRun,
  createRun: createDeviceDiscoveryRun,
  getRun: getDeviceDiscoveryRun,
  importResults: importDeviceDiscoveryResults,
  listCredentials,
  listGroups: listInventoryGroups,
  listLabels: listInventoryLabels,
  listRuns: listDeviceDiscoveryRuns,
};
