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
import { refreshExecutionModeOptionsForCurrentConnection } from "$domains/profiles/index.js";
import {
  buildFlowVarsPayload,
  ensureFlowRunTemplateDetail,
} from "$domains/templates/index.js";
import type { StandardCommandFlowRuntime } from "../model/types.js";

export const standardCommandFlowRuntime: StandardCommandFlowRuntime = {
  applyRecording: applyRecordDrawerRecording,
  buildVarsPayload: buildFlowVarsPayload,
  connectionPayload,
  createRetryState: createSessionRetryState,
  ensureTarget: ensureConnectionTargetSelected,
  ensureTemplateDetail: ensureFlowRunTemplateDetail,
  parsedOutputSheets: (outputs, { sheetName }) =>
    outputs.flatMap((output, index) =>
      output.parsed_output == null
        ? []
        : [
            {
              name: sheetName(output, index),
              parsed_output: output.parsed_output,
            },
          ],
    ),
  recordLevelPayload,
  refreshModeOptions: refreshExecutionModeOptionsForCurrentConnection,
  retryRequestFields: sessionRetryRequestFields,
};
