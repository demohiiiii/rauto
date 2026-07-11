import { callbackHandler } from "../lib/events.js";
import { currentLanguageState } from "../lib/i18n.js";
import { derived, get as getStore, writable } from "svelte/store";
import {
  addProfileDetectProbeErrorPattern,
  addProfileDetectProbeRule,
  patchProfileDetectProbe,
  patchProfileDetectProbeRule,
  removeProfileDetectProbe,
  removeProfileDetectProbeErrorPattern,
  removeProfileDetectProbeRule,
  setProfileDetectProbeErrorPattern,
} from "./profilesDiagnostics.js";
import {
  hookOperationEditorDisplay,
  profileHookCommandModePatch,
  profileHookCommandTextPatch,
  profileHookCommandTimeoutPatch,
  profileHookFlowEditorDisplay,
  profileHookFlowMaxStepsPatch,
  profileHookFlowStepCommandPatch,
  profileHookFlowStepModePatch,
  profileHookFlowStepTimeoutPatch,
  profileHookFlowStepsEditorDisplay,
  profileHookFlowStopOnErrorPatch,
  profileHookRowEditorDisplay,
  profileHookRowFailurePolicyPatch,
  profileHookRowNamePatch,
  profileHookRowRecordOutputPatch,
  profileHookRowStatePatch,
  profileListRowEditorPresentation,
  profileListRowFieldPatches,
} from "./profilesEditorState.js";
import {
  addHookListFlowStep,
  addProfileListPattern,
  changeHookListKind,
  createCustomProfilesEditorWorkspace as createCustomProfilesEditorWorkspaceCore,
  patchHookListCommand,
  patchHookListFlow,
  patchHookListFlowStep,
  patchHookListRow,
  patchProfileListRow,
  removeHookListFlowStep,
  removeHookListRow,
  removeProfileListPattern,
  removeProfileListRow,
  setProfileListPattern,
  setProfileListPatternState,
  setProfileListSimpleValue,
  updateCustomCommandExecutionMode,
  updateCustomShellExitMarker,
} from "./profilesCustomEditorState.js";

function profileListRowPatchHandler(
  onProfileListRowChange,
  rowIndex,
  patchBuilder,
  value,
) {
  return callbackHandler(onProfileListRowChange, rowIndex)(patchBuilder(value));
}

function profileListRowInputHandlers({
  onAddPattern = null,
  onPatternChange = null,
  onPatternStateChange = null,
  onProfileListRowChange = null,
  onRemovePattern = null,
  onRemoveRow = null,
  onRemoveSimpleValue = null,
  onSimpleValueChange = null,
  rowIndex = -1,
} = {}) {
  return {
    addPatternHandler() {
      return callbackHandler(onAddPattern, rowIndex);
    },
    interactionDynamicChangeHandler() {
      return (isDynamic) =>
        profileListRowPatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.interactionIsDynamic,
          isDynamic,
        );
    },
    interactionInputChangeHandler() {
      return (input) =>
        profileListRowPatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.interactionInput,
          input,
        );
    },
    interactionRecordInputChangeHandler() {
      return (recordInput) =>
        profileListRowPatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.interactionRecordInput,
          recordInput,
        );
    },
    patternChangeHandler(patternIndex) {
      return callbackHandler(onPatternChange, rowIndex, patternIndex);
    },
    patternStateChangeHandler() {
      return callbackHandler(onPatternStateChange, rowIndex);
    },
    removePatternHandler(patternIndex) {
      return callbackHandler(onRemovePattern, rowIndex, patternIndex);
    },
    removeRowHandler() {
      return callbackHandler(onRemoveRow, rowIndex);
    },
    removeSimpleValueHandler() {
      return callbackHandler(onRemoveSimpleValue, rowIndex);
    },
    simpleValueChangeHandler() {
      return callbackHandler(onSimpleValueChange, rowIndex);
    },
    sysPromptNameGroupChangeHandler() {
      return (sysNameGroup) =>
        profileListRowPatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.sysPromptNameGroup,
          sysNameGroup,
        );
    },
    sysPromptPatternChangeHandler() {
      return (pattern) =>
        profileListRowPatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.sysPromptPattern,
          pattern,
        );
    },
    sysPromptStateChangeHandler() {
      return (state) =>
        profileListRowPatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.sysPromptState,
          state,
        );
    },
    transitionCommandChangeHandler() {
      return (command) =>
        profileListRowPatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.transitionCommand,
          command,
        );
    },
    transitionExitChangeHandler() {
      return (isExit) =>
        profileListRowPatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.transitionIsExit,
          isExit,
        );
    },
    transitionFormatSysChangeHandler() {
      return (formatSys) =>
        profileListRowPatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.transitionFormatSys,
          formatSys,
        );
    },
    transitionFromChangeHandler() {
      return (from) =>
        profileListRowPatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.transitionFrom,
          from,
        );
    },
    transitionToChangeHandler() {
      return (to) =>
        profileListRowPatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.transitionTo,
          to,
        );
    },
  };
}

