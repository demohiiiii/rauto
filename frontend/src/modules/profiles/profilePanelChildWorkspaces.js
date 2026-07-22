import { callbackHandler } from "../../lib/events.js";
import { currentLanguageState } from "../../lib/i18n.js";
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
  builtinProfileDetectDetailsPresentation,
  builtinProfileHooksDetailsPresentation,
  builtinProfileStateListsPresentation,
  hookOperationEditorDisplay,
  profileHookCommandModePatch,
  profileHookCommandInteractionPatch,
  profileHookCommandTextPatch,
  profileHookCommandTimeoutPatch,
  profileHookFlowEditorDisplay,
  profileHookFlowMaxStepsPatch,
  profileHookFlowStepCommandPatch,
  profileHookFlowStepInteractionPatch,
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

function createLanguageDisplayWorkspace(storeName, presentation) {
  return {
    [storeName]: derived(currentLanguageState, () => presentation()),
  };
}

export const createBuiltinProfileHooksSectionWorkspace = () =>
  createLanguageDisplayWorkspace(
    "hooksDisplayStateStore",
    builtinProfileHooksDetailsPresentation,
  );

export const createBuiltinProfileStateListsSectionWorkspace = () =>
  createLanguageDisplayWorkspace(
    "stateListsDisplayStateStore",
    builtinProfileStateListsPresentation,
  );

export const createBuiltinProfileDetectSectionWorkspace = () =>
  createLanguageDisplayWorkspace(
    "detectDisplayStateStore",
    builtinProfileDetectDetailsPresentation,
  );

function createLiveActionHandlers(stateStore, createHandlers, handlerNames) {
  function resolveHandler(handlerName, handlerArgs) {
    return createHandlers(getStore(stateStore))[handlerName](...handlerArgs);
  }

  return Object.fromEntries(
    handlerNames.map((handlerName) => [
      handlerName,
      (...handlerArgs) => {
        const initialHandler = resolveHandler(handlerName, handlerArgs);
        if (typeof initialHandler !== "function") return initialHandler;

        return (...callbackArgs) => {
          const liveHandler = resolveHandler(handlerName, handlerArgs);
          return typeof liveHandler === "function"
            ? liveHandler(...callbackArgs)
            : liveHandler;
        };
      },
    ]),
  );
}

function profilePatchHandler(onChange, ...patchArgs) {
  const value = profileInputValue(patchArgs.pop());
  const patchBuilder = patchArgs.pop();
  return callbackHandler(onChange, ...patchArgs)(patchBuilder(value));
}

function profileInputValue(value) {
  const currentTarget = value?.currentTarget;
  return currentTarget && "value" in currentTarget
    ? currentTarget.value
    : value;
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
        profilePatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.interactionIsDynamic,
          isDynamic,
        );
    },
    interactionInputChangeHandler() {
      return (input) =>
        profilePatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.interactionInput,
          input,
        );
    },
    interactionRecordInputChangeHandler() {
      return (recordInput) =>
        profilePatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.interactionRecordInput,
          recordInput,
        );
    },
    interactionStateChangeHandler() {
      return (state) =>
        profilePatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.interactionState,
          state,
        );
    },
    patternChangeHandler(patternIndex) {
      return (value) =>
        callbackHandler(
          onPatternChange,
          rowIndex,
          patternIndex,
        )(profileInputValue(value));
    },
    patternStateChangeHandler() {
      return (value) =>
        callbackHandler(
          onPatternStateChange,
          rowIndex,
        )(profileInputValue(value));
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
      return (value) =>
        callbackHandler(
          onSimpleValueChange,
          rowIndex,
        )(profileInputValue(value));
    },
    sysPromptNameGroupChangeHandler() {
      return (sysNameGroup) =>
        profilePatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.sysPromptNameGroup,
          sysNameGroup,
        );
    },
    sysPromptPatternChangeHandler() {
      return (pattern) =>
        profilePatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.sysPromptPattern,
          pattern,
        );
    },
    sysPromptStateChangeHandler() {
      return (state) =>
        profilePatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.sysPromptState,
          state,
        );
    },
    transitionCommandChangeHandler() {
      return (command) =>
        profilePatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.transitionCommand,
          command,
        );
    },
    transitionExitChangeHandler() {
      return (isExit) =>
        profilePatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.transitionIsExit,
          isExit,
        );
    },
    transitionFormatSysChangeHandler() {
      return (formatSys) =>
        profilePatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.transitionFormatSys,
          formatSys,
        );
    },
    transitionFromChangeHandler() {
      return (from) =>
        profilePatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.transitionFrom,
          from,
        );
    },
    transitionToChangeHandler() {
      return (to) =>
        profilePatchHandler(
          onProfileListRowChange,
          rowIndex,
          profileListRowFieldPatches.transitionTo,
          to,
        );
    },
  };
}

