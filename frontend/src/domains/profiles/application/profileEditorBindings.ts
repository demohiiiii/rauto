import { get as getStore } from "svelte/store";
import type { Readable } from "svelte/store";
import {
  addProfileDetectProbeErrorPattern,
  addProfileDetectProbeRule,
  patchProfileDetectProbe,
  patchProfileDetectProbeRule,
  removeProfileDetectProbe,
  removeProfileDetectProbeErrorPattern,
  removeProfileDetectProbeRule,
  setProfileDetectProbeErrorPattern,
} from "./profileDiagnosticsState.js";
import type { ProfileDetectRuleDraft } from "../model/profileDiagnostics.js";
import type { createCustomProfilesEditorWorkspace } from "./customProfileEditorState.js";
import {
  profileHookCommandInteractionPatch,
  profileHookCommandModePatch,
  profileHookCommandTextPatch,
  profileHookCommandTimeoutPatch,
  profileHookFlowMaxStepsPatch,
  profileHookFlowStepCommandPatch,
  profileHookFlowStepInteractionPatch,
  profileHookFlowStepModePatch,
  profileHookFlowStepTimeoutPatch,
  profileHookFlowStopOnErrorPatch,
  profileHookRowFailurePolicyPatch,
  profileHookRowNamePatch,
  profileHookRowRecordOutputPatch,
  profileHookRowStatePatch,
  profileListRowFieldPatches,
} from "../model/profileEditor.js";
import type {
  ProfileCommandInteractionInput,
  ProfileHookCommandPatch,
  ProfileHookFlowPatch,
  ProfileHookKind,
  ProfileHookRowPatch,
  ProfileListKind,
  ProfileListRowPatch,
} from "../model/types.js";

interface InputValueEvent<T> {
  currentTarget?: { value?: T } | null;
}

type ProfileInput<T> = T | InputValueEvent<T>;
type OptionalCallback<TArgs extends unknown[]> =
  | ((...args: TArgs) => unknown)
  | null
  | undefined;

function callbackWithPrefix<TPrefix extends unknown[], TArgs extends unknown[]>(
  callback: OptionalCallback<[...TPrefix, ...TArgs]>,
  ...prefixArgs: TPrefix
): (...args: TArgs) => unknown {
  return (...args) => callback?.(...prefixArgs, ...args);
}

function profileInputValue<T>(value: ProfileInput<T>): T {
  if (value && typeof value === "object" && "currentTarget" in value) {
    const currentTarget = value.currentTarget;
    if (currentTarget && "value" in currentTarget) {
      return currentTarget.value as T;
    }
  }
  return value as T;
}

function profilePatchHandler<TPrefix extends unknown[], TValue, TPatch>(
  onChange: OptionalCallback<[...TPrefix, TPatch]>,
  prefixArgs: TPrefix,
  patchBuilder: (value: TValue) => TPatch,
  value: ProfileInput<TValue>,
): unknown {
  return onChange?.(...prefixArgs, patchBuilder(profileInputValue(value)));
}

function invoke(value: unknown, args: unknown[]): unknown {
  return typeof value === "function"
    ? Reflect.apply(value, undefined, args)
    : undefined;
}

export function createLiveActionHandlers<
  TState,
  THandlers,
  const TNames extends readonly (keyof THandlers & string)[],
>(
  stateStore: Readable<TState>,
  createHandlers: (state: TState) => THandlers,
  handlerNames: TNames,
): Pick<THandlers, TNames[number]> {
  const entries = handlerNames.map((handlerName) => {
    const handler = (...handlerArgs: unknown[]) => {
      const resolveHandler = () =>
        invoke(createHandlers(getStore(stateStore))[handlerName], handlerArgs);
      const initialHandler = resolveHandler();
      if (typeof initialHandler !== "function") return initialHandler;

      return (...callbackArgs: unknown[]) => {
        const liveHandler = resolveHandler();
        return typeof liveHandler === "function"
          ? Reflect.apply(liveHandler, undefined, callbackArgs)
          : liveHandler;
      };
    };
    return [handlerName, handler] as const;
  });
  return Object.fromEntries(entries) as Pick<THandlers, TNames[number]>;
}