function profileListRowActionHandlers(options = {}) {
  const inputHandlers = profileListRowInputHandlers(options);
  return {
    addPatternHandler: inputHandlers.addPatternHandler,
    interactionDynamicChangeHandler:
      inputHandlers.interactionDynamicChangeHandler,
    interactionInputChangeHandler: inputHandlers.interactionInputChangeHandler,
    interactionRecordInputChangeHandler:
      inputHandlers.interactionRecordInputChangeHandler,
    patternChangeHandler: inputHandlers.patternChangeHandler,
    patternStateChangeHandler: inputHandlers.patternStateChangeHandler,
    removePatternHandler: inputHandlers.removePatternHandler,
    removeRowHandler: inputHandlers.removeRowHandler,
    removeSimpleValueHandler: inputHandlers.removeSimpleValueHandler,
    simpleValueChangeHandler: inputHandlers.simpleValueChangeHandler,
    sysPromptNameGroupChangeHandler:
      inputHandlers.sysPromptNameGroupChangeHandler,
    sysPromptPatternChangeHandler: inputHandlers.sysPromptPatternChangeHandler,
    sysPromptStateChangeHandler: inputHandlers.sysPromptStateChangeHandler,
    transitionCommandChangeHandler:
      inputHandlers.transitionCommandChangeHandler,
    transitionExitChangeHandler: inputHandlers.transitionExitChangeHandler,
    transitionFormatSysChangeHandler:
      inputHandlers.transitionFormatSysChangeHandler,
    transitionFromChangeHandler: inputHandlers.transitionFromChangeHandler,
    transitionToChangeHandler: inputHandlers.transitionToChangeHandler,
  };
}

