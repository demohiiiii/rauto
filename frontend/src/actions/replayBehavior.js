import { replaySession } from "../api/client.js";

const STORAGE = {
  replayViewMode: "rauto_replay_view_mode",
  replayFailedOnly: "rauto_replay_failed_only",
  replayEventKind: "rauto_replay_event_kind",
  replaySearchQuery: "rauto_replay_search_query",
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

function statusCard(text) {
  return `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
    text,
  )}</div>`;
}

export function replayBehavior(node) {
  let lastReplayResult = null;
  let replayViewMode = localStorage.getItem(STORAGE.replayViewMode) || "list";
  let replayFailedOnly =
    localStorage.getItem(STORAGE.replayFailedOnly) === "true";
  let replayEventKind = localStorage.getItem(STORAGE.replayEventKind) || "all";
  let replaySearchQuery = localStorage.getItem(STORAGE.replaySearchQuery) || "";

  const byId = (id) => node.querySelector(`#${id}`);

  function syncReplayRuntimeState() {
    if (typeof window.setReplayRuntimeState === "function") {
      window.setReplayRuntimeState({
        viewMode: replayViewMode,
        failedOnly: replayFailedOnly,
        eventKind: replayEventKind,
        searchQuery: replaySearchQuery,
      });
    }
  }

  function saveReplayPrefs() {
    localStorage.setItem(STORAGE.replayViewMode, replayViewMode);
    localStorage.setItem(STORAGE.replayFailedOnly, String(replayFailedOnly));
    localStorage.setItem(STORAGE.replayEventKind, replayEventKind);
    localStorage.setItem(STORAGE.replaySearchQuery, replaySearchQuery);
    syncReplayRuntimeState();
  }

  function filteredEntries(entries) {
    if (typeof window.filterEntries === "function") {
      return window.filterEntries(
        entries,
        replayEventKind,
        replayFailedOnly,
        replaySearchQuery,
      );
    }
    return entries || [];
  }

  function formatReplayListView(data) {
    if (!data) return statusCard(tr("replayListNoData", "no replay data"));
    const sections = [];
    if (data.context) {
      sections.push(`
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <div class="mb-1 text-xs font-semibold text-slate-500">${escapeHtml(
            tr("replayContextTitle", "Context"),
          )}</div>
          <div class="font-mono text-xs break-all">
            device=${escapeHtml(safeString(data.context.device_addr))}<br/>
            prompt=${escapeHtml(safeString(data.context.prompt))}<br/>
            fsm=${escapeHtml(safeString(data.context.fsm_prompt))}
          </div>
        </div>`);
    }
    const entries = filteredEntries(
      Array.isArray(data.entries) ? data.entries : [],
    );
    if (entries.length) {
      if (
        typeof window.renderStatsCards === "function" &&
        typeof window.buildEventStats === "function"
      ) {
        sections.push(window.renderStatsCards(window.buildEventStats(entries)));
      }
      sections.push(
        typeof window.renderEntriesTable === "function"
          ? window.renderEntriesTable(entries)
          : `<pre class="output">${escapeHtml(JSON.stringify(entries, null, 2))}</pre>`,
      );
    }
    if (data.output) {
      sections.push(`
        <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div class="mb-2 text-xs font-semibold text-slate-500">${escapeHtml(
            tr("replayOutputTitle", "Output"),
          )}</div>
          <div class="inline-flex items-center gap-2 text-xs">
            ${
              data.output.success
                ? '<span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">OK</span>'
                : '<span class="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">FAIL</span>'
            }
            <span class="font-mono text-slate-600">prompt=${escapeHtml(
              safeString(data.output.prompt),
            )}</span>
          </div>
          <pre class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">${escapeHtml(
            safeString(data.output.content),
          )}</pre>
        </div>`);
    }
    if (!sections.length) {
      sections.push(
        statusCard(
          replayFailedOnly
            ? tr("noFailedEntries", "no failed entries")
            : replayEventKind !== "all"
              ? tr("noMatchedEntries", "no matched entries")
              : tr("replayListNoData", "no replay data"),
        ),
      );
    }
    return sections.join("");
  }

  function renderReplayView() {
    const listOut = byId("replay-list-out");
    const rawOut = byId("replay-out");
    const listBtn = byId("replay-view-list");
    const rawBtn = byId("replay-view-raw");
    const isList = replayViewMode === "list";
    listBtn?.classList.toggle("tab-active", isList);
    rawBtn?.classList.toggle("tab-active", !isList);
    if (listOut) {
      listOut.hidden = !isList;
      listOut.style.display = isList ? "grid" : "none";
    }
    if (rawOut) {
      rawOut.hidden = isList;
      rawOut.style.display = isList ? "none" : "block";
    }
    if (!lastReplayResult) {
      if (isList && listOut) listOut.innerHTML = formatReplayListView(null);
      if (!isList && rawOut)
        rawOut.textContent = tr("replayListNoData", "no replay data");
      return;
    }
    if (isList && listOut)
      listOut.innerHTML = formatReplayListView(lastReplayResult);
    if (!isList && rawOut)
      rawOut.textContent = JSON.stringify(lastReplayResult, null, 2);
  }

  function showReplayStatus(text) {
    if (replayViewMode === "list") {
      byId("replay-list-out").innerHTML = statusCard(text);
    } else {
      byId("replay-out").textContent = text;
    }
  }

  async function replayList() {
    const jsonl = byId("replay-jsonl").value.trim();
    if (!jsonl) {
      showReplayStatus(tr("replayNoJsonl", "recording JSONL is required"));
      return;
    }
    showReplayStatus(tr("running", "running"));
    try {
      lastReplayResult = await replaySession({ jsonl, list: true });
      renderReplayView();
    } catch (error) {
      showReplayStatus(error.message);
    }
  }

  async function replayCommand() {
    const jsonl = byId("replay-jsonl").value.trim();
    const command = byId("replay-command").value.trim();
    const mode = byId("replay-mode").value.trim();
    if (!jsonl) {
      showReplayStatus(tr("replayNoJsonl", "recording JSONL is required"));
      return;
    }
    if (!command) {
      showReplayStatus(tr("replayNoCommand", "replay command is required"));
      return;
    }
    showReplayStatus(tr("running", "running"));
    try {
      lastReplayResult = await replaySession({
        jsonl,
        command,
        mode: mode || null,
      });
      renderReplayView();
    } catch (error) {
      showReplayStatus(error.message);
    }
  }

  function resetReplayFilters() {
    replayFailedOnly = false;
    replayEventKind = "all";
    replaySearchQuery = "";
    byId("replay-failed-only").checked = false;
    byId("replay-event-kind").value = "all";
    byId("replay-search").value = "";
    saveReplayPrefs();
    renderReplayView();
  }

  function applyReplayInputs() {
    byId("replay-failed-only").checked = replayFailedOnly;
    byId("replay-event-kind").value = replayEventKind;
    byId("replay-search").value = replaySearchQuery;
  }

  const viewList = byId("replay-view-list");
  const viewRaw = byId("replay-view-raw");
  const failedOnly = byId("replay-failed-only");
  const eventKind = byId("replay-event-kind");
  const search = byId("replay-search");
  const clear = byId("replay-clear-filters");
  const listBtn = byId("replay-list-btn");
  const runBtn = byId("replay-run-btn");

  const onViewList = () => {
    replayViewMode = "list";
    saveReplayPrefs();
    renderReplayView();
  };
  const onViewRaw = () => {
    replayViewMode = "raw";
    saveReplayPrefs();
    renderReplayView();
  };
  const onFailedOnly = () => {
    replayFailedOnly = failedOnly.checked;
    saveReplayPrefs();
    renderReplayView();
  };
  const onEventKind = () => {
    replayEventKind = eventKind.value || "all";
    saveReplayPrefs();
    renderReplayView();
  };
  const onSearch = () => {
    replaySearchQuery = search.value || "";
    saveReplayPrefs();
    renderReplayView();
  };
  const onList = () =>
    typeof window.withButtonLoading === "function"
      ? window.withButtonLoading("replay-list-btn", replayList)
      : replayList();
  const onRun = () =>
    typeof window.withButtonLoading === "function"
      ? window.withButtonLoading("replay-run-btn", replayCommand)
      : replayCommand();

  viewList?.addEventListener("click", onViewList);
  viewRaw?.addEventListener("click", onViewRaw);
  failedOnly?.addEventListener("change", onFailedOnly);
  eventKind?.addEventListener("change", onEventKind);
  search?.addEventListener("input", onSearch);
  clear?.addEventListener("click", resetReplayFilters);
  listBtn?.addEventListener("click", onList);
  runBtn?.addEventListener("click", onRun);

  window.renderReplayView = renderReplayView;
  window.showReplayStatus = showReplayStatus;
  window.resetReplayFilters = resetReplayFilters;
  window.replayList = replayList;
  window.replayCommand = replayCommand;
  window.setReplayJsonlFromRecording = (jsonl) => {
    byId("replay-jsonl").value = jsonl || "";
    lastReplayResult = null;
    renderReplayView();
    showReplayStatus(tr("recordingSetToReplay", "recording copied to replay"));
  };

  syncReplayRuntimeState();
  applyReplayInputs();
  renderReplayView();

  return {
    destroy() {
      viewList?.removeEventListener("click", onViewList);
      viewRaw?.removeEventListener("click", onViewRaw);
      failedOnly?.removeEventListener("change", onFailedOnly);
      eventKind?.removeEventListener("change", onEventKind);
      search?.removeEventListener("input", onSearch);
      clear?.removeEventListener("click", resetReplayFilters);
      listBtn?.removeEventListener("click", onList);
      runBtn?.removeEventListener("click", onRun);
    },
  };
}
