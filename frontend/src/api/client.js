import { storageGet, storageRemove, storageSet } from "../lib/browser.js";

const AGENT_API_TOKEN_KEY = "rauto_agent_api_token";
let unauthorizedHandler = null;

class ApiError extends Error {
  constructor(message, { status, payload } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function authHeaders(body) {
  const headers = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const token = getAgentApiToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["X-API-Key"] = token;
  }
  return headers;
}

export function setApiUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === "function" ? handler : null;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

function notifyUnauthorized(response) {
  if (response.status === 401 && unauthorizedHandler) unauthorizedHandler();
}

export function getAgentApiToken() {
  return storageGet(AGENT_API_TOKEN_KEY).trim();
}

export function setAgentApiToken(token) {
  const normalized = String(token || "").trim();
  if (normalized) {
    storageSet(AGENT_API_TOKEN_KEY, normalized);
  } else {
    storageRemove(AGENT_API_TOKEN_KEY);
  }
}

function responseErrorMessage(payload, response) {
  if (typeof payload === "string") return payload || response.statusText;
  if (payload?.error && typeof payload.error === "object") {
    return payload.error.message || response.statusText;
  }
  return payload?.error || payload?.message || response.statusText;
}

async function responsePayload(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json")
    ? await response.json()
    : await response.text();
}

function responseFilename(headers) {
  const disposition = headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return match ? match[1] : "";
}

async function apiRequest(method, path, body) {
  const headers = authHeaders(body);
  const response = await fetch(path, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    notifyUnauthorized(response);
    throw new ApiError(responseErrorMessage(payload, response), {
      status: response.status,
      payload,
    });
  }
  return payload;
}

export function unwrapExecutionResponse(payload) {
  const hasField = (field) =>
    Object.prototype.hasOwnProperty.call(payload || {}, field);
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    typeof payload.success !== "boolean" ||
    !hasField("error") ||
    !hasField("result_summary") ||
    !hasField("data") ||
    !payload.data ||
    typeof payload.data !== "object" ||
    Array.isArray(payload.data)
  ) {
    throw new ApiError("Invalid execution response", { payload });
  }
  Object.defineProperty(payload.data, "execution_response", {
    configurable: false,
    enumerable: false,
    value: {
      success: payload.success,
      error: payload.error,
      result_summary: payload.result_summary,
    },
    writable: false,
  });
  Object.defineProperty(payload.data, "result_summary", {
    configurable: false,
    enumerable: false,
    value: payload.result_summary,
    writable: false,
  });
  return payload.data;
}

async function apiExecutionRequest(method, path, body) {
  return unwrapExecutionResponse(await apiRequest(method, path, body));
}

async function apiRequestBlob(
  method,
  path,
  body,
  fallbackFilename = "textfsm.xlsx",
) {
  const headers = authHeaders(body);
  const response = await fetch(path, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    notifyUnauthorized(response);
    const payload = await responsePayload(response);
    throw new ApiError(responseErrorMessage(payload, response), {
      status: response.status,
      payload,
    });
  }
  return {
    blob: await response.blob(),
    filename: responseFilename(response.headers) || fallbackFilename,
  };
}

async function apiRequestForm(method, path, formData) {
  const headers = authHeaders(undefined);
  const response = await fetch(path, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: formData,
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    notifyUnauthorized(response);
    throw new ApiError(responseErrorMessage(payload, response), {
      status: response.status,
      payload,
    });
  }
  return payload;
}

export function getAgentInfo() {
  return apiRequest("GET", "/api/agent/info");
}

export function getWebAuthStatus() {
  return apiRequest("GET", "/api/auth/status");
}

export function loginWeb(password) {
  return apiRequest("POST", "/api/auth/login", { password });
}

export function logoutWeb() {
  return apiRequest("POST", "/api/auth/logout", {});
}

export function listBlacklistPatterns() {
  return apiRequest("GET", "/api/blacklist");
}

export function addBlacklistPattern(pattern) {
  return apiRequest("POST", "/api/blacklist", { pattern });
}

export function deleteBlacklistPattern(pattern) {
  return apiRequest("DELETE", `/api/blacklist/${encodeURIComponent(pattern)}`);
}

export function checkBlacklistCommand(command) {
  return apiRequest("POST", "/api/blacklist/check", { command });
}

