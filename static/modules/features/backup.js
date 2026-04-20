/**
 * backup.js — backup
 */

function renderBackupOptions(keyword = "") {
  const datalist = byId("backup-archive-options");
  const q = keyword.trim().toLowerCase();
  const rows = cachedBackups.filter((item) =>
    q ? (item.path || "").toLowerCase().includes(q) : true
  );
  datalist.innerHTML = rows
    .map((item) => `<option value="${escapeHtml(item.path || "")}"></option>`)
    .join("");
}

function selectedBackupNameFromInput() {
  const raw = byId("backup-restore-archive").value.trim();
  if (!raw) return "";
  const matched = cachedBackups.find(
    (item) => (item.path || "") === raw || (item.name || "") === raw
  );
  if (matched && matched.name) {
    return matched.name;
  }
  const tail = raw.split("/").pop();
  if (!tail) return "";
  const hit = cachedBackups.find((item) => (item.name || "") === tail);
  return hit && hit.name ? hit.name : "";
}

function selectedBackupFromInput() {
  const raw = byId("backup-restore-archive").value.trim();
  if (!raw) return null;
  const matched = cachedBackups.find(
    (item) => (item.path || "") === raw || (item.name || "") === raw
  );
  if (matched) return matched;
  const tail = raw.split("/").pop();
  if (!tail) return null;
  return cachedBackups.find((item) => (item.name || "") === tail) || null;
}

function updateSelectedBackupMeta() {
  const el = byId("backup-selected-meta");
  if (!el) return;
  const item = selectedBackupFromInput();
  if (!item) {
    el.textContent = "-";
    return;
  }
  el.textContent = `${t("backupSelectedMetaLabel")}: ${item.name || "-"} · ${t(
    "backupMetaSize"
  )}: ${formatBytes(item.size_bytes)} · ${t("backupMetaTime")}: ${formatHistoryTime(
    item.modified_ms
  )}`;
}

function renderBackupList() {
  const out = byId("backup-list");
  if (!out) return;
  if (!Array.isArray(cachedBackups) || cachedBackups.length === 0) {
    out.innerHTML =
      '<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">-</div>';
    return;
  }
  const selected = selectedBackupFromInput();
  out.innerHTML = cachedBackups
    .map((item) => {
      const active =
        selected &&
        ((selected.name || "") === (item.name || "") || (selected.path || "") === (item.path || ""));
      const cls = active
        ? "border-teal-300 bg-teal-50/70"
        : "border-slate-200 bg-white hover:border-slate-300";
      return `
      <button
        type="button"
        class="w-full rounded-xl border px-3 py-2 text-left transition ${cls} js-backup-row"
        data-backup-path="${escapeHtml(item.path || "")}"
        data-backup-name="${escapeHtml(item.name || "")}"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-semibold text-slate-800">${escapeHtml(item.name || "-")}</span>
          <span class="text-xs text-slate-500">${escapeHtml(formatBytes(item.size_bytes))}</span>
        </div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.path || "-")}</div>
        <div class="mt-1 flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs text-slate-400">${escapeHtml(
            `${t("backupMetaTime")}: ${formatHistoryTime(item.modified_ms)}`
          )}</span>
          <span class="inline-flex items-center gap-2">
            <button
              type="button"
              class="mini-btn js-backup-download"
              data-backup-path="${escapeHtml(item.path || "")}"
              data-backup-name="${escapeHtml(item.name || "")}"
            >${escapeHtml(t("backupDownloadBtn"))}</button>
            <button
              type="button"
              class="mini-btn js-backup-restore-merge"
              data-backup-path="${escapeHtml(item.path || "")}"
              data-backup-name="${escapeHtml(item.name || "")}"
            >${escapeHtml(t("backupRestoreMergeBtn"))}</button>
            <button
              type="button"
              class="mini-btn delete js-backup-restore-replace"
              data-backup-path="${escapeHtml(item.path || "")}"
              data-backup-name="${escapeHtml(item.name || "")}"
            >${escapeHtml(t("backupRestoreReplaceBtn"))}</button>
          </span>
        </div>
      </button>`;
    })
    .join("");
}

async function loadBackups() {
  try {
    const data = await request("GET", "/api/backups");
    cachedBackups = Array.isArray(data) ? data : [];
    renderBackupOptions(byId("backup-restore-archive").value || "");
    updateSelectedBackupMeta();
    renderBackupList();
  } catch (e) {
    cachedBackups = [];
    renderBackupOptions("");
    updateSelectedBackupMeta();
    renderBackupList();
    setStatusMessage("backup-out", e.message, "error");
  }
}

async function createBackupFromWeb() {
  setStatusMessage("backup-out", t("running"), "running");
  try {
    const output = byId("backup-output-path").value.trim();
    const data = await request("POST", "/api/backups", {
      output: output || null,
    });
    const path = (data && data.path) || "-";
    setStatusMessage("backup-out", `${t("backupCreated")}: ${path}`, "success");
    if (path && path !== "-") {
      byId("backup-restore-archive").value = path;
    }
    await loadBackups();
  } catch (e) {
    setStatusMessage("backup-out", e.message, "error");
  }
}

async function restoreBackupFromWeb(replace = false) {
  const archive = byId("backup-restore-archive").value.trim();
  if (!archive) {
    setStatusMessage("backup-out", t("backupArchiveRequired"), "error");
    return;
  }
  const confirmText = replace
    ? t("backupRestoreConfirmReplace")
    : t("backupRestoreConfirmMerge");
  if (!window.confirm(confirmText)) {
    return;
  }
  setStatusMessage("backup-out", t("running"), "running");
  try {
    const data = await request("POST", "/api/backups/restore", {
      archive,
      replace,
    });
    setStatusMessage(
      "backup-out",
      `${t("backupRestored")}: ${data.archive || archive}`,
      "success"
    );
    await loadBackups();
    await loadSavedConnections();
    await loadProfilesOverview();
    await loadTemplates();
    await loadBlacklistPatterns();
  } catch (e) {
    setStatusMessage("backup-out", e.message, "error");
  }
}

function downloadBackupFromWeb() {
  const name = selectedBackupNameFromInput();
  if (!name) {
    setStatusMessage("backup-out", t("backupPickOne"), "error");
    return;
  }
  const url = `/api/backups/${encodeURIComponent(name)}/download`;
  fetch(url, { headers: buildRequestHeaders(false) })
    .then(async (res) => {
      if (!res.ok) {
        const raw = await res.text();
        throw new Error(
          res.status === 401
            ? getStoredAgentApiToken()
              ? t("agentAuthInvalid")
              : t("agentAuthRequired")
            : raw || t("requestFailed")
        );
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    })
    .catch((e) => {
      setStatusMessage("backup-out", e.message, "error");
    });
}

function selectBackupPath(path) {
  if (!path) return;
  byId("backup-restore-archive").value = path;
  updateSelectedBackupMeta();
  renderBackupList();
}
