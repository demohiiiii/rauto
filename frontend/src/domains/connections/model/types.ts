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
  [key: string]: unknown;
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
  command?: string;
  mode?: string;
  object?: string;
  source?: string;
  textfsm_mapping_command?: string;
  textfsm_template_name?: string;
  textfsmMappingCommand?: string;
  textfsmTemplateName?: string;
  [key: string]: unknown;
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
  id?: string | number;
}

export interface ConnectionHistoryDrawerState {
  connectionLabel: string;
  historyItems: ConnectionHistoryItem[];
  refreshLoading: boolean;
  status: ConnectionStatus;
  version: number;
}

export interface SavedConnection {
  connect_timeout_secs?: number | string;
  credential_id?: string;
  credential_name?: string;
  credential_required?: boolean;
  device_model?: string;
  device_profile?: string;
  enabled?: boolean;
  group?: string;
  groups?: string[];
  host?: string;
  label?: string;
  labels?: string[];
  linux_shell_flavor?: string;
  name?: string;
  output_encoding?: string;
  port?: number | string;
  ssh_security?: string;
  software_version?: string;
  vars?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SavedConnectionDetail extends Record<string, unknown> {
  connection?: SavedConnection;
  name?: string;
}

export interface ConnectionImportReport extends Record<string, unknown> {
  created?: number;
  failed?: number;
  imported?: number;
  total_rows?: number;
  updated?: number;
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
