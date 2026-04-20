/**
 * blacklist.js — blacklist
 */

function renderBlacklistList(errorMessage = "") {
  const out = byId("blacklist-list");
  if (!out) return;
  if (errorMessage) {
    out.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      errorMessage
    )}</div>`;
    return;
  }
  if (!Array.isArray(cachedBlacklistPatterns) || cachedBlacklistPatterns.length === 0) {
    out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("blacklistListEmpty")
    )}</div>`;
    return;
  }
  out.innerHTML = cachedBlacklistPatterns
    .map(
      (pattern) => `
        <div class="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <code class="text-sm font-semibold text-slate-800 break-all">${escapeHtml(
              pattern
            )}</code>
            <button
              type="button"
              class="mini-btn delete js-blacklist-delete"
              data-pattern="${escapeHtml(pattern)}"
            >${escapeHtml(t("blacklistDeleteBtn"))}</button>
          </div>
        </div>
      `
    )
    .join("");
}

function renderBlacklistCheckResult(errorMessage = "") {
  const out = byId("blacklist-check-out");
  if (!out) return;
  if (errorMessage) {
    out.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      errorMessage
    )}</div>`;
    return;
  }
  if (!lastBlacklistCheckResult) {
    out.innerHTML = "-";
    return;
  }
  if (lastBlacklistCheckResult.blocked) {
    out.innerHTML = `
      <div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        <div class="font-semibold">${escapeHtml(t("blacklistMatched"))}</div>
        <div class="mt-1">${escapeHtml(t("blacklistCheckedCommand"))}: <code>${escapeHtml(
          lastBlacklistCheckResult.command || "-"
        )}</code></div>
        <div class="mt-1">${escapeHtml(t("blacklistMatchedPattern"))}: <code>${escapeHtml(
          lastBlacklistCheckResult.pattern || "-"
        )}</code></div>
      </div>
    `;
    return;
  }
  out.innerHTML = `
    <div class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      <div class="font-semibold">${escapeHtml(t("blacklistAllowed"))}</div>
      <div class="mt-1">${escapeHtml(t("blacklistCheckedCommand"))}: <code>${escapeHtml(
        lastBlacklistCheckResult.command || "-"
      )}</code></div>
    </div>
  `;
}

async function loadBlacklistPatterns() {
  try {
    const data = await request("GET", "/api/blacklist");
    cachedBlacklistPatterns = (Array.isArray(data) ? data : [])
      .map((item) => safeString(item && item.pattern))
      .filter(Boolean);
    renderBlacklistList();
  } catch (e) {
    cachedBlacklistPatterns = [];
    renderBlacklistList(e.message);
    setStatusMessage("blacklist-out", e.message, "error");
  }
}

async function addBlacklistPatternFromWeb() {
  const pattern = byId("blacklist-pattern").value.trim();
  if (!pattern) {
    setStatusMessage("blacklist-out", t("blacklistPatternRequired"), "error");
    return;
  }
  setStatusMessage("blacklist-out", t("running"), "running");
  try {
    const data = await request("POST", "/api/blacklist", { pattern });
    byId("blacklist-pattern").value = "";
    setStatusMessage(
      "blacklist-out",
      `${data.added ? t("blacklistAdded") : t("blacklistExists")}: ${data.pattern || pattern}`,
      data.added ? "success" : "info"
    );
    await loadBlacklistPatterns();
  } catch (e) {
    setStatusMessage("blacklist-out", e.message, "error");
  }
}

async function deleteBlacklistPatternFromWeb(pattern) {
  if (!pattern) return;
  if (!window.confirm(t("blacklistDeleteConfirm"))) {
    return;
  }
  setStatusMessage("blacklist-out", t("running"), "running");
  try {
    const data = await request(
      "DELETE",
      `/api/blacklist/${encodeURIComponent(pattern)}`
    );
    setStatusMessage(
      "blacklist-out",
      `${t("blacklistDeleted")}: ${data.pattern || pattern}`,
      "success"
    );
    if (
      lastBlacklistCheckResult &&
      lastBlacklistCheckResult.pattern &&
      lastBlacklistCheckResult.pattern === pattern
    ) {
      lastBlacklistCheckResult = null;
      renderBlacklistCheckResult();
    }
    await loadBlacklistPatterns();
  } catch (e) {
    setStatusMessage("blacklist-out", e.message, "error");
  }
}

async function checkBlacklistCommandFromWeb() {
  const command = byId("blacklist-check-command").value.trim();
  if (!command) {
    renderBlacklistCheckResult(t("commandRequired"));
    return;
  }
  renderBlacklistCheckResult(t("running"));
  try {
    const data = await request("POST", "/api/blacklist/check", { command });
    lastBlacklistCheckResult = data || null;
    renderBlacklistCheckResult();
  } catch (e) {
    lastBlacklistCheckResult = null;
    renderBlacklistCheckResult(e.message);
  }
}
