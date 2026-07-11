import { callbackHandler } from "../lib/events.js";
import {
  addProfileDetectInitialRule,
  addProfileDetectProbe,
  createCustomProfileDetectPanelWorkspace as createCustomProfileDetectPanelWorkspaceCore,
  createProfileDiagnosePanelWorkspace as createProfileDiagnosePanelWorkspaceCore,
  createProfileDiagnoseState,
  customProfileDetectPanelDisplay,
  patchProfileDetectInitialRule,
  profileDiagnoseDisplay,
  profileDiagnosePanelDisplay,
  promptModePresentation,
  promptProfilesPageDisplay,
  promptProfilesPagePresentation,
  removeProfileDetectInitialRule,
  setProfileDetectEnabled,
  setProfileDiagnoseSelected,
  builtinProfilesPanelDisplay,
} from "./promptProfileState.js";
import {
  builtinProfileDetectDetailsPresentation,
  builtinProfileHooksDetailsPresentation,
  builtinProfileReadonlyDisplay,
  builtinProfileStateListsPresentation,
  hookOperationEditorDisplay,
  profileHookFlowEditorDisplay,
  profileHookFlowStepsEditorDisplay,
  profileHookRowEditorDisplay,
  profileInteractionRowEditorPresentation,
  profileListRowEditorPresentation,
  profilePatternListEditorDisplay,
  profileTransitionRowEditorPresentation,
} from "./profilesEditorState.js";
import { customProfileSettingsDisplay } from "./profilesCustomEditorState.js";

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

function profileDiagnoseInputHandlers() {
  return {
    profileChangeHandler() {
      return callbackHandler(setProfileDiagnoseSelected);
    },
  };
}

function profileDiagnoseActionHandlers() {
  const inputHandlers = profileDiagnoseInputHandlers();
  return {
    profileChangeHandler: inputHandlers.profileChangeHandler,
  };
}

export function createProfileDiagnosePanelWorkspace() {
  const workspace = createProfileDiagnosePanelWorkspaceCore();
  const actionHandlers = profileDiagnoseActionHandlers();
  return {
    ...workspace,
    profileChangeHandler: actionHandlers.profileChangeHandler,
  };
}

function setProfileDetectInitialRuleField(ruleIndex, fieldName, fieldValue) {
  return patchProfileDetectInitialRule(ruleIndex, {
    [fieldName]: fieldValue,
  });
}

function customProfileDetectInputHandlers() {
  return {
    addInitialRuleHandler() {
      return callbackHandler(addProfileDetectInitialRule);
    },
    addProbeHandler() {
      return callbackHandler(addProfileDetectProbe);
    },
    enabledChangeHandler() {
      return callbackHandler(setProfileDetectEnabled);
    },
    initialRulePatternChangeHandler(ruleIndex) {
      return callbackHandler(
        setProfileDetectInitialRuleField,
        ruleIndex,
        "pattern",
      );
    },
    initialRuleWeightChangeHandler(ruleIndex) {
      return callbackHandler(
        setProfileDetectInitialRuleField,
        ruleIndex,
        "weight",
      );
    },
    removeInitialRuleHandler(ruleIndex) {
      return callbackHandler(removeProfileDetectInitialRule, ruleIndex);
    },
  };
}

function customProfileDetectActionHandlers() {
  const inputHandlers = customProfileDetectInputHandlers();
  return {
    addInitialRuleHandler: inputHandlers.addInitialRuleHandler,
    addProbeHandler: inputHandlers.addProbeHandler,
    enabledChangeHandler: inputHandlers.enabledChangeHandler,
    initialRulePatternChangeHandler:
      inputHandlers.initialRulePatternChangeHandler,
    initialRuleWeightChangeHandler:
      inputHandlers.initialRuleWeightChangeHandler,
    removeInitialRuleHandler: inputHandlers.removeInitialRuleHandler,
  };
}

export function createCustomProfileDetectPanelWorkspace() {
  const workspace = createCustomProfileDetectPanelWorkspaceCore();
  const actionHandlers = customProfileDetectActionHandlers();
  return {
    ...workspace,
    addInitialRule: actionHandlers.addInitialRuleHandler(),
    addProbe: actionHandlers.addProbeHandler(),
    changeInitialRulePattern(ruleIndex) {
      return actionHandlers.initialRulePatternChangeHandler(ruleIndex);
    },
    changeInitialRuleWeight(ruleIndex) {
      return actionHandlers.initialRuleWeightChangeHandler(ruleIndex);
    },
    removeInitialRuleHandler(ruleIndex) {
      return actionHandlers.removeInitialRuleHandler(ruleIndex);
    },
    setDetectEnabled: actionHandlers.enabledChangeHandler(),
  };
}

export { builtinProfileReadonlyDisplay };
