export function stringifyValue(value, fallback = "") {
  if (value == null) {
    return fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch (_) {
    return String(value);
  }
}

export function safeString(value) {
  return stringifyValue(value, "-");
}

export function emptyString(value) {
  return stringifyValue(value, "");
}

export function escapeHtml(value, fallback = "") {
  return stringifyValue(value, fallback)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
