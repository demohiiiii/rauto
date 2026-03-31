// api.js - HTTP request and authentication functions (extracted from app.js)

function getStoredAgentApiToken() {
  return (localStorage.getItem(STORAGE_KEYS.agentApiToken) || "").trim();
}

function setStoredAgentApiToken(token) {
  const normalized = String(token || "").trim();
  if (normalized) {
    localStorage.setItem(STORAGE_KEYS.agentApiToken, normalized);
  } else {
    localStorage.removeItem(STORAGE_KEYS.agentApiToken);
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
  wrap.hidden = !managedAgentMode;
  if (!managedAgentMode) {
    return;
  }
  const token = getStoredAgentApiToken();
  byId("agent-api-token").value = token;
  setStatusMessage(
    "agent-auth-out",
    token ? t("agentAuthSaved") : t("agentAuthRequired"),
    token ? "success" : "info"
  );
}

function maybePersistAgentTokenFromUrl() {
  const url = new URL(window.location.href);
  const token =
    (url.searchParams.get("token") || url.searchParams.get("api_token") || "").trim();
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
      managedAgentMode = false;
      return false;
    }
    const raw = await res.text();
    const data = raw ? JSON.parse(raw) : null;
    managedAgentMode = !!(data && data.managed);
    return managedAgentMode;
  } catch (_) {
    managedAgentMode = false;
    return false;
  } finally {
    syncAgentAuthUi();
  }
}

async function refreshProtectedData() {
  await Promise.allSettled([
    loadSavedConnections(),
    loadProfilesOverview(),
    loadTemplates(),
    loadFlowTemplates(),
    loadBlacklistPatterns(),
    loadBackups(),
  ]);
}

async function saveAgentApiTokenFromWeb() {
  setStoredAgentApiToken(byId("agent-api-token").value || "");
  syncAgentAuthUi();
  if (!managedAgentMode) {
    return;
  }
  if (!getStoredAgentApiToken()) {
    setStatusMessage("agent-auth-out", t("agentAuthRequired"), "info");
    return;
  }
  await refreshProtectedData();
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
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (_) {
    data = null;
  }
  if (!res.ok) {
    const msg =
      res.status === 401
        ? getStoredAgentApiToken()
          ? t("agentAuthInvalid")
          : t("agentAuthRequired")
        : (data && data.error) || raw || t("requestFailed");
    throw new Error(msg);
  }
  return data ?? {};
}

async function requestForm(method, url, formData) {
  const res = await fetch(url, {
    method,
    headers: buildRequestHeaders(false),
    body: formData,
  });
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (_) {
    data = null;
  }
  if (!res.ok) {
    const msg =
      res.status === 401
        ? getStoredAgentApiToken()
          ? t("agentAuthInvalid")
          : t("agentAuthRequired")
        : (data && data.error) || raw || t("requestFailed");
    throw new Error(msg);
  }
  return data ?? {};
}

