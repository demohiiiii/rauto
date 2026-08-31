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
  ConfigFetchTargetMode,
  ConfigFetchTargetSelections,
} from "./types.js";

export const CONFIG_FETCH_TARGET_MODE = Object.freeze({
  batch: "batch" as const,
  current: "current" as const,
});

function safeString(value: unknown): string {
  return value == null ? "" : String(value);
}

export function normalizeConfigFetchTargetMode(
  value: unknown,
): ConfigFetchTargetMode;
export function normalizeConfigFetchTargetMode<T extends string>(
  value: unknown,
  fallback: T,
): ConfigFetchTargetMode | T;
export function normalizeConfigFetchTargetMode<T extends string>(
  value: unknown,
  fallback: T | ConfigFetchTargetMode = CONFIG_FETCH_TARGET_MODE.current,
): ConfigFetchTargetMode | T {
  return value === CONFIG_FETCH_TARGET_MODE.current ||
    value === CONFIG_FETCH_TARGET_MODE.batch
    ? value
    : fallback;
}

export function configFetchKindAvailable(
  catalog: Partial<ConfigFetchKindCatalog> = {},
  selectedKind: unknown = "",
): boolean {
  const kind = safeString(selectedKind).trim();
  return Boolean(
    catalog.kind === "ready" &&
    kind &&
    Array.isArray(catalog.options) &&
    catalog.options.some((option) => option?.value === kind),
  );
}

export function normalizeConfigFetchMaxParallel(value: unknown): number | null {
  const parsed = Number.parseInt(safeString(value).trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function configFetchPayload(
  form: Partial<ConfigFetchForm>,
  selections: Partial<ConfigFetchTargetSelections> = {},
  recordLevel: unknown = null,
  retryFields: ConfigFetchRetryPayload = {},
): ConfigFetchBatchPayload {
  const maxParallel = normalizeConfigFetchMaxParallel(form.maxParallel);
  return {
    kind: safeString(form.kind).trim(),
    include_normalized: Boolean(form.includeNormalized),
    targets: Array.isArray(selections.targets) ? selections.targets : [],
    groups: Array.isArray(selections.groups) ? selections.groups : [],
    labels: Array.isArray(selections.labels) ? selections.labels : [],
    ...(maxParallel ? { max_parallel: maxParallel } : {}),
    ...retryFields,
    record_level: recordLevel || null,
  };
}

export function configFetchCurrentPayload(
  form: Partial<ConfigFetchForm>,
  connection: ConfigFetchConnectionPayload = {},
  recordLevel: unknown = null,
  retryFields: ConfigFetchRetryPayload = {},
): ConfigFetchCurrentPayload {
  return {
    kind: safeString(form.kind).trim(),
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
      (Array.isArray(commandRows) ? commandRows : [])
        .map((row) => safeString(row?.kind).trim())
        .filter(Boolean),
    ),
  ]
    .sort((left, right) => left.localeCompare(right))
    .map((kind) => ({ label: kind, value: kind }));
}

export function configFetchResultRows(
  resultPayload: Partial<ConfigFetchResultPayload> = {},
): ConfigFetchResultRow[] {
  return Array.isArray(resultPayload.results) ? resultPayload.results : [];
}

export function configFetchResultCounts(
  resultPayload: Partial<ConfigFetchResultPayload> = {},
): ConfigFetchResultCounts {
  const rows = configFetchResultRows(resultPayload);
  const reported = resultPayload.result_summary?.counts || {};
  const failedFallback = rows.filter((row) => Boolean(row.error)).length;
  const total = Number.isFinite(Number(reported.total))
    ? Number(reported.total)
    : rows.length;
  const failed = Number.isFinite(Number(reported.failed))
    ? Number(reported.failed)
    : failedFallback;
  const succeeded = Number.isFinite(Number(reported.succeeded))
    ? Number(reported.succeeded)
    : Math.max(0, total - failed);
  return { failed, succeeded, total };
}

export function singleConfigFetchResultPayload(
  row: ConfigFetchResultRow = {},
): ConfigFetchResultPayload {
  const failed = row.error ? 1 : 0;
  const resultPayload: ConfigFetchResultPayload = {
    kind: row.kind || "",
    targets: row.target ? [row.target] : [],
    results: [row],
    result_summary: row.result_summary || {
      counts: { total: 1, succeeded: 1 - failed, failed },
    },
  };
  if (row.execution_response) {
    Object.defineProperty(resultPayload, "execution_response", {
      enumerable: false,
      value: row.execution_response,
    });
  }
  return resultPayload;
}
