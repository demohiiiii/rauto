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

export function orchestrationConnectionTextValue(value) {
  return value == null ? null : String(value);
}

export function orchestrationObjectExtra(source, knownKeys) {
  if (!orchestrationPlainObject(source)) return {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !knownKeys.has(key))
      .map(([key, value]) => [key, cloneOrchestrationJsonValue(value)]),
  );
}
