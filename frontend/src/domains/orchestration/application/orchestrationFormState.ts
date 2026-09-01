import { callIfFunction, formValue } from "../../../lib/events.js";

interface FormValueEvent {
  currentTarget: unknown;
}

function orchestrationInputValue(
  value: unknown,
  fallback: unknown = "",
): unknown {
  return value && typeof value === "object" && "currentTarget" in value
    ? (formValue as (event: FormValueEvent, fallbackValue: unknown) => unknown)(
        value as FormValueEvent,
        fallback,
      )
    : (value ?? fallback);
}

export function orchestrationPatchValueChangeHandler<TPatch = unknown>(
  callback: ((patch: TPatch) => unknown) | null | undefined,
  patchFactory: (value: unknown) => TPatch = (value) => value as TPatch,
): (value: unknown) => unknown {
  return (value) =>
    (
      callIfFunction as (
        handler: ((patch: TPatch) => unknown) | null | undefined,
        patch: TPatch,
      ) => unknown
    )(callback, patchFactory(orchestrationInputValue(value)));
}
