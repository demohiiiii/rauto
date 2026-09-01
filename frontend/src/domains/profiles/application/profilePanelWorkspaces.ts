import { currentLanguageState } from "../../../lib/i18n.js";
import { derived, writable } from "svelte/store";
import type { Readable } from "svelte/store";
import { createCustomProfilesEditorWorkspace as createCustomProfilesEditorWorkspaceCore } from "./customProfileEditorState.js";
import {
  addProfileDetectInitialRule,
  addProfileDetectProbe,
  createCustomProfileDetectPanelWorkspace as createCustomProfileDetectPanelWorkspaceCore,
  createProfileDiagnosePanelWorkspace as createProfileDiagnosePanelWorkspaceCore,
  patchProfileDetectInitialRule,
  removeProfileDetectInitialRule,
  setProfileDetectEnabled,
  setProfileDiagnoseSelected,
} from "./profileDiagnosticsState.js";
import {
  createLiveActionHandlers,
  customProfilesEditorInputHandlers,
  profileDetectProbeHandlerNames,
  profileDetectProbeInputHandlers,
  profileHookRowHandlerNames,
  profileHookRowInputHandlers,
  profileListRowHandlerNames,
  profileListRowInputHandlers,
} from "./profileEditorBindings.js";
import type {
  ProfileHookRowHandlerOptions,
  ProfileListRowHandlerOptions,
} from "./profileEditorBindings.js";
import {
  builtinProfileDetectDetailsPresentation,
  builtinProfileHooksDetailsPresentation,
  builtinProfileStateListsPresentation,
  hookOperationEditorDisplay,
  profileHookFlowEditorDisplay,
  profileHookFlowStepsEditorDisplay,
  profileHookRowEditorDisplay,
  profileListRowEditorPresentation,
} from "../presentation/profileEditorPresentation.js";

function createLanguageDisplayWorkspace<TKey extends string, TDisplay>(
  storeName: TKey,
  presentation: () => TDisplay,
): Record<TKey, Readable<TDisplay>> {
  return {
    [storeName]: derived(currentLanguageState, presentation),
  } as Record<TKey, Readable<TDisplay>>;
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

interface ProfileListRowContext {
  kind?: unknown;
  profileListRow?: unknown;
  rowIndex?: number;
}

export function createProfileListRowEditorWorkspace(
  options: ProfileListRowHandlerOptions = {},
) {
  const displayInputsStateStore = writable<ProfileListRowContext>({
    kind: "",
    profileListRow: null,
  });
  const callbackInputsStateStore = writable(options);
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
      kind = "",
      profileListRow = null,
      rowIndex = -1,
    }: ProfileListRowContext = {}) {
      displayInputsStateStore.set({ kind, profileListRow });
      callbackInputsStateStore.update((state) => ({ ...state, rowIndex }));
    },
  };
}

interface ProfileHookRowContext {
  hookRow?: unknown;
  modeOptions?: unknown[];
  rowIndex?: number;
}

export function createProfileHookRowEditorWorkspace(
  options: ProfileHookRowHandlerOptions = {},
) {
  const displayInputsStateStore = writable<ProfileHookRowContext>({
    hookRow: {},
    modeOptions: [],
  });
  const callbackInputsStateStore = writable(options);
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
      hookRow = {},
      modeOptions = [],
      rowIndex = -1,
    }: ProfileHookRowContext = {}) {
      displayInputsStateStore.set({ hookRow, modeOptions });
      callbackInputsStateStore.update((state) => ({ ...state, rowIndex }));
    },
  };
}

export function createProfileDetectProbeCardWorkspace({
  probeIndex = -1,
}: { probeIndex?: number } = {}) {
  const callbackInputsStateStore = writable({ probeIndex });

  return {
    ...createLiveActionHandlers(
      callbackInputsStateStore,
      profileDetectProbeInputHandlers,
      profileDetectProbeHandlerNames,
    ),
    setProbeIndex(nextProbeIndex = -1) {
      callbackInputsStateStore.set({ probeIndex: nextProbeIndex });
    },
  };
}

export function createProfileDiagnosePanelWorkspace() {
  return {
    ...createProfileDiagnosePanelWorkspaceCore(),
    profileChangeHandler() {
      return (profileName = "") => setProfileDiagnoseSelected(profileName);
    },
  };
}

function setProfileDetectInitialRuleField(
  ruleIndex: number,
  fieldName: string,
  fieldValue: unknown,
): void {
  patchProfileDetectInitialRule(ruleIndex, {
    [fieldName]: fieldValue,
  });
}

export function createCustomProfileDetectPanelWorkspace() {
  const workspace = createCustomProfileDetectPanelWorkspaceCore();
  return {
    ...workspace,
    addInitialRule: (detectRule?: unknown) =>
      addProfileDetectInitialRule(detectRule),
    addProbe: (detectProbe?: unknown) => addProfileDetectProbe(detectProbe),
    changeInitialRulePattern(ruleIndex: number) {
      return (fieldValue: unknown) =>
        setProfileDetectInitialRuleField(ruleIndex, "pattern", fieldValue);
    },
    changeInitialRuleWeight(ruleIndex: number) {
      return (fieldValue: unknown) =>
        setProfileDetectInitialRuleField(ruleIndex, "weight", fieldValue);
    },
    removeInitialRuleHandler: (ruleIndex: number) => () =>
      removeProfileDetectInitialRule(ruleIndex),
    setDetectEnabled: (enabled: unknown) => setProfileDetectEnabled(enabled),
  };
}

export function createCustomProfilesEditorWorkspace() {
  const workspace = createCustomProfilesEditorWorkspaceCore();
  const actionHandlers = customProfilesEditorInputHandlers(workspace);
  return {
    ...workspace,
    ...actionHandlers,
  };
}
