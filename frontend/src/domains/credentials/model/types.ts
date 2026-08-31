import type { Readable, Writable } from "svelte/store";

export type CredentialStatusTone = "error" | "info" | "success";
export type CredentialTranslate = (key: string, fallback?: string) => string;

export interface CredentialApiRow {
  auth_type?: unknown;
  connection_count?: unknown;
  enable_enabled?: unknown;
  has_auth_secret?: unknown;
  has_enable_password?: unknown;
  has_passphrase?: unknown;
  has_password?: unknown;
  id?: unknown;
  name?: unknown;
  private_key_path?: unknown;
  referencing_connections?: unknown;
  username?: unknown;
  [key: string]: unknown;
}

export interface CredentialRow {
  authType: string;
  connectionCount: number;
  enableEnabled: boolean;
  hasAuthSecret: boolean;
  hasEnablePassword: boolean;
  hasPassphrase: boolean;
  hasPassword: boolean;
  id: string;
  name: string;
  privateKeyPath: string;
  referencingConnections: string[];
  searchText: string;
  username: string;
}

export interface CredentialForm {
  authType: string;
  connectionCount: number;
  enableEnabled: boolean;
  enablePassword: string;
  hasAuthSecret: boolean;
  hasEnablePassword: boolean;
  hasPassphrase: boolean;
  hasPassword: boolean;
  name: string;
  passphrase: string;
  password: string;
  privateKey: string;
  privateKeyPath: string;
  referencingConnections: string[];
  username: string;
}

export interface CredentialSavePayload {
  auth_type: string;
  enable_enabled: boolean;
  enable_password: string | null;
  name: string;
  passphrase: string | null;
  password: string | null;
  private_key: string | null;
  private_key_path: string | null;
  username: string;
}

export interface CredentialImportFailure {
  message: string;
  name: string;
  row: number;
}

export interface CredentialImportReport {
  created: number;
  failed: number;
  failures: CredentialImportFailure[];
  fileName: string;
  imported: number;
  totalRows: number;
  updated: number;
}

export interface CredentialStatus {
  text: string;
  tone: CredentialStatusTone;
}

export interface CredentialsPageState {
  credentials: CredentialRow[];
  form: CredentialForm;
  loaded: boolean;
  loading: boolean;
  saving: boolean;
  searchQuery: string;
  selectedId: string;
  status: CredentialStatus;
}

export interface CredentialsPageDisplay extends CredentialsPageState {
  filteredCredentials: CredentialRow[];
}

export interface CredentialCreateState {
  error: string;
  form: CredentialForm;
  open: boolean;
  saving: boolean;
}

export interface CredentialImportState {
  error: string;
  file: File | null;
  importing: boolean;
  open: boolean;
  report: CredentialImportReport | null;
  templateLoading: boolean;
  templateStatus: string;
}

export interface CredentialOption {
  optionLabel: string;
  optionValue: string;
}

export interface CredentialOptionsState {
  credentials: CredentialRow[];
  error: string;
  loading: boolean;
}

export interface CredentialOptionsDisplay extends CredentialOptionsState {
  credentialOptionRows: CredentialOption[];
}

export interface CredentialBlobPayload {
  blob: Blob;
  filename: string;
}

export interface CredentialsApi {
  createCredential(payload: CredentialSavePayload): Promise<CredentialApiRow>;
  deleteCredential(id: string): Promise<unknown>;
  downloadImportTemplate(language: string): Promise<CredentialBlobPayload>;
  getCredential(id: string): Promise<CredentialApiRow>;
  importCredentials(file: File): Promise<unknown>;
  listCredentials(): Promise<CredentialApiRow[]>;
  updateCredential(
    id: string,
    payload: CredentialSavePayload,
  ): Promise<CredentialApiRow>;
}

export interface CredentialsRuntime {
  download(blob: Blob, filename: string): void;
}

export interface CredentialsWorkspaceOptions {
  api?: Partial<CredentialsApi>;
}

export interface CredentialCreateWorkspaceOptions extends CredentialsWorkspaceOptions {
  onCreated?: (row: CredentialRow) => unknown | Promise<unknown>;
}

export interface CredentialImportWorkspaceOptions extends CredentialsWorkspaceOptions {
  onImported?: (report: CredentialImportReport) => unknown | Promise<unknown>;
  runtime?: Partial<CredentialsRuntime>;
}

export interface CredentialsPageWorkspace {
  displayStateStore: Readable<CredentialsPageDisplay>;
  handleImported(report: CredentialImportReport): Promise<void>;
  loadCredentials(selectId?: string): Promise<void>;
  patchForm(patch: Partial<CredentialForm>): void;
  remove(): Promise<void>;
  resetForm(): void;
  save(): Promise<void>;
  selectCredential(id: string): Promise<void>;
  setEnableEnabled(checked: boolean): void;
  setPageContext(context: { active: boolean }): Promise<void>;
  setSearchQuery(searchQuery: string): void;
  stateStore: Writable<CredentialsPageState>;
}

export interface CredentialCreateWorkspace {
  patchForm(patch: Partial<CredentialForm>): void;
  setEnableEnabled(checked: boolean): void;
  setOpen(open: boolean): void;
  stateStore: Writable<CredentialCreateState>;
  submit(): Promise<void>;
}

export interface CredentialImportWorkspace {
  downloadTemplate(language: string): Promise<void>;
  selectFile(file: File | null): void;
  setOpen(open: boolean): void;
  stateStore: Writable<CredentialImportState>;
  submitImport(): Promise<void>;
}

export interface CredentialOptionsWorkspace {
  displayStateStore: Readable<CredentialOptionsDisplay>;
  handleCreated(row: CredentialRow): void;
  loadOptions(): Promise<void>;
  stateStore: Writable<CredentialOptionsState>;
}
