import {
  executeShow as executeShowRequest,
  executeShowBatch as executeShowBatchRequest,
  exportTextfsmExcel,
  listShowObjects,
} from "../../api/client.js";
import { normalizeShowQuery, SHOW_QUERY } from "../../config/dashboardModes.js";
import { get as getStore, writable } from "svelte/store";
import { t } from "../../lib/i18n.js";
import { downloadBlob, safeString } from "../../lib/ui.js";
import {
  applyRecordDrawerRecording,
  recordLevelPayload,
} from "../overlays/overlays.js";
import { parsedOutputSheetsFromBatchShow } from "./results.js";
import {
  executionConnectionProfileState,
  refreshExecutionModeOptionsForCurrentConnection,
} from "../profiles/profiles.js";
import {
  CONNECTION_PICKER,
  connectionPickerValues,
  hideConnectionPickerMenu,
  refreshConnectionPickerSelected,
  setShowObjectPickerOptions,
  showObjectOptionMeta,
} from "../connections/connectionFieldStoreState.js";
import {
  connectionPayload,
  connectionTargetState,
  currentExecutionConnectionProfile,
  ensureConnectionTargetSelected,
  savedConnectionSelectState,
} from "../connections/connections.js";
import { setCustomShowObjectsChangedCallback } from "../templates/templatesShowObjects.js";
import {
  createSessionRetryState,
  sessionRetryRequestFields,
} from "./sessionRetry.js";

export const showExecutionConnectionProfileState =
  executionConnectionProfileState;
export const showConnectionTargetState = connectionTargetState;
export const refreshShowExecutionModeOptions =
  refreshExecutionModeOptionsForCurrentConnection;

export const EMPTY_RESULT = { kind: "empty" };
export const EMPTY_BATCH_SHOW_OBJECT_AVAILABILITY = Object.freeze({
  connectionCount: 0,
  missingProfileNames: [],
  objectCount: 0,
  profiles: [],
  status: "waiting",
});
export const DEFAULT_SHOW_PAGE_QUERY = normalizeShowQuery(SHOW_QUERY.single);

const SHOW_QUERY_CONFIG = Object.freeze({
  [SHOW_QUERY.single]: {
    key: SHOW_QUERY.single,
    objectPicker: CONNECTION_PICKER.showObject,
  },
  [SHOW_QUERY.batch]: {
    key: SHOW_QUERY.batch,
    objectPicker: CONNECTION_PICKER.batchShowObject,
  },
});

function createShowStateContext() {
  return {
    batchShowExecutionResult: writable(EMPTY_RESULT),
    batchShowObjectAvailability: writable(EMPTY_BATCH_SHOW_OBJECT_AVAILABILITY),
    batchShowObjectsRequestSeq: 0,
    showCommandPreviewRows: writable({}),
    showExecutionResult: writable(EMPTY_RESULT),
    showFormFieldsState: new Map(),
    showObjectPlatformState: new Map(),
    showObjectsRequestSeq: 0,
  };
}

let showStateContext = null;

function currentShowStateContext() {
  if (!showStateContext) {
    showStateContext = createShowStateContext();
  }
  return showStateContext;
}

export function showExecutionResultState() {
  return currentShowStateContext().showExecutionResult;
}

export function batchShowExecutionResultState() {
  return currentShowStateContext().batchShowExecutionResult;
}

export function batchShowObjectAvailabilityState() {
  return currentShowStateContext().batchShowObjectAvailability;
}

export function showCommandPreviewRowsState() {
  return currentShowStateContext().showCommandPreviewRows;
}

function setShowFormFields(
  key,
  fields = {},
  stateContext = currentShowStateContext(),
) {
  stateContext.showFormFieldsState.set(
    key,
    fields && typeof fields === "object" && !Array.isArray(fields)
      ? { ...fields }
      : {},
  );
}

function showTextfsmPayloadFromFields(textfsmFields = {}) {
  return {
    excelName: safeString(textfsmFields.excelName ?? "").trim(),
    parseTextfsm: !!textfsmFields.enabled,
    textfsmPlatform: safeString(textfsmFields.platform),
    textfsmStrictErrors: !!textfsmFields.strictErrors,
    textfsmTemplate: safeString(textfsmFields.template),
  };
}

export function setSingleShowFields(showFields = {}) {
  setShowFormFields("show", { mode: safeString(showFields.mode) });
}

