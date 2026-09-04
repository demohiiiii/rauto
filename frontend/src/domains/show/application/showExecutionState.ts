import {
  normalizeShowQuery,
  SHOW_QUERY,
} from "../../../config/dashboardModes.js";
import { get as getStore, writable } from "svelte/store";
import { t } from "../../../lib/i18n.js";
import { downloadBlob, safeString } from "../../../lib/ui.js";
import { showApi } from "../infrastructure/showApi.js";
import { showRuntime } from "../infrastructure/showRuntime.js";
import {
  intersectBatchShowObjectPayloads,
  normalizeBatchMaxParallel,
  resolveBatchShowTargetConnections,
} from "../model/show.js";
import type {
  BatchShowExecutionResult,
  ShowBatchExecutePayload,
  ShowBatchExecuteResponse,
  BatchShowObjectAvailability,
  ShowCommandPreviewRow,
  ShowExecutionResult,
  ShowExecuteBasePayload,
  ShowObjectDefinition,
  ShowObjectsPayload,
  ShowStateContext,
  ShowStoredBatchFields,
  ShowStoredTextfsmFields,
} from "../model/types.js";
import { parsedOutputSheetsFromBatchShow } from "$domains/execution/index.js";
import { CONNECTION_PICKER } from "$domains/connections/index.js";
import type { ConnectionRequestPayload } from "$domains/connections/index.js";
import type { RecordLevel } from "$domains/overlays/index.js";
import {
  createSessionRetryState,
  sessionRetryRequestFields,
} from "$domains/execution/index.js";
import type { SessionRetryState } from "$domains/execution/index.js";

type ShowQueryKey = string;

interface ShowSelectionInput {
  maxParallel?: string;
  mode?: string;
}

interface ShowTextfsmInput {
  enabled?: boolean;
  excelName?: string;
  platform?: string;
  strictErrors?: boolean;
  template?: string;
}

interface ShowQueryConfig {
  key: string;
  objectPicker: string;
}

type BatchShowBasePayload = Pick<
  ShowBatchExecutePayload,
  | "mode"
  | "no_parse"
  | "object"
  | "objects"
  | "textfsm_platform"
  | "textfsm_strict_errors"
>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const showExecutionConnectionProfileState =
  showRuntime.executionConnectionProfileState;
export const showConnectionTargetState = showRuntime.connectionTargetState;
export const refreshShowExecutionModeOptions =
  showRuntime.refreshExecutionModeOptions;

export const EMPTY_RESULT = { kind: "empty" } as const;
export const EMPTY_BATCH_SHOW_OBJECT_AVAILABILITY = Object.freeze({
  connectionCount: 0,
  missingProfileNames: [] as string[],
  objectCount: 0,
  profiles: [] as string[],
  status: "waiting" as const,
}) as BatchShowObjectAvailability;
export const DEFAULT_SHOW_PAGE_QUERY = normalizeShowQuery(SHOW_QUERY.single);

const SHOW_QUERY_CONFIG: Readonly<Record<string, ShowQueryConfig>> =
  Object.freeze({
    [SHOW_QUERY.single]: {
      key: SHOW_QUERY.single,
      objectPicker: CONNECTION_PICKER.showObject,
    },
    [SHOW_QUERY.batch]: {
      key: SHOW_QUERY.batch,
      objectPicker: CONNECTION_PICKER.batchShowObject,
    },
  });

function createShowStateContext(): ShowStateContext {
  return {
    batchShowExecutionResult: writable<BatchShowExecutionResult>(EMPTY_RESULT),
    batchShowObjectAvailability: writable<BatchShowObjectAvailability>(
      EMPTY_BATCH_SHOW_OBJECT_AVAILABILITY,
    ),
    batchShowObjectsRequestSeq: 0,
    showCommandPreviewRows: writable<Record<string, ShowCommandPreviewRow[]>>(
      {},
    ),
    showExecutionResult: writable<ShowExecutionResult>(EMPTY_RESULT),
    showFormFieldsState: {
      batchRetry: createSessionRetryState(),
      batchShow: {
        excelName: "",
        maxParallel: "",
        mode: "",
        parseTextfsm: true,
        textfsmPlatform: "",
        textfsmStrictErrors: false,
        textfsmTemplate: "",
      },
      show: { mode: "" },
      singleRetry: createSessionRetryState(),
      textfsm: {
        excelName: "",
        parseTextfsm: true,
        textfsmPlatform: "",
        textfsmStrictErrors: false,
        textfsmTemplate: "",
      },
    },
    showObjectPlatformState: new Map<string, string>(),
    showObjectsRequestSeq: 0,
  };
}

