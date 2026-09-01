import {
  getBuiltinProfileDetail,
  getBuiltinProfileForm,
  getDeviceProfilesOverview,
} from "../../../api/client.js";
import type { ProfileCatalogApi } from "../model/profileCatalog.js";

export const profileCatalogApi: ProfileCatalogApi = {
  getBuiltinProfileDetail,
  getBuiltinProfileForm,
  getDeviceProfilesOverview,
};
