import { t, tr } from "../lib/i18n.js";
import { safeString, selectOptionsWithCurrent } from "../lib/ui.js";
import {
  collectDetectProfileForm,
  setDetectProfileForm,
} from "./profilesDiagnostics.js";
import {
  PROFILE_LIST,
  HOOK_LIST,
  addHookListRow,
  addInteractionRow,
  addPromptRow,
  addSimpleListRow,
  addSysPromptRow,
  addTransitionRow,
  clearProfileEditorList,
  collectHookRows,
  collectInteractionRows,
  collectPromptRows,
  collectSimpleList,
  collectStateHookRows,
  collectSysPromptRows,
  collectTransitionRows,
  normalizeHooks,
} from "./profilesListState.js";

const CUSTOM_LIST_IDS = [
  PROFILE_LIST.morePatterns,
  PROFILE_LIST.errorPatterns,
  PROFILE_LIST.ignoreErrors,
  PROFILE_LIST.promptPrefix,
  PROFILE_LIST.prompts,
  PROFILE_LIST.sysPrompts,
  PROFILE_LIST.interactions,
  PROFILE_LIST.transitions,
  HOOK_LIST.afterConnect,
  HOOK_LIST.beforeDisconnect,
  HOOK_LIST.afterEnterState,
  HOOK_LIST.beforeExitState,
];

const EMPTY_PROFILE_FORM = {
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
  hooks: {},
  detect_profile: null,
};

const COMMAND_EXECUTION_MODE_OPTIONS = Object.freeze([
  ["prompt_driven", "commandExecutionModePromptDriven"],
  ["shell_exit_status", "commandExecutionModeShellExitStatus"],
]);

function commandExecutionModeOptionRows() {
  return COMMAND_EXECUTION_MODE_OPTIONS.map(([valueText, labelKey]) => ({
    labelText: tr(labelKey),
    valueText,
  }));
}

export function normalizeCommandExecutionConfig(config) {
  let commandExecution = { marker: "", mode: "prompt_driven" };
  if (config && config !== "prompt_driven") {
    if (typeof config === "string") {
      commandExecution = { marker: "", mode: config };
    } else if (config.shell_exit_status) {
      commandExecution = {
        marker: config.shell_exit_status.marker || "",
        mode: "shell_exit_status",
      };
    }
  }
  return {
    ...commandExecution,
    showShellExitMarker: commandExecution.mode === "shell_exit_status",
  };
}

export function normalizeCustomProfileBaseForm(formPatch = {}) {
  const commandExecution = normalizeCommandExecutionConfig(
    formPatch.commandExecution || formPatch.command_execution,
  );
  return {
    commandExecution,
    name: safeString(formPatch.name || "").trim(),
  };
}

export function customProfileSettingsDisplay(
  baseState = {},
  optionsState = {},
) {
  const commandConfig = baseState.commandExecution;
  const commandExecution = normalizeCommandExecutionConfig(commandConfig);
  return {
    commandExecutionMarker: safeString(commandExecution.marker || ""),
    commandExecutionMarkerPlaceholder: tr("commandExecutionMarkerPlaceholder"),
    commandExecutionMode: safeString(commandExecution.mode || "prompt_driven"),
    commandExecutionModeOptionRows: commandExecutionModeOptionRows(),
    commandExecutionTitle: tr("commandExecutionTitle"),
    deleteButtonLabel: tr("profileDeleteBtn"),
    newButtonLabel: tr("newBtn"),
    profileNames: Array.isArray(optionsState.names) ? optionsState.names : [],
    saveButtonLabel: tr("profileSaveBtn"),
    selectPlaceholder: tr("customProfileSelectPlaceholder"),
    selectedProfileName: safeString(baseState.name || ""),
    showShellExitMarker: commandExecution.showShellExitMarker,
  };
}

export function emptyProfileForm() {
  return {
    ...EMPTY_PROFILE_FORM,
    more_patterns: [],
    error_patterns: [],
    ignore_errors: [],
    prompt_prefix: [],
    prompts: [],
    sys_prompts: [],
    interactions: [],
    transitions: [],
    hooks: {},
    detect_profile: null,
  };
}

export function builtinProfileFormValue(profile = null) {
  return profile || emptyProfileForm();
}

function commandExecutionPayload(commandMode, exitMarker) {
  if (commandMode === "shell_exit_status") {
    return {
      shell_exit_status: {
        marker: (exitMarker || "").trim() || "__RNETER_EXIT_CODE__:",
      },
    };
  }
  return "prompt_driven";
}

function ensureDefaultSimpleRows(profile) {
  [
    [profile.more_patterns, PROFILE_LIST.morePatterns],
    [profile.error_patterns, PROFILE_LIST.errorPatterns],
    [profile.ignore_errors, PROFILE_LIST.ignoreErrors],
    [profile.prompt_prefix, PROFILE_LIST.promptPrefix],
  ].forEach(([listValues, listKey]) => {
    if ((listValues || []).length === 0) {
      addSimpleListRow(listKey);
    }
  });
}

