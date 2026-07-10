import {
  callbackMappedFormCheckedHandler,
  callbackMappedFormValueHandler,
} from "../lib/events.js";
import { cloneJsonValue, plainObject, stringValue } from "../lib/jsonValue.js";
import { t } from "../lib/i18n.js";

const cloneTxJsonValue = cloneJsonValue;
const txPlainObject = plainObject;
const txStringValue = stringValue;

export function txExtraStringFieldRows(extra = {}, fieldDefs = []) {
  const extraValue = txPlainObject(extra) ? extra : {};
  return (Array.isArray(fieldDefs) ? fieldDefs : []).map((fieldDef) => {
    const fieldKey = txStringValue(fieldDef?.fieldKey).trim();
    const valueText = txStringValue(extraValue[fieldKey] ?? "");
    return {
      ...fieldDef,
      enabled: Object.hasOwn(extraValue, fieldKey) || !!valueText,
      labelText: fieldDef?.labelKey ? t(fieldDef.labelKey) : fieldKey,
      placeholderText: fieldDef?.placeholderKey
        ? t(fieldDef.placeholderKey)
        : "",
      showPresenceToggle: fieldDef?.showPresenceToggle !== false,
      valueText,
    };
  });
}

export function txSetExtraStringFieldValue(extra = {}, fieldKey, value) {
  const key = txStringValue(fieldKey).trim();
  if (!key) return txPlainObject(extra) ? cloneTxJsonValue(extra, {}) : {};
  return {
    ...(txPlainObject(extra) ? cloneTxJsonValue(extra, {}) : {}),
    [key]: txStringValue(value),
  };
}

export function txSetExtraStringFieldPresence(extra = {}, fieldKey, enabled) {
  const key = txStringValue(fieldKey).trim();
  const next = txPlainObject(extra) ? cloneTxJsonValue(extra, {}) : {};
  if (!key) return next;
  if (enabled) {
    if (!Object.hasOwn(next, key)) next[key] = "";
    return next;
  }
  delete next[key];
  return next;
}

export function txExtraStringValueChangeHandler(
  callback,
  extraSource,
  fieldKey,
  wrapResult = (extra) => extra,
) {
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

export function txExtraStringPresenceChangeHandler(
  callback,
  extraSource,
  fieldKey,
  wrapResult = (extra) => extra,
) {
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