export function createProfileListRowEditorWorkspace({
  onAddPattern = null,
  onPatternChange = null,
  onPatternStateChange = null,
  onProfileListRowChange = null,
  onRemovePattern = null,
  onRemoveRow = null,
  onRemoveSimpleValue = null,
  onSimpleValueChange = null,
  rowIndex = -1,
} = {}) {
  const displayInputsStateStore = writable({
    kind: "",
    profileListRow: null,
  });
  const callbackInputsStateStore = writable({
    onAddPattern,
    onPatternChange,
    onPatternStateChange,
    onProfileListRowChange,
    onRemovePattern,
    onRemoveRow,
    onRemoveSimpleValue,
    onSimpleValueChange,
    rowIndex,
  });
  const editorDisplayStateStore = derived(
    [displayInputsStateStore, currentLanguageState],
    ([$displayInputsStateStore]) =>
      profileListRowEditorPresentation($displayInputsStateStore),
  );

  function currentActionHandlers() {
    return profileListRowActionHandlers(getStore(callbackInputsStateStore));
  }

  return {
    addPatternHandler() {
      return currentActionHandlers().addPatternHandler();
    },
    editorDisplayStateStore,
    interactionDynamicChangeHandler() {
      return currentActionHandlers().interactionDynamicChangeHandler();
    },
    interactionInputChangeHandler() {
      return currentActionHandlers().interactionInputChangeHandler();
    },
    interactionRecordInputChangeHandler() {
      return currentActionHandlers().interactionRecordInputChangeHandler();
    },
    patternChangeHandler(patternIndex) {
      return currentActionHandlers().patternChangeHandler(patternIndex);
    },
    patternStateChangeHandler() {
      return currentActionHandlers().patternStateChangeHandler();
    },
    removePatternHandler(patternIndex) {
      return currentActionHandlers().removePatternHandler(patternIndex);
    },
    removeRowHandler() {
      return currentActionHandlers().removeRowHandler();
    },
    removeSimpleValueHandler() {
      return currentActionHandlers().removeSimpleValueHandler();
    },
    setRowContext({
      kind: nextKind = "",
      profileListRow: nextProfileListRow = null,
      rowIndex: nextRowIndex = -1,
    } = {}) {
      displayInputsStateStore.set({
        kind: nextKind,
        profileListRow: nextProfileListRow,
      });
      callbackInputsStateStore.update((state) => ({
        ...state,
        rowIndex: nextRowIndex,
      }));
    },
    simpleValueChangeHandler() {
      return currentActionHandlers().simpleValueChangeHandler();
    },
    sysPromptNameGroupChangeHandler() {
      return currentActionHandlers().sysPromptNameGroupChangeHandler();
    },
    sysPromptPatternChangeHandler() {
      return currentActionHandlers().sysPromptPatternChangeHandler();
    },
    sysPromptStateChangeHandler() {
      return currentActionHandlers().sysPromptStateChangeHandler();
    },
    transitionCommandChangeHandler() {
      return currentActionHandlers().transitionCommandChangeHandler();
    },
    transitionExitChangeHandler() {
      return currentActionHandlers().transitionExitChangeHandler();
    },
    transitionFormatSysChangeHandler() {
      return currentActionHandlers().transitionFormatSysChangeHandler();
    },
    transitionFromChangeHandler() {
      return currentActionHandlers().transitionFromChangeHandler();
    },
    transitionToChangeHandler() {
      return currentActionHandlers().transitionToChangeHandler();
    },
  };
}

function profileHookRowPatchHandler(
  onHookRowChange,
  rowIndex,
  patchBuilder,
  value,
) {
  return callbackHandler(onHookRowChange, rowIndex)(patchBuilder(value));
}

function profileHookCommandPatchHandler(
  onCommandChange,
  rowIndex,
  patchBuilder,
  value,
) {
  return callbackHandler(onCommandChange, rowIndex)(patchBuilder(value));
}

function profileHookFlowPatchHandler(
  onFlowChange,
  rowIndex,
  patchBuilder,
  value,
) {
  return callbackHandler(onFlowChange, rowIndex)(patchBuilder(value));
}

function profileHookFlowStepPatchHandler(
  onFlowStepChange,
  rowIndex,
  stepIndex,
  patchBuilder,
  value,
) {
  return callbackHandler(
    onFlowStepChange,
    rowIndex,
    stepIndex,
  )(patchBuilder(value));
}