export function setShowTextfsmFields(textfsmFields = {}) {
  setShowFormFields("textfsm", showTextfsmPayloadFromFields(textfsmFields));
}

export function setBatchShowFields(showFields = {}, textfsmFields = {}) {
  setShowFormFields("batchShow", {
    maxParallel: safeString(showFields.maxParallel ?? ""),
    mode: safeString(showFields.mode),
    ...showTextfsmPayloadFromFields(textfsmFields),
  });
}

export function setSingleShowRetryFields(retry = createSessionRetryState()) {
  setShowFormFields("singleRetry", retry);
}

export function setBatchShowRetryFields(retry = createSessionRetryState()) {
  setShowFormFields("batchRetry", retry);
}

export function normalizeBatchMaxParallel(value) {
  const parsed = Number.parseInt(safeString(value).trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizedSelectionSet(values = []) {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => safeString(value).trim())
      .filter(Boolean),
  );
}

export function resolveBatchShowTargetConnections({
  connections = [],
  groups = [],
  labels = [],
  targets = [],
} = {}) {
  const targetNames = normalizedSelectionSet(targets);
  const groupNames = normalizedSelectionSet(groups);
  const labelNames = normalizedSelectionSet(labels);
  return (Array.isArray(connections) ? connections : []).filter(
    (connection) => {
      const name = safeString(connection?.name).trim();
      const connectionGroups = Array.isArray(connection?.groups)
        ? connection.groups
        : [];
      const connectionLabels = Array.isArray(connection?.labels)
        ? connection.labels
        : [];
      return (
        targetNames.has(name) ||
        connectionGroups.some((group) =>
          groupNames.has(safeString(group).trim()),
        ) ||
        connectionLabels.some((label) =>
          labelNames.has(safeString(label).trim()),
        )
      );
    },
  );
}

export function intersectBatchShowObjectPayloads(payloads = []) {
  const normalizedPayloads = Array.isArray(payloads) ? payloads : [];
  if (!normalizedPayloads.length) return [];
  const firstObjects = Array.isArray(normalizedPayloads[0]?.objects)
    ? normalizedPayloads[0].objects
    : [];
  const remainingObjectSets = normalizedPayloads
    .slice(1)
    .map(
      (payload) =>
        new Set(
          (Array.isArray(payload?.objects) ? payload.objects : [])
            .map((object) => safeString(object?.object).trim())
            .filter(Boolean),
        ),
    );
  const seenObjects = new Set();
  return firstObjects.filter((object) => {
    const objectName = safeString(object?.object).trim();
    if (!objectName || seenObjects.has(objectName)) return false;
    seenObjects.add(objectName);
    return remainingObjectSets.every((objectSet) => objectSet.has(objectName));
  });
}

function showFormFields(key, stateContext = currentShowStateContext()) {
  const fields = stateContext.showFormFieldsState.get(key);
  return fields && typeof fields === "object" && !Array.isArray(fields)
    ? fields
    : {};
}

export function isBatchShowBusy(keys = []) {
  return (keys || []).includes("execute");
}

function showQueryConfig(queryOrKey) {
  const key = safeString(queryOrKey || "").trim();
  return (
    SHOW_QUERY_CONFIG[key] ||
    Object.values(SHOW_QUERY_CONFIG).find(
      (config) => config.objectPicker === key,
    ) ||
    SHOW_QUERY_CONFIG[SHOW_QUERY.single]
  );
}

export function showObjectPickerKey(queryOrKey) {
  return showQueryConfig(queryOrKey).objectPicker;
}

function setShowExecutionResult(
  executionResult = {},
  stateContext = currentShowStateContext(),
) {
  stateContext.showExecutionResult.set(executionResult || EMPTY_RESULT);
}

function setBatchShowExecutionResult(
  executionResult = {},
  stateContext = currentShowStateContext(),
) {
  stateContext.batchShowExecutionResult.set(executionResult || EMPTY_RESULT);
}

function textfsmPlatformValue(form = {}, override = "") {
  return (
    safeString(override ?? "").trim() ||
    safeString(form.textfsmPlatform ?? form.textfsm_platform ?? "").trim() ||
    null
  );
}

function textfsmParseEnabled(form = {}) {
  return !!(form.parseTextfsm ?? form.parse_textfsm);
}

