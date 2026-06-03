import {
  backupDownloadUrl,
  createBackup,
  listBackups,
  restoreBackup,
} from "../api/client.js";

const AGENT_TOKEN_KEY = "rauto_agent_api_token";

function tr(key, fallback = key) {
  return typeof window.t === "function" ? window.t(key) : fallback;
}

function safeString(value) {
  return value == null ? "" : String(value);
}

function escapeHtml(value) {
  return safeString(value)
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

function formatBytes(value) {
  if (typeof window.formatBytes === "function") {
    return window.formatBytes(value);
  }
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatHistoryTime(value) {
  if (typeof window.formatHistoryTime === "function") {
    return window.formatHistoryTime(value);
  }
  const ts = Number(value || 0);
  if (!Number.isFinite(ts) || ts <= 0) return "-";
  return new Date(ts).toLocaleString();
}

function selectedBackupFromInput(cachedBackups, rawInput) {
  const raw = rawInput.trim();
  if (!raw) return null;
  const matched = cachedBackups.find(
    (item) => (item.path || "") === raw || (item.name || "") === raw,
  );
  if (matched) return matched;
  const tail = raw.split("/").pop();
  if (!tail) return null;
  return cachedBackups.find((item) => (item.name || "") === tail) || null;
}

function selectedBackupNameFromInput(cachedBackups, rawInput) {
  const item = selectedBackupFromInput(cachedBackups, rawInput);
  if (item?.name) return item.name;
  const tail = rawInput.trim().split("/").pop();
  return tail || "";
}

function authHeaders() {
  const token = (localStorage.getItem(AGENT_TOKEN_KEY) || "").trim();
  return token
    ? {
        Authorization: `Bearer ${token}`,
        "X-API-Key": token,
      }
    : {};
}

async function withLoading(buttonOrId, handler) {
  if (typeof window.withButtonLoading === "function") {
    return window.withButtonLoading(buttonOrId, handler);
  }
  const button =
    typeof buttonOrId === "string"
      ? document.getElementById(buttonOrId)
      : buttonOrId;
  const previousDisabled = button?.disabled;
  if (button) button.disabled = true;
  try {
    return await handler();
  } finally {
    if (button) button.disabled = previousDisabled;
  }
}

export function backupBehavior(node) {
  let cachedBackups = [];

  const byId = (id) => node.querySelector(`#${id}`);

  function setStatus(message, tone = "info") {
    const out = byId("backup-out");
    if (!out) return;
    out.innerHTML = statusCard(message, tone);
  }

  function selectedBackup() {
    return selectedBackupFromInput(
      cachedBackups,
      byId("backup-restore-archive")?.value || "",
    );
  }

  function renderOptions(keyword = "") {
    const datalist = byId("backup-archive-options");
    if (!datalist) return;
    const q = keyword.trim().toLowerCase();
    datalist.innerHTML = cachedBackups
      .filter((item) =>
        q ? (item.path || "").toLowerCase().includes(q) : true,
      )
      .map((item) => `<option value="${escapeHtml(item.path || "")}"></option>`)
      .join("");
  }

  function updateSelectedMeta() {
    const el = byId("backup-selected-meta");
    if (!el) return;
    const item = selectedBackup();
    if (!item) {
      el.textContent = "-";
      return;
    }
    el.textContent = `${tr("backupSelectedMetaLabel", "Selected")}: ${item.name || "-"} · ${tr(
      "backupMetaSize",
      "Size",
    )}: ${formatBytes(item.size_bytes)} · ${tr("backupMetaTime", "Time")}: ${formatHistoryTime(
      item.modified_ms,
    )}`;
  }

  function renderList() {
    const out = byId("backup-list");
    if (!out) return;
    if (!Array.isArray(cachedBackups) || cachedBackups.length === 0) {
      out.innerHTML = statusCard("-", "info");
      return;
    }
    const selected = selectedBackup();
    out.innerHTML = cachedBackups
      .map((item) => {
        const active =
          selected &&
          ((selected.name || "") === (item.name || "") ||
            (selected.path || "") === (item.path || ""));
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
                `${tr("backupMetaTime", "Time")}: ${formatHistoryTime(item.modified_ms)}`,
              )}</span>
              <span class="inline-flex items-center gap-2">
                <button type="button" class="mini-btn js-backup-download" data-backup-path="${escapeHtml(
                  item.path || "",
                )}" data-backup-name="${escapeHtml(item.name || "")}">${escapeHtml(
                  tr("backupDownloadBtn", "Download"),
                )}</button>
                <button type="button" class="mini-btn js-backup-restore-merge" data-backup-path="${escapeHtml(
                  item.path || "",
                )}" data-backup-name="${escapeHtml(item.name || "")}">${escapeHtml(
                  tr("backupRestoreMergeBtn", "Restore (Merge)"),
                )}</button>
                <button type="button" class="mini-btn delete js-backup-restore-replace" data-backup-path="${escapeHtml(
                  item.path || "",
                )}" data-backup-name="${escapeHtml(item.name || "")}">${escapeHtml(
                  tr("backupRestoreReplaceBtn", "Restore (Replace)"),
                )}</button>
              </span>
            </div>
          </button>`;
      })
      .join("");
  }

  async function loadBackupsFromWeb() {
    try {
      const data = await listBackups();
      cachedBackups = Array.isArray(data) ? data : [];
      renderOptions(byId("backup-restore-archive")?.value || "");
      updateSelectedMeta();
      renderList();
    } catch (error) {
      cachedBackups = [];
      renderOptions("");
      updateSelectedMeta();
      renderList();
      setStatus(error.message, "error");
    }
  }

  async function createBackupFromWeb() {
    setStatus(tr("running", "running"), "running");
    try {
      const data = await createBackup(byId("backup-output-path")?.value || "");
      const path = data?.path || "-";
      setStatus(`${tr("backupCreated", "Backup created")}: ${path}`, "success");
      if (path && path !== "-") {
        byId("backup-restore-archive").value = path;
      }
      await loadBackupsFromWeb();
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  async function restoreBackupFromWeb(replace = false) {
    const archive = byId("backup-restore-archive")?.value.trim() || "";
    if (!archive) {
      setStatus(
        tr("backupArchiveRequired", "backup archive is required"),
        "error",
      );
      return;
    }
    const confirmText = replace
      ? tr("backupRestoreConfirmReplace", "Restore and replace current data?")
      : tr("backupRestoreConfirmMerge", "Restore and merge into current data?");
    if (!window.confirm(confirmText)) {
      return;
    }
    setStatus(tr("running", "running"), "running");
    try {
      const data = await restoreBackup(archive, replace);
      setStatus(
        `${tr("backupRestored", "Backup restored")}: ${data.archive || archive}`,
        "success",
      );
      await loadBackupsFromWeb();
      await Promise.allSettled([
        window.loadSavedConnections?.(),
        window.loadProfilesOverview?.(),
        window.loadTemplates?.(),
        window.loadBlacklistPatterns?.(),
      ]);
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  async function downloadBackupFromWeb() {
    const name = selectedBackupNameFromInput(
      cachedBackups,
      byId("backup-restore-archive")?.value || "",
    );
    if (!name) {
      setStatus(tr("backupPickOne", "pick a backup first"), "error");
      return;
    }
    try {
      const res = await fetch(backupDownloadUrl(name), {
        headers: authHeaders(),
      });
      if (!res.ok) {
        const raw = await res.text();
        throw new Error(raw || tr("requestFailed", "request failed"));
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
    } catch (error) {
      setStatus(error.message, "error");
    }
  }

  function selectBackupPath(path) {
    if (!path) return;
    byId("backup-restore-archive").value = path;
    updateSelectedMeta();
    renderList();
  }

  function onArchiveInput(event) {
    renderOptions(event.target.value || "");
    updateSelectedMeta();
    renderList();
  }

  function onArchiveChange() {
    updateSelectedMeta();
    renderList();
  }

  function onListClick(event) {
    const downloadBtn = event.target.closest(".js-backup-download");
    if (downloadBtn) {
      selectBackupPath(downloadBtn.getAttribute("data-backup-path") || "");
      withLoading(downloadBtn, downloadBackupFromWeb);
      return;
    }
    const restoreMergeBtn = event.target.closest(".js-backup-restore-merge");
    if (restoreMergeBtn) {
      selectBackupPath(restoreMergeBtn.getAttribute("data-backup-path") || "");
      withLoading(restoreMergeBtn, () => restoreBackupFromWeb(false));
      return;
    }
    const restoreReplaceBtn = event.target.closest(
      ".js-backup-restore-replace",
    );
    if (restoreReplaceBtn) {
      selectBackupPath(
        restoreReplaceBtn.getAttribute("data-backup-path") || "",
      );
      withLoading(restoreReplaceBtn, () => restoreBackupFromWeb(true));
      return;
    }
    const row = event.target.closest(".js-backup-row");
    if (!row) return;
    selectBackupPath(row.getAttribute("data-backup-path") || "");
  }

  const createBtn = byId("backup-create-btn");
  const refreshBtn = byId("backup-refresh-btn");
  const downloadBtn = byId("backup-download-btn");
  const restoreMergeBtn = byId("backup-restore-merge-btn");
  const restoreReplaceBtn = byId("backup-restore-replace-btn");
  const archiveInput = byId("backup-restore-archive");
  const list = byId("backup-list");

  const onCreateClick = () =>
    withLoading("backup-create-btn", createBackupFromWeb);
  const onRefreshClick = () =>
    withLoading("backup-refresh-btn", loadBackupsFromWeb);
  const onDownloadClick = () =>
    withLoading("backup-download-btn", downloadBackupFromWeb);
  const onRestoreMergeClick = () =>
    withLoading("backup-restore-merge-btn", () => restoreBackupFromWeb(false));
  const onRestoreReplaceClick = () =>
    withLoading("backup-restore-replace-btn", () => restoreBackupFromWeb(true));

  createBtn?.addEventListener("click", onCreateClick);
  refreshBtn?.addEventListener("click", onRefreshClick);
  downloadBtn?.addEventListener("click", onDownloadClick);
  restoreMergeBtn?.addEventListener("click", onRestoreMergeClick);
  restoreReplaceBtn?.addEventListener("click", onRestoreReplaceClick);
  archiveInput?.addEventListener("input", onArchiveInput);
  archiveInput?.addEventListener("change", onArchiveChange);
  list?.addEventListener("click", onListClick);

  window.loadBackups = loadBackupsFromWeb;
  window.updateSelectedBackupMeta = updateSelectedMeta;
  window.renderBackupList = renderList;

  updateSelectedMeta();
  renderList();

  return {
    destroy() {
      createBtn?.removeEventListener("click", onCreateClick);
      refreshBtn?.removeEventListener("click", onRefreshClick);
      downloadBtn?.removeEventListener("click", onDownloadClick);
      restoreMergeBtn?.removeEventListener("click", onRestoreMergeClick);
      restoreReplaceBtn?.removeEventListener("click", onRestoreReplaceClick);
      archiveInput?.removeEventListener("input", onArchiveInput);
      archiveInput?.removeEventListener("change", onArchiveChange);
      list?.removeEventListener("click", onListClick);
    },
  };
}
