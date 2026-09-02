import { storageGet, storageRemove, storageSet } from "../lib/browser.js";
import type {
  WebAuthLoginPayload,
  WebAuthStatusPayload,
} from "$domains/auth/model/types.js";
import type { BackupItem } from "$domains/backup/model/types.js";
import type {
  BlacklistCheckResult,
  BlacklistDeleteResponse,
  BlacklistPatternEntry,
  BlacklistUpsertResponse,
} from "$domains/blacklist/model/types.js";
import type {
  ConfigCommandRow,
  ConfigFetchBatchPayload,
  ConfigFetchCurrentPayload,
  ConfigFetchResultPayload,
  ConfigFetchResultRow,
} from "$domains/config-fetch/model/types.js";
import type {
  ConfigHistoryDevice,
  DeviceConfigHistoryFilters,
  DeviceConfigHistoryResponse,
  DeviceConfigSnapshot,
  DeviceConfigSnapshotMutationResponse,
} from "$domains/config-history/model/types.js";
import type {
  ConnectionHistoryItem,
  ConnectionFactsResponse,
  ConnectionHistoryDetailResponse,
  ConnectionImportReport,
  ConnectionRequestPayload,
  SavedConnection,
  SavedConnectionDetail,
  ConnectionTestResponse,
} from "$domains/connections/model/types.js";
import type {
  CredentialApiRow,
  CredentialImportApiReport,
  CredentialSavePayload,
} from "$domains/credentials/model/types.js";
import type {
  CreateDiscoveryRunPayload,
  DiscoveryRun,
  DiscoveryRunDetail,
  ImportDiscoveryItem,
  ImportDiscoverySummary,
} from "$domains/device-discovery/model/types.js";
import type {
  InventoryGroupPayload,
  InventoryItem,
} from "$domains/inventory/model/types.js";
import type { ReplayApi, ReplayResult } from "$domains/replay/model/types.js";
import type {
  ExecuteOrchestrationResponse,
  OrchestrationJsonValue,
} from "$domains/orchestration/model/types.js";
import type {
  OrchestrationExecutionRequest,
  TxBlockExecutionRequest,
  TxBlockExecutionResponse,
  TxWorkflowExecutionRequest,
  TxWorkflowExecutionResponse,
} from "$domains/orchestration/model/orchestratedExecutionPayloads.js";
import type {
  InventorySelector,
  NamedResource,
  ScheduleConnection,
  ScheduleDefinition,
  SchedulePreviewRequest,
  SchedulePreviewResponse,
  ScheduleRun,
  StoredSchedule,
} from "$domains/schedules/model/types.js";
import type {
  ShowObjectQuery,
  ShowObjectsPayload,
} from "$domains/show/model/types.js";
import type {
  StandardBatchExecPayload,
  StandardBatchExecResponse,
  StandardBatchFlowPayload,
  StandardBatchFlowResponse,
  StandardCommandExecutionPayload,
  StandardCommandExecutionResponse,
  StandardCommandFlowExecutionPayload,
  StandardFlowTemplateDetail,
} from "$domains/standard/model/types.js";
import type {
  TaskQuery,
  TaskRun,
  TaskRunDetail,
} from "$domains/tasks/model/types.js";
import type {
  TemplateResourceMeta,
  TemplateResourceDetail as TemplateRecord,
  CustomShowObjectApiPayload,
  TextfsmMappingApiPayload,
} from "$domains/templates/model/types.js";
import type {
  TransferUploadPayload,
  TransferUploadResult,
} from "$domains/transfer/model/types.js";

type JsonRecord = Record<string, unknown>;
type JsonBody = object;
type SavedConnectionListItem = SavedConnection & { name: string };

interface ConfigCommandUpsertPayload {
  command: string;
  device_profile: string;
  kind: string;
  mode: string | null;
}

interface ConfigCommandDeletePayload {
  device_profile: string;
  kind: string;
}

