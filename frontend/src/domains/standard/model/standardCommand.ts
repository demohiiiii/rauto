import { MANUAL_COMMAND_SOURCE } from "$domains/command/index.js";
import { safeString } from "../../../lib/ui.js";
import type { SessionRetryState } from "$domains/execution/index.js";
import type { JsonObject } from "$lib/jsonValue.js";
import type {
  StandardCommandExecutionInput,
  StandardCommandExecutionPayload,
  StandardCommandTextfsmPayload,
  StandardCommandTextfsmState,
  StandardCommandVariableField,
  StandardCommandWorkspaceState,
  StandardBatchRetryFields,
} from "./types.js";

export function reconcileCommandVars(
  schema: readonly StandardCommandVariableField[] = [],
  current: JsonObject = {},
): JsonObject {
  return Object.fromEntries(
    schema
      .map((field) => field.name.trim())
      .filter(Boolean)
      .map((name) => [name, Object.hasOwn(current, name) ? current[name] : ""]),
  );
}

export function newStandardCommandWorkspaceState(
  retry: SessionRetryState,
): StandardCommandWorkspaceState {
  return {
    sourceSelection: MANUAL_COMMAND_SOURCE,
    sourceOptions: [],
    content: "",
    baselineContent: "",
    dirty: false,
    vars: {},
    varsSchema: [],
    mode: "",
    modeOptions: [],
    multilineMode: "split_lines",
    textfsm: {
      enabled: false,
      platform: "",
      platformOptions: [],
      strictErrors: false,
      template: "",
    },
    retry,
    preview: { kind: "empty", text: "", message: "" },
    executionResult: { kind: "empty" },
    loadingActions: [],
    status: { message: "", tone: "info" },
  };
}

export function standardCommandTextfsmPayload(
  textfsm: Partial<StandardCommandTextfsmState> = {},
): StandardCommandTextfsmPayload {
  return {
    textfsm_template: safeString(textfsm.template).trim() || null,
    parse_textfsm: !!textfsm.enabled,
    textfsm_platform: safeString(textfsm.platform).trim() || null,
    textfsm_strict_errors: !!textfsm.strictErrors,
  };
}

export function buildStandardCommandExecutionPayload(
  {
    content = "",
    vars = {},
    mode = "",
    multilineMode = "split_lines",
    textfsm = {},
    connection,
    recordLevel,
  }: StandardCommandExecutionInput = {},
  retryFields: StandardBatchRetryFields = {},
): StandardCommandExecutionPayload {
  return {
    template_content: content,
    vars: { ...vars },
    mode: mode.trim() || null,
    multiline_mode: multilineMode === "whole" ? "whole" : "split_lines",
    ...textfsm,
    ...retryFields,
    connection,
    record_level: recordLevel,
  };
}
