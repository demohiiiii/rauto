import { sessionStorageGet, sessionStorageSet } from "$lib/browser.js";
import {
  executionHistoryFunctions,
  historyOutputSnapshot,
  historyStatus,
  historyLimit,
  retainExecutionHistory,
} from "../model/executionHistory.js";
import type {
  ExecutionHistoryEntry,
  ExecutionHistoryOutput,
  ExecutionHistorySnapshot,
} from "../model/executionHistory.js";
import type { JsonValue } from "$lib/jsonValue.js";

export const EXECUTION_HISTORY_STORAGE_KEY = "rauto_execution_history_v1";
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function json(value: unknown): value is JsonValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value)
      ? value.every(json)
      : record(value) && Object.values(value).every(json))
  );
}
function output(value: unknown): value is ExecutionHistoryOutput {
  if (
    !record(value) ||
    typeof value.device !== "string" ||
    typeof value.command !== "string"
  )
    return false;
  for (const key of [
    "host",
    "profile",
    "object",
    "mode",
    "fetched_at",
    "config_kind",
  ]) {
    if (value[key] !== undefined && typeof value[key] !== "string")
      return false;
  }
  for (const key of [
    "output",
    "all",
    "error",
    "parse_error",
    "normalized_content",
    "sha256",
    "normalized_sha256",
  ]) {
    if (value[key] != null && typeof value[key] !== "string") return false;
  }
  return (
    (value.success === undefined || typeof value.success === "boolean") &&
    (value.exit_code == null ||
      (typeof value.exit_code === "number" &&
        Number.isFinite(value.exit_code))) &&
    (value.parsed_output === undefined || json(value.parsed_output))
  );
}
function entry(value: unknown): value is ExecutionHistoryEntry {
  return (
    record(value) &&
    typeof value.id === "string" &&
    executionHistoryFunctions.some((feature) => feature === value.feature) &&
    (value.scope === "single" || value.scope === "batch") &&
    typeof value.startedAt === "string" &&
    Number.isFinite(Date.parse(value.startedAt)) &&
    (value.completedAt === null ||
      (typeof value.completedAt === "string" &&
        Number.isFinite(Date.parse(value.completedAt)))) &&
    ["running", "success", "warning", "error", "interrupted"].includes(
      String(value.status),
    ) &&
    (value.textfsmEnabled === undefined ||
      typeof value.textfsmEnabled === "boolean") &&
    typeof value.message === "string" &&
    Array.isArray(value.outputs) &&
    value.outputs.every(output)
  );
}
export function parseExecutionHistory(
  raw: string | null,
): ExecutionHistorySnapshot {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!record(value) || !Array.isArray(value.entries))
      return { limit: 10, entries: [] };
    const limit = historyLimit(value.limit);
    const ids = new Set<string>();
    const entries = value.entries
      .filter(entry)
      .filter((row) => {
        if (ids.has(row.id)) return false;
        ids.add(row.id);
        return true;
      })
      .map((row) =>
        row.status === "running"
          ? { ...row, status: "interrupted" as const }
          : row,
      );
    return { limit, entries: retainExecutionHistory(entries, limit) };
  } catch {
    return { limit: 10, entries: [] };
  }
}
export function migrateShowExecutionHistory(
  raw: string | null,
): ExecutionHistorySnapshot {
  try {
    const legacy: unknown = JSON.parse(raw ?? "null");
    if (!record(legacy)) return { limit: 10, entries: [] };
    const entries: ExecutionHistoryEntry[] = [];
    for (const scope of ["single", "batch"] as const) {
      const rows = legacy[scope];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!record(row) || !record(row.result)) continue;
        const result = row.result;
        const payload = record(result.resultPayload)
          ? result.resultPayload
          : {};
        const base = record(result.basePayload) ? result.basePayload : {};
        const connection = record(base.connection) ? base.connection : {};
        const results = scope === "batch" ? payload.results : result.results;
        const outputs: ExecutionHistoryOutput[] = [];
        if (Array.isArray(results))
          for (const result of results) {
            if (!record(result)) continue;
            const device =
              scope === "batch"
                ? result.target || result.host
                : connection.connection_name || connection.host;
            const candidate = {
              ...result,
              device: typeof device === "string" ? device : "",
            };
            if (output(candidate))
              outputs.push(historyOutputSnapshot(candidate));
          }
        const candidate = {
          id: row.id,
          feature: "show",
          scope,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
          outputs,
          textfsmEnabled:
            scope === "single"
              ? base.no_parse !== true
              : result.textfsmEnabled !== false,
          message: typeof result.message === "string" ? result.message : "",
          status:
            result.kind === "running"
              ? "interrupted"
              : result.kind === "error"
                ? "error"
                : historyStatus(outputs),
        };
        if (entry(candidate)) entries.push(candidate);
      }
    }
    return {
      limit: historyLimit(legacy.limit),
      entries: retainExecutionHistory(entries, historyLimit(legacy.limit)),
    };
  } catch {
    return { limit: 10, entries: [] };
  }
}
export function readExecutionHistory() {
  const raw = sessionStorageGet(EXECUTION_HISTORY_STORAGE_KEY);
  if (raw) return parseExecutionHistory(raw);
  const migrated = migrateShowExecutionHistory(
    sessionStorageGet("rauto_show_execution_history_v1"),
  );
  if (migrated.entries.length) writeExecutionHistory(migrated);
  return migrated;
}
export function writeExecutionHistory(snapshot: ExecutionHistorySnapshot) {
  sessionStorageSet(EXECUTION_HISTORY_STORAGE_KEY, JSON.stringify(snapshot));
}
