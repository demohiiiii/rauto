import type { Readable, Writable } from "svelte/store";

export type DiscoveryResultFilter =
  | "all"
  | "existing"
  | "failed"
  | "identified"
  | "imported"
  | "reachable"
  | "ready";
export type DiscoveryRunStatus =
  | "cancelled"
  | "cancelling"
  | "completed"
  | "failed"
  | "queued"
  | "running";
export type DiscoveryRunPhase =
  | "cancelled"
  | "completed"
  | "failed"
  | "queued"
  | "ssh_probe"
  | "tcp_scan";
export type DiscoveryResultStatus =
  | "cancelled"
  | "identified"
  | "not_ssh"
  | "probe_failed"
  | "reachable"
  | "unreachable";
export type DiscoveryBadgeVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary";

export interface DiscoveryRun {
  completed_at_ms: number | null;
  concurrency: number;
  created_at_ms: number;
  credential_ids: string[];
  default_groups: string[];
  default_labels: string[];
  error: string | null;
  failed_count: number;
  id: string;
  identified_count: number;
  phase: DiscoveryRunPhase;
  ports: number[];
  probe_timeout_secs: number;
  probed_targets: number;
  reachable_count: number;
  scanned_targets: number;
  started_at_ms: number | null;
  status: DiscoveryRunStatus;
  targets: string[];
  tcp_timeout_ms: number;
  total_targets: number;
}

export interface DiscoveryResult {
  credential_id: string | null;
  device_model: string | null;
  device_profile: string | null;
  error: string | null;
  existing_connection_name: string | null;
  host: string;
  imported_connection_name: string | null;
  latency_ms: number | null;
  port: number;
  run_id: string;
  software_version: string | null;
  status: DiscoveryResultStatus;
  updated_at_ms: number;
}

export interface DiscoveryRunDetail {
  results: DiscoveryResult[];
  run: DiscoveryRun;
}

export interface DiscoveryCredential {
  id: string;
  name: string;
  username: string;
}

export interface DiscoveryNamedResource {
  name: string;
}

export interface DiscoveryFormState {
  concurrency: number;
  portsText: string;
  probeTimeoutSecs: number;
  selectedCredentialIds: string[];
  selectedGroups: string[];
  selectedLabels: string[];
  targetsText: string;
  tcpTimeoutMs: number;
}

export interface DeviceDiscoveryState extends DiscoveryFormState {
  connectionNames: Record<string, string>;
  credentials: DiscoveryCredential[];
  currentDetail: DiscoveryRunDetail | null;
  errorMessage: string;
  groups: DiscoveryNamedResource[];
  importing: boolean;
  labels: DiscoveryNamedResource[];
  loading: boolean;
  resultFilter: DiscoveryResultFilter;
  resultSearch: string;
  selectedResultKeys: string[];
  statusFilter: string;
  statusMessage: string;
}

export interface DiscoveryOption {
  label: string;
  value: string;
}

export interface DeviceDiscoveryDisplayState extends DeviceDiscoveryState {
  activeStatusFilterLabel: string;
  credentialOptions: DiscoveryOption[];
  filteredResults: DiscoveryResult[];
  groupOptions: DiscoveryOption[];
  identifiedResultCount: number;
  importableResults: DiscoveryResult[];
  labelOptions: DiscoveryOption[];
  progressPercent: number;
  results: DiscoveryResult[];
  runActive: boolean;
  currentRun: DiscoveryRun | null;
  selectedImportableResults: DiscoveryResult[];
  statusFilterOptions: DiscoveryOption[];
}

export interface CreateDiscoveryRunPayload {
  concurrency: number;
  credential_ids: string[];
  default_groups: string[];
  default_labels: string[];
  ports: number[];
  probe_timeout_secs: number;
  targets: string[];
  tcp_timeout_ms: number;
}

export interface ImportDiscoveryItem {
  connection_name: string;
  credential_id?: string | null;
  host: string;
  overwrite: false;
  port: number;
}

export interface ImportDiscoverySummary {
  created: number;
  failed: number;
  results: ImportDiscoveryResultResponse[];
  skipped: number;
  total: number;
  updated: number;
}

export interface ImportDiscoveryResultResponse {
  connection_name: string;
  error: string | null;
  host: string;
  port: number;
  status: string;
}

export interface DeviceDiscoveryApi {
  cancelRun(runId: string): Promise<DiscoveryRunDetail>;
  createRun(payload: CreateDiscoveryRunPayload): Promise<DiscoveryRunDetail>;
  getRun(runId: string): Promise<DiscoveryRunDetail>;
  importResults(
    runId: string,
    items: ImportDiscoveryItem[],
  ): Promise<ImportDiscoverySummary>;
  listCredentials(): Promise<DiscoveryCredential[]>;
  listGroups(): Promise<DiscoveryNamedResource[]>;
  listLabels(): Promise<DiscoveryNamedResource[]>;
  listRuns(): Promise<DiscoveryRun[]>;
}

export interface DeviceDiscoveryRuntime {
  notifyConnectionsRefreshed(): void;
}

export interface DeviceDiscoveryWorkspaceOptions {
  api?: Partial<DeviceDiscoveryApi>;
  pollIntervalMs?: number;
  runtime?: Partial<DeviceDiscoveryRuntime>;
}

export interface DeviceDiscoveryWorkspace {
  displayStateStore: Readable<DeviceDiscoveryDisplayState>;
  stateStore: Writable<DeviceDiscoveryState>;
  cancelDiscovery(): Promise<void>;
  destroy(): void;
  importSelected(): Promise<void>;
  loadLatestRun(): Promise<void>;
  selectResultFilter(filter: DiscoveryResultFilter): void;
  selectStatusFilter(filter: string): void;
  setFormField<K extends keyof DiscoveryFormState>(
    field: K,
    value: DiscoveryFormState[K],
  ): void;
  setPageContext(context: { active: boolean }): Promise<void>;
  setResultSearch(value: string): void;
  startDiscovery(): Promise<void>;
  toggleAllImportable(checked: boolean): void;
  toggleResult(result: DiscoveryResult, checked: boolean): void;
  updateConnectionName(result: DiscoveryResult, value: string): void;
}
