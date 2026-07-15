import { storageGet, storageRemove, storageSet } from "../lib/browser.js";

const AGENT_API_TOKEN_KEY = "rauto_agent_api_token";

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
  return typeof payload === "string"
    ? payload || response.statusText
    : payload.error || payload.message || response.statusText;
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
    throw new ApiError(responseErrorMessage(payload, response), {
      status: response.status,
      payload,
    });
  }
  return payload;
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

export function createBackup(output) {
  return apiRequest("POST", "/api/backups", {
    output: output?.trim() ? output.trim() : null,
  });
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
  return apiRequest("POST", "/api/exec", payload);
}

export function executeTemplate(payload) {
  return apiRequest("POST", "/api/template/execute", payload);
}

export function renderTemplate(payload) {
  return apiRequest("POST", "/api/render", payload);
}

export function executeCommandFlow(payload) {
  return apiRequest("POST", "/api/command-flow/execute", payload);
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
  return apiRequest("POST", "/api/upload", payload);
}

export function executeTxBlock(payload) {
  return apiRequest("POST", "/api/tx/block", payload);
}

export function executeTxWorkflow(payload) {
  return apiRequest("POST", "/api/tx/workflow", payload);
}

export function executeOrchestration(payload) {
  return apiRequest("POST", "/api/orchestrate", payload);
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
  return apiRequest("POST", "/api/show/execute", payload);
}

export function executeShowBatch(payload) {
  return apiRequest("POST", "/api/show/batch-execute", payload);
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
