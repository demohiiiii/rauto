let txWorkflowBlockSeq = 0;

import { byId } from "./runtimeGlobals.js";

function safeString(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function defaultTxBlockPayload() {
  return typeof window.defaultTxBlockTemplatePayload === "function"
    ? window.defaultTxBlockTemplatePayload()
    : {};
}

function currentTxStage() {
  return window.currentTxStage || "block";
}

export function installTxRuntimeBridge() {
  window.buildTxBlockTemplatePayloadFromEditor =
    function buildTxBlockTemplatePayloadFromEditor() {
      if (typeof window.parseTxBlockEditorJson !== "function") {
        throw new Error("parseTxBlockEditorJson is not ready");
      }
      return window.parseTxBlockEditorJson();
    };

  window.createTxWorkflowBlock = function createTxWorkflowBlock(seed = {}) {
    txWorkflowBlockSeq += 1;
    const sourceKind =
      seed.sourceKind === "tx_block_template" ? "tx_block_template" : "direct";
    const block = {
      id: `tx-block-${txWorkflowBlockSeq}`,
      name: seed.name || "",
      sourceKind,
      txBlockTemplateName: seed.txBlockTemplateName || "",
      txBlockTemplateVarsText:
        seed.txBlockTemplateVarsText != null
          ? String(seed.txBlockTemplateVarsText)
          : JSON.stringify(seed.txBlockTemplateVars || {}, null, 2),
      txBlockJsonText:
        seed.txBlockJsonText != null && String(seed.txBlockJsonText).trim()
          ? String(seed.txBlockJsonText)
          : JSON.stringify(defaultTxBlockPayload(), null, 2),
      failFast: seed.failFast !== false,
      collapsed: seed.collapsed === true,
    };
    return window.sanitizeTxWorkflowBlock(block);
  };

  window.sanitizeTxWorkflowBlock = function sanitizeTxWorkflowBlock(block) {
    if (!block || typeof block !== "object") return block;
    block.sourceKind =
      block.sourceKind === "tx_block_template" ? "tx_block_template" : "direct";
    if (
      block.txBlockTemplateVarsText == null ||
      block.txBlockTemplateVarsText === ""
    ) {
      block.txBlockTemplateVarsText = "{}";
    }
    if (
      block.txBlockJsonText == null ||
      String(block.txBlockJsonText).trim() === ""
    ) {
      block.txBlockJsonText = JSON.stringify(defaultTxBlockPayload(), null, 2);
    }
    block.name = safeString(block.name || "").trim();
    return block;
  };

  window.mountTxSharedEditorTo = function mountTxSharedEditorTo(containerId) {
    const section = byId("tx-shared-editor-section");
    const host = byId(containerId);
    if (!section || !host) return;
    if (section.parentElement !== host) {
      host.appendChild(section);
    }
    section.hidden = false;
    section.style.display = "";
    window.resizeTxBlockJsonEditor?.();
  };

  window.syncTxSharedEditorMount = function syncTxSharedEditorMount() {
    const section = byId("tx-shared-editor-section");
    if (!section) return;
    if (currentTxStage() === "block") {
      window.mountTxSharedEditorTo("tx-shared-editor-block-host");
      return;
    }
    section.hidden = true;
    section.style.display = "none";
  };

  window.hideTxWorkflowEditorModal = function hideTxWorkflowEditorModal() {
    window.syncTxSharedEditorMount();
    window.renderTxWorkflowBuilder();
  };

  window.renderTxWorkflowEditorBridge =
    function renderTxWorkflowEditorBridge() {
      // The tx workflow builder bridge UI has been removed; keep this stable as a no-op.
    };

  window.renderTxWorkflowBuilder = function renderTxWorkflowBuilder() {
    window.syncTxSharedEditorMount();
    window.renderTxWorkflowEditorBridge();
  };

  window.txStepRunOperation = function txStepRunOperation(step) {
    if (!step || typeof step !== "object") return null;
    return step.run && typeof step.run === "object" ? step.run : null;
  };

  window.txStepRollbackOperation = function txStepRollbackOperation(step) {
    if (!step || typeof step !== "object") return null;
    return step.rollback && typeof step.rollback === "object"
      ? step.rollback
      : null;
  };

  window.txWholeResourceRollbackOperation =
    function txWholeResourceRollbackOperation(rollbackPolicy) {
      if (!rollbackPolicy || typeof rollbackPolicy !== "object") return null;
      const wholeResource = rollbackPolicy.whole_resource;
      if (!wholeResource || typeof wholeResource !== "object") return null;
      return wholeResource.rollback &&
        typeof wholeResource.rollback === "object"
        ? wholeResource.rollback
        : null;
    };

  window.txOperationMode = function txOperationMode(operation) {
    if (!operation || typeof operation !== "object") return "";
    if (typeof operation.mode === "string") return operation.mode.trim();
    if (operation.kind === "flow") {
      const steps = Array.isArray(operation.steps) ? operation.steps : [];
      return safeString(steps[0]?.mode).trim();
    }
    if (operation.kind === "template") {
      return safeString(operation.runtime?.default_mode).trim();
    }
    return "";
  };

  window.txOperationTimeoutSeconds = function txOperationTimeoutSeconds(
    operation,
  ) {
    if (!operation || typeof operation !== "object") return null;
    if (operation.timeout != null && String(operation.timeout).trim()) {
      return Number(operation.timeout);
    }
    if (operation.kind === "flow") {
      const steps = Array.isArray(operation.steps) ? operation.steps : [];
      return steps[0]?.timeout != null ? Number(steps[0].timeout) : null;
    }
    return null;
  };

  window.txOperationDescription = function txOperationDescription(operation) {
    if (!operation || typeof operation !== "object") return "";
    if (operation.kind === "command" || operation.command != null) {
      return safeString(operation.command).trim();
    }
    if (operation.kind === "flow") {
      const steps = Array.isArray(operation.steps) ? operation.steps : [];
      const first = safeString(steps[0]?.command).trim();
      if (!steps.length) return "flow";
      if (steps.length === 1) return first || "flow";
      return first
        ? `${first} ... (${steps.length} steps)`
        : `${steps.length} steps`;
    }
    if (operation.kind === "template") {
      const templateName = safeString(operation.template?.name).trim();
      const runtimeMode = safeString(operation.runtime?.default_mode).trim();
      if (templateName && runtimeMode)
        return `${templateName} (${runtimeMode})`;
      return templateName || "template";
    }
    return "";
  };
}
