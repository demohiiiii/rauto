import {
  executeShow as executeShowRequest,
  executeShowBatch as executeShowBatchRequest,
  exportTextfsmExcel,
  listShowObjects,
} from "../api/client.js";
import { normalizeShowQuery, SHOW_QUERY } from "../config/dashboardModes.js";
import { writable } from "svelte/store";
import { t } from "../lib/i18n.js";
import { downloadBlob, safeString } from "../lib/ui.js";
import { applyRecordDrawerRecording, recordLevelPayload } from "./overlays.js";
import { parsedOutputSheetsFromBatchShow } from "./results.js";
import {
  executionConnectionProfileState,
  refreshExecutionModeOptionsForCurrentConnection,
} from "./profiles.js";
import {
  CONNECTION_PICKER,
  connectionPickerValues,
  hideConnectionPickerMenu,
  refreshConnectionPickerSelected,
  setShowObjectPickerOptions,
  showObjectOptionMeta,
} from "./connectionFields.js";
import {
  connectionPayload,
  connectionTargetState,
  currentExecutionConnectionProfile,
  ensureConnectionTargetSelected,
} from "./connections.js";
import { setCustomShowObjectsChangedCallback } from "./templates.js";

export const showExecutionConnectionProfileState =
  executionConnectionProfileState;
export const showConnectionTargetState = connectionTargetState;
export const refreshShowExecutionModeOptions =
  refreshExecutionModeOptionsForCurrentConnection;

export const EMPTY_RESULT = { kind: "empty" };
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
    mode: safeString(showFields.mode),
    ...showTextfsmPayloadFromFields(textfsmFields),
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
    connection,
    record_level: recordLevel,
  };
}

function batchShowExecutionPayload({ recordLevel }) {
  const batchForm = showFormFields("batchShow");
  return {
    ...showBasePayload(SHOW_QUERY.batch, batchForm),
    targets: connectionPickerValues(CONNECTION_PICKER.batchShowTargets),
    groups: connectionPickerValues(CONNECTION_PICKER.batchShowGroups),
    labels: connectionPickerValues(CONNECTION_PICKER.batchShowLabels),
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

export async function loadBatchShowObjects() {
  const stateContext = currentShowStateContext();
  const selected = selectedShowObjects(SHOW_QUERY.batch);
  const requestSeq = ++stateContext.batchShowObjectsRequestSeq;
  try {
    const batchShowObjectsPayload = await listShowObjects({});
    if (requestSeq !== stateContext.batchShowObjectsRequestSeq) return;
    stateContext.showObjectPlatformState.set(
      SHOW_QUERY.batch,
      batchShowObjectsPayload?.platform || "",
    );
    refreshObjectOptions(
      SHOW_QUERY.batch,
      batchShowObjectsPayload,
      selected,
      () =>
        updateBatchShowCommandPreview(batchShowObjectsPayload?.platform || ""),
    );
  } catch (error) {
    if (requestSeq !== stateContext.batchShowObjectsRequestSeq) return;
    setBatchShowExecutionResult({ kind: "error", message: error.message });
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
