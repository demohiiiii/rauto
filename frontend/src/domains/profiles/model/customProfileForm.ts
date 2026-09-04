import { safeString, selectOptionsWithCurrent } from "../../../lib/ui.js";
import type {
  CommandExecutionConfig,
  CustomProfileBaseForm,
  CustomProfileForm,
  CustomProfileOptionsState,
  ProfileCommandExecution,
  UnknownRecord,
} from "./types.js";

const EMPTY_PROFILE_FORM: CustomProfileForm = {
  name: "",
  command_execution: "prompt_driven",
  more_patterns: [],
  error_patterns: [],
  ignore_errors: [],
  prompt_prefix: [],
  prompts: [],
  sys_prompts: [],
  interactions: [],
  transitions: [],
  hooks: {
    after_connect: [],
    after_enter_state: {},
    before_disconnect: [],
    before_exit_state: {},
  },
  detect_profile: null,
};

export function recordValue(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

export function listValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function normalizeCommandExecutionConfig(
  config: unknown,
): CommandExecutionConfig {
  let commandExecution = { marker: "", mode: "prompt_driven" };
  if (config && config !== "prompt_driven") {
    if (typeof config === "string") {
      commandExecution = { marker: "", mode: config };
    } else {
      const shellExitStatus = recordValue(config).shell_exit_status;
      if (shellExitStatus) {
        commandExecution = {
          marker: safeString(recordValue(shellExitStatus).marker || ""),
          mode: "shell_exit_status",
        };
      }
    }
  }
  return {
    ...commandExecution,
    showShellExitMarker: commandExecution.mode === "shell_exit_status",
  };
}

export function normalizeCustomProfileBaseForm(
  formPatch: unknown = {},
): CustomProfileBaseForm {
  const form = recordValue(formPatch);
  const commandExecution = normalizeCommandExecutionConfig(
    form.commandExecution || form.command_execution,
  );
  return {
    commandExecution,
    name: safeString(form.name || "").trim(),
  };
}

export function emptyProfileForm(): CustomProfileForm {
  return {
    ...EMPTY_PROFILE_FORM,
    detect_profile: null,
    error_patterns: [],
    hooks: {
      after_connect: [],
      after_enter_state: {},
      before_disconnect: [],
      before_exit_state: {},
    },
    ignore_errors: [],
    interactions: [],
    more_patterns: [],
    prompt_prefix: [],
    prompts: [],
    sys_prompts: [],
    transitions: [],
  };
}

export function builtinProfileFormValue(
  profile: unknown = null,
): CustomProfileForm {
  return profile ? (profile as CustomProfileForm) : emptyProfileForm();
}

export function commandExecutionPayload(
  commandMode: string,
  exitMarker: string,
): ProfileCommandExecution {
  if (commandMode === "shell_exit_status") {
    return {
      shell_exit_status: {
        marker: safeString(exitMarker || "").trim() || "__RNETER_EXIT_CODE__:",
      },
    };
  }
  return "prompt_driven";
}

export function customCommandExecutionModeFormPatch(
  commandExecutionMode: unknown = "",
  currentCommandExecution: unknown = {},
): UnknownRecord {
  const current = recordValue(currentCommandExecution);
  return {
    commandExecution:
      commandExecutionMode === "shell_exit_status"
        ? {
            shell_exit_status: {
              marker: current.marker || "",
            },
          }
        : "prompt_driven",
  };
}

export function customShellExitMarkerFormPatch(
  shellExitMarker: unknown = "",
): UnknownRecord {
  return {
    commandExecution: {
      shell_exit_status: {
        marker: shellExitMarker,
      },
    },
  };
}

export function refreshCustomProfileOptionsState(
  names: unknown = [],
  selected: unknown = "",
): CustomProfileOptionsState {
  const optionNames = Array.isArray(names)
    ? (names.filter(Boolean) as string[])
    : [];
  const selectedName = safeString(selected || "").trim();
  return {
    names: selectOptionsWithCurrent(optionNames, selectedName),
    selected: selectedName,
  };
}
