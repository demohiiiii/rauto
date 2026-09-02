import { callIfFunction, formValue } from "../../../lib/events.js";

function orchestrationInputValue(
  value: unknown,
  fallback: unknown = "",
): unknown {
  return value && typeof value === "object" && "currentTarget" in value
    ? formValue(value, String(fallback ?? ""))
    : (value ?? fallback);
}

export function orchestrationPatchValueChangeHandler<TPatch = unknown>(
  callback: ((patch: TPatch) => unknown) | null | undefined,
  patchFactory: (value: unknown) => TPatch = (value) => value as TPatch,
): (value: unknown) => unknown {
  return (value) =>
    callIfFunction(callback, patchFactory(orchestrationInputValue(value)));
}
