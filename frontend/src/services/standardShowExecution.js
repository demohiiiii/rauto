import {
  executeShow as executeShowRequest,
  executeShowBatch as executeShowBatchRequest,
  exportTextfsmExcel,
  listShowObjects,
} from "../api/client.js";
import {
  applyRecordingFromResponse,
  ensureConnectionTargetSelected,
  escapeHtml,
  renderParsedOutputBlock,
  renderStatusMessage,
  safeString,
  t,
} from "./runtimeInterop.js";
import {
  batchShowExecutionPayload,
  byId,
  connectionPayload,
  recordLevelPayload,
  showExecutionPayload,
} from "./standardPayloads.js";

let showObjectsRequestSeq = 0;
let batchShowObjectsRequestSeq = 0;

function showObjectQueryPayload() {
  return {
    deviceProfile: byId("device_profile")?.value.trim() || "",
    textfsmPlatform: byId("textfsm-platform")?.value.trim() || "",
  };
}

function batchShowObjectQueryPayload() {
  return {};
}

function renderObjectOptions(selectId, data, selected = "") {
  const select = byId(selectId);
  if (!select) return;
  const objects = Array.isArray(data?.objects) ? data.objects : [];
  const selectedValues = Array.isArray(selected)
    ? selected
    : selected
      ? [selected]
      : [];
  select.innerHTML = objects
    .map(
      (item) =>
        `<option value="${escapeHtml(safeString(item.object))}" data-command="${escapeHtml(
          safeString(item.command),
        )}" data-mode="${escapeHtml(safeString(item.mode))}" data-source="${escapeHtml(
          safeString(item.source),
        )}" data-textfsm-mapping-command="${escapeHtml(
          safeString(item.textfsm_mapping_command),
        )}" data-textfsm-template="${escapeHtml(
          safeString(item.textfsm_template_name),
        )}">${escapeHtml(safeString(item.object))}</option>`,
    )
    .join("");
  selectedValues.forEach((value) => {
    const option = Array.from(select.options || []).find(
      (item) => item.value === value,
    );
    if (option) option.selected = true;
  });
  if (!selectedValues.length && select.options.length === 1) {
    select.options[0].selected = true;
  }
  window.renderConnectionPickerSelected?.(selectId);
  window.hideConnectionPickerMenu?.(selectId);
}

function updateShowCommandPreviewFor(selectId, previewId, platform = "") {
  const out = byId(previewId);
  const select = byId(selectId);
  if (!out || !select) return;
  const selectedOptions = Array.from(select.selectedOptions || []);
  const platformText = platform || select.dataset?.platform || "";
  out.textContent = selectedOptions.length
    ? selectedOptions
        .map((option) => {
          const object = option.value.trim();
          const command = option?.dataset?.command || "";
          const mode = option?.dataset?.mode || "";
          const source = option?.dataset?.source || "";
          const mapping = option?.dataset?.textfsmMappingCommand || "";
          const template = option?.dataset?.textfsmTemplate || "";
          return `${object}: platform=${platformText || "-"} source=${source || "-"} mode=${mode || "-"} mapping=${mapping || "-"} textfsm=${template || "-"} command=${command || "-"}`;
        })
        .join("\n")
    : "-";
}

export function updateShowCommandPreview(platform = "") {
  updateShowCommandPreviewFor("show-object", "show-command-preview", platform);
}

export function updateBatchShowCommandPreview(platform = "") {
  updateShowCommandPreviewFor(
    "batch-show-object",
    "batch-show-command-preview",
    platform,
  );
}

export async function loadShowObjects() {
  const select = byId("show-object");
  const selected = Array.from(select?.selectedOptions || []).map(
    (option) => option.value,
  );
  const requestSeq = ++showObjectsRequestSeq;
  try {
    const data = await listShowObjects(showObjectQueryPayload());
    if (requestSeq !== showObjectsRequestSeq) {
      return;
    }
    if (select) {
      select.dataset.platform = data?.platform || "";
    }
    renderObjectOptions("show-object", data, selected);
    updateShowCommandPreview(data?.platform || "");
  } catch (error) {
    if (requestSeq !== showObjectsRequestSeq) {
      return;
    }
    const out = byId("show-out");
    if (out) out.innerHTML = renderStatusMessage(error.message, "error");
  }
}

