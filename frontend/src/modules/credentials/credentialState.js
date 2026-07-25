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
  if (!editing && !text(form.password).trim()) {
    return translate("credentialPasswordRequired");
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
    hasPassword: Boolean(value.has_password),
    hasEnablePassword: Boolean(value.has_enable_password),
    enableEnabled: Boolean(value.enable_enabled),
    connectionCount: Number(value.connection_count) || 0,
    referencingConnections,
  };
  return {
    ...row,
    searchText: [row.name, row.username, ...referencingConnections]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

export function credentialSavePayload(form = {}) {
  const password = text(form.password);
  const enablePassword = text(form.enablePassword);
  return {
    name: text(form.name).trim(),
    username: text(form.username).trim(),
    password: password.trim() ? password : null,
    enable_password: enablePassword.trim() ? enablePassword : null,
    enable_enabled: Boolean(form.enableEnabled),
  };
}

export function credentialDeleteBlockedMessage(connections = []) {
  const names = listValue(connections)
    .map((item) => text(item).trim())
    .filter(Boolean)
    .sort();
  return `该凭证仍被以下连接引用：${names.join("、")}`;
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
