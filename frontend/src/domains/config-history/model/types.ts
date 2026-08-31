import type { Readable } from "svelte/store";

export type ConfigHistorySortOrder = "asc" | "desc";
export type StatusTone = "error" | "info" | "success" | "warning";
export type BadgeVariant = "destructive" | "outline" | "secondary";

export interface StatusMessage {
  message: string;
  tone: StatusTone;
}

export interface ConnectionTargetDetails {
  name?: unknown;
  [key: string]: unknown;
}

export interface ConnectionTarget {
  details?: ConnectionTargetDetails | null;
  kind?: string;
}

export interface ConfigHistoryDeviceInput {
  name?: unknown;
  [key: string]: unknown;
}

export interface ConfigHistoryDevice {
  name: string;
  device_profile?: string;
  host?: string;
  [key: string]: unknown;
}

export interface DeviceConfigSnapshotSummary {
  changed_from_previous: boolean | null;
  command: string;
  connection_name: string;
  content_size_bytes: number;
  fetched_at: string;
  host: string;
  id: string;
  kind: string;
  previous_snapshot_id: string | null;
  profile: string;
  sha256: string;
  source: string;
  task_id: string | null;
}

export interface DeviceConfigSnapshot extends DeviceConfigSnapshotSummary {
  content: string;
}

export interface DeviceConfigHistoryFilters {
  connectionName: string;
  fetchedFrom: string;
  fetchedTo: string;
  kind: string;
  limit: number;
  sortOrder: ConfigHistorySortOrder;
}

export interface DeviceConfigHistoryResponse {
  connection_names: string[];
  kinds: string[];
  snapshots: DeviceConfigSnapshotSummary[];
}

export interface DeviceConfigSnapshotMutationResponse {
  deleted: boolean;
  id: string;
}

export interface ConfigHistoryApi {
  deleteDeviceConfigSnapshot(
    id: string,
  ): Promise<DeviceConfigSnapshotMutationResponse | unknown>;
  getDeviceConfigSnapshot(id: string): Promise<DeviceConfigSnapshot | null>;
  listConnections(): Promise<ConfigHistoryDevice[]>;
  listDeviceConfigHistory(
    filters: DeviceConfigHistoryFilters,
  ): Promise<DeviceConfigHistoryResponse>;
  listDeviceConfigHistoryDevices(): Promise<ConfigHistoryDevice[]>;
}

export interface ConfigHistoryState {
  connectionName: string;
  detail: DeviceConfigSnapshot | null;
  detailOpen: boolean;
  detailStatus: StatusMessage | null;
  devices: ConfigHistoryDevice[];
  deviceStatus: StatusMessage | null;
  fetchedFrom: string;
  fetchedTo: string;
  kind: string;
  kinds: string[];
  limit: number;
  listStatus: StatusMessage | null;
  preferredConnectionName: string;
  search: string;
  selectedId: string;
  snapshots: DeviceConfigSnapshotSummary[];
  sortOrder: ConfigHistorySortOrder;
}

export interface SelectOption {
  optionLabel: string;
  optionValue: string;
}

export interface ChangePresentation {
  label: string;
  variant: BadgeVariant;
}

export interface ConfigHistoryDeviceRow extends ConfigHistoryDevice {
  active: boolean;
  preferred: boolean;
}

export interface ConfigHistorySnapshotRow extends DeviceConfigSnapshotSummary {
  active: boolean;
  change: ChangePresentation;
  fetchedAtText: string;
  sizeText: string;
}

export interface ConfigHistoryDetailView extends DeviceConfigSnapshot {
  change: ChangePresentation;
  fetchedAtText: string;
  hasDetail: true;
  sizeText: string;
  sourceText: string;
}

export interface EmptyConfigHistoryDetailView {
  content: "";
  hasDetail: false;
}

export type ConfigHistoryDetailDisplay =
  | ConfigHistoryDetailView
  | EmptyConfigHistoryDetailView;

export interface ConfigHistoryDisplayState extends ConfigHistoryState {
  detailDisplay: ConfigHistoryDetailDisplay;
  deviceRows: ConfigHistoryDeviceRow[];
  hasSelectedDevice: boolean;
  kindOptions: SelectOption[];
  selectedDevice: ConfigHistoryDevice | null;
  snapshotRows: ConfigHistorySnapshotRow[];
}

export type ConfigHistoryQueryPatch = Partial<
  Pick<ConfigHistoryState, "fetchedFrom" | "fetchedTo" | "kind" | "sortOrder">
>;

export interface ConfigHistoryWorkspaceOptions {
  activeConnectionTargetStore?: Readable<ConnectionTarget> | null;
  api?: Partial<ConfigHistoryApi>;
  getActiveConnectionTarget?: () => ConnectionTarget;
}

export interface ConfigHistoryWorkspace {
  displayStateStore: Readable<ConfigHistoryDisplayState>;
  clearTimeRange(): Promise<void>;
  closeDetail(): void;
  destroy(): void;
  downloadSelected(): void;
  refresh(): Promise<void>;
  removeSelected(): Promise<void>;
  selectDevice(connectionName: string): Promise<void>;
  selectSnapshot(id: string): () => Promise<void>;
  setFetchedFrom(fetchedFrom: string): Promise<void>;
  setFetchedTo(fetchedTo: string): Promise<void>;
  setKind(kind: string): Promise<void>;
  setPageContext(context: { active: boolean }): Promise<void>;
  setSearch(search: string): void;
  setSortOrder(sortOrder: string): Promise<void>;
}
