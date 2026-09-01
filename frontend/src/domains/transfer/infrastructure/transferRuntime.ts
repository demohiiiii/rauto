import {
  connectionPayload,
  ensureConnectionTargetSelected,
} from "../../../modules/connections/connectionTargetRuntimeState.js";
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