export function listBackups() {
  return apiRequest("GET", "/api/backups");
}

export function createBackup() {
  return apiRequest("POST", "/api/backups", {});
}

export function restoreBackup(archive, replace = false) {
  return apiRequest("POST", "/api/backups/restore", {
    archive,
    replace,
  });
}

function backupDownloadUrl(name) {
  return `/api/backups/${encodeURIComponent(name)}/download`;
}

export function downloadBackupBlob(name) {
  return apiRequestBlob("GET", backupDownloadUrl(name), undefined, name);
}

export function listConnections() {
  return apiRequest("GET", "/api/connections");
}

export function listCredentials() {
  return apiRequest("GET", "/api/credentials");
}

export function getCredential(id) {
  return apiRequest("GET", `/api/credentials/${encodeURIComponent(id)}`);
}

export function createCredential(credential) {
  return apiRequest("POST", "/api/credentials", credential);
}

export function updateCredential(id, credential) {
  return apiRequest(
    "PUT",
    `/api/credentials/${encodeURIComponent(id)}`,
    credential,
  );
}

export function deleteCredential(id) {
  return apiRequest("DELETE", `/api/credentials/${encodeURIComponent(id)}`);
}

export function importCredentials(file) {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return apiRequestForm("POST", "/api/credentials/import", formData);
}

export function downloadCredentialImportTemplateBlob(lang = "en") {
  return apiRequestBlob(
    "GET",
    `/api/credentials/import-template?lang=${encodeURIComponent(lang)}`,
    undefined,
    lang === "zh"
      ? "rauto-credential-import-template-zh.csv"
      : "rauto-credential-import-template-en.csv",
  );
}

export function getConnection(name) {
  return apiRequest("GET", `/api/connections/${encodeURIComponent(name)}`);
}

export function saveConnection(name, connection) {
  return apiRequest("PUT", `/api/connections/${encodeURIComponent(name)}`, {
    connection,
  });
}

export function deleteConnection(name) {
  return apiRequest("DELETE", `/api/connections/${encodeURIComponent(name)}`);
}

export function testConnection(connection) {
  return apiRequest("POST", "/api/connection/test", {
    connection,
  });
}

export function detectConnectionFacts(connection) {
  return apiRequest("POST", "/api/connection/detect-facts", {
    connection,
  });
}

export function createDeviceDiscoveryRun(options) {
  return apiRequest("POST", "/api/device-discovery/runs", options);
}

export function listDeviceDiscoveryRuns() {
  return apiRequest("GET", "/api/device-discovery/runs");
}

export function getDeviceDiscoveryRun(runId) {
  return apiRequest(
    "GET",
    `/api/device-discovery/runs/${encodeURIComponent(runId)}`,
  );
}

export function cancelDeviceDiscoveryRun(runId) {
  return apiRequest(
    "POST",
    `/api/device-discovery/runs/${encodeURIComponent(runId)}/cancel`,
  );
}

export function importDeviceDiscoveryResults(runId, items) {
  return apiRequest(
    "POST",
    `/api/device-discovery/runs/${encodeURIComponent(runId)}/import`,
    { items },
  );
}

export function listConnectionHistory(name, limit = 30) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return apiRequest(
    "GET",
    `/api/connections/${encodeURIComponent(name)}/history${query ? `?${query}` : ""}`,
  );
}

export function getConnectionHistoryDetail(name, historyId) {
  return apiRequest(
    "GET",
    `/api/connections/${encodeURIComponent(name)}/history/${encodeURIComponent(historyId)}`,
  );
}

export function deleteConnectionHistory(name, historyId) {
  return apiRequest(
    "DELETE",
    `/api/connections/${encodeURIComponent(name)}/history/${encodeURIComponent(historyId)}`,
  );
}

export function importConnections(file) {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return apiRequestForm("POST", "/api/connections/import", formData);
}

export function downloadConnectionImportTemplateBlob(lang = "en") {
  return apiRequestBlob(
    "GET",
    `/api/connections/import-template?lang=${encodeURIComponent(lang)}`,
  );
}

export function executeCommand(payload) {
  return apiExecutionRequest("POST", "/api/exec", payload);
}

export function executeTemplate(payload) {
  return apiExecutionRequest("POST", "/api/template/execute", payload);
}

