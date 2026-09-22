import { executeInteractive } from "../../../api/client.js";
import type { StandardInteractiveApi } from "../model/types.js";

export const standardInteractiveApi: StandardInteractiveApi = {
  executeInteractive: executeInteractive,
};
