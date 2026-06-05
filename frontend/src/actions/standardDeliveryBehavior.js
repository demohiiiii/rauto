import {
  executeCommand,
  executeCommandFlow as executeCommandFlowRequest,
  executeShow as executeShowRequest,
  executeShowBatch as executeShowBatchRequest,
  executeTemplate as executeTemplateRequest,
  exportTextfsmExcel,
  listShowObjects,
  renderTemplate,
} from "../api/client.js";
import {
  applyRecordingFromResponse,
  buildFlowVarsPayload,
  ensureConnectionTargetSelected,
  ensureFlowRunTemplateDetail,
  escapeHtml,
  parseBuiltinFlowTemplateValue,
  renderCommandFlowResult,
  renderFlowTemplateVarFields,
  renderParsedOutputBlock,
  renderStatusMessage,
  renderTemplateExecuteResult,
  safeString,
  t,
  withButtonLoading,
} from "../services/runtimeInterop.js";
import {
  byId,
  batchShowExecutionPayload,
  commandFlowPayload,
  connectionPayload,
  directCommandPayload,
  parseVars,
  recordLevelPayload,
  selectedTemplateContent,
  showExecutionPayload,
  templateExecutionPayload,
} from "../services/standardPayloads.js";
import { loadSelectedTemplateContent } from "../services/standardTemplates.js";

let showObjectsRequestSeq = 0;
let batchShowObjectsRequestSeq = 0;

async function renderTemplatePreview() {
  const out = byId("render-out");
  out.textContent = t("running");
  try {
    const data = await renderTemplate({
      template: selectedTemplateContent(),
      vars: parseVars(),
      connection: connectionPayload(),
    });
    out.textContent = data.rendered_commands;
  } catch (error) {
    out.innerHTML = renderStatusMessage(error.message, "error");
  }
}

async function executeDirectCommand() {
  const out = byId("exec-out");
  if (!ensureConnectionTargetSelected("", "exec-out")) {
    return;
  }
  out.textContent = t("running");
  try {
    const connection = connectionPayload();
    const payload = directCommandPayload({
      connection,
      recordLevel: recordLevelPayload(),
    });
    const data = await executeCommand(payload);
    out.innerHTML = `<pre class="output">${escapeHtml(safeString(data.output))}</pre>${renderParsedOutputBlock(
      {
        ...data,
        command: payload.command,
        device: connection.connection_name || connection.host,
      },
    )}`;
    applyRecordingFromResponse(data);
  } catch (error) {
    out.innerHTML = renderStatusMessage(error.message, "error");
  }
}

function showObjectQueryPayload() {
  return {
    deviceProfile: byId("device_profile")?.value.trim() || "",
    textfsmPlatform: byId("textfsm-platform")?.value.trim() || "",
  };
}

function batchShowObjectQueryPayload() {
  return {};
}

function renderShowObjectOptions(data, selected = "") {
  const select = byId("show-object");
  if (!select) return;
  const objects = Array.isArray(data?.objects) ? data.objects : [];
  const selectedValues = Array.isArray(selected)
    ? selected
    : selected
      ? [selected]
      : [];
  const options = objects.map(
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
  );
  select.innerHTML = options.join("");
  selectedValues.forEach((value) => {
    const option = Array.from(select.options || []).find(
      (item) => item.value === value,
    );
    if (option) option.selected = true;
  });
  if (!selectedValues.length && select.options.length === 1) {
    select.options[0].selected = true;
  }
  window.renderConnectionPickerSelected?.("show-object");
  window.hideConnectionPickerMenu?.("show-object");
  updateShowCommandPreview(data?.platform || "");
}

