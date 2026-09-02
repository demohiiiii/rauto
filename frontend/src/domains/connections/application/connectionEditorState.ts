import { t } from "../../../lib/i18n.js";
import { safeString, statusPresentation } from "../../../lib/ui.js";
import { showToast } from "$domains/overlays/index.js";
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
  refreshConnectionGroupPickerOptions,
  setConnectionPickerSelectedValues,
  setConnectionVarsValue,
} from "$domains/connections/application/connectionFieldStoreState.js";
import { writable, type Writable } from "svelte/store";
import type {
  ConnectionAutodetectState,
  ConnectionDraft,
  ConnectionDraftPatch,
  ConnectionFactsResponse,
  ConnectionRequestPayload,
  ConnectionStatus,
  ConnectionTargetDetails,
  ConnectionTargetState,
  ConnectionTestResponse,
  SavedConnectionDetail,
} from "../model/types.js";

interface SavedConnectionEditorFormState extends Record<string, unknown> {
  connect_timeout_secs: string;
  credential_id: string;
  device_model: string;
  device_profile: string;
  enabled: boolean;
  host: string;
  linux_shell_flavor: string;
  name: string;
  output_encoding: string;
  port: string;
  software_version: string;
  ssh_security: string;
}

interface ConnectionsEditorHooks {
  cacheSavedConnectionDetail:
    | ((name: string, payload: SavedConnectionDetail) => unknown)
    | null;
  closeEditorModal: (() => unknown) | null;
  ensureSavedConnectionDetail:
    | ((name: string) => Promise<SavedConnectionDetail | null>)
    | null;
  getActiveConnectionTarget: (() => ConnectionTargetState) | null;
  getSelectedSavedConnectionName: (() => string) | null;
  loadSavedConnections: (() => Promise<unknown>) | null;
  openEditorModal: (() => unknown) | null;
  refreshSidebarConnectionSelector: (() => unknown) | null;
  savedConnectionDetailsFromPayload:
    | ((
        payload: ConnectionRequestPayload,
        name: string,
      ) => ConnectionTargetDetails)
    | null;
  setCurrentConnectionTarget:
    | ((details: ConnectionTargetDetails) => unknown)
    | null;
  setSavedConnectionStatus: ((message: string, tone: string) => unknown) | null;
  setSelectedSavedConnectionName: ((name: string) => unknown) | null;
}

type ConnectionsEditorHookName = keyof ConnectionsEditorHooks;