export async function loadBatchShowObjects() {
  const select = byId("batch-show-object");
  const selected = Array.from(select?.selectedOptions || []).map(
    (option) => option.value,
  );
  const requestSeq = ++batchShowObjectsRequestSeq;
  try {
    const data = await listShowObjects(batchShowObjectQueryPayload());
    if (requestSeq !== batchShowObjectsRequestSeq) {
      return;
    }
    if (select) {
      select.dataset.platform = data?.platform || "";
    }
    renderObjectOptions("batch-show-object", data, selected);
    updateBatchShowCommandPreview(data?.platform || "");
  } catch (error) {
    if (requestSeq !== batchShowObjectsRequestSeq) {
      return;
    }
    const out = byId("batch-show-out");
    if (out) out.innerHTML = renderStatusMessage(error.message, "error");
  }
}

function selectedShowObjects(selectId) {
  return Array.from(byId(selectId)?.selectedOptions || [])
    .map((option) => safeString(option.value || "").trim())
    .filter(Boolean);
}

export async function executeShowObject() {
  const out = byId("show-out");
  if (!ensureConnectionTargetSelected("", "show-out")) {
    return;
  }
  const objects = selectedShowObjects("show-object");
  if (!objects.length) {
    out.innerHTML = renderStatusMessage(t("showObjectRequired"), "error");
    return;
  }
  out.textContent = t("running");
  try {
    const basePayload = showExecutionPayload({
      connection: connectionPayload(),
      recordLevel: recordLevelPayload(),
    });
    const results = [];
    for (const object of objects) {
      results.push(await executeShowRequest({ ...basePayload, object }));
    }
    const exportButton = window.renderParsedOutputSheetsExportButton?.(
      window.parsedOutputSheetsFromItems?.(results, {
        filename: "textfsm-show.xlsx",
        sheetName: (item, index) =>
          item.object || item.command || `show_${index + 1}`,
      }) || [],
      { filename: "textfsm-show.xlsx" },
    );
    out.innerHTML = `${exportButton ? `<div class="flex justify-end">${exportButton}</div>` : ""}${results
      .map((data) => {
        const meta = `
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        object=${escapeHtml(safeString(data.object))} · platform=${escapeHtml(
          safeString(data.platform),
        )} · mode=${escapeHtml(safeString(data.mode))} · source=${escapeHtml(
          safeString(data.source),
        )} · textfsm=${escapeHtml(
          safeString(data.textfsm_template_name || "-"),
        )} · command=<span class="font-mono">${escapeHtml(
          safeString(data.command),
        )}</span>
      </div>
    `;
        return `${meta}<pre class="output">${escapeHtml(
          safeString(data.output),
        )}</pre>${renderParsedOutputBlock({
          ...data,
          device:
            basePayload.connection?.connection_name ||
            basePayload.connection?.host,
        })}`;
      })
      .join("")}`;
    applyRecordingFromResponse(results[results.length - 1]);
  } catch (error) {
    out.innerHTML = renderStatusMessage(error.message, "error");
  }
}

function batchTargetSelectorsPresent(payload) {
  return (
    payload.targets.length > 0 ||
    payload.groups.length > 0 ||
    payload.labels.length > 0
  );
}

