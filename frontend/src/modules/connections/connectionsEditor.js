import { saveConnection, testConnection } from "../../api/client.js";
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
  device_profile: "",
  enabled: true,
  enable_password: "",
  host: "",
  linux_shell_flavor: "",
  name: "",
  password: "",
  port: "",
  ssh_security: "",
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
  canApply: false,
  detectedProfile: "",
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
    device_profile: draft.deviceProfile,
    enabled: draft.enabled,
    enable_password: draft.enablePassword,
    host: draft.host,
    linux_shell_flavor: draft.linuxShellFlavor,
    name: draft.name,
    password: draft.password,
    port: draft.port,
    ssh_security: draft.sshSecurity,
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
        "enablePassword",
        "host",
        "linuxShellFlavor",
        "name",
        "password",
        "port",
        "sshSecurity",
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

export function savedConnectionEditorBasicFieldWiring(draft = {}) {
  return connectionBasicFieldWiring(
    draft,
    applySavedConnectionEditorDraftChange,
    { deviceProfileEffect: "refresh" },
  );
}

function savedConnectionEditorName() {
  return safeString(savedConnectionEditorFormState.name || "").trim();
}

function currentSavedConnectionAutodetectResult() {
  return savedConnectionAutodetectResult;
}

function setSavedConnectionAutodetectState(autodetectResult = null) {
  savedConnectionAutodetectResult = autodetectResult;
  updateSavedConnectionAutodetectUi();
}

function savedConnectionAutodetectCanApply() {
  const currentName = savedConnectionEditorName();
  const currentProfile =
    safeString(savedConnectionEditorFormState.device_profile || "").trim() ||
    "autodetect";
  const detectedProfile =
    safeString(savedConnectionAutodetectResult?.device_profile || "").trim() ||
    "";
  const detectedName =
    safeString(savedConnectionAutodetectResult?.connection_name || "").trim() ||
    "";
  return (
    !!detectedProfile &&
    !!currentName &&
    detectedName === currentName &&
    detectedProfile !== currentProfile
  );
}

function updateSavedConnectionAutodetectUi() {
  const canApply = savedConnectionAutodetectCanApply();
  const detectedProfile = safeString(
    savedConnectionAutodetectResult?.device_profile || "",
  ).trim();
  savedConnectionAutodetectState.set({ canApply, detectedProfile });
  return canApply;
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
    username:
      safeString(savedConnectionEditorFormState.username || "").trim() || "",
    password: savedConnectionEditorFormState.password || null,
    enable_password: savedConnectionEditorFormState.enable_password || null,
    ssh_security:
      safeString(savedConnectionEditorFormState.ssh_security || "").trim() ||
      null,
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
    device_profile: safeString(connection.device_profile || ""),
    enabled: connection.enabled !== false,
    enable_password: "",
    host: safeString(connection.host || ""),
    linux_shell_flavor: safeString(connection.linux_shell_flavor || ""),
    name: savedConnectionName || "",
    password: "",
    port: safeString(connection.port || 22),
    ssh_security: safeString(connection.ssh_security || ""),
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
    const detectResult = await testConnection(payload);
    const detectedProfile = safeString(
      detectResult?.device_profile || "",
    ).trim();
    if (!detectedProfile) {
      throw new Error(t("savedConnAutodetectNoResult"));
    }
    setSavedConnectionAutodetectState({
      connection_name: name,
      ...detectResult,
    });
    const currentProfile =
      safeString(savedConnectionEditorFormState.device_profile || "").trim() ||
      "autodetect";
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

export async function saveSavedConnectionEditor(saveCfg = {}) {
  const {
    overrideDeviceProfile = null,
    keepModalOpen = false,
    successMessage = "",
  } = saveCfg;
  const name = savedConnectionEditorName();
  if (!name) {
    setSavedConnectionEditorStatus(t("connectionNameRequired"), "error");
    return;
  }
  setSavedConnectionEditorStatus(t("running"), "running");
  try {
    const payload = savedConnectionEditorPayload();
    payload.device_profile =
      overrideDeviceProfile || payload.device_profile || "autodetect";
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
    const savedMessage = successMessage || `${t("saved")}: ${savedName}`;
    requiredHook("setSavedConnectionStatus")(savedMessage, "success");
    setSavedConnectionEditorStatus(savedMessage, "success", { toast: false });
    if (!keepModalOpen) {
      requiredHook("closeEditorModal")();
      return;
    }
    updateSavedConnectionAutodetectUi();
  } catch (error) {
    setSavedConnectionEditorStatus(error.message, "error");
  }
}

export async function replaceSavedConnectionProfileWithDetected() {
  const name = savedConnectionEditorName();
  const detectedResult = currentSavedConnectionAutodetectResult();
  const detectedProfile =
    safeString(detectedResult?.device_profile || "").trim() || "";
  if (!name || !detectedProfile) {
    setSavedConnectionEditorStatus(t("savedConnAutodetectMissing"), "error");
    return;
  }
  const currentProfile =
    safeString(savedConnectionEditorFormState.device_profile || "").trim() ||
    "autodetect";
  if (currentProfile === detectedProfile) {
    setSavedConnectionEditorStatus(
      `${t("savedConnAutodetectMatched")}: ${detectedProfile}`,
      "success",
    );
    updateSavedConnectionAutodetectUi();
    return;
  }
  setSavedConnectionEditorFormState({
    device_profile: detectedProfile,
  });
  await saveSavedConnectionEditor({
    overrideDeviceProfile: detectedProfile,
    keepModalOpen: true,
    successMessage: `${t("savedConnAutodetectReplaced")}: ${name} (${detectedProfile})`,
  });
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
