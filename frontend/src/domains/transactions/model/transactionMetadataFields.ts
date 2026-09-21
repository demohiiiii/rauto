import {
  callbackMappedFormCheckedHandler,
  callbackMappedFormValueHandler,
} from "../../../lib/events.js";
import { cloneJsonValue, stringValue } from "../../../lib/jsonValue.js";
import { t } from "../../../lib/i18n.js";
import type {
  JsonObject,
  TxMetadataFieldDefinition,
  TxMetadataFieldRow,
} from "./types.js";

function cloneJsonObject(value: JsonObject | null | undefined): JsonObject {
  return value ? cloneJsonValue(value, {}) : {};
}

export function txExtraStringFieldRows(
  extra: JsonObject | null | undefined = {},
  fieldDefs: readonly TxMetadataFieldDefinition[] = [],
): TxMetadataFieldRow[] {
  const extraValue = extra ?? {};
  return fieldDefs.map((fieldDef) => {
    const fieldKey = stringValue(fieldDef?.fieldKey).trim();
    const valueText = stringValue(extraValue[fieldKey] ?? "");
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
  extra: JsonObject | null | undefined = {},
  fieldKey: string,
  value: string,
): JsonObject {
  const key = fieldKey.trim();
  if (!key) return cloneJsonObject(extra);
  return {
    ...cloneJsonObject(extra),
    [key]: value,
  };
}

export function txSetExtraStringFieldPresence(
  extra: JsonObject | null | undefined = {},
  fieldKey: string,
  enabled: boolean,
): JsonObject {
  const key = fieldKey.trim();
  const next = cloneJsonObject(extra);
  if (!key) return next;
  if (enabled) {
    if (!Object.hasOwn(next, key)) next[key] = "";
    return next;
  }
  delete next[key];
  return next;
}

export function txExtraStringValueChangeHandler<TResult>(
  callback: (value: JsonObject) => TResult,
  extraSource:
    JsonObject | null | undefined | (() => JsonObject | null | undefined),
  fieldKey: string,
  wrapResult: (extra: JsonObject) => JsonObject = (extra) => extra,
): (event: unknown) => TResult | undefined {
  return callbackMappedFormValueHandler(callback, (value) =>
    wrapResult(
      txSetExtraStringFieldValue(
        typeof extraSource === "function" ? extraSource() : extraSource,
        fieldKey,
        value,
      ),
    ),
  );
}

export function txExtraStringPresenceChangeHandler<TResult>(
  callback: (value: JsonObject) => TResult,
  extraSource:
    JsonObject | null | undefined | (() => JsonObject | null | undefined),
  fieldKey: string,
  wrapResult: (extra: JsonObject) => JsonObject = (extra) => extra,
): (event: unknown) => TResult | undefined {
  return callbackMappedFormCheckedHandler(callback, (enabled) =>
    wrapResult(
      txSetExtraStringFieldPresence(
        typeof extraSource === "function" ? extraSource() : extraSource,
        fieldKey,
        enabled,
      ),
    ),
  );
}
