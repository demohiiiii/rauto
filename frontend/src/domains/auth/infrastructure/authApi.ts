import { getWebAuthStatus, loginWeb } from "../../../api/client.js";
import type { AuthApi } from "../model/types.js";

export const authApi: AuthApi = {
  getStatus: getWebAuthStatus,
  login: loginWeb,
};