function updateShowCommandPreview(platform = "") {
  const out = byId("show-command-preview");
  const select = byId("show-object");
  if (!out || !select) return;
  const selectedOptions = Array.from(select.selectedOptions || []);
  const platformText = platform || byId("show-object")?.dataset?.platform || "";
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

function renderBatchShowObjectOptions(data, selected = "") {
  const select = byId("batch-show-object");
  if (!select) return;
  const objects = Array.isArray(data?.objects) ? data.objects : [];
  const selectedValues = Array.isArray(selected)
    ? selected
    : selected
      ? [selected]
      : [];
  const options = objects.map(
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
  );
  select.innerHTML = options.join("");
  selectedValues.forEach((value) => {
    const option = Array.from(select.options || []).find(
      (item) => item.value === value,
    );
    if (option) option.selected = true;
  });
  if (!selectedValues.length && select.options.length === 1) {
    select.options[0].selected = true;
  }
  window.renderConnectionPickerSelected?.("batch-show-object");
  window.hideConnectionPickerMenu?.("batch-show-object");
  updateBatchShowCommandPreview(data?.platform || "");
}

function updateBatchShowCommandPreview(platform = "") {
  const out = byId("batch-show-command-preview");
  const select = byId("batch-show-object");
  if (!out || !select) return;
  const selectedOptions = Array.from(select.selectedOptions || []);
  const platformText =
    platform || byId("batch-show-object")?.dataset?.platform || "";
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

async function loadShowObjects() {
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
    renderShowObjectOptions(data, selected);
  } catch (error) {
    if (requestSeq !== showObjectsRequestSeq) {
      return;
    }
    const out = byId("show-out");
    if (out) out.innerHTML = renderStatusMessage(error.message, "error");
  }
}

async function loadBatchShowObjects() {
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
    renderBatchShowObjectOptions(data, selected);
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

async function executeShowObject() {
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

async function executeBatchShowObject() {
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

async function executeTemplate() {
  const visualOut = byId("template-exec-visual");
  if (!ensureConnectionTargetSelected("", "template-exec-visual")) {
    return;
  }
  visualOut.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(t("running"))}</div>`;
  try {
    const data = await executeTemplateRequest(
      templateExecutionPayload({
        connection: connectionPayload(),
        recordLevel: recordLevelPayload(),
      }),
    );
    visualOut.innerHTML = renderTemplateExecuteResult(data);
    applyRecordingFromResponse(data);
  } catch (error) {
    visualOut.innerHTML = renderStatusMessage(error.message, "error");
  }
}

async function executeCommandFlow() {
  const out = byId("flow-out");
  if (!ensureConnectionTargetSelected("flow-out", "flow-out")) {
    return;
  }
  out.innerHTML = renderStatusMessage(t("running"), "running");
  try {
    const templateSelection = byId("flow-template-name").value.trim();
    if (!templateSelection) {
      throw new Error(t("flowTemplateNameRequired"));
    }
    await ensureFlowRunTemplateDetail(templateSelection, { silent: true });
    const builtinTemplateName =
      parseBuiltinFlowTemplateValue(templateSelection);
    const data = await executeCommandFlowRequest(
      commandFlowPayload({
        builtinTemplateName,
        connection: connectionPayload(),
        recordLevel: recordLevelPayload(),
        templateSelection,
        vars: buildFlowVarsPayload(),
      }),
    );
    out.innerHTML = renderCommandFlowResult(data);
    applyRecordingFromResponse(data);
  } catch (error) {
    out.innerHTML = renderStatusMessage(error.message, "error");
  }
}

async function loadFlowTemplateDetail() {
  const name = byId("flow-template-name").value.trim();
  if (!name) {
    renderFlowTemplateVarFields(null, {});
    return;
  }
  try {
    await ensureFlowRunTemplateDetail(name);
  } catch (_) {
    // The runtime field renderer already displays the error.
  }
}

function loadTemplateContent() {
  return loadSelectedTemplateContent();
}

function bindClick(id, handler) {
  const element = byId(id);
  if (!element) {
    return () => {};
  }
  const listener = () => withButtonLoading(id, handler);
  element.addEventListener("click", listener);
  return () => element.removeEventListener("click", listener);
}

function bindChange(id, handler) {
  const element = byId(id);
  if (!element) {
    return () => {};
  }
  element.addEventListener("change", handler);
  return () => element.removeEventListener("change", handler);
}

function syncTextfsmControlVisibility() {
  const parseToggle = byId("parse-textfsm");
  const extraFields = byId("textfsm-extra-fields");
  if (!extraFields || !parseToggle) return;
  extraFields.hidden = !parseToggle.checked;
}

function syncBatchTextfsmControlVisibility() {
  const parseToggle = byId("batch-parse-textfsm");
  const extraFields = byId("batch-textfsm-extra-fields");
  if (!extraFields || !parseToggle) return;
  extraFields.hidden = !parseToggle.checked;
}

function prepareTextfsmControlsForMode(mode = window.currentExecMode || "") {
  const parseToggle = byId("parse-textfsm");
  if (parseToggle && mode === "show") {
    parseToggle.checked = true;
  }
  syncTextfsmControlVisibility();
}

export function standardDeliveryBehavior(node) {
  window.loadShowObjects = loadShowObjects;
  window.loadBatchShowObjects = loadBatchShowObjects;
  window.syncTextfsmControlVisibility = syncTextfsmControlVisibility;
  window.syncBatchTextfsmControlVisibility = syncBatchTextfsmControlVisibility;
  window.prepareTextfsmControlsForMode = prepareTextfsmControlsForMode;
  prepareTextfsmControlsForMode();
  syncBatchTextfsmControlVisibility();
  const onPanelChange = (event) => {
    if (event.target?.id === "parse-textfsm") {
      syncTextfsmControlVisibility();
    }
    if (event.target?.id === "batch-parse-textfsm") {
      syncBatchTextfsmControlVisibility();
    }
    if (event.target?.id === "textfsm-platform") {
      loadShowObjects();
    }
    if (event.target?.id === "batch-textfsm-platform") {
      loadBatchShowObjects();
    }
  };
  node?.addEventListener("change", onPanelChange);
  const cleanups = [
    bindClick("render-btn", renderTemplatePreview),
    bindClick("exec-btn", executeDirectCommand),
    bindClick("show-exec-btn", executeShowObject),
    bindClick("batch-show-exec-btn", executeBatchShowObject),
    bindClick("template-exec-btn", executeTemplate),
    bindClick("flow-exec-btn", executeCommandFlow),
    bindChange("show-object", () => {
      updateShowCommandPreview();
    }),
    bindChange("batch-show-object", () => {
      updateBatchShowCommandPreview();
    }),
    bindChange("device_profile", loadShowObjects),
    bindChange("device_profile", loadBatchShowObjects),
    bindChange("template", loadTemplateContent),
    bindChange("flow-template-name", loadFlowTemplateDetail),
  ];

  loadShowObjects();
  loadBatchShowObjects();

  return {
    destroy() {
      node?.removeEventListener("change", onPanelChange);
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}
