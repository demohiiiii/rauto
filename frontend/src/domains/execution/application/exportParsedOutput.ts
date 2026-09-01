import { t } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import { executionResultApi } from "../infrastructure/executionResultApi.js";
import { executionResultRuntime } from "../infrastructure/executionResultRuntime.js";
import { parsedOutputItemCanExport } from "../model/executionResult.js";
import type {
  ExportParsedOutputConfig,
  ParsedOutputSheet,
} from "../model/types.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function filenamePart(rawFilenamePart: unknown): string {
  return safeString(rawFilenamePart || "")
    .trim()
    .replace(/[\\/:*?"<>|\[\]\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function excelExportTimestamp(date = new Date()): string {
  const pad = (datePart: number) => String(datePart).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function timestampedExcelFilename(rawFilename: unknown): string {
  const filename = safeString(
    rawFilename || "textfsm-parsed-output.xlsx",
  ).trim();
  const normalized = filename || "textfsm-parsed-output.xlsx";
  const timestamp = excelExportTimestamp();
  return /\.xlsx$/i.test(normalized)
    ? normalized.replace(/\.xlsx$/i, `-${timestamp}.xlsx`)
    : `${normalized}-${timestamp}.xlsx`;
}

function exportFilenameForParsedOutput(item: Record<string, unknown>): string {
  const explicitDevice = safeString(
    item.device || item.target || item.connection_name || item.host || "",
  ).trim();
  const device = filenamePart(
    explicitDevice || executionResultRuntime.deviceName(),
  );
  const command = filenamePart(item.command || "parsed_output");
  const base = [device, command].filter(Boolean).join("-");
  return timestampedExcelFilename(`${base || "textfsm-parsed-output"}.xlsx`);
}

function exportSheetNameForParsedOutput(item: Record<string, unknown>): string {
  const command = safeString(item.command || "").trim();
  return command || "parsed_output";
}

function normalizeParsedOutputSheets(sheets: unknown): ParsedOutputSheet[] {
  return (Array.isArray(sheets) ? sheets : [])
    .map((sheet, index) => {
      const fields = record(sheet);
      return {
        name: safeString(fields.name || `parsed_output_${index + 1}`).trim(),
        parsed_output: fields.parsed_output,
      };
    })
    .filter((sheet) => sheet.parsed_output != null);
}

async function exportParsedOutputPayloadExcel(
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { blob, filename } = await executionResultApi.exportExcel(payload);
    const requestedFilename =
      typeof payload.filename === "string" ? payload.filename : "";
    executionResultRuntime.download(
      blob,
      filename || requestedFilename || "textfsm.xlsx",
    );
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? error.message
        : t("requestFailed");
    await executionResultRuntime.notifyError(message || t("requestFailed"));
  }
}

export async function exportParsedOutputItemExcel(
  parsedOutputItem: unknown,
): Promise<void> {
  if (!parsedOutputItemCanExport(parsedOutputItem)) return;
  const item = record(parsedOutputItem);
  await exportParsedOutputPayloadExcel({
    filename: exportFilenameForParsedOutput(item),
    sheet_name: exportSheetNameForParsedOutput(item),
    parsed_output: item.parsed_output,
  });
}

export async function exportParsedOutputSheetsExcel(
  sheets: unknown,
  exportConfig: ExportParsedOutputConfig = {},
): Promise<void> {
  const normalizedSheets = normalizeParsedOutputSheets(sheets);
  if (!normalizedSheets.length) return;
  await exportParsedOutputPayloadExcel({
    filename: timestampedExcelFilename(
      exportConfig.filename || "textfsm-parsed-output.xlsx",
    ),
    sheets: normalizedSheets,
  });
}
