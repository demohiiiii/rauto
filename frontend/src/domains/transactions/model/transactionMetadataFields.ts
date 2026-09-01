import {
  callbackMappedFormCheckedHandler,
  callbackMappedFormValueHandler,
} from "../../../lib/events.js";
import {
  cloneJsonValue,
  plainObject,
  stringValue,
} from "../../../lib/jsonValue.js";
import { t } from "../../../lib/i18n.js";
import type {
  JsonObject,
  TxMetadataFieldDefinition,
  TxMetadataFieldRow,
} from "./types.js";

const cloneTxJsonValue = cloneJsonValue as unknown as (
  value: unknown,
  fallback: JsonObject,
) => unknown;
const txPlainObject = plainObject;
const txStringValue = stringValue;

function cloneJsonObject(value: unknown): JsonObject {
  return txPlainObject(value)
    ? (cloneTxJsonValue(value, {}) as JsonObject)
    : {};
}

export function txExtraStringFieldRows(
  extra: unknown = {},
  fieldDefs: readonly TxMetadataFieldDefinition[] = [],
): TxMetadataFieldRow[] {
  const extraValue = txPlainObject(extra) ? (extra as JsonObject) : {};
  return fieldDefs.map((fieldDef) => {
    const fieldKey = txStringValue(fieldDef?.fieldKey).trim();
    const valueText = txStringValue(extraValue[fieldKey] ?? "");
    return {
      ...fieldDef,
      enabled: Object.hasOwn(extraValue, fieldKey) || !!valueText,
      fieldKey,
      labelText: fieldDef?.labelKey ? t(fieldDef.labelKey) : fieldKey,
      placeholderText: fieldDef?.placeholderKey
        ? t(fieldDef.placeholderKey)
        : "",
      showPresenceToggle: fieldDef?.showPresenceToggle !== false,
      valueText,
    };
  });
}

export function txSetExtraStringFieldValue(
  extra: unknown = {},
  fieldKey: unknown,
  value: unknown,
): JsonObject {
  const key = txStringValue(fieldKey).trim();
  if (!key) return cloneJsonObject(extra);
  return {
    ...cloneJsonObject(extra),
    [key]: txStringValue(value),
  };
}

export function txSetExtraStringFieldPresence(
  extra: unknown = {},
  fieldKey: unknown,
  enabled: unknown,
): JsonObject {
  const key = txStringValue(fieldKey).trim();
  const next = cloneJsonObject(extra);
  if (!key) return next;
  if (enabled) {
    if (!Object.hasOwn(next, key)) next[key] = "";
    return next;
  }
  delete next[key];
  return next;
}

export function txExtraStringValueChangeHandler(
  callback: (value: unknown) => unknown,
  extraSource: unknown | (() => unknown),
  fieldKey: unknown,
  wrapResult: (extra: JsonObject) => unknown = (extra) => extra,
): (event: Event) => unknown {
  return callbackMappedFormValueHandler(callback, (value: unknown) =>
    wrapResult(
      txSetExtraStringFieldValue(
        typeof extraSource === "function" ? extraSource() : extraSource,
        fieldKey,
        value,
      ),
    ),
  );
}

export function txExtraStringPresenceChangeHandler(
  callback: (value: unknown) => unknown,
  extraSource: unknown | (() => unknown),
  fieldKey: unknown,
  wrapResult: (extra: JsonObject) => unknown = (extra) => extra,
): (event: Event) => unknown {
  return callbackMappedFormCheckedHandler(callback, (enabled: boolean) =>
    wrapResult(
      txSetExtraStringFieldPresence(
        typeof extraSource === "function" ? extraSource() : extraSource,
        fieldKey,
        enabled,
      ),
    ),
  );
}
