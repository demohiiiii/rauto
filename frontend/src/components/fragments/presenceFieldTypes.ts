import type { HTMLInputAttributes } from "svelte/elements";
import type { SelectOptionRow } from "../../lib/ui.js";

export interface PresenceFieldValueEvent {
  currentTarget: { value: string };
  target: { value: string };
}

type NativeInputEvent = Parameters<
  NonNullable<HTMLInputAttributes["oninput"]>
>[0];

export type PresenceFieldValueInput =
  | NativeInputEvent
  | PresenceFieldValueEvent
  | string;

export interface PresenceFieldRow {
  controlClass?: string;
  controlType?: "input" | "mode-expression" | "select";
  enabled: boolean;
  errorText?: string;
  fieldKey: string;
  inputType?: HTMLInputAttributes["type"];
  labelText: string;
  nullableModeRows?: SelectOptionRow[];
  nullableModeValue?: string;
  optionRows?: SelectOptionRow[];
  optionValues?: string[];
  placeholderText?: string;
  showNullableModeSelect?: boolean;
  showPresenceToggle?: boolean;
  valueText: string;
}

export type PresenceFieldValueHandler = (
  input: PresenceFieldValueInput,
) => void;
export type PresenceFieldPresenceHandler = (enabled: boolean) => void;
export type PresenceFieldValueHandlerForKey = (
  fieldKey: string,
) => PresenceFieldValueHandler | null | undefined;
export type PresenceFieldPresenceHandlerForKey = (
  fieldKey: string,
) => PresenceFieldPresenceHandler | null | undefined;