function profileHookRowInputHandlers({
  onAddFlowStep = null,
  onCommandChange = null,
  onFlowChange = null,
  onFlowStepChange = null,
  onHookRowChange = null,
  onKindChange = null,
  onRemoveFlowStep = null,
  onRemoveRow = null,
  rowIndex = -1,
} = {}) {
  return {
    addFlowStepHandler() {
      return callbackHandler(onAddFlowStep, rowIndex);
    },
    commandModeChangeHandler() {
      return (mode) =>
        profileHookCommandPatchHandler(
          onCommandChange,
          rowIndex,
          profileHookCommandModePatch,
          mode,
        );
    },
    commandTextChangeHandler() {
      return (command) =>
        profileHookCommandPatchHandler(
          onCommandChange,
          rowIndex,
          profileHookCommandTextPatch,
          command,
        );
    },
    commandTimeoutChangeHandler() {
      return (timeout) =>
        profileHookCommandPatchHandler(
          onCommandChange,
          rowIndex,
          profileHookCommandTimeoutPatch,
          timeout,
        );
    },
    flowMaxStepsChangeHandler() {
      return (maxSteps) =>
        profileHookFlowPatchHandler(
          onFlowChange,
          rowIndex,
          profileHookFlowMaxStepsPatch,
          maxSteps,
        );
    },
    flowStepCommandChangeHandler(stepIndex) {
      return (command) =>
        profileHookFlowStepPatchHandler(
          onFlowStepChange,
          rowIndex,
          stepIndex,
          profileHookFlowStepCommandPatch,
          command,
        );
    },
    flowStepModeChangeHandler(stepIndex) {
      return (mode) =>
        profileHookFlowStepPatchHandler(
          onFlowStepChange,
          rowIndex,
          stepIndex,
          profileHookFlowStepModePatch,
          mode,
        );
    },
    flowStepTimeoutChangeHandler(stepIndex) {
      return (timeout) =>
        profileHookFlowStepPatchHandler(
          onFlowStepChange,
          rowIndex,
          stepIndex,
          profileHookFlowStepTimeoutPatch,
          timeout,
        );
    },
    flowStopOnErrorChangeHandler() {
      return (stopOnError) =>
        profileHookFlowPatchHandler(
          onFlowChange,
          rowIndex,
          profileHookFlowStopOnErrorPatch,
          stopOnError,
        );
    },
    hookFailurePolicyChangeHandler() {
      return (failurePolicy) =>
        profileHookRowPatchHandler(
          onHookRowChange,
          rowIndex,
          profileHookRowFailurePolicyPatch,
          failurePolicy,
        );
    },
    hookNameChangeHandler() {
      return (name) =>
        profileHookRowPatchHandler(
          onHookRowChange,
          rowIndex,
          profileHookRowNamePatch,
          name,
        );
    },
    hookRecordOutputChangeHandler() {
      return (recordOutput) =>
        profileHookRowPatchHandler(
          onHookRowChange,
          rowIndex,
          profileHookRowRecordOutputPatch,
          recordOutput,
        );
    },
    hookStateChangeHandler() {
      return (state) =>
        profileHookRowPatchHandler(
          onHookRowChange,
          rowIndex,
          profileHookRowStatePatch,
          state,
        );
    },
    kindChangeHandler() {
      return callbackHandler(onKindChange, rowIndex);
    },
    removeFlowStepHandler(stepIndex) {
      return callbackHandler(onRemoveFlowStep, rowIndex, stepIndex);
    },
    removeRowHandler() {
      return callbackHandler(onRemoveRow, rowIndex);
    },
  };
}

function profileHookRowActionHandlers(options = {}) {
  const inputHandlers = profileHookRowInputHandlers(options);
  return {
    addFlowStepHandler: inputHandlers.addFlowStepHandler,
    commandModeChangeHandler: inputHandlers.commandModeChangeHandler,
    commandTextChangeHandler: inputHandlers.commandTextChangeHandler,
    commandTimeoutChangeHandler: inputHandlers.commandTimeoutChangeHandler,
    flowMaxStepsChangeHandler: inputHandlers.flowMaxStepsChangeHandler,
    flowStepCommandChangeHandler: inputHandlers.flowStepCommandChangeHandler,
    flowStepModeChangeHandler: inputHandlers.flowStepModeChangeHandler,
    flowStepTimeoutChangeHandler: inputHandlers.flowStepTimeoutChangeHandler,
    flowStopOnErrorChangeHandler: inputHandlers.flowStopOnErrorChangeHandler,
    hookFailurePolicyChangeHandler:
      inputHandlers.hookFailurePolicyChangeHandler,
    hookNameChangeHandler: inputHandlers.hookNameChangeHandler,
    hookRecordOutputChangeHandler: inputHandlers.hookRecordOutputChangeHandler,
    hookStateChangeHandler: inputHandlers.hookStateChangeHandler,
    kindChangeHandler: inputHandlers.kindChangeHandler,
    removeFlowStepHandler: inputHandlers.removeFlowStepHandler,
    removeRowHandler: inputHandlers.removeRowHandler,
  };
}

