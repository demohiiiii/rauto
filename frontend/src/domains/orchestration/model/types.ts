export type JsonObject = Record<string, unknown>;

export type OrchestrationStrategy = "parallel" | "serial";

export type OrchestrationWorkflowSourceMode =
  | "workflow_json"
  | "workflow_template_name";

export type OrchestrationEditorView = "json" | "readonly";

export interface OrchestrationRunButtonDisplay {
  executeLoading?: boolean;
}

export interface OrchestrationTxWorkflowActionModel extends JsonObject {
  hasWorkflow: boolean;
  hasWorkflowTemplateName: boolean;
  hasWorkflowVars: boolean;
  workflow: unknown | null;
  workflowTemplateName: string | null;
  workflowVars: unknown;
}

export interface OrchestrationTemplateOption {
  optionLabel: string;
  optionValue: string;
}

export interface OrchestrationTxWorkflowSourceBindings {
  setJsonText(workflowJsonText: string): void;
  setSource(sourceValue: string): void;
  setTemplateName(workflowTemplateName: string): void;
  setWorkflowVars(workflowVars: JsonObject): void;
}

export interface OrchestrationActionModel extends JsonObject {
  kind: "tx_workflow";
  txWorkflow: OrchestrationTxWorkflowActionModel;
}

export interface OrchestrationJobModel extends JsonObject {
  action: OrchestrationActionModel;
  extra: JsonObject;
  failFast: boolean | null;
  hasFailFast: boolean;
  hasMaxParallel: boolean;
  hasName: boolean;
  hasTargetGroups: boolean;
  hasTargetTags: boolean;
  hasTargets: boolean;
  maxParallel: number | null;
  name: unknown | null;
  strategy: OrchestrationStrategy;
  targetGroups: string[];
  targetTags: string[];
  targets: string[];
}

export interface OrchestrationStageModel extends JsonObject {
  extra: JsonObject;
  failFast: boolean | null;
  hasFailFast: boolean;
  hasJobs: boolean;
  hasMaxParallel: boolean;
  hasName: boolean;
  jobs: OrchestrationJobModel[];
  maxParallel: number | null;
  name: string;
  strategy: OrchestrationStrategy;
}

export interface OrchestrationPlanFormModel extends JsonObject {
  extra: JsonObject;
  failFast: boolean;
  hasFailFast: boolean;
  hasRollbackCompletedStagesOnFailure: boolean;
  hasRollbackOnStageFailure: boolean;
  hasStages: boolean;
  name: string;
  rollbackCompletedStagesOnFailure: boolean;
  rollbackOnStageFailure: boolean;
  stages: OrchestrationStageModel[];
}

export type OrchestrationPlanChangeHandler = (
  model: OrchestrationPlanFormModel,
) => void;

export type OrchestrationErrorChangeHandler = (error: string) => void;

export interface OrchestrationJobEditorRow {
  job: OrchestrationJobModel;
  jobIndex: number;
  stageIndex: number;
  titleText: string;
  txWorkflowRows: {
    sourceValue: OrchestrationWorkflowSourceMode;
    workflowVarsText: string;
  };
}

export interface OrchestrationStageEditorRow {
  jobRows: OrchestrationJobEditorRow[];
  stage: OrchestrationStageModel;
  stageIndex: number;
  titleText: string;
}

export interface OrchestrationVisualEditorDisplay {
  booleanRows: readonly string[];
  jsonValueTypeRows: readonly string[];
  nullableBooleanRows: readonly string[];
  stageRows: OrchestrationStageEditorRow[];
  strategyRows: readonly string[];
  txWorkflowActionSourceRows: readonly string[];
}

export interface OrchestrationPlanParseResult {
  error: string;
  model: OrchestrationPlanFormModel | null;
}

export interface OrchestrationJsonPatchResult<TModel> {
  error: string;
  model: TModel;
}

export interface OrchestrationFieldDefinition extends JsonObject {
  controlType: "input" | "select";
  fieldKey: string;
  inputType?: "number" | "text";
  labelKey: string;
  optionKind?: "boolean" | "strategy";
}

export interface OrchestrationOptionRow extends JsonObject {
  optionLabel: string;
  optionValue: string;
}

export interface OrchestrationFieldDisplay extends OrchestrationFieldDefinition {
  enabled: boolean;
  labelText: string;
  nullableModeRows?: OrchestrationOptionRow[];
  nullableModeValue?: string;
  optionRows?: OrchestrationOptionRow[];
  placeholderText: string;
  showNullableModeSelect?: boolean;
  showPresenceToggle: boolean;
  valueText: string;
}

export interface OrchestrationPlanSettingsPanelDisplay {
  rootFieldRows: OrchestrationFieldDisplay[];
}

export interface OrchestrationStageSettingsPanelDisplay {
  fieldRows: OrchestrationFieldDisplay[];
}

export interface OrchestrationJobSettingsPanelDisplay {
  fieldRows: OrchestrationFieldDisplay[];
}

export interface OrchestrationTxWorkflowSettingsDisplay {
  sourceField: OrchestrationFieldDisplay;
}

export interface OrchestrationTxWorkflowSettingsPanelDisplay {
  settingsDisplay: OrchestrationTxWorkflowSettingsDisplay;
}

export interface OrchestrationStagesPanelDisplay {
  addStageButtonLabel: string;
  stageRows: OrchestrationStageEditorRow[];
  titleText: string;
}

export interface OrchestrationWorkflowPreviewRow extends JsonObject {
  blockName: string;
  operationText: string;
  operationTexts: string[];
}

export type OrchestrationWorkflowPreviewStatus = "error" | "loading" | "ready";

export interface OrchestrationWorkflowPreview extends JsonObject {
  allRows: OrchestrationWorkflowPreviewRow[];
  blockCount: number;
  errorMessage: string;
  overflowCount: number;
  previewStatus: OrchestrationWorkflowPreviewStatus;
  rows: OrchestrationWorkflowPreviewRow[];
  sourceKind: "manual" | "template";
  sourceName: string;
  unresolvedCount: number;
  unresolvedPaths: unknown[];
  workflow: unknown;
  workflowName: string;
}

export interface OrchestrationWorkflowPreviewWorkspace {
  clearTemplate(templateName?: unknown): void;
  previewTemplate(
    templateName: unknown,
    workflowVars?: unknown,
  ): Promise<OrchestrationWorkflowPreview>;
}
