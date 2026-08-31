import {
  connectionPayload,
  ensureConnectionTargetSelected,
} from "../../../modules/connections/connections.js";
import {
  applyRecordDrawerRecording,
  recordLevelPayload,
} from "../../../modules/overlays/overlays.js";
import { parsedOutputSheetsFromParsedOutputItems } from "../../../modules/operations/results.js";
import {
  createSessionRetryState,
  sessionRetryRequestFields,
} from "../../../modules/operations/sessionRetry.js";
import { refreshExecutionModeOptionsForCurrentConnection } from "../../../modules/profiles/profiles.js";
import {
  buildFlowVarsPayload,
  ensureFlowRunTemplateDetail,
} from "../../../modules/templates/templatesFlowRuntimeState.js";
import type { StandardCommandFlowRuntime } from "../model/types.js";

export const standardCommandFlowRuntime = {
  applyRecording: applyRecordDrawerRecording,
  buildVarsPayload: buildFlowVarsPayload,
  connectionPayload,
  createRetryState: createSessionRetryState,
  ensureTarget: ensureConnectionTargetSelected,
  ensureTemplateDetail: ensureFlowRunTemplateDetail,
  parsedOutputSheets: parsedOutputSheetsFromParsedOutputItems,
  recordLevelPayload,
  refreshModeOptions: refreshExecutionModeOptionsForCurrentConnection,
  retryRequestFields: sessionRetryRequestFields,
} as unknown as StandardCommandFlowRuntime;