export function renderTemplate(payload) {
  return apiRequest("POST", "/api/render", payload);
}

export function executeCommandFlow(payload) {
  return apiExecutionRequest("POST", "/api/command-flow/execute", payload);
}

export function inspectCommandFlowTemplate(content) {
  return apiRequest("POST", "/api/flow-templates/inspect", { content });
}

export function inspectCommandTemplate(content) {
  return apiRequest("POST", "/api/templates/inspect", { content });
}

export function getCommandFlowTemplate(name, { builtin = false } = {}) {
  return getTemplateResource(
    builtin ? "/api/flow-templates/builtins" : "/api/flow-templates",
    name,
  );
}

export function createCommandFlowTemplate(name, content) {
  return createTemplateResource("/api/flow-templates", name, content);
}

export function updateCommandFlowTemplate(name, content) {
  return updateTemplateResource("/api/flow-templates", name, content);
}

export function executeUpload(payload) {
  return apiExecutionRequest("POST", "/api/upload", payload);
}

export function executeTxBlock(payload) {
  return apiExecutionRequest("POST", "/api/tx/block", payload);
}

export function executeTxWorkflow(payload) {
  return apiExecutionRequest("POST", "/api/tx/workflow", payload);
}

export function executeOrchestration(payload) {
  return apiExecutionRequest("POST", "/api/orchestrate", payload);
}

export function replaySession(payload) {
  return apiRequest("POST", "/api/replay", payload);
}

export function listInventoryGroups() {
  return apiRequest("GET", "/api/inventory/groups");
}

export function getInventoryGroup(name) {
  return apiRequest("GET", `/api/inventory/groups/${encodeURIComponent(name)}`);
}

export function saveInventoryGroup(name, group) {
  return apiRequest(
    "PUT",
    `/api/inventory/groups/${encodeURIComponent(name)}`,
    {
      group,
    },
  );
}

export function deleteInventoryGroup(name) {
  return apiRequest(
    "DELETE",
    `/api/inventory/groups/${encodeURIComponent(name)}`,
  );
}

export function listInventoryLabels() {
  return apiRequest("GET", "/api/inventory/labels");
}

export function getInventoryLabel(name) {
  return apiRequest("GET", `/api/inventory/labels/${encodeURIComponent(name)}`);
}

export function saveInventoryLabel(name, hosts) {
  return apiRequest(
    "PUT",
    `/api/inventory/labels/${encodeURIComponent(name)}`,
    {
      hosts,
    },
  );
}

export function deleteInventoryLabel(name) {
  return apiRequest(
    "DELETE",
    `/api/inventory/labels/${encodeURIComponent(name)}`,
  );
}

export function getDeviceProfilesOverview() {
  return apiRequest("GET", "/api/device-profiles/all");
}

export function getBuiltinProfileDetail(name) {
  return apiRequest(
    "GET",
    `/api/device-profiles/builtin/${encodeURIComponent(name)}`,
  );
}

export function getBuiltinProfileForm(name) {
  return apiRequest(
    "GET",
    `/api/device-profiles/builtin/${encodeURIComponent(name)}/form`,
  );
}

export function getCustomProfileForm(name) {
  return apiRequest(
    "GET",
    `/api/device-profiles/custom/${encodeURIComponent(name)}/form`,
  );
}

export function saveCustomProfile(name, content) {
  return apiRequest(
    "PUT",
    `/api/device-profiles/custom/${encodeURIComponent(name)}`,
    {
      content,
    },
  );
}

export function saveCustomProfileForm(name, profile) {
  return apiRequest(
    "PUT",
    `/api/device-profiles/custom/${encodeURIComponent(name)}/form`,
    profile,
  );
}

export function deleteCustomProfile(name) {
  return apiRequest(
    "DELETE",
    `/api/device-profiles/custom/${encodeURIComponent(name)}`,
  );
}

export function getProfileModes(name) {
  return apiRequest(
    "GET",
    `/api/device-profiles/${encodeURIComponent(name)}/modes`,
  );
}

export function diagnoseProfile(name) {
  return apiRequest("POST", "/api/device-profiles/diagnose", { name });
}

export function listShowObjects({
  deviceProfile = "",
  textfsmPlatform = "",
} = {}) {
  const params = new URLSearchParams();
  if (deviceProfile) params.set("device_profile", deviceProfile);
  if (textfsmPlatform) params.set("textfsm_platform", textfsmPlatform);
  const query = params.toString();
  return apiRequest("GET", `/api/show/objects${query ? `?${query}` : ""}`);
}

