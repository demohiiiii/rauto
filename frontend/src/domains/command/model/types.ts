import type { Writable } from "svelte/store";
import type { TemplateVariableField } from "$domains/templates/index.js";

export type InteractiveMultilineMode = "split_lines" | "whole";
export type InteractiveEditorTab = "visual" | "toml" | "readonly";

export interface InteractiveTemplatePromptModel {
  appendNewline: boolean;
  patterns: string[];
  recordInput: boolean;
  response: string;
}

export interface InteractiveCommandModel {
  command: string;
  hasMode: boolean;
  hasTimeoutSecs: boolean;
  mode: string | null;
  multilineMode: InteractiveMultilineMode;
  prompts: InteractiveTemplatePromptModel[];
  timeoutSecs: number | null;
}

export interface InteractiveTemplateModel extends InteractiveCommandModel {
  name: string;
}

export interface InteractivePromptDocument {
  append_newline: boolean;
  patterns: string[];
  record_input: boolean;
  response: string;
}

export interface InteractiveCommandDocument {
  command: string;
  mode?: string;
  multiline_mode: InteractiveMultilineMode;
  prompts: InteractivePromptDocument[];
  timeout_secs?: number;
}

export interface InteractiveTemplateDocument extends InteractiveCommandDocument {
  name: string;
}

export interface InteractiveInspectionPayload {
  vars_schema?: TemplateVariableField[];
}

export interface InteractiveInspectionState {
  errorMessage: string;
  loading: boolean;
  varsSchema: TemplateVariableField[];
}

export interface InteractiveDraftWorkspace {
  activeTabStateStore: Writable<InteractiveEditorTab>;
  applyInspection(
    version: number,
    detail?: InteractiveInspectionPayload,
  ): boolean;
  beginInspection(): number;
  canSubmit(): boolean;
  errorStateStore: Writable<string>;
  failInspection(version: number, error: unknown): boolean;
  inspectionStateStore: Writable<InteractiveInspectionState>;
  isDirty(): boolean;
  markClean(): void;
  markUnsaved(): void;
  modelStateStore: Writable<InteractiveTemplateModel>;
  replaceFromToml(tomlText?: string): boolean;
  selectTab(tab?: string): void;
  setModel(model: InteractiveTemplateModel): void;
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

export interface InteractiveReadonlyPromptDisplay {
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

export interface InteractiveReadonlyCommandDisplay {
  commandLabelText: string;
  commandText: string;
  modeLabelText: string;
  modeText: string;
  multilineModeLabelText: string;
  multilineModeText: string;
  promptRows: InteractiveReadonlyPromptDisplay[];
  timeoutLabelText: string;
  timeoutText: string;
  titleText: string;
}

export interface InteractiveReadonlyDisplay {
  nameLabelText: string;
  nameText: string;
  command: InteractiveReadonlyCommandDisplay;
  summaryRows: Array<{ labelText: string; valueText: string }>;
}

export interface InteractiveDraftOptions {
  initialModel?: InteractiveTemplateModel | null;
}
