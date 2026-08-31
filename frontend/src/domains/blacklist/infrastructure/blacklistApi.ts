import {
  addBlacklistPattern,
  checkBlacklistCommand,
  deleteBlacklistPattern,
  listBlacklistPatterns,
} from "../../../api/client.js";
import type { BlacklistApi } from "../model/types.js";

export const blacklistApi = {
  addPattern: addBlacklistPattern,
  checkCommand: checkBlacklistCommand,
  deletePattern: deleteBlacklistPattern,
  listPatterns: listBlacklistPatterns,
} as BlacklistApi;