export interface ProfileListRowHandlerOptions {
  onAddPattern?: OptionalCallback<[number]>;
  onPatternChange?: OptionalCallback<[number, number, string]>;
  onPatternStateChange?: OptionalCallback<[number, string]>;
  onProfileListRowChange?: OptionalCallback<[number, ProfileListRowPatch]>;
  onRemovePattern?: OptionalCallback<[number, number]>;
  onRemoveRow?: OptionalCallback<[number]>;
  onRemoveSimpleValue?: OptionalCallback<[number]>;
  onSimpleValueChange?: OptionalCallback<[number, string]>;
  rowIndex?: number;
}

export function profileListRowInputHandlers({
  onAddPattern = null,
  onPatternChange = null,
  onPatternStateChange = null,
  onProfileListRowChange = null,
  onRemovePattern = null,
  onRemoveRow = null,
  onRemoveSimpleValue = null,
  onSimpleValueChange = null,
  rowIndex = -1,
}: ProfileListRowHandlerOptions = {}) {
  return {
    addPatternHandler() {
      return callbackWithPrefix(onAddPattern, rowIndex);
    },
    interactionDynamicChangeHandler() {
      return (isDynamic: ProfileInput<boolean>) =>
        profilePatchHandler(
          onProfileListRowChange,
          [rowIndex],
          profileListRowFieldPatches.interactionIsDynamic,
          isDynamic,
        );
    },
    interactionInputChangeHandler() {
      return (input: ProfileInput<string>) =>
        profilePatchHandler(
          onProfileListRowChange,
          [rowIndex],
          profileListRowFieldPatches.interactionInput,
          input,
        );
    },
    interactionRecordInputChangeHandler() {
      return (recordInput: ProfileInput<boolean>) =>
        profilePatchHandler(
          onProfileListRowChange,
          [rowIndex],
          profileListRowFieldPatches.interactionRecordInput,
          recordInput,
        );
    },
    interactionStateChangeHandler() {
      return (state: ProfileInput<string>) =>
        profilePatchHandler(
          onProfileListRowChange,
          [rowIndex],
          profileListRowFieldPatches.interactionState,
          state,
        );
    },
    patternChangeHandler(patternIndex: number) {
      return (value: ProfileInput<string>) =>
        callbackWithPrefix(
          onPatternChange,
          rowIndex,
          patternIndex,
        )(profileInputValue(value));
    },
    patternStateChangeHandler() {
      return (value: ProfileInput<string>) =>
        callbackWithPrefix(
          onPatternStateChange,
          rowIndex,
        )(profileInputValue(value));
    },
    removePatternHandler(patternIndex: number) {
      return callbackWithPrefix(onRemovePattern, rowIndex, patternIndex);
    },
    removeRowHandler() {
      return callbackWithPrefix(onRemoveRow, rowIndex);
    },
    removeSimpleValueHandler() {
      return callbackWithPrefix(onRemoveSimpleValue, rowIndex);
    },
    simpleValueChangeHandler() {
      return (value: ProfileInput<string>) =>
        callbackWithPrefix(
          onSimpleValueChange,
          rowIndex,
        )(profileInputValue(value));
    },
    sysPromptNameGroupChangeHandler() {
      return (sysNameGroup: ProfileInput<string>) =>
        profilePatchHandler(
          onProfileListRowChange,
          [rowIndex],
          profileListRowFieldPatches.sysPromptNameGroup,
          sysNameGroup,
        );
    },
    sysPromptPatternChangeHandler() {
      return (pattern: ProfileInput<string>) =>
        profilePatchHandler(
          onProfileListRowChange,
          [rowIndex],
          profileListRowFieldPatches.sysPromptPattern,
          pattern,
        );
    },
    sysPromptStateChangeHandler() {
      return (state: ProfileInput<string>) =>
        profilePatchHandler(
          onProfileListRowChange,
          [rowIndex],
          profileListRowFieldPatches.sysPromptState,
          state,
        );
    },
    transitionCommandChangeHandler() {
      return (command: ProfileInput<string>) =>
        profilePatchHandler(
          onProfileListRowChange,
          [rowIndex],
          profileListRowFieldPatches.transitionCommand,
          command,
        );
    },
    transitionExitChangeHandler() {
      return (isExit: ProfileInput<boolean>) =>
        profilePatchHandler(
          onProfileListRowChange,
          [rowIndex],
          profileListRowFieldPatches.transitionIsExit,
          isExit,
        );
    },
    transitionFormatSysChangeHandler() {
      return (formatSys: ProfileInput<boolean>) =>
        profilePatchHandler(
          onProfileListRowChange,
          [rowIndex],
          profileListRowFieldPatches.transitionFormatSys,
          formatSys,
        );
    },
    transitionFromChangeHandler() {
      return (from: ProfileInput<string>) =>
        profilePatchHandler(
          onProfileListRowChange,
          [rowIndex],
          profileListRowFieldPatches.transitionFrom,
          from,
        );
    },
    transitionToChangeHandler() {
      return (to: ProfileInput<string>) =>
        profilePatchHandler(
          onProfileListRowChange,
          [rowIndex],
          profileListRowFieldPatches.transitionTo,
          to,
        );
    },
  };
}

