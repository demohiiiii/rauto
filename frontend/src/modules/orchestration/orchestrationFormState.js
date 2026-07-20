import { callIfFunction, formValue } from "../../lib/events.js";

function orchestrationInputValue(value, fallback = "") {
  return value && typeof value === "object" && "currentTarget" in value
    ? formValue(value, fallback)
    : (value ?? fallback);
}

export function orchestrationPatchValueChangeHandler(
  callback,
  patchFactory = (value) => value,
) {
  return (value) =>
    callIfFunction(callback, patchFactory(orchestrationInputValue(value)));
}
