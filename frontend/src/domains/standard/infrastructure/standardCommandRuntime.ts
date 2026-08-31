import {
  browserClearTimeout,
  browserConfirm,
  browserSetTimeout,
} from "../../../lib/browser.js";
import {
  connectionPayload,
  ensureConnectionTargetSelected,
} from "../../../modules/connections/connections.js";
import {
  applyRecordDrawerRecording,
  recordLevelPayload,
} from "../../../modules/overlays/overlays.js";
import {
  createSessionRetryState,
  sessionRetryRequestFields,
} from "../../../modules/operations/sessionRetry.js";
import {
  MODE_SELECT,
  TEXTFSM_PLATFORM_SELECT,
  modeSelection,
  textfsmPlatformSelection,
} from "../../../modules/profiles/profiles.js";
import type { StandardCommandRuntime } from "../model/types.js";

export const standardCommandRuntime = {
  applyRecording: applyRecordDrawerRecording,
  clearTimer: browserClearTimeout,
  commandModePicker: () => modeSelection(MODE_SELECT.standardDirect),
  confirm: browserConfirm,
  connection: connectionPayload,
  createRetryState: createSessionRetryState,
  ensureTarget: ensureConnectionTargetSelected,
  platformPicker: () =>
    textfsmPlatformSelection(TEXTFSM_PLATFORM_SELECT.standard),
  recordLevel: recordLevelPayload,
  retryRequestFields: sessionRetryRequestFields,
  setTimer: browserSetTimeout,
} as unknown as StandardCommandRuntime;
