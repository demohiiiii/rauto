import {
  cloneJsonValue,
  jsonValueFromText,
  jsonValueText,
  jsonValueType,
  plainObject,
  stringValue,
} from "./jsonValue.js";
import type { JsonValueType, PlainObject } from "./jsonValue.js";

export interface ObjectFieldRow {
  keyText: string;
  typeValue: JsonValueType;
  valueText: string;
}

export interface ValueEditorPresentation {
  disabled: boolean;
  editorKind: "input" | "textarea";
  objectSource: PlainObject | null;
  rows: number;
  showObjectEditor: boolean;
  typeValue: string;
  valueText: string;
}

export interface ObjectFieldPatch {
  typeValue?: unknown;
  valueText?: unknown;
}

function objectEntryRows(source: unknown = {}): ObjectFieldRow[] {
  const value = plainObject(source) ? source : {};
  return Object.entries(value).map(([key, entryValue]) => ({
    keyText: String(key),
    typeValue: jsonValueType(entryValue),
    valueText: jsonValueText(entryValue),
  }));
}

export function valueEditorPresentation(
  typeValue: unknown = "string",
  valueText: unknown = "",
): ValueEditorPresentation {
  const resolvedTypeValue = stringValue(typeValue, "string");
  const resolvedValueText = stringValue(valueText);
  const lineCount = resolvedValueText
    ? resolvedValueText.split("\n").length
    : 1;
  const showTextarea = resolvedTypeValue === "json";
  let objectSource: PlainObject | null = null;
  if (showTextarea && resolvedValueText.trim()) {
    try {
      const parsedValue = JSON.parse(resolvedValueText);
      objectSource = plainObject(parsedValue) ? parsedValue : null;
    } catch {
      objectSource = null;
    }
  }
  return {
    disabled: resolvedTypeValue === "null",
    editorKind: showTextarea ? "textarea" : "input",
    objectSource,
    rows: showTextarea ? Math.max(4, Math.min(12, lineCount + 1)) : 1,
    showObjectEditor: objectSource !== null,
    typeValue: resolvedTypeValue,
    valueText: resolvedValueText,
  };
}

function nextObjectFieldKey(source: unknown = {}, prefix = "field"): string {
  const value = plainObject(source) ? source : {};
  let index = 1;
  while (Object.hasOwn(value, `${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

export function objectFieldRows(source: unknown = {}): ObjectFieldRow[] {
  return objectEntryRows(source);
}

export function objectFieldEditorPresentation(
  fieldRow: unknown = {},
): ValueEditorPresentation {
  const row = plainObject(fieldRow) ? fieldRow : {};
  return valueEditorPresentation(row.typeValue, row.valueText);
}

export function addObjectField(
  source: unknown = {},
  prefix = "field",
): PlainObject {
  const value = plainObject(source) ? source : {};
  return {
    ...cloneJsonValue(value, {}),
    [nextObjectFieldKey(value, prefix)]: "",
  };
}

export function renameObjectField(
  source: unknown = {},
  oldKey = "",
  newKey: unknown = "",
): PlainObject {
  const value: PlainObject = plainObject(source)
    ? cloneJsonValue(source, {})
    : {};
  const nextKey = stringValue(newKey).trim();
  const currentValue = value[oldKey];
  delete value[oldKey];
  if (nextKey) value[nextKey] = currentValue;
  return value;
}

export function updateObjectField(
  source: unknown = {},
  key = "",
  patch: ObjectFieldPatch = {},
): PlainObject {
  const value: PlainObject = plainObject(source)
    ? cloneJsonValue(source, {})
    : {};
  const currentValue = value[key];
  value[key] = jsonValueFromText(
    patch.typeValue || jsonValueType(currentValue),
    Object.hasOwn(patch, "valueText")
      ? patch.valueText
      : jsonValueText(currentValue),
  );
  return value;
}

export function removeObjectField(source: unknown = {}, key = ""): PlainObject {
  const value: PlainObject = plainObject(source)
    ? cloneJsonValue(source, {})
    : {};
  delete value[key];
  return value;
}

export const txObjectFieldRows = objectFieldRows;
export const txAddObjectField = addObjectField;
export const txRenameObjectField = renameObjectField;
export const txUpdateObjectField = updateObjectField;
export const txRemoveObjectField = removeObjectField;
