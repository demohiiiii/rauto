import { exportTextfsmExcel } from "../../api/client.js";
import { t } from "../../lib/i18n.js";
import { downloadBlob, safeString } from "../../lib/ui.js";
import {
  activeConnectionTarget,
  currentTemporaryConnectionDetails,
} from "../connections/connections.js";

export function parsedOutputSheetsFromParsedOutputItems(
  parsedOutputItems,
  sheetConfig = {},
) {
  return (Array.isArray(parsedOutputItems) ? parsedOutputItems : [])
    .map((parsedOutputItem, index) => {
      if (!parsedOutputItemCanExport(parsedOutputItem)) {
        return null;
      }
      const sheetName =
        typeof sheetConfig.sheetName === "function"
          ? sheetConfig.sheetName(parsedOutputItem, index)
          : parsedOutputItem.object ||
            parsedOutputItem.command ||
            `parsed_output_${index + 1}`;
      return {
        name: safeString(sheetName || `parsed_output_${index + 1}`),
        parsed_output: parsedOutputItem.parsed_output,
      };
    })
    .filter(Boolean);
}

export function parsedOutputSheetsFromBatchShow(batchShowPayload) {
  const parsedRowsByObject = new Map();
  (Array.isArray(batchShowPayload?.results)
    ? batchShowPayload.results
    : []
  ).forEach((batchShowResult) => {
    const parsedOutputRows = Array.isArray(batchShowResult?.parsed_output)
      ? batchShowResult.parsed_output
      : [];
    parsedOutputRows.forEach((parsedRow) => {
      if (
        !parsedRow ||
        typeof parsedRow !== "object" ||
        Array.isArray(parsedRow)
      ) {
        return;
      }
      const enrichedParsedRow = { ...parsedRow };
      [
        ["device", batchShowResult.target],
        ["profile", batchShowResult.profile],
        ["command", batchShowResult.command],
        ["object", batchShowResult.object],
      ].forEach(([metadataKey, metadataValue]) => {
        if (
          Object.prototype.hasOwnProperty.call(enrichedParsedRow, metadataKey)
        ) {
          enrichedParsedRow[`parsed_${metadataKey}`] =
            enrichedParsedRow[metadataKey];
        }
        enrichedParsedRow[metadataKey] = metadataValue || "";
      });
      const showObject =
        batchShowResult.object || batchShowPayload?.object || "show";
      if (!parsedRowsByObject.has(showObject)) {
        parsedRowsByObject.set(showObject, []);
      }
      parsedRowsByObject.get(showObject).push(enrichedParsedRow);
    });
  });
  return Array.from(parsedRowsByObject.entries()).map(
    ([sheetName, parsedOutputRows]) => ({
      name: sheetName,
      parsed_output: parsedOutputRows,
    }),
  );
}

export function executionResultDisplay(executionState = {}, empty = {}) {
  const kind = executionState?.kind || "empty";
  if (kind === "running") {
    return {
      kind,
      resultPayload: null,
      statusMessage: t("running"),
      statusTone: "running",
    };
  }
  if (kind === "error") {
    return {
      kind,
      resultPayload: null,
      statusMessage: executionState.message || "",
      statusTone: "error",
    };
  }
  if (kind === "result") {
    const resultPayload = executionState.resultPayload || null;
    return {
      kind,
      resultPayload,
      statusMessage: "",
      statusTone: "info",
    };
  }
  return {
    kind: "empty",
    resultPayload: null,
    statusMessage: empty.emptyMessageKey ? t(empty.emptyMessageKey) : "",
    statusTone: "info",
  };
}

function parsedOutputBlockPresentation({
  exportItem = null,
  parseError = "",
  parsedOutput,
} = {}) {
  const tableRows = parsedOutputTableRows(parsedOutput);
  const hasParsedOutput = parsedOutput != null;
  const columns = parsedOutputColumns(tableRows);
  const hasColumns = columns.length > 0;
  return {
    canExport: parsedOutputItemCanExport(exportItem),
    hasParsedOutput,
    hasParseError: !hasParsedOutput && Boolean(parseError),
    jsonOutput:
      hasParsedOutput && !tableRows
        ? JSON.stringify(parsedOutput, null, 2)
        : "",
    parseErrorText: safeString(parseError),
    showEmptyColumns: Boolean(tableRows && tableRows.length && !hasColumns),
    showEmptyRows: Boolean(tableRows && tableRows.length === 0),
    showJson: Boolean(hasParsedOutput && !tableRows),
    showTable: Boolean(tableRows && tableRows.length && hasColumns),
    tableColumns: columns,
    tableRows: (tableRows || []).map((parsedRow) => ({
      cells: columns.map((column) => parsedOutputCellText(parsedRow?.[column])),
    })),
  };
}

export function parsedOutputBlockDisplay({
  exportItem = null,
  parseError = "",
  parsedOutput,
} = {}) {
  return {
    exportItem,
    ...parsedOutputBlockPresentation({ exportItem, parseError, parsedOutput }),
  };
}

