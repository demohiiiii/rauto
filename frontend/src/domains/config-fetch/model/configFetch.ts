import type {
  ConfigCommandRow,
  ConfigFetchBatchPayload,
  ConfigFetchConnectionPayload,
  ConfigFetchCurrentPayload,
  ConfigFetchForm,
  ConfigFetchKindCatalog,
  ConfigFetchKindOption,
  ConfigFetchRetryPayload,
  ConfigFetchResultCounts,
  ConfigFetchResultPayload,
  ConfigFetchResultRow,
  ConfigFetchSingleResult,
  ConfigFetchTargetMode,
  ConfigFetchTargetSelections,
} from "./types.js";
import type { RecordLevel } from "$domains/overlays/index.js";

export const CONFIG_FETCH_TARGET_MODE = Object.freeze({
  batch: "batch" as const,
  current: "current" as const,
});

export function normalizeConfigFetchTargetMode(
  value: string,
): ConfigFetchTargetMode;
export function normalizeConfigFetchTargetMode<T extends string>(
  value: string,
  fallback: T,
): ConfigFetchTargetMode | T;
export function normalizeConfigFetchTargetMode<T extends string>(
  value: string,
  fallback: T | ConfigFetchTargetMode = CONFIG_FETCH_TARGET_MODE.current,
): ConfigFetchTargetMode | T {
  return value === CONFIG_FETCH_TARGET_MODE.current ||
    value === CONFIG_FETCH_TARGET_MODE.batch
    ? value
    : fallback;
}

export function configFetchKindAvailable(
  catalog: Partial<ConfigFetchKindCatalog> = {},
  selectedKind = "",
): boolean {
  const kind = selectedKind.trim();
  return Boolean(
    catalog.kind === "ready" &&
    kind &&
    catalog.options &&
    catalog.options.some((option) => option?.value === kind),
  );
}

export function normalizeConfigFetchMaxParallel(value?: string): number | null {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function configFetchPayload(
  form: Partial<ConfigFetchForm>,
  selections: Partial<ConfigFetchTargetSelections> = {},
  recordLevel: RecordLevel | null = null,
  retryFields: ConfigFetchRetryPayload = {},
): ConfigFetchBatchPayload {
  const maxParallel = normalizeConfigFetchMaxParallel(form.maxParallel);
  return {
    kind: form.kind?.trim() ?? "",
    include_normalized: Boolean(form.includeNormalized),
    targets: selections.targets ?? [],
    groups: selections.groups ?? [],
    labels: selections.labels ?? [],
    ...(maxParallel ? { max_parallel: maxParallel } : {}),
    ...retryFields,
    record_level: recordLevel || null,
  };
}

export function configFetchCurrentPayload(
  form: Partial<ConfigFetchForm>,
  connection: ConfigFetchConnectionPayload = {},
  recordLevel: RecordLevel | null = null,
  retryFields: ConfigFetchRetryPayload = {},
): ConfigFetchCurrentPayload {
  return {
    kind: form.kind?.trim() ?? "",
    include_normalized: Boolean(form.includeNormalized),
    ...retryFields,
    connection,
    record_level: recordLevel || null,
  };
}

export function configFetchKindOptions(
  commandRows: readonly ConfigCommandRow[] | null = [],
): ConfigFetchKindOption[] {
  return [
    ...new Set(
      (commandRows ?? []).map((row) => row.kind.trim()).filter(Boolean),
    ),
  ]
    .sort((left, right) => left.localeCompare(right))
    .map((kind) => ({ label: kind, value: kind }));
}

export function configFetchResultRows(
  resultPayload: Partial<ConfigFetchResultPayload> = {},
): ConfigFetchResultRow[] {
  return resultPayload.results ?? [];
}

export function configFetchResultCounts(
  resultPayload: Partial<ConfigFetchResultPayload> = {},
): ConfigFetchResultCounts {
  const rows = configFetchResultRows(resultPayload);
  const reported = resultPayload.result_summary?.counts;
  const failedFallback = rows.filter((row) => Boolean(row.error)).length;
  const total = reported?.total ?? rows.length;
  const failed = reported?.failed ?? failedFallback;
  const succeeded = reported?.succeeded ?? Math.max(0, total - failed);
  return { failed, succeeded, total };
}

export function singleConfigFetchResultPayload(
  row: ConfigFetchSingleResult,
): ConfigFetchResultPayload {
  const resultPayload: ConfigFetchResultPayload = {
    execution_response: row.execution_response,
    kind: row.kind,
    targets: [row.target],
    results: [row],
    result_summary: row.result_summary,
  };
  Object.defineProperty(resultPayload, "execution_response", {
    enumerable: false,
    value: row.execution_response,
  });
  return resultPayload;
}
