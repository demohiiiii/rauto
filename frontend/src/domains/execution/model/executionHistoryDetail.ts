import type { JsonValue } from "$lib/jsonValue.js";
import type { OrchestrationExecutionResult } from "$domains/orchestration/index.js";

export type ExecutionHistoryDetail =
  | { kind: "tx-workflow"; device: string; result: JsonValue }
  | { kind: "orchestrate"; result: OrchestrationExecutionResult | null };

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
function strings(row: Record<string, unknown>, keys: string[]) {
  return keys.every((key) => typeof row[key] === "string");
}
function numbers(row: Record<string, unknown>, keys: string[]) {
  return keys.every(
    (key) => typeof row[key] === "number" && Number.isFinite(row[key]),
  );
}
function nullableStrings(row: Record<string, unknown>, keys: string[]) {
  return keys.every((key) => row[key] === null || typeof row[key] === "string");
}
function status(value: unknown) {
  return value === "success" || value === "failed" || value === "skipped";
}
function strategy(value: unknown) {
  return value === "serial" || value === "parallel";
}
function compensation(value: unknown): boolean {
  return (
    value === null ||
    (record(value) &&
      typeof value.attempted === "boolean" &&
      typeof value.success === "boolean" &&
      numbers(value, ["duration_ms"]) &&
      strings(value, ["scope"]) &&
      nullableStrings(value, [
        "error",
        "operation",
        "reason",
        "recording_jsonl",
      ]) &&
      json(value.tx_result))
  );
}
function target(value: unknown): boolean {
  return (
    record(value) &&
    strings(value, ["label", "operation"]) &&
    numbers(value, ["duration_ms"]) &&
    status(value.status) &&
    nullableStrings(value, [
      "connection_name",
      "error",
      "host",
      "recording_jsonl",
    ]) &&
    json(value.tx_result) &&
    json(value.workflow_result) &&
    compensation(value.compensation)
  );
}
function job(value: unknown): boolean {
  return (
    record(value) &&
    strings(value, ["action_kind", "action_summary", "name"]) &&
    numbers(value, [
      "targets_failed",
      "targets_skipped",
      "targets_succeeded",
      "targets_total",
    ]) &&
    typeof value.fail_fast === "boolean" &&
    status(value.status) &&
    strategy(value.strategy) &&
    Array.isArray(value.results) &&
    value.results.every(target)
  );
}
function stage(value: unknown): boolean {
  return (
    record(value) &&
    strings(value, ["name"]) &&
    numbers(value, [
      "jobs_failed",
      "jobs_skipped",
      "jobs_succeeded",
      "jobs_total",
    ]) &&
    typeof value.fail_fast === "boolean" &&
    status(value.status) &&
    strategy(value.strategy) &&
    Array.isArray(value.jobs) &&
    value.jobs.every(job)
  );
}
function orchestrationResult(
  value: unknown,
): value is OrchestrationExecutionResult {
  return (
    record(value) &&
    json(value) &&
    strings(value, ["plan_name"]) &&
    numbers(value, ["executed_stages", "total_stages"]) &&
    typeof value.fail_fast === "boolean" &&
    typeof value.success === "boolean" &&
    Array.isArray(value.stages) &&
    value.stages.every(stage)
  );
}
export function isHistoryDetail(
  value: unknown,
): value is ExecutionHistoryDetail {
  if (!record(value)) return false;
  if (value.kind === "tx-workflow")
    return typeof value.device === "string" && json(value.result);
  return (
    value.kind === "orchestrate" &&
    (value.result === null || orchestrationResult(value.result))
  );
}

// Results are kept independently of mutable editors. Session recordings can contain
// prompt responses and are never retained in browser history, including compensation.
function withoutRecordings(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(withoutRecordings);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        key === "recording_jsonl" ? null : withoutRecordings(child),
      ]),
    );
  }
  return value;
}
export function historyDetailSnapshot(
  detail: ExecutionHistoryDetail,
): ExecutionHistoryDetail {
  if (detail.kind === "tx-workflow")
    return {
      kind: detail.kind,
      device: detail.device,
      result: withoutRecordings(detail.result),
    };
  return {
    kind: detail.kind,
    result: detail.result
      ? (withoutRecordings(detail.result) as OrchestrationExecutionResult)
      : null,
  };
}
export function historyDetailSucceeded(
  detail: ExecutionHistoryDetail,
): boolean {
  return detail.kind === "orchestrate"
    ? detail.result?.success === true
    : record(detail.result) && detail.result.committed === true;
}