export const profileListRowHandlerNames = [
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
] as const;

export interface ProfileHookRowHandlerOptions {
  onAddFlowStep?: OptionalCallback<[number]>;
  onCommandChange?: OptionalCallback<[number, ProfileHookCommandPatch]>;
  onFlowChange?: OptionalCallback<[number, ProfileHookFlowPatch]>;
  onFlowStepChange?: OptionalCallback<
    [number, number, ProfileHookCommandPatch]
  >;
  onHookRowChange?: OptionalCallback<[number, ProfileHookRowPatch]>;
  onKindChange?: OptionalCallback<[number, ProfileHookKind]>;
  onRemoveFlowStep?: OptionalCallback<[number, number]>;
  onRemoveRow?: OptionalCallback<[number]>;
  rowIndex?: number;
}

export function profileHookRowInputHandlers({
  onAddFlowStep = null,
  onCommandChange = null,
  onFlowChange = null,
  onFlowStepChange = null,
  onHookRowChange = null,
  onKindChange = null,
  onRemoveFlowStep = null,
  onRemoveRow = null,
  rowIndex = -1,
}: ProfileHookRowHandlerOptions = {}) {
  return {
    addFlowStepHandler() {
      return callbackWithPrefix(onAddFlowStep, rowIndex);
    },
    commandModeChangeHandler() {
      return (mode: ProfileInput<string>) =>
        profilePatchHandler(
          onCommandChange,
          [rowIndex],
          profileHookCommandModePatch,
          mode,
        );
    },
    commandInteractionChangeHandler() {
      return (interaction: ProfileInput<ProfileCommandInteractionInput>) =>
        profilePatchHandler(
          onCommandChange,
          [rowIndex],
          profileHookCommandInteractionPatch,
          interaction,
        );
    },
    commandTextChangeHandler() {
      return (command: ProfileInput<string>) =>
        profilePatchHandler(
          onCommandChange,
          [rowIndex],
          profileHookCommandTextPatch,
          command,
        );
    },
    commandTimeoutChangeHandler() {
      return (timeout: ProfileInput<string>) =>
        profilePatchHandler(
          onCommandChange,
          [rowIndex],
          profileHookCommandTimeoutPatch,
          timeout,
        );
    },
    flowMaxStepsChangeHandler() {
      return (maxSteps: ProfileInput<string>) =>
        profilePatchHandler(
          onFlowChange,
          [rowIndex],
          profileHookFlowMaxStepsPatch,
          maxSteps,
        );
    },
    flowStepCommandChangeHandler(stepIndex: number) {
      return (command: ProfileInput<string>) =>
        profilePatchHandler(
          onFlowStepChange,
          [rowIndex, stepIndex],
          profileHookFlowStepCommandPatch,
          command,
        );
    },
    flowStepModeChangeHandler(stepIndex: number) {
      return (mode: ProfileInput<string>) =>
        profilePatchHandler(
          onFlowStepChange,
          [rowIndex, stepIndex],
          profileHookFlowStepModePatch,
          mode,
        );
    },
    flowStepInteractionChangeHandler(stepIndex: number) {
      return (interaction: ProfileInput<ProfileCommandInteractionInput>) =>
        profilePatchHandler(
          onFlowStepChange,
          [rowIndex, stepIndex],
          profileHookFlowStepInteractionPatch,
          interaction,
        );
    },
    flowStepTimeoutChangeHandler(stepIndex: number) {
      return (timeout: ProfileInput<string>) =>
        profilePatchHandler(
          onFlowStepChange,
          [rowIndex, stepIndex],
          profileHookFlowStepTimeoutPatch,
          timeout,
        );
    },
    flowStopOnErrorChangeHandler() {
      return (stopOnError: ProfileInput<boolean>) =>
        profilePatchHandler(
          onFlowChange,
          [rowIndex],
          profileHookFlowStopOnErrorPatch,
          stopOnError,
        );
    },
    hookFailurePolicyChangeHandler() {
      return (failurePolicy: ProfileInput<string>) =>
        profilePatchHandler(
          onHookRowChange,
          [rowIndex],
          profileHookRowFailurePolicyPatch,
          failurePolicy,
        );
    },
    hookNameChangeHandler() {
      return (name: ProfileInput<string>) =>
        profilePatchHandler(
          onHookRowChange,
          [rowIndex],
          profileHookRowNamePatch,
          name,
        );
    },
    hookRecordOutputChangeHandler() {
      return (recordOutput: ProfileInput<boolean>) =>
        profilePatchHandler(
          onHookRowChange,
          [rowIndex],
          profileHookRowRecordOutputPatch,
          recordOutput,
        );
    },
    hookStateChangeHandler() {
      return (state: ProfileInput<string>) =>
        profilePatchHandler(
          onHookRowChange,
          [rowIndex],
          profileHookRowStatePatch,
          state,
        );
    },
    kindChangeHandler() {
      return callbackWithPrefix(onKindChange, rowIndex);
    },
    removeFlowStepHandler(stepIndex: number) {
      return callbackWithPrefix(onRemoveFlowStep, rowIndex, stepIndex);
    },
    removeRowHandler() {
      return callbackWithPrefix(onRemoveRow, rowIndex);
    },
  };
}

