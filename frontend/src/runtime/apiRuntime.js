const AGENT_API_TOKEN_KEY = "rauto_agent_api_token";

import {
  byId,
  runtimeValue,
  safeCall,
  setRuntimeValue,
} from "../services/runtimeGlobals.js";
import { setDashboardManagedAgentMode } from "../state/dashboardView.js";

function t(key) {
  return typeof window.t === "function" ? window.t(key) : key;
}

function getStoredAgentApiToken() {
  return (localStorage.getItem(AGENT_API_TOKEN_KEY) || "").trim();
}

function setStoredAgentApiToken(token) {
  const normalized = String(token || "").trim();
  if (normalized) {
    localStorage.setItem(AGENT_API_TOKEN_KEY, normalized);
  } else {
    localStorage.removeItem(AGENT_API_TOKEN_KEY);
  }
}

function buildRequestHeaders(includeContentType = true) {
  const headers = {};
  if (includeContentType) {
    headers["content-type"] = "application/json";
  }
  const token = getStoredAgentApiToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["X-API-Key"] = token;
  }
  return headers;
}

function syncAgentAuthUi() {
  const wrap = byId("agent-auth-wrap");
  if (!wrap) return;
  const managedAgentMode = !!runtimeValue("managedAgentMode");
  setDashboardManagedAgentMode(managedAgentMode);
  wrap.hidden = !managedAgentMode;
  if (!managedAgentMode) {
    return;
  }
  const token = getStoredAgentApiToken();
  const input = byId("agent-api-token");
  if (input) input.value = token;
  safeCall(
    "setStatusMessage",
    "agent-auth-out",
    token ? t("agentAuthSaved") : t("agentAuthRequired"),
    token ? "success" : "info",
  );
}

function maybePersistAgentTokenFromUrl() {
  const url = new URL(window.location.href);
  const token = (
    url.searchParams.get("token") ||
    url.searchParams.get("api_token") ||
    ""
  ).trim();
  if (!token) return false;
  setStoredAgentApiToken(token);
  url.searchParams.delete("token");
  url.searchParams.delete("api_token");
  window.history.replaceState({}, document.title, url.toString());
  return true;
}

async function detectManagedAgentMode() {
  try {
    const res = await fetch("/api/agent/info");
    if (!res.ok) {
      setRuntimeValue("managedAgentMode", false);
      return false;
    }
    const raw = await res.text();
    const data = raw ? JSON.parse(raw) : null;
    const managed = !!(data && data.managed);
    setRuntimeValue("managedAgentMode", managed);
    setDashboardManagedAgentMode(managed);
    return managed;
  } catch (_) {
    setRuntimeValue("managedAgentMode", false);
    setDashboardManagedAgentMode(false);
    return false;
  } finally {
    syncAgentAuthUi();
    safeCall("applyTabs");
  }
}

async function refreshProtectedData() {
  await Promise.allSettled([
    safeCall("loadSavedConnections"),
    safeCall("loadProfilesOverview"),
    safeCall("loadShowObjects"),
    safeCall("loadTemplates"),
    safeCall("loadFlowTemplates"),
    safeCall("loadTextfsmTemplates"),
    safeCall("loadTextfsmMappings"),
    safeCall("loadAllJsonTemplates"),
    safeCall("loadInventoryConnections"),
    safeCall("loadInventoryGroups"),
    safeCall("loadInventoryLabels"),
    safeCall("loadBlacklistPatterns"),
    safeCall("loadBackups"),
  ]);
}

async function decodeResponse(res) {
  const raw = await res.text();
  try {
    return {
      raw,
      data: raw ? JSON.parse(raw) : null,
    };
  } catch (_) {
    return { raw, data: null };
  }
}

function errorMessage(res, raw, data) {
  if (res.status === 401) {
    return getStoredAgentApiToken()
      ? t("agentAuthInvalid")
      : t("agentAuthRequired");
  }
  return (data && data.error) || raw || t("requestFailed");
}

async function request(method, url, body) {
  const options = {
    method,
    headers: buildRequestHeaders(true),
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const { raw, data } = await decodeResponse(res);
  if (!res.ok) {
    throw new Error(errorMessage(res, raw, data));
  }
  return data ?? {};
}

async function requestForm(method, url, formData) {
  const res = await fetch(url, {
    method,
    headers: buildRequestHeaders(false),
    body: formData,
  });
  const { raw, data } = await decodeResponse(res);
  if (!res.ok) {
    throw new Error(errorMessage(res, raw, data));
  }
  return data ?? {};
}

export function installApiRuntime() {
  window.getStoredAgentApiToken = getStoredAgentApiToken;
  window.setStoredAgentApiToken = setStoredAgentApiToken;
  window.buildRequestHeaders = buildRequestHeaders;
  window.syncAgentAuthUi = syncAgentAuthUi;
  window.maybePersistAgentTokenFromUrl = maybePersistAgentTokenFromUrl;
  window.detectManagedAgentMode = detectManagedAgentMode;
  window.refreshProtectedData = refreshProtectedData;
  window.request = request;
  window.requestForm = requestForm;
}
