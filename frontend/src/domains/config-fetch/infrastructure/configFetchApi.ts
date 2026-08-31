import {
  fetchConfig,
  fetchConfigBatch,
  listConfigCommands,
} from "../../../api/client.js";
import type { ConfigFetchApi } from "../model/types.js";

export const configFetchApi = {
  fetchConfig,
  fetchConfigBatch,
  listConfigCommands,
} as ConfigFetchApi;
