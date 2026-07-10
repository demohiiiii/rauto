const JSON_VALUE_TYPE_ROWS = Object.freeze([
  "string",
  "number",
  "boolean",
  "null",
  "json",
]);

export function cloneJsonValue(value, fallback = null) {
  if (value === undefined) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return fallback;
  }
}

export function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

export function stringValue(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function nullableNumberValue(value) {
  return value === null || value === undefined || value === ""
    ? null
    : Number(value);
}

export function jsonValueType(value) {
  if (value === null) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") return "string";
  return "json";
}

export function jsonValueText(value) {
  const type = jsonValueType(value);
  if (type === "json") return JSON.stringify(value ?? {}, null, 2);
  if (type === "null") return "";
  return String(value);
}

export function jsonValueFromText(typeValue = "string", textValue = "") {
  const type = JSON_VALUE_TYPE_ROWS.includes(typeValue) ? typeValue : "string";
  const text = stringValue(textValue);
  const trimmed = text.trim();
  if (type === "null") return null;
  if (type === "number") {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : text;
  }
  if (type === "boolean") {
    const lowered = trimmed.toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(lowered)) return true;
    if (["false", "0", "no", "n", "off"].includes(lowered)) return false;
    return text;
  }
  if (type === "json") {
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch (_) {
      return text;
    }
  }
  return text;
}
