import { callbackHandler } from "../../lib/events.js";
import {
  addProfileDetectInitialRule as addInitialRule,
  addProfileDetectProbe as addProbe,
  createCustomProfileDetectPanelWorkspace as createCustomProfileDetectPanelWorkspaceCore,
  createProfileDiagnosePanelWorkspace as createProfileDiagnosePanelWorkspaceCore,
  patchProfileDetectInitialRule,
  removeProfileDetectInitialRule,
  setProfileDetectEnabled,
  setProfileDiagnoseSelected,
} from "./promptProfileState.js";

export {
  promptProfilesPageDisplay,
  promptModePresentation,
  promptProfilesPagePresentation,
  builtinProfilesPanelDisplay,
  profileDiagnoseDisplay,
  profileDiagnosePanelDisplay,
  customProfileDetectPanelDisplay,
  createProfileDiagnoseState,
} from "./promptProfileState.js";

export {
  builtinProfileDetectDetailsPresentation,
  builtinProfileHooksDetailsPresentation,
  builtinProfileStateListsPresentation,
  profileListRowEditorPresentation,
  profileInteractionRowEditorPresentation,
  profileTransitionRowEditorPresentation,
  profileHookRowEditorDisplay,
  profileHookFlowEditorDisplay,
  profileHookFlowStepsEditorDisplay,
  profilePatternListEditorDisplay,
  hookOperationEditorDisplay,
} from "./profilesEditorState.js";

export { customProfileSettingsDisplay } from "./profilesCustomEditorState.js";

export {
  createPromptProfilesPageWorkspace,
  changeBuiltinProfileSelection,
  copySelectedBuiltinProfileToCustom,
  addProfileDetectProbe,
  addProfileDetectProbeErrorPattern,
  addProfileDetectInitialRule,
  addProfileDetectProbeRule,
  patchProfileDetectProbe,
  patchProfileDetectInitialRule,
  patchProfileDetectProbeRule,
  removeProfileDetectProbe,
  removeProfileDetectProbeErrorPattern,
  removeProfileDetectInitialRule,
  removeProfileDetectProbeRule,
  setProfileDetectEnabled,
  setProfileDetectProbeErrorPattern,
  builtinOverviewState,
  builtinDetailState,
  builtinDetailStatusState,
  profileDiagnoseOptionsState,
  profileDetectFormStateStore,
  setProfileDiagnoseSelected,
  diagnoseSelectedCustomProfile,
  ensureProfileDetectDefaults,
  builtinProfileForm,
  initializeProfiles,
  setNormalizedPromptMode,
  refreshPromptProfileLanguageOptions,
  loadProfilesOverview,
} from "./promptProfileState.js";

export {
  executionModeOptionsVersion,
  MODE_SELECT,
  TEXTFSM_PLATFORM_SELECT,
  executionConnectionProfileState,
  modeSelection,
  textfsmPlatformSelection,
  refreshExecutionModeOptionsForCurrentConnection,
} from "./promptProfileExecutionState.js";

export {
  customProfileBaseState,
  customProfileOptionsState,
  customProfileStatusState,
  customProfileListSectionDisplays,
  customProfileHookSectionDisplays,
  hookModeOptionsVersion,
  profileListRowsState,
  hookListRowsState,
  builtinProfileFormValue,
  saveCustomProfile,
  deleteCustomProfile,
  createCustomProfileDraft,
  loadSelectedCustomProfile,
  updateCustomCommandExecutionMode,
  updateCustomShellExitMarker,
  patchProfileListRow,
  removeHookListFlowStep,
  removeHookListRow,
  removeProfileListPattern,
  removeProfileListRow,
  setProfileListPattern,
  setProfileListPatternState,
  setProfileListSimpleValue,
  addHookListFlowStep,
  addHookListRow,
  addProfileListItem,
  addProfileListPattern,
  changeHookListKind,
  patchHookListCommand,
  patchHookListFlow,
  patchHookListFlowStep,
  patchHookListRow,
} from "./profilesCustomEditorState.js";

export {
  builtinProfileReadonlyDisplay,
  profileHookCommandModePatch,
  profileHookCommandTextPatch,
  profileHookCommandTimeoutPatch,
  profileHookFlowMaxStepsPatch,
  profileHookFlowStepCommandPatch,
  profileHookFlowStepModePatch,
  profileHookFlowStepTimeoutPatch,
  profileHookFlowStopOnErrorPatch,
  profileHookRowFailurePolicyPatch,
  profileHookRowNamePatch,
  profileHookRowRecordOutputPatch,
  profileHookRowStatePatch,
  profileListRowFieldPatches,
} from "./profilesEditorState.js";

export {
  createBuiltinProfileDetectSectionWorkspace,
  createBuiltinProfileHooksSectionWorkspace,
  createBuiltinProfileStateListsSectionWorkspace,
} from "./profilePanelChildWorkspaces.js";

function createProfileDiagnosePanelWorkspace() {
  return {
    ...createProfileDiagnosePanelWorkspaceCore(),
    profileChangeHandler() {
      return callbackHandler(setProfileDiagnoseSelected);
    },
  };
}

function setProfileDetectInitialRuleField(ruleIndex, fieldName, fieldValue) {
  return patchProfileDetectInitialRule(ruleIndex, {
    [fieldName]: fieldValue,
  });
}

function createCustomProfileDetectPanelWorkspace() {
  const workspace = createCustomProfileDetectPanelWorkspaceCore();
  return {
    ...workspace,
    addInitialRule: callbackHandler(addInitialRule),
    addProbe: callbackHandler(addProbe),
    changeInitialRulePattern(ruleIndex) {
      return callbackHandler(
        setProfileDetectInitialRuleField,
        ruleIndex,
        "pattern",
      );
    },
    changeInitialRuleWeight(ruleIndex) {
      return callbackHandler(
        setProfileDetectInitialRuleField,
        ruleIndex,
        "weight",
      );
    },
    removeInitialRuleHandler: (ruleIndex) =>
      callbackHandler(removeProfileDetectInitialRule, ruleIndex),
    setDetectEnabled: callbackHandler(setProfileDetectEnabled),
  };
}

export {
  createCustomProfileDetectPanelWorkspace,
  createProfileDiagnosePanelWorkspace,
};

export {
  createCustomProfilesEditorWorkspace,
  createProfileDetectProbeCardWorkspace,
  createProfileHookRowEditorWorkspace,
  createProfileListRowEditorWorkspace,
} from "./profilePanelChildWorkspaces.js";
