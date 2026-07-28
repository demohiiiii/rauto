import { get, writable } from "svelte/store";
import {
  fetchConfig,
  fetchConfigBatch,
  listConfigCommands,
} from "../../api/client.js";
import { t } from "../../lib/i18n.js";
import { downloadBlob, safeString } from "../../lib/ui.js";
import {
  connectionPayload,
  currentExecutionConnectionProfile,
  ensureConnectionTargetSelected,
} from "../connections/connections.js";
import {
  CONNECTION_PICKER,
  connectionPickerValues,
} from "../connections/connectionFieldStoreState.js";
import { recordLevelPayload } from "../overlays/overlays.js";

export const CONFIG_FETCH_CONTENT_VIEW = Object.freeze({
  normalized: "normalized",
  raw: "raw",
});

export const CONFIG_FETCH_TARGET_MODE = Object.freeze({
  batch: "batch",
  current: "current",
});

export const EMPTY_CONFIG_FETCH_RESULT = Object.freeze({ kind: "empty" });

export const configFetchFormState = writable({
  includeNormalized: false,
  kind: "running",
  maxParallel: "",
  targetMode: CONFIG_FETCH_TARGET_MODE.current,
});

export const configFetchResultState = writable(EMPTY_CONFIG_FETCH_RESULT);
export const configFetchKindCatalogState = writable({
  kind: "idle",
  options: [],
  profile: "",
});

let configFetchCatalogRequestSequence = 0;

export function setConfigFetchField(field, value) {
  configFetchFormState.update((form) => ({
    ...form,
    [field]: field === "includeNormalized" ? Boolean(value) : safeString(value),
  }));
}

export function normalizeConfigFetchTargetMode(
  value,
  fallback = CONFIG_FETCH_TARGET_MODE.current,
) {
  return value === CONFIG_FETCH_TARGET_MODE.current ||
    value === CONFIG_FETCH_TARGET_MODE.batch
    ? value
    : fallback;
}

export function configFetchKindAvailable(catalog = {}, selectedKind = "") {
  const kind = safeString(selectedKind).trim();
  return Boolean(
    catalog?.kind === "ready" &&
    kind &&
    Array.isArray(catalog.options) &&
    catalog.options.some((option) => option?.value === kind),
  );
}

