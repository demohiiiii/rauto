import type { Readable, Writable } from "svelte/store";

export type UnknownRecord = Record<string, unknown>;

export type TemplateManagerKind =
  | "command"
  | "flow"
  | "tx-block"
  | "tx-workflow"
  | "orchestration"
  | "textfsm"
  | "textfsm-mappings"
  | "show-objects"
  | "config-catalog";

export interface TemplateManagerSection {
  descriptionKey: string;
  group: "execution" | "parsing" | "transaction";
  key: TemplateManagerKind;
  labelKey: string;
}

export interface TemplateResourceDefinition {
  apiBase: string;
  builtinApiBase?: string;
  contentType: string;
  format: "jinja" | "json" | "textfsm" | "toml";
}

export interface TemplateResourceMeta extends UnknownRecord {
  builtin: boolean;
  content_type: string;
  created_at_ms: number;
  isDraft?: boolean;
  key: string;
  name: string;
  size_bytes: number;
  source: string;
  updated_at_ms: number;
}

export interface TemplateResourceDetail extends UnknownRecord {
  content: string;
  name: string;
}

export interface TemplateContentSession {
  content: string;
  dirty?: boolean;
  errorMessage: string;
  items: TemplateResourceMeta[];
  kind: TemplateManagerKind;
  loaded: boolean;
  loadingAction: string;
  originalContent: string;
  search: string;
  selected: TemplateResourceMeta | null;
  varsSchema: UnknownRecord[];
}

export interface WorkspaceResult {
  cancelled?: boolean;
  message?: string;
  name?: string;
  ok: boolean;
}

export interface TextfsmMapping extends UnknownRecord {
  command: string;
  deviceProfile: string;
  templateName: string;
}

export interface TextfsmMappingState {
  errorMessage: string;
  form: TextfsmMapping;
  loadingAction: string;
  mappings: TextfsmMapping[];
  originalIdentity: string;
  profiles: string[];
  search: string;
  templates: string[];
}

export interface ShowObjectForm extends UnknownRecord {
  command: string;
  deviceProfile: string;
  enabled: boolean;
  mode: string;
  object: string;
  textfsmMappingCommand: string;
  textfsmTemplateName: string;
  useMapping: boolean;
}

export interface CustomShowObjectApiPayload {
  command: string;
  device_profile: string;
  enabled?: boolean;
  mode: string | null;
  object: string;
  textfsm_mapping_command: string | null;
  textfsm_template_name: string | null;
}

export interface TextfsmMappingApiPayload {
  command: string;
  device_profile: string;
  template_name: string;
}

export interface ShowObjectState {
  errorMessage: string;
  form: ShowObjectForm;
  loadingAction: string;
  mappings: TextfsmMapping[];
  modes: string[];
  objects: ShowObjectForm[];
  originalIdentity: string;
  profiles: string[];
  search: string;
  templates: string[];
}

export interface TemplateApi {
  createTemplateResource(
    base: string,
    name: string,
    content: string,
  ): Promise<UnknownRecord>;
  deleteCustomShowObject(
    payload: Pick<CustomShowObjectApiPayload, "device_profile" | "object">,
  ): Promise<unknown>;
  deleteTemplateResource(base: string, name: string): Promise<unknown>;
  deleteTextfsmMapping(payload: UnknownRecord): Promise<unknown>;
  getDeviceProfilesOverview(): Promise<unknown>;
  getProfileModes(profile: string): Promise<unknown>;
  getTemplateResource(base: string, name: string): Promise<UnknownRecord>;
  inspectCommandFlowTemplate(content: string): Promise<UnknownRecord>;
  inspectCommandTemplate(content: string): Promise<UnknownRecord>;
  listCustomShowObjects(): Promise<unknown>;
  listTemplateResource(base: string): Promise<unknown>;
  listTextfsmMappings(profile?: string): Promise<unknown>;
  saveCustomShowObject(payload: CustomShowObjectApiPayload): Promise<unknown>;
  saveTextfsmMapping(payload: TextfsmMappingApiPayload): Promise<unknown>;
  updateTemplateResource(
    base: string,
    name: string,
    content: string,
  ): Promise<UnknownRecord>;
}