let showStateContext: ShowStateContext | null = null;

function currentShowStateContext(): ShowStateContext {
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

function showTextfsmPayloadFromFields(
  textfsmFields: ShowTextfsmInput = {},
): ShowStoredTextfsmFields {
  return {
    excelName: safeString(textfsmFields.excelName ?? "").trim(),
    parseTextfsm: !!textfsmFields.enabled,
    textfsmPlatform: safeString(textfsmFields.platform),
    textfsmStrictErrors: !!textfsmFields.strictErrors,
    textfsmTemplate: safeString(textfsmFields.template),
  };
}

export function setSingleShowFields(showFields: ShowSelectionInput = {}): void {
  currentShowStateContext().showFormFieldsState.show = {
    mode: safeString(showFields.mode),
  };
}

export function setShowTextfsmFields(
  textfsmFields: ShowTextfsmInput = {},
): void {
  currentShowStateContext().showFormFieldsState.textfsm =
    showTextfsmPayloadFromFields(textfsmFields);
}

export function setBatchShowFields(
  showFields: ShowSelectionInput = {},
  textfsmFields: ShowTextfsmInput = {},
): void {
  currentShowStateContext().showFormFieldsState.batchShow = {
    maxParallel: safeString(showFields.maxParallel ?? ""),
    mode: safeString(showFields.mode),
    ...showTextfsmPayloadFromFields(textfsmFields),
  };
}

export function setSingleShowRetryFields(
  retry: SessionRetryState = createSessionRetryState(),
): void {
  currentShowStateContext().showFormFieldsState.singleRetry = { ...retry };
}

export function setBatchShowRetryFields(
  retry: SessionRetryState = createSessionRetryState(),
): void {
  currentShowStateContext().showFormFieldsState.batchRetry = { ...retry };
}

export function isBatchShowBusy(keys: string[] = []): boolean {
  return (keys || []).includes("execute");
}

function showQueryConfig(queryOrKey: string): ShowQueryConfig {
  const key = safeString(queryOrKey || "").trim();
  return (
    SHOW_QUERY_CONFIG[key] ||
    Object.values(SHOW_QUERY_CONFIG).find(
      (config) => config.objectPicker === key,
    ) ||
    SHOW_QUERY_CONFIG[SHOW_QUERY.single]
  );
}

export function showObjectPickerKey(queryOrKey: string): string {
  return showQueryConfig(queryOrKey).objectPicker;
}

function setShowExecutionResult(
  executionResult: ShowExecutionResult = EMPTY_RESULT,
  stateContext: ShowStateContext = currentShowStateContext(),
): void {
  stateContext.showExecutionResult.set(executionResult);
}

function setBatchShowExecutionResult(
  executionResult: BatchShowExecutionResult = EMPTY_RESULT,
  stateContext: ShowStateContext = currentShowStateContext(),
): void {
  stateContext.batchShowExecutionResult.set(executionResult);
}

function textfsmPlatformValue(
  form: ShowStoredTextfsmFields,
  override = "",
): string | null {
  return (
    safeString(override ?? "").trim() || form.textfsmPlatform.trim() || null
  );
}

function textfsmParseEnabled(form: ShowStoredTextfsmFields): boolean {
  return form.parseTextfsm;
}

function textfsmStrictErrors(form: ShowStoredTextfsmFields): boolean {
  return form.textfsmStrictErrors;
}

function textfsmPayload(
  form: ShowStoredTextfsmFields = currentShowStateContext().showFormFieldsState
    .textfsm,
  platformOverride = "",
) {
  return {
    textfsm_platform: textfsmPlatformValue(form, platformOverride),
    no_parse: !textfsmParseEnabled(form),
    textfsm_strict_errors: textfsmStrictErrors(form),
  };
}

function setShowCommandPreviewRows(
  queryOrKey: string,
  rows: ShowCommandPreviewRow[] = [],
  stateContext: ShowStateContext = currentShowStateContext(),
): void {
  const config = showQueryConfig(queryOrKey);
  stateContext.showCommandPreviewRows.update((currentRows) => ({
    ...currentRows,
    [config.key]: Array.isArray(rows) ? rows : [],
  }));
}

function selectedShowObjects(queryOrKey: string): string[] {
  return showRuntime.pickerValues(showObjectPickerKey(queryOrKey));
}

function showBasePayload(
  queryOrKey: string,
  form: ShowStoredBatchFields,
  textfsm = textfsmPayload(form),
): BatchShowBasePayload {
  const objects = selectedShowObjects(queryOrKey);
  return {
    object: objects[0] || "",
    objects,
    mode: safeString(form.mode ?? "").trim() || null,
    ...textfsm,
  };
}

function showExecutionPayload({
  connection,
  recordLevel,
}: {
  connection: ConnectionRequestPayload;
  recordLevel: RecordLevel;
}): ShowExecuteBasePayload {
  const { show: form, singleRetry } =
    currentShowStateContext().showFormFieldsState;
  return {
    mode: safeString(form.mode ?? "").trim() || null,
    ...textfsmPayload(),
    ...sessionRetryRequestFields(singleRetry),
    connection,
    record_level: recordLevel,
  };
}

function batchShowExecutionPayload({
  recordLevel,
}: {
  recordLevel: RecordLevel;
}): ShowBatchExecutePayload {
  const { batchRetry, batchShow: batchForm } =
    currentShowStateContext().showFormFieldsState;
  const maxParallel = normalizeBatchMaxParallel(
    safeString(batchForm.maxParallel),
  );
  return {
    ...showBasePayload(SHOW_QUERY.batch, batchForm),
    targets: showRuntime.pickerValues(CONNECTION_PICKER.batchShowTargets),
    groups: showRuntime.pickerValues(CONNECTION_PICKER.batchShowGroups),
    labels: showRuntime.pickerValues(CONNECTION_PICKER.batchShowLabels),
    ...(maxParallel ? { max_parallel: maxParallel } : {}),
    ...sessionRetryRequestFields(batchRetry),
    record_level: recordLevel,
  };
}

async function exportBatchShowExcelIfRequested(
  batchShowResult: ShowBatchExecuteResponse,
): Promise<void> {
  const batchForm = currentShowStateContext().showFormFieldsState.batchShow;
  const filename = safeString(batchForm.excelName ?? "").trim() || "";
  if (!filename) return;
  const sheets = parsedOutputSheetsFromBatchShow(batchShowResult);
  if (!sheets.length) return;
  const { blob, filename: responseFilename } = await showApi.exportExcel({
    filename,
    sheets,
  });
  downloadBlob(blob, responseFilename || filename);
}

function showObjectQueryPayload(platformOverride = "") {
  const profile = safeString(showRuntime.currentExecutionProfile()).trim();
  return {
    deviceProfile: profile && profile !== "autodetect" ? profile : "",
    textfsmPlatform:
      textfsmPayload(
        currentShowStateContext().showFormFieldsState.textfsm,
        platformOverride,
      ).textfsm_platform || "",
  };
}

function refreshObjectOptions(
  queryOrKey: string,
  showObjectsPayload: ShowObjectsPayload,
  selected: string | string[] = "",
  onRefreshed: (() => void) | null = null,
): void {
  const pickerKey = showObjectPickerKey(queryOrKey);
  const objects = showObjectsPayload.objects;
  const selectedValues = Array.isArray(selected)
    ? selected
    : selected
      ? [selected]
      : [];

  function finishPickerRefresh() {
    showRuntime.refreshPickerSelected(pickerKey);
    showRuntime.hidePickerMenu(pickerKey);
    onRefreshed?.();
  }

  if (
    showRuntime.setObjectPickerOptions(
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

function showCommandPreviewRow(
  object: string,
  objectPicker: string,
  platform: string,
): ShowCommandPreviewRow {
  const meta = showRuntime.showObjectOptionMeta(objectPicker, object);
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

function updateShowCommandPreviewFor(
  queryOrKey: ShowQueryKey,
  platform = "",
): void {
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

export function updateShowCommandPreview(platform = ""): void {
  updateShowCommandPreviewFor(SHOW_QUERY.single, platform);
}

export function updateBatchShowCommandPreview(platform = ""): void {
  updateShowCommandPreviewFor(SHOW_QUERY.batch, platform);
}

export async function loadShowObjects(platformOverride = ""): Promise<void> {
  const stateContext = currentShowStateContext();
  const selected = selectedShowObjects(SHOW_QUERY.single);
  const requestSeq = ++stateContext.showObjectsRequestSeq;
  try {
    const showObjectsPayload = await showApi.listObjects(
      showObjectQueryPayload(platformOverride),
    );
    if (requestSeq !== stateContext.showObjectsRequestSeq) return;
    stateContext.showObjectPlatformState.set(
      SHOW_QUERY.single,
      showObjectsPayload.platform || "",
    );
    refreshObjectOptions(SHOW_QUERY.single, showObjectsPayload, selected, () =>
      updateShowCommandPreview(
        showObjectsPayload.platform || platformOverride || "",
      ),
    );
  } catch (error) {
    if (requestSeq !== stateContext.showObjectsRequestSeq) return;
    setShowExecutionResult({ kind: "error", message: errorMessage(error) });
  }
}

function currentBatchShowTargetSelection() {
  const targets = showRuntime.pickerValues(CONNECTION_PICKER.batchShowTargets);
  const groups = showRuntime.pickerValues(CONNECTION_PICKER.batchShowGroups);
  const labels = showRuntime.pickerValues(CONNECTION_PICKER.batchShowLabels);
  const savedConnectionState = getStore(showRuntime.savedConnectionSelectState);
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

function setBatchShowObjectAvailability(
  availability: Partial<BatchShowObjectAvailability> = {},
): void {
  currentShowStateContext().batchShowObjectAvailability.set({
    ...EMPTY_BATCH_SHOW_OBJECT_AVAILABILITY,
    ...availability,
  });
}

function clearBatchShowObjectOptions(
  onRefreshed: (() => void) | null = null,
): void {
  currentShowStateContext().showObjectPlatformState.set(SHOW_QUERY.batch, "");
  refreshObjectOptions(
    SHOW_QUERY.batch,
    { objects: [], platform: null },
    [],
    onRefreshed,
  );
}

export async function loadBatchShowObjects(): Promise<void> {
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
        showApi.listObjects({ deviceProfile }),
      ),
    );
    if (requestSeq !== stateContext.batchShowObjectsRequestSeq) return;
    const commonObjects = intersectBatchShowObjectPayloads(profilePayloads);
    const commonObjectNames = new Set(
      commonObjects.map((object) => object.object.trim()),
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
      { objects: commonObjects, platform: null },
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
      errorMessage: errorMessage(error),
      profiles: targetSelection.profiles,
      status: "error",
    });
  }
}

export async function refreshShowObjects(): Promise<void> {
  await Promise.allSettled([loadShowObjects(), loadBatchShowObjects()]);
}

export async function executeShowObject(): Promise<void> {
  if (!showRuntime.ensureConnectionTargetSelected()) {
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
      connection: showRuntime.connectionPayload(),
      recordLevel: showRuntime.recordLevelPayload(),
    });
    const showResults = [];
    for (const object of objects) {
      showResults.push(await showApi.execute({ ...basePayload, object }));
    }
    setShowExecutionResult({
      kind: "result",
      basePayload,
      results: showResults,
    });
    showRuntime.applyRecording(showResults[showResults.length - 1]);
  } catch (error) {
    setShowExecutionResult({ kind: "error", message: errorMessage(error) });
  }
}

export async function executeBatchShowObject(): Promise<void> {
  const objects = selectedShowObjects(SHOW_QUERY.batch);
  if (!objects.length) {
    setBatchShowExecutionResult({
      kind: "error",
      message: t("showObjectRequired"),
    });
    return;
  }
  const payload = batchShowExecutionPayload({
    recordLevel: showRuntime.recordLevelPayload(),
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
    const batchShowResult = await showApi.executeBatch({
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
    setBatchShowExecutionResult({
      kind: "error",
      message: errorMessage(error),
    });
  }
}

showRuntime.setCustomObjectsChangedCallback(() => refreshShowObjects());
