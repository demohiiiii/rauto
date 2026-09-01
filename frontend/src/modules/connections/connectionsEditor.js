import {
  detectConnectionFacts,
  saveConnection,
  testConnection as testConnectionRequest,
} from "../../api/client.js";
import { currentLanguage, t } from "../../lib/i18n.js";
import { safeString, statusPresentation } from "../../lib/ui.js";
import { showToast } from "$domains/overlays/index.js";
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
  refreshConnectionGroupPickerOptions,
  setConnectionPickerSelectedValues,
  setConnectionVarsValue,
} from "./connectionFieldStoreState.js";
import { writable } from "svelte/store";

let savedConnectionEditorFormState = {
  connect_timeout_secs: "",
  credential_id: "",
  device_model: "",
  device_profile: "",
  enabled: true,
  host: "",
  linux_shell_flavor: "",
  output_encoding: "utf8",
  name: "",
  port: "",
  ssh_security: "",
  software_version: "",
};

let savedConnectionAutodetectResult = null;
let savedConnectionEditorOriginalName = "";

const editorHooks = {
  cacheSavedConnectionDetail: null,
  closeEditorModal: null,
  ensureSavedConnectionDetail: null,
  getActiveConnectionTarget: null,
  getSelectedSavedConnectionName: null,
  loadSavedConnections: null,
  openEditorModal: null,
  refreshSidebarConnectionSelector: null,
  savedConnectionDetailsFromPayload: null,
  setCurrentConnectionTarget: null,
  setSavedConnectionStatus: null,
  setSelectedSavedConnectionName: null,
};

export const savedConnectionEditorFormStateStore = writable({
  ...savedConnectionEditorFormState,
});

export const savedConnectionEditorStatusState = writable({
  message: "",
  tone: "info",
});

export const savedConnectionAutodetectState = writable({
  detectedModel: "",
  detectedProfile: "",
  detectedVersion: "",
  warning: "",
});

export function configureConnectionsEditor(nextHooks = {}) {
  Object.entries(nextHooks).forEach(([hookName, hookValue]) => {
    if (Object.prototype.hasOwnProperty.call(editorHooks, hookName)) {
      editorHooks[hookName] =
        typeof hookValue === "function" ? hookValue : null;
    }
  });
}

function requiredHook(hookName) {
  const hook = editorHooks[hookName];
  if (typeof hook !== "function") {
    throw new Error(`connectionsEditor missing hook: ${hookName}`);
  }
  return hook;
}

function setConnectionStatus(
  statusStore,
  message = "-",
  tone = "info",
  options = {},
) {
  const { toast = true } = options;
  const presentation = statusPresentation(message, tone);
  statusStore.set({
    message: presentation.inlineMessage,
    tone: presentation.tone,
  });
  if (toast && presentation.shouldToast) {
    showToast(presentation.text, presentation.tone);
  }
}

function setSavedConnectionEditorStatus(
  message = "-",
  tone = "info",
  options = {},
) {
  setConnectionStatus(savedConnectionEditorStatusState, message, tone, options);
}

function savedConnectionEditorFormStateFromDraft(draft = {}) {
  return {
    connect_timeout_secs: draft.connectTimeoutSecs,
    credential_id: draft.credentialId,
    device_model: draft.deviceModel,
    device_profile: draft.deviceProfile,
    enabled: draft.enabled,
    host: draft.host,
    linux_shell_flavor: draft.linuxShellFlavor,
    output_encoding: draft.outputEncoding || "utf8",
    name: draft.name,
    port: draft.port,
    ssh_security: draft.sshSecurity,
    software_version: draft.softwareVersion,
  };
}

function setSavedConnectionEditorFormState(formValues = {}) {
  savedConnectionEditorFormState = {
    ...savedConnectionEditorFormState,
    ...formValues,
  };
  savedConnectionEditorFormStateStore.set({
    ...savedConnectionEditorFormState,
  });
  return savedConnectionEditorFormState;
}

