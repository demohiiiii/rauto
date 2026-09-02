import { tr } from "../../../lib/i18n.js";
import type {
  CredentialApiRow,
  CredentialForm,
  CredentialImportFailure,
  CredentialImportReport,
  CredentialRow,
  CredentialSavePayload,
  CredentialTranslate,
  CredentialsPageState,
} from "./types.js";

const identityTranslate: CredentialTranslate = (key) => key;
const credentialNamePattern = /^[A-Za-z0-9_.-]+$/;
const invalidCredentialNameError =
  /^invalid device credential name '(.*)', use only letters\/numbers\/_\/\.\/-$/;

function listValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

export function newCredentialForm(row?: CredentialRow | null): CredentialForm {
  return {
    authType: row?.authType || "password",
    connectionCount: row?.connectionCount || 0,
    enableEnabled: row?.enableEnabled || false,
    enablePassword: "",
    hasAuthSecret: row?.hasAuthSecret || false,
    hasEnablePassword: row?.hasEnablePassword || false,
    hasPassphrase: row?.hasPassphrase || false,
    hasPassword: row?.hasPassword || false,
    name: row?.name || "",
    passphrase: "",
    password: "",
    privateKey: "",
    privateKeyPath: row?.privateKeyPath || "",
    referencingConnections: row?.referencingConnections || [],
    username: row?.username || "",
  };
}

export function newCredentialsPageState(): CredentialsPageState {
  return {
    credentials: [],
    form: newCredentialForm(),
    loaded: false,
    loading: false,
    saving: false,
    searchQuery: "",
    selectedId: "",
    status: { text: "", tone: "info" },
  };
}

export function credentialFormValidationMessage(
  form: Partial<CredentialForm> = {},
  {
    editing = false,
    translate = identityTranslate,
  }: { editing?: boolean; translate?: CredentialTranslate } = {},
): string {
  const name = text(form.name).trim();
  if (!name) return translate("credentialNameRequired");
  if (!credentialNamePattern.test(name)) {
    return translate("credentialNameInvalid");
  }
  if (!text(form.username).trim()) {
    return translate("credentialUsernameRequired");
  }
  const authType = text(form.authType || "password");
  const hasStoredAuth = editing && form.hasAuthSecret !== false;
  if (
    authType === "password" &&
    !hasStoredAuth &&
    !text(form.password).trim()
  ) {
    return translate("credentialPasswordRequired");
  }
  if (
    authType === "private_key" &&
    !hasStoredAuth &&
    !text(form.privateKey).trim()
  ) {
    return translate("credentialPrivateKeyRequired");
  }
  if (authType === "private_key_file" && !text(form.privateKeyPath).trim()) {
    return translate("credentialPrivateKeyPathRequired");
  }
  return "";
}

export function credentialErrorMessage(
  error: unknown,
  translate: CredentialTranslate = identityTranslate,
): string {
  const source =
    typeof error === "object" && error !== null && "message" in error
      ? error.message
      : error;
  const message = text(source).trim();
  const invalidNameMatch = message.match(invalidCredentialNameError);
  if (invalidNameMatch) {
    return invalidNameMatch[1].trim()
      ? translate("credentialNameInvalid")
      : translate("credentialNameRequired");
  }
  if (message === "device credential username is required") {
    return translate("credentialUsernameRequired");
  }
  if (message === "login password is required") {
    return translate("credentialPasswordRequired");
  }
  if (message === "inline private key is required") {
    return translate("credentialPrivateKeyRequired");
  }
  if (message === "private key file path is required") {
    return translate("credentialPrivateKeyPathRequired");
  }
  return message || translate("requestFailed");
}

export function credentialRow(
  value: Partial<CredentialApiRow> = {},
): CredentialRow {
  const referencingConnections = listValue(value.referencing_connections)
    .map((item) => text(item).trim())
    .filter(Boolean)
    .sort();
  const row = {
    authType: text(value.auth_type || "password").trim(),
    connectionCount: Number(value.connection_count) || 0,
    enableEnabled: Boolean(value.enable_enabled),
    hasAuthSecret: Boolean(value.has_auth_secret),
    hasEnablePassword: Boolean(value.has_enable_password),
    hasPassphrase: Boolean(value.has_passphrase),
    hasPassword: Boolean(value.has_password),
    id: text(value.id).trim(),
    name: text(value.name).trim(),
    privateKeyPath: text(value.private_key_path).trim(),
    referencingConnections,
    username: text(value.username).trim(),
  };
  return {
    ...row,
    searchText: [
      row.name,
      row.username,
      row.authType,
      ...referencingConnections,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

export function credentialSavePayload(
  form: Partial<CredentialForm> = {},
): CredentialSavePayload {
  const password = text(form.password);
  const privateKey = text(form.privateKey);
  const privateKeyPath = text(form.privateKeyPath);
  const passphrase = text(form.passphrase);
  const enablePassword = text(form.enablePassword);
  return {
    auth_type: text(form.authType || "password"),
    enable_enabled: Boolean(form.enableEnabled),
    enable_password: enablePassword.trim() ? enablePassword : null,
    name: text(form.name).trim(),
    passphrase: passphrase ? passphrase : null,
    password: password.trim() ? password : null,
    private_key: privateKey.trim() ? privateKey : null,
    private_key_path: privateKeyPath.trim() ? privateKeyPath.trim() : null,
    username: text(form.username).trim(),
  };
}

export function credentialDeleteBlockedMessage(
  connections: unknown[] = [],
): string {
  const names = listValue(connections)
    .map((item) => text(item).trim())
    .filter(Boolean)
    .sort();
  return `${tr("credentialReferencedBy", "该凭证仍被以下连接引用：")}${names.join(", ")}`;
}

function normalizedCount(candidate: unknown): number {
  const parsed = Number(candidate);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function credentialImportReport(
  value: unknown = {},
): CredentialImportReport {
  const source =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  return {
    created: normalizedCount(source.created),
    failed: normalizedCount(source.failed),
    failures: listValue(source.failures).map((failure) => {
      const row =
        typeof failure === "object" && failure !== null
          ? (failure as Record<string, unknown>)
          : {};
      return {
        message: text(row.message).trim(),
        name: text(row.name).trim(),
        row: normalizedCount(row.row),
      };
    }),
    fileName: text(source.file_name).trim(),
    imported: normalizedCount(source.imported),
    totalRows: normalizedCount(source.total_rows),
    updated: normalizedCount(source.updated),
  };
}

export function credentialImportFailureMessage(
  failure: Partial<CredentialImportFailure> | string = {},
  translate: CredentialTranslate = identityTranslate,
): string {
  const message = text(
    typeof failure === "object" && failure !== null ? failure.message : failure,
  ).trim();
  if (/missing credential name/.test(message)) {
    return translate("credentialImportNameRequired");
  }
  if (/duplicated credential name/.test(message)) {
    return translate("credentialImportDuplicateName");
  }
  if (/login_username is required/.test(message)) {
    return translate("credentialImportUsernameRequired");
  }
  if (/login_secret is required/.test(message)) {
    return translate("credentialImportSecretRequired");
  }
  if (/invalid enable_enabled value/.test(message)) {
    return translate("credentialImportBooleanInvalid");
  }
  if (/cannot (combine|provide) enable_/.test(message)) {
    return translate("credentialImportEnableConflict");
  }
  return credentialErrorMessage(message, translate);
}

export function credentialImportFileAccepted(file: File | null): file is File {
  return Boolean(file && /\.(csv|xlsx|xls|xlsm|xlsb)$/i.test(file.name));
}
