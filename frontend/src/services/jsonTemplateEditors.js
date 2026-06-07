import { safeString, tr } from "./templateUi.js";

export function prettyJsonText(rawContent) {
  const text = safeString(rawContent).trim();
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch (_) {
    return text;
  }
}

export function setPrettyJsonToTextarea(id, rawContent) {
  const text = prettyJsonText(rawContent);
  if (
    id === "tx-block-json" &&
    typeof window.setTxBlockEditorRawText === "function"
  ) {
    window.setTxBlockEditorRawText(text);
    return;
  }
  if (
    id === "tx-workflow-json" &&
    typeof window.setTxWorkflowEditorText === "function"
  ) {
    window.setTxWorkflowEditorText(text, { notify: true });
    return;
  }
  if (
    id === "orchestration-json" &&
    typeof window.setOrchestrationEditorText === "function"
  ) {
    window.setOrchestrationEditorText(text, { notify: true });
    return;
  }
  const textarea = document.getElementById(id);
  if (textarea) {
    textarea.value = text;
  }
}

export function editorRaw(id) {
  if (
    id === "tx-workflow-json" &&
    typeof window.txWorkflowEditorRaw === "function"
  ) {
    return window.txWorkflowEditorRaw().trim();
  }
  if (
    id === "orchestration-json" &&
    typeof window.orchestrationEditorRaw === "function"
  ) {
    return window.orchestrationEditorRaw().trim();
  }
  if (id === "tx-block-json" && typeof window.txBlockEditorRaw === "function") {
    return window.txBlockEditorRaw().trim();
  }
  return (document.getElementById(id)?.value || "").trim();
}

export function switchTxViewMode(kind) {
  window.setTxRuntimeViewModes?.({
    txBlock: kind === "tx_block" ? "template" : undefined,
    txWorkflow: kind === "tx_workflow" ? "template" : undefined,
    orchestration: kind === "orchestration" ? "template" : undefined,
  });
  if (kind === "tx_block") window.applyTxBlockViewMode?.();
  if (kind === "tx_workflow") window.applyTxWorkflowViewMode?.();
  if (kind === "orchestration") window.applyOrchestrationViewMode?.();
}

export function normalizeJsonEditorContent(id, requiredKey) {
  const raw = editorRaw(id);
  if (!raw) {
    throw new Error(tr(requiredKey));
  }
  const normalized = JSON.stringify(JSON.parse(raw), null, 2);
  setPrettyJsonToTextarea(id, normalized);
  return normalized;
}
