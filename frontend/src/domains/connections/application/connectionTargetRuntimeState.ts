import { currentLanguage, t } from "../../../lib/i18n.js";
import {
  displayString,
  downloadBlob,
  promptForResourceName,
  safeString,
  splitCsvValues,
} from "../../../lib/ui.js";
import { writable } from "svelte/store";
import { connectionApi } from "../infrastructure/connectionApi.js";
import {
  connectionBasicFieldWiring,
  connectionTimeoutSecsValue,
} from "$domains/connections/application/connectionFieldState.js";
import {
  CONNECTION_PICKER,
  CONNECTION_VARS,
  getConnectionGroupValues,
  getConnectionLabelValues,
  getConnectionVarsValue,
  refreshConnectionPickerOptions,
  refreshSavedConnectionGroupOptions,
  setConnectionDeviceProfiles as setConnectionFieldDeviceProfiles,
  setConnectionPickerSelectedValues,
  setConnectionVarsValue,
} from "$domains/connections/application/connectionFieldStoreState.js";
import { CONNECTION_MODAL_FOCUS_TARGET } from "$domains/connections/presentation/connectionTargetDisplayState.js";
import {
  activeConnectionTarget,
  clearSavedConnectionDetailCache,
  closeConnectionModal,
  connectionOverlayState,
  currentSavedConnections,
  isTemporaryConnectionActive,
  notifySavedConnectionsRefreshed,
  openConnectionModal,
  readPersistedConnectionTarget,
  refreshSidebarConnectionState,
  savedConnectionDetailsCache,
  selectedSavedConnectionName,
  setCachedSavedConnections,
  setCurrentConnectionTarget,
  setSavedConnectionSelectValue,
  setSavedConnectionStatus,
  setTemporaryConnectionState,
  storedTemporaryConnectionDetails,
  storedTemporaryConnectionLabel,
} from "$domains/connections/application/connectionTargetStoreState.js";
import {
  configureConnectionsEditor,
  detectedConnectionFactsPatch,
} from "$domains/connections/application/connectionEditorState.js";
import { configureConnectionHistory } from "$domains/connections/application/connectionsHistory.js";
import { openDetailModal, showToast } from "$domains/overlays/index.js";
import type {
  ConnectionDraft,
  ConnectionDraftPatch,
  ConnectionFactsResponse,
  ConnectionImportReport,
  ConnectionRequestPayload,
  ConnectionTargetDetails,
  ConnectionTestState,
  PersistedConnectionTarget,
  SavedConnection,
  SavedConnectionDetail,
  TemporaryConnectionFormState,
} from "../model/types.js";

interface ConnectionPayloadOptions {
  connectionName?: string | null;
  groups?: unknown;
  labels?: unknown;
  vars?: unknown;
}

const CONNECTION_FORM_TEXT_FIELDS: (keyof TemporaryConnectionFormState)[] = [
  "connect_timeout_secs",
  "device_model",
  "device_profile",
  "credential_id",
  "host",
  "linux_shell_flavor",
  "output_encoding",
  "port",
  "ssh_security",
  "software_version",
];

const CONNECTION_TEST_STATE_DEFAULTS: Readonly<ConnectionTestState> =
  Object.freeze({
    loading: false,
    status: null,
  });

export function createConnectionTestState(): ConnectionTestState {
  return { ...CONNECTION_TEST_STATE_DEFAULTS };
}

let temporaryConnectionFormState: TemporaryConnectionFormState = {
  connect_timeout_secs: "",
  credential_id: "",
  device_model: "",
  device_profile: "autodetect",
  enabled: true,
  host: "",
  linux_shell_flavor: "",
  output_encoding: "utf8",
  port: "",
  ssh_security: "",
  software_version: "",
};

export const temporaryConnectionFormStateStore =
  writable<TemporaryConnectionFormState>({
    ...temporaryConnectionFormState,
  });

function temporaryConnectionFormStateFromDraft(
  draft: ConnectionDraft,
): TemporaryConnectionFormState {
  return {
    connect_timeout_secs: draft.connectTimeoutSecs,
    credential_id: draft.credentialId,
    device_model: draft.deviceModel,
    device_profile: draft.deviceProfile || "autodetect",
    enabled: draft.enabled,
    host: draft.host,
    linux_shell_flavor: draft.linuxShellFlavor,
    output_encoding: draft.outputEncoding || "utf8",
    port: draft.port,
    ssh_security: draft.sshSecurity,
    software_version: draft.softwareVersion,
  };
}