function applySavedConnectionEditorDraftChange(
  draft = {},
  patch = {},
  autodetectEffect = "",
) {
  Object.entries(patch).forEach(([draftField, draftValue]) => {
    draft[draftField] = draftValue;
  });
  setSavedConnectionEditorFormState(
    savedConnectionEditorFormStateFromDraft(draft),
  );
  if (autodetectEffect === "refresh") {
    updateSavedConnectionAutodetectUi();
  } else if (
    autodetectEffect === "reset" ||
    Object.keys(patch).some((field) =>
      [
        "connectTimeoutSecs",
        "deviceModel",
        "credentialId",
        "host",
        "linuxShellFlavor",
        "outputEncoding",
        "name",
        "port",
        "sshSecurity",
        "softwareVersion",
      ].includes(field),
    )
  ) {
    resetSavedConnectionAutodetectState();
  }
}

export function updateSavedConnectionEditorDraftEnabled(
  draft = {},
  enabled = false,
) {
  return applySavedConnectionEditorDraftChange(draft, { enabled: !!enabled });
}

export function detectedConnectionFactsPatch(result = {}) {
  const patch = {};
  const deviceProfile = safeString(result.device_profile || "").trim();
  const deviceModel = safeString(result.device_model || "").trim();
  const softwareVersion = safeString(result.software_version || "").trim();
  if (deviceProfile) patch.deviceProfile = deviceProfile;
  if (deviceModel) patch.deviceModel = deviceModel;
  if (softwareVersion) patch.softwareVersion = softwareVersion;
  return patch;
}

export function savedConnectionEditorBasicFieldWiring(draft = {}) {
  const basicWiring = connectionBasicFieldWiring(
    draft,
    applySavedConnectionEditorDraftChange,
    { deviceProfileEffect: "refresh" },
  );
  return {
    ...basicWiring,
    onDeviceModelInput(fieldValue) {
      applySavedConnectionEditorDraftChange(draft, {
        deviceModel: safeString(fieldValue || ""),
      });
    },
    onSoftwareVersionInput(fieldValue) {
      applySavedConnectionEditorDraftChange(draft, {
        softwareVersion: safeString(fieldValue || ""),
      });
    },
  };
}

function savedConnectionEditorName() {
  return safeString(savedConnectionEditorFormState.name || "").trim();
}

function setSavedConnectionAutodetectState(autodetectResult = null) {
  savedConnectionAutodetectResult = autodetectResult;
  updateSavedConnectionAutodetectUi();
}

function updateSavedConnectionAutodetectUi() {
  const detectedProfile = safeString(
    savedConnectionAutodetectResult?.device_profile || "",
  ).trim();
  savedConnectionAutodetectState.set({
    detectedModel: safeString(
      savedConnectionAutodetectResult?.device_model || "",
    ).trim(),
    detectedProfile,
    detectedVersion: safeString(
      savedConnectionAutodetectResult?.software_version || "",
    ).trim(),
    warning: safeString(savedConnectionAutodetectResult?.warning || "").trim(),
  });
}

function resetSavedConnectionAutodetectState() {
  savedConnectionAutodetectResult = null;
  updateSavedConnectionAutodetectUi();
}

function savedConnectionEditorPayload(
  formState = savedConnectionEditorFormState,
) {
  const rawPort = formState.port;
  const credentialId = safeString(formState.credential_id || "").trim();
  if (!credentialId) throw new Error(t("credentialRequired"));
  return {
    connection_name: safeString(formState.name || "").trim() || null,
    host: safeString(formState.host || "").trim() || "",
    port: Number(rawPort || 22),
    connect_timeout_secs: connectionTimeoutSecsValue(
      formState.connect_timeout_secs,
    ),
    credential_id: credentialId,
    device_model: safeString(formState.device_model || "").trim() || null,
    ssh_security: safeString(formState.ssh_security || "").trim() || null,
    software_version:
      safeString(formState.software_version || "").trim() || null,
    linux_shell_flavor:
      safeString(formState.linux_shell_flavor || "").trim() || null,
    output_encoding:
      safeString(formState.output_encoding || "utf8").trim() || "utf8",
    device_profile: safeString(formState.device_profile || "").trim() || null,
    enabled: formState.enabled !== false,
    labels: getConnectionLabelValues(CONNECTION_PICKER.savedEditLabels),
    groups: getConnectionGroupValues(CONNECTION_PICKER.savedEditGroups),
    vars: getConnectionVarsValue(CONNECTION_VARS.savedEdit),
  };
}