let savedConnectionEditorFormState: SavedConnectionEditorFormState = {
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

let savedConnectionAutodetectResult: Record<string, unknown> | null = null;
let savedConnectionEditorOriginalName = "";

const editorHooks: ConnectionsEditorHooks = {
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

export const savedConnectionEditorFormStateStore =
  writable<SavedConnectionEditorFormState>({
    ...savedConnectionEditorFormState,
  });

export const savedConnectionEditorStatusState = writable<ConnectionStatus>({
  message: "",
  tone: "info",
});

export const savedConnectionAutodetectState =
  writable<ConnectionAutodetectState>({
    detectedModel: "",
    detectedProfile: "",
    detectedVersion: "",
    warning: "",
  });

function setEditorHook<K extends ConnectionsEditorHookName>(
  hookName: K,
  hookValue: unknown,
): void {
  editorHooks[hookName] =
    typeof hookValue === "function"
      ? (hookValue as ConnectionsEditorHooks[K])
      : null;
}

export function configureConnectionsEditor(
  nextHooks: Partial<ConnectionsEditorHooks> = {},
): void {
  for (const hookName of Object.keys(
    editorHooks,
  ) as ConnectionsEditorHookName[]) {
    if (Object.prototype.hasOwnProperty.call(nextHooks, hookName)) {
      setEditorHook(hookName, nextHooks[hookName]);
    }
  }
}

function requiredHook<K extends ConnectionsEditorHookName>(
  hookName: K,
): NonNullable<ConnectionsEditorHooks[K]> {
  const hook = editorHooks[hookName];
  if (typeof hook !== "function") {
    throw new Error(`connectionsEditor missing hook: ${hookName}`);
  }
  return hook as NonNullable<ConnectionsEditorHooks[K]>;
}

function setConnectionStatus(
  statusStore: Writable<ConnectionStatus>,
  message = "-",
  tone = "info",
  options: { toast?: boolean } = {},
): void {
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
  options: { toast?: boolean } = {},
): void {
  setConnectionStatus(savedConnectionEditorStatusState, message, tone, options);
}

function savedConnectionEditorFormStateFromDraft(
  draft: ConnectionDraft,
): SavedConnectionEditorFormState {
  return {
    connect_timeout_secs: draft.connectTimeoutSecs,
    credential_id: draft.credentialId,
    device_model: draft.deviceModel,
    device_profile: draft.deviceProfile,
    enabled: draft.enabled,
    host: draft.host,
    linux_shell_flavor: draft.linuxShellFlavor,
    output_encoding: draft.outputEncoding || "utf8",
    name: draft.name || "",
    port: draft.port,
    ssh_security: draft.sshSecurity,
    software_version: draft.softwareVersion,
  };
}

function setSavedConnectionEditorFormState(
  formValues: Partial<SavedConnectionEditorFormState> = {},
): SavedConnectionEditorFormState {
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
  draft: ConnectionDraft,
  patch: ConnectionDraftPatch = {},
  autodetectEffect = "",
): void {
  Object.assign(draft, patch);
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
  draft: ConnectionDraft,
  enabled = false,
): void {
  return applySavedConnectionEditorDraftChange(draft, { enabled: !!enabled });
}

export function detectedConnectionFactsPatch(
  result: Partial<ConnectionFactsResponse> = {},
): ConnectionDraftPatch {
  const patch: ConnectionDraftPatch = {};
  const deviceProfile = safeString(result.device_profile || "").trim();
  const deviceModel = safeString(result.device_model || "").trim();
  const softwareVersion = safeString(result.software_version || "").trim();
  if (deviceProfile) patch.deviceProfile = deviceProfile;
  if (deviceModel) patch.deviceModel = deviceModel;
  if (softwareVersion) patch.softwareVersion = softwareVersion;
  return patch;
}

export function savedConnectionEditorBasicFieldWiring(draft: ConnectionDraft) {
  const basicWiring = connectionBasicFieldWiring(
    draft,
    applySavedConnectionEditorDraftChange,
    { deviceProfileEffect: "refresh" },
  );
  return {
    ...basicWiring,
    onDeviceModelInput(fieldValue: unknown) {
      applySavedConnectionEditorDraftChange(draft, {
        deviceModel: safeString(fieldValue || ""),
      });
    },
    onSoftwareVersionInput(fieldValue: unknown) {
      applySavedConnectionEditorDraftChange(draft, {
        softwareVersion: safeString(fieldValue || ""),
      });
    },
  };
}

function savedConnectionEditorName(): string {
  return safeString(savedConnectionEditorFormState.name || "").trim();
}

function setSavedConnectionAutodetectState(
  autodetectResult: Record<string, unknown> | null = null,
): void {
  savedConnectionAutodetectResult = autodetectResult;
  updateSavedConnectionAutodetectUi();
}

function updateSavedConnectionAutodetectUi(): void {
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

function resetSavedConnectionAutodetectState(): void {
  savedConnectionAutodetectResult = null;
  updateSavedConnectionAutodetectUi();
}

function savedConnectionEditorPayload(
  formState: SavedConnectionEditorFormState = savedConnectionEditorFormState,
): ConnectionRequestPayload {
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

export function savedConnectionEditorDetectionPayload(draft: ConnectionDraft) {
  return {
    ...savedConnectionEditorPayload(
      savedConnectionEditorFormStateFromDraft(draft),
    ),
    connection_name: null,
    device_profile: "autodetect",
  };
}

export function savedConnectionEditorTestPayload(draft: ConnectionDraft) {
  return {
    ...savedConnectionEditorPayload(
      savedConnectionEditorFormStateFromDraft(draft),
    ),
    connection_name: null,
  };
}

function connectionTestSuccessMessage(
  testResult: ConnectionTestResponse,
): string {
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

function editorErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function testSavedConnectionDraft(draft: ConnectionDraft) {
  setSavedConnectionEditorStatus(t("running"), "running");
  try {
    const testResult = await connectionApi.testConnection(
      savedConnectionEditorTestPayload(draft),
    );
    const message = connectionTestSuccessMessage(testResult);
    setSavedConnectionEditorStatus(message, "success", { toast: false });
    showToast(message, "success");
    return testResult;
  } catch (error) {
    const message = editorErrorMessage(error, t("connectionTestFailed"));
    setSavedConnectionEditorStatus(message, "error", { toast: false });
    showToast(message, "error");
    return null;
  }
}

function applySavedConnectionEditorForm(
  savedConnectionName: string,
  connection: Record<string, unknown> = {},
): void {
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
  setConnectionVarsValue(
    CONNECTION_VARS.savedEdit,
    recordValue(connection.vars),
  );
  resetSavedConnectionAutodetectState();
  setSavedConnectionEditorStatus("-", "info");
}

export async function detectSavedConnectionProfile(draft: ConnectionDraft) {
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
    const detectResult = await connectionApi.detectFacts(payload);
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
    const message = editorErrorMessage(error, t("savedConnAutodetectNoResult"));
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
    const savedConnectionPayload = await connectionApi.saveConnection(
      originalName,
      payload,
    );
    const savedName = safeString(savedConnectionPayload.name || name).trim();
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
    setSavedConnectionEditorStatus(
      editorErrorMessage(error, t("requestFailed")),
      "error",
    );
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
    if (!connectionDetail) {
      throw new Error(t("connectionNameRequired"));
    }
    applySavedConnectionEditorForm(
      connectionDetail.name || savedConnectionName,
      recordValue(connectionDetail.connection),
    );
    requiredHook("openEditorModal")();
    requiredHook("setSavedConnectionStatus")(
      `${t("loaded")}: ${connectionDetail.name || savedConnectionName}`,
      "success",
    );
  } catch (error) {
    requiredHook("setSavedConnectionStatus")(
      editorErrorMessage(error, t("connectionNameRequired")),
      "error",
    );
  }
}