export function normalizeConfigFetchMaxParallel(value) {
  const parsed = Number.parseInt(safeString(value).trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function configFetchTargetSelections() {
  return {
    groups: connectionPickerValues(CONNECTION_PICKER.configFetchGroups),
    labels: connectionPickerValues(CONNECTION_PICKER.configFetchLabels),
    targets: connectionPickerValues(CONNECTION_PICKER.configFetchTargets),
  };
}

export function configFetchPayload(
  form = get(configFetchFormState),
  selections = configFetchTargetSelections(),
  recordLevel = recordLevelPayload(),
) {
  const maxParallel = normalizeConfigFetchMaxParallel(form.maxParallel);
  return {
    kind: safeString(form.kind).trim(),
    include_normalized: Boolean(form.includeNormalized),
    targets: Array.isArray(selections.targets) ? selections.targets : [],
    groups: Array.isArray(selections.groups) ? selections.groups : [],
    labels: Array.isArray(selections.labels) ? selections.labels : [],
    ...(maxParallel ? { max_parallel: maxParallel } : {}),
    record_level: recordLevel || null,
  };
}

export function configFetchCurrentPayload(
  form = get(configFetchFormState),
  connection = connectionPayload(),
  recordLevel = recordLevelPayload(),
) {
  return {
    kind: safeString(form.kind).trim(),
    include_normalized: Boolean(form.includeNormalized),
    connection,
    record_level: recordLevel || null,
  };
}

export function configFetchKindOptions(commandRows = []) {
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

export async function loadConfigFetchKindOptions(profile = "") {
  const requestSequence = ++configFetchCatalogRequestSequence;
  const requestedProfile = safeString(profile).trim();
  const catalogProfile =
    requestedProfile === "autodetect" ? "" : requestedProfile;
  configFetchKindCatalogState.set({
    kind: "loading",
    options: [],
    profile: requestedProfile,
  });
  try {
    const options = configFetchKindOptions(
      await listConfigCommands(catalogProfile),
    );
    if (requestSequence !== configFetchCatalogRequestSequence) return;
    configFetchKindCatalogState.set({
      kind: "ready",
      options,
      profile: requestedProfile,
    });
    const selectedKind = safeString(get(configFetchFormState).kind).trim();
    if (!options.some((option) => option.value === selectedKind)) {
      setConfigFetchField(
        "kind",
        options.find((option) => option.value === "running")?.value ||
          options[0]?.value ||
          "",
      );
    }
  } catch (error) {
    if (requestSequence !== configFetchCatalogRequestSequence) return;
    configFetchKindCatalogState.set({
      kind: "error",
      message: safeString(error?.message).trim() || t("requestFailed"),
      options: [],
      profile: requestedProfile,
    });
  }
}

export function refreshConfigFetchKindOptions(
  targetMode = get(configFetchFormState).targetMode,
) {
  return loadConfigFetchKindOptions(
    targetMode === CONFIG_FETCH_TARGET_MODE.current
      ? currentExecutionConnectionProfile()
      : "",
  );
}

export function configFetchResultRows(resultPayload = {}) {
  return Array.isArray(resultPayload?.results) ? resultPayload.results : [];
}

export function configFetchResultCounts(resultPayload = {}) {
  const rows = configFetchResultRows(resultPayload);
  const reported = resultPayload?.result_summary?.counts || {};
  const failedFallback = rows.filter((row) => Boolean(row?.error)).length;
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

export function configFetchContent(
  row = {},
  view = CONFIG_FETCH_CONTENT_VIEW.raw,
) {
  if (
    view === CONFIG_FETCH_CONTENT_VIEW.normalized &&
    typeof row.normalized_content === "string"
  ) {
    return row.normalized_content;
  }
  return typeof row.content === "string" ? row.content : "";
}

function configFetchFilenamePart(value, fallback) {
  const part = safeString(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[_\s.-]+|[_\s.-]+$/g, "");
  return part || fallback;
}

function configFetchFilenameTimestamp(value) {
  const timestamp = Date.parse(safeString(value));
  if (!Number.isFinite(timestamp)) return "";
  return new Date(timestamp)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function configFetchDownloadDescriptor(
  row = {},
  view = CONFIG_FETCH_CONTENT_VIEW.raw,
) {
  const normalized = view === CONFIG_FETCH_CONTENT_VIEW.normalized;
  const content = normalized ? row.normalized_content : row.content;
  if (row?.error || typeof content !== "string") return null;
  const target = configFetchFilenamePart(row.target, "device");
  const kind = configFetchFilenamePart(row.kind, "config");
  const timestamp = configFetchFilenameTimestamp(row.fetched_at);
  return {
    content,
    filename:
      [
        target,
        kind,
        ...(normalized ? ["normalized"] : []),
        ...(timestamp ? [timestamp] : []),
      ].join("_") + ".cfg",
  };
}

export function downloadConfigFetchResult(
  row = {},
  view = CONFIG_FETCH_CONTENT_VIEW.raw,
) {
  const descriptor = configFetchDownloadDescriptor(row, view);
  if (!descriptor) return false;
  downloadBlob(
    new Blob([descriptor.content], { type: "text/plain;charset=utf-8" }),
    descriptor.filename,
  );
  return true;
}

export function configFetchTimestamp(value) {
  const timestamp = Date.parse(safeString(value));
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleString()
    : "-";
}

export function singleConfigFetchResultPayload(row = {}) {
  const failed = row?.error ? 1 : 0;
  return {
    kind: row?.kind || "",
    targets: row?.target ? [row.target] : [],
    results: [row],
    result_summary: {
      counts: { total: 1, succeeded: 1 - failed, failed },
    },
  };
}

export async function executeConfigFetch() {
  const form = get(configFetchFormState);
  const targetMode = normalizeConfigFetchTargetMode(form.targetMode);
  if (!configFetchKindAvailable(get(configFetchKindCatalogState), form.kind)) {
    configFetchResultState.set({
      kind: "error",
      message: t("configFetchKindRequired"),
    });
    return;
  }
  if (
    targetMode === CONFIG_FETCH_TARGET_MODE.current &&
    !ensureConnectionTargetSelected()
  ) {
    return;
  }
  let payload;
  try {
    payload =
      targetMode === CONFIG_FETCH_TARGET_MODE.current
        ? configFetchCurrentPayload(form)
        : configFetchPayload(form);
  } catch (error) {
    configFetchResultState.set({
      kind: "error",
      message: safeString(error?.message).trim() || t("requestFailed"),
    });
    return;
  }
  if (!payload.kind) {
    configFetchResultState.set({
      kind: "error",
      message: t("configFetchKindRequired"),
    });
    return;
  }
  if (
    targetMode === CONFIG_FETCH_TARGET_MODE.batch &&
    !payload.targets.length &&
    !payload.groups.length &&
    !payload.labels.length
  ) {
    configFetchResultState.set({
      kind: "error",
      message: t("batchShowTargetRequired"),
    });
    return;
  }

  configFetchResultState.set({ kind: "running" });
  try {
    const resultPayload =
      targetMode === CONFIG_FETCH_TARGET_MODE.current
        ? singleConfigFetchResultPayload(await fetchConfig(payload))
        : await fetchConfigBatch(payload);
    configFetchResultState.set({ kind: "result", resultPayload });
  } catch (error) {
    const message = String(error?.message ?? "").trim();
    configFetchResultState.set({
      kind: "error",
      message: message || t("requestFailed"),
    });
  }
}
