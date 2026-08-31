import {
  executeShow,
  executeShowBatch,
  exportTextfsmExcel,
  listShowObjects,
} from "../../../api/client.js";
import type { ShowApi } from "../model/types.js";

export const showApi = {
  execute: executeShow,
  executeBatch: executeShowBatch,
  exportExcel: exportTextfsmExcel,
  listObjects: listShowObjects,
} as ShowApi;