export function executeShow(payload) {
  return apiExecutionRequest("POST", "/api/show/execute", payload);
}

export function executeShowBatch(payload) {
  return apiExecutionRequest("POST", "/api/show/batch-execute", payload);
}

export function executeExecBatch(payload) {
  return apiExecutionRequest("POST", "/api/exec/batch-execute", payload);
}

export function executeFlowBatch(payload) {
  return apiExecutionRequest("POST", "/api/flow/batch-execute", payload);
}

export function fetchConfigBatch(payload) {
  return apiExecutionRequest("POST", "/api/config/batch-fetch", payload);
}

export function fetchConfig(payload) {
  return apiExecutionRequest("POST", "/api/config/fetch", payload);
}

export function listDeviceConfigHistory({
  connectionName = "",
  fetchedFrom = "",
  fetchedTo = "",
  kind = "",
  limit = 100,
  sortOrder = "desc",
} = {}) {
  const params = new URLSearchParams();
  if (connectionName) params.set("connection_name", connectionName);
  if (fetchedFrom) params.set("fetched_from", fetchedFrom);
  if (fetchedTo) params.set("fetched_to", fetchedTo);
  if (kind) params.set("kind", kind);
  params.set("sort_order", sortOrder);
  params.set("limit", String(limit));
  return apiRequest("GET", `/api/device-config-history?${params.toString()}`);
}

export function listDeviceConfigHistoryDevices() {
  return apiRequest("GET", "/api/device-config-history/devices");
}

export function getDeviceConfigSnapshot(snapshotId) {
  return apiRequest(
    "GET",
    `/api/device-config-history/${encodeURIComponent(snapshotId)}`,
  );
}

export function deleteDeviceConfigSnapshot(snapshotId) {
  return apiRequest(
    "DELETE",
    `/api/device-config-history/${encodeURIComponent(snapshotId)}`,
  );
}

export function listConfigCommands(profile = "") {
  const params = new URLSearchParams();
  if (profile) params.set("profile", profile);
  const query = params.toString();
  return apiRequest("GET", `/api/config/commands${query ? `?${query}` : ""}`);
}

export function upsertConfigCommand(payload) {
  return apiRequest("POST", "/api/config/commands", payload);
}

export function deleteConfigCommand(payload) {
  return apiRequest("DELETE", "/api/config/commands", payload);
}

export function listConfigVolatilePatterns(profile = "") {
  const params = new URLSearchParams();
  if (profile) params.set("profile", profile);
  const query = params.toString();
  return apiRequest(
    "GET",
    `/api/config/volatile-patterns${query ? `?${query}` : ""}`,
  );
}

export function addConfigVolatilePattern(payload) {
  return apiRequest("POST", "/api/config/volatile-patterns", payload);
}

export function removeConfigVolatilePattern(payload) {
  return apiRequest("DELETE", "/api/config/volatile-patterns", payload);
}

export function listCustomShowObjects(profile = "") {
  const params = new URLSearchParams();
  if (profile) params.set("profile", profile);
  const query = params.toString();
  return apiRequest(
    "GET",
    `/api/show/custom-objects${query ? `?${query}` : ""}`,
  );
}

export function saveCustomShowObject({
  device_profile,
  object,
  command,
  mode,
  textfsm_mapping_command,
  textfsm_template_name,
  enabled = true,
}) {
  return apiRequest("POST", "/api/show/custom-objects", {
    device_profile,
    object,
    command,
    mode,
    textfsm_mapping_command,
    textfsm_template_name,
    enabled,
  });
}

export function deleteCustomShowObject({ device_profile, object }) {
  return apiRequest("DELETE", "/api/show/custom-objects", {
    device_profile,
    object,
  });
}

export function listTasks({ limit = 50, operation = "", status = "" } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (operation?.trim()) params.set("operation", operation.trim());
  if (status?.trim()) params.set("status", status.trim());
  const query = params.toString();
  return apiRequest("GET", `/api/tasks${query ? `?${query}` : ""}`);
}

export function getTask(taskId) {
  return apiRequest("GET", `/api/tasks/${encodeURIComponent(taskId)}`);
}

