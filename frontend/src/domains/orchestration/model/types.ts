export type JsonObject = Record<string, unknown>;

export type OrchestrationStrategy = "parallel" | "serial";

export interface OrchestrationTxWorkflowActionModel extends JsonObject {
  hasWorkflow: boolean;
  hasWorkflowTemplateName: boolean;
  hasWorkflowVars: boolean;
  workflow: unknown | null;
  workflowTemplateName: string | null;
  workflowVars: unknown;
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
  optionValue: unknown;
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
  valueText: unknown;
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
