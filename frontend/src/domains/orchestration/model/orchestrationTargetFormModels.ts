import {
  cloneJsonValue,
  plainObject,
  stringValue,
} from "../../../lib/jsonValue.js";
import type {
  JsonObject,
  OrchestrationJsonPatchResult,
  OrchestrationJsonValue,
} from "./types.js";

const cloneOrchestrationJsonValue = <T>(
  value: unknown,
  fallback: T = null as T,
): T =>
  (cloneJsonValue as (source: unknown, fallbackValue: unknown) => unknown)(
    value,
    fallback,
  ) as T;
const orchestrationPlainObject = (value: unknown): value is JsonObject =>
  plainObject(value) === true;
const orchestrationStringValue = (value: unknown, fallback = ""): string =>
  stringValue(value, fallback);

function orchestrationErrorMessage(error: unknown): string {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : String(error || "");
}

export function orchestrationJsonFieldValue(
  jsonText = "",
  fallback: OrchestrationJsonValue = {},
): OrchestrationJsonValue {
  const text = orchestrationStringValue(jsonText).trim();
  if (!text) {
    return cloneOrchestrationJsonValue<OrchestrationJsonValue>(fallback, {});
  }
  return JSON.parse(text) as OrchestrationJsonValue;
}

export function orchestrationJsonPatchResult<TModel>(
  currentModel: TModel,
  jsonText: string,
  fallback: OrchestrationJsonValue,
  applyParsedValue: (parsedValue: OrchestrationJsonValue) => TModel,
): OrchestrationJsonPatchResult<TModel> {
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

export function orchestrationConnectionTextValue(
  value: unknown,
): string | null {
  return value == null ? null : String(value);
}

export function orchestrationObjectExtra(
  source: JsonObject,
  knownKeys: ReadonlySet<string>,
): JsonObject {
  if (!orchestrationPlainObject(source)) return {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !knownKeys.has(key))
      .map(([key, value]) => [key, cloneOrchestrationJsonValue(value)]),
  );
}
