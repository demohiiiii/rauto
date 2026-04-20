/**
 * history.js — history
 */

function renderConnectionHistoryTable(items) {
  const sorted = [...items].sort((a, b) => Number(a.ts_ms || 0) - Number(b.ts_ms || 0));
  const rows = sorted
    .map((item, idx) => {
      return `
        <tr class="align-top hover:bg-slate-50/80">
          <td class="whitespace-nowrap px-3 py-2 text-slate-500">${idx + 1}</td>
          <td class="whitespace-nowrap px-3 py-2 text-slate-700">
            <div class="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">${escapeHtml(
              formatHistoryTime(item.ts_ms)
            )}</div>
          </td>
          <td class="px-3 py-2">${historyOperationBadge(item.operation)}</td>
          <td class="max-w-[380px] px-3 py-2">
            <div class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-700 break-all">${escapeHtml(
              safeString(item.command_label)
            )}</div>
          </td>
          <td class="px-3 py-2">${historyModeBadge(item.mode)}</td>
          <td class="max-w-[260px] px-3 py-2">${historyTargetCell(item)}</td>
          <td class="px-3 py-2">${historyRecordLevelBadge(item.record_level)}</td>
          <td class="whitespace-nowrap px-3 py-2">
            <div class="inline-flex items-center gap-2">
              <button class="mini-btn js-history-detail-btn" type="button" data-history-id="${escapeHtml(
                safeString(item.id)
              )}">${escapeHtml(t("actionViewDetail"))}</button>
              <button class="mini-btn delete js-history-delete-btn" type="button" data-history-id="${escapeHtml(
                safeString(item.id)
              )}">${escapeHtml(t("historyDeleteBtn"))}</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="min-w-[1080px] table-fixed text-sm">
        <thead class="bg-slate-100 text-xs font-semibold text-slate-600">
          <tr>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColIndex"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColTime"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColOperation"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColCommand"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColMode"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColProfile"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("historyColLevel"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableAction"))}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${rows}
        </tbody>
      </table>
    </div>
  `;
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
  const haystack = fields
    .filter((v) => v != null)
    .map((v) => String(v).toLowerCase())
    .join("\n");
  return haystack.includes(q);
}

function filterHistoryItems(items) {
  return (items || []).filter((item) => {
    const op = String(item.operation || "").toLowerCase();
    const opOk = historyFilterOperation === "all" ? true : op === historyFilterOperation;
    return opOk && historyMatchesSearch(item, historyFilterQuery);
  });
}

function renderHistoryDrawer() {
  const out = byId("history-drawer-out");
  if (!out) return;
  if (!Array.isArray(lastHistoryItems) || lastHistoryItems.length === 0) {
    out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("savedConnHistoryEmpty")
    )}</div>`;
    return;
  }
  const filtered = filterHistoryItems(lastHistoryItems);
  if (!filtered.length) {
    out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("noMatchedEntries")
    )}</div>`;
    return;
  }
  out.innerHTML = renderConnectionHistoryTable(filtered);
}

async function loadConnectionHistory() {
  const name = byId("saved-conn-name").value.trim();
  const out = byId("history-drawer-out");
  byId("history-drawer-conn-name").textContent = name || "-";
  if (!name) {
    out.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      t("connectionNameRequired")
    )}</div>`;
    return;
  }
  out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
    t("running")
  )}</div>`;
  try {
    const limit = Number(byId("history-filter-limit").value || historyFilterLimit || 30);
    const data = await request(
      "GET",
      `/api/connections/${encodeURIComponent(name)}/history?limit=${Number.isFinite(limit) ? limit : 30}`
    );
    lastHistoryItems = Array.isArray(data) ? data : [];
    renderHistoryDrawer();
  } catch (e) {
    out.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      e.message
    )}</div>`;
  }
}

function formatHistoryDetailView(data) {
  const meta = (data && data.meta) || {};
  const entries = Array.isArray(data && data.entries) ? data.entries : [];
  const metaCard = `
    <section class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      <div class="mb-1 text-xs font-semibold text-slate-500">${escapeHtml(t("historyMetaTitle"))}</div>
      <div class="grid gap-1 font-mono text-xs break-all">
        <div>time=${escapeHtml(formatHistoryTime(meta.ts_ms))}</div>
        <div>operation=${escapeHtml(safeString(meta.operation))}</div>
        <div>command=${escapeHtml(safeString(meta.command_label))}</div>
        <div>mode=${escapeHtml(displayMode(meta.mode))}</div>
        <div>profile=${escapeHtml(safeString(meta.device_profile))}</div>
        <div>target=${escapeHtml(`${safeString(meta.host)}:${safeString(meta.port)}`)}</div>
        <div>record_level=${escapeHtml(safeString(meta.record_level))}</div>
      </div>
    </section>
  `;
  if (!entries.length) {
    return `<div class="grid gap-3">${metaCard}
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
        t("historyDetailEmpty")
      )}</div></div>`;
  }
  return `<div class="grid gap-3">${metaCard}${renderStatsCards(
    buildEventStats(entries)
  )}${renderEntriesTable(entries)}</div>`;
}

async function loadConnectionHistoryDetail(historyId) {
  const name = byId("saved-conn-name").value.trim();
  if (!name || !historyId) return;
  openDetailModal(t("running"));
  try {
    const data = await request(
      "GET",
      `/api/connections/${encodeURIComponent(name)}/history/${encodeURIComponent(historyId)}`
    );
    openDetailModal(formatHistoryDetailView(data), {
      title: t("historyDetailTitle"),
      html: true,
    });
  } catch (e) {
    openDetailModal(e.message, { title: t("historyDetailTitle") });
  }
}

async function deleteConnectionHistoryItem(historyId) {
  const name = byId("saved-conn-name").value.trim();
  if (!name || !historyId) return;
  if (!window.confirm(t("historyDeleteConfirm"))) return;
  setStatusMessage("saved-conn-out", t("running"), "running");
  try {
    await request(
      "DELETE",
      `/api/connections/${encodeURIComponent(name)}/history/${encodeURIComponent(historyId)}`
    );
    setStatusMessage("saved-conn-out", t("historyDeleteDone"), "success");
    await loadConnectionHistory();
  } catch (e) {
    setStatusMessage("saved-conn-out", e.message, "error");
  }
}
