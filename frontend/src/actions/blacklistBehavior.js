import {
  addBlacklistPattern,
  checkBlacklistCommand,
  deleteBlacklistPattern,
  listBlacklistPatterns,
} from "../api/client.js";

function tr(key, fallback = key) {
  return typeof window.t === "function" ? window.t(key) : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusCard(message, tone = "info") {
  if (typeof window.renderStatusMessageCard === "function") {
    return window.renderStatusMessageCard(message, tone);
  }
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return `<div class="rounded-xl border ${toneClass} px-3 py-2 text-sm">${escapeHtml(message)}</div>`;
}

function setStatus(id, message, tone = "info") {
  const node = document.getElementById(id);
  if (!node) return;
  node.innerHTML = statusCard(message, tone);
}

export function blacklistBehavior(node) {
  let cachedPatterns = [];
  let lastCheckResult = null;

  const byId = (id) => node.querySelector(`#${id}`);

  function renderList(errorMessage = "") {
    const out = byId("blacklist-list");
    if (!out) return;
    if (errorMessage) {
      out.innerHTML = statusCard(errorMessage, "error");
      return;
    }
    if (!cachedPatterns.length) {
      out.innerHTML = statusCard(
        tr("blacklistListEmpty", "no blocked patterns"),
        "info",
      );
      return;
    }
    out.innerHTML = cachedPatterns
      .map(
        (pattern) => `
          <div class="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <code class="text-sm font-semibold text-slate-800 break-all">${escapeHtml(pattern)}</code>
              <button
                type="button"
                class="mini-btn delete js-blacklist-delete"
                data-pattern="${escapeHtml(pattern)}"
              >${escapeHtml(tr("blacklistDeleteBtn", "Delete"))}</button>
            </div>
          </div>
        `,
      )
      .join("");
  }

  function renderCheckResult(errorMessage = "") {
    const out = byId("blacklist-check-out");
    if (!out) return;
    if (errorMessage) {
      out.innerHTML = statusCard(errorMessage, "error");
      return;
    }
    if (!lastCheckResult) {
      out.innerHTML = "-";
      return;
    }
    if (lastCheckResult.blocked) {
      out.innerHTML = `
        <div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <div class="font-semibold">${escapeHtml(tr("blacklistMatched", "command is blocked"))}</div>
          <div class="mt-1">${escapeHtml(tr("blacklistCheckedCommand", "Command"))}: <code>${escapeHtml(
            lastCheckResult.command || "-",
          )}</code></div>
          <div class="mt-1">${escapeHtml(tr("blacklistMatchedPattern", "Matched Pattern"))}: <code>${escapeHtml(
            lastCheckResult.pattern || "-",
          )}</code></div>
        </div>
      `;
      return;
    }
    out.innerHTML = `
      <div class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        <div class="font-semibold">${escapeHtml(tr("blacklistAllowed", "command is allowed"))}</div>
        <div class="mt-1">${escapeHtml(tr("blacklistCheckedCommand", "Command"))}: <code>${escapeHtml(
          lastCheckResult.command || "-",
        )}</code></div>
      </div>
    `;
  }

  async function loadPatterns() {
    try {
      const data = await listBlacklistPatterns();
      cachedPatterns = (Array.isArray(data) ? data : [])
        .map((item) => String(item?.pattern ?? item ?? ""))
        .filter(Boolean);
      renderList();
    } catch (error) {
      cachedPatterns = [];
      renderList(error.message);
      setStatus("blacklist-out", error.message, "error");
    }
  }

  async function addPatternFromForm() {
    const input = byId("blacklist-pattern");
    const pattern = input?.value.trim() || "";
    if (!pattern) {
      setStatus(
        "blacklist-out",
        tr("blacklistPatternRequired", "blacklist pattern is required"),
        "error",
      );
      return;
    }
    setStatus("blacklist-out", tr("running", "running"), "running");
    try {
      const data = await addBlacklistPattern(pattern);
      if (input) input.value = "";
      setStatus(
        "blacklist-out",
        `${data.added ? tr("blacklistAdded", "blacklist pattern added") : tr("blacklistExists", "pattern already exists")}: ${
          data.pattern || pattern
        }`,
        data.added ? "success" : "info",
      );
      await loadPatterns();
    } catch (error) {
      setStatus("blacklist-out", error.message, "error");
    }
  }

  async function deletePatternFromList(pattern) {
    if (
      !pattern ||
      !window.confirm(
        tr("blacklistDeleteConfirm", "Delete this blacklist pattern?"),
      )
    ) {
      return;
    }
    setStatus("blacklist-out", tr("running", "running"), "running");
    try {
      const data = await deleteBlacklistPattern(pattern);
      setStatus(
        "blacklist-out",
        `${tr("blacklistDeleted", "blacklist pattern deleted")}: ${data.pattern || pattern}`,
        "success",
      );
      if (lastCheckResult?.pattern === pattern) {
        lastCheckResult = null;
        renderCheckResult();
      }
      await loadPatterns();
    } catch (error) {
      setStatus("blacklist-out", error.message, "error");
    }
  }

  async function checkCommandFromForm() {
    const command = byId("blacklist-check-command")?.value.trim() || "";
    if (!command) {
      renderCheckResult(tr("commandRequired", "command is required"));
      return;
    }
    renderCheckResult(tr("running", "running"));
    try {
      lastCheckResult = await checkBlacklistCommand(command);
      renderCheckResult();
    } catch (error) {
      lastCheckResult = null;
      renderCheckResult(error.message);
    }
  }

  const refreshBtn = byId("blacklist-refresh-btn");
  const addBtn = byId("blacklist-add-btn");
  const checkBtn = byId("blacklist-check-btn");
  const patternInput = byId("blacklist-pattern");
  const commandInput = byId("blacklist-check-command");
  const list = byId("blacklist-list");

  const onPatternKeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addPatternFromForm();
    }
  };
  const onCommandKeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      checkCommandFromForm();
    }
  };
  const onListClick = (event) => {
    const deleteBtn = event.target.closest(".js-blacklist-delete");
    if (!deleteBtn) return;
    deletePatternFromList(deleteBtn.getAttribute("data-pattern") || "");
  };

  refreshBtn?.addEventListener("click", loadPatterns);
  addBtn?.addEventListener("click", addPatternFromForm);
  checkBtn?.addEventListener("click", checkCommandFromForm);
  patternInput?.addEventListener("keydown", onPatternKeydown);
  commandInput?.addEventListener("keydown", onCommandKeydown);
  list?.addEventListener("click", onListClick);

  window.loadBlacklistPatterns = loadPatterns;
  window.renderBlacklistList = renderList;
  window.renderBlacklistCheckResult = renderCheckResult;
  window.addBlacklistPatternFromWeb = addPatternFromForm;
  window.checkBlacklistCommandFromWeb = checkCommandFromForm;
  window.deleteBlacklistPatternFromWeb = deletePatternFromList;

  renderCheckResult();

  return {
    destroy() {
      refreshBtn?.removeEventListener("click", loadPatterns);
      addBtn?.removeEventListener("click", addPatternFromForm);
      checkBtn?.removeEventListener("click", checkCommandFromForm);
      patternInput?.removeEventListener("keydown", onPatternKeydown);
      commandInput?.removeEventListener("keydown", onCommandKeydown);
      list?.removeEventListener("click", onListClick);
    },
  };
}
