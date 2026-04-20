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

function applyTxBlockTemplatePayloadToEditor(payload) {
  setTxBlockEditorJson(payload);
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

function txWorkflowAvailableModes() {
  const profileName = safeString(byId("device_profile")?.value || "").trim() || "linux";
  const profileModes = cachedProfileModes.get(profileName);
  const fromProfileCache = Array.isArray(profileModes?.modes)
    ? profileModes.modes
        .map((mode) => safeString(mode || "").trim())
        .filter((mode) => !!mode)
    : [];
  if (fromProfileCache.length) return fromProfileCache;

  return ["User"];
}

function txWorkflowBlockTemplateVarsObject(block, indexForError) {
  const raw = safeString(block && block.txBlockTemplateVarsText).trim();
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `${t("txWorkflowBlockTemplateVarsInvalid")} [block ${
        indexForError + 1
      }]: ${err.message}`
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `${t("txWorkflowBlockTemplateVarsInvalid")} [block ${indexForError + 1}]`
    );
  }
  return parsed;
}

function txWorkflowEditingBlock() {
  if (!txWorkflowEditingBlockId) return null;
  return txWorkflowBlocks.find((block) => block.id === txWorkflowEditingBlockId) || null;
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
  if (currentTxStage === "workflow") {
    const modal = byId("tx-workflow-editor-modal");
    const modalVisible =
      txWorkflowEditorModalOpen &&
      !!modal &&
      (modal.open === true || modal.classList.contains("modal-open"));
    if (modalVisible) {
      mountTxSharedEditorTo("tx-shared-editor-workflow-host");
    } else {
      section.hidden = true;
      section.style.display = "none";
    }
    return;
  }
  if (currentTxStage === "block") {
    mountTxSharedEditorTo("tx-shared-editor-block-host");
    return;
  }
  section.hidden = true;
  section.style.display = "none";
}

function showTxWorkflowEditorModal() {
  const modal = byId("tx-workflow-editor-modal");
  if (!modal) return;
  if (typeof modal.showModal === "function") {
    if (!modal.open) {
      modal.showModal();
    }
  } else {
    modal.classList.add("modal-open");
  }
  txWorkflowEditorModalOpen = true;
  syncTxSharedEditorMount();
  renderTxWorkflowEditorBridge();
}

