import {
  deleteConnection,
  downloadConnectionImportTemplateBlob,
  getConnection,
  importConnections,
  listConnections,
  saveConnection,
  testConnection,
} from "../../api/client.js";
import { currentLanguage, t } from "../../lib/i18n.js";
import {
  displayString,
  downloadBlob,
  promptForResourceName,
  safeString,
  splitCsvValues,
} from "../../lib/ui.js";
import { writable } from "svelte/store";
import {
  connectionBasicFieldWiring,
  connectionTimeoutSecsValue,
} from "./connectionFieldState.js";
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
} from "./connectionFieldStoreState.js";
import { CONNECTION_MODAL_FOCUS_TARGET } from "./connectionTargetDisplayState.js";
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
} from "./connectionTargetStoreState.js";
import { configureConnectionsEditor } from "./connectionsEditor.js";
import { configureConnectionHistory } from "./connectionsHistory.js";
import { openDetailModal, showToast } from "../overlays/overlays.js";

const CONNECTION_TEST_STATE_DEFAULTS = Object.freeze({
  loading: false,
  status: null,
});

export function createConnectionTestState() {
  return { ...CONNECTION_TEST_STATE_DEFAULTS };
}

let temporaryConnectionFormState = {
  connect_timeout_secs: "",
  device_profile: "autodetect",
  enabled: true,
  enable_password: "",
  host: "",
  linux_shell_flavor: "",
  password: "",
  port: "",
  ssh_security: "",
  username: "",
};

export const temporaryConnectionFormStateStore = writable({
  ...temporaryConnectionFormState,
});

function temporaryConnectionFormStateFromDraft(draft = {}) {
  return {
    connect_timeout_secs: draft.connectTimeoutSecs,
    device_profile: draft.deviceProfile || "autodetect",
    enabled: draft.enabled,
    enable_password: draft.enablePassword,
    host: draft.host,
    linux_shell_flavor: draft.linuxShellFlavor,
    password: draft.password,
    port: draft.port,
    ssh_security: draft.sshSecurity,
    username: draft.username,
  };
}

