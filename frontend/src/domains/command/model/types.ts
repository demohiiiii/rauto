import type { Writable } from "svelte/store";
import type { TemplateVariableField } from "$domains/templates/index.js";

export type CommandFlowMultilineMode = "split_lines" | "whole";
export type CommandFlowEditorTab = "visual" | "toml" | "readonly";

export interface CommandFlowTemplatePromptModel {
  appendNewline: boolean;
  patterns: string[];
  recordInput: boolean;
  response: string;
}

export interface CommandFlowTemplateStepModel {
  command: string;
  hasMode: boolean;
  hasTimeoutSecs: boolean;
  mode: string | null;
  multilineMode: CommandFlowMultilineMode;
  prompts: CommandFlowTemplatePromptModel[];
  timeoutSecs: number | null;
}

export interface CommandFlowTemplateModel {
  defaultMode: string | null;
  hasDefaultMode: boolean;
  name: string;
  steps: CommandFlowTemplateStepModel[];
  stopOnError: boolean;
}

export interface CommandFlowPromptDocument {
  append_newline: boolean;
  patterns: string[];
  record_input: boolean;
  response: string;
}

export interface CommandFlowStepDocument {
  command: string;
  mode?: string;
  multiline_mode: CommandFlowMultilineMode;
  prompts: CommandFlowPromptDocument[];
  timeout_secs?: number;
}

export interface CommandFlowTemplateDocument {
  default_mode?: string;
  name: string;
  steps: CommandFlowStepDocument[];
  stop_on_error: boolean;
}

export interface CommandFlowInspectionPayload {
  vars_schema?: TemplateVariableField[];
}

export interface CommandFlowInspectionState {
  errorMessage: string;
  loading: boolean;
  varsSchema: TemplateVariableField[];
}

export interface CommandFlowDraftWorkspace {
  activeTabStateStore: Writable<CommandFlowEditorTab>;
  applyInspection(
    version: number,
    detail?: CommandFlowInspectionPayload,
  ): boolean;
  beginInspection(): number;
  canSubmit(): boolean;
  errorStateStore: Writable<string>;
  failInspection(version: number, error: unknown): boolean;
  inspectionStateStore: Writable<CommandFlowInspectionState>;
  isDirty(): boolean;
  markClean(): void;
  markUnsaved(): void;
  modelStateStore: Writable<CommandFlowTemplateModel>;
  replaceFromToml(tomlText?: string): boolean;
  selectTab(tab?: string): void;
  setModel(model: CommandFlowTemplateModel): void;
  setTomlText(tomlText?: string): boolean;
  tomlTextStateStore: Writable<string>;
}

export interface CommandTemplateCatalogState {
  errorMessage: string;
  loaded: boolean;
  loading: boolean;
  names: string[];
}

export interface CommandTemplateMeta {
  name: string;
}

export interface CommandTemplateApi {
  listTemplates(): Promise<CommandTemplateMeta[]>;
}

export interface CommandTemplateCatalog {
  ensureLoaded(): Promise<boolean>;
  state: Writable<CommandTemplateCatalogState>;
}

export interface CommandTemplateCatalogOptions {
  load?: () => Promise<CommandTemplateMeta[]>;
}

export type CommandTranslate = (key: string) => string;

export interface CommandFlowReadonlyPromptDisplay {
  appendNewlineLabelText: string;
  appendNewlineText: string;
  patternRows: string[];
  patternsLabelText: string;
  recordInputLabelText: string;
  recordInputText: string;
  responseLabelText: string;
  responseText: string;
  titleText: string;
}

export interface CommandFlowReadonlyStepDisplay {
  commandLabelText: string;
  commandText: string;
  modeLabelText: string;
  modeText: string;
  multilineModeLabelText: string;
  multilineModeText: string;
  promptRows: CommandFlowReadonlyPromptDisplay[];
  timeoutLabelText: string;
  timeoutText: string;
  titleText: string;
}

export interface CommandFlowReadonlyDisplay {
  emptyText: string;
  hasSteps: boolean;
  nameLabelText: string;
  nameText: string;
  stepRows: CommandFlowReadonlyStepDisplay[];
  stepsTitleText: string;
  summaryRows: Array<{ labelText: string; valueText: string }>;
}

export interface CommandFlowDraftOptions {
  initialModel?: CommandFlowTemplateModel | null;
}
