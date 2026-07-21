import { detectConnectionFacts, saveConnection } from "../../api/client.js";
import { currentLanguage, t } from "../../lib/i18n.js";
import { safeString, statusPresentation } from "../../lib/ui.js";
import { showToast } from "../overlays/overlays.js";
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
  device_model: "",
  device_profile: "",
  enabled: true,
  enable_password: "",
  host: "",
  linux_shell_flavor: "",
  name: "",
  password: "",
  port: "",
  ssh_security: "",
  software_version: "",
  username: "",
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
    device_model: draft.deviceModel,
    device_profile: draft.deviceProfile,
    enabled: draft.enabled,
    enable_password: draft.enablePassword,
    host: draft.host,
    linux_shell_flavor: draft.linuxShellFlavor,
    name: draft.name,
    password: draft.password,
    port: draft.port,
    ssh_security: draft.sshSecurity,
    software_version: draft.softwareVersion,
    username: draft.username,
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
        "enablePassword",
        "host",
        "linuxShellFlavor",
        "name",
        "password",
        "port",
        "sshSecurity",
        "softwareVersion",
        "username",
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

function savedConnectionEditorPayload() {
  const rawPort = savedConnectionEditorFormState.port;
  return {
    connection_name:
      safeString(savedConnectionEditorFormState.name || "").trim() || null,
    host: safeString(savedConnectionEditorFormState.host || "").trim() || "",
    port: Number(rawPort || 22),
    connect_timeout_secs: connectionTimeoutSecsValue(
      savedConnectionEditorFormState.connect_timeout_secs,
    ),
    device_model:
      safeString(savedConnectionEditorFormState.device_model || "").trim() ||
      null,
    username:
      safeString(savedConnectionEditorFormState.username || "").trim() || "",
    password: savedConnectionEditorFormState.password || null,
    enable_password: savedConnectionEditorFormState.enable_password || null,
    ssh_security:
      safeString(savedConnectionEditorFormState.ssh_security || "").trim() ||
      null,
    software_version:
      safeString(
        savedConnectionEditorFormState.software_version || "",
      ).trim() || null,
    linux_shell_flavor:
      safeString(
        savedConnectionEditorFormState.linux_shell_flavor || "",
      ).trim() || null,
    device_profile:
      safeString(savedConnectionEditorFormState.device_profile || "").trim() ||
      null,
    enabled: savedConnectionEditorFormState.enabled !== false,
    labels: getConnectionLabelValues(CONNECTION_PICKER.savedEditLabels),
    groups: getConnectionGroupValues(CONNECTION_PICKER.savedEditGroups),
    vars: getConnectionVarsValue(CONNECTION_VARS.savedEdit),
  };
}

function applySavedConnectionEditorForm(savedConnectionName, connection = {}) {
  savedConnectionEditorOriginalName = safeString(
    savedConnectionName || "",
  ).trim();
  setSavedConnectionEditorFormState({
    connect_timeout_secs: safeString(connection.connect_timeout_secs || ""),
    device_model: safeString(connection.device_model || ""),
    device_profile: safeString(connection.device_profile || ""),
    enabled: connection.enabled !== false,
    enable_password: "",
    host: safeString(connection.host || ""),
    linux_shell_flavor: safeString(connection.linux_shell_flavor || ""),
    name: savedConnectionName || "",
    password: "",
    port: safeString(connection.port || 22),
    ssh_security: safeString(connection.ssh_security || ""),
    software_version: safeString(connection.software_version || ""),
    username: safeString(connection.username || ""),
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

export async function detectSavedConnectionProfile() {
  const name = savedConnectionEditorName();
  if (!name) {
    setSavedConnectionEditorStatus(t("connectionNameRequired"), "error");
    return;
  }
  setSavedConnectionEditorStatus(t("running"), "running");
  try {
    const payload = savedConnectionEditorPayload();
    payload.device_profile = "autodetect";
    const currentProfile =
      safeString(savedConnectionEditorFormState.device_profile || "").trim() ||
      "autodetect";
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
