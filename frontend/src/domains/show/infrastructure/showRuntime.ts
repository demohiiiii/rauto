import {
  applyRecordDrawerRecording,
  recordLevelPayload,
} from "$domains/overlays/index.js";
import {
  executionConnectionProfileState,
  refreshExecutionModeOptionsForCurrentConnection,
} from "$domains/profiles/index.js";
import {
  connectionPickerValues,
  hideConnectionPickerMenu,
  refreshConnectionPickerSelected,
  setShowObjectPickerOptions,
  showObjectOptionMeta,
} from "$domains/connections/index.js";
import {
  connectionPayload,
  connectionTargetState,
  currentExecutionConnectionProfile,
  ensureConnectionTargetSelected,
  savedConnectionSelectState,
} from "$domains/connections/index.js";
import { setCustomShowObjectsChangedCallback } from "$domains/templates/index.js";
import type { ShowRuntime } from "../model/types.js";

export const showRuntime = {
  applyRecording: applyRecordDrawerRecording,
  connectionPayload,
  connectionTargetState,
  currentExecutionProfile: currentExecutionConnectionProfile,
  ensureConnectionTargetSelected,
  executionConnectionProfileState,
  hidePickerMenu: hideConnectionPickerMenu,
  pickerValues: connectionPickerValues,
  recordLevelPayload,
  refreshExecutionModeOptions: refreshExecutionModeOptionsForCurrentConnection,
  refreshPickerSelected: refreshConnectionPickerSelected,
  savedConnectionSelectState,
  setCustomObjectsChangedCallback: setCustomShowObjectsChangedCallback,
  setObjectPickerOptions: setShowObjectPickerOptions,
  showObjectOptionMeta,
} as unknown as ShowRuntime;