function textfsmStrictErrors(form = {}) {
  return !!(form.textfsmStrictErrors ?? form.textfsm_strict_errors);
}

function textfsmPayload(
  form = showFormFields("textfsm"),
  platformOverride = "",
) {
  return {
    textfsm_platform: textfsmPlatformValue(form, platformOverride),
    no_parse: !textfsmParseEnabled(form),
    textfsm_strict_errors: textfsmStrictErrors(form),
  };
}

function setShowCommandPreviewRows(
  queryOrKey,
  rows = [],
  stateContext = currentShowStateContext(),
) {
  const config = showQueryConfig(queryOrKey);
  stateContext.showCommandPreviewRows.update((currentRows) => ({
    ...currentRows,
    [config.key]: Array.isArray(rows) ? rows : [],
  }));
}

function selectedShowObjects(queryOrKey) {
  return connectionPickerValues(showObjectPickerKey(queryOrKey));
}

function showBasePayload(queryOrKey, form, textfsm = textfsmPayload(form)) {
  const objects = selectedShowObjects(queryOrKey);
  return {
    object: objects[0] || "",
    objects,
    mode: safeString(form.mode ?? "").trim() || null,
    ...textfsm,
  };
}

function showExecutionPayload({ connection, recordLevel }) {
  return {
    ...showBasePayload(
      SHOW_QUERY.single,
      showFormFields("show"),
      textfsmPayload(),
    ),
    ...sessionRetryRequestFields(showFormFields("singleRetry")),
    connection,
    record_level: recordLevel,
  };
}

function batchShowExecutionPayload({ recordLevel }) {
  const batchForm = showFormFields("batchShow");
  const maxParallel = normalizeBatchMaxParallel(batchForm.maxParallel);
  return {
    ...showBasePayload(SHOW_QUERY.batch, batchForm),
    targets: connectionPickerValues(CONNECTION_PICKER.batchShowTargets),
    groups: connectionPickerValues(CONNECTION_PICKER.batchShowGroups),
    labels: connectionPickerValues(CONNECTION_PICKER.batchShowLabels),
    ...(maxParallel ? { max_parallel: maxParallel } : {}),
    ...sessionRetryRequestFields(showFormFields("batchRetry")),
    record_level: recordLevel,
  };
}

async function exportBatchShowExcelIfRequested(batchShowResult) {
  const batchForm = showFormFields("batchShow");
  const filename = safeString(batchForm.excelName ?? "").trim() || "";
  if (!filename) return;
  const sheets = parsedOutputSheetsFromBatchShow(batchShowResult);
  if (!sheets.length) return;
  const { blob, filename: responseFilename } = await exportTextfsmExcel({
    filename,
    sheets,
  });
  downloadBlob(blob, responseFilename || filename);
}

function showObjectQueryPayload(platformOverride = "") {
  const profile = safeString(currentExecutionConnectionProfile()).trim();
  return {
    deviceProfile: profile && profile !== "autodetect" ? profile : "",
    textfsmPlatform:
      textfsmPayload(undefined, platformOverride).textfsm_platform || "",
  };
}

function refreshObjectOptions(
  queryOrKey,
  showObjectsPayload,
  selected = "",
  onRefreshed = null,
) {
  const pickerKey = showObjectPickerKey(queryOrKey);
  const objects = Array.isArray(showObjectsPayload?.objects)
    ? showObjectsPayload.objects
    : [];
  const selectedValues = Array.isArray(selected)
    ? selected
    : selected
      ? [selected]
      : [];

  function finishPickerRefresh() {
    refreshConnectionPickerSelected(pickerKey);
    hideConnectionPickerMenu(pickerKey);
    if (typeof onRefreshed === "function") onRefreshed();
  }

  if (
    setShowObjectPickerOptions(
      pickerKey,
      objects,
      selectedValues,
      finishPickerRefresh,
    )
  ) {
    return;
  }

  finishPickerRefresh();
}

function showCommandPreviewRow(object, objectPicker, platform) {
  const meta = showObjectOptionMeta(objectPicker, object);
  return {
    commandText: safeString(meta.command || "-"),
    fields: {
      command: safeString(meta.command || "-"),
      mapping: safeString(meta.textfsmMappingCommand || "-"),
      mode: safeString(meta.mode || "-"),
      platform: safeString(platform || "-"),
      source: safeString(meta.source || "-"),
      textfsm: safeString(meta.textfsmTemplate || "-"),
    },
    objectName: safeString(object),
  };
}

