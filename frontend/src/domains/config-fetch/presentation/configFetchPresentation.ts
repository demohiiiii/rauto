import type {
  ConfigFetchContentView,
  ConfigFetchDownloadDescriptor,
  ConfigFetchResultRow,
} from "../model/types.js";

export const CONFIG_FETCH_CONTENT_VIEW = Object.freeze({
  normalized: "normalized" as const,
  raw: "raw" as const,
});

function safeString(value: unknown): string {
  return value == null ? "" : String(value);
}

export function configFetchContent(
  row: ConfigFetchResultRow = {},
  view: ConfigFetchContentView = CONFIG_FETCH_CONTENT_VIEW.raw,
  errorOutput: (row: ConfigFetchResultRow, field: string) => string = (
    result,
    field,
  ) => safeString(result.all || result[field] || result.error),
): string {
  if (row.error) return errorOutput(row, "content");
  if (
    view === CONFIG_FETCH_CONTENT_VIEW.normalized &&
    typeof row.normalized_content === "string"
  ) {
    return row.normalized_content;
  }
  return typeof row.content === "string" ? row.content : "";
}

function filenamePart(value: unknown, fallback: string): string {
  const part = safeString(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[_\s.-]+|[_\s.-]+$/g, "");
  return part || fallback;
}

function filenameTimestamp(value: unknown): string {
  const timestamp = Date.parse(safeString(value));
  if (!Number.isFinite(timestamp)) return "";
  return new Date(timestamp)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function configFetchDownloadDescriptor(
  row: ConfigFetchResultRow = {},
  view: ConfigFetchContentView = CONFIG_FETCH_CONTENT_VIEW.raw,
): ConfigFetchDownloadDescriptor | null {
  const normalized = view === CONFIG_FETCH_CONTENT_VIEW.normalized;
  const content = normalized ? row.normalized_content : row.content;
  if (row.error || typeof content !== "string") return null;
  const target = filenamePart(row.target, "device");
  const kind = filenamePart(row.kind, "config");
  const timestamp = filenameTimestamp(row.fetched_at);
  return {
    content,
    filename:
      [
        target,
        kind,
        ...(normalized ? ["normalized"] : []),
        ...(timestamp ? [timestamp] : []),
      ].join("_") + ".cfg",
  };
}

export function configFetchTimestamp(value: unknown): string {
  const timestamp = Date.parse(safeString(value));
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleString()
    : "-";
}