export function parsedOutputBlockDisplayFromItem(
  parsedOutputItem,
  exportItem = parsedOutputItem || {},
) {
  return parsedOutputBlockDisplay({
    exportItem,
    parseError: parsedOutputItem?.parse_error,
    parsedOutput: parsedOutputItem?.parsed_output,
  });
}

export async function exportParsedOutputItemExcel(parsedOutputItem) {
  if (!parsedOutputItemCanExport(parsedOutputItem)) {
    return;
  }
  await exportParsedOutputPayloadExcel({
    filename: exportFilenameForParsedOutput(parsedOutputItem),
    sheet_name: exportSheetNameForParsedOutput(parsedOutputItem),
    parsed_output: parsedOutputItem.parsed_output,
  });
}

export async function exportParsedOutputSheetsExcel(sheets, exportConfig = {}) {
  const normalizedSheets = normalizeParsedOutputSheets(sheets);
  if (!normalizedSheets.length) {
    return;
  }
  await exportParsedOutputPayloadExcel({
    filename: timestampedExcelFilename(
      exportConfig.filename || "textfsm-parsed-output.xlsx",
    ),
    sheets: normalizedSheets,
  });
}

async function exportParsedOutputPayloadExcel(payload) {
  try {
    const { blob, filename } = await exportTextfsmExcel(payload);
    downloadBlob(blob, filename || payload.filename || "textfsm.xlsx");
  } catch (error) {
    const { showToast } = await import("../overlays/overlays.js");
    showToast(error.message || t("requestFailed"), "error");
  }
}

function parsedOutputItemCanExport(parsedOutputItem) {
  return parsedOutputItem?.parsed_output != null;
}

function parsedOutputTableRows(parsedValue) {
  if (!Array.isArray(parsedValue)) {
    return null;
  }
  return parsedValue.every(
    (parsedRow) =>
      parsedRow && typeof parsedRow === "object" && !Array.isArray(parsedRow),
  )
    ? parsedValue
    : null;
}

function parsedOutputColumns(parsedRows) {
  if (!Array.isArray(parsedRows)) return [];
  const columnNames = [];
  for (const parsedRow of parsedRows) {
    for (const columnName of Object.keys(parsedRow || {})) {
      if (!columnNames.includes(columnName)) columnNames.push(columnName);
    }
  }
  return columnNames;
}

function parsedOutputCellText(parsedCellValue) {
  if (parsedCellValue == null) return "";
  if (Array.isArray(parsedCellValue)) {
    return parsedCellValue.map(parsedOutputCellText).join(", ");
  }
  if (typeof parsedCellValue === "object")
    return JSON.stringify(parsedCellValue);
  return safeString(parsedCellValue);
}

function exportFilenameForParsedOutput(parsedOutputItem) {
  const device = filenamePart(deviceNameForParsedOutput(parsedOutputItem));
  const command = filenamePart(parsedOutputItem?.command || "parsed_output");
  const base = [device, command].filter(Boolean).join("-");
  return timestampedExcelFilename(`${base || "textfsm-parsed-output"}.xlsx`);
}

function exportSheetNameForParsedOutput(parsedOutputItem) {
  const command = safeString(parsedOutputItem.command || "").trim();
  return command || "parsed_output";
}

function deviceNameForParsedOutput(parsedOutputItem) {
  const explicit = safeString(
    parsedOutputItem?.device ||
      parsedOutputItem?.target ||
      parsedOutputItem?.connection_name ||
      parsedOutputItem?.host ||
      "",
  ).trim();
  if (explicit) {
    return explicit;
  }
  const details = activeConnectionTarget()?.details || null;
  const fromTarget = safeString(details?.name || details?.host || "").trim();
  if (fromTarget && fromTarget !== "-") {
    return fromTarget;
  }
  const temporary = currentTemporaryConnectionDetails();
  const fromTemporary = safeString(
    temporary?.name || temporary?.host || "",
  ).trim();
  return fromTemporary && fromTemporary !== "-" ? fromTemporary : "device";
}

function filenamePart(rawFilenamePart) {
  return safeString(rawFilenamePart || "")
    .trim()
    .replace(/[\\/:*?"<>|\[\]\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeParsedOutputSheets(sheets) {
  return (Array.isArray(sheets) ? sheets : [])
    .map((sheet, index) => ({
      name: safeString(sheet?.name || `parsed_output_${index + 1}`).trim(),
      parsed_output: sheet?.parsed_output,
    }))
    .filter((sheet) => sheet.parsed_output != null);
}

function timestampedExcelFilename(rawFilename) {
  const filename = safeString(
    rawFilename || "textfsm-parsed-output.xlsx",
  ).trim();
  const normalized = filename || "textfsm-parsed-output.xlsx";
  const timestamp = excelExportTimestamp();
  if (/\.xlsx$/i.test(normalized)) {
    return normalized.replace(/\.xlsx$/i, `-${timestamp}.xlsx`);
  }
  return `${normalized}-${timestamp}.xlsx`;
}

function excelExportTimestamp(date = new Date()) {
  const pad = (datePart) => String(datePart).padStart(2, "0");
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
