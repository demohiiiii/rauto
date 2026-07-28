import { tr } from "../../lib/i18n.js";

const listValue = (value) => (Array.isArray(value) ? value : []);
const text = (value) => (value == null ? "" : String(value));
const identityTranslate = (key) => key;
const credentialNamePattern = /^[A-Za-z0-9_.-]+$/;
const invalidCredentialNameError =
  /^invalid device credential name '(.*)', use only letters\/numbers\/_\/\.\/-$/;

export function credentialFormValidationMessage(
  form = {},
  { editing = false, translate = identityTranslate } = {},
) {
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

export function credentialErrorMessage(error, translate = identityTranslate) {
  const message = text(error?.message ?? error).trim();
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

export function credentialRow(value = {}) {
  const referencingConnections = listValue(value.referencing_connections)
    .map((item) => text(item).trim())
    .filter(Boolean)
    .sort();
  const row = {
    id: text(value.id).trim(),
    name: text(value.name).trim(),
    username: text(value.username).trim(),
    authType: text(value.auth_type || "password").trim(),
    hasAuthSecret: Boolean(value.has_auth_secret),
    hasPassword: Boolean(value.has_password),
    privateKeyPath: text(value.private_key_path).trim(),
    hasPassphrase: Boolean(value.has_passphrase),
    hasEnablePassword: Boolean(value.has_enable_password),
    enableEnabled: Boolean(value.enable_enabled),
    connectionCount: Number(value.connection_count) || 0,
    referencingConnections,
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

export function credentialSavePayload(form = {}) {
  const password = text(form.password);
  const privateKey = text(form.privateKey);
  const privateKeyPath = text(form.privateKeyPath);
  const passphrase = text(form.passphrase);
  const enablePassword = text(form.enablePassword);
  return {
    name: text(form.name).trim(),
    username: text(form.username).trim(),
    auth_type: text(form.authType || "password"),
    password: password.trim() ? password : null,
    private_key: privateKey.trim() ? privateKey : null,
    private_key_path: privateKeyPath.trim() ? privateKeyPath.trim() : null,
    passphrase: passphrase ? passphrase : null,
    enable_password: enablePassword.trim() ? enablePassword : null,
    enable_enabled: Boolean(form.enableEnabled),
  };
}

export function credentialDeleteBlockedMessage(connections = []) {
  const names = listValue(connections)
    .map((item) => text(item).trim())
    .filter(Boolean)
    .sort();
  return `${tr("credentialReferencedBy", "该凭证仍被以下连接引用：")}${names.join(", ")}`;
}

export function credentialImportReport(value = {}) {
  const number = (candidate) => {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  return {
    fileName: text(value.file_name).trim(),
    totalRows: number(value.total_rows),
    imported: number(value.imported),
    created: number(value.created),
    updated: number(value.updated),
    failed: number(value.failed),
    failures: listValue(value.failures).map((failure) => ({
      row: number(failure?.row),
      name: text(failure?.name).trim(),
      message: text(failure?.message).trim(),
    })),
  };
}

export function credentialImportFailureMessage(
  failure = {},
  translate = identityTranslate,
) {
  const message = text(failure?.message ?? failure).trim();
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
