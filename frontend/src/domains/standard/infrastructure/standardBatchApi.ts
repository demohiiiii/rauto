import {
  executeExecBatch,
  executeInteractiveBatch,
  listConnections,
  renderTemplate,
} from "../../../api/client.js";
import type { StandardBatchApi } from "../model/types.js";

export const standardBatchApi: StandardBatchApi = {
  executeCommand: executeExecBatch,
  executeInteractive: executeInteractiveBatch,
  listConnections,
  renderTemplate,
};