export function createProfileHookRowEditorWorkspace({
  onAddFlowStep = null,
  onCommandChange = null,
  onFlowChange = null,
  onFlowStepChange = null,
  onKindChange = null,
  onRemoveFlowStep = null,
  onRemoveRow = null,
  onHookRowChange = null,
  rowIndex = -1,
} = {}) {
  const displayInputsStateStore = writable({
    hookRow: {},
    modeOptions: [],
  });
  const callbackInputsStateStore = writable({
    onAddFlowStep,
    onCommandChange,
    onFlowChange,
    onFlowStepChange,
    onHookRowChange,
    onKindChange,
    onRemoveFlowStep,
    onRemoveRow,
    rowIndex,
  });
  const editorDisplayStateStore = derived(
    [displayInputsStateStore, currentLanguageState],
    ([$displayInputsStateStore]) =>
      profileHookRowEditorDisplay($displayInputsStateStore),
  );
  const operationDisplayStateStore = derived(
    [displayInputsStateStore, currentLanguageState],
    ([$displayInputsStateStore]) =>
      hookOperationEditorDisplay($displayInputsStateStore.hookRow, {
        modeOptions: $displayInputsStateStore.modeOptions,
      }),
  );
  const flowDisplayStateStore = derived(
    [operationDisplayStateStore, currentLanguageState],
    ([$operationDisplayStateStore]) =>
      profileHookFlowEditorDisplay($operationDisplayStateStore.flow),
  );
  const flowStepsDisplayStateStore = derived(
    [flowDisplayStateStore, displayInputsStateStore, currentLanguageState],
    ([$flowDisplayStateStore, $displayInputsStateStore]) =>
      profileHookFlowStepsEditorDisplay({
        modeOptions: $displayInputsStateStore.modeOptions,
        steps: $flowDisplayStateStore.steps,
      }),
  );

  function currentActionHandlers() {
    return profileHookRowActionHandlers(getStore(callbackInputsStateStore));
  }

  return {
    addFlowStepHandler() {
      return currentActionHandlers().addFlowStepHandler();
    },
    commandModeChangeHandler() {
      return currentActionHandlers().commandModeChangeHandler();
    },
    commandTextChangeHandler() {
      return currentActionHandlers().commandTextChangeHandler();
    },
    commandTimeoutChangeHandler() {
      return currentActionHandlers().commandTimeoutChangeHandler();
    },
    editorDisplayStateStore,
    flowMaxStepsChangeHandler() {
      return currentActionHandlers().flowMaxStepsChangeHandler();
    },
    flowDisplayStateStore,
    flowStepCommandChangeHandler(stepIndex) {
      return currentActionHandlers().flowStepCommandChangeHandler(stepIndex);
    },
    flowStepModeChangeHandler(stepIndex) {
      return currentActionHandlers().flowStepModeChangeHandler(stepIndex);
    },
    flowStepTimeoutChangeHandler(stepIndex) {
      return currentActionHandlers().flowStepTimeoutChangeHandler(stepIndex);
    },
    flowStopOnErrorChangeHandler() {
      return currentActionHandlers().flowStopOnErrorChangeHandler();
    },
    hookFailurePolicyChangeHandler() {
      return currentActionHandlers().hookFailurePolicyChangeHandler();
    },
    hookNameChangeHandler() {
      return currentActionHandlers().hookNameChangeHandler();
    },
    hookRecordOutputChangeHandler() {
      return currentActionHandlers().hookRecordOutputChangeHandler();
    },
    hookStateChangeHandler() {
      return currentActionHandlers().hookStateChangeHandler();
    },
    flowStepsDisplayStateStore,
    kindChangeHandler() {
      return currentActionHandlers().kindChangeHandler();
    },
    operationDisplayStateStore,
    removeFlowStepHandler(stepIndex) {
      return currentActionHandlers().removeFlowStepHandler(stepIndex);
    },
    removeRowHandler() {
      return currentActionHandlers().removeRowHandler();
    },
    setRowContext({
      hookRow: nextHookRow = {},
      modeOptions: nextModeOptions = [],
      rowIndex: nextRowIndex = -1,
    } = {}) {
      displayInputsStateStore.set({
        hookRow: nextHookRow,
        modeOptions: nextModeOptions,
      });
      callbackInputsStateStore.update((state) => ({
        ...state,
        rowIndex: nextRowIndex,
      }));
    },
  };
}

function setProfileDetectProbeCommand(probeIndex, command) {
  return patchProfileDetectProbe(probeIndex, { command });
}

function setProfileDetectProbeRuleField(
  probeIndex,
  ruleIndex,
  fieldName,
  fieldValue,
) {
  return patchProfileDetectProbeRule(probeIndex, ruleIndex, {
    [fieldName]: fieldValue,
  });
}