function hideTxWorkflowEditorModal({ clearSelection = false, rerender = true } = {}) {
  const modal = byId("tx-workflow-editor-modal");
  txWorkflowEditorModalOpen = false;
  if (modal) {
    if (typeof modal.close === "function" && modal.open) {
      modal.close();
    }
    modal.classList.remove("modal-open");
  }
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

function clearTxWorkflowEditorBridge() {
  hideTxWorkflowEditorModal({ clearSelection: true });
}

function renderTxWorkflowEditorBridge() {
  const item = txWorkflowEditingBlock();
  const title = byId("tx-workflow-editor-bridge-title");
  const current = byId("tx-workflow-editor-current");
  const cancelBtn = byId("tx-workflow-editor-cancel-btn");
  if (title) {
    title.textContent = t("txWorkflowEditorBridgeTitle");
  }
  if (cancelBtn) {
    cancelBtn.disabled = !item;
  }
  if (!current) return;
  if (!item) {
    current.textContent = t("txWorkflowEditorBridgeNoTarget");
    return;
  }
  const blockIndex = txWorkflowBlocks.findIndex((block) => block.id === item.id) + 1;
  const blockName = safeString(item.name || "").trim() || "tx-block";
  if (title) {
    title.textContent = `${t("txWorkflowEditorBridgeTitle")} #${blockIndex}`;
  }
  current.textContent = `${blockName} · ${t("txWorkflowSummarySource")}: ${
    item.sourceKind === "tx_block_template"
      ? t("txWorkflowBlockSourceTemplate")
      : t("txWorkflowBlockSourceDirect")
  }`;
}

async function loadTxWorkflowBlockIntoEditor(item) {
  if (!item) return;
  suppressTxWorkflowEditorSync = true;
  if (item.sourceKind === "tx_block_template") {
    txBlockViewMode = "template";
    applyTxBlockViewMode();
    ensureSelectValue("tx-block-template-name", item.txBlockTemplateName || "");
    byId("tx-block-template-vars").value = item.txBlockTemplateVarsText || "{}";
    txVarsAssistantSyncFromTextarea("tx-block-template-vars", { silent: true });
    if (item.txBlockTemplateName) {
      await loadSelectedTxBlockTemplateForExecution();
    }
  } else {
    txBlockViewMode = "direct";
    applyTxBlockViewMode();
    applyTxBlockTemplatePayloadToEditor(
      item.txBlockJsonText ? JSON.parse(item.txBlockJsonText) : defaultTxBlockTemplatePayload()
    );
  }
  suppressTxWorkflowEditorSync = false;
}

async function startTxWorkflowBlockEditor(blockId) {
  const item = txWorkflowBlocks.find((block) => block.id === blockId);
  if (!item) return;
  txWorkflowEditingBlockId = blockId;
  await loadTxWorkflowBlockIntoEditor(item);
  showTxWorkflowEditorModal();
  renderTxWorkflowBuilder();
  setStatusMessage("tx-workflow-plan-out", t("txWorkflowEditorBridgeLoaded"), "success");
}

function applyTxEditorToWorkflowBlock({ silent = false } = {}) {
  const item = txWorkflowEditingBlock();
  if (!item) {
    if (!silent) {
      setStatusMessage("tx-workflow-plan-out", t("txWorkflowEditorBridgeNoTarget"), "error");
    }
    return;
  }
  if (txBlockViewMode === "template") {
    const templateName = safeString(byId("tx-block-template-name")?.value || "").trim();
    if (!templateName) {
      if (!silent) {
        setStatusMessage(
          "tx-workflow-plan-out",
          t("txWorkflowBlockTemplateNameRequired"),
          "error"
        );
      }
      return;
    }
    item.sourceKind = "tx_block_template";
    item.txBlockTemplateName = templateName;
    item.txBlockTemplateVarsText =
      safeString(byId("tx-block-template-vars")?.value || "").trim() || "{}";
    sanitizeTxWorkflowBlock(item);
    renderTxWorkflowBuilder();
    if (!silent) {
      setStatusMessage("tx-workflow-plan-out", t("txWorkflowEditorBridgeApplied"), "success");
    }
    return;
  }

  const payload = buildTxBlockTemplatePayloadFromEditor();
  item.sourceKind = "direct";
  item.txBlockJsonText = JSON.stringify(payload, null, 2);
  item.name = safeString(payload.name || "").trim() || item.name || "";
  item.failFast = payload.fail_fast !== false;
  sanitizeTxWorkflowBlock(item);
  renderTxWorkflowBuilder();
  if (!silent) {
    setStatusMessage("tx-workflow-plan-out", t("txWorkflowEditorBridgeApplied"), "success");
  }
}

function syncSelectedTxWorkflowBlockFromEditor() {
  if (suppressTxWorkflowEditorSync) return;
  if (currentTxStage !== "workflow") return;
  if (!txWorkflowEditingBlockId) return;
  applyTxEditorToWorkflowBlock({ silent: true });
}

function renderTxWorkflowBuilder() {
  const wrap = byId("tx-workflow-blocks");
  if (!wrap) return;
  txWorkflowBlocks.forEach((block) => sanitizeTxWorkflowBlock(block));
  if (
    txWorkflowEditingBlockId &&
    !txWorkflowBlocks.some((block) => block.id === txWorkflowEditingBlockId)
  ) {
    txWorkflowEditingBlockId = "";
  }
  syncTxSharedEditorMount();
  if (!txWorkflowBlocks.length) {
    wrap.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowBuilderEmpty")
    )}</div>`;
    renderTxWorkflowEditorBridge();
    return;
  }
  const filteredBlocks = getFilteredTxWorkflowBlocks();
  if (!filteredBlocks.length) {
    wrap.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowFilterNoMatch")
    )}</div>`;
    renderTxWorkflowEditorBridge();
    return;
  }
  wrap.innerHTML = filteredBlocks
    .map(
      (block) => {
        const fullIdx = txWorkflowBlocks.findIndex((b) => b.id === block.id);
        const editing = txWorkflowEditingBlockId === block.id;
        const summary = txWorkflowBlockSummary(block);
        const sourceKind = summary.sourceKind;
        const templateName = summary.templateName;
        const modeText = summary.modeText;
        const rollbackText = summary.rollbackText;
        const rollbackPreview = summary.rollbackPreview;
        const commandsList = summary.commandsList;
        const commandCount = summary.commandCount;
        return `
      <div class="group-card ${
        editing ? "border-cyan-300 bg-cyan-50/40" : ""
      } js-tx-workflow-select-block cursor-pointer" data-tx-block-id="${escapeHtml(
        block.id
      )}" aria-selected="${editing ? "true" : "false"}">
        <div class="field-tools">
          <div class="grid gap-1">
            <span>#${fullIdx + 1}</span>
            <div class="inline-flex flex-wrap items-center gap-1">
              <span class="tx-workflow-chip">${escapeHtml(t("txWorkflowSummarySource"))}: ${escapeHtml(
                sourceKind === "tx_block_template"
                  ? t("txWorkflowBlockSourceTemplate")
                  : t("txWorkflowBlockSourceDirect")
              )}</span>
              ${
                sourceKind === "tx_block_template"
                  ? `<span class="tx-workflow-chip">${escapeHtml(
                      t("txWorkflowSummaryTemplate")
                    )}: ${escapeHtml(templateName || "-")}</span>`
                  : `<span class="tx-workflow-chip">${escapeHtml(
                      t("txWorkflowSummaryCommands")
                    )}: ${commandCount}</span>
              <span class="tx-workflow-chip">${escapeHtml(
                t("txWorkflowSummaryMode")
              )}: ${escapeHtml(modeText)}</span>
              <span class="tx-workflow-chip">${escapeHtml(
                t("txWorkflowSummaryRollback")
              )}: ${escapeHtml(rollbackText)}</span>`
              }
            </div>
          </div>
          <div class="inline-flex items-center gap-2">
            <button type="button" data-workflow-action="true" class="mini-btn js-tx-workflow-edit-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(t("txWorkflowEditWithTxEditorBtn"))}</button>
            <button type="button" data-workflow-action="true" class="mini-btn js-tx-workflow-toggle-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(block.collapsed ? t("expand") : t("collapse"))}</button>
            <button type="button" data-workflow-action="true" class="mini-btn js-tx-workflow-drag-block" data-tx-block-id="${escapeHtml(
              block.id
            )}" draggable="true">${escapeHtml(t("txWorkflowDragBtn"))}</button>
            <button type="button" data-workflow-action="true" class="mini-btn js-tx-workflow-move-up-block" data-tx-block-id="${escapeHtml(
              block.id
            )}" ${fullIdx === 0 ? "disabled" : ""}>${escapeHtml(t("txWorkflowMoveUpBtn"))}</button>
            <button type="button" data-workflow-action="true" class="mini-btn js-tx-workflow-move-down-block" data-tx-block-id="${escapeHtml(
              block.id
            )}" ${fullIdx === txWorkflowBlocks.length - 1 ? "disabled" : ""}>${escapeHtml(
        t("txWorkflowMoveDownBtn")
      )}</button>
            <button type="button" data-workflow-action="true" class="mini-btn js-tx-workflow-copy-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(t("txWorkflowCopyBlockBtn"))}</button>
            <button type="button" data-workflow-action="true" class="mini-btn delete js-tx-workflow-delete-block" data-tx-block-id="${escapeHtml(
              block.id
            )}">${escapeHtml(t("txWorkflowDeleteBlockBtn"))}</button>
          </div>
        </div>
        <div class="group-body grid gap-2" ${block.collapsed ? "hidden" : ""}>
          <div class="grid gap-2">
            <div class="text-sm font-semibold text-slate-700">${escapeHtml(
              summary.displayName || `tx-block-${fullIdx + 1}`
            )}</div>
            ${
              sourceKind === "tx_block_template"
                ? `<div class="text-xs text-slate-500">${escapeHtml(
                    t("txWorkflowTemplateRefHint")
                  )}</div>
            <pre class="output text-xs whitespace-pre-wrap break-words">${escapeHtml(
              `template: ${templateName || "-"}\nvars: ${
                safeString(block.txBlockTemplateVarsText || "").trim() || "{}"
              }`
            )}</pre>`
                : `<pre class="output text-xs whitespace-pre-wrap break-words">${escapeHtml(
                    summary.invalidMessage
                      ? summary.invalidMessage
                      : commandsList.length
                      ? commandsList.join("\n")
                      : t("txWorkflowBlockCommandsPlaceholder")
                  )}</pre>
            <pre class="output text-xs whitespace-pre-wrap break-words">${escapeHtml(
              `${t("txWorkflowSummaryRollback")}: ${rollbackText}\n${rollbackPreview}`
            )}</pre>`
            }
          </div>
        </div>
      </div>
    `;
      }
    )
    .join("");
  renderTxWorkflowEditorBridge();
}

