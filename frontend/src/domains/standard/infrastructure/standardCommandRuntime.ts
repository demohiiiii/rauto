import {
  browserClearTimeout,
  browserConfirm,
  browserSetTimeout,
} from "../../../lib/browser.js";
import {
  connectionPayload,
  connectionTargetState,
  ensureConnectionTargetSelected,
} from "$domains/connections/index.js";
import { recordLevelPayload } from "$domains/overlays/index.js";
import {
  createSessionRetryState,
  sessionRetryRequestFields,
} from "$domains/execution/index.js";
import { MODE_SELECT, modeSelection } from "$domains/profiles/index.js";
import type { StandardCommandRuntime } from "../model/types.js";

export const standardCommandRuntime: StandardCommandRuntime = {
  subscribeConnectionChange: (listener) =>
    connectionTargetState.subscribe(listener),
  clearTimer: browserClearTimeout,
  commandModePicker: () => modeSelection(MODE_SELECT.standardDirect),
  confirm: browserConfirm,
  connection: connectionPayload,
  createRetryState: createSessionRetryState,
  ensureTarget: ensureConnectionTargetSelected,
  recordLevel: recordLevelPayload,
  retryRequestFields: sessionRetryRequestFields,
  setTimer: browserSetTimeout,
};