const profileListRowHandlerNames = Object.freeze([
  "addPatternHandler",
  "interactionDynamicChangeHandler",
  "interactionInputChangeHandler",
  "interactionRecordInputChangeHandler",
  "interactionStateChangeHandler",
  "patternChangeHandler",
  "patternStateChangeHandler",
  "removePatternHandler",
  "removeRowHandler",
  "removeSimpleValueHandler",
  "simpleValueChangeHandler",
  "sysPromptNameGroupChangeHandler",
  "sysPromptPatternChangeHandler",
  "sysPromptStateChangeHandler",
  "transitionCommandChangeHandler",
  "transitionExitChangeHandler",
  "transitionFormatSysChangeHandler",
  "transitionFromChangeHandler",
  "transitionToChangeHandler",
]);

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

  return {
    ...createLiveActionHandlers(
      callbackInputsStateStore,
      profileListRowInputHandlers,
      profileListRowHandlerNames,
    ),
    editorDisplayStateStore,
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
  };
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
        profilePatchHandler(
          onCommandChange,
          rowIndex,
          profileHookCommandModePatch,
          mode,
        );
    },
    commandInteractionChangeHandler() {
      return (interaction) =>
        profilePatchHandler(
          onCommandChange,
          rowIndex,
          profileHookCommandInteractionPatch,
          interaction,
        );
    },
    commandTextChangeHandler() {
      return (command) =>
        profilePatchHandler(
          onCommandChange,
          rowIndex,
          profileHookCommandTextPatch,
          command,
        );
    },
    commandTimeoutChangeHandler() {
      return (timeout) =>
        profilePatchHandler(
          onCommandChange,
          rowIndex,
          profileHookCommandTimeoutPatch,
          timeout,
        );
    },
    flowMaxStepsChangeHandler() {
      return (maxSteps) =>
        profilePatchHandler(
          onFlowChange,
          rowIndex,
          profileHookFlowMaxStepsPatch,
          maxSteps,
        );
    },
    flowStepCommandChangeHandler(stepIndex) {
      return (command) =>
        profilePatchHandler(
          onFlowStepChange,
          rowIndex,
          stepIndex,
          profileHookFlowStepCommandPatch,
          command,
        );
    },
    flowStepModeChangeHandler(stepIndex) {
      return (mode) =>
        profilePatchHandler(
          onFlowStepChange,
          rowIndex,
          stepIndex,
          profileHookFlowStepModePatch,
          mode,
        );
    },
    flowStepInteractionChangeHandler(stepIndex) {
      return (interaction) =>
        profilePatchHandler(
          onFlowStepChange,
          rowIndex,
          stepIndex,
          profileHookFlowStepInteractionPatch,
          interaction,
        );
    },
    flowStepTimeoutChangeHandler(stepIndex) {
      return (timeout) =>
        profilePatchHandler(
          onFlowStepChange,
          rowIndex,
          stepIndex,
          profileHookFlowStepTimeoutPatch,
          timeout,
        );
    },
    flowStopOnErrorChangeHandler() {
      return (stopOnError) =>
        profilePatchHandler(
          onFlowChange,
          rowIndex,
          profileHookFlowStopOnErrorPatch,
          stopOnError,
        );
    },
    hookFailurePolicyChangeHandler() {
      return (failurePolicy) =>
        profilePatchHandler(
          onHookRowChange,
          rowIndex,
          profileHookRowFailurePolicyPatch,
          failurePolicy,
        );
    },
    hookNameChangeHandler() {
      return (name) =>
        profilePatchHandler(
          onHookRowChange,
          rowIndex,
          profileHookRowNamePatch,
          name,
        );
    },
    hookRecordOutputChangeHandler() {
      return (recordOutput) =>
        profilePatchHandler(
          onHookRowChange,
          rowIndex,
          profileHookRowRecordOutputPatch,
          recordOutput,
        );
    },
    hookStateChangeHandler() {
      return (state) =>
        profilePatchHandler(
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

const profileHookRowHandlerNames = Object.freeze([
  "addFlowStepHandler",
  "commandInteractionChangeHandler",
  "commandModeChangeHandler",
  "commandTextChangeHandler",
  "commandTimeoutChangeHandler",
  "flowMaxStepsChangeHandler",
  "flowStepCommandChangeHandler",
  "flowStepInteractionChangeHandler",
  "flowStepModeChangeHandler",
  "flowStepTimeoutChangeHandler",
  "flowStopOnErrorChangeHandler",
  "hookFailurePolicyChangeHandler",
  "hookNameChangeHandler",
  "hookRecordOutputChangeHandler",
  "hookStateChangeHandler",
  "kindChangeHandler",
  "removeFlowStepHandler",
  "removeRowHandler",
]);

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

  return {
    ...createLiveActionHandlers(
      callbackInputsStateStore,
      profileHookRowInputHandlers,
      profileHookRowHandlerNames,
    ),
    editorDisplayStateStore,
    flowDisplayStateStore,
    flowStepsDisplayStateStore,
    operationDisplayStateStore,
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

const profileDetectProbeHandlerNames = Object.freeze([
  "addErrorPatternHandler",
  "addRuleHandler",
  "commandChangeHandler",
  "errorPatternChangeHandler",
  "removeErrorPatternHandler",
  "removeProbeHandler",
  "removeRuleHandler",
  "ruleFieldChangeHandler",
]);

export function createProfileDetectProbeCardWorkspace({
  probeIndex = -1,
} = {}) {
  const callbackInputsStateStore = writable({ probeIndex });

  return {
    ...createLiveActionHandlers(
      callbackInputsStateStore,
      profileDetectProbeInputHandlers,
      profileDetectProbeHandlerNames,
    ),
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

export function createCustomProfilesEditorWorkspace() {
  const workspace = createCustomProfilesEditorWorkspaceCore();
  const actionHandlers = customProfilesEditorInputHandlers({
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