export const profileHookRowHandlerNames = [
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
] as const;

function setProfileDetectProbeCommand(
  probeIndex: number,
  command: string,
): void {
  patchProfileDetectProbe(probeIndex, { command });
}

function setProfileDetectProbeRuleField(
  probeIndex: number,
  ruleIndex: number,
  fieldName: keyof ProfileDetectRuleDraft,
  fieldValue: string,
): void {
  patchProfileDetectProbeRule(probeIndex, ruleIndex, {
    [fieldName]: fieldValue,
  });
}

export function profileDetectProbeInputHandlers({ probeIndex = -1 } = {}) {
  return {
    addErrorPatternHandler() {
      return callbackWithPrefix(addProfileDetectProbeErrorPattern, probeIndex);
    },
    addRuleHandler() {
      return callbackWithPrefix(addProfileDetectProbeRule, probeIndex);
    },
    commandChangeHandler() {
      return callbackWithPrefix(setProfileDetectProbeCommand, probeIndex);
    },
    errorPatternChangeHandler(patternIndex: number) {
      return callbackWithPrefix(
        setProfileDetectProbeErrorPattern,
        probeIndex,
        patternIndex,
      );
    },
    removeErrorPatternHandler(patternIndex: number) {
      return callbackWithPrefix(
        removeProfileDetectProbeErrorPattern,
        probeIndex,
        patternIndex,
      );
    },
    removeProbeHandler() {
      return callbackWithPrefix(removeProfileDetectProbe, probeIndex);
    },
    removeRuleHandler(ruleIndex: number) {
      return callbackWithPrefix(
        removeProfileDetectProbeRule,
        probeIndex,
        ruleIndex,
      );
    },
    ruleFieldChangeHandler(
      ruleIndex: number,
      fieldName: keyof ProfileDetectRuleDraft,
    ) {
      return callbackWithPrefix(
        setProfileDetectProbeRuleField,
        probeIndex,
        ruleIndex,
        fieldName,
      );
    },
  };
}

