import { MANUAL_COMMAND_SOURCE } from "$domains/command/index.js";
import { safeString } from "../../../lib/ui.js";
import type {
  StandardCommandExecutionInput,
  StandardCommandExecutionPayload,
  StandardCommandTextfsmPayload,
  StandardCommandTextfsmState,
  StandardCommandVariableField,
  StandardCommandWorkspaceState,
  StandardSessionRetryState,
} from "./types.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function reconcileCommandVars(
  schema: unknown = [],
  current: unknown = {},
): Record<string, unknown> {
  const currentVars = record(current);
  return Object.fromEntries(
    (Array.isArray(schema) ? schema : [])
      .map((field) =>
        safeString((field as StandardCommandVariableField | null)?.name).trim(),
      )
      .filter(Boolean)
      .map((name) => [
        name,
        Object.hasOwn(currentVars, name) ? currentVars[name] : "",
      ]),
  );
}

export function newStandardCommandWorkspaceState(
  retry: StandardSessionRetryState,
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
  retryFields: Record<string, unknown> = {},
): StandardCommandExecutionPayload {
  return {
    template_content: safeString(content),
    vars: record(vars),
    mode: safeString(mode).trim() || null,
    multiline_mode: multilineMode === "whole" ? "whole" : "split_lines",
    ...textfsm,
    ...retryFields,
    connection,
    record_level: recordLevel,
  };
}
