import {
  cloneJsonValue,
  nullableNumberValue,
  plainObject,
  stringValue,
} from "../lib/jsonValue.js";

const cloneOrchestrationJsonValue = cloneJsonValue;
const orchestrationPlainObject = plainObject;
const orchestrationStringValue = stringValue;
const orchestrationNullableNumberValue = nullableNumberValue;

function orchestrationErrorMessage(error) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : String(error || "");
}

export function orchestrationJsonFieldValue(jsonText = "", fallback = {}) {
  const text = orchestrationStringValue(jsonText).trim();
  if (!text) return cloneOrchestrationJsonValue(fallback, {});
  return JSON.parse(text);
}

export function orchestrationJsonPatchResult(
  currentModel,
  jsonText,
  fallback,
  applyParsedValue,
) {
  try {
    return {
      error: "",
      model: applyParsedValue(orchestrationJsonFieldValue(jsonText, fallback)),
    };
  } catch (error) {
    return {
      error: orchestrationErrorMessage(error),
      model: currentModel,
    };
  }
}

export function orchestrationJsonObjectPatchResult(
  currentModel,
  jsonText,
  applyParsedValue,
) {
  return orchestrationJsonPatchResult(
    currentModel,
    jsonText,
    {},
    applyParsedValue,
  );
}

const ORCHESTRATION_CONNECTION_TEXT_FIELDS = new Set([
  "name",
  "connection",
  "host",
  "username",
  "password",
  "enablePassword",
  "sshSecurity",
  "linuxShellFlavor",
  "deviceProfile",
  "templateDir",
]);

export function orchestrationConnectionTextValue(value) {
  return value == null ? null : String(value);
}

export function orchestrationNullableTextValue(value) {
  return value || null;
}

function orchestrationNullableModeValue(value = "") {
  return value === "null" ? "null" : "value";
}

function orchestrationPresenceFlag(field) {
  return `has${field[0].toUpperCase()}${field.slice(1)}`;
}

export function orchestrationNullableFieldModePatch(
  model = {},
  field,
  mode,
  fallback = "",
) {
  const hasKey = orchestrationPresenceFlag(field);
  if (orchestrationNullableModeValue(mode) === "null") {
    return {
      [field]: null,
      [hasKey]: true,
    };
  }
  return {
    [field]:
      model?.[field] == null ? String(fallback ?? "") : String(model[field]),
    [hasKey]: true,
  };
}

export function orchestrationToggleNullableFieldPresence(
  model = {},
  field,
  enabled,
) {
  const hasKey = orchestrationPresenceFlag(field);
  return {
    ...model,
    [field]: enabled ? (model?.[field] ?? null) : null,
    [hasKey]: enabled,
  };
}

export function orchestrationToggleObjectFieldPresence(
  model = {},
  field,
  enabled,
) {
  const hasKey = orchestrationPresenceFlag(field);
  return {
    ...model,
    [field]: enabled
      ? orchestrationPlainObject(model?.[field])
        ? cloneOrchestrationJsonValue(model[field], {})
        : {}
      : {},
    [hasKey]: enabled,
  };
}

export function orchestrationToggleTargetFieldPresence(
  model = {},
  field,
  enabled,
) {
  if (field === "vars") {
    return orchestrationToggleObjectFieldPresence(model, field, enabled);
  }
  return orchestrationToggleNullableFieldPresence(model, field, enabled);
}

function orchestrationNormalizeConnectionFieldValue(fieldKey, fieldValue) {
  if (fieldKey === "port") {
    return orchestrationNullableNumberValue(fieldValue);
  }
  if (ORCHESTRATION_CONNECTION_TEXT_FIELDS.has(fieldKey)) {
    return orchestrationConnectionTextValue(fieldValue);
  }
  return fieldValue;
}

export function orchestrationNormalizeConnectionPatch(patch = {}) {
  const nextPatch = { ...patch };
  for (const [fieldKey, fieldValue] of Object.entries(nextPatch)) {
    if (fieldKey === "extra" || fieldKey === "vars") continue;
    nextPatch[fieldKey] = orchestrationNormalizeConnectionFieldValue(
      fieldKey,
      fieldValue,
    );
  }
  return nextPatch;
}