function updateShowCommandPreviewFor(queryOrKey, platform = "") {
  const config = showQueryConfig(queryOrKey);
  const selectedObjects = selectedShowObjects(config.key);
  const platformText =
    platform ||
    currentShowStateContext().showObjectPlatformState.get(config.key) ||
    "";
  const previewRows = selectedObjects.map((object) =>
    showCommandPreviewRow(object, config.objectPicker, platformText),
  );
  setShowCommandPreviewRows(config.key, previewRows);
}

export function updateShowCommandPreview(platform = "") {
  updateShowCommandPreviewFor(SHOW_QUERY.single, platform);
}

export function updateBatchShowCommandPreview(platform = "") {
  updateShowCommandPreviewFor(SHOW_QUERY.batch, platform);
}

export async function loadShowObjects(platformOverride = "") {
  const stateContext = currentShowStateContext();
  const selected = selectedShowObjects(SHOW_QUERY.single);
  const requestSeq = ++stateContext.showObjectsRequestSeq;
  try {
    const showObjectsPayload = await listShowObjects(
      showObjectQueryPayload(platformOverride),
    );
    if (requestSeq !== stateContext.showObjectsRequestSeq) return;
    stateContext.showObjectPlatformState.set(
      SHOW_QUERY.single,
      showObjectsPayload?.platform || "",
    );
    refreshObjectOptions(SHOW_QUERY.single, showObjectsPayload, selected, () =>
      updateShowCommandPreview(
        showObjectsPayload?.platform || platformOverride || "",
      ),
    );
  } catch (error) {
    if (requestSeq !== stateContext.showObjectsRequestSeq) return;
    setShowExecutionResult({ kind: "error", message: error.message });
  }
}

function currentBatchShowTargetSelection() {
  const targets = connectionPickerValues(CONNECTION_PICKER.batchShowTargets);
  const groups = connectionPickerValues(CONNECTION_PICKER.batchShowGroups);
  const labels = connectionPickerValues(CONNECTION_PICKER.batchShowLabels);
  const savedConnectionState = getStore(savedConnectionSelectState);
  const connections = resolveBatchShowTargetConnections({
    connections: savedConnectionState?.connections,
    groups,
    labels,
    targets,
  });
  const missingProfileNames = connections
    .filter((connection) => {
      const profile = safeString(connection?.device_profile).trim();
      return !profile || profile === "autodetect";
    })
    .map((connection) => safeString(connection?.name).trim())
    .filter(Boolean);
  const profiles = Array.from(
    new Set(
      connections
        .map((connection) => safeString(connection?.device_profile).trim())
        .filter((profile) => profile && profile !== "autodetect"),
    ),
  ).sort((left, right) => left.localeCompare(right));
  return {
    connections,
    hasSelectors: Boolean(targets.length || groups.length || labels.length),
    missingProfileNames,
    profiles,
  };
}

function setBatchShowObjectAvailability(availability = {}) {
  currentShowStateContext().batchShowObjectAvailability.set({
    ...EMPTY_BATCH_SHOW_OBJECT_AVAILABILITY,
    ...availability,
  });
}

function clearBatchShowObjectOptions(onRefreshed = null) {
  currentShowStateContext().showObjectPlatformState.set(SHOW_QUERY.batch, "");
  refreshObjectOptions(SHOW_QUERY.batch, { objects: [] }, [], onRefreshed);
}

