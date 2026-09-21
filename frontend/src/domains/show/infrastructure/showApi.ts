import {
  executeShow,
  executeShowBatch,
  listShowObjects,
} from "../../../api/client.js";
import type { ShowApi } from "../model/types.js";

export const showApi: ShowApi = {
  execute: executeShow,
  executeBatch: executeShowBatch,
  listObjects: listShowObjects,
};
