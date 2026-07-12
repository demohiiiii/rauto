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

function jsonLocationFromOffset(text, offset) {
  const precedingText = text.slice(0, offset);
  const lines = precedingText.split(/\r\n|\r|\n/);
  return {
    line: lines.length,
    column: lines.at(-1).length + 1,
  };
}

function unescapeJsonErrorContext(value) {
  return value.replace(/\\(n|r|t|"|'|\\)/g, (_, escaped) => {
    if (escaped === "n") return "\n";
    if (escaped === "r") return "\r";
    if (escaped === "t") return "\t";
    return escaped;
  });
}

function jsonErrorContextVariants(message, contextStart) {
  const contextMatch = message
    .slice(contextStart)
    .match(/^\s*([\s\S]*?)\s+is not valid JSON\s*$/i);
  if (!contextMatch) return [];

  const variants = [];
  const pending = [contextMatch[1].trim()];
  while (pending.length > 0) {
    const value = pending.shift();
    if (!value || variants.includes(value)) continue;
    variants.push(value);

    const withoutLeadingEllipsis = value
      .replace(/^(?:\.\.\.|…)/, "")
      .trimStart();
    if (withoutLeadingEllipsis !== value) {
      pending.push(withoutLeadingEllipsis);
    }
    const withoutTrailingEllipsis = value
      .replace(/(?:\.\.\.|…)$/, "")
      .trimEnd();
    if (withoutTrailingEllipsis !== value) {
      pending.push(withoutTrailingEllipsis);
    }
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      pending.push(value.slice(1, -1));
    }
    const unescaped = unescapeJsonErrorContext(value);
    if (unescaped !== value) pending.push(unescaped);
  }
  return variants.sort((left, right) => right.length - left.length);
}

function jsonContextErrorOffset(jsonText, message) {
  const tokenMatch = message.match(
    /Unexpected token\s+(?:'((?:\\.|[^'])*)'|"((?:\\.|[^"])*)"|(\S+?))(?:,|\s)/i,
  );
  if (!tokenMatch) return null;
  const token = unescapeJsonErrorContext(
    tokenMatch[1] ?? tokenMatch[2] ?? tokenMatch[3] ?? "",
  );
  if (!token) return null;

  const contextStart = tokenMatch.index + tokenMatch[0].length;
  const candidateOffsets = new Set();
  for (const context of jsonErrorContextVariants(message, contextStart)) {
    const contextOffset = jsonText.indexOf(context);
    if (contextOffset < 0 || contextOffset !== jsonText.lastIndexOf(context)) {
      continue;
    }
    const tokenOffset = context.indexOf(token);
    if (tokenOffset < 0 || tokenOffset !== context.lastIndexOf(token)) continue;
    candidateOffsets.add(contextOffset + tokenOffset);
  }
  return candidateOffsets.size === 1
    ? candidateOffsets.values().next().value
    : null;
}

export function jsonParseErrorDetail(jsonText = "", error = null) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error || "");
  const explicitLocation = message.match(
    /line\s+(\d+)(?:\s*,)?\s+column\s+(\d+)/i,
  );
  if (explicitLocation) {
    return {
      message,
      line: Number(explicitLocation[1]),
      column: Number(explicitLocation[2]),
    };
  }

  const positionMatch = message.match(/(?:at\s+)?position\s+(\d+)/i);
  if (positionMatch) {
    const text = typeof jsonText === "string" ? jsonText : "";
    const position = Math.min(Number(positionMatch[1]), text.length);
    const location = jsonLocationFromOffset(text, position);
    return {
      message,
      ...location,
    };
  }

  const text = typeof jsonText === "string" ? jsonText : "";
  const contextOffset = jsonContextErrorOffset(text, message);
  if (contextOffset !== null) {
    return { message, ...jsonLocationFromOffset(text, contextOffset) };
  }

  return { message, line: null, column: null };
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