interface ConfigVolatilePattern {
  device_profile: string;
  pattern: string;
  source: string;
}

type ConfigVolatilePatternPayload = Omit<ConfigVolatilePattern, "source">;

const AGENT_API_TOKEN_KEY = "rauto_agent_api_token";
let unauthorizedHandler: (() => void) | null = null;

interface ApiErrorOptions {
  payload?: unknown;
  status?: number;
}

class ApiError extends Error {
  payload: unknown;
  status: number | undefined;

  constructor(message: string, { status, payload }: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function authHeaders(body: JsonBody | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
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

export function setApiUnauthorizedHandler(
  handler: (() => void) | null,
): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

function notifyUnauthorized(response: Response): void {
  if (response.status === 401 && unauthorizedHandler) unauthorizedHandler();
}

export function getAgentApiToken(): string {
  return storageGet(AGENT_API_TOKEN_KEY).trim();
}

export function setAgentApiToken(token: string | null | undefined): void {
  const normalized = String(token ?? "").trim();
  if (normalized) {
    storageSet(AGENT_API_TOKEN_KEY, normalized);
  } else {
    storageRemove(AGENT_API_TOKEN_KEY);
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function responseErrorMessage(payload: unknown, response: Response): string {
  if (typeof payload === "string") return payload || response.statusText;
  const payloadValue = objectValue(payload);
  const errorValue = objectValue(payloadValue?.error);
  if (errorValue) {
    return typeof errorValue.message === "string"
      ? errorValue.message
      : response.statusText;
  }
  const message = payloadValue?.error ?? payloadValue?.message;
  return typeof message === "string" ? message : response.statusText;
}

async function responsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json")
    ? await response.json()
    : await response.text();
}

function responseFilename(headers: Headers): string {
  const disposition = headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return match ? match[1] : "";
}

async function apiRequest<TResponse>(
  method: string,
  path: string,
  body?: JsonBody,
): Promise<TResponse> {
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
  return payload as TResponse;
}

export function unwrapExecutionResponse(
  payload: unknown,
): Record<string, unknown> {
  const payloadValue = objectValue(payload);
  const hasField = (field: string): boolean =>
    Object.prototype.hasOwnProperty.call(payloadValue || {}, field);
  if (
    !payloadValue ||
    typeof payloadValue.success !== "boolean" ||
    !hasField("error") ||
    !hasField("result_summary") ||
    !hasField("data") ||
    !objectValue(payloadValue.data)
  ) {
    throw new ApiError("Invalid execution response", { payload });
  }
  const data = objectValue(payloadValue.data)!;
  Object.defineProperty(data, "execution_response", {
    configurable: false,
    enumerable: false,
    value: {
      success: payloadValue.success,
      error: payloadValue.error,
      result_summary: payloadValue.result_summary,
    },
    writable: false,
  });
  Object.defineProperty(data, "result_summary", {
    configurable: false,
    enumerable: false,
    value: payloadValue.result_summary,
    writable: false,
  });
  return data;
}

async function apiExecutionRequest<TResponse = JsonRecord>(
  method: string,
  path: string,
  body?: JsonBody,
): Promise<TResponse> {
  return unwrapExecutionResponse(
    await apiRequest<unknown>(method, path, body),
  ) as TResponse;
}

async function apiRequestBlob(
  method: string,
  path: string,
  body?: JsonBody,
  fallbackFilename = "textfsm.xlsx",
): Promise<{ blob: Blob; filename: string }> {
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

async function apiRequestForm<TResponse>(
  method: string,
  path: string,
  formData: FormData,
): Promise<TResponse> {
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
  return payload as TResponse;
}

export function getAgentInfo(): Promise<{ managed?: boolean }> {
  return apiRequest("GET", "/api/agent/info");
}

export function getWebAuthStatus(): Promise<WebAuthStatusPayload> {
  return apiRequest("GET", "/api/auth/status");
}

export function loginWeb(password: string): Promise<WebAuthLoginPayload> {
  return apiRequest("POST", "/api/auth/login", { password });
}

export function logoutWeb(): Promise<WebAuthStatusPayload> {
  return apiRequest("POST", "/api/auth/logout", {});
}

export function listBlacklistPatterns(): Promise<BlacklistPatternEntry[]> {
  return apiRequest("GET", "/api/blacklist");
}

export function addBlacklistPattern(
  pattern: string,
): Promise<BlacklistUpsertResponse> {
  return apiRequest("POST", "/api/blacklist", { pattern });
}

export function deleteBlacklistPattern(
  pattern: string,
): Promise<BlacklistDeleteResponse> {
  return apiRequest("DELETE", `/api/blacklist/${encodeURIComponent(pattern)}`);
}

export function checkBlacklistCommand(
  command: string,
): Promise<BlacklistCheckResult> {
  return apiRequest("POST", "/api/blacklist/check", { command });
}

export function listBackups(): Promise<BackupItem[]> {
  return apiRequest("GET", "/api/backups");
}

export function createBackup(): Promise<{ path?: string | null }> {
  return apiRequest("POST", "/api/backups", {});
}

export function restoreBackup(
  archive: string,
  replace = false,
): Promise<{ archive?: string | null }> {
  return apiRequest("POST", "/api/backups/restore", {
    archive,
    replace,
  });
}

function backupDownloadUrl(name: string): string {
  return `/api/backups/${encodeURIComponent(name)}/download`;
}

export function downloadBackupBlob(name: string) {
  return apiRequestBlob("GET", backupDownloadUrl(name), undefined, name);
}

export function listConnections(): Promise<SavedConnectionListItem[]> {
  return apiRequest("GET", "/api/connections");
}

export function listCredentials(): Promise<CredentialApiRow[]> {
  return apiRequest("GET", "/api/credentials");
}

export function getCredential(id: string): Promise<CredentialApiRow> {
  return apiRequest("GET", `/api/credentials/${encodeURIComponent(id)}`);
}

export function createCredential(
  credential: CredentialSavePayload,
): Promise<CredentialApiRow> {
  return apiRequest("POST", "/api/credentials", credential);
}

export function updateCredential(
  id: string,
  credential: CredentialSavePayload,
): Promise<CredentialApiRow> {
  return apiRequest(
    "PUT",
    `/api/credentials/${encodeURIComponent(id)}`,
    credential,
  );
}

export function deleteCredential(id: string): Promise<JsonRecord> {
  return apiRequest("DELETE", `/api/credentials/${encodeURIComponent(id)}`);
}

export function importCredentials(
  file: File,
): Promise<CredentialImportApiReport> {
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

export function getConnection(name: string): Promise<SavedConnectionDetail> {
  return apiRequest("GET", `/api/connections/${encodeURIComponent(name)}`);
}

export function saveConnection(
  name: string,
  connection: ConnectionRequestPayload,
): Promise<SavedConnectionDetail> {
  return apiRequest("PUT", `/api/connections/${encodeURIComponent(name)}`, {
    connection,
  });
}

export function deleteConnection(name: string): Promise<JsonRecord> {
  return apiRequest("DELETE", `/api/connections/${encodeURIComponent(name)}`);
}

export function testConnection(
  connection: ConnectionRequestPayload,
): Promise<ConnectionTestResponse> {
  return apiRequest("POST", "/api/connection/test", {
    connection,
  });
}

export function detectConnectionFacts(
  connection: ConnectionRequestPayload,
): Promise<ConnectionFactsResponse> {
  return apiRequest("POST", "/api/connection/detect-facts", {
    connection,
  });
}

export function createDeviceDiscoveryRun(
  options: CreateDiscoveryRunPayload,
): Promise<DiscoveryRunDetail> {
  return apiRequest("POST", "/api/device-discovery/runs", options);
}

export function listDeviceDiscoveryRuns(): Promise<DiscoveryRun[]> {
  return apiRequest("GET", "/api/device-discovery/runs");
}

export function getDeviceDiscoveryRun(
  runId: string,
): Promise<DiscoveryRunDetail> {
  return apiRequest(
    "GET",
    `/api/device-discovery/runs/${encodeURIComponent(runId)}`,
  );
}

export function cancelDeviceDiscoveryRun(
  runId: string,
): Promise<DiscoveryRunDetail> {
  return apiRequest(
    "POST",
    `/api/device-discovery/runs/${encodeURIComponent(runId)}/cancel`,
  );
}

export function importDeviceDiscoveryResults(
  runId: string,
  items: ImportDiscoveryItem[],
): Promise<ImportDiscoverySummary> {
  return apiRequest(
    "POST",
    `/api/device-discovery/runs/${encodeURIComponent(runId)}/import`,
    { items },
  );
}

export function listConnectionHistory(
  name: string,
  limit = 30,
): Promise<ConnectionHistoryItem[]> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return apiRequest(
    "GET",
    `/api/connections/${encodeURIComponent(name)}/history${query ? `?${query}` : ""}`,
  );
}

export function getConnectionHistoryDetail(
  name: string,
  historyId: string | number,
): Promise<ConnectionHistoryDetailResponse> {
  return apiRequest(
    "GET",
    `/api/connections/${encodeURIComponent(name)}/history/${encodeURIComponent(historyId)}`,
  );
}

export function deleteConnectionHistory(
  name: string,
  historyId: string | number,
): Promise<JsonRecord> {
  return apiRequest(
    "DELETE",
    `/api/connections/${encodeURIComponent(name)}/history/${encodeURIComponent(historyId)}`,
  );
}

export function importConnections(file: File): Promise<ConnectionImportReport> {
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

export function executeCommand(payload: JsonRecord): Promise<JsonRecord> {
  return apiExecutionRequest("POST", "/api/exec", payload);
}

export function executeTemplate(
  payload: StandardCommandExecutionPayload,
): Promise<StandardCommandExecutionResponse> {
  return apiExecutionRequest("POST", "/api/template/execute", payload);
}

export function renderTemplate(payload: JsonRecord): Promise<JsonRecord> {
  return apiRequest("POST", "/api/render", payload);
}

export function executeCommandFlow(
  payload: StandardCommandFlowExecutionPayload,
): Promise<JsonRecord> {
  return apiExecutionRequest("POST", "/api/command-flow/execute", payload);
}

export function inspectCommandFlowTemplate(
  content: string,
): Promise<StandardFlowTemplateDetail> {
  return apiRequest("POST", "/api/flow-templates/inspect", { content });
}

export function inspectCommandTemplate(content: string): Promise<JsonRecord> {
  return apiRequest("POST", "/api/templates/inspect", { content });
}

export function getCommandFlowTemplate(
  name: string,
  { builtin = false }: { builtin?: boolean } = {},
) {
  return getTemplateResource(
    builtin ? "/api/flow-templates/builtins" : "/api/flow-templates",
    name,
  );
}

export function createCommandFlowTemplate(name: string, content: string) {
  return createTemplateResource("/api/flow-templates", name, content);
}

export function updateCommandFlowTemplate(name: string, content: string) {
  return updateTemplateResource("/api/flow-templates", name, content);
}

export function executeUpload(
  payload: TransferUploadPayload,
): Promise<TransferUploadResult> {
  return apiExecutionRequest("POST", "/api/upload", payload);
}

export function executeTxBlock(
  payload: TxBlockExecutionRequest,
): Promise<TxBlockExecutionResponse> {
  return apiExecutionRequest<TxBlockExecutionResponse>(
    "POST",
    "/api/tx/block",
    payload,
  );
}

export function executeTxWorkflow(
  payload: TxWorkflowExecutionRequest,
): Promise<TxWorkflowExecutionResponse> {
  return apiExecutionRequest<TxWorkflowExecutionResponse>(
    "POST",
    "/api/tx/workflow",
    payload,
  );
}

export function executeOrchestration(
  payload: OrchestrationExecutionRequest,
): Promise<ExecuteOrchestrationResponse> {
  return apiExecutionRequest<ExecuteOrchestrationResponse>(
    "POST",
    "/api/orchestrate",
    payload,
  );
}

export function replaySession(
  payload: Parameters<ReplayApi["replaySession"]>[0],
): Promise<ReplayResult> {
  return apiRequest("POST", "/api/replay", payload);
}

export function listInventoryGroups(): Promise<InventoryItem[]> {
  return apiRequest("GET", "/api/inventory/groups");
}

export function getInventoryGroup(name: string): Promise<InventoryItem> {
  return apiRequest("GET", `/api/inventory/groups/${encodeURIComponent(name)}`);
}

export function saveInventoryGroup(
  name: string,
  group: InventoryGroupPayload,
): Promise<InventoryItem> {
  return apiRequest(
    "PUT",
    `/api/inventory/groups/${encodeURIComponent(name)}`,
    {
      group,
    },
  );
}

export function deleteInventoryGroup(name: string): Promise<JsonRecord> {
  return apiRequest(
    "DELETE",
    `/api/inventory/groups/${encodeURIComponent(name)}`,
  );
}

export function listInventoryLabels(): Promise<InventoryItem[]> {
  return apiRequest("GET", "/api/inventory/labels");
}

export function getInventoryLabel(name: string): Promise<InventoryItem> {
  return apiRequest("GET", `/api/inventory/labels/${encodeURIComponent(name)}`);
}

export function saveInventoryLabel(
  name: string,
  hosts: string[],
): Promise<InventoryItem> {
  return apiRequest(
    "PUT",
    `/api/inventory/labels/${encodeURIComponent(name)}`,
    {
      hosts,
    },
  );
}

export function deleteInventoryLabel(name: string): Promise<JsonRecord> {
  return apiRequest(
    "DELETE",
    `/api/inventory/labels/${encodeURIComponent(name)}`,
  );
}

export function getDeviceProfilesOverview(): Promise<JsonRecord[]> {
  return apiRequest("GET", "/api/device-profiles/all");
}

export function getBuiltinProfileDetail(name: string): Promise<JsonRecord> {
  return apiRequest(
    "GET",
    `/api/device-profiles/builtin/${encodeURIComponent(name)}`,
  );
}

export function getBuiltinProfileForm(name: string): Promise<JsonRecord> {
  return apiRequest(
    "GET",
    `/api/device-profiles/builtin/${encodeURIComponent(name)}/form`,
  );
}

export function getCustomProfileForm(name: string): Promise<JsonRecord> {
  return apiRequest(
    "GET",
    `/api/device-profiles/custom/${encodeURIComponent(name)}/form`,
  );
}

export function saveCustomProfile(
  name: string,
  content: string,
): Promise<JsonRecord> {
  return apiRequest(
    "PUT",
    `/api/device-profiles/custom/${encodeURIComponent(name)}`,
    {
      content,
    },
  );
}

export function saveCustomProfileForm(
  name: string,
  profile: JsonRecord,
): Promise<JsonRecord> {
  return apiRequest(
    "PUT",
    `/api/device-profiles/custom/${encodeURIComponent(name)}/form`,
    profile,
  );
}

export function deleteCustomProfile(name: string): Promise<JsonRecord> {
  return apiRequest(
    "DELETE",
    `/api/device-profiles/custom/${encodeURIComponent(name)}`,
  );
}

export function getProfileModes(name: string): Promise<JsonRecord> {
  return apiRequest(
    "GET",
    `/api/device-profiles/${encodeURIComponent(name)}/modes`,
  );
}

export function diagnoseProfile(name: string): Promise<JsonRecord> {
  return apiRequest("POST", "/api/device-profiles/diagnose", { name });
}

export function listShowObjects({
  deviceProfile = "",
  textfsmPlatform = "",
}: ShowObjectQuery = {}): Promise<ShowObjectsPayload> {
  const params = new URLSearchParams();
  if (deviceProfile) params.set("device_profile", deviceProfile);
  if (textfsmPlatform) params.set("textfsm_platform", textfsmPlatform);
  const query = params.toString();
  return apiRequest("GET", `/api/show/objects${query ? `?${query}` : ""}`);
}

export function executeShow(payload: JsonRecord): Promise<JsonRecord> {
  return apiExecutionRequest("POST", "/api/show/execute", payload);
}

export function executeShowBatch(payload: JsonRecord): Promise<JsonRecord> {
  return apiExecutionRequest("POST", "/api/show/batch-execute", payload);
}

export function executeExecBatch(
  payload: StandardBatchExecPayload,
): Promise<StandardBatchExecResponse> {
  return apiExecutionRequest("POST", "/api/exec/batch-execute", payload);
}

export function executeFlowBatch(
  payload: StandardBatchFlowPayload,
): Promise<StandardBatchFlowResponse> {
  return apiExecutionRequest("POST", "/api/flow/batch-execute", payload);
}

export function fetchConfigBatch(
  payload: ConfigFetchBatchPayload,
): Promise<ConfigFetchResultPayload> {
  return apiExecutionRequest("POST", "/api/config/batch-fetch", payload);
}

export function fetchConfig(
  payload: ConfigFetchCurrentPayload,
): Promise<ConfigFetchResultRow> {
  return apiExecutionRequest("POST", "/api/config/fetch", payload);
}

export function listDeviceConfigHistory({
  connectionName = "",
  fetchedFrom = "",
  fetchedTo = "",
  kind = "",
  limit = 100,
  sortOrder = "desc",
}: {
  connectionName?: string;
  fetchedFrom?: string;
  fetchedTo?: string;
  kind?: string;
  limit?: number;
  sortOrder?: DeviceConfigHistoryFilters["sortOrder"];
} = {}): Promise<DeviceConfigHistoryResponse> {
  const params = new URLSearchParams();
  if (connectionName) params.set("connection_name", connectionName);
  if (fetchedFrom) params.set("fetched_from", fetchedFrom);
  if (fetchedTo) params.set("fetched_to", fetchedTo);
  if (kind) params.set("kind", kind);
  params.set("sort_order", sortOrder);
  params.set("limit", String(limit));
  return apiRequest("GET", `/api/device-config-history?${params.toString()}`);
}

export function listDeviceConfigHistoryDevices(): Promise<
  ConfigHistoryDevice[]
> {
  return apiRequest("GET", "/api/device-config-history/devices");
}

export function getDeviceConfigSnapshot(
  snapshotId: string,
): Promise<DeviceConfigSnapshot> {
  return apiRequest(
    "GET",
    `/api/device-config-history/${encodeURIComponent(snapshotId)}`,
  );
}

export function deleteDeviceConfigSnapshot(
  snapshotId: string,
): Promise<DeviceConfigSnapshotMutationResponse> {
  return apiRequest(
    "DELETE",
    `/api/device-config-history/${encodeURIComponent(snapshotId)}`,
  );
}

export function listConfigCommands(profile = ""): Promise<ConfigCommandRow[]> {
  const params = new URLSearchParams();
  if (profile) params.set("profile", profile);
  const query = params.toString();
  return apiRequest("GET", `/api/config/commands${query ? `?${query}` : ""}`);
}

export function upsertConfigCommand(
  payload: ConfigCommandUpsertPayload,
): Promise<ConfigCommandRow> {
  return apiRequest("POST", "/api/config/commands", payload);
}

export function deleteConfigCommand(
  payload: ConfigCommandDeletePayload,
): Promise<{ ok: boolean }> {
  return apiRequest("DELETE", "/api/config/commands", payload);
}

export function listConfigVolatilePatterns(
  profile = "",
): Promise<ConfigVolatilePattern[]> {
  const params = new URLSearchParams();
  if (profile) params.set("profile", profile);
  const query = params.toString();
  return apiRequest(
    "GET",
    `/api/config/volatile-patterns${query ? `?${query}` : ""}`,
  );
}

export function addConfigVolatilePattern(
  payload: ConfigVolatilePatternPayload,
): Promise<{ added: boolean; ok: boolean }> {
  return apiRequest("POST", "/api/config/volatile-patterns", payload);
}

export function removeConfigVolatilePattern(
  payload: ConfigVolatilePatternPayload,
): Promise<{ ok: boolean }> {
  return apiRequest("DELETE", "/api/config/volatile-patterns", payload);
}

export function listCustomShowObjects(profile = ""): Promise<JsonRecord[]> {
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
}: CustomShowObjectApiPayload): Promise<JsonRecord> {
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

export function deleteCustomShowObject({
  device_profile,
  object,
}: Pick<
  CustomShowObjectApiPayload,
  "device_profile" | "object"
>): Promise<JsonRecord> {
  return apiRequest("DELETE", "/api/show/custom-objects", {
    device_profile,
    object,
  });
}

export function listTasks({
  limit = 50,
  operation = "",
  status = "",
}: TaskQuery = {}): Promise<TaskRun[]> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (operation?.trim()) params.set("operation", operation.trim());
  if (status?.trim()) params.set("status", status.trim());
  const query = params.toString();
  return apiRequest("GET", `/api/tasks${query ? `?${query}` : ""}`);
}

export function getTask(taskId: string): Promise<TaskRunDetail> {
  return apiRequest("GET", `/api/tasks/${encodeURIComponent(taskId)}`);
}

export function listSchedules(): Promise<StoredSchedule[]> {
  return apiRequest("GET", "/api/schedules");
}

export function previewSchedule(
  payload: SchedulePreviewRequest,
): Promise<SchedulePreviewResponse> {
  return apiRequest("POST", "/api/schedules/preview", payload);
}

export function createSchedule(
  payload: ScheduleDefinition,
): Promise<StoredSchedule> {
  return apiRequest("POST", "/api/schedules", payload);
}

export function updateSchedule(
  scheduleId: string,
  payload: ScheduleDefinition,
): Promise<StoredSchedule> {
  return apiRequest(
    "PUT",
    `/api/schedules/${encodeURIComponent(scheduleId)}`,
    payload,
  );
}

export function deleteSchedule(scheduleId: string): Promise<JsonRecord> {
  return apiRequest(
    "DELETE",
    `/api/schedules/${encodeURIComponent(scheduleId)}`,
  );
}

export function setScheduleEnabled(
  scheduleId: string,
  enabled: boolean,
): Promise<JsonRecord> {
  const action = enabled ? "enable" : "disable";
  return apiRequest(
    "POST",
    `/api/schedules/${encodeURIComponent(scheduleId)}/${action}`,
  );
}

export function runScheduleNow(scheduleId: string): Promise<JsonRecord> {
  return apiRequest(
    "POST",
    `/api/schedules/${encodeURIComponent(scheduleId)}/run`,
  );
}

export function listScheduleRuns(
  scheduleId: string,
  limit = 50,
): Promise<ScheduleRun[]> {
  return apiRequest(
    "GET",
    `/api/schedules/${encodeURIComponent(scheduleId)}/runs?limit=${limit}`,
  );
}

export function listTemplates(): Promise<TemplateResourceMeta[]> {
  return apiRequest("GET", "/api/templates");
}

export function getTemplate(name: string): Promise<TemplateRecord> {
  return apiRequest("GET", `/api/templates/${encodeURIComponent(name)}`);
}

export function createTemplate(
  name: string,
  content: string,
): Promise<TemplateRecord> {
  return apiRequest("POST", "/api/templates", { name, content });
}

export function updateTemplate(
  name: string,
  content: string,
): Promise<TemplateRecord> {
  return apiRequest("PUT", `/api/templates/${encodeURIComponent(name)}`, {
    content,
  });
}

export function deleteTemplate(name: string): Promise<JsonRecord> {
  return apiRequest("DELETE", `/api/templates/${encodeURIComponent(name)}`);
}

export function listTemplateResource(
  basePath: string,
): Promise<TemplateResourceMeta[]> {
  return apiRequest("GET", basePath);
}

export function getTemplateResource(
  basePath: string,
  name: string,
): Promise<TemplateRecord> {
  return apiRequest("GET", `${basePath}/${encodeURIComponent(name)}`);
}

export function previewTxWorkflowTemplate(
  name: string,
  workflowVars: JsonRecord = {},
): Promise<TxWorkflowTemplatePreviewResponse> {
  return apiRequest(
    "POST",
    `/api/tx-workflow-templates/${encodeURIComponent(name)}/preview`,
    { workflow_vars: workflowVars },
  );
}

export interface TxWorkflowTemplatePreviewResponse {
  unresolved_paths: string[];
  workflow: OrchestrationJsonValue;
}

export function createTemplateResource(
  basePath: string,
  name: string,
  content: string,
): Promise<TemplateRecord> {
  return apiRequest("POST", basePath, { name, content });
}

export function updateTemplateResource(
  basePath: string,
  name: string,
  content: string,
): Promise<TemplateRecord> {
  return apiRequest("PUT", `${basePath}/${encodeURIComponent(name)}`, {
    content,
  });
}

export function deleteTemplateResource(
  basePath: string,
  name: string,
): Promise<JsonRecord> {
  return apiRequest("DELETE", `${basePath}/${encodeURIComponent(name)}`);
}

export function exportTextfsmExcel(payload: JsonRecord) {
  return apiRequestBlob("POST", "/api/textfsm/export/xlsx", payload);
}

export function listTextfsmTemplates(): Promise<TemplateResourceMeta[]> {
  return apiRequest("GET", "/api/textfsm/templates");
}

export function getTextfsmTemplate(name: string): Promise<TemplateRecord> {
  return apiRequest(
    "GET",
    `/api/textfsm/templates/${encodeURIComponent(name)}`,
  );
}

export function createTextfsmTemplate(
  name: string,
  content: string,
): Promise<TemplateRecord> {
  return apiRequest("POST", "/api/textfsm/templates", { name, content });
}

export function updateTextfsmTemplate(
  name: string,
  content: string,
): Promise<TemplateRecord> {
  return apiRequest(
    "PUT",
    `/api/textfsm/templates/${encodeURIComponent(name)}`,
    {
      content,
    },
  );
}

export function deleteTextfsmTemplate(name: string): Promise<JsonRecord> {
  return apiRequest(
    "DELETE",
    `/api/textfsm/templates/${encodeURIComponent(name)}`,
  );
}

export function listTextfsmMappings(profile = ""): Promise<JsonRecord[]> {
  const params = new URLSearchParams();
  if (profile) params.set("profile", profile);
  const query = params.toString();
  return apiRequest("GET", `/api/textfsm/mappings${query ? `?${query}` : ""}`);
}

export function saveTextfsmMapping({
  device_profile,
  command,
  template_name,
}: TextfsmMappingApiPayload): Promise<JsonRecord> {
  return apiRequest("POST", "/api/textfsm/mappings", {
    device_profile,
    command,
    template_name,
  });
}

export function deleteTextfsmMapping({
  device_profile,
  command,
}: Omit<TextfsmMappingApiPayload, "template_name">): Promise<JsonRecord> {
  return apiRequest("DELETE", "/api/textfsm/mappings", {
    device_profile,
    command,
  });
}
