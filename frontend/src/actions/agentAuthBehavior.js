const AGENT_TOKEN_KEY = "rauto_agent_api_token";

function tr(key, fallback = key) {
  return typeof window.t === "function" ? window.t(key) : fallback;
}

function setStatus(message, tone = "info") {
  const out = document.getElementById("agent-auth-out");
  if (!out) return;
  if (typeof window.setStatusMessage === "function") {
    window.setStatusMessage("agent-auth-out", message, tone);
    return;
  }
  out.textContent = message;
}

function setStoredToken(token) {
  const normalized = String(token || "").trim();
  if (normalized) {
    localStorage.setItem(AGENT_TOKEN_KEY, normalized);
  } else {
    localStorage.removeItem(AGENT_TOKEN_KEY);
  }
}

function getStoredToken() {
  return (localStorage.getItem(AGENT_TOKEN_KEY) || "").trim();
}

export function agentAuthBehavior(node) {
  const tokenInput = node.querySelector("#agent-api-token");
  const saveButton = node.querySelector("#agent-api-token-save-btn");
  const clearButton = node.querySelector("#agent-api-token-clear-btn");

  async function syncAuthUi() {
    if (typeof window.syncAgentAuthUi === "function") {
      window.syncAgentAuthUi();
    }
  }

  async function saveToken() {
    setStoredToken(tokenInput?.value || "");
    await syncAuthUi();
    if (!getStoredToken()) {
      setStatus(
        tr(
          "agentAuthRequired",
          "Managed agent mode requires an API token before browser actions can call protected APIs.",
        ),
        "info",
      );
      return;
    }
    if (typeof window.refreshProtectedData === "function") {
      await window.refreshProtectedData();
    }
  }

  function clearToken() {
    setStoredToken("");
    syncAuthUi();
    setStatus(
      tr("agentAuthCleared", "Agent API token cleared from this browser."),
      "info",
    );
  }

  const onTokenKeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveToken();
    }
  };

  saveButton?.addEventListener("click", saveToken);
  clearButton?.addEventListener("click", clearToken);
  tokenInput?.addEventListener("keydown", onTokenKeydown);

  return {
    destroy() {
      saveButton?.removeEventListener("click", saveToken);
      clearButton?.removeEventListener("click", clearToken);
      tokenInput?.removeEventListener("keydown", onTokenKeydown);
    },
  };
}