export function savedConnectionEditorDetectionPayload(draft = {}) {
  return {
    ...savedConnectionEditorPayload(
      savedConnectionEditorFormStateFromDraft(draft),
    ),
    connection_name: null,
    device_profile: "autodetect",
  };
}

export function savedConnectionEditorTestPayload(draft = {}) {
  return {
    ...savedConnectionEditorPayload(
      savedConnectionEditorFormStateFromDraft(draft),
    ),
    connection_name: null,
  };
}

function connectionTestSuccessMessage(testResult = {}) {
  const username = safeString(testResult.username || "").trim() || "-";
  const host = safeString(testResult.host || "").trim() || "-";
  const port = Number(testResult.port || 22) || 22;
  const deviceProfile =
    safeString(testResult.device_profile || "").trim() || "autodetect";
  const sshSecurity = safeString(testResult.ssh_security || "").trim() || "-";
  const linuxShellFlavor =
    safeString(testResult.linux_shell_flavor || "").trim() || "-";
  const outputEncoding =
    safeString(testResult.output_encoding || "utf8").trim() || "utf8";
  return `${t("connectionOk")}: ${username}@${host}:${port} (${deviceProfile}, ${sshSecurity}, ${linuxShellFlavor}, ${outputEncoding})`;
}

export async function testSavedConnectionDraft(draft = {}) {
  setSavedConnectionEditorStatus(t("running"), "running");
  try {
    const testResult = await testConnectionRequest(
      savedConnectionEditorTestPayload(draft),
    );
    const message = connectionTestSuccessMessage(testResult);
    setSavedConnectionEditorStatus(message, "success", { toast: false });
    showToast(message, "success");
    return testResult;
  } catch (error) {
    const message = error?.message || t("connectionTestFailed");
    setSavedConnectionEditorStatus(message, "error", { toast: false });
    showToast(message, "error");
    return null;
  }
}

function applySavedConnectionEditorForm(savedConnectionName, connection = {}) {
  savedConnectionEditorOriginalName = safeString(
    savedConnectionName || "",
  ).trim();
  setSavedConnectionEditorFormState({
    connect_timeout_secs: safeString(connection.connect_timeout_secs || ""),
    credential_id: safeString(connection.credential_id || ""),
    device_model: safeString(connection.device_model || ""),
    device_profile: safeString(connection.device_profile || ""),
    enabled: connection.enabled !== false,
    host: safeString(connection.host || ""),
    linux_shell_flavor: safeString(connection.linux_shell_flavor || ""),
    output_encoding: safeString(connection.output_encoding || "utf8"),
    name: savedConnectionName || "",
    port: safeString(connection.port || 22),
    ssh_security: safeString(connection.ssh_security || ""),
    software_version: safeString(connection.software_version || ""),
  });
  setConnectionPickerSelectedValues(
    CONNECTION_PICKER.savedEditLabels,
    Array.isArray(connection.labels) ? connection.labels : [],
  );
  refreshConnectionGroupPickerOptions(
    CONNECTION_PICKER.savedEditGroups,
    Array.isArray(connection.groups) ? connection.groups : [],
  );
  setConnectionVarsValue(CONNECTION_VARS.savedEdit, connection.vars || {});
  resetSavedConnectionAutodetectState();
  setSavedConnectionEditorStatus("-", "info");
}

