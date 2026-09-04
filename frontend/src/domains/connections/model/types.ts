export type ConnectionFieldValue = string | number | boolean | null | undefined;

export interface ConnectionDraft {
  connectTimeoutSecs: string;
  credentialId: string;
  deviceModel: string;
  deviceProfile: string;
  enabled: boolean;
  host: string;
  linuxShellFlavor: string;
  name?: string;
  outputEncoding: string;
  port: string;
  softwareVersion: string;
  sshSecurity: string;
  [key: string]: ConnectionFieldValue;
}

export type ConnectionDraftPatch = Partial<ConnectionDraft>;
export type ConnectionDraftChange = (
  draft: ConnectionDraft,
  patch: ConnectionDraftPatch,
  effect: string,
) => unknown;

export interface ConnectionPickerState {
  open?: boolean;
  query?: string;
  showObjects?: ShowObjectOption[];
  values?: string[];
  version?: number;
}

export type ConnectionPickerKind =
  | "devices"
  | "groups"
  | "labels"
  | "show-objects";

export interface ConnectionPickerConfig {
  allowCustom?: boolean;
  kind: ConnectionPickerKind;
}

export interface ConnectionPickerChoices {
  canAddCustom?: boolean;
  normalizedQuery?: string;
  optionRows?: ConnectionPickerOptionRow[];
  showNoMatch?: boolean;
  showObjectMenu?: boolean;
}

export interface ConnectionPickerOptionRow {
  isShowObject?: boolean;
  label?: string;
  nameText?: string;
  value: string;
  [key: string]: unknown;
}

export interface ConnectionPickerDisplay {
  canRemoveLastOnBackspace: boolean;
  lastSelectedValue: string;
  normalizedQuery: string;
}

export interface ConnectionVarRow {
  id?: string | number;
  name?: string;
  type?: string;
  value?: string;
}

export interface ConnectionVarsState {
  connectionVarRows?: ConnectionVarRow[];
  connectionVars?: Record<string, unknown>;
  hasConnectionVarRows?: boolean;
  version?: number;
  [key: string]: unknown;
}

export interface InventoryNamedResource {
  name?: string;
}

export interface ShowObjectInput {
  command?: string | null;
  mode?: string | null;
  object?: string;
  source?: string | null;
  textfsm_mapping_command?: string | null;
  textfsm_template_name?: string | null;
  textfsmMappingCommand?: string | null;
  textfsmTemplateName?: string | null;
}

export interface ShowObjectOption {
  command: string;
  mode: string;
  object: string;
  source: string;
  textfsmMappingCommand: string;
  textfsmTemplate: string;
}

export interface ConnectionStatus {
  message?: string;
  tone?: string;
}

export interface ConnectionHistoryFilter {
  limit: number;
  operation: string;
  query: string;
}

export interface ConnectionHistoryItem extends Record<string, unknown> {
  command_label: string;
  connection_key: string;
  connection_name: string | null;
  device_profile: string;
  host: string;
  id: string;
  mode: string | null;
  operation: string;
  port: number;
  record_level: string;
  record_path: string;
  ts_ms: number;
  username: string;
}

export interface ConnectionHistoryDrawerState {
  connectionLabel: string;
  historyItems: ConnectionHistoryItem[];
  refreshLoading: boolean;
  status: ConnectionStatus;
  version: number;
}

export interface SavedConnection {
  connect_timeout_secs?: number | string | null;
  credential_id?: string | null;
  credential_name?: string | null;
  credential_required?: boolean;
  device_model?: string | null;
  device_profile?: string | null;
  enabled?: boolean;
  group?: string;
  groups?: string[];
  host?: string | null;
  label?: string;
  labels?: string[];
  linux_shell_flavor?: string | null;
  name?: string;
  output_encoding?: string;
  port?: number | string | null;
  ssh_security?: string | null;
  software_version?: string | null;
  vars?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SavedConnectionDetail extends Record<string, unknown> {
  connection: ConnectionRequestPayload;
  credential_name: string | null;
  credential_required: boolean;
  has_enable_password: boolean;
  has_password: boolean;
  name: string;
  path: string;
}

export interface ConnectionImportReport extends Record<string, unknown> {
  created: number;
  failed: number;
  failures: Array<{ message: string; name: string | null; row: number }>;
  file_name: string;
  imported: number;
  total_rows: number;
  updated: number;
}

export interface ConnectionRequestPayload {
  connect_timeout_secs?: number | null;
  connection_name?: string | null;
  credential_id?: string | null;
  device_model?: string | null;
  device_profile?: string | null;
  enabled?: boolean;
  groups?: string[];
  host?: string | null;
  labels?: string[];
  linux_shell_flavor?: string | null;
  output_encoding?: string | null;
  port?: number | null;
  software_version?: string | null;
  ssh_security?: string | null;
  template_dir?: string | null;
  vars?: Record<string, unknown>;
}

export interface ConnectionTestResponse {
  device_profile: string;
  host: string;
  linux_shell_flavor: string | null;
  ok: boolean;
  output_encoding: string;
  port: number;
  ssh_security: string;
  username: string;
}

export interface ConnectionFactsResponse {
  device_model: string | null;
  device_profile: string;
  ok: boolean;
  software_version: string | null;
  warning: string | null;
}

export interface ConnectionHistoryDetailResponse extends Record<
  string,
  unknown
> {
  entries: Record<string, unknown>[];
  meta: ConnectionHistoryItem;
}

export interface ConnectionTestState {
  loading: boolean;
  status: ConnectionStatus | null;
}

export interface ConnectionOverlayState {
  modalMode?: string;
  modalOpen?: boolean;
  savedEditorOpen?: boolean;
}

export interface ConnectionTargetDetails extends Record<string, unknown> {
  credential_id?: string;
  credentialId?: string;
  device_profile?: string;
  host?: string;
  kind?: string;
  name?: string;
  port?: number | string;
  profile?: string;
}

export interface PersistedConnectionTarget extends Record<string, unknown> {
  kind: string;
}

export interface ConnectionTargetState {
  connection?: PersistedConnectionTarget | null;
  details: ConnectionTargetDetails | null;
  kind: string;
}

export interface SavedConnectionSelectState {
  connections?: SavedConnection[];
  options?: string[];
  selected?: string;
}

export interface ConnectionAutodetectState {
  detectedModel?: string;
  detectedProfile?: string;
  detectedVersion?: string;
  warning?: string;
}

export interface ConnectionFocusRequest {
  target?: string;
  version?: number;
}

export interface SidebarConnectionCard {
  host?: string;
  kind?: string;
  name?: string;
  port?: number | string;
  profile?: string;
}

export interface SidebarConnectionState {
  card?: SidebarConnectionCard | null;
  errorMessage?: string;
}