function openConnectionTargetModal() {
  openConnectionModal(
    "saved",
    CONNECTION_MODAL_FOCUS_TARGET.savedConnectionSelect,
  );
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function applyTemporaryConnectionFormFromDraft(draft = {}) {
  setTemporaryConnectionFormState(temporaryConnectionFormStateFromDraft(draft));
}

function applyTemporaryConnectionDraftChange(draft = {}, patch = {}) {
  Object.entries(patch).forEach(([draftField, draftValue]) => {
    draft[draftField] = draftValue;
  });
  applyTemporaryConnectionFormFromDraft(draft);
  refreshActiveTemporaryConnectionTarget();
}

export function temporaryConnectionBasicFieldWiring(draft = {}) {
  return connectionBasicFieldWiring(
    draft,
    applyTemporaryConnectionDraftChange,
    { defaultDeviceProfile: true },
  );
}

export function updateTemporaryConnectionDraftEnabled(
  draft = {},
  enabled = false,
) {
  return applyTemporaryConnectionDraftChange(draft, { enabled: !!enabled });
}

function mergeConnectionFormState(current = {}, formVals = {}, mergeCfg = {}) {
  const next = { ...current };
  [
    "connect_timeout_secs",
    "device_profile",
    "enable_password",
    "host",
    "linux_shell_flavor",
    "password",
    "port",
    "ssh_security",
    "username",
  ].forEach((key) => {
    if (hasOwn(formVals, key)) {
      next[key] = displayString(formVals[key] || "");
    }
  });
  if (mergeCfg.includeName && hasOwn(formVals, "name")) {
    next.name = displayString(formVals.name || "");
  }
  if (hasOwn(formVals, "enabled")) {
    next.enabled = formVals.enabled !== false;
  }
  return next;
}

export function currentExecutionConnectionProfile() {
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

function setTemporaryConnectionFormValues(formValues = {}) {
  setTemporaryConnectionFormState(formValues);
}

function setTemporaryConnectionFormState(formValues = {}) {
  temporaryConnectionFormState = mergeConnectionFormState(
    temporaryConnectionFormState,
    formValues,
  );
  temporaryConnectionFormStateStore.set({ ...temporaryConnectionFormState });
  return temporaryConnectionFormState;
}

function hasSelectedConnectionTarget() {
  const currentConnectionTarget = activeConnectionTarget();
  if (currentConnectionTarget && currentConnectionTarget.kind !== "none") {
    return true;
  }
  const savedConnectionName = selectedSavedConnectionName();
  if (savedConnectionName) return true;
  const host = safeString(temporaryConnectionFormState.host || "").trim();
  return !!host;
}

export function ensureConnectionTargetSelected() {
  if (hasSelectedConnectionTarget()) return true;
  const message = t("connectionTargetRequired");
  showToast(message, "warning");
  openConnectionTargetModal();
  return false;
}

function currentTemporaryConnectionLabel() {
  const label = storedTemporaryConnectionLabel();
  if (label) return label;
  const host = safeString(temporaryConnectionFormState.host || "").trim();
  const username = safeString(
    temporaryConnectionFormState.username || "",
  ).trim();
  if (!host && !username) return t("sidebarConnectionTemporaryLabel");
  if (!username) return `${t("sidebarConnectionTemporaryLabel")} · ${host}`;
  return `${t("sidebarConnectionTemporaryLabel")} · ${username}@${host}`;
}

export function currentTemporaryConnectionDetails() {
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

function savedConnectionDetails(savedConnection = {}) {
  const profile = safeString(savedConnection.device_profile || "autodetect");
  const linuxShellFlavor = savedConnection.linux_shell_flavor || "";
  return {
    name: safeString(savedConnection.name || "-"),
    host: safeString(savedConnection.host || "-"),
    port: Number(savedConnection.port || 22) || 22,
    username: safeString(savedConnection.username || "-"),
    profile: profile || "autodetect",
    device_model: safeString(savedConnection.device_model || "").trim(),
    software_version: safeString(savedConnection.software_version || "").trim(),
    ssh_security: safeString(savedConnection.ssh_security || "").trim(),
    linux_shell_flavor: safeString(linuxShellFlavor).trim(),
    kind: "saved",
    note: t("savedConnSubtitle"),
  };
}

const savedConnectionDetailsFromPayload = (connection, connectionName) =>
  savedConnectionDetails({ ...connection, name: connectionName });

function buildCurrentTemporaryConnectionDetails() {
  return {
    name: currentTemporaryConnectionLabel(),
    host: safeString(temporaryConnectionFormState.host || "").trim() || "-",
    port: Number(temporaryConnectionFormState.port || 22) || 22,
    username:
      safeString(temporaryConnectionFormState.username || "").trim() || "-",
    profile:
      safeString(
        temporaryConnectionFormState.device_profile || "autodetect",
      ).trim() || "autodetect",
    kind: "temporary",
    note: t("sidebarConnectionTemporaryHint"),
  };
}

function buildTemporaryConnectionDetailsFromPersisted(parsed = {}) {
  const host = safeString(parsed.host || "").trim();
  const username = safeString(parsed.username || "").trim();
  return {
    name: currentTemporaryConnectionLabel(),
    host: host || "-",
    port: Number(parsed.port || 22) || 22,
    username: username || "-",
    profile:
      safeString(parsed.device_profile || "autodetect").trim() || "autodetect",
    kind: "temporary",
    note: t("sidebarConnectionTemporaryHint"),
  };
}

function persistedTemporaryConnectionTarget(details = {}) {
  return {
    kind: "temporary",
    host: safeString(details.host || "").trim(),
    port: Number(details.port || 22) || 22,
    username: safeString(details.username || "").trim(),
    device_profile:
      safeString(details.profile || "autodetect").trim() || "autodetect",
    ssh_security: safeString(
      temporaryConnectionFormState.ssh_security || "",
    ).trim(),
    linux_shell_flavor: safeString(
      temporaryConnectionFormState.linux_shell_flavor || "",
    ).trim(),
    enabled: temporaryConnectionFormState.enabled !== false,
    labels: getConnectionLabelValues(CONNECTION_PICKER.savedLabels),
    groups: getConnectionGroupValues(CONNECTION_PICKER.savedGroups),
    vars_text: JSON.stringify(getConnectionVarsValue(CONNECTION_VARS.saved)),
  };
}

function currentSavedConnectionName() {
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

function restoreTemporaryConnectionFormFromPersisted(parsed = {}) {
  setSavedConnectionSelectValue("");
  const host = safeString(parsed.host || "").trim();
  const username = safeString(parsed.username || "").trim();
  setTemporaryConnectionFormValues({
    device_profile:
      safeString(parsed.device_profile || "autodetect").trim() || "autodetect",
    enabled: parsed.enabled !== false,
    enable_password: "",
    host,
    linux_shell_flavor: safeString(parsed.linux_shell_flavor || "").trim(),
    password: "",
    port: safeString(parsed.port || 22),
    ssh_security: safeString(parsed.ssh_security || "").trim(),
    username,
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
      parsed.vars_text ? JSON.parse(parsed.vars_text) : {},
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

function applyTargetProfileToTemporaryForm(details) {
  if (!details) return;
  const profile = safeString(
    details.profile || details.device_profile || "",
  ).trim();
  if (!profile) return;
  setTemporaryConnectionFormValues({ device_profile: profile });
}

async function ensureSavedConnectionDetail(savedConnectionName) {
  const normalizedSavedConnectionName = safeString(
    savedConnectionName || "",
  ).trim();
  if (!normalizedSavedConnectionName) return null;
  const cache = savedConnectionDetailsCache();
  if (cache.has(normalizedSavedConnectionName)) {
    return cache.get(normalizedSavedConnectionName);
  }
  const connectionDetail = await getConnection(normalizedSavedConnectionName);
  cache.set(normalizedSavedConnectionName, connectionDetail);
  return connectionDetail;
}

function formatConnectionImportSummary(report) {
  return `${t("savedConnImportDone")}: ${connectionImportSummaryEntries(report)
    .map(([label, summaryValue]) => `${label}=${summaryValue}`)
    .join(", ")}`;
}

function connectionImportSummaryEntries(report = {}) {
  return [
    [t("savedConnImportSummaryTotal"), safeString(report?.total_rows)],
    [t("savedConnImportSummaryImported"), safeString(report?.imported)],
    [t("savedConnImportSummaryCreated"), safeString(report?.created)],
    [t("savedConnImportSummaryUpdated"), safeString(report?.updated)],
    [t("savedConnImportSummaryFailed"), safeString(report?.failed)],
  ];
}

function applyConnectionForm(connection = {}) {
  const port = Number(connection.port);
  setTemporaryConnectionFormValues({
    device_profile: displayString(connection.device_profile || ""),
    enabled: connection.enabled !== false,
    enable_password: "",
    host: displayString(connection.host || ""),
    linux_shell_flavor: displayString(connection.linux_shell_flavor || ""),
    password: "",
    port: Number.isFinite(port) && port > 0 ? String(port) : "",
    ssh_security: displayString(connection.ssh_security || ""),
    username: displayString(connection.username || ""),
  });
  setConnectionPickerSelectedValues(
    CONNECTION_PICKER.savedLabels,
    Array.isArray(connection.labels) ? connection.labels : [],
  );
  refreshSavedConnectionGroupOptions(
    Array.isArray(connection.groups) ? connection.groups : [],
  );
  setConnectionVarsValue(CONNECTION_VARS.saved, connection.vars || {});
  refreshSidebarConnectionSelector();
}

export function refreshSavedConnectionOptions(selectedName = "") {
  setSavedConnectionSelectValue(selectedName);
  refreshConnectionPickerOptions(CONNECTION_PICKER.batchShowTargets);
}

export function refreshConnectionProfileOptions() {
  return undefined;
}

export function setConnectionDeviceProfiles(profiles = []) {
  const normalizedProfiles = Array.isArray(profiles) ? profiles : [];
  setConnectionFieldDeviceProfiles(normalizedProfiles);
  return normalizedProfiles;
}

export function refreshSidebarConnectionSelector(errorMessage = "") {
  refreshSidebarConnectionState({
    currentTemporaryConnectionDetails,
    errorMessage,
    savedConnectionDetails,
  });
}

function clearTemporaryConnectionActive() {
  setTemporaryConnectionState(false);
  if (activeConnectionTarget().kind === "temporary") {
    setCurrentConnectionTarget(null);
  }
  refreshSidebarConnectionSelector();
}

function markTemporaryConnectionActive() {
  const details = buildCurrentTemporaryConnectionDetails();
  setTemporaryConnectionState(true, currentTemporaryConnectionLabel(), details);
  setCurrentConnectionTarget(
    details,
    persistedTemporaryConnectionTarget(details),
  );
  refreshSidebarConnectionSelector();
}

export function refreshActiveTemporaryConnectionTarget() {
  if (!isTemporaryConnectionActive()) {
    return;
  }
  const details = buildCurrentTemporaryConnectionDetails();
  setTemporaryConnectionState(true, "", details);
  setCurrentConnectionTarget(
    details,
    persistedTemporaryConnectionTarget(details),
  );
  refreshSidebarConnectionSelector();
}

function restorePersistedConnectionTarget() {
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

export async function loadSavedConnections() {
  try {
    const connectionsPayload = await listConnections();
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
    refreshSidebarConnectionSelector(e.message);
  }
}

function currentCachedSavedConnections() {
  return currentSavedConnections();
}

function showSavedConnectionEditorModal() {
  connectionOverlayState.update((state) => ({
    ...state,
    savedEditorOpen: true,
  }));
}

function closeSavedConnectionEditorModal() {
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

export function connectionPayload() {
  const rawPort = temporaryConnectionFormState.port;
  const parsedPort = rawPort ? Number(rawPort) : 22;

  return {
    connection_name: selectedSavedConnectionName() || null,
    host: safeString(temporaryConnectionFormState.host || "").trim() || null,
    port: Number.isFinite(parsedPort) ? parsedPort : 22,
    connect_timeout_secs: connectionTimeoutSecsValue(
      temporaryConnectionFormState.connect_timeout_secs,
    ),
    username:
      safeString(temporaryConnectionFormState.username || "").trim() || null,
    password: temporaryConnectionFormState.password || null,
    enable_password: temporaryConnectionFormState.enable_password || null,
    ssh_security:
      safeString(temporaryConnectionFormState.ssh_security || "").trim() ||
      null,
    linux_shell_flavor:
      safeString(
        temporaryConnectionFormState.linux_shell_flavor || "",
      ).trim() || null,
    device_profile:
      safeString(temporaryConnectionFormState.device_profile || "").trim() ||
      null,
    enabled: temporaryConnectionFormState.enabled !== false,
    labels: getConnectionLabelValues(CONNECTION_PICKER.savedLabels),
    groups: getConnectionGroupValues(CONNECTION_PICKER.savedGroups),
    vars: getConnectionVarsValue(CONNECTION_VARS.saved),
  };
}

function connectionTestPayload(mode = "temporary") {
  if (mode === "saved") {
    const savedConnectionName = selectedSavedConnectionName();
    if (!savedConnectionName) {
      throw new Error(t("connectionNameRequired"));
    }
    return { connection_name: savedConnectionName };
  }
  return connectionPayload();
}

async function testCurrentConnectionTarget(connection = connectionPayload()) {
  const testResult = await testConnection(connection);
  return `${t("connectionOk")}: ${testResult.username}@${testResult.host}:${testResult.port} (${testResult.device_profile}, ${displayString(testResult.ssh_security)}, ${displayString(testResult.linux_shell_flavor || "-")})`;
}

export function setConnectionTestLoadingKeys(connectionTest = {}, keys = []) {
  connectionTest.loading = Array.isArray(keys) && keys.includes("test");
}

export async function runConnectionTest(
  connectionTest = {},
  mode = "temporary",
) {
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
    connectionTest.status = { message: error.message, tone: "error" };
    showToast(error.message, "error");
  }
}

export async function loadSavedConnectionByName() {
  const savedConnectionName = selectedSavedConnectionName();
  if (!savedConnectionName) {
    setSavedConnectionStatus(t("connectionNameRequired"), "error");
    return false;
  }
  setSavedConnectionStatus(t("running"), "running");
  try {
    const connectionDetail =
      await ensureSavedConnectionDetail(savedConnectionName);
    applyConnectionForm(connectionDetail.connection || {});
    setSavedConnectionSelectValue(connectionDetail.name || savedConnectionName);
    clearTemporaryConnectionActive();
    const details = savedConnectionDetails({
      ...(connectionDetail.connection || {}),
      name: connectionDetail.name || savedConnectionName,
    });
    setCurrentConnectionTarget(details);
    applyTargetProfileToTemporaryForm(details);
    refreshSidebarConnectionSelector();
    setSavedConnectionStatus(
      `${t("loaded")}: ${connectionDetail.name}`,
      "success",
    );
    return true;
  } catch (e) {
    setSavedConnectionStatus(e.message, "error");
    return false;
  }
}

export async function deleteConnectionByName() {
  const savedConnectionName = selectedSavedConnectionName();
  if (!savedConnectionName) {
    setSavedConnectionStatus(t("connectionNameRequired"), "error");
    return;
  }
  setSavedConnectionStatus(t("running"), "running");
  try {
    await deleteConnection(savedConnectionName);
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
    setSavedConnectionStatus(e.message, "error");
  }
}

export async function createSavedConnectionDraft() {
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
    const payload = connectionPayload();
    payload.device_profile = payload.device_profile || "autodetect";
    const createdConnectionPayload = await saveConnection(
      savedConnectionName,
      payload,
    );
    const createdName = createdConnectionPayload.name || savedConnectionName;
    savedConnectionDetailsCache().set(createdName, createdConnectionPayload);
    await loadSavedConnections();
    setSavedConnectionSelectValue(createdName);
    applyConnectionForm(createdConnectionPayload.connection || payload);
    clearTemporaryConnectionActive();
    setCurrentConnectionTarget(
      savedConnectionDetailsFromPayload(
        createdConnectionPayload.connection || payload,
        createdName,
      ),
    );
    setSavedConnectionStatus(`${t("created")}: ${createdName}`, "success");
  } catch (e) {
    setSavedConnectionStatus(e.message, "error");
  }
}

export function applyTemporaryConnection() {
  refreshSavedConnectionOptions("");
  markTemporaryConnectionActive();
  setSavedConnectionStatus(t("sidebarConnectionTemporaryApplied"), "success");
  closeConnectionModal();
}

export async function importConnectionsFromFile(file = null) {
  if (!file) {
    setSavedConnectionStatus(t("savedConnImportInvalid"), "error");
    return;
  }
  setSavedConnectionStatus(t("running"), "running");
  try {
    const importReport = await importConnections(file);
    await loadSavedConnections();
    setSavedConnectionStatus(
      formatConnectionImportSummary(importReport),
      importReport.failed > 0 ? "error" : "success",
    );
    if ((importReport.failed || 0) > 0) {
      openDetailModal("", {
        detailPayload: importReport,
        kind: "connectionImportDetail",
        title: t("savedConnImportTitle"),
      });
    }
  } catch (e) {
    setSavedConnectionStatus(e.message, "error");
  }
}

export async function downloadConnectionImportTemplate() {
  const lang = currentLanguage();
  try {
    const { blob } = await downloadConnectionImportTemplateBlob(lang);
    downloadBlob(
      blob,
      lang === "zh"
        ? "rauto-connection-import-template-zh.csv"
        : "rauto-connection-import-template-en.csv",
    );
    setSavedConnectionStatus(t("savedConnTemplateDone"), "success");
  } catch (e) {
    setSavedConnectionStatus(e.message, "error");
  }
}
