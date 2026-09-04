import type { Readable, Writable } from "svelte/store";
import type {
  DeviceProfilesOverview,
  ProfileModes,
} from "$domains/profiles/index.js";
import type { JsonValue } from "$lib/jsonValue.js";

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

export interface TemplateResourceApiMeta {
  content_type: string;
  created_at_ms: number;
  kind: string;
  name: string;
  size_bytes: number;
  source: string;
  updated_at_ms: number;
}

export interface TemplateResourceMeta extends TemplateResourceApiMeta {
  builtin: boolean;
  isDraft?: boolean;
  key: string;
}

export interface TemplateResourceDetail {
  content: string;
  name: string;
}

export interface TemplateVariableField {
  allow_empty: boolean;
  default: JsonValue | null;
  description: string | null;
  label: string;
  name: string;
  options: string[];
  placeholder: string | null;
  required: boolean;
  type: string;
}

export interface CommandTemplateInspection {
  vars_schema: TemplateVariableField[];
}

export interface CommandFlowTemplateDetail extends TemplateResourceDetail {
  vars_schema: TemplateVariableField[];
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
  varsSchema: TemplateVariableField[];
}

export interface WorkspaceResult {
  cancelled?: boolean;
  message?: string;
  name?: string;
  ok: boolean;
}

export interface TextfsmMapping {
  command: string;
  deviceProfile: string;
  templateName: string;
}

export interface TextfsmMappingApiRow {
  command: string;
  created_at_ms: number;
  device_profile: string;
  template_name: string;
  updated_at_ms: number;
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

export interface ShowObjectForm {
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

export interface CustomShowObjectApiRow extends Required<CustomShowObjectApiPayload> {
  created_at_ms: number;
  updated_at_ms: number;
}

export interface TextfsmMappingApiPayload {
  command: string;
  device_profile: string;
  template_name: string;
}

export interface TemplateMutationResponse {
  ok: boolean;
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
  ): Promise<TemplateResourceDetail>;
  deleteCustomShowObject(
    payload: Pick<CustomShowObjectApiPayload, "device_profile" | "object">,
  ): Promise<TemplateMutationResponse>;
  deleteTemplateResource(
    base: string,
    name: string,
  ): Promise<TemplateMutationResponse>;
  deleteTextfsmMapping(
    payload: Omit<TextfsmMappingApiPayload, "template_name">,
  ): Promise<TemplateMutationResponse>;
  getDeviceProfilesOverview(): Promise<DeviceProfilesOverview>;
  getProfileModes(profile: string): Promise<ProfileModes>;
  getTemplateResource(
    base: string,
    name: string,
  ): Promise<TemplateResourceDetail>;
  getCommandFlowTemplate(
    name: string,
    options?: { builtin?: boolean },
  ): Promise<CommandFlowTemplateDetail>;
  inspectCommandFlowTemplate(
    content: string,
  ): Promise<CommandFlowTemplateDetail>;
  inspectCommandTemplate(content: string): Promise<CommandTemplateInspection>;
  listCustomShowObjects(): Promise<CustomShowObjectApiRow[]>;
  listTemplateResource(base: string): Promise<TemplateResourceApiMeta[]>;
  listTextfsmMappings(profile?: string): Promise<TextfsmMappingApiRow[]>;
  saveCustomShowObject(
    payload: CustomShowObjectApiPayload,
  ): Promise<CustomShowObjectApiRow>;
  saveTextfsmMapping(
    payload: TextfsmMappingApiPayload,
  ): Promise<TextfsmMappingApiRow>;
  updateTemplateResource(
    base: string,
    name: string,
    content: string,
  ): Promise<TemplateResourceDetail>;
}

export interface ContentTemplateWorkspaceOptions {
  api?: Partial<TemplateApi>;
  confirmDiscard?: () => boolean | Promise<boolean>;
}

export interface ResourceWorkspaceOptions {
  api?: Partial<TemplateApi>;
  onChanged?: () => void | Promise<void>;
}

export interface ContentTemplateWorkspace {
  activate(kind: TemplateManagerKind): Promise<boolean>;
  countsStore: Writable<Record<string, number>>;
  createDraft(name: string): Promise<WorkspaceResult>;
  deleteSelected(): Promise<WorkspaceResult>;
  filteredItemsStore: Readable<TemplateResourceMeta[]>;
  formatContent(): WorkspaceResult;
  load(
    kind?: TemplateManagerKind,
    options?: { force?: boolean; selectedKey?: string },
  ): Promise<boolean>;
  refresh(): Promise<boolean>;
  save(): Promise<WorkspaceResult>;
  saveAs(name: string): Promise<WorkspaceResult>;
  selectResource(key: string): Promise<boolean>;
  setContent(content: string): void;
  setSearch(search: string): void;
  stateStore: Writable<TemplateContentSession>;
}

export interface TextfsmMappingWorkspace {
  createDraft(): void;
  filteredMappingsStore: Readable<TextfsmMapping[]>;
  load(): Promise<boolean>;
  patchForm(patch: Partial<TextfsmMapping>): void;
  remove(): Promise<WorkspaceResult>;
  save(): Promise<WorkspaceResult>;
  select(mapping: TextfsmMapping): void;
  setSearch(search: string): void;
  stateStore: Writable<TextfsmMappingState>;
}

export interface ShowObjectWorkspace {
  createDraft(): void;
  filteredObjectsStore: Readable<ShowObjectForm[]>;
  load(): Promise<boolean>;
  patchForm(patch: Partial<ShowObjectForm>): Promise<void>;
  remove(): Promise<WorkspaceResult>;
  save(): Promise<WorkspaceResult>;
  select(object: ShowObjectForm): Promise<void>;
  setSearch(search: string): void;
  stateStore: Writable<ShowObjectState>;
}

export interface FlowVarField {
  allowEmpty: boolean;
  defaultValue: JsonValue | null;
  description: string;
  kind: string;
  label: string;
  name: string;
  options: string[];
  placeholder: string;
  required: boolean;
}

export interface FlowVarsState {
  draft: Record<string, string>;
  errorMessage: string;
  fields: FlowVarField[];
  hintText: string;
  values: Record<string, string>;
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
