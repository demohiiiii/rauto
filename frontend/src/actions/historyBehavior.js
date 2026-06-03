import {
  deleteConnectionHistory,
  getConnectionHistoryDetail,
  listConnectionHistory,
} from "../api/client.js";

const HISTORY_STORAGE = {
  query: "rauto_history_filter_query",
  operation: "rauto_history_filter_operation",
  limit: "rauto_history_filter_limit",
};

function tr(key, fallback = key) {
  return typeof window.t === "function" ? window.t(key) : fallback;
}

function safeString(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
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
      : "border-slate-200 bg-slate-50 text-slate-600";
  return `<div class="rounded-xl border ${toneClass} px-3 py-2 text-sm">${escapeHtml(message)}</div>`;
}

function runtimeHtml(name, fallback, ...args) {
  const fn = window[name];
  return typeof fn === "function" ? fn(...args) : fallback(...args);
}

function formatHistoryTime(value) {
  return runtimeHtml(
    "formatHistoryTime",
    (ts) => {
      const n = Number(ts);
      return Number.isFinite(n) && n > 0 ? new Date(n).toLocaleString() : "-";
    },
    value,
  );
}

function simpleBadge(value) {
  return `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">${escapeHtml(
    safeString(value || "-"),
  )}</span>`;
}

function connectionName() {
  return (document.getElementById("saved-conn-name")?.value || "").trim();
}

