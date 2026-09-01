import { refreshConnectionProfileOptions } from "../../../modules/connections/connections.js";
import {
  getCachedDeviceProfiles,
  setCachedDeviceProfiles,
} from "../../templates/index.js";

export const profileCatalogRuntime = {
  getCachedDeviceProfiles,
  refreshConnectionProfileOptions,
  setCachedDeviceProfiles,
};
