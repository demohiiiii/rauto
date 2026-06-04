import {
  executeCommand,
  executeCommandFlow as executeCommandFlowRequest,
  executeShow as executeShowRequest,
  executeTemplate as executeTemplateRequest,
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
    const data = await executeCommand(
      directCommandPayload({
        connection: connectionPayload(),
        recordLevel: recordLevelPayload(),
      }),
    );
    out.innerHTML = `<pre class="output">${escapeHtml(safeString(data.output))}</pre>${renderParsedOutputBlock(data)}`;
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

function renderShowObjectOptions(data, selected = "") {
  const select = byId("show-object");
  if (!select) return;
  const objects = Array.isArray(data?.objects) ? data.objects : [];
  const options = [
    `<option value="">${escapeHtml(t("showObjectPlaceholder"))}</option>`,
    ...objects.map(
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
    ),
  ];
  select.innerHTML = options.join("");
  if (selected && objects.some((item) => item.object === selected)) {
    select.value = selected;
  }
  updateShowCommandPreview(data?.platform || "");
}

function updateShowCommandPreview(platform = "") {
  const out = byId("show-command-preview");
  const select = byId("show-object");
  if (!out || !select) return;
  const option = select.selectedOptions?.[0];
  const command = option?.dataset?.command || "";
  const mode = option?.dataset?.mode || "";
  const source = option?.dataset?.source || "";
  const mapping = option?.dataset?.textfsmMappingCommand || "";
  const template = option?.dataset?.textfsmTemplate || "";
  const object = select.value.trim();
  const platformText = platform || byId("show-object")?.dataset?.platform || "";
  out.textContent = object
    ? `platform=${platformText || "-"} source=${source || "-"} mode=${mode || "-"} mapping=${mapping || "-"} textfsm=${template || "-"} command=${command || "-"}`
    : "-";
}

async function loadShowObjects() {
  const select = byId("show-object");
  const selected = select?.value.trim() || "";
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

async function executeShowObject() {
  const out = byId("show-out");
  if (!ensureConnectionTargetSelected("", "show-out")) {
    return;
  }
  const object = byId("show-object")?.value.trim() || "";
  if (!object) {
    out.innerHTML = renderStatusMessage(t("showObjectRequired"), "error");
    return;
  }
  out.textContent = t("running");
  try {
    const data = await executeShowRequest(
      showExecutionPayload({
        connection: connectionPayload(),
        recordLevel: recordLevelPayload(),
      }),
    );
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
    out.innerHTML = `${meta}<pre class="output">${escapeHtml(
      safeString(data.output),
    )}</pre>${renderParsedOutputBlock(data)}`;
    applyRecordingFromResponse(data);
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

function prepareTextfsmControlsForMode(mode = window.currentExecMode || "") {
  const parseToggle = byId("parse-textfsm");
  if (parseToggle && mode === "show") {
    parseToggle.checked = true;
  }
  syncTextfsmControlVisibility();
}

export function standardDeliveryBehavior(node) {
  window.loadShowObjects = loadShowObjects;
  window.syncTextfsmControlVisibility = syncTextfsmControlVisibility;
  window.prepareTextfsmControlsForMode = prepareTextfsmControlsForMode;
  prepareTextfsmControlsForMode();
  const onPanelChange = (event) => {
    if (event.target?.id === "parse-textfsm") {
      syncTextfsmControlVisibility();
    }
    if (event.target?.id === "textfsm-platform") {
      loadShowObjects();
    }
  };
  node?.addEventListener("change", onPanelChange);
  const cleanups = [
    bindClick("render-btn", renderTemplatePreview),
    bindClick("exec-btn", executeDirectCommand),
    bindClick("show-exec-btn", executeShowObject),
    bindClick("template-exec-btn", executeTemplate),
    bindClick("flow-exec-btn", executeCommandFlow),
    bindChange("show-object", () => {
      updateShowCommandPreview();
    }),
    bindChange("device_profile", loadShowObjects),
    bindChange("template", loadTemplateContent),
    bindChange("flow-template-name", loadFlowTemplateDetail),
  ];

  loadShowObjects();

  return {
    destroy() {
      node?.removeEventListener("change", onPanelChange);
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}