function profileDetectProbeInputHandlers({ probeIndex = -1 } = {}) {
  return {
    addErrorPatternHandler() {
      return callbackHandler(addProfileDetectProbeErrorPattern, probeIndex);
    },
    addRuleHandler() {
      return callbackHandler(addProfileDetectProbeRule, probeIndex);
    },
    commandChangeHandler() {
      return callbackHandler(setProfileDetectProbeCommand, probeIndex);
    },
    errorPatternChangeHandler(patternIndex) {
      return callbackHandler(
        setProfileDetectProbeErrorPattern,
        probeIndex,
        patternIndex,
      );
    },
    removeErrorPatternHandler(patternIndex) {
      return callbackHandler(
        removeProfileDetectProbeErrorPattern,
        probeIndex,
        patternIndex,
      );
    },
    removeProbeHandler() {
      return callbackHandler(removeProfileDetectProbe, probeIndex);
    },
    removeRuleHandler(ruleIndex) {
      return callbackHandler(
        removeProfileDetectProbeRule,
        probeIndex,
        ruleIndex,
      );
    },
    ruleFieldChangeHandler(ruleIndex, fieldName) {
      return callbackHandler(
        setProfileDetectProbeRuleField,
        probeIndex,
        ruleIndex,
        fieldName,
      );
    },
  };
}

function profileDetectProbeActionHandlers(options = {}) {
  const inputHandlers = profileDetectProbeInputHandlers(options);
  return {
    addErrorPatternHandler: inputHandlers.addErrorPatternHandler,
    addRuleHandler: inputHandlers.addRuleHandler,
    commandChangeHandler: inputHandlers.commandChangeHandler,
    errorPatternChangeHandler: inputHandlers.errorPatternChangeHandler,
    removeErrorPatternHandler: inputHandlers.removeErrorPatternHandler,
    removeProbeHandler: inputHandlers.removeProbeHandler,
    removeRuleHandler: inputHandlers.removeRuleHandler,
    ruleFieldChangeHandler: inputHandlers.ruleFieldChangeHandler,
  };
}

export function createProfileDetectProbeCardWorkspace({
  probeIndex = -1,
} = {}) {
  const callbackInputsStateStore = writable({ probeIndex });

  function currentActionHandlers() {
    return profileDetectProbeActionHandlers(getStore(callbackInputsStateStore));
  }

  return {
    addErrorPatternHandler() {
      return currentActionHandlers().addErrorPatternHandler();
    },
    addRuleHandler() {
      return currentActionHandlers().addRuleHandler();
    },
    commandChangeHandler() {
      return currentActionHandlers().commandChangeHandler();
    },
    errorPatternChangeHandler(patternIndex) {
      return currentActionHandlers().errorPatternChangeHandler(patternIndex);
    },
    removeErrorPatternHandler(patternIndex) {
      return currentActionHandlers().removeErrorPatternHandler(patternIndex);
    },
    removeProbeHandler() {
      return currentActionHandlers().removeProbeHandler();
    },
    removeRuleHandler(ruleIndex) {
      return currentActionHandlers().removeRuleHandler(ruleIndex);
    },
    ruleFieldChangeHandler(ruleIndex, fieldName) {
      return currentActionHandlers().ruleFieldChangeHandler(
        ruleIndex,
        fieldName,
      );
    },
    setProbeIndex(nextProbeIndex = -1) {
      callbackInputsStateStore.set({
        probeIndex: nextProbeIndex,
      });
    },
  };
}

