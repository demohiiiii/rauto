export type JsonObject = Record<string, unknown>;

export type OrchestrationJsonPrimitive = boolean | number | string | null;
export type OrchestrationJsonObject = {
  [key: string]: OrchestrationJsonValue;
};
export type OrchestrationJsonValue =
  | OrchestrationJsonPrimitive
  | OrchestrationJsonValue[]
  | OrchestrationJsonObject;

export interface OrchestrationTxWorkflowAction extends OrchestrationJsonObject {
  kind: "tx_workflow";
  workflow: OrchestrationJsonValue | null;
  workflow_template_name: string | null;
  workflow_vars: OrchestrationJsonValue;
}

export interface OrchestrationJob extends OrchestrationJsonObject {
  action: OrchestrationTxWorkflowAction;
  fail_fast: boolean | null;
  max_parallel: number | null;
  name: string | null;
  strategy: OrchestrationStrategy;
  target_groups: string[];
  target_tags: string[];
  targets: string[];
}

export interface OrchestrationStage extends OrchestrationJsonObject {
  fail_fast: boolean | null;
  jobs: OrchestrationJob[];
  max_parallel: number | null;
  name: string;
  strategy: OrchestrationStrategy;
}

export interface OrchestrationPlan extends OrchestrationJsonObject {
  fail_fast: boolean;
  name: string;
  rollback_completed_stages_on_failure: boolean;
  rollback_on_stage_failure: boolean;
  stages: OrchestrationStage[];
}

export type OrchestrationExecutionStatus = "failed" | "skipped" | "success";

export interface OrchestrationCompensationExecutionResult extends OrchestrationJsonObject {
  attempted: boolean;
  duration_ms: number;
  error: string | null;
  operation: string | null;
  reason: string | null;
  recording_jsonl: string | null;
  scope: string;
  success: boolean;
  tx_result: OrchestrationJsonValue | null;
}

export interface OrchestrationTargetExecutionResult extends OrchestrationJsonObject {
  compensation: OrchestrationCompensationExecutionResult | null;
  connection_name: string | null;
  duration_ms: number;
  error: string | null;
  host: string | null;
  label: string;
  operation: string;
  recording_jsonl: string | null;
  status: OrchestrationExecutionStatus;
  tx_result: OrchestrationJsonValue | null;
  workflow_result: OrchestrationJsonValue | null;
}

export interface OrchestrationJobExecutionResult extends OrchestrationJsonObject {
  action_kind: string;
  action_summary: string;
  fail_fast: boolean;
  name: string;
  results: OrchestrationTargetExecutionResult[];
  status: OrchestrationExecutionStatus;
  strategy: OrchestrationStrategy;
  targets_failed: number;
  targets_skipped: number;
  targets_succeeded: number;
  targets_total: number;
}

export interface OrchestrationStageExecutionResult extends OrchestrationJsonObject {
  fail_fast: boolean;
  jobs: OrchestrationJobExecutionResult[];
  jobs_failed: number;
  jobs_skipped: number;
  jobs_succeeded: number;
  jobs_total: number;
  name: string;
  status: OrchestrationExecutionStatus;
  strategy: OrchestrationStrategy;
}

export interface OrchestrationExecutionResult extends OrchestrationJsonObject {
  executed_stages: number;
  fail_fast: boolean;
  plan_name: string;
  stages: OrchestrationStageExecutionResult[];
  success: boolean;
  total_stages: number;
}

export interface ExecuteOrchestrationResponse {
  orchestration_result: OrchestrationExecutionResult | null;
  plan: OrchestrationPlan;
  result_summary: JsonObject;
}

export interface OrchestrationStageExecutionDetail {
  kind: "stage";
  planName: string;
  stage: OrchestrationStageExecutionResult;
  stageIndex: number;
}

export interface OrchestrationTargetExecutionDetail {
  jobIndex: number;
  jobName: string;
  kind: "target";
  planName: string;
  stageIndex: number;
  stageName: string;
  target: OrchestrationTargetExecutionResult;
  targetIndex: number;
}

export type OrchestrationExecutionDetail =
  | OrchestrationStageExecutionDetail
  | OrchestrationTargetExecutionDetail;

export interface OrchestrationExecutionDetailEntry {
  detail: OrchestrationExecutionDetail;
  titleKey: string;
  titleText: string;
}

export interface OrchestrationExecutionDetailIndex {
  stageDetails: OrchestrationExecutionDetailEntry[];
  targetDetails: OrchestrationExecutionDetailEntry[][][];
}

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
  workflow: JsonObject | null;
  workflowTemplateName: string | null;
  workflowVars: JsonObject;
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
  name: string | null;
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
  txWorkflowActionSourceRows: readonly OrchestrationWorkflowSourceMode[];
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

export interface OrchestrationJobEditorDisplay {
  removeButtonLabel: string;
  titleText: string;
}

export interface OrchestrationTargetFieldDisplay {
  labelText: string;
  placeholderText: string;
}

export interface OrchestrationJobTargetsDisplay {
  targetGroupsField: OrchestrationTargetFieldDisplay;
  targetTagsField: OrchestrationTargetFieldDisplay;
  targetsField: OrchestrationTargetFieldDisplay;
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
  unresolvedPaths: string[];
  workflow: JsonObject;
  workflowName: string;
}

export interface OrchestrationWorkflowPreviewResponse {
  unresolved_paths: string[];
  workflow: OrchestrationJsonValue;
}

export type OrchestrationWorkflowPreviewPort = (
  templateName: string,
  workflowVars: JsonObject,
) => Promise<OrchestrationWorkflowPreviewResponse>;

export interface OrchestrationWorkflowPreviewWorkspace {
  clearTemplate(templateName?: string): void;
  previewTemplate(
    templateName: string,
    workflowVars?: JsonObject,
  ): Promise<OrchestrationWorkflowPreview>;
}
