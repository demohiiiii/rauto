import {
  cloneJsonValue,
  jsonValueFromText,
  jsonValueText,
  jsonValueType,
  plainObject,
  stringValue,
} from "./jsonValue.js";

function objectEntryRows(source = {}) {
  const value = plainObject(source) ? source : {};
  return Object.entries(value).map(([key, entryValue]) => ({
    keyText: String(key),
    typeValue: jsonValueType(entryValue),
    valueText: jsonValueText(entryValue),
  }));
}

export function valueEditorPresentation(typeValue = "string", valueText = "") {
  const resolvedTypeValue = stringValue(typeValue, "string");
  const resolvedValueText = stringValue(valueText);
  const lineCount = resolvedValueText
    ? resolvedValueText.split("\n").length
    : 1;
  const showTextarea = resolvedTypeValue === "json";
  let objectSource = null;
  if (showTextarea && resolvedValueText.trim()) {
    try {
      const parsedValue = JSON.parse(resolvedValueText);
      objectSource = plainObject(parsedValue) ? parsedValue : null;
    } catch (_) {
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

function nextObjectFieldKey(source = {}, prefix = "field") {
  const value = plainObject(source) ? source : {};
  let index = 1;
  while (Object.hasOwn(value, `${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

export function objectFieldRows(source = {}) {
  return objectEntryRows(source);
}

export function objectFieldEditorPresentation(fieldRow = {}) {
  const row = plainObject(fieldRow) ? fieldRow : {};
  return valueEditorPresentation(row.typeValue, row.valueText);
}

export function addObjectField(source = {}, prefix = "field") {
  const value = plainObject(source) ? source : {};
  return {
    ...cloneJsonValue(value, {}),
    [nextObjectFieldKey(value, prefix)]: "",
  };
}

export function renameObjectField(source = {}, oldKey = "", newKey = "") {
  const value = plainObject(source) ? cloneJsonValue(source, {}) : {};
  const nextKey = stringValue(newKey).trim();
  const currentValue = value[oldKey];
  delete value[oldKey];
  if (nextKey) value[nextKey] = currentValue;
  return value;
}

export function updateObjectField(source = {}, key = "", patch = {}) {
  const value = plainObject(source) ? cloneJsonValue(source, {}) : {};
  const currentValue = value[key];
  value[key] = jsonValueFromText(
    patch.typeValue || jsonValueType(currentValue),
    Object.hasOwn(patch, "valueText")
      ? patch.valueText
      : jsonValueText(currentValue),
  );
  return value;
}

export function removeObjectField(source = {}, key = "") {
  const value = plainObject(source) ? cloneJsonValue(source, {}) : {};
  delete value[key];
  return value;
}

export const txObjectFieldRows = objectFieldRows;
export const txAddObjectField = addObjectField;
export const txRenameObjectField = renameObjectField;
export const txUpdateObjectField = updateObjectField;
export const txRemoveObjectField = removeObjectField;
