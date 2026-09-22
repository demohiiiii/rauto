import {
  CONNECTION_PICKER,
  connectionPickerValues,
} from "$domains/connections/index.js";
import { recordLevelPayload } from "$domains/overlays/index.js";
import {
  createSessionRetryState,
  sessionRetryRequestFields,
} from "$domains/execution/index.js";
import type {
  StandardBatchRuntime,
  StandardBatchTargetSelection,
} from "../model/types.js";

function targetSelection(
  targetsKey: string,
  groupsKey: string,
  labelsKey: string,
): StandardBatchTargetSelection {
  return {
    targets: connectionPickerValues(targetsKey),
    groups: connectionPickerValues(groupsKey),
    labels: connectionPickerValues(labelsKey),
  };
}

export const standardBatchRuntime: StandardBatchRuntime = {
  batchExecTargets: () =>
    targetSelection(
      CONNECTION_PICKER.batchExecTargets,
      CONNECTION_PICKER.batchExecGroups,
      CONNECTION_PICKER.batchExecLabels,
    ),
  batchInteractiveTargets: () =>
    targetSelection(
      CONNECTION_PICKER.batchInteractiveTargets,
      CONNECTION_PICKER.batchInteractiveGroups,
      CONNECTION_PICKER.batchInteractiveLabels,
    ),
  createRetryState: createSessionRetryState,
  recordLevelPayload,
  retryRequestFields: sessionRetryRequestFields,
};