export function orchestrationObjectExtra(source, knownKeys) {
  if (!orchestrationPlainObject(source)) return {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !knownKeys.has(key))
      .map(([key, value]) => [key, cloneOrchestrationJsonValue(value)]),
  );
}

export function orchestrationTargetDefaultsModelFromJson(source = {}) {
  const value = orchestrationPlainObject(source) ? source : {};
  return {
    username: value.username ?? null,
    hasUsername: Object.hasOwn(value, "username"),
    password: value.password ?? null,
    hasPassword: Object.hasOwn(value, "password"),
    port: orchestrationNullableNumberValue(value.port),
    hasPort: Object.hasOwn(value, "port"),
    enablePassword: value.enable_password ?? null,
    hasEnablePassword: Object.hasOwn(value, "enable_password"),
    sshSecurity: value.ssh_security ?? null,
    hasSshSecurity: Object.hasOwn(value, "ssh_security"),
    linuxShellFlavor: value.linux_shell_flavor ?? null,
    hasLinuxShellFlavor: Object.hasOwn(value, "linux_shell_flavor"),
    deviceProfile: value.device_profile ?? null,
    hasDeviceProfile: Object.hasOwn(value, "device_profile"),
    templateDir: value.template_dir ?? null,
    hasTemplateDir: Object.hasOwn(value, "template_dir"),
    vars: cloneOrchestrationJsonValue(value.vars, {}),
    hasVars: Object.hasOwn(value, "vars"),
    extra: orchestrationObjectExtra(
      value,
      new Set([
        "username",
        "password",
        "port",
        "enable_password",
        "ssh_security",
        "linux_shell_flavor",
        "device_profile",
        "template_dir",
        "vars",
      ]),
    ),
  };
}

export function orchestrationTargetModelFromJson(source = {}) {
  const value = orchestrationPlainObject(source) ? source : {};
  return {
    name: value.name ?? null,
    hasName: Object.hasOwn(value, "name"),
    connection: value.connection ?? null,
    hasConnection: Object.hasOwn(value, "connection"),
    host: value.host ?? null,
    hasHost: Object.hasOwn(value, "host"),
    username: value.username ?? null,
    hasUsername: Object.hasOwn(value, "username"),
    password: value.password ?? null,
    hasPassword: Object.hasOwn(value, "password"),
    port: orchestrationNullableNumberValue(value.port),
    hasPort: Object.hasOwn(value, "port"),
    enablePassword: value.enable_password ?? null,
    hasEnablePassword: Object.hasOwn(value, "enable_password"),
    sshSecurity: value.ssh_security ?? null,
    hasSshSecurity: Object.hasOwn(value, "ssh_security"),
    linuxShellFlavor: value.linux_shell_flavor ?? null,
    hasLinuxShellFlavor: Object.hasOwn(value, "linux_shell_flavor"),
    deviceProfile: value.device_profile ?? null,
    hasDeviceProfile: Object.hasOwn(value, "device_profile"),
    templateDir: value.template_dir ?? null,
    hasTemplateDir: Object.hasOwn(value, "template_dir"),
    vars: cloneOrchestrationJsonValue(value.vars, {}),
    hasVars: Object.hasOwn(value, "vars"),
    extra: orchestrationObjectExtra(
      value,
      new Set([
        "name",
        "connection",
        "host",
        "username",
        "password",
        "port",
        "enable_password",
        "ssh_security",
        "linux_shell_flavor",
        "device_profile",
        "template_dir",
        "vars",
      ]),
    ),
  };
}

export function orchestrationTargetInputModelFromJson(source = {}) {
  if (typeof source === "string") {
    return {
      kind: "connection",
      connection: source,
      hasConnection: true,
      target: null,
    };
  }
  const value = orchestrationPlainObject(source) ? source : {};
  return {
    kind: "detailed",
    connection: null,
    hasConnection: false,
    target: orchestrationTargetModelFromJson(value),
  };
}

