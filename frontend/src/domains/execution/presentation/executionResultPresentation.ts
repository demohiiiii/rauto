import { t } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import { parsedOutputItemCanExport } from "../model/executionResult.js";
import type {
  ExecutionResultDisplay,
  ParsedOutputBlockDisplay,
} from "../model/types.js";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function executionResultDisplay(
  executionState: unknown = {},
  empty: { emptyMessageKey?: string } = {},
): ExecutionResultDisplay {
  const state = record(executionState);
  const kind = typeof state.kind === "string" ? state.kind : "empty";
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
      statusMessage: typeof state.message === "string" ? state.message : "",
      statusTone: "error",
    };
  }
  if (kind === "result") {
    return {
      kind,
      resultPayload:
        state.resultPayload && typeof state.resultPayload === "object"
          ? (state.resultPayload as Record<string, unknown>)
          : null,
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

function parsedOutputTableRows(
  parsedValue: unknown,
): Record<string, unknown>[] | null {
  if (!Array.isArray(parsedValue)) return null;
  return parsedValue.every(
    (row) => row && typeof row === "object" && !Array.isArray(row),
  )
    ? (parsedValue as Record<string, unknown>[])
    : null;
}

function parsedOutputColumns(parsedRows: Record<string, unknown>[] | null) {
  if (!Array.isArray(parsedRows)) return [];
  const columnNames: string[] = [];
  for (const parsedRow of parsedRows) {
    for (const columnName of Object.keys(parsedRow)) {
      if (!columnNames.includes(columnName)) columnNames.push(columnName);
    }
  }
  return columnNames;
}

function parsedOutputCellText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map(parsedOutputCellText).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return safeString(value);
}

export function parsedOutputBlockDisplay({
  exportItem = null,
  parseError = "",
  parsedOutput,
}: {
  exportItem?: unknown;
  parseError?: unknown;
  parsedOutput?: unknown;
} = {}): ParsedOutputBlockDisplay {
  const tableRows = parsedOutputTableRows(parsedOutput);
  const hasParsedOutput = parsedOutput != null;
  const columns = parsedOutputColumns(tableRows);
  const hasColumns = columns.length > 0;
  return {
    canExport: parsedOutputItemCanExport(exportItem),
    exportItem,
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
      cells: columns.map((column) => parsedOutputCellText(parsedRow[column])),
    })),
  };
}

export function parsedOutputBlockDisplayFromItem(
  parsedOutputItem: unknown,
  exportItem: unknown = parsedOutputItem || {},
): ParsedOutputBlockDisplay {
  const item = record(parsedOutputItem);
  return parsedOutputBlockDisplay({
    exportItem,
    parseError: item.parse_error,
    parsedOutput: item.parsed_output,
  });
}
