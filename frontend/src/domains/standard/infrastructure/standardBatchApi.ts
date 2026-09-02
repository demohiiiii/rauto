import {
  executeExecBatch,
  executeFlowBatch,
  listTemplateResource,
} from "../../../api/client.js";
import type { StandardBatchApi } from "../model/types.js";

export const standardBatchApi: StandardBatchApi = {
  executeCommand: executeExecBatch,
  executeFlow: executeFlowBatch,
  listTemplates: listTemplateResource,
};
