import {
  cloneJsonValue,
  plainObject,
  stringValue,
} from "../../lib/jsonValue.js";

const cloneOrchestrationJsonValue = cloneJsonValue;
const orchestrationPlainObject = plainObject;
const orchestrationStringValue = stringValue;

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

export function orchestrationObjectExtra(source, knownKeys) {
  if (!orchestrationPlainObject(source)) return {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !knownKeys.has(key))
      .map(([key, value]) => [key, cloneOrchestrationJsonValue(value)]),
  );
}
