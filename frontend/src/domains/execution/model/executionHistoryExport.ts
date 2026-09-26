import type { ExecutionHistoryEntry } from "./executionHistory.js";
import {
  parsedOutputSheetsFromBatchShow,
  parsedOutputSheetsFromParsedOutputItems,
} from "./executionResult.js";

export function executionHistoryExportSheets(entry: ExecutionHistoryEntry) {
  if (entry.scope === "batch" && entry.feature === "show") {
    return parsedOutputSheetsFromBatchShow({
      results: entry.outputs.map((row) => ({ ...row, target: row.device })),
    });
  }
  return parsedOutputSheetsFromParsedOutputItems(
    entry.outputs,
    entry.scope === "batch"
      ? { sheetName: (row) => `${row.device} ${row.command}` }
      : {},
  );
}
