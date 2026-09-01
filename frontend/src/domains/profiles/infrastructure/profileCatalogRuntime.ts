import { refreshConnectionProfileOptions } from "$domains/connections/index.js";
import {
  getCachedDeviceProfiles,
  setCachedDeviceProfiles,
} from "../../templates/index.js";

export const profileCatalogRuntime = {
  getCachedDeviceProfiles,
  refreshConnectionProfileOptions,
  setCachedDeviceProfiles,
};
