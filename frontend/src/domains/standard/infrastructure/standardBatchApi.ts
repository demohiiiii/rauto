import {
  executeExecBatch,
  executeFlowBatch,
  listTemplateResource,
} from "../../../api/client.js";
import type { StandardBatchApi } from "../model/types.js";

export const standardBatchApi = {
  executeCommand: executeExecBatch,
  executeFlow: executeFlowBatch,
  listTemplates: listTemplateResource,
} as StandardBatchApi;