export function listSchedules() {
  return apiRequest("GET", "/api/schedules");
}

export function previewSchedule(payload) {
  return apiRequest("POST", "/api/schedules/preview", payload);
}

export function createSchedule(payload) {
  return apiRequest("POST", "/api/schedules", payload);
}

export function updateSchedule(scheduleId, payload) {
  return apiRequest(
    "PUT",
    `/api/schedules/${encodeURIComponent(scheduleId)}`,
    payload,
  );
}

export function deleteSchedule(scheduleId) {
  return apiRequest(
    "DELETE",
    `/api/schedules/${encodeURIComponent(scheduleId)}`,
  );
}

export function setScheduleEnabled(scheduleId, enabled) {
  const action = enabled ? "enable" : "disable";
  return apiRequest(
    "POST",
    `/api/schedules/${encodeURIComponent(scheduleId)}/${action}`,
  );
}

export function runScheduleNow(scheduleId) {
  return apiRequest(
    "POST",
    `/api/schedules/${encodeURIComponent(scheduleId)}/run`,
  );
}

export function listScheduleRuns(scheduleId, limit = 50) {
  return apiRequest(
    "GET",
    `/api/schedules/${encodeURIComponent(scheduleId)}/runs?limit=${limit}`,
  );
}

export function listTemplates() {
  return apiRequest("GET", "/api/templates");
}

export function getTemplate(name) {
  return apiRequest("GET", `/api/templates/${encodeURIComponent(name)}`);
}

export function createTemplate(name, content) {
  return apiRequest("POST", "/api/templates", { name, content });
}

export function updateTemplate(name, content) {
  return apiRequest("PUT", `/api/templates/${encodeURIComponent(name)}`, {
    content,
  });
}

export function deleteTemplate(name) {
  return apiRequest("DELETE", `/api/templates/${encodeURIComponent(name)}`);
}

export function listTemplateResource(basePath) {
  return apiRequest("GET", basePath);
}

export function getTemplateResource(basePath, name) {
  return apiRequest("GET", `${basePath}/${encodeURIComponent(name)}`);
}

export function previewTxWorkflowTemplate(name, workflowVars = {}) {
  return apiRequest(
    "POST",
    `/api/tx-workflow-templates/${encodeURIComponent(name)}/preview`,
    { workflow_vars: workflowVars },
  );
}

export function createTemplateResource(basePath, name, content) {
  return apiRequest("POST", basePath, { name, content });
}

export function updateTemplateResource(basePath, name, content) {
  return apiRequest("PUT", `${basePath}/${encodeURIComponent(name)}`, {
    content,
  });
}

export function deleteTemplateResource(basePath, name) {
  return apiRequest("DELETE", `${basePath}/${encodeURIComponent(name)}`);
}

export function exportTextfsmExcel(payload) {
  return apiRequestBlob("POST", "/api/textfsm/export/xlsx", payload);
}

export function listTextfsmTemplates() {
  return apiRequest("GET", "/api/textfsm/templates");
}

export function getTextfsmTemplate(name) {
  return apiRequest(
    "GET",
    `/api/textfsm/templates/${encodeURIComponent(name)}`,
  );
}

export function createTextfsmTemplate(name, content) {
  return apiRequest("POST", "/api/textfsm/templates", { name, content });
}

export function updateTextfsmTemplate(name, content) {
  return apiRequest(
    "PUT",
    `/api/textfsm/templates/${encodeURIComponent(name)}`,
    {
      content,
    },
  );
}

export function deleteTextfsmTemplate(name) {
  return apiRequest(
    "DELETE",
    `/api/textfsm/templates/${encodeURIComponent(name)}`,
  );
}

export function listTextfsmMappings(profile = "") {
  const params = new URLSearchParams();
  if (profile) params.set("profile", profile);
  const query = params.toString();
  return apiRequest("GET", `/api/textfsm/mappings${query ? `?${query}` : ""}`);
}

export function saveTextfsmMapping({ device_profile, command, template_name }) {
  return apiRequest("POST", "/api/textfsm/mappings", {
    device_profile,
    command,
    template_name,
  });
}

export function deleteTextfsmMapping({ device_profile, command }) {
  return apiRequest("DELETE", "/api/textfsm/mappings", {
    device_profile,
    command,
  });
}