export function orchestrationDefaultTargetModel() {
  return orchestrationTargetModelFromJson({});
}

export function orchestrationCreateTargetInputModel(kind = "connection") {
  if (kind === "detailed") {
    return {
      kind: "detailed",
      connection: null,
      hasConnection: false,
      target: orchestrationDefaultTargetModel(),
    };
  }
  return {
    kind: "connection",
    connection: "",
    hasConnection: true,
    target: null,
  };
}

function orchestrationTargetDefaultsJsonFromModel(model = {}) {
  const result = {
    ...(orchestrationPlainObject(model.extra)
      ? cloneOrchestrationJsonValue(model.extra, {})
      : {}),
  };
  if (model.hasUsername || model.username !== null) {
    result.username = model.username ?? null;
  }
  if (model.hasPassword || model.password !== null) {
    result.password = model.password ?? null;
  }
  if (model.hasPort || model.port !== null) {
    result.port = orchestrationNullableNumberValue(model.port);
  }
  if (model.hasEnablePassword || model.enablePassword !== null) {
    result.enable_password = model.enablePassword ?? null;
  }
  if (model.hasSshSecurity || model.sshSecurity !== null) {
    result.ssh_security = model.sshSecurity ?? null;
  }
  if (model.hasLinuxShellFlavor || model.linuxShellFlavor !== null) {
    result.linux_shell_flavor = model.linuxShellFlavor ?? null;
  }
  if (model.hasDeviceProfile || model.deviceProfile !== null) {
    result.device_profile = model.deviceProfile ?? null;
  }
  if (model.hasTemplateDir || model.templateDir !== null) {
    result.template_dir = model.templateDir ?? null;
  }
  if (
    model.hasVars ||
    (orchestrationPlainObject(model.vars) && Object.keys(model.vars).length > 0)
  ) {
    result.vars = cloneOrchestrationJsonValue(model.vars, {});
  }
  return result;
}

function orchestrationTargetJsonFromModel(model = {}) {
  const result = {
    ...(orchestrationPlainObject(model.extra)
      ? cloneOrchestrationJsonValue(model.extra, {})
      : {}),
  };
  if (model.hasName || model.name !== null) result.name = model.name ?? null;
  if (model.hasConnection || model.connection !== null) {
    result.connection = model.connection ?? null;
  }
  if (model.hasHost || model.host !== null) result.host = model.host ?? null;
  if (model.hasUsername || model.username !== null) {
    result.username = model.username ?? null;
  }
  if (model.hasPassword || model.password !== null) {
    result.password = model.password ?? null;
  }
  if (model.hasPort || model.port !== null) {
    result.port = orchestrationNullableNumberValue(model.port);
  }
  if (model.hasEnablePassword || model.enablePassword !== null) {
    result.enable_password = model.enablePassword ?? null;
  }
  if (model.hasSshSecurity || model.sshSecurity !== null) {
    result.ssh_security = model.sshSecurity ?? null;
  }
  if (model.hasLinuxShellFlavor || model.linuxShellFlavor !== null) {
    result.linux_shell_flavor = model.linuxShellFlavor ?? null;
  }
  if (model.hasDeviceProfile || model.deviceProfile !== null) {
    result.device_profile = model.deviceProfile ?? null;
  }
  if (model.hasTemplateDir || model.templateDir !== null) {
    result.template_dir = model.templateDir ?? null;
  }
  if (
    model.hasVars ||
    (orchestrationPlainObject(model.vars) && Object.keys(model.vars).length > 0)
  ) {
    result.vars = cloneOrchestrationJsonValue(model.vars, {});
  }
  return result;
}

export function orchestrationTargetInputJsonFromModel(model = {}) {
  if (model.kind === "detailed") {
    return orchestrationTargetJsonFromModel(model.target || {});
  }
  return orchestrationStringValue(model.connection).trim();
}

