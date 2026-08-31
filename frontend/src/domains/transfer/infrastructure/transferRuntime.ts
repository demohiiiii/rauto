import {
  connectionPayload,
  ensureConnectionTargetSelected,
} from "../../../modules/connections/connectionTargetRuntimeState.js";
import {
  applyRecordDrawerRecording,
  recordLevelPayload,
} from "../../../modules/overlays/overlaysDrawerState.js";
import type { TransferRuntime } from "../model/types.js";

export const transferRuntime = {
  applyRecording: applyRecordDrawerRecording,
  connectionPayload,
  ensureConnectionTargetSelected,
  recordLevelPayload,
} as TransferRuntime;
