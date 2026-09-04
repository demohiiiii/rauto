import type { Readable } from "svelte/store";

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export type ScheduleActionType = "orchestrate" | "config_fetch" | "tx_workflow";
export type ScheduleOverlapPolicy = "allow" | "skip";
export type ScheduleMisfirePolicy = "fire_once" | "skip";
export type ScheduleTriggerType = "cron" | "manual";
export type ScheduleRunStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "skipped";

export interface OrchestrateScheduleAction {
  type: "orchestrate";
  template_name: string;
  vars: JsonValue;
}

export interface ConfigFetchScheduleAction {
  type: "config_fetch";
  connection_name?: string | null;
  targets: string[];
  groups: string[];
  labels: string[];
  kind: string;
}

export interface TxWorkflowScheduleAction {
  type: "tx_workflow";
  connection_name: string;
  template_name: string;
  vars: JsonValue;
}

export type ScheduleAction =
  | OrchestrateScheduleAction
  | ConfigFetchScheduleAction
  | TxWorkflowScheduleAction;

export interface ScheduleDefinition {
  name: string;
  cron_expression: string;
  timezone: string;
  action: ScheduleAction;
  enabled: boolean;
  overlap_policy: ScheduleOverlapPolicy;
  misfire_policy: ScheduleMisfirePolicy;
  max_runtime_seconds: number;
}

export interface StoredSchedule extends ScheduleDefinition {
  id: string;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleRun {
  id: string;
  schedule_id: string;
  schedule_name: string;
  task_id: string | null;
  trigger_type: ScheduleTriggerType;
  scheduled_for: string;
  status: ScheduleRunStatus;
  skip_reason: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ScheduleForm {
  actionType: ScheduleActionType;
  configGroups: string[];
  configKind: string;
  configLabels: string[];
  configTargets: string[];
  connectionName: string;
  cronExpression: string;
  enabled: boolean;
  maxRuntimeSeconds: string;
  misfirePolicy: ScheduleMisfirePolicy;
  name: string;
  overlapPolicy: ScheduleOverlapPolicy;
  orchestrationTemplateName: string;
  timezone: string;
  txWorkflowTemplateName: string;
  varsJson: string;
}

export type ScheduleFormPatch = Partial<ScheduleForm>;
export type StatusTone = "error" | "info" | "success" | "warning";

export interface StatusMessage {
  message: string;
  tone: StatusTone;
}

export interface NamedResource {
  name: string;
}

export interface ScheduleConnection {
  name: string;
  device_profile?: string | null;
}

export interface InventorySelector {
  name: string;
  hosts?: string[];
}

export interface ConfigCommand {
  device_profile: string;
  kind: string;
}

export interface SelectOption {
  optionLabel: string;
  optionValue: string;
}

export interface MultiSelectOption {
  label: string;
  value: string;
}

export interface SchedulesState {
  busyAction: string;
  configCommands: ConfigCommand[];
  configKinds: string[];
  connections: ScheduleConnection[];
  cronPreview: string[];
  cronPreviewStatus: StatusMessage | null;
  dialogOpen: boolean;
  editingId: string;
  form: ScheduleForm;
  inventoryGroups: InventorySelector[];
  inventoryLabels: InventorySelector[];
  listStatus: StatusMessage | null;
  runs: ScheduleRun[];
  runsStatus: StatusMessage | null;
  schedules: StoredSchedule[];
  selectedId: string;
  orchestrationTemplates: NamedResource[];
  txWorkflowTemplates: NamedResource[];
}

export interface ScheduleRow extends StoredSchedule {
  active: boolean;
  lastRunText: string;
  nextRunText: string;
}

export interface ScheduleRunRow extends ScheduleRun {
  completedText: string;
  scheduledForText: string;
}

export interface SchedulesDisplayState extends SchedulesState {
  scheduleRows: ScheduleRow[];
  runRows: ScheduleRunRow[];
  connectionOptions: SelectOption[];
  configTargetOptions: MultiSelectOption[];
  configGroupOptions: MultiSelectOption[];
  configLabelOptions: MultiSelectOption[];
  configKindOptions: SelectOption[];
  orchestrationTemplateOptions: SelectOption[];
  txWorkflowTemplateOptions: SelectOption[];
}

export interface SchedulePreviewRequest {
  cron_expression: string;
  timezone: string;
}

export interface SchedulePreviewResponse {
  next_runs: string[];
}

export interface ScheduleMutationResponse {
  id: string;
  changed: boolean;
}

export interface ScheduleApi {
  createSchedule(definition: ScheduleDefinition): Promise<StoredSchedule>;
  deleteSchedule(id: string): Promise<ScheduleMutationResponse>;
  listConfigCommands(): Promise<ConfigCommand[]>;
  listConnections(): Promise<ScheduleConnection[]>;
  listInventoryGroups(): Promise<InventorySelector[]>;
  listInventoryLabels(): Promise<InventorySelector[]>;
  listScheduleRuns(id: string): Promise<ScheduleRun[]>;
  listSchedules(): Promise<StoredSchedule[]>;
  listTemplateResource(path: string): Promise<NamedResource[]>;
  previewSchedule(
    request: SchedulePreviewRequest,
  ): Promise<SchedulePreviewResponse>;
  runScheduleNow(id: string): Promise<ScheduleRun>;
  setScheduleEnabled(id: string, enabled: boolean): Promise<StoredSchedule>;
  updateSchedule(
    id: string,
    definition: ScheduleDefinition,
  ): Promise<StoredSchedule>;
}

export interface SchedulesWorkspaceOptions {
  api?: Partial<ScheduleApi>;
}

export interface SchedulesWorkspace {
  displayStateStore: Readable<SchedulesDisplayState>;
  closeEditor(): void;
  editSchedule(id: string): () => void;
  patchForm(patch: ScheduleFormPatch): void;
  refresh(selectedId?: string): Promise<void>;
  remove(id: string): Promise<void>;
  runNow(schedule: StoredSchedule): () => Promise<void>;
  save(): Promise<void>;
  selectSchedule(id: string): () => Promise<void>;
  setPageContext(context: { active: boolean }): Promise<void>;
  startCreate(): void;
  toggleEnabled(schedule: StoredSchedule): () => Promise<void>;
}