export function orchestrationInventoryGroupModelFromJson(name, source = {}) {
  const value = Array.isArray(source)
    ? { targets: source }
    : orchestrationPlainObject(source)
      ? source
      : {};
  const defaults = orchestrationPlainObject(value.defaults)
    ? orchestrationTargetDefaultsModelFromJson(value.defaults)
    : null;
  return {
    name: orchestrationStringValue(name),
    defaults,
    hasDefaults: Object.hasOwn(value, "defaults"),
    targets: Array.isArray(value.targets)
      ? value.targets.map((target) =>
          orchestrationTargetInputModelFromJson(target),
        )
      : [],
    hasTargets: Object.hasOwn(value, "targets") || Array.isArray(source),
    useDetailed:
      !!defaults ||
      (Array.isArray(value.targets) &&
        value.targets.some((target) => typeof target !== "string")),
    extra: orchestrationObjectExtra(value, new Set(["defaults", "targets"])),
  };
}

function orchestrationInventoryGroupJsonFromModel(group = {}) {
  const targets = Array.isArray(group.targets)
    ? group.targets.map((target) =>
        orchestrationTargetInputJsonFromModel(target),
      )
    : [];
  const isSimpleTargets = targets.every((target) => typeof target === "string");
  const hasDefaults =
    group.hasDefaults ||
    (group.defaults &&
      (group.defaults.hasUsername ||
        group.defaults.hasPassword ||
        group.defaults.hasPort ||
        group.defaults.hasEnablePassword ||
        group.defaults.hasSshSecurity ||
        group.defaults.hasLinuxShellFlavor ||
        group.defaults.hasDeviceProfile ||
        group.defaults.hasTemplateDir ||
        group.defaults.hasVars));
  if (!group.useDetailed && !hasDefaults && isSimpleTargets) {
    return targets;
  }
  const result = {
    ...(orchestrationPlainObject(group.extra)
      ? cloneOrchestrationJsonValue(group.extra, {})
      : {}),
  };
  if (group.hasTargets || targets.length > 0) {
    result.targets = targets;
  }
  if (hasDefaults || group.defaults) {
    result.defaults = orchestrationTargetDefaultsJsonFromModel(
      group.defaults || {},
    );
  }
  return result;
}

export function orchestrationInventoryModelFromJson(source = {}) {
  const value = orchestrationPlainObject(source) ? source : {};
  return {
    defaults: orchestrationPlainObject(value.defaults)
      ? orchestrationTargetDefaultsModelFromJson(value.defaults)
      : null,
    hasDefaults: Object.hasOwn(value, "defaults"),
    groups: Object.entries(
      orchestrationPlainObject(value.groups) ? value.groups : {},
    ).map(([name, group]) =>
      orchestrationInventoryGroupModelFromJson(name, group),
    ),
    hasGroups: Object.hasOwn(value, "groups"),
    extra: orchestrationObjectExtra(value, new Set(["defaults", "groups"])),
  };
}

export function orchestrationInventoryJsonFromModel(model = {}) {
  const result = {
    ...(orchestrationPlainObject(model.extra)
      ? cloneOrchestrationJsonValue(model.extra, {})
      : {}),
  };
  if (
    model.hasDefaults ||
    (model.defaults &&
      (model.defaults.hasUsername ||
        model.defaults.hasPassword ||
        model.defaults.hasPort ||
        model.defaults.hasEnablePassword ||
        model.defaults.hasSshSecurity ||
        model.defaults.hasLinuxShellFlavor ||
        model.defaults.hasDeviceProfile ||
        model.defaults.hasTemplateDir ||
        model.defaults.hasVars ||
        Object.keys(model.defaults.extra || {}).length > 0))
  ) {
    result.defaults = orchestrationTargetDefaultsJsonFromModel(
      model.defaults || {},
    );
  }
  if (
    model.hasGroups ||
    (Array.isArray(model.groups) && model.groups.length > 0)
  ) {
    result.groups = Object.fromEntries(
      (Array.isArray(model.groups) ? model.groups : []).map((group) => [
        orchestrationStringValue(group.name),
        orchestrationInventoryGroupJsonFromModel(group),
      ]),
    );
  }
  return result;
}
