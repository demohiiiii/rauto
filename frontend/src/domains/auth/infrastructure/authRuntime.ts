import { setApiUnauthorizedHandler } from "../../../api/client.js";
import type { AuthRuntime } from "../model/types.js";

export const authRuntime = {
  subscribeUnauthorized: setApiUnauthorizedHandler,
} as AuthRuntime;