export async function loadBatchShowObjects() {
  const stateContext = currentShowStateContext();
  const selected = selectedShowObjects(SHOW_QUERY.batch);
  const requestSeq = ++stateContext.batchShowObjectsRequestSeq;
  const targetSelection = currentBatchShowTargetSelection();
  const connectionCount = targetSelection.connections.length;
  if (!targetSelection.hasSelectors) {
    setBatchShowObjectAvailability({ status: "waiting" });
    clearBatchShowObjectOptions(() => updateBatchShowCommandPreview());
    return;
  }
  if (!connectionCount) {
    setBatchShowObjectAvailability({ status: "no-targets" });
    clearBatchShowObjectOptions(() => updateBatchShowCommandPreview());
    return;
  }
  if (targetSelection.missingProfileNames.length) {
    setBatchShowObjectAvailability({
      connectionCount,
      missingProfileNames: targetSelection.missingProfileNames,
      profiles: targetSelection.profiles,
      status: "missing-profile",
    });
    clearBatchShowObjectOptions(() => updateBatchShowCommandPreview());
    return;
  }
  setBatchShowObjectAvailability({
    connectionCount,
    profiles: targetSelection.profiles,
    status: "loading",
  });
  try {
    const profilePayloads = await Promise.all(
      targetSelection.profiles.map((deviceProfile) =>
        listShowObjects({ deviceProfile }),
      ),
    );
    if (requestSeq !== stateContext.batchShowObjectsRequestSeq) return;
    const commonObjects = intersectBatchShowObjectPayloads(profilePayloads);
    const commonObjectNames = new Set(
      commonObjects.map((object) => safeString(object?.object).trim()),
    );
    const retainedSelection = selected.filter((object) =>
      commonObjectNames.has(object),
    );
    stateContext.showObjectPlatformState.set(
      SHOW_QUERY.batch,
      targetSelection.profiles.join(", "),
    );
    refreshObjectOptions(
      SHOW_QUERY.batch,
      { objects: commonObjects },
      retainedSelection,
      () => updateBatchShowCommandPreview(targetSelection.profiles.join(", ")),
    );
    setBatchShowObjectAvailability({
      connectionCount,
      objectCount: commonObjects.length,
      profiles: targetSelection.profiles,
      status: commonObjects.length ? "ready" : "empty",
    });
  } catch (error) {
    if (requestSeq !== stateContext.batchShowObjectsRequestSeq) return;
    clearBatchShowObjectOptions(() => updateBatchShowCommandPreview());
    setBatchShowObjectAvailability({
      connectionCount,
      errorMessage: error.message,
      profiles: targetSelection.profiles,
      status: "error",
    });
  }
}

export function showConnectionTargetIdentity(target = {}) {
  const details =
    target && typeof target === "object" && target.details
      ? target.details
      : {};
  return [
    target && typeof target === "object" && target.kind ? target.kind : "none",
    details.name || "",
    details.host || "",
    details.profile || details.device_profile || "",
  ].join("|");
}

export async function refreshShowObjects() {
  await Promise.allSettled([loadShowObjects(), loadBatchShowObjects()]);
}

export async function executeShowObject() {
  if (!ensureConnectionTargetSelected()) {
    return;
  }
  const objects = selectedShowObjects(SHOW_QUERY.single);
  if (!objects.length) {
    setShowExecutionResult({
      kind: "error",
      message: t("showObjectRequired"),
    });
    return;
  }
  setShowExecutionResult({ kind: "running" });
  try {
    const basePayload = showExecutionPayload({
      connection: connectionPayload(),
      recordLevel: recordLevelPayload(),
    });
    const showResults = [];
    for (const object of objects) {
      showResults.push(await executeShowRequest({ ...basePayload, object }));
    }
    setShowExecutionResult({
      kind: "result",
      basePayload,
      results: showResults,
    });
    applyRecordDrawerRecording(showResults[showResults.length - 1]);
  } catch (error) {
    setShowExecutionResult({ kind: "error", message: error.message });
  }
}

export async function executeBatchShowObject() {
  const objects = selectedShowObjects(SHOW_QUERY.batch);
  if (!objects.length) {
    setBatchShowExecutionResult({
      kind: "error",
      message: t("showObjectRequired"),
    });
    return;
  }
  const payload = batchShowExecutionPayload({
    recordLevel: recordLevelPayload(),
  });
  if (
    !payload.targets.length &&
    !payload.groups.length &&
    !payload.labels.length
  ) {
    setBatchShowExecutionResult({
      kind: "error",
      message: t("batchShowTargetRequired"),
    });
    return;
  }
  setBatchShowExecutionResult({ kind: "running" });
  try {
    const batchShowResult = await executeShowBatchRequest({
      ...payload,
      object: objects[0],
      objects,
    });
    setBatchShowExecutionResult({
      kind: "result",
      resultPayload: batchShowResult,
    });
    await exportBatchShowExcelIfRequested(batchShowResult);
  } catch (error) {
    setBatchShowExecutionResult({ kind: "error", message: error.message });
  }
}

setCustomShowObjectsChangedCallback(() => refreshShowObjects());