function parseTxWorkflowDirectBlock(block) {
  const raw = safeString(block && block.txBlockJsonText).trim();
  if (!raw) {
    return { value: null, error: t("txBlockJsonRequired") };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { value: null, error: t("txBlockJsonInvalidShape") };
    }
    return { value: parsed, error: "" };
  } catch (e) {
    return { value: null, error: e && e.message ? e.message : t("requestFailed") };
  }
}

function txWorkflowRollbackValue(rollbackPolicy) {
  if (typeof rollbackPolicy === "string") {
    if (
      rollbackPolicy === "none" ||
      rollbackPolicy === "per_step" ||
      rollbackPolicy === "whole_resource"
    ) {
      return rollbackPolicy;
    }
    return "per_step";
  }
  if (
    rollbackPolicy &&
    typeof rollbackPolicy === "object" &&
    rollbackPolicy.whole_resource
  ) {
    return "whole_resource";
  }
  return "per_step";
}

function txWorkflowBlockSummary(block) {
  const sourceKind = block.sourceKind === "tx_block_template" ? "tx_block_template" : "direct";
  const templateName = safeString(block.txBlockTemplateName || "").trim();
  const fallbackName = safeString(block.name || "").trim() || "tx-block";
  if (sourceKind === "tx_block_template") {
    return {
      sourceKind,
      templateName,
      displayName: fallbackName,
      commandCount: 0,
      modeText: "-",
      rollbackValue: "per_step",
      rollbackText: "per_step",
      commandsList: [],
      rollbackList: [],
      rollbackPreview: "",
      queryText: `${fallbackName} ${templateName}`.toLowerCase(),
      invalidMessage: "",
      parsedBlock: null,
    };
  }

  const { value: parsedBlock, error } = parseTxWorkflowDirectBlock(block);
  if (!parsedBlock) {
    const invalidMessage = `${t("txWorkflowVisualInvalid")}: ${error}`;
    return {
      sourceKind,
      templateName: "",
      displayName: fallbackName,
      commandCount: 0,
      modeText: "-",
      rollbackValue: "per_step",
      rollbackText: "per_step",
      commandsList: [],
      rollbackList: [],
      rollbackPreview: invalidMessage,
      queryText: `${fallbackName} ${invalidMessage}`.toLowerCase(),
      invalidMessage,
      parsedBlock: null,
    };
  }

  const steps = Array.isArray(parsedBlock.steps) ? parsedBlock.steps : [];
  const commandsList = steps
    .map((step) => txOperationDescription(txStepRunOperation(step)))
    .filter((line) => !!safeString(line).trim());
  const rollbackList = steps
    .map((step) => txOperationDescription(txStepRollbackOperation(step)))
    .filter((line) => !!safeString(line).trim());
  const rollbackValue = txWorkflowRollbackValue(parsedBlock.rollback_policy);
  const wholeResourceOp = txWholeResourceRollbackOperation(parsedBlock.rollback_policy);
  const wholeResourceRollback = txOperationDescription(wholeResourceOp);
  const rollbackPreview =
    rollbackValue === "none"
      ? t("txWorkflowBlockRollbackNone")
      : rollbackValue === "whole_resource"
        ? safeString(wholeResourceRollback || "").trim() || t("txWorkflowBlockUndoPlaceholder")
        : rollbackList.length
          ? rollbackList.join("\n")
          : t("txWorkflowVisualNoRollback");
  const firstRun = txStepRunOperation(steps[0]);
  const modeText = txOperationMode(firstRun) || txWorkflowAvailableModes()[0] || "User";
  const displayName =
    safeString(parsedBlock.name || "").trim() || fallbackName || "tx-block";

  return {
    sourceKind,
    templateName: "",
    displayName,
    commandCount: steps.length,
    modeText,
    rollbackValue,
    rollbackText: rollbackValue,
    commandsList,
    rollbackList,
    rollbackPreview,
    queryText: `${displayName} ${commandsList.join(" ")}`.toLowerCase(),
    invalidMessage: "",
    parsedBlock,
  };
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

function autoScrollDuringDrag(event, container) {
  const y = event.clientY;
  const threshold = 96;
  const step = 22;
  if (!Number.isFinite(y)) return;

  if (container && container.scrollHeight > container.clientHeight) {
    const rect = container.getBoundingClientRect();
    if (y < rect.top + threshold) {
      container.scrollTop -= step;
      return;
    }
    if (y > rect.bottom - threshold) {
      container.scrollTop += step;
      return;
    }
  }

  const vpHeight = window.innerHeight || document.documentElement.clientHeight;
  if (y < threshold) {
    window.scrollBy(0, -step);
  } else if (y > vpHeight - threshold) {
    window.scrollBy(0, step);
  }
}

function clearTxWorkflowDropMarkers(container) {
  if (!container) return;
  container
    .querySelectorAll(
      ".tx-workflow-drop-target, .tx-workflow-drop-before, .tx-workflow-drop-after"
    )
    .forEach((el) => {
      el.classList.remove("tx-workflow-drop-target");
      el.classList.remove("tx-workflow-drop-before");
      el.classList.remove("tx-workflow-drop-after");
    });
}

function getFilteredTxWorkflowBlocks() {
  const query = txWorkflowFilterQuery.trim().toLowerCase();
  return txWorkflowBlocks.filter((block) => {
    const summary = txWorkflowBlockSummary(block);
    const rollbackOk =
      txWorkflowFilterRollback === "all" ||
      summary.rollbackValue === txWorkflowFilterRollback;
    const queryOk =
      !query ||
      summary.queryText.includes(query);
    return rollbackOk && queryOk;
  });
}

function setAllTxWorkflowBlocksCollapsed(collapsed) {
  txWorkflowBlocks.forEach((block) => {
    block.collapsed = !!collapsed;
  });
  renderTxWorkflowBuilder();
}
