import {
  executeCommand,
  executeCommandFlow as executeCommandFlowRequest,
  executeTemplate as executeTemplateRequest,
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
  templateExecutionPayload,
} from "../services/standardPayloads.js";
import {
  executeBatchShowObject,
  executeShowObject,
  loadBatchShowObjects,
  loadShowObjects,
  updateBatchShowCommandPreview,
  updateShowCommandPreview,
} from "../services/standardShowExecution.js";
import { loadSelectedTemplateContent } from "../services/standardTemplates.js";

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
