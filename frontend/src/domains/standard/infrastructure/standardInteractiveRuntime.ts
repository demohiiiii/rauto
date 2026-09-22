import {
  connectionPayload,
  ensureConnectionTargetSelected,
} from "$domains/connections/index.js";
import { recordLevelPayload } from "$domains/overlays/index.js";
import {
  createSessionRetryState,
  sessionRetryRequestFields,
} from "$domains/execution/index.js";
import { refreshExecutionModeOptionsForCurrentConnection } from "$domains/profiles/index.js";
import {
  buildInteractiveVarsPayload,
  ensureInteractiveRunTemplateDetail,
} from "$domains/templates/index.js";
import type { StandardInteractiveRuntime } from "../model/types.js";

export const standardInteractiveRuntime: StandardInteractiveRuntime = {
  buildVarsPayload: buildInteractiveVarsPayload,
  connectionPayload,
  createRetryState: createSessionRetryState,
  ensureTarget: ensureConnectionTargetSelected,
  ensureTemplateDetail: ensureInteractiveRunTemplateDetail,
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