function enrichBatchParsedRowsForExport(data) {
  const rowsByObject = new Map();
  (Array.isArray(data?.results) ? data.results : []).forEach((item) => {
    const parsed = Array.isArray(item?.parsed_output) ? item.parsed_output : [];
    parsed.forEach((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return;
      const enriched = { ...row };
      [
        ["device", item.target],
        ["profile", item.profile],
        ["command", item.command],
        ["object", item.object],
      ].forEach(([key, value]) => {
        if (Object.prototype.hasOwnProperty.call(enriched, key)) {
          enriched[`parsed_${key}`] = enriched[key];
        }
        enriched[key] = value || "";
      });
      const object = item.object || data?.object || "show";
      if (!rowsByObject.has(object)) {
        rowsByObject.set(object, []);
      }
      rowsByObject.get(object).push(enriched);
    });
  });
  return Array.from(rowsByObject.entries()).map(([name, rows]) => ({
    name,
    parsed_output: rows,
  }));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function exportBatchShowExcelIfRequested(data) {
  const filename = byId("batch-textfsm-excel-name")?.value.trim() || "";
  if (!filename) return;
  const sheets = enrichBatchParsedRowsForExport(data);
  if (!sheets.length) return;
  const { blob, filename: responseFilename } = await exportTextfsmExcel({
    filename,
    sheets,
  });
  downloadBlob(blob, responseFilename || filename);
}

function renderBatchShowResult(data) {
  const results = Array.isArray(data?.results) ? data.results : [];
  const counts = data?.result_summary?.counts || {};
  const exportButton = window.renderParsedOutputSheetsExportButton?.(
    enrichBatchParsedRowsForExport(data),
    { filename: "textfsm-batch-show.xlsx" },
  );
  const summary = `
    <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      object=${escapeHtml(safeString(data?.object))} · total=${escapeHtml(
        safeString(counts.total ?? results.length),
      )} · succeeded=${escapeHtml(safeString(counts.succeeded ?? "-"))} · failed=${escapeHtml(
        safeString(counts.failed ?? "-"),
      )}
    </div>
  `;
  const cards = results
    .map((item) => {
      const tone = item.error
        ? "border-rose-200 bg-rose-50/60"
        : "border-slate-200 bg-white";
      const error = item.error
        ? `<div class="alert alert-error py-2 text-xs">${escapeHtml(item.error)}</div>`
        : "";
      const output =
        item.output !== null && item.output !== undefined
          ? `<pre class="output max-w-full">${escapeHtml(safeString(item.output))}</pre>`
          : "";
      return `
        <section class="min-w-0 max-w-full overflow-hidden rounded-2xl border ${tone} p-3">
          <div class="mb-2 min-w-0 max-w-full break-words rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            target=${escapeHtml(safeString(item.target))} · profile=${escapeHtml(
              safeString(item.profile),
            )} · platform=${escapeHtml(safeString(item.platform || "-"))} · mode=${escapeHtml(
              safeString(item.mode),
            )} · exit=${escapeHtml(safeString(item.exit_code ?? "-"))} · command=<span class="font-mono">${escapeHtml(
              safeString(item.command),
            )}</span>
          </div>
          ${error}
          ${output}
          ${renderParsedOutputBlock({
            command: item.command,
            device: item.target,
            parsed_output: item.parsed_output,
            parse_error: item.parse_error,
          })}
        </section>
      `;
    })
    .join("");
  return `<div class="grid min-w-0 max-w-full gap-3 overflow-hidden">${summary}${exportButton ? `<div class="flex justify-end">${exportButton}</div>` : ""}<div class="grid min-w-0 max-w-full gap-3 overflow-hidden">${cards}</div></div>`;
}

export async function executeBatchShowObject() {
  const out = byId("batch-show-out");
  const objects = selectedShowObjects("batch-show-object");
  if (!objects.length) {
    out.innerHTML = renderStatusMessage(t("showObjectRequired"), "error");
    return;
  }
  const payload = batchShowExecutionPayload({
    recordLevel: recordLevelPayload(),
  });
  if (!batchTargetSelectorsPresent(payload)) {
    out.innerHTML = renderStatusMessage(t("batchShowTargetRequired"), "error");
    return;
  }
  out.textContent = t("running");
  try {
    const data = await executeShowBatchRequest({
      ...payload,
      object: objects[0],
      objects,
    });
    out.innerHTML = renderBatchShowResult(data);
    await exportBatchShowExcelIfRequested(data);
  } catch (error) {
    out.innerHTML = renderStatusMessage(error.message, "error");
  }
}
