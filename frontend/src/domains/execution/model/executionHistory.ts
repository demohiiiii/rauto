import type { JsonValue } from "$lib/jsonValue.js";
import type { CommandOutputEntry } from "./types.js";
import { executionResultFailed } from "./executionResult.js";

export const executionHistoryFunctions = [
  "show",
  "config-fetch",
  "command",
  "interactive",
] as const;
export type ExecutionHistoryFunction =
  (typeof executionHistoryFunctions)[number];
export type ExecutionHistoryStatus =
  "running" | "success" | "warning" | "error" | "interrupted";
export interface ExecutionHistoryOutput extends CommandOutputEntry {
  device: string;
  host?: string;
  profile?: string;
  object?: string;
  mode?: string;
  parsed_output?: JsonValue;
  parse_error?: string | null;
  normalized_content?: string | null;
  sha256?: string | null;
  normalized_sha256?: string | null;
  config_kind?: string;
  fetched_at?: string;
}
export interface ExecutionHistoryEntry {
  id: string;
  feature: ExecutionHistoryFunction;
  scope: "single" | "batch";
  startedAt: string;
  completedAt: string | null;
  textfsmEnabled?: boolean;
  status: ExecutionHistoryStatus;
  message: string;
  outputs: ExecutionHistoryOutput[];
}
export interface ExecutionHistorySnapshot {
  limit: number;
  entries: ExecutionHistoryEntry[];
}
export function historyLimit(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(1, Math.round(n))) : 10;
}
export function retainExecutionHistory(
  entries: ExecutionHistoryEntry[],
  limit: number,
): ExecutionHistoryEntry[] {
  const counts = new Map<ExecutionHistoryFunction, number>();
  return [...entries]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .filter((entry) => {
      const count = counts.get(entry.feature) ?? 0;
      counts.set(entry.feature, count + 1);
      return count < limit;
    });
}
export function historyStatus(
  outputs: ExecutionHistoryOutput[],
  failed = false,
): ExecutionHistoryStatus {
  const failures = outputs.filter(executionResultFailed).length;
  if (failures === 0) return failed ? "error" : "success";
  return failures === outputs.length ? "error" : "warning";
}
export function filterExecutionHistory(
  entries: ExecutionHistoryEntry[],
  features: readonly ExecutionHistoryFunction[],
) {
  return entries.filter((entry) => features.includes(entry.feature));
}

// Whitelist result fields: request credentials and session recordings are never persisted.
export function historyOutputSnapshot(
  row: ExecutionHistoryOutput,
): ExecutionHistoryOutput {
  const {
    device,
    command,
    output,
    all,
    error,
    success,
    exit_code,
    host,
    profile,
    object,
    mode,
    parsed_output,
    parse_error,
    normalized_content,
    sha256,
    normalized_sha256,
    config_kind,
    fetched_at,
  } = row;
  return {
    device,
    command,
    output,
    all,
    error,
    success,
    exit_code,
    host,
    profile,
    object,
    mode,
    parsed_output,
    parse_error,
    normalized_content,
    sha256,
    normalized_sha256,
    config_kind,
    fetched_at,
  };
}
