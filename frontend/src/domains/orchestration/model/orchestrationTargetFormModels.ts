import {
  cloneJsonValue,
  plainObject,
  stringValue,
} from "../../../lib/jsonValue.js";
import type { JsonObject, OrchestrationJsonPatchResult } from "./types.js";

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
  jsonText: unknown = "",
  fallback: unknown = {},
): unknown {
  const text = orchestrationStringValue(jsonText).trim();
  if (!text) return cloneOrchestrationJsonValue(fallback, {});
  return JSON.parse(text);
}

export function orchestrationJsonPatchResult<TModel>(
  currentModel: TModel,
  jsonText: unknown,
  fallback: unknown,
  applyParsedValue: (parsedValue: unknown) => TModel,
): OrchestrationJsonPatchResult<TModel>;
export function orchestrationJsonPatchResult(
  currentModel: unknown,
  jsonText: unknown,
  fallback: unknown,
  applyParsedValue: (parsedValue: unknown) => unknown,
): OrchestrationJsonPatchResult<unknown> {
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
  source: unknown,
  knownKeys: ReadonlySet<string>,
): JsonObject {
  if (!orchestrationPlainObject(source)) return {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !knownKeys.has(key))
      .map(([key, value]) => [key, cloneOrchestrationJsonValue(value)]),
  );
}