function openConnectionTargetModal(): void {
  openConnectionModal(
    "saved",
    CONNECTION_MODAL_FOCUS_TARGET.savedConnectionSelect,
  );
}

function hasOwn(object: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function applyTemporaryConnectionFormFromDraft(draft: ConnectionDraft): void {
  setTemporaryConnectionFormState(temporaryConnectionFormStateFromDraft(draft));
}

function applyTemporaryConnectionDraftChange(
  draft: ConnectionDraft,
  patch: ConnectionDraftPatch = {},
): void {
  Object.assign(draft, patch);
  applyTemporaryConnectionFormFromDraft(draft);
  refreshActiveTemporaryConnectionTarget();
}

export function temporaryConnectionBasicFieldWiring(draft: ConnectionDraft) {
  const basicWiring = connectionBasicFieldWiring(
    draft,
    applyTemporaryConnectionDraftChange,
    { defaultDeviceProfile: true },
  );
  return {
    ...basicWiring,
    onDeviceModelInput(fieldValue: unknown) {
      applyTemporaryConnectionDraftChange(draft, {
        deviceModel: safeString(fieldValue || ""),
      });
    },
    onSoftwareVersionInput(fieldValue: unknown) {
      applyTemporaryConnectionDraftChange(draft, {
        softwareVersion: safeString(fieldValue || ""),
      });
    },
  };
}

export function updateTemporaryConnectionDraftEnabled(
  draft: ConnectionDraft,
  enabled = false,
): void {
  return applyTemporaryConnectionDraftChange(draft, { enabled: !!enabled });
}

function mergeConnectionFormState(
  current: TemporaryConnectionFormState,
  formVals: Partial<TemporaryConnectionFormState> = {},
): TemporaryConnectionFormState {
  const next = { ...current };
  CONNECTION_FORM_TEXT_FIELDS.forEach((key) => {
    if (hasOwn(formVals, key)) {
      next[key] = displayString(formVals[key] || "");
    }
  });
  if (hasOwn(formVals, "enabled")) {
    next.enabled = formVals.enabled !== false;
  }
  return next;
}

export function currentExecutionConnectionProfile(): string {
  const target = activeConnectionTarget();
  const targetProfile = safeString(
    target?.details?.profile || target?.details?.device_profile || "",
  ).trim();
  return (
    targetProfile ||
    displayString(temporaryConnectionFormState.device_profile || "").trim() ||
    "autodetect"
  );
}

function setTemporaryConnectionFormValues(
  formValues: Partial<TemporaryConnectionFormState> = {},
): void {
  setTemporaryConnectionFormState(formValues);
}

function setTemporaryConnectionFormState(
  formValues: Partial<TemporaryConnectionFormState> = {},
): TemporaryConnectionFormState {
  temporaryConnectionFormState = mergeConnectionFormState(
    temporaryConnectionFormState,
    formValues,
  );
  temporaryConnectionFormStateStore.set({ ...temporaryConnectionFormState });
  return temporaryConnectionFormState;
}

function hasSelectedConnectionTarget(): boolean {
  const currentConnectionTarget = activeConnectionTarget();
  return !!currentConnectionTarget && currentConnectionTarget.kind !== "none";
}

export function ensureConnectionTargetSelected(): boolean {
  if (hasSelectedConnectionTarget()) return true;
  const message = t("connectionTargetRequired");
  showToast(message, "warning");
  openConnectionTargetModal();
  return false;
}

function currentTemporaryConnectionLabel(): string {
  const label = storedTemporaryConnectionLabel();
  if (label) return label;
  const host = safeString(temporaryConnectionFormState.host || "").trim();
  if (!host) return t("sidebarConnectionTemporaryLabel");
  return `${t("sidebarConnectionTemporaryLabel")} · ${host}`;
}

export function currentTemporaryConnectionDetails(): ConnectionTargetDetails {
  const details = storedTemporaryConnectionDetails();
  if (details) {
    return {
      ...details,
      note: t("sidebarConnectionTemporaryHint"),
      kind: "temporary",
    };
  }
  return buildCurrentTemporaryConnectionDetails();
}

function savedConnectionDetails(
  savedConnection: Record<string, unknown> = {},
): ConnectionTargetDetails {
  const profile = safeString(savedConnection.device_profile || "autodetect");
  const linuxShellFlavor = savedConnection.linux_shell_flavor || "";
  return {
    name: safeString(savedConnection.name || "-"),
    host: safeString(savedConnection.host || "-"),
    port: Number(savedConnection.port || 22) || 22,
    credentialName:
      safeString(savedConnection.credential_name || "").trim() ||
      t("credentialRequired"),
    credentialRequired: savedConnection.credential_required === true,
    profile: profile || "autodetect",
    device_model: safeString(savedConnection.device_model || "").trim(),
    software_version: safeString(savedConnection.software_version || "").trim(),
    ssh_security: safeString(savedConnection.ssh_security || "").trim(),
    linux_shell_flavor: safeString(linuxShellFlavor).trim(),
    output_encoding: safeString(
      savedConnection.output_encoding || "utf8",
    ).trim(),
    kind: "saved",
    note: t("savedConnSubtitle"),
  };
}

const savedConnectionDetailsFromPayload = (
  connection: ConnectionRequestPayload,
  connectionName: string,
): ConnectionTargetDetails =>
  savedConnectionDetails({ ...connection, name: connectionName });

function buildCurrentTemporaryConnectionDetails(): ConnectionTargetDetails {
  return {
    name: currentTemporaryConnectionLabel(),
    host: safeString(temporaryConnectionFormState.host || "").trim() || "-",
    port: Number(temporaryConnectionFormState.port || 22) || 22,
    credentialId: safeString(
      temporaryConnectionFormState.credential_id || "",
    ).trim(),
    credentialName:
      safeString(temporaryConnectionFormState.credential_id || "").trim() ||
      t("credentialRequired"),
    credentialRequired: !safeString(
      temporaryConnectionFormState.credential_id || "",
    ).trim(),
    profile:
      safeString(
        temporaryConnectionFormState.device_profile || "autodetect",
      ).trim() || "autodetect",
    device_model: safeString(
      temporaryConnectionFormState.device_model || "",
    ).trim(),
    software_version: safeString(
      temporaryConnectionFormState.software_version || "",
    ).trim(),
    kind: "temporary",
    note: t("sidebarConnectionTemporaryHint"),
  };
}

function buildTemporaryConnectionDetailsFromPersisted(
  parsed: PersistedConnectionTarget,
): ConnectionTargetDetails {
  const host = safeString(parsed.host || "").trim();
  const credentialId = safeString(parsed.credential_id || "").trim();
  return {
    name: currentTemporaryConnectionLabel(),
    host: host || "-",
    port: Number(parsed.port || 22) || 22,
    credentialId,
    credentialName: credentialId || t("credentialRequired"),
    credentialRequired: !credentialId,
    profile:
      safeString(parsed.device_profile || "autodetect").trim() || "autodetect",
    device_model: safeString(parsed.device_model || "").trim(),
    software_version: safeString(parsed.software_version || "").trim(),
    kind: "temporary",
    note: t("sidebarConnectionTemporaryHint"),
  };
}

function persistedTemporaryConnectionTarget(
  details: ConnectionTargetDetails,
): PersistedConnectionTarget {
  return {
    kind: "temporary",
    host: safeString(details.host || "").trim(),
    port: Number(details.port || 22) || 22,
    credential_id: safeString(details.credentialId || "").trim(),
    device_profile:
      safeString(details.profile || "autodetect").trim() || "autodetect",
    device_model: safeString(details.device_model || "").trim(),
    software_version: safeString(details.software_version || "").trim(),
    ssh_security: safeString(
      temporaryConnectionFormState.ssh_security || "",
    ).trim(),
    linux_shell_flavor: safeString(
      temporaryConnectionFormState.linux_shell_flavor || "",
    ).trim(),
    output_encoding:
      safeString(
        temporaryConnectionFormState.output_encoding || "utf8",
      ).trim() || "utf8",
    connect_timeout_secs: temporaryConnectionFormState.connect_timeout_secs,
    enabled: temporaryConnectionFormState.enabled !== false,
    labels: getConnectionLabelValues(CONNECTION_PICKER.savedLabels),
    groups: getConnectionGroupValues(CONNECTION_PICKER.savedGroups),
    vars_text: JSON.stringify(getConnectionVarsValue(CONNECTION_VARS.saved)),
  };
}

function currentSavedConnectionName(): string {
  const target = activeConnectionTarget();
  if (target.kind === "saved") {
    const savedConnectionName = safeString(target.details?.name || "").trim();
    if (savedConnectionName) return savedConnectionName;
  }
  return selectedSavedConnectionName();
}

configureConnectionHistory({
  resolveCurrentSavedConnectionName: currentSavedConnectionName,
  setHistoryStatus: setSavedConnectionStatus,
});

function restoreTemporaryConnectionFormFromPersisted(
  parsed: PersistedConnectionTarget,
): ConnectionTargetDetails {
  setSavedConnectionSelectValue("");
  const host = safeString(parsed.host || "").trim();
  setTemporaryConnectionFormValues({
    credential_id: safeString(parsed.credential_id || "").trim(),
    device_model: safeString(parsed.device_model || "").trim(),
    device_profile:
      safeString(parsed.device_profile || "autodetect").trim() || "autodetect",
    enabled: parsed.enabled !== false,
    host,
    linux_shell_flavor: safeString(parsed.linux_shell_flavor || "").trim(),
    output_encoding: safeString(parsed.output_encoding || "utf8").trim(),
    port: safeString(parsed.port || 22),
    ssh_security: safeString(parsed.ssh_security || "").trim(),
    software_version: safeString(parsed.software_version || "").trim(),
  });
  setConnectionPickerSelectedValues(
    CONNECTION_PICKER.savedLabels,
    Array.isArray(parsed.labels)
      ? parsed.labels
      : splitCsvValues(parsed.labels || ""),
  );
  try {
    setConnectionVarsValue(
      CONNECTION_VARS.saved,
      parsed.vars_text ? JSON.parse(safeString(parsed.vars_text)) : {},
    );
  } catch (_) {
    setConnectionVarsValue(CONNECTION_VARS.saved, {});
  }
  refreshSavedConnectionGroupOptions(
    Array.isArray(parsed.groups) ? parsed.groups : [],
  );
  const details = buildTemporaryConnectionDetailsFromPersisted(parsed);
  setTemporaryConnectionState(true, "", details);
  setCurrentConnectionTarget(details, parsed);
  return details;
}

function applyTargetProfileToTemporaryForm(
  details: ConnectionTargetDetails | null,
): void {
  if (!details) return;
  const profile = safeString(
    details.profile || details.device_profile || "",
  ).trim();
  if (!profile) return;
  setTemporaryConnectionFormValues({ device_profile: profile });
}

async function ensureSavedConnectionDetail(
  savedConnectionName: string,
): Promise<SavedConnectionDetail | null> {
  const normalizedSavedConnectionName = safeString(
    savedConnectionName || "",
  ).trim();
  if (!normalizedSavedConnectionName) return null;
  const cache = savedConnectionDetailsCache();
  const cachedDetail = cache.get(normalizedSavedConnectionName);
  if (cachedDetail) return cachedDetail;
  const connectionDetail = await connectionApi.getConnection(
    normalizedSavedConnectionName,
  );
  cache.set(normalizedSavedConnectionName, connectionDetail);
  return connectionDetail;
}

function formatConnectionImportSummary(report: ConnectionImportReport): string {
  return `${t("savedConnImportDone")}: ${connectionImportSummaryEntries(report)
    .map(([label, summaryValue]) => `${label}=${summaryValue}`)
    .join(", ")}`;
}

function connectionImportSummaryEntries(
  report: Partial<ConnectionImportReport> = {},
): [string, string][] {
  return [
    [t("savedConnImportSummaryTotal"), safeString(report?.total_rows)],
    [t("savedConnImportSummaryImported"), safeString(report?.imported)],
    [t("savedConnImportSummaryCreated"), safeString(report?.created)],
    [t("savedConnImportSummaryUpdated"), safeString(report?.updated)],
    [t("savedConnImportSummaryFailed"), safeString(report?.failed)],
  ];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function applyConnectionForm(
  connection: ConnectionRequestPayload | SavedConnection = {},
): void {
  const port = Number(connection.port);
  setTemporaryConnectionFormValues({
    credential_id: displayString(connection.credential_id || ""),
    device_model: displayString(connection.device_model || ""),
    device_profile: displayString(connection.device_profile || ""),
    enabled: connection.enabled !== false,
    host: displayString(connection.host || ""),
    linux_shell_flavor: displayString(connection.linux_shell_flavor || ""),
    output_encoding: displayString(connection.output_encoding || "utf8"),
    port: Number.isFinite(port) && port > 0 ? String(port) : "",
    ssh_security: displayString(connection.ssh_security || ""),
    software_version: displayString(connection.software_version || ""),
  });
  setConnectionPickerSelectedValues(
    CONNECTION_PICKER.savedLabels,
    Array.isArray(connection.labels) ? connection.labels : [],
  );
  refreshSavedConnectionGroupOptions(
    Array.isArray(connection.groups) ? connection.groups : [],
  );
  setConnectionVarsValue(CONNECTION_VARS.saved, recordValue(connection.vars));
  refreshSidebarConnectionSelector();
}

export function refreshSavedConnectionOptions(selectedName = ""): void {
  setSavedConnectionSelectValue(selectedName);
  refreshConnectionPickerOptions(CONNECTION_PICKER.batchShowTargets);
}

export function refreshConnectionProfileOptions() {
  return undefined;
}

export function setConnectionDeviceProfiles(profiles: string[] = []) {
  const normalizedProfiles = Array.isArray(profiles) ? profiles : [];
  setConnectionFieldDeviceProfiles(normalizedProfiles);
  return normalizedProfiles;
}

export function refreshSidebarConnectionSelector(errorMessage = ""): void {
  refreshSidebarConnectionState({
    currentTemporaryConnectionDetails,
    errorMessage,
    savedConnectionDetails,
  });
}

function clearTemporaryConnectionActive(): void {
  setTemporaryConnectionState(false);
  if (activeConnectionTarget().kind === "temporary") {
    setCurrentConnectionTarget(null);
  }
  refreshSidebarConnectionSelector();
}

function markTemporaryConnectionActive(): void {
  const details = buildCurrentTemporaryConnectionDetails();
  setTemporaryConnectionState(true, currentTemporaryConnectionLabel(), details);
  setCurrentConnectionTarget(
    details,
    persistedTemporaryConnectionTarget(details),
  );
  refreshSidebarConnectionSelector();
}

export function refreshActiveTemporaryConnectionTarget(): void {
  if (!isTemporaryConnectionActive()) {
    return;
  }
  refreshSidebarConnectionSelector();
}

function restorePersistedConnectionTarget(): void {
  if (activeConnectionTarget().kind !== "none") return;
  const parsed = readPersistedConnectionTarget();
  if (!parsed) return;

  if (parsed.kind === "saved") {
    const targetName = safeString(parsed.name || "").trim();
    if (!targetName) return;
    const selectedSavedConnection = currentSavedConnections().find(
      (savedConnection) => savedConnection.name === targetName,
    );
    if (!selectedSavedConnection) return;
    setSavedConnectionSelectValue(targetName);
    clearTemporaryConnectionActive();
    applyConnectionForm(selectedSavedConnection);
    const details = savedConnectionDetails(selectedSavedConnection);
    setCurrentConnectionTarget(details);
    applyTargetProfileToTemporaryForm(details);
    return;
  }

  if (parsed.kind === "temporary") {
    restoreTemporaryConnectionFormFromPersisted(parsed);
  }
}

function runtimeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : safeString(error) || t("requestFailed");
}

export async function loadSavedConnections(): Promise<void> {
  try {
    const connectionsPayload = await connectionApi.listConnections();
    setCachedSavedConnections(connectionsPayload);
    refreshSavedConnectionOptions(selectedSavedConnectionName());
    refreshSavedConnectionGroupOptions(
      getConnectionGroupValues(CONNECTION_PICKER.savedGroups),
    );
    let target = activeConnectionTarget();
    if (target.kind === "saved" && target.details) {
      const targetName = safeString(target.details.name || "").trim();
      const selectedSavedConnection = currentSavedConnections().find(
        (savedConnection) => savedConnection.name === targetName,
      );
      if (selectedSavedConnection) {
        applyConnectionForm(selectedSavedConnection);
        const details = savedConnectionDetails(selectedSavedConnection);
        setCurrentConnectionTarget(details);
        applyTargetProfileToTemporaryForm(details);
      } else {
        if (currentSavedConnectionName() === targetName) {
          setSavedConnectionSelectValue("");
        }
        setCurrentConnectionTarget(null);
      }
    }
    target = activeConnectionTarget();
    if (target.kind === "none") {
      restorePersistedConnectionTarget();
    }
    notifySavedConnectionsRefreshed();
    refreshSidebarConnectionSelector();
  } catch (e) {
    setCachedSavedConnections([]);
    clearSavedConnectionDetailCache();
    refreshSavedConnectionOptions("");
    refreshSavedConnectionGroupOptions([]);
    notifySavedConnectionsRefreshed();
    refreshSidebarConnectionSelector(runtimeErrorMessage(e));
  }
}

function currentCachedSavedConnections(): SavedConnection[] {
  return currentSavedConnections();
}

function showSavedConnectionEditorModal(): void {
  connectionOverlayState.update((state) => ({
    ...state,
    savedEditorOpen: true,
  }));
}

function closeSavedConnectionEditorModal(): void {
  connectionOverlayState.update((state) => ({
    ...state,
    savedEditorOpen: false,
  }));
}

configureConnectionsEditor({
  cacheSavedConnectionDetail(savedName, savedConnectionPayload) {
    savedConnectionDetailsCache().set(savedName, savedConnectionPayload);
  },
  closeEditorModal: closeSavedConnectionEditorModal,
  ensureSavedConnectionDetail,
  getActiveConnectionTarget: activeConnectionTarget,
  getSelectedSavedConnectionName: selectedSavedConnectionName,
  loadSavedConnections,
  openEditorModal: showSavedConnectionEditorModal,
  refreshSidebarConnectionSelector,
  savedConnectionDetailsFromPayload,
  setCurrentConnectionTarget,
  setSavedConnectionStatus,
  setSelectedSavedConnectionName: setSavedConnectionSelectValue,
});

function connectionPayloadFromValues(
  values: Record<string, unknown>,
  {
    connectionName = null,
    groups = [],
    labels = [],
    vars = {},
  }: ConnectionPayloadOptions = {},
): ConnectionRequestPayload {
  const rawPort = values.port;
  const parsedPort = rawPort ? Number(rawPort) : 22;
  const credentialId = safeString(values.credential_id || "").trim();
  return {
    connection_name: connectionName || null,
    host: safeString(values.host || "").trim() || null,
    port: Number.isFinite(parsedPort) ? parsedPort : 22,
    connect_timeout_secs: connectionTimeoutSecsValue(
      values.connect_timeout_secs,
    ),
    credential_id: credentialId || null,
    ssh_security: safeString(values.ssh_security || "").trim() || null,
    linux_shell_flavor:
      safeString(values.linux_shell_flavor || "").trim() || null,
    output_encoding:
      safeString(values.output_encoding || "utf8").trim() || "utf8",
    device_profile: safeString(values.device_profile || "").trim() || null,
    device_model: safeString(values.device_model || "").trim() || null,
    software_version: safeString(values.software_version || "").trim() || null,
    enabled: values.enabled !== false,
    labels: Array.isArray(labels) ? [...labels] : [],
    groups: Array.isArray(groups) ? [...groups] : [],
    vars: recordValue(vars),
  };
}

function temporaryConnectionDraftPayload(
  connectionName: string | null = null,
): ConnectionRequestPayload {
  return connectionPayloadFromValues(temporaryConnectionFormState, {
    connectionName,
    groups: getConnectionGroupValues(CONNECTION_PICKER.savedGroups),
    labels: getConnectionLabelValues(CONNECTION_PICKER.savedLabels),
    vars: getConnectionVarsValue(CONNECTION_VARS.saved),
  });
}

function persistedTemporaryVars(
  connection: Record<string, unknown> = {},
): Record<string, unknown> {
  if (
    connection.vars &&
    typeof connection.vars === "object" &&
    !Array.isArray(connection.vars)
  ) {
    return connection.vars as Record<string, unknown>;
  }
  try {
    return connection.vars_text
      ? recordValue(JSON.parse(safeString(connection.vars_text)))
      : {};
  } catch (_) {
    return {};
  }
}

export function connectionPayload(): ConnectionRequestPayload {
  const target = activeConnectionTarget();
  if (target.kind === "saved") {
    const savedConnectionName = safeString(
      target.connection?.name || target.details?.name || "",
    ).trim();
    if (!savedConnectionName) {
      throw new Error(t("connectionTargetRequired"));
    }
    return { connection_name: savedConnectionName };
  }
  if (target.kind !== "temporary" || !target.connection) {
    throw new Error(t("connectionTargetRequired"));
  }
  const payload = connectionPayloadFromValues(target.connection, {
    groups: target.connection.groups,
    labels: target.connection.labels,
    vars: persistedTemporaryVars(target.connection),
  });
  if (!payload.credential_id) {
    throw new Error(t("credentialRequired"));
  }
  return payload;
}

export async function detectTemporaryConnectionFacts(): Promise<ConnectionFactsResponse> {
  const payload = temporaryConnectionDraftPayload();
  if (!payload.credential_id) {
    throw new Error(t("credentialRequired"));
  }
  payload.connection_name = null;
  payload.device_profile = "autodetect";
  const detectResult = await connectionApi.detectFacts(payload);
  const detectedProfile = safeString(detectResult?.device_profile || "").trim();

  if (!detectedProfile) {
    throw new Error(t("savedConnAutodetectNoResult"));
  }

  const patch = detectedConnectionFactsPatch(detectResult);
  setTemporaryConnectionFormValues({
    ...(patch.deviceProfile ? { device_profile: patch.deviceProfile } : {}),
    ...(patch.deviceModel ? { device_model: patch.deviceModel } : {}),
    ...(patch.softwareVersion
      ? { software_version: patch.softwareVersion }
      : {}),
  });
  refreshActiveTemporaryConnectionTarget();
  return detectResult;
}

function connectionTestPayload(mode = "temporary"): ConnectionRequestPayload {
  if (mode === "saved") {
    const savedConnectionName = selectedSavedConnectionName();
    if (!savedConnectionName) {
      throw new Error(t("connectionNameRequired"));
    }
    return { connection_name: savedConnectionName };
  }
  const payload = temporaryConnectionDraftPayload();
  payload.connection_name = null;
  if (!payload.credential_id) {
    throw new Error(t("credentialRequired"));
  }
  return payload;
}

async function testCurrentConnectionTarget(
  connection: ConnectionRequestPayload = connectionPayload(),
): Promise<string> {
  const testResult = await connectionApi.testConnection(connection);
  return `${t("connectionOk")}: ${testResult.username}@${testResult.host}:${testResult.port} (${testResult.device_profile}, ${displayString(testResult.ssh_security)}, ${displayString(testResult.linux_shell_flavor || "-")}, ${displayString(testResult.output_encoding || "utf8")})`;
}

export function setConnectionTestLoadingKeys(
  connectionTest: ConnectionTestState,
  keys: string[] = [],
): void {
  connectionTest.loading = Array.isArray(keys) && keys.includes("test");
}

export async function runConnectionTest(
  connectionTest: ConnectionTestState,
  mode = "temporary",
): Promise<void> {
  connectionTest.status = { message: t("running"), tone: "running" };
  try {
    const message = await testCurrentConnectionTarget(
      connectionTestPayload(mode),
    );
    connectionTest.status = {
      message,
      tone: "success",
    };
    showToast(message, "success");
  } catch (error) {
    const message = runtimeErrorMessage(error);
    connectionTest.status = { message, tone: "error" };
    showToast(message, "error");
  }
}

export async function loadSavedConnectionByName(): Promise<boolean> {
  const savedConnectionName = selectedSavedConnectionName();
  if (!savedConnectionName) {
    setSavedConnectionStatus(t("connectionNameRequired"), "error");
    return false;
  }
  setSavedConnectionStatus(t("running"), "running");
  try {
    const connectionDetail =
      await ensureSavedConnectionDetail(savedConnectionName);
    if (!connectionDetail) throw new Error(t("connectionNameRequired"));
    const resolvedName = connectionDetail.name || savedConnectionName;
    applyConnectionForm(connectionDetail.connection || {});
    setSavedConnectionSelectValue(resolvedName);
    clearTemporaryConnectionActive();
    const details = savedConnectionDetails({
      ...(connectionDetail.connection || {}),
      name: resolvedName,
    });
    setCurrentConnectionTarget(details);
    applyTargetProfileToTemporaryForm(details);
    refreshSidebarConnectionSelector();
    setSavedConnectionStatus(`${t("loaded")}: ${resolvedName}`, "success");
    return true;
  } catch (e) {
    setSavedConnectionStatus(runtimeErrorMessage(e), "error");
    return false;
  }
}

export async function deleteConnectionByName(): Promise<void> {
  const savedConnectionName = selectedSavedConnectionName();
  if (!savedConnectionName) {
    setSavedConnectionStatus(t("connectionNameRequired"), "error");
    return;
  }
  setSavedConnectionStatus(t("running"), "running");
  try {
    await connectionApi.deleteConnection(savedConnectionName);
    savedConnectionDetailsCache().delete(savedConnectionName);
    setSavedConnectionStatus(
      `${t("deleted")}: ${savedConnectionName}`,
      "success",
    );
    setSavedConnectionSelectValue("");
    const target = activeConnectionTarget();
    if (
      target.kind === "saved" &&
      safeString(target.details?.name || "").trim() === savedConnectionName
    ) {
      setCurrentConnectionTarget(null);
    }
    clearTemporaryConnectionActive();
    await loadSavedConnections();
  } catch (e) {
    setSavedConnectionStatus(runtimeErrorMessage(e), "error");
  }
}

export async function createSavedConnectionDraft(): Promise<void> {
  const savedConnectionName = promptForResourceName(t("savedConnNewPrompt"));
  if (!savedConnectionName) return;
  const exists = (currentCachedSavedConnections() || []).some(
    (savedConnection) => savedConnection.name === savedConnectionName,
  );
  if (exists) {
    setSavedConnectionStatus(
      `${savedConnectionName} already exists, use ${t("savedConnEditBtn")} to update`,
      "error",
    );
    setSavedConnectionSelectValue(savedConnectionName);
    return;
  }

  setSavedConnectionSelectValue(savedConnectionName);
  setSavedConnectionStatus(t("running"), "running");
  try {
    const payload = temporaryConnectionDraftPayload(savedConnectionName);
    payload.device_profile = payload.device_profile || "autodetect";
    const createdConnectionPayload = await connectionApi.saveConnection(
      savedConnectionName,
      payload,
    );
    const createdName =
      safeString(createdConnectionPayload.name || savedConnectionName).trim() ||
      savedConnectionName;
    savedConnectionDetailsCache().set(createdName, createdConnectionPayload);
    await loadSavedConnections();
    setSavedConnectionSelectValue(createdName);
    const createdConnection =
      createdConnectionPayload.connection || recordValue(payload);
    applyConnectionForm(createdConnection);
    clearTemporaryConnectionActive();
    setCurrentConnectionTarget(
      savedConnectionDetailsFromPayload(createdConnection, createdName),
    );
    setSavedConnectionStatus(`${t("created")}: ${createdName}`, "success");
  } catch (e) {
    setSavedConnectionStatus(runtimeErrorMessage(e), "error");
  }
}

export function applyTemporaryConnection(): void {
  refreshSavedConnectionOptions("");
  markTemporaryConnectionActive();
  setSavedConnectionStatus(t("sidebarConnectionTemporaryApplied"), "success");
  closeConnectionModal();
}

export async function importConnectionsFromFile(
  file: File | null = null,
): Promise<void> {
  if (!file) {
    setSavedConnectionStatus(t("savedConnImportInvalid"), "error");
    return;
  }
  setSavedConnectionStatus(t("running"), "running");
  try {
    const importReport = await connectionApi.importConnections(file);
    await loadSavedConnections();
    setSavedConnectionStatus(
      formatConnectionImportSummary(importReport),
      Number(importReport.failed || 0) > 0 ? "error" : "success",
    );
    if ((importReport.failed || 0) > 0) {
      openDetailModal("", {
        detailPayload: importReport,
        kind: "connectionImportDetail",
        title: t("savedConnImportTitle"),
      });
    }
  } catch (e) {
    setSavedConnectionStatus(runtimeErrorMessage(e), "error");
  }
}

export async function downloadConnectionImportTemplate(): Promise<void> {
  const lang = currentLanguage();
  try {
    const { blob } = await connectionApi.downloadImportTemplate(lang);
    downloadBlob(
      blob,
      lang === "zh"
        ? "rauto-connection-import-template-zh.csv"
        : "rauto-connection-import-template-en.csv",
    );
    setSavedConnectionStatus(t("savedConnTemplateDone"), "success");
  } catch (e) {
    setSavedConnectionStatus(runtimeErrorMessage(e), "error");
  }
}
