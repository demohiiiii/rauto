import { safeString } from "../../../lib/ui.js";
import type { ParsedOutputSheet, ParsedOutputSheetConfig } from "./types.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function executionResultFailed(result: unknown = {}): boolean {
  const fields = record(result);
  const executionResponse = record(fields.execution_response);
  if (typeof executionResponse.success === "boolean") {
    return !executionResponse.success;
  }
  const resultSummary = record(fields.result_summary);
  if (
    fields.error ||
    fields.success === false ||
    resultSummary.success === false
  ) {
    return true;
  }
  if (fields.exit_code == null || fields.exit_code === "") return false;
  const exitCode = Number(fields.exit_code);
  return Number.isFinite(exitCode) && exitCode !== 0;
}

export function executionResultOutputText(
  result: unknown = {},
  outputField = "output",
  { preferTranscript = true }: { preferTranscript?: boolean } = {},
): string {
  const fields = record(result);
  if (!preferTranscript) {
    if (fields[outputField] != null) {
      return safeString(fields[outputField]);
    }
    return safeString(fields.error || fields.all);
  }
  return safeString(fields.all || fields[outputField] || fields.error);
}

export function parsedOutputItemCanExport(item: unknown): boolean {
  return record(item).parsed_output != null;
}

export function parsedOutputSheetsFromParsedOutputItems(
  parsedOutputItems: unknown,
  sheetConfig: ParsedOutputSheetConfig = {},
): ParsedOutputSheet[] {
  return (Array.isArray(parsedOutputItems) ? parsedOutputItems : [])
    .map((item, index): ParsedOutputSheet | null => {
      if (!parsedOutputItemCanExport(item)) return null;
      const fields = record(item);
      const sheetName = sheetConfig.sheetName
        ? sheetConfig.sheetName(fields, index)
        : fields.object || fields.command || `parsed_output_${index + 1}`;
      return {
        name: safeString(sheetName || `parsed_output_${index + 1}`),
        parsed_output: fields.parsed_output,
      };
    })
    .filter((sheet): sheet is ParsedOutputSheet => sheet !== null);
}

export function parsedOutputSheetsFromBatchShow(
  batchShowPayload: unknown,
): ParsedOutputSheet[] {
  const payload = record(batchShowPayload);
  const parsedRowsByObject = new Map<string, Record<string, unknown>[]>();
  const results = Array.isArray(payload.results) ? payload.results : [];
  for (const rawResult of results) {
    const result = record(rawResult);
    const parsedRows = Array.isArray(result.parsed_output)
      ? result.parsed_output
      : [];
    for (const parsedRow of parsedRows) {
      if (
        !parsedRow ||
        typeof parsedRow !== "object" ||
        Array.isArray(parsedRow)
      ) {
        continue;
      }
      const enrichedParsedRow = {
        ...(parsedRow as Record<string, unknown>),
      };
      for (const [metadataKey, metadataValue] of [
        ["device", result.target],
        ["profile", result.profile],
        ["command", result.command],
        ["object", result.object],
      ] as const) {
        if (Object.hasOwn(enrichedParsedRow, metadataKey)) {
          enrichedParsedRow[`parsed_${metadataKey}`] =
            enrichedParsedRow[metadataKey];
        }
        enrichedParsedRow[metadataKey] = metadataValue || "";
      }
      const showObject = safeString(result.object || payload.object || "show");
      const rows = parsedRowsByObject.get(showObject) ?? [];
      rows.push(enrichedParsedRow);
      parsedRowsByObject.set(showObject, rows);
    }
  }
  return Array.from(parsedRowsByObject.entries()).map(
    ([name, parsedOutputRows]) => ({
      name,
      parsed_output: parsedOutputRows,
    }),
  );
}