export function historyBehavior(node) {
  let lastHistoryItems = [];
  let historyFilterQuery = localStorage.getItem(HISTORY_STORAGE.query) || "";
  let historyFilterOperation =
    localStorage.getItem(HISTORY_STORAGE.operation) || "all";
  let historyFilterLimit = Number(
    localStorage.getItem(HISTORY_STORAGE.limit) || 30,
  );

  const byId = (id) => node.querySelector(`#${id}`);

  function syncHistoryRuntimeState() {
    if (typeof window.setHistoryFilterRuntimeState === "function") {
      window.setHistoryFilterRuntimeState({
        query: historyFilterQuery,
        operation: historyFilterOperation,
        limit: historyFilterLimit,
      });
    }
  }

  function saveHistoryFilters() {
    localStorage.setItem(HISTORY_STORAGE.query, historyFilterQuery);
    localStorage.setItem(HISTORY_STORAGE.operation, historyFilterOperation);
    localStorage.setItem(HISTORY_STORAGE.limit, String(historyFilterLimit));
    syncHistoryRuntimeState();
  }

  function applyFilterInputs() {
    byId("history-filter-query").value = historyFilterQuery;
    byId("history-filter-operation").value = historyFilterOperation;
    byId("history-filter-limit").value = String(historyFilterLimit || 30);
  }

  function historyMatchesSearch(item, query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return true;
    const fields = [
      item.command_label,
      item.operation,
      item.mode,
      item.device_profile,
      item.connection_name,
      item.host,
      item.port,
      item.username,
    ];
    return fields
      .filter((value) => value != null)
      .map((value) => String(value).toLowerCase())
      .join("\n")
      .includes(q);
  }

  function filterHistoryItems(items) {
    return (items || []).filter((item) => {
      const op = String(item.operation || "").toLowerCase();
      const opOk =
        historyFilterOperation === "all" ? true : op === historyFilterOperation;
      return opOk && historyMatchesSearch(item, historyFilterQuery);
    });
  }

  function renderConnectionHistoryTable(items) {
    const sorted = [...items].sort(
      (a, b) => Number(a.ts_ms || 0) - Number(b.ts_ms || 0),
    );
    const rows = sorted
      .map(
        (item, index) => `
          <tr class="align-top hover:bg-slate-50/80">
            <td class="whitespace-nowrap px-3 py-2 text-slate-500">${index + 1}</td>
            <td class="whitespace-nowrap px-3 py-2 text-slate-700">
              <div class="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">${escapeHtml(
                formatHistoryTime(item.ts_ms),
              )}</div>
            </td>
            <td class="px-3 py-2">${runtimeHtml("historyOperationBadge", simpleBadge, item.operation)}</td>
            <td class="max-w-[380px] px-3 py-2">
              <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-700 break-all">${escapeHtml(
                safeString(item.command_label),
              )}</div>
            </td>
            <td class="px-3 py-2">${runtimeHtml("historyModeBadge", simpleBadge, item.mode)}</td>
            <td class="max-w-[260px] px-3 py-2">${runtimeHtml(
              "historyTargetCell",
              () =>
                escapeHtml(`${safeString(item.host)}:${safeString(item.port)}`),
              item,
            )}</td>
            <td class="px-3 py-2">${runtimeHtml(
              "historyRecordLevelBadge",
              simpleBadge,
              item.record_level,
            )}</td>
            <td class="whitespace-nowrap px-3 py-2">
              <div class="inline-flex items-center gap-2">
                <button class="mini-btn js-history-detail-btn" type="button" data-history-id="${escapeHtml(
                  safeString(item.id),
                )}">${escapeHtml(tr("actionViewDetail", "View"))}</button>
                <button class="mini-btn delete js-history-delete-btn" type="button" data-history-id="${escapeHtml(
                  safeString(item.id),
                )}">${escapeHtml(tr("historyDeleteBtn", "Delete"))}</button>
              </div>
            </td>
          </tr>`,
      )
      .join("");

    return `
      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-[1080px] table-fixed text-sm">
          <thead class="bg-slate-100 text-xs font-semibold text-slate-600">
            <tr>
              <th class="px-3 py-2 text-left">${escapeHtml(tr("historyColIndex", "#"))}</th>
              <th class="px-3 py-2 text-left">${escapeHtml(tr("historyColTime", "Time"))}</th>
              <th class="px-3 py-2 text-left">${escapeHtml(tr("historyColOperation", "Operation"))}</th>
              <th class="px-3 py-2 text-left">${escapeHtml(tr("historyColCommand", "Command"))}</th>
              <th class="px-3 py-2 text-left">${escapeHtml(tr("historyColMode", "Mode"))}</th>
              <th class="px-3 py-2 text-left">${escapeHtml(tr("historyColProfile", "Profile"))}</th>
              <th class="px-3 py-2 text-left">${escapeHtml(tr("historyColLevel", "Level"))}</th>
              <th class="px-3 py-2 text-left">${escapeHtml(tr("tableAction", "Action"))}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">${rows}</tbody>
        </table>
      </div>`;
  }

  function renderHistoryDrawer() {
    const out = byId("history-drawer-out");
    if (!out) return;
    if (!lastHistoryItems.length) {
      out.innerHTML = statusCard(
        tr("savedConnHistoryEmpty", "no history"),
        "info",
      );
      return;
    }
    const filtered = filterHistoryItems(lastHistoryItems);
    out.innerHTML = filtered.length
      ? renderConnectionHistoryTable(filtered)
      : statusCard(tr("noMatchedEntries", "no matched entries"), "info");
  }

  async function loadConnectionHistory() {
    const name = connectionName();
    const out = byId("history-drawer-out");
    byId("history-drawer-conn-name").textContent = name || "-";
    if (!name) {
      if (out)
        out.innerHTML = statusCard(
          tr("connectionNameRequired", "connection name required"),
          "error",
        );
      return;
    }
    if (out) out.innerHTML = statusCard(tr("running", "running"), "running");
    try {
      const limit = Number.isFinite(historyFilterLimit)
        ? historyFilterLimit
        : 30;
      const data = await listConnectionHistory(name, limit);
      lastHistoryItems = Array.isArray(data) ? data : [];
      renderHistoryDrawer();
    } catch (error) {
      if (out) out.innerHTML = statusCard(error.message, "error");
    }
  }

  function formatHistoryDetailView(data) {
    const meta = data?.meta || {};
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    const displayMode =
      typeof window.displayMode === "function"
        ? window.displayMode(meta.mode)
        : safeString(meta.mode);
    const metaCard = `
      <section class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <div class="mb-1 text-xs font-semibold text-slate-500">${escapeHtml(
          tr("historyMetaTitle", "Meta"),
        )}</div>
        <div class="grid gap-1 font-mono text-xs break-all">
          <div>time=${escapeHtml(formatHistoryTime(meta.ts_ms))}</div>
          <div>operation=${escapeHtml(safeString(meta.operation))}</div>
          <div>command=${escapeHtml(safeString(meta.command_label))}</div>
          <div>mode=${escapeHtml(displayMode)}</div>
          <div>profile=${escapeHtml(safeString(meta.device_profile))}</div>
          <div>target=${escapeHtml(`${safeString(meta.host)}:${safeString(meta.port)}`)}</div>
          <div>record_level=${escapeHtml(safeString(meta.record_level))}</div>
        </div>
      </section>`;
    if (!entries.length) {
      return `<div class="grid gap-3">${metaCard}${statusCard(
        tr("historyDetailEmpty", "no detail"),
        "info",
      )}</div>`;
    }
    const stats =
      typeof window.renderStatsCards === "function" &&
      typeof window.buildEventStats === "function"
        ? window.renderStatsCards(window.buildEventStats(entries))
        : "";
    const table =
      typeof window.renderEntriesTable === "function"
        ? window.renderEntriesTable(entries)
        : `<pre class="output">${escapeHtml(JSON.stringify(entries, null, 2))}</pre>`;
    return `<div class="grid gap-3">${metaCard}${stats}${table}</div>`;
  }

  async function loadConnectionHistoryDetail(historyId) {
    const name = connectionName();
    if (!name || !historyId) return;
    window.openDetailModal?.(tr("running", "running"));
    try {
      const data = await getConnectionHistoryDetail(name, historyId);
      window.openDetailModal?.(formatHistoryDetailView(data), {
        title: tr("historyDetailTitle", "History Detail"),
        html: true,
      });
    } catch (error) {
      window.openDetailModal?.(error.message, {
        title: tr("historyDetailTitle", "History Detail"),
      });
    }
  }

  async function deleteConnectionHistoryItem(historyId) {
    const name = connectionName();
    if (!name || !historyId) return;
    if (!window.confirm(tr("historyDeleteConfirm", "Delete history item?")))
      return;
    if (typeof window.setStatusMessage === "function") {
      window.setStatusMessage(
        "saved-conn-out",
        tr("running", "running"),
        "running",
      );
    }
    try {
      await deleteConnectionHistory(name, historyId);
      if (typeof window.setStatusMessage === "function") {
        window.setStatusMessage(
          "saved-conn-out",
          tr("historyDeleteDone", "deleted"),
          "success",
        );
      }
      await loadConnectionHistory();
    } catch (error) {
      if (typeof window.setStatusMessage === "function") {
        window.setStatusMessage("saved-conn-out", error.message, "error");
      }
    }
  }

  function onHistoryListClick(event) {
    const detailBtn = event.target.closest(".js-history-detail-btn");
    if (detailBtn) {
      loadConnectionHistoryDetail(
        detailBtn.getAttribute("data-history-id") || "",
      );
      return;
    }
    const deleteBtn = event.target.closest(".js-history-delete-btn");
    if (deleteBtn) {
      deleteConnectionHistoryItem(
        deleteBtn.getAttribute("data-history-id") || "",
      );
    }
  }

  function onQueryInput() {
    historyFilterQuery = byId("history-filter-query")?.value || "";
    saveHistoryFilters();
    renderHistoryDrawer();
  }

  function onOperationChange() {
    historyFilterOperation = byId("history-filter-operation")?.value || "all";
    saveHistoryFilters();
    renderHistoryDrawer();
  }

  function onLimitChange() {
    const raw = Number(byId("history-filter-limit")?.value || 30);
    historyFilterLimit = Number.isFinite(raw) ? raw : 30;
    saveHistoryFilters();
    loadConnectionHistory();
  }

  function clearFilters() {
    historyFilterQuery = "";
    historyFilterOperation = "all";
    byId("history-filter-query").value = "";
    byId("history-filter-operation").value = "all";
    saveHistoryFilters();
    renderHistoryDrawer();
  }

  const refreshBtn = byId("history-drawer-refresh-btn");
  const closeBtn = byId("history-drawer-close");
  const backdrop = document.getElementById("history-drawer-backdrop");
  const queryInput = byId("history-filter-query");
  const operationSelect = byId("history-filter-operation");
  const limitSelect = byId("history-filter-limit");
  const clearBtn = byId("history-filter-clear-btn");
  const out = byId("history-drawer-out");

  const onRefreshClick = () =>
    typeof window.withButtonLoading === "function"
      ? window.withButtonLoading(
          "history-drawer-refresh-btn",
          loadConnectionHistory,
        )
      : loadConnectionHistory();
  const closeHistory = () => window.closeHistoryDrawer?.();

  refreshBtn?.addEventListener("click", onRefreshClick);
  closeBtn?.addEventListener("click", closeHistory);
  backdrop?.addEventListener("click", closeHistory);
  queryInput?.addEventListener("input", onQueryInput);
  operationSelect?.addEventListener("change", onOperationChange);
  limitSelect?.addEventListener("change", onLimitChange);
  clearBtn?.addEventListener("click", clearFilters);
  out?.addEventListener("click", onHistoryListClick);

  window.loadConnectionHistory = loadConnectionHistory;
  window.loadConnectionHistoryDetail = loadConnectionHistoryDetail;
  window.deleteConnectionHistoryItem = deleteConnectionHistoryItem;
  window.renderHistoryDrawer = renderHistoryDrawer;

  syncHistoryRuntimeState();
  applyFilterInputs();
  renderHistoryDrawer();

  return {
    destroy() {
      refreshBtn?.removeEventListener("click", onRefreshClick);
      closeBtn?.removeEventListener("click", closeHistory);
      backdrop?.removeEventListener("click", closeHistory);
      queryInput?.removeEventListener("input", onQueryInput);
      operationSelect?.removeEventListener("change", onOperationChange);
      limitSelect?.removeEventListener("change", onLimitChange);
      clearBtn?.removeEventListener("click", clearFilters);
      out?.removeEventListener("click", onHistoryListClick);
    },
  };
}