export async function detectSavedConnectionProfile(draft = {}) {
  const name = safeString(draft.name || "").trim();
  if (!name) {
    setSavedConnectionEditorStatus(t("connectionNameRequired"), "error");
    return;
  }
  setSavedConnectionEditorStatus(t("running"), "running");
  try {
    const payload = savedConnectionEditorDetectionPayload(draft);
    const currentProfile =
      safeString(draft.deviceProfile || "").trim() || "autodetect";
    const detectResult = await detectConnectionFacts(payload);
    const detectedProfile = safeString(
      detectResult?.device_profile || "",
    ).trim();
    if (!detectedProfile) {
      throw new Error(t("savedConnAutodetectNoResult"));
    }
    const detectedPatch = detectedConnectionFactsPatch(detectResult);
    setSavedConnectionEditorFormState({
      ...(detectedPatch.deviceProfile
        ? { device_profile: detectedPatch.deviceProfile }
        : {}),
      ...(detectedPatch.deviceModel
        ? { device_model: detectedPatch.deviceModel }
        : {}),
      ...(detectedPatch.softwareVersion
        ? { software_version: detectedPatch.softwareVersion }
        : {}),
    });
    setSavedConnectionAutodetectState({
      connection_name: name,
      ...detectResult,
    });
    const message =
      detectedProfile === currentProfile
        ? `${t("savedConnAutodetectMatched")}: ${detectedProfile}`
        : `${t("savedConnAutodetectDetected")}: ${detectedProfile} (${t("savedConnAutodetectCurrent")}: ${currentProfile})`;
    setSavedConnectionEditorStatus(message, "success", { toast: false });
    showToast(message, "success");
  } catch (error) {
    resetSavedConnectionAutodetectState();
    const message = error?.message || t("savedConnAutodetectNoResult");
    setSavedConnectionEditorStatus(message, "error", { toast: false });
    showToast(message, "error");
  }
}

export async function saveSavedConnectionEditor() {
  const name = savedConnectionEditorName();
  if (!name) {
    setSavedConnectionEditorStatus(t("connectionNameRequired"), "error");
    return;
  }
  setSavedConnectionEditorStatus(t("running"), "running");
  try {
    const payload = savedConnectionEditorPayload();
    payload.device_profile = payload.device_profile || "autodetect";
    const originalName = savedConnectionEditorOriginalName || name;
    const targetBeforeSave = requiredHook("getActiveConnectionTarget")();
    const savedConnectionPayload = await saveConnection(originalName, payload);
    const savedName = savedConnectionPayload.name || name;
    savedConnectionEditorOriginalName = savedName;
    requiredHook("cacheSavedConnectionDetail")(
      savedName,
      savedConnectionPayload,
    );
    await requiredHook("loadSavedConnections")();
    requiredHook("setSelectedSavedConnectionName")(savedName);
    if (
      targetBeforeSave.kind === "saved" &&
      [originalName, savedName].includes(
        safeString(targetBeforeSave.details?.name || "").trim(),
      )
    ) {
      requiredHook("setCurrentConnectionTarget")(
        requiredHook("savedConnectionDetailsFromPayload")(
          savedConnectionPayload.connection || payload,
          savedName,
        ),
      );
      requiredHook("refreshSidebarConnectionSelector")();
    }
    const savedMessage = `${t("saved")}: ${savedName}`;
    requiredHook("setSavedConnectionStatus")(savedMessage, "success");
    setSavedConnectionEditorStatus(savedMessage, "success", { toast: false });
    requiredHook("closeEditorModal")();
  } catch (error) {
    setSavedConnectionEditorStatus(error.message, "error");
  }
}

export function hideSavedConnectionEditorModal() {
  resetSavedConnectionAutodetectState();
  requiredHook("closeEditorModal")();
}

export async function openSavedConnectionEditor() {
  const savedConnectionName = requiredHook("getSelectedSavedConnectionName")();
  if (!savedConnectionName) {
    requiredHook("setSavedConnectionStatus")(
      t("connectionNameRequired"),
      "error",
    );
    return;
  }
  requiredHook("setSavedConnectionStatus")(t("running"), "running");
  try {
    const connectionDetail = await requiredHook("ensureSavedConnectionDetail")(
      savedConnectionName,
    );
    applySavedConnectionEditorForm(
      connectionDetail.name || savedConnectionName,
      connectionDetail.connection || {},
    );
    requiredHook("openEditorModal")();
    requiredHook("setSavedConnectionStatus")(
      `${t("loaded")}: ${connectionDetail.name || savedConnectionName}`,
      "success",
    );
  } catch (error) {
    requiredHook("setSavedConnectionStatus")(error.message, "error");
  }
}