export const profileDetectProbeHandlerNames = [
  "addErrorPatternHandler",
  "addRuleHandler",
  "commandChangeHandler",
  "errorPatternChangeHandler",
  "removeErrorPatternHandler",
  "removeProbeHandler",
  "removeRuleHandler",
  "ruleFieldChangeHandler",
] as const;

type CustomEditorCoreWorkspace = ReturnType<
  typeof createCustomProfilesEditorWorkspace
>;

type CustomEditorActions = Pick<
  CustomEditorCoreWorkspace,
  | "addFlowStep"
  | "addHookRow"
  | "addListItem"
  | "addPattern"
  | "changeHookKind"
  | "loadProfile"
  | "patchCommand"
  | "patchFlow"
  | "patchFlowStep"
  | "patchHookRow"
  | "patchListRow"
  | "removeFlowStep"
  | "removeHookRow"
  | "removePattern"
  | "removeRow"
  | "setPatternState"
  | "setPatternValue"
  | "setSimpleValue"
  | "updateCommandExecutionMode"
  | "updateShellExitMarker"
>;

export function customProfilesEditorInputHandlers(
  actions: CustomEditorActions,
) {
  return {
    commandExecutionModeChangeHandler() {
      return callbackWithPrefix(actions.updateCommandExecutionMode);
    },
    hookAddHandler(listKey: string) {
      return () => actions.addHookRow(listKey);
    },
    hookRowCallbacks(listKey: string) {
      return {
        onAddFlowStep: callbackWithPrefix(actions.addFlowStep, listKey),
        onCommandChange: callbackWithPrefix(actions.patchCommand, listKey),
        onFlowChange: callbackWithPrefix(actions.patchFlow, listKey),
        onFlowStepChange: callbackWithPrefix(actions.patchFlowStep, listKey),
        onHookRowChange: callbackWithPrefix(actions.patchHookRow, listKey),
        onKindChange: callbackWithPrefix(actions.changeHookKind, listKey),
        onRemoveFlowStep: callbackWithPrefix(actions.removeFlowStep, listKey),
        onRemoveRow: callbackWithPrefix(actions.removeHookRow, listKey),
      };
    },
    profileListAddHandler(listKey: string, kind: ProfileListKind) {
      return () => actions.addListItem(listKey, kind);
    },
    profileListRowCallbacks(listKey: string, kind: ProfileListKind) {
      return {
        onAddPattern: callbackWithPrefix(actions.addPattern, listKey),
        onPatternChange: callbackWithPrefix(actions.setPatternValue, listKey),
        onPatternStateChange: callbackWithPrefix(
          actions.setPatternState,
          listKey,
          kind,
        ),
        onProfileListRowChange: callbackWithPrefix(
          actions.patchListRow,
          listKey,
        ),
        onRemovePattern: callbackWithPrefix(actions.removePattern, listKey),
        onRemoveRow: callbackWithPrefix(actions.removeRow, listKey),
        onRemoveSimpleValue: callbackWithPrefix(actions.removeRow, listKey),
        onSimpleValueChange: callbackWithPrefix(
          actions.setSimpleValue,
          listKey,
        ),
      };
    },
    selectedProfileChangeHandler() {
      return callbackWithPrefix(actions.loadProfile);
    },
    shellExitMarkerChangeHandler() {
      return callbackWithPrefix(actions.updateShellExitMarker);
    },
  };
}
