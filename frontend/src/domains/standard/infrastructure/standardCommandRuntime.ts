import {
  browserClearTimeout,
  browserConfirm,
  browserSetTimeout,
} from "../../../lib/browser.js";
import {
  connectionPayload,
  ensureConnectionTargetSelected,
} from "$domains/connections/index.js";
import {
  applyRecordDrawerRecording,
  recordLevelPayload,
} from "$domains/overlays/index.js";
import {
  createSessionRetryState,
  sessionRetryRequestFields,
} from "$domains/execution/index.js";
import {
  MODE_SELECT,
  TEXTFSM_PLATFORM_SELECT,
  modeSelection,
  textfsmPlatformSelection,
} from "$domains/profiles/index.js";
import type { StandardCommandRuntime } from "../model/types.js";

export const standardCommandRuntime: StandardCommandRuntime = {
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
};
