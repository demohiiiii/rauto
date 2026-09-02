import type { CommandExecutionConfig } from "../model/types.js";
import type { ProfileStatusTone } from "../model/types.js";
import type {
  NormalizedHookInteraction,
  NormalizedHookPromptRule,
} from "../model/profileEditor.js";
import {
  builtinProfileReadonlyDisplay,
  profileHookFlowStepsEditorDisplay,
  profileHookInteractionEditorDisplay,
  profileListRowEditorPresentation,
} from "./profileEditorPresentation.js";

export type { ProfileStatusTone };

export type HookInteractionDisplay = ReturnType<
  typeof profileHookInteractionEditorDisplay
>;

export type HookFlowStepDisplay = ReturnType<
  typeof profileHookFlowStepsEditorDisplay
>["hookFlowStepRows"][number];

export type ProfilePatternRow = ReturnType<
  typeof profileListRowEditorPresentation
>["promptPatternDisplay"]["patternRows"][number];

export interface BuiltinHookCommandDisplay {
  command: string;
  interactionDisplay: HookInteractionDisplay;
  mode: string;
  timeout: string;
}

export interface BuiltinHookStepDisplay extends BuiltinHookCommandDisplay {
  stepIndex: number;
}

export interface BuiltinHookRowDisplay {
  command: BuiltinHookCommandDisplay;
  failurePolicy: string;
  flowMaxSteps: string;
  flowSteps: BuiltinHookStepDisplay[];
  flowStopOnError: boolean;
  name: string;
  recordOutput: boolean;
  showFlowSteps: boolean;
  stateText: string;
  trigger: string;
}

interface BuiltinProfileDetailDisplay {
  commandExecutionMarkerPlaceholder: string;
  commandExecutionTitle: string;
  configurationDescription: string;
  configurationTitle: string;
  detectDescription: string;
  fieldPlaceholders: {
    aliases: string;
    name: string;
    source: string;
    summary: string;
  };
  hooksDescription: string;
  notesPlaceholder: string;
  overviewDescription: string;
  overviewTitle: string;
  readonlyHint: string;
  rulesEmpty: string;
  simpleSections: BuiltinSimpleSectionDisplay[];
}

export interface BuiltinSimpleSectionDisplay {
  listId: string;
  titleText: string;
  values: string[];
}

interface BuiltinSimpleSection {
  i18nKey: string;
  listId: string;
  title: string;
  values: string[];
}

export interface BuiltinProfileDetail {
  aliases: string;
  commandExecution: CommandExecutionConfig;
  detectProfile: ReturnType<
    typeof builtinProfileReadonlyDisplay
  >["detectProfile"];
  detailDisplay: BuiltinProfileDetailDisplay;
  hasHookRows: boolean;
  hookRows: BuiltinHookRowDisplay[];
  interactionRows: Array<{
    input: string;
    isDynamic: boolean;
    patternRows: Array<{ index: number; value: string }>;
    recordInput: boolean;
    state: string;
  }>;
  name: string;
  notes: string;
  promptRows: Array<{
    patternRows: Array<{ index: number; value: string }>;
    state: string;
  }>;
  simpleSections: BuiltinSimpleSection[];
  source: string;
  summary: string;
  sysPromptRows: Array<{
    pattern: string;
    state: string;
    sysNameGroup: string;
  }>;
  transitionRows: Array<{
    command: string;
    formatSys: boolean;
    from: string;
    isExit: boolean;
    to: string;
  }>;
}

export type HookInteraction = NormalizedHookInteraction;
export type HookPromptRule = NormalizedHookPromptRule;
