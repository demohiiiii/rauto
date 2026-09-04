import type { Readable } from "svelte/store";

export type JsonObject = Record<string, unknown>;

export interface JsonTemplateActionContext {
  isCurrent?: () => boolean;
  runOwnedEditorMutation?<T>(operation: () => T): T | undefined;
}

export interface JsonErrorDetail {
  column: number | null;
  line: number | null;
  message: string;
}

export type TxMultilineMode = "split_lines" | "whole";
export type TxOperationKind = "command" | "flow";
export type TxRollbackKind = "none" | "per_step" | "whole_resource";

export interface TxRuntimePromptModel extends JsonObject {
  extra: JsonObject;
  hasRecordInput: boolean;
  patterns: string[];
  recordInput: boolean;
  response: string;
}

export interface TxCommandInteractionModel extends JsonObject {
  extra: JsonObject;
  hasPrompts: boolean;
  prompts: TxRuntimePromptModel[];
}

export interface TxCommandModel extends JsonObject {
  command: string;
  dynParams: Record<string, string>;
  extra: JsonObject;
  hasDynParams: boolean;
  hasInteraction: boolean;
  hasTimeout: boolean;
  interaction: TxCommandInteractionModel;
  mode: string;
  multilineMode: TxMultilineMode;
  timeout: number | null;
}

export interface TxFlowModel extends JsonObject {
  extra: JsonObject;
  hasMaxSteps: boolean;
  hasStopOnError: boolean;
  maxSteps: number | null;
  steps: TxCommandModel[];
  stopOnError: boolean;
}

export interface TxOperationModel extends JsonObject {
  command: TxCommandModel;
  flow: TxFlowModel;
  kind: TxOperationKind;
}

export interface TxWholeResourceRollbackModel extends JsonObject {
  extra: JsonObject;
  hasTriggerStepIndex: boolean;
  rollback: TxOperationModel;
  triggerStepIndex: number | null;
}

export interface TxRollbackPolicyModel extends JsonObject {
  kind: TxRollbackKind;
  wholeResource?: TxWholeResourceRollbackModel;
}

export interface TxStepFormModel extends JsonObject {
  hasRollback: boolean;
  hasRollbackOnFailure: boolean;
  rollback: TxOperationModel | null;
  rollbackOnFailure: boolean;
  run: TxOperationModel;
}

export interface TxBlockFormModel extends JsonObject {
  failFast: boolean;
  hasFailFast: boolean;
  name: string;
  rollbackPolicy: TxRollbackPolicyModel;
  steps: TxStepFormModel[];
}

export interface TxValidationError {
  messageKey: string;
  path: string;
}

export interface TxBlockEditorFormState {
  formError: string;
  formErrorDetail: JsonErrorDetail | null;
  formModel: TxBlockFormModel | null;
}

export interface TxWorkflowTemplateRefBlockModel extends JsonObject {
  extra: JsonObject;
  failFast: boolean;
  hasFailFast: boolean;
  hasName: boolean;
  hasTxBlockTemplateContent: boolean;
  hasTxBlockTemplateName: boolean;
  hasTxBlockTemplateVars: boolean;
  name: string | null;
  txBlockTemplateContent: string | null;
  txBlockTemplateName: string | null;
  txBlockTemplateVars: JsonObject | null;
}

export interface TxWorkflowTemplateRefVarsDisplay {
  labelText: string;
  present: boolean;
  source: JsonObject;
}

export interface TxWorkflowBlockFormModel extends JsonObject {
  inlineBlock: TxBlockFormModel;
  sourceKind: "inline" | "template_ref";
  templateRef: TxWorkflowTemplateRefBlockModel;
}

export interface TxWorkflowFormModel extends JsonObject {
  blocks: TxWorkflowBlockFormModel[];
  extra: JsonObject;
  failFast: boolean;
  hasFailFast: boolean;
  name: string;
}

export interface TxWorkflowEditorFormState {
  formError: string;
  formErrorDetail: JsonErrorDetail | null;
  formModel: TxWorkflowFormModel | null;
}

export type TransactionEditorView = "form" | "json" | "readonly";
export type TransactionEditorSyncStatus = "dirty" | "invalid-json" | "synced";

export interface TransactionParsedFormState<TModel, TErrorDetail = unknown> {
  formError: string;
  formErrorDetail?: TErrorDetail | null;
  formModel: TModel;
}

export interface TransactionEditorSessionState<TModel, TErrorDetail = unknown> {
  editorDisplayMode: TransactionEditorView;
  formError: string;
  formErrorDetail: TErrorDetail | null;
  formModel: TModel;
  jsonText: string;
  lastValidJson: string;
  syncStatus: TransactionEditorSyncStatus;
}

export interface TxMetadataFieldDefinition extends JsonObject {
  fieldKey?: string;
  labelKey?: string;
  placeholderKey?: string;
  showPresenceToggle?: boolean;
}

export interface TxMetadataFieldRow extends TxMetadataFieldDefinition {
  enabled: boolean;
  fieldKey: string;
  labelText: string;
  placeholderText: string;
  showPresenceToggle: boolean;
  valueText: string;
}

export interface TxProfileModeState {
  defaultMode: string;
  modes: string[];
  name: string;
}

export interface TxProfileModeLoader {
  destroy(): void;
  refresh(): Promise<TxProfileModeState>;
  state: Readable<TxProfileModeState>;
}

export interface TxProfileModeRuntime {
  executionConnectionProfileState: Readable<unknown>;
  getProfileModes(profileName: string): Promise<unknown>;
  savedConnectionsRefreshState: Readable<unknown>;
}

export interface JsonTemplateSelectState {
  names: string[];
  selected: string;
}

export interface TransactionTemplateResource extends JsonObject {
  content?: string;
  name?: string;
}

export interface TransactionJsonTemplateRuntime {
  createTemplateResource(
    apiBase: string,
    name: string,
    content: string,
  ): Promise<unknown>;
  deleteTemplateResource(apiBase: string, name: string): Promise<unknown>;
  getTemplateResource(apiBase: string, name: string): Promise<unknown>;
  listTemplateResource(apiBase: string): Promise<unknown>;
  promptForResourceName(message: string): string | null;
  updateTemplateResource(
    apiBase: string,
    name: string,
    content: string,
  ): Promise<unknown>;
}
