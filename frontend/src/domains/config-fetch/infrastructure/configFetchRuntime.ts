import type { Readable } from "svelte/store";
import { downloadBlob } from "../../../lib/ui.js";
import {
  configFetchTargetPickerFields as legacyConfigFetchTargetPickerFields,
  connectionPayload,
  connectionTargetState,
  currentExecutionConnectionProfile,
  ensureConnectionTargetSelected,
} from "$domains/connections/index.js";
import {
  CONNECTION_PICKER,
  connectionPickerValues,
} from "$domains/connections/index.js";
import { recordLevelPayload } from "$domains/overlays/index.js";
import { executionResultOutputText } from "$domains/execution/index.js";
import {
  createSessionRetryState,
  sessionRetryRequestFields,
  sessionRetryValidation,
} from "$domains/execution/index.js";
import type {
  ConfigFetchConnectionTarget,
  ConfigFetchConnectionTargetStore,
  ConfigFetchRuntime,
  ConfigFetchTargetPickerField,
  SessionRetryState,
} from "../model/types.js";

export const configFetchConnectionTargetState: ConfigFetchConnectionTargetStore =
  connectionTargetState;

export const configFetchTargetPickerFields: readonly ConfigFetchTargetPickerField[] =
  legacyConfigFetchTargetPickerFields;

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
