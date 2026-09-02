import { formValue } from "../../../lib/events.js";

interface OrchestrationValueEvent {
  currentTarget: { value: string };
}

export type OrchestrationValueInput = Event | OrchestrationValueEvent | string;

function orchestrationInputValue(
  value: OrchestrationValueInput,
  fallback = "",
): string {
  return typeof value === "string" ? value : formValue(value, fallback);
}

export function orchestrationPatchValueChangeHandler<TPatch = string>(
  callback: ((patch: TPatch) => void) | null | undefined,
  patchFactory: (value: string) => TPatch = (value) => value as TPatch,
): (value: OrchestrationValueInput) => void {
  return (value) => {
    callback?.(patchFactory(orchestrationInputValue(value)));
  };
}
