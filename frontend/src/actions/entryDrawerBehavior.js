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

function detailField(label, value, mono = false) {
  const valueCls = mono ? "font-mono text-xs break-all" : "text-sm break-all";
  return `
    <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(label)}</div>
      <div class="mt-1 ${valueCls} text-slate-800">${escapeHtml(safeString(value))}</div>
    </div>`;
}

function boolBadge(value) {
  if (value === true) {
    return '<span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">true</span>';
  }
  if (value === false) {
    return '<span class="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">false</span>';
  }
  return '<span class="text-slate-500">-</span>';
}

function formatTime(value) {
  return typeof window.formatHistoryTime === "function"
    ? window.formatHistoryTime(value)
    : new Date(Number(value || 0)).toLocaleString();
}

function displayMode(value) {
  return typeof window.displayMode === "function"
    ? window.displayMode(value)
    : safeString(value);
}

function flowCell(before, after, tone) {
  return typeof window.renderFlowCell === "function"
    ? window.renderFlowCell(before, after, tone)
    : `<pre class="output">${escapeHtml(`${safeString(before)} -> ${safeString(after)}`)}</pre>`;
}

function renderEntryDetailView(entry) {
  const event = entry?.event || {};
  const isCommandOutput = event.kind === "command_output";
  const parts = [];

  parts.push(`
    <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
        tr("detailSectionBasic", "Basic"),
      )}</div>
      <div class="grid gap-2 md:grid-cols-2">
        ${detailField(tr("detailLabelKind", "Kind"), safeString(event.kind))}
        <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
            tr("detailLabelSuccess", "Success"),
          )}</div>
          <div class="mt-1">${boolBadge(event.success)}</div>
        </div>
        ${detailField(tr("detailLabelCommand", "Command"), event.command || "-", true)}
        ${detailField(
          tr("detailLabelMode", "Mode"),
          event.kind === "command_output"
            ? displayMode(event.mode)
            : event.mode || "-",
          true,
        )}
        ${detailField(tr("detailLabelPrompt", "Prompt"), event.prompt || "-", true)}
        ${detailField(tr("detailLabelFsmPrompt", "FSM Prompt"), event.fsm_prompt || "-", true)}
        ${detailField(
          tr("detailLabelTimestamp", "Timestamp"),
          formatTime(entry?.ts_ms || entry?.timestamp_ms || event.ts_ms || 0),
        )}
        ${detailField(
          tr("detailLabelDevice", "Device"),
          event.device_addr || entry?.device_addr || "-",
          true,
        )}
        ${detailField(
          tr("detailLabelRecordLevel", "Record Level"),
          entry?.record_level || event.record_level || "-",
          true,
        )}
      </div>
    </section>`);

  parts.push(`
    <section class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
        tr("detailSectionFlow", "Flow"),
      )}</div>
      <div class="grid gap-2 lg:grid-cols-2">
        <div>
          <div class="mb-1 text-[11px] font-semibold text-slate-500">${escapeHtml(
            tr("tablePromptFlow", "Prompt Flow"),
          )}</div>
          ${flowCell(event.prompt_before, event.prompt_after, "indigo")}
        </div>
        <div>
          <div class="mb-1 text-[11px] font-semibold text-slate-500">${escapeHtml(
            tr("tableFsmFlow", "FSM Flow"),
          )}</div>
          ${flowCell(event.fsm_prompt_before, event.fsm_prompt_after, "teal")}
        </div>
      </div>
    </section>`);

  if (isCommandOutput) {
    parts.push(`
      <section class="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
          tr("detailSectionOutput", "Output"),
        )}</div>
        <div class="grid gap-2 md:grid-cols-2">
          ${detailField(tr("detailLabelError", "Error"), event.error || "-", true)}
        </div>
        <pre class="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">${escapeHtml(
          safeString(event.content || event.all || "-"),
        )}</pre>
      </section>`);
  } else if (event.content || event.all) {
    parts.push(`
      <section class="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
          tr("detailSectionRaw", "Raw"),
        )}</div>
        <pre class="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">${escapeHtml(
          safeString(event.content || event.all),
        )}</pre>
      </section>`);
  }

  return parts.join("");
}

export function entryDrawerBehavior(node) {
  const closeBtn = node.querySelector("#entry-drawer-close");
  const body = node.querySelector("#entry-drawer-body");
  const backdrop = document.getElementById("entry-drawer-backdrop");

  function closeEntryDrawer() {
    backdrop?.classList.remove("open");
    node.classList.remove("open");
    if (body) body.innerHTML = "";
    document.body.classList.remove("overflow-hidden");
  }

  function openEntryDrawer(entry) {
    if (body) body.innerHTML = renderEntryDetailView(entry);
    backdrop?.classList.add("open");
    node.classList.add("open");
    document.body.classList.add("overflow-hidden");
  }

  const onDrawerClick = (event) => {
    if (event.target === node) closeEntryDrawer();
  };

  window.openEntryDrawer = openEntryDrawer;
  window.closeEntryDrawer = closeEntryDrawer;

  closeBtn?.addEventListener("click", closeEntryDrawer);
  backdrop?.addEventListener("click", closeEntryDrawer);
  node.addEventListener("click", onDrawerClick);

  return {
    destroy() {
      closeBtn?.removeEventListener("click", closeEntryDrawer);
      backdrop?.removeEventListener("click", closeEntryDrawer);
      node.removeEventListener("click", onDrawerClick);
    },
  };
}
