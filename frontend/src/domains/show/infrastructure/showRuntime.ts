import {
  applyRecordDrawerRecording,
  recordLevelPayload,
} from "../../../modules/overlays/overlays.js";
import {
  executionConnectionProfileState,
  refreshExecutionModeOptionsForCurrentConnection,
} from "../../../modules/profiles/profiles.js";
import {
  connectionPickerValues,
  hideConnectionPickerMenu,
  refreshConnectionPickerSelected,
  setShowObjectPickerOptions,
  showObjectOptionMeta,
} from "../../../modules/connections/connectionFieldStoreState.js";
import {
  connectionPayload,
  connectionTargetState,
  currentExecutionConnectionProfile,
  ensureConnectionTargetSelected,
  savedConnectionSelectState,
} from "../../../modules/connections/connections.js";
import { setCustomShowObjectsChangedCallback } from "../../../modules/templates/templatesShowObjects.js";
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
