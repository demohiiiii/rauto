/**
 * replay.js — replay
 */

function formatReplayListView(data) {
  if (!data) {
    return `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("replayListNoData")
    )}</div>`;
  }
  const sections = [];
  if (data.context) {
    sections.push(`
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <div class="mb-1 text-xs font-semibold text-slate-500">${escapeHtml(
          t("replayContextTitle")
        )}</div>
        <div class="font-mono text-xs break-all">
          device=${escapeHtml(safeString(data.context.device_addr))}<br/>
          prompt=${escapeHtml(safeString(data.context.prompt))}<br/>
          fsm=${escapeHtml(safeString(data.context.fsm_prompt))}
        </div>
      </div>
    `);
  }
  const entriesRaw = Array.isArray(data.entries) ? data.entries : [];
  const entries = filterEntries(
    entriesRaw,
    replayEventKind,
    replayFailedOnly,
    replaySearchQuery
  );
  if (entries.length) {
    sections.push(renderStatsCards(buildEventStats(entries)));
    sections.push(renderEntriesTable(entries));
  }
  if (data.output) {
    sections.push(`
      <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div class="mb-2 text-xs font-semibold text-slate-500">${escapeHtml(
          t("replayOutputTitle")
        )}</div>
        <div class="inline-flex items-center gap-2 text-xs">
          ${data.output.success
            ? '<span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">OK</span>'
            : '<span class="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">FAIL</span>'}
          <span class="font-mono text-slate-600">prompt=${escapeHtml(
            safeString(data.output.prompt)
          )}</span>
        </div>
        <pre class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">${escapeHtml(
          safeString(data.output.content)
        )}</pre>
      </div>
    `);
  }
  if (!sections.length) {
    sections.push(
      `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
        replayFailedOnly
          ? t("noFailedEntries")
          : replayEventKind !== "all"
            ? t("noMatchedEntries")
            : t("replayListNoData")
      )}</div>`
    );
  }
  return sections.join("");
}

function detailField(label, value, mono = false) {
  const valueCls = mono ? "font-mono text-xs break-all" : "text-sm break-all";
  return `
    <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(label)}</div>
      <div class="mt-1 ${valueCls} text-slate-800">${escapeHtml(safeString(value))}</div>
    </div>
  `;
}

function detailBoolBadge(value) {
  if (value === true) {
    return '<span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">true</span>';
  }
  if (value === false) {
    return '<span class="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">false</span>';
  }
  return '<span class="text-slate-500">-</span>';
}

function renderEntryDetailView(entry) {
  const event = (entry && entry.event) || {};
  const kind = safeString(event.kind);
  const isCommandOutput = event.kind === "command_output";
  const parts = [];

  parts.push(`
    <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
        t("detailSectionBasic")
      )}</div>
      <div class="grid gap-2 md:grid-cols-2">
        ${detailField(t("detailLabelKind"), kind)}
        <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
            t("detailLabelSuccess")
          )}</div>
          <div class="mt-1">${detailBoolBadge(event.success)}</div>
        </div>
        ${detailField(t("detailLabelCommand"), event.command || "-", true)}
        ${detailField(
          t("detailLabelMode"),
          event.kind === "command_output" ? displayMode(event.mode) : event.mode || "-",
          true
        )}
        ${detailField(t("detailLabelPrompt"), event.prompt || "-", true)}
        ${detailField(t("detailLabelFsmPrompt"), event.fsm_prompt || "-", true)}
        ${detailField(
          t("detailLabelTimestamp"),
          formatHistoryTime(entry.ts_ms || entry.timestamp_ms || event.ts_ms || 0)
        )}
        ${detailField(
          t("detailLabelDevice"),
          event.device_addr || entry.device_addr || "-",
          true
        )}
        ${detailField(
          t("detailLabelRecordLevel"),
          entry.record_level || event.record_level || "-",
          true
        )}
      </div>
    </section>
  `);

  parts.push(`
    <section class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
        t("detailSectionFlow")
      )}</div>
      <div class="grid gap-2 lg:grid-cols-2">
        <div>
          <div class="mb-1 text-[11px] font-semibold text-slate-500">${escapeHtml(
            t("tablePromptFlow")
          )}</div>
          ${renderFlowCell(event.prompt_before, event.prompt_after, "indigo")}
        </div>
        <div>
          <div class="mb-1 text-[11px] font-semibold text-slate-500">${escapeHtml(
            t("tableFsmFlow")
          )}</div>
          ${renderFlowCell(event.fsm_prompt_before, event.fsm_prompt_after, "teal")}
        </div>
      </div>
    </section>
  `);

  if (isCommandOutput) {
    parts.push(`
      <section class="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
          t("detailSectionOutput")
        )}</div>
        <div class="grid gap-2 md:grid-cols-2">
          ${detailField(t("detailLabelError"), event.error || "-", true)}
        </div>
        <pre class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">${escapeHtml(
          safeString(event.content || event.all || "-")
        )}</pre>
      </section>
    `);
  } else if (event.content || event.all) {
    parts.push(`
      <section class="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
          t("detailSectionRaw")
        )}</div>
        <pre class="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">${escapeHtml(
          safeString(event.content || event.all)
        )}</pre>
      </section>
    `);
  }

  return parts.join("");
}