export interface ContentTemplateWorkspaceOptions {
  api?: Partial<TemplateApi>;
  confirmDiscard?: () => boolean | Promise<boolean>;
}

export interface ResourceWorkspaceOptions {
  api?: Partial<TemplateApi>;
  onChanged?: () => unknown | Promise<unknown>;
}

export interface ContentTemplateWorkspace {
  activate(kind: unknown): Promise<boolean>;
  countsStore: Writable<Record<string, number>>;
  createDraft(name: unknown): Promise<WorkspaceResult>;
  deleteSelected(): Promise<WorkspaceResult>;
  filteredItemsStore: Readable<TemplateResourceMeta[]>;
  formatContent(): WorkspaceResult;
  load(
    kind?: unknown,
    options?: { force?: boolean; selectedKey?: string },
  ): Promise<boolean>;
  refresh(): Promise<boolean>;
  save(): Promise<WorkspaceResult>;
  saveAs(name: unknown): Promise<WorkspaceResult>;
  selectResource(key: unknown): Promise<boolean>;
  setContent(content: unknown): void;
  setSearch(search: unknown): void;
  stateStore: Writable<TemplateContentSession>;
}

export interface TextfsmMappingWorkspace {
  createDraft(): void;
  filteredMappingsStore: Readable<TextfsmMapping[]>;
  load(): Promise<boolean>;
  patchForm(patch: Partial<TextfsmMapping>): void;
  remove(): Promise<WorkspaceResult>;
  save(): Promise<WorkspaceResult>;
  select(mapping: unknown): void;
  setSearch(search: unknown): void;
  stateStore: Writable<TextfsmMappingState>;
}

export interface ShowObjectWorkspace {
  createDraft(): void;
  filteredObjectsStore: Readable<ShowObjectForm[]>;
  load(): Promise<boolean>;
  patchForm(patch: Partial<ShowObjectForm>): Promise<void>;
  remove(): Promise<WorkspaceResult>;
  save(): Promise<WorkspaceResult>;
  select(object: unknown): Promise<void>;
  setSearch(search: unknown): void;
  stateStore: Writable<ShowObjectState>;
}

export interface FlowVarField extends UnknownRecord {
  allowEmpty: boolean;
  defaultValue: unknown;
  description: string;
  kind: string;
  label: string;
  name: string;
  options: string[];
  placeholder: string;
  required: boolean;
}

export interface FlowVarsState {
  draft: UnknownRecord;
  errorMessage: string;
  fields: FlowVarField[];
  hintText: string;
  values: UnknownRecord;
}

export type FlowVarControlKind =
  | "boolean-select"
  | "input"
  | "json-editor"
  | "options-select";

export interface FlowVarFieldRow {
  allowsEmpty: boolean;
  booleanValueOptions: string[];
  controlKind: FlowVarControlKind;
  descriptionText: string;
  fieldName: string;
  hasDescription: boolean;
  hasOptions: boolean;
  inputAriaLabel: string;
  inputContainerClass: string;
  inputType: "number" | "password" | "text";
  labelText: string;
  optionValues: string[];
  placeholderText: string;
  required: boolean;
  requirementBadgeClass: string;
  requirementLabelText: string;
  typeBadgeText: string;
  typeValue: string;
  value: string;
}

export interface FlowVarsPresentation {
  countMetaText: string;
  emptyText: string;
  errorMessage: string;
  errorStatus: { tone: "error" };
  fieldRows: FlowVarFieldRow[];
  hasFields: boolean;
  hintText: string;
  jsonHintText?: string;
  jsonLabelText?: string;
  jsonOverridesText?: string;
  jsonPlaceholder?: string;
  titleText: string;
}

export interface FlowTemplateSelectState {
  options: string[];
  selected: string;
}