function customProfilesEditorInputHandlers({
  addFlowStep = null,
  addHookRow = null,
  addListItem = null,
  addPattern = null,
  changeHookKind = null,
  loadProfile = null,
  patchCommand = null,
  patchFlow = null,
  patchFlowStep = null,
  patchHookRow = null,
  patchListRow = null,
  removeFlowStep = null,
  removeHookRow = null,
  removePattern = null,
  removeRow = null,
  setPatternState = null,
  setPatternValue = null,
  setSimpleValue = null,
  updateCommandExecutionMode = null,
  updateShellExitMarker = null,
} = {}) {
  return {
    commandExecutionModeChangeHandler() {
      return callbackHandler(updateCommandExecutionMode);
    },
    hookAddHandler(listKey) {
      return callbackHandler(addHookRow, listKey);
    },
    hookRowCallbacks(listKey) {
      return {
        onAddFlowStep: callbackHandler(addFlowStep, listKey),
        onCommandChange: callbackHandler(patchCommand, listKey),
        onFlowChange: callbackHandler(patchFlow, listKey),
        onFlowStepChange: callbackHandler(patchFlowStep, listKey),
        onHookRowChange: callbackHandler(patchHookRow, listKey),
        onKindChange: callbackHandler(changeHookKind, listKey),
        onRemoveFlowStep: callbackHandler(removeFlowStep, listKey),
        onRemoveRow: callbackHandler(removeHookRow, listKey),
      };
    },
    profileListAddHandler(listKey, kind) {
      return callbackHandler(addListItem, listKey, kind);
    },
    profileListRowCallbacks(listKey, kind) {
      return {
        onAddPattern: callbackHandler(addPattern, listKey),
        onPatternChange: callbackHandler(setPatternValue, listKey),
        onPatternStateChange: callbackHandler(setPatternState, listKey, kind),
        onProfileListRowChange: callbackHandler(patchListRow, listKey),
        onRemovePattern: callbackHandler(removePattern, listKey),
        onRemoveRow: callbackHandler(removeRow, listKey),
        onRemoveSimpleValue: callbackHandler(removeRow, listKey),
        onSimpleValueChange: callbackHandler(setSimpleValue, listKey),
      };
    },
    selectedProfileChangeHandler() {
      return callbackHandler(loadProfile);
    },
    shellExitMarkerChangeHandler() {
      return callbackHandler(updateShellExitMarker);
    },
  };
}

function customProfilesEditorActionHandlers(options = {}) {
  const inputHandlers = customProfilesEditorInputHandlers(options);
  return {
    commandExecutionModeChangeHandler:
      inputHandlers.commandExecutionModeChangeHandler,
    hookAddHandler: inputHandlers.hookAddHandler,
    hookRowCallbacks: inputHandlers.hookRowCallbacks,
    profileListAddHandler: inputHandlers.profileListAddHandler,
    profileListRowCallbacks: inputHandlers.profileListRowCallbacks,
    selectedProfileChangeHandler: inputHandlers.selectedProfileChangeHandler,
    shellExitMarkerChangeHandler: inputHandlers.shellExitMarkerChangeHandler,
  };
}

export function createCustomProfilesEditorWorkspace() {
  const workspace = createCustomProfilesEditorWorkspaceCore();
  const actionHandlers = customProfilesEditorActionHandlers({
    addFlowStep: workspace.addFlowStep,
    addHookRow: workspace.addHookRow,
    addListItem: workspace.addListItem,
    addPattern: workspace.addPattern,
    changeHookKind: workspace.changeHookKind,
    loadProfile: workspace.loadProfile,
    patchCommand: workspace.patchCommand,
    patchFlow: workspace.patchFlow,
    patchFlowStep: workspace.patchFlowStep,
    patchHookRow: workspace.patchHookRow,
    patchListRow: workspace.patchListRow,
    removeFlowStep: workspace.removeFlowStep,
    removeHookRow: workspace.removeHookRow,
    removePattern: workspace.removePattern,
    removeRow: workspace.removeRow,
    setPatternState: workspace.setPatternState,
    setPatternValue: workspace.setPatternValue,
    setSimpleValue: workspace.setSimpleValue,
    updateCommandExecutionMode: workspace.updateCommandExecutionMode,
    updateShellExitMarker: workspace.updateShellExitMarker,
  });
  return {
    ...workspace,
    commandExecutionModeChangeHandler:
      actionHandlers.commandExecutionModeChangeHandler,
    hookAddHandler: actionHandlers.hookAddHandler,
    hookRowCallbacks: actionHandlers.hookRowCallbacks,
    profileListAddHandler: actionHandlers.profileListAddHandler,
    profileListRowCallbacks: actionHandlers.profileListRowCallbacks,
    selectedProfileChangeHandler: actionHandlers.selectedProfileChangeHandler,
    shellExitMarkerChangeHandler: actionHandlers.shellExitMarkerChangeHandler,
  };
}