function applyProfileHooksToForm(hooks) {
  hooks.after_connect.forEach((hookEntry) =>
    addHookListRow(HOOK_LIST.afterConnect, hookEntry),
  );
  hooks.before_disconnect.forEach((hookEntry) =>
    addHookListRow(HOOK_LIST.beforeDisconnect, hookEntry),
  );
  Object.entries(hooks.after_enter_state).forEach(([state, hookEntries]) => {
    (Array.isArray(hookEntries) ? hookEntries : []).forEach((hookEntry) =>
      addHookListRow(HOOK_LIST.afterEnterState, hookEntry, state),
    );
  });
  Object.entries(hooks.before_exit_state).forEach(([state, hookEntries]) => {
    (Array.isArray(hookEntries) ? hookEntries : []).forEach((hookEntry) =>
      addHookListRow(HOOK_LIST.beforeExitState, hookEntry, state),
    );
  });
}

export function applyCustomProfileForm(profile, setBaseForm) {
  const nextProfile = profile || emptyProfileForm();
  setBaseForm({
    commandExecution: nextProfile.command_execution,
    name: nextProfile.name || "",
  });
  CUSTOM_LIST_IDS.forEach(clearProfileEditorList);
  setDetectProfileForm(nextProfile.detect_profile || null);

  [
    [nextProfile.more_patterns, PROFILE_LIST.morePatterns],
    [nextProfile.error_patterns, PROFILE_LIST.errorPatterns],
    [nextProfile.ignore_errors, PROFILE_LIST.ignoreErrors],
    [nextProfile.prompt_prefix, PROFILE_LIST.promptPrefix],
  ].forEach(([simpleValues, listKey]) => {
    (simpleValues || []).forEach((simpleValue) =>
      addSimpleListRow(listKey, simpleValue),
    );
  });

  (nextProfile.prompts || []).forEach(addPromptRow);
  (nextProfile.sys_prompts || []).forEach(addSysPromptRow);
  (nextProfile.interactions || []).forEach(addInteractionRow);
  (nextProfile.transitions || []).forEach(addTransitionRow);
  applyProfileHooksToForm(normalizeHooks(nextProfile.hooks));
  ensureDefaultSimpleRows(nextProfile);
}

export function collectCustomProfileForm(baseForm = {}) {
  const detectProfile = collectDetectProfileForm();
  const profile = {
    name: baseForm.name,
    command_execution: commandExecutionPayload(
      baseForm.commandExecution?.mode,
      baseForm.commandExecution?.marker,
    ),
    more_patterns: collectSimpleList(PROFILE_LIST.morePatterns),
    error_patterns: collectSimpleList(PROFILE_LIST.errorPatterns),
    ignore_errors: collectSimpleList(PROFILE_LIST.ignoreErrors),
    prompt_prefix: collectSimpleList(PROFILE_LIST.promptPrefix),
    prompts: collectPromptRows(),
    sys_prompts: collectSysPromptRows(),
    interactions: collectInteractionRows(),
    transitions: collectTransitionRows(),
    hooks: {
      after_connect: collectHookRows(HOOK_LIST.afterConnect, "after_connect"),
      before_disconnect: collectHookRows(
        HOOK_LIST.beforeDisconnect,
        "before_disconnect",
      ),
      after_enter_state: collectStateHookRows(
        HOOK_LIST.afterEnterState,
        "after_enter_state",
      ),
      before_exit_state: collectStateHookRows(
        HOOK_LIST.beforeExitState,
        "before_exit_state",
      ),
    },
  };
  if (detectProfile) {
    profile.detect_profile = detectProfile;
  }
  return profile;
}

export function customCommandExecutionModeFormPatch(
  commandExecutionMode = "",
  currentCommandExecution = {},
) {
  return {
    commandExecution:
      commandExecutionMode === "shell_exit_status"
        ? {
            shell_exit_status: {
              marker: currentCommandExecution.marker || "",
            },
          }
        : "prompt_driven",
  };
}

export function customShellExitMarkerFormPatch(shellExitMarker = "") {
  return {
    commandExecution: {
      shell_exit_status: {
        marker: shellExitMarker,
      },
    },
  };
}

export function refreshCustomProfileOptionsState(names = [], selected = "") {
  const optionNames = Array.isArray(names) ? names.filter(Boolean) : [];
  const selectedName = safeString(selected || "").trim();
  return {
    names: selectOptionsWithCurrent(optionNames, selectedName),
    selected: selectedName,
  };
}

export function customProfileNameRequiredError() {
  return t("profileNameRequired");
}

export function customProfileRunningText() {
  return t("running");
}
