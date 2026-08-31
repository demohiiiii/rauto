import { executeCommandFlow } from "../../../api/client.js";
import type { StandardCommandFlowApi } from "../model/types.js";

export const standardCommandFlowApi = {
  executeFlow: executeCommandFlow,
} as StandardCommandFlowApi;
