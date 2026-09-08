import {
  connectionPayload,
  ensureConnectionTargetSelected,
} from "$domains/connections/index.js";
import { recordLevelPayload } from "$domains/overlays/index.js";
import type { TransferRuntime } from "../model/types.js";

export const transferRuntime = {
  connectionPayload,
  ensureConnectionTargetSelected,
  recordLevelPayload,
} as TransferRuntime;
