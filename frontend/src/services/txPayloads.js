import { byId } from "./runtimeGlobals.js";

function runtimeFunction(name) {
  const fn = window[name];
  if (typeof fn !== "function") {
    throw new Error(`${name} is not ready`);
  }
  return fn;
}

function tr(key) {
  return typeof window.t === "function" ? window.t(key) : key;
}

function parseJsonById(id) {
  return runtimeFunction("parseJsonById")(id);
}

function connectionPayload() {
  return runtimeFunction("connectionPayload")();
}

function recordLevelPayload() {
  return runtimeFunction("recordLevelPayload")();
}

function txBlockEditorRaw() {
  return runtimeFunction("txBlockEditorRaw")().trim();
}

function txWorkflowEditorRaw() {
  return runtimeFunction("txWorkflowEditorRaw")().trim();
}

function orchestrationEditorRaw() {
  return runtimeFunction("orchestrationEditorRaw")().trim();
}

function parseTxBlockEditorJson() {
  return runtimeFunction("parseTxBlockEditorJson")();
}

function isTemplatePanelActive(panelId) {
  const panel = byId(panelId);
  if (!panel) return false;
  return !panel.hidden && panel.style.display !== "none";
}

export function txBlockExecutionPayload({ dryRun, mode }) {
  const templateMode = mode === "template";
  if (templateMode) {
    const content = txBlockEditorRaw();
    if (!content) {
      throw new Error(tr("txBlockJsonRequired"));
    }
    return {
      tx_block: null,
      tx_block_template_name: null,
      tx_block_template_content: content,
      tx_block_template_vars: parseJsonById("tx-block-template-vars"),
      dry_run: dryRun,
      connection: connectionPayload(),
      record_level: recordLevelPayload(),
    };
  }
  return {
    tx_block: parseTxBlockEditorJson(),
    tx_block_template_name: null,
    tx_block_template_content: null,
    tx_block_template_vars: parseJsonById("tx-block-direct-vars"),
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

export function txWorkflowExecutionPayload({ dryRun }) {
  const templateMode = isTemplatePanelActive("tx-workflow-view-template-panel");
  const workflowTemplateName = templateMode
    ? byId("tx-workflow-template-name").value.trim()
    : "";
  const raw = templateMode ? "" : txWorkflowEditorRaw();
  if (templateMode && !workflowTemplateName) {
    throw new Error(tr("txWorkflowTemplateNameRequired"));
  }
  if (!templateMode && !raw) {
    throw new Error(tr("txWorkflowJsonRequired"));
  }
  return {
    workflow_template_name: workflowTemplateName || null,
    workflow_template_content: null,
    workflow: raw ? JSON.parse(raw) : {},
    workflow_vars: parseJsonById(
      templateMode ? "tx-workflow-template-vars-json" : "tx-workflow-vars-json",
    ),
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

export function orchestrationExecutionPayload({ dryRun }) {
  const templateMode = isTemplatePanelActive(
    "orchestration-view-template-panel",
  );
  const planTemplateName = templateMode
    ? byId("orchestration-template-name").value.trim()
    : "";
  const raw = templateMode ? "" : orchestrationEditorRaw();
  if (templateMode && !planTemplateName) {
    throw new Error(tr("orchestrationTemplateNameRequired"));
  }
  if (!templateMode && !raw) {
    throw new Error(tr("orchestrationJsonRequired"));
  }
  return {
    plan_template_name: planTemplateName || null,
    plan_template_content: null,
    plan: raw ? JSON.parse(raw) : {},
    plan_vars: parseJsonById(
      templateMode
        ? "orchestration-template-vars-json"
        : "orchestration-vars-json",
    ),
    base_dir: null,
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}
