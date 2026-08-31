import type { Readable } from "svelte/store";
import { downloadBlob } from "../../../lib/ui.js";
import {
  configFetchTargetPickerFields as legacyConfigFetchTargetPickerFields,
  connectionPayload,
  connectionTargetState,
  currentExecutionConnectionProfile,
  ensureConnectionTargetSelected,
} from "../../../modules/connections/connections.js";
import {
  CONNECTION_PICKER,
  connectionPickerValues,
} from "../../../modules/connections/connectionFieldStoreState.js";
import { recordLevelPayload } from "../../../modules/overlays/overlays.js";
import { executionResultOutputText } from "../../../modules/operations/results.js";
import {
  createSessionRetryState,
  sessionRetryRequestFields,
  sessionRetryValidation,
} from "../../../modules/operations/sessionRetry.js";
import type {
  ConfigFetchConnectionTarget,
  ConfigFetchConnectionTargetStore,
  ConfigFetchRuntime,
  ConfigFetchTargetPickerField,
  SessionRetryState,
} from "../model/types.js";

export const configFetchConnectionTargetState =
  connectionTargetState as unknown as ConfigFetchConnectionTargetStore;

export const configFetchTargetPickerFields =
  legacyConfigFetchTargetPickerFields as readonly ConfigFetchTargetPickerField[];

export function newConfigFetchRetryState(): SessionRetryState {
  return createSessionRetryState() as SessionRetryState;
}

export function validateConfigFetchRetry(retry: SessionRetryState): boolean {
  return Boolean(sessionRetryValidation(retry).valid);
}

export const configFetchRuntime: ConfigFetchRuntime = {
  connectionPayload,
  currentConnectionProfile: currentExecutionConnectionProfile,
  download: downloadBlob,
  ensureConnectionTargetSelected,
  executionResultOutputText,
  recordLevelPayload,
  retryRequestFields: sessionRetryRequestFields,
  targetSelections: () => ({
    groups: connectionPickerValues(CONNECTION_PICKER.configFetchGroups),
    labels: connectionPickerValues(CONNECTION_PICKER.configFetchLabels),
    targets: connectionPickerValues(CONNECTION_PICKER.configFetchTargets),
  }),
};

export type { ConfigFetchConnectionTarget, Readable };
