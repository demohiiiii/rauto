import {
  HOOK_LIST,
  PROFILE_LIST,
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
} from "./profileListState.js";
import {
  collectDetectProfileForm,
  setDetectProfileForm,
} from "./profileDiagnosticsState.js";
import {
  commandExecutionPayload,
  emptyProfileForm,
} from "../model/customProfileForm.js";
import type {
  CustomProfileBaseForm,
  CustomProfileForm,
  ProfileHooks,
  UnknownRecord,
} from "../model/types.js";

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

function ensureDefaultSimpleRows(profile: CustomProfileForm): void {
  const simpleLists: Array<[string[], string]> = [
    [profile.more_patterns, PROFILE_LIST.morePatterns],
    [profile.error_patterns, PROFILE_LIST.errorPatterns],
    [profile.ignore_errors, PROFILE_LIST.ignoreErrors],
    [profile.prompt_prefix, PROFILE_LIST.promptPrefix],
  ];
  simpleLists.forEach(([listValues, listKey]) => {
    if (listValues.length === 0) addSimpleListRow(listKey);
  });
}

function applyProfileHooksToForm(hooks: ProfileHooks): void {
  hooks.after_connect.forEach((hookEntry) =>
    addHookListRow(HOOK_LIST.afterConnect, hookEntry),
  );
  hooks.before_disconnect.forEach((hookEntry) =>
    addHookListRow(HOOK_LIST.beforeDisconnect, hookEntry),
  );
  Object.entries(hooks.after_enter_state).forEach(([state, hookEntries]) => {
    hookEntries.forEach((hookEntry) =>
      addHookListRow(HOOK_LIST.afterEnterState, hookEntry, state),
    );
  });
  Object.entries(hooks.before_exit_state).forEach(([state, hookEntries]) => {
    hookEntries.forEach((hookEntry) =>
      addHookListRow(HOOK_LIST.beforeExitState, hookEntry, state),
    );
  });
}

export function applyCustomProfileForm(
  profile: CustomProfileForm,
  setBaseForm: (form: UnknownRecord) => CustomProfileBaseForm,
): void {
  const nextProfile = profile || emptyProfileForm();
  setBaseForm({
    commandExecution: nextProfile.command_execution,
    name: nextProfile.name || "",
  });
  CUSTOM_LIST_IDS.forEach(clearProfileEditorList);
  setDetectProfileForm(nextProfile.detect_profile || null);

  const simpleLists: Array<[string[], string]> = [
    [nextProfile.more_patterns, PROFILE_LIST.morePatterns],
    [nextProfile.error_patterns, PROFILE_LIST.errorPatterns],
    [nextProfile.ignore_errors, PROFILE_LIST.ignoreErrors],
    [nextProfile.prompt_prefix, PROFILE_LIST.promptPrefix],
  ];
  simpleLists.forEach(([simpleValues, listKey]) => {
    simpleValues.forEach((simpleValue) =>
      addSimpleListRow(listKey, simpleValue),
    );
  });

  nextProfile.prompts.forEach(addPromptRow);
  nextProfile.sys_prompts.forEach(addSysPromptRow);
  nextProfile.interactions.forEach(addInteractionRow);
  nextProfile.transitions.forEach(addTransitionRow);
  applyProfileHooksToForm(nextProfile.hooks);
  ensureDefaultSimpleRows(nextProfile);
}

export function collectCustomProfileForm(
  baseForm: CustomProfileBaseForm,
): CustomProfileForm {
  const commandExecution = baseForm.commandExecution;
  const detectProfile = collectDetectProfileForm();
  const profile: CustomProfileForm = {
    name: baseForm.name,
    command_execution: commandExecutionPayload(
      commandExecution.mode,
      commandExecution.marker,
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
  if (detectProfile) profile.detect_profile = detectProfile;
  return profile;
}
