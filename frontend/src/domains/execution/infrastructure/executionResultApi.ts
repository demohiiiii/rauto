import { exportTextfsmExcel } from "../../../api/client.js";
import type { ExecutionResultApi } from "../model/types.js";

export const executionResultApi: ExecutionResultApi = {
  exportExcel: exportTextfsmExcel,
};
