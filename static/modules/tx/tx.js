/**
 * tx.js — tx
 */

function txPayload(dryRun) {
  const templateMode = txBlockViewMode === "template";
  if (templateMode) {
    const content = txBlockEditorRaw().trim();
    if (!content) {
      throw new Error(t("txBlockJsonRequired"));
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

function buildTxBlockTemplatePayloadFromEditor() {
  return parseTxBlockEditorJson();
}

function txWorkflowPayload(dryRun) {
  const templateMode = txWorkflowViewMode === "template";
  const workflowTemplateName = templateMode
    ? byId("tx-workflow-template-name").value.trim()
    : "";
  const raw = templateMode ? "" : txWorkflowEditorRaw().trim();
  if (templateMode && !workflowTemplateName) {
    throw new Error(t("txWorkflowTemplateNameRequired"));
  }
  if (!templateMode && !raw) {
    throw new Error(t("txWorkflowJsonRequired"));
  }
  return {
    workflow_template_name: workflowTemplateName || null,
    workflow_template_content: null,
    workflow: raw ? JSON.parse(raw) : {},
    workflow_vars: parseJsonById(
      templateMode ? "tx-workflow-template-vars-json" : "tx-workflow-vars-json"
    ),
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

function orchestrationPayload(dryRun) {
  const templateMode = orchestrationViewMode === "template";
  const planTemplateName = templateMode
    ? byId("orchestration-template-name").value.trim()
    : "";
  const raw = templateMode ? "" : orchestrationEditorRaw().trim();
  if (templateMode && !planTemplateName) {
    throw new Error(t("orchestrationTemplateNameRequired"));
  }
  if (!templateMode && !raw) {
    throw new Error(t("orchestrationJsonRequired"));
  }
  return {
    plan_template_name: planTemplateName || null,
    plan_template_content: null,
    plan: raw ? JSON.parse(raw) : {},
    plan_vars: parseJsonById(
      templateMode ? "orchestration-template-vars-json" : "orchestration-vars-json"
    ),
    base_dir: null,
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

function createTxWorkflowBlock(seed = {}) {
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
        : JSON.stringify(defaultTxBlockTemplatePayload(), null, 2),
    failFast: seed.failFast !== false,
    collapsed: seed.collapsed === true,
  };
  return sanitizeTxWorkflowBlock(block);
}

function sanitizeTxWorkflowBlock(block) {
  if (!block || typeof block !== "object") return block;
  block.sourceKind =
    block.sourceKind === "tx_block_template" ? "tx_block_template" : "direct";
  if (block.txBlockTemplateVarsText == null || block.txBlockTemplateVarsText === "") {
    block.txBlockTemplateVarsText = "{}";
  }
  if (block.txBlockJsonText == null || String(block.txBlockJsonText).trim() === "") {
    block.txBlockJsonText = JSON.stringify(defaultTxBlockTemplatePayload(), null, 2);
  }
  block.name = safeString(block.name || "").trim();
  return block;
}

function mountTxSharedEditorTo(containerId) {
  const section = byId("tx-shared-editor-section");
  const host = byId(containerId);
  if (!section || !host) return;
  if (section.parentElement !== host) {
    host.appendChild(section);
  }
  section.hidden = false;
  section.style.display = "";
  resizeTxBlockJsonEditor();
}

function syncTxSharedEditorMount() {
  const section = byId("tx-shared-editor-section");
  if (!section) return;
  if (currentTxStage === "block") {
    mountTxSharedEditorTo("tx-shared-editor-block-host");
    return;
  }
  section.hidden = true;
  section.style.display = "none";
}

function hideTxWorkflowEditorModal({ clearSelection = false, rerender = true } = {}) {
  txWorkflowEditorModalOpen = false;
  if (clearSelection) {
    txWorkflowEditingBlockId = "";
  }
  syncTxSharedEditorMount();
  if (rerender) {
    renderTxWorkflowBuilder();
  } else {
    renderTxWorkflowEditorBridge();
  }
}

function renderTxWorkflowEditorBridge() {
  // tx workflow builder bridge UI has been removed from index.html.
  // Keep this function as a no-op entrypoint to avoid dangling callers.
}

function renderTxWorkflowBuilder() {
  txWorkflowBlocks.forEach((block) => sanitizeTxWorkflowBlock(block));
  if (
    txWorkflowEditingBlockId &&
    !txWorkflowBlocks.some((block) => block.id === txWorkflowEditingBlockId)
  ) {
    txWorkflowEditingBlockId = "";
  }
  syncTxSharedEditorMount();
  renderTxWorkflowEditorBridge();
}

function txStepRunOperation(step) {
  if (!step || typeof step !== "object") return null;
  return step.run && typeof step.run === "object" ? step.run : null;
}

function txStepRollbackOperation(step) {
  if (!step || typeof step !== "object") return null;
  return step.rollback && typeof step.rollback === "object" ? step.rollback : null;
}

function txWholeResourceRollbackOperation(rollbackPolicy) {
  if (!rollbackPolicy || typeof rollbackPolicy !== "object") return null;
  const wholeResource = rollbackPolicy.whole_resource;
  if (!wholeResource || typeof wholeResource !== "object") return null;
  return wholeResource.rollback && typeof wholeResource.rollback === "object"
    ? wholeResource.rollback
    : null;
}

function txOperationMode(operation) {
  if (!operation || typeof operation !== "object") return "";
  if (typeof operation.mode === "string") return operation.mode.trim();
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    return safeString(steps[0] && steps[0].mode).trim();
  }
  if (operation.kind === "template") {
    return safeString(operation.runtime && operation.runtime.default_mode).trim();
  }
  return "";
}

function txOperationTimeoutSeconds(operation) {
  if (!operation || typeof operation !== "object") return null;
  if (operation.timeout != null && String(operation.timeout).trim()) {
    return Number(operation.timeout);
  }
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    return steps[0] && steps[0].timeout != null ? Number(steps[0].timeout) : null;
  }
  return null;
}

function txOperationDescription(operation) {
  if (!operation || typeof operation !== "object") return "";
  if (operation.kind === "command" || operation.command != null) {
    return safeString(operation.command).trim();
  }
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    const first = safeString(steps[0] && steps[0].command).trim();
    if (!steps.length) return "flow";
    if (steps.length === 1) return first || "flow";
    return first ? `${first} ... (${steps.length} steps)` : `${steps.length} steps`;
  }
  if (operation.kind === "template") {
    const templateName = safeString(operation.template && operation.template.name).trim();
    const runtimeMode = safeString(
      operation.runtime && operation.runtime.default_mode
    ).trim();
    if (templateName && runtimeMode) return `${templateName} (${runtimeMode})`;
    return templateName || "template";
  }
  return "";
}
