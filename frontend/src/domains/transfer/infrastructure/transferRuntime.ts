import {
  connectionPayload,
  ensureConnectionTargetSelected,
} from "$domains/connections/index.js";
import {
  applyRecordDrawerRecording,
  recordLevelPayload,
} from "$domains/overlays/index.js";
import type { TransferRuntime } from "../model/types.js";

export const transferRuntime = {
  applyRecording: applyRecordDrawerRecording,
  connectionPayload,
  ensureConnectionTargetSelected,
  recordLevelPayload,
} as TransferRuntime;