function openEntryDrawer(entry) {
  const backdrop = byId("entry-drawer-backdrop");
  const drawer = byId("entry-drawer");
  const body = byId("entry-drawer-body");
  body.innerHTML = renderEntryDetailView(entry);
  backdrop.classList.add("open");
  drawer.classList.add("open");
  document.body.classList.add("overflow-hidden");
}

function closeEntryDrawer() {
  const backdrop = byId("entry-drawer-backdrop");
  const drawer = byId("entry-drawer");
  const body = byId("entry-drawer-body");
  backdrop.classList.remove("open");
  drawer.classList.remove("open");
  body.innerHTML = "";
  document.body.classList.remove("overflow-hidden");
}

function renderReplayView() {
  const listOut = byId("replay-list-out");
  const rawOut = byId("replay-out");
  const listBtn = byId("replay-view-list");
  const rawBtn = byId("replay-view-raw");
  const isList = replayViewMode === "list";
  listBtn.classList.toggle("is-active", isList);
  rawBtn.classList.toggle("is-active", !isList);
  setPanelVisible(listOut, isList, "grid");
  setPanelVisible(rawOut, !isList, "block");

  if (!lastReplayResult) {
    if (isList) {
      listOut.innerHTML = formatReplayListView(null);
    } else {
      rawOut.textContent = t("replayListNoData");
    }
    return;
  }
  if (isList) {
    listOut.innerHTML = formatReplayListView(lastReplayResult);
  } else {
    rawOut.textContent = JSON.stringify(lastReplayResult, null, 2);
  }
}

function showReplayStatus(text) {
  if (replayViewMode === "list") {
    byId("replay-list-out").innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      text
    )}</div>`;
  } else {
    byId("replay-out").textContent = text;
  }
}

function resetRecordFilters() {
  recordFailedOnly = false;
  recordEventKind = "all";
  recordSearchQuery = "";
  byId("record-failed-only").checked = false;
  byId("record-event-kind").value = "all";
  byId("record-search").value = "";
  saveFilterPrefs();
  renderRecordingView();
}

function resetReplayFilters() {
  replayFailedOnly = false;
  replayEventKind = "all";
  replaySearchQuery = "";
  byId("replay-failed-only").checked = false;
  byId("replay-event-kind").value = "all";
  byId("replay-search").value = "";
  saveFilterPrefs();
  renderReplayView();
}

async function replayList() {
  const jsonl = byId("replay-jsonl").value.trim();
  if (!jsonl) {
    showReplayStatus(t("replayNoJsonl"));
    return;
  }
  showReplayStatus(t("running"));
  try {
    const data = await request("POST", "/api/replay", { jsonl, list: true });
    lastReplayResult = data;
    renderReplayView();
  } catch (e) {
    showReplayStatus(e.message);
  }
}

async function replayCommand() {
  const jsonl = byId("replay-jsonl").value.trim();
  const command = byId("replay-command").value.trim();
  const mode = byId("replay-mode").value.trim();
  if (!jsonl) {
    showReplayStatus(t("replayNoJsonl"));
    return;
  }
  if (!command) {
    showReplayStatus(t("replayNoCommand"));
    return;
  }
  showReplayStatus(t("running"));
  try {
    const data = await request("POST", "/api/replay", {
      jsonl,
      command,
      mode: mode || null,
    });
    lastReplayResult = data;
    renderReplayView();
  } catch (e) {
    showReplayStatus(e.message);
  }
}
