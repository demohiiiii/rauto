import { getWebAuthStatus, loginWeb } from "../../../api/client.js";
import type { AuthApi } from "../model/types.js";

export const authApi = {
  getStatus: getWebAuthStatus,
  login: loginWeb,
} as AuthApi;
