import { safeString } from "../../../lib/ui.js";
import { recordValue } from "./customProfileForm.js";
import type {
  ProfileCommandInteraction,
  ProfileCommandInteractionInput,
  ProfileHookCommand,
  ProfileHookCommandDraft,
  ProfileHookFlowDraft,
  ProfileHookRowPatch,
  ProfileHooks,
  ProfilePromptResponseRule,
} from "./types.js";

export type NormalizedHookPromptRule = ProfilePromptResponseRule;

export type NormalizedHookInteraction = ProfileCommandInteraction;

export interface NormalizedHookCommand extends ProfileHookCommandDraft {
  kind: "command";
}

export interface NormalizedHookFlow extends ProfileHookFlowDraft {
  kind: "flow";
}

export type NormalizedHooks = ProfileHooks;

export function profileValues(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function defaultHookOperation(): ProfileHookCommand {
  return {
    kind: "command",
    mode: "Enable",
    command: "terminal length 0",
    timeout: 60,
  };
}

function normalizeHookPromptRule(
  prompt: unknown = {},
): NormalizedHookPromptRule {
  const value = recordValue(prompt);
  return {
    patterns: profileValues(value.patterns).map((pattern) =>
      safeString(pattern ?? ""),
    ),
    record_input: !!value.record_input,
    response: safeString(value.response ?? ""),
  };
}

export function normalizeHookInteraction(
  interaction: unknown = {},
): NormalizedHookInteraction {
  const value = recordValue(interaction);
  return {
    prompts: profileValues(value.prompts).map(normalizeHookPromptRule),
  };
}

export function normalizeHookCommand(
  operation: unknown,
): NormalizedHookCommand {
  const value = recordValue(
    operation && typeof operation === "object"
      ? operation
      : defaultHookOperation(),
  );
  return {
    kind: "command",
    mode: safeString(value.mode || "Enable"),
    command: safeString(value.command || ""),
    interaction: normalizeHookInteraction(value.interaction),
    timeout: value.timeout == null ? "60" : safeString(value.timeout),
  };
}

export function normalizeHookFlow(operation: unknown): NormalizedHookFlow {
  const value = recordValue(operation);
  const flow = value.kind === "flow" ? value : {};
  const steps = profileValues(flow.steps).map(normalizeHookCommand);
  return {
    kind: "flow",
    steps:
      steps.length > 0 ? steps : [normalizeHookCommand(defaultHookOperation())],
    stop_on_error: !!(flow.stop_on_error ?? true),
    max_steps: flow.max_steps == null ? "" : safeString(flow.max_steps),
  };
}

export function normalizeHooks(hooks: unknown): NormalizedHooks {
  const value = recordValue(hooks);
  return {
    after_connect: profileValues(
      value.after_connect,
    ) as ProfileHooks["after_connect"],
    before_disconnect: profileValues(
      value.before_disconnect,
    ) as ProfileHooks["before_disconnect"],
    after_enter_state: recordValue(
      value.after_enter_state,
    ) as ProfileHooks["after_enter_state"],
    before_exit_state: recordValue(
      value.before_exit_state,
    ) as ProfileHooks["before_exit_state"],
  };
}

export const profileListRowFieldPatches = {
  interactionInput(input = "") {
    return { input };
  },
  interactionState(state = "") {
    return { state };
  },
  interactionIsDynamic(is_dynamic = false) {
    return { is_dynamic };
  },
  interactionRecordInput(record_input = false) {
    return { record_input };
  },
  promptState(state = "") {
    return { state };
  },
  sysPromptPattern(pattern = "") {
    return { pattern };
  },
  sysPromptState(state = "") {
    return { state };
  },
  sysPromptNameGroup(sys_name_group = "") {
    return { sys_name_group };
  },
  transitionCommand(command = "") {
    return { command };
  },
  transitionFormatSys(format_sys = false) {
    return { format_sys };
  },
  transitionFrom(from = "") {
    return { from };
  },
  transitionIsExit(is_exit = false) {
    return { is_exit };
  },
  transitionTo(to = "") {
    return { to };
  },
};

export const profileHookRowStatePatch = (state = ""): ProfileHookRowPatch => ({
  state,
});
export const profileHookRowNamePatch = (name = ""): ProfileHookRowPatch => ({
  name,
});
export const profileHookRowFailurePolicyPatch = (
  failurePolicy = "best_effort",
): ProfileHookRowPatch => ({
  failure_policy: failurePolicy === "required" ? "required" : "best_effort",
});
export const profileHookRowRecordOutputPatch = (record_output = false) => ({
  record_output,
});
export const profileHookCommandModePatch = (mode = "") => ({ mode });
export const profileHookCommandTextPatch = (command = "") => ({ command });
export const profileHookCommandTimeoutPatch = (timeout = "") => ({ timeout });
export const profileHookCommandInteractionPatch = (
  interaction: ProfileCommandInteractionInput = { prompts: [] },
) => ({
  interaction: normalizeHookInteraction(interaction),
});
export const profileHookFlowStopOnErrorPatch = (stop_on_error = false) => ({
  stop_on_error,
});
export const profileHookFlowMaxStepsPatch = (max_steps = "") => ({ max_steps });
export const profileHookFlowStepModePatch = (mode = "") => ({ mode });
export const profileHookFlowStepCommandPatch = (command = "") => ({ command });
export const profileHookFlowStepTimeoutPatch = (timeout = "") => ({ timeout });
export const profileHookFlowStepInteractionPatch = (
  interaction: ProfileCommandInteractionInput = { prompts: [] },
) => ({ interaction: normalizeHookInteraction(interaction) });
