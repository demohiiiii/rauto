/**
 * tx.js — tx
 */

function txPayload(dryRun) {
  const timeoutRaw = byId("tx-timeout-secs").value.trim();
  const timeout = timeoutRaw ? Number(timeoutRaw) : null;
  const templateMode = txBlockViewMode === "template";
  const txBlockTemplateName = templateMode
    ? byId("tx-block-template-name").value.trim() || null
    : null;
  const txBlockTemplateVars = templateMode
    ? parseJsonById("tx-block-template-vars")
    : {};
  if (currentTxBlockRunKind === "flow") {
    return {
      name: byId("tx-name").value.trim() || null,
      tx_block_template_name: txBlockTemplateName,
      tx_block_template_content: null,
      tx_block_template_vars: txBlockTemplateVars,
      run_kind: "command-flow",
      flow_template_name: byId("tx-flow-template-name").value.trim() || null,
      flow_vars: parseJsonById("tx-flow-vars"),
      rollback_flow_template_name:
        byId("tx-rollback-flow-template-name").value.trim() || null,
      rollback_flow_vars: parseJsonById("tx-rollback-flow-vars"),
      mode: byId("tx-flow-mode").value.trim() || null,
      timeout_secs: Number.isFinite(timeout) && timeout > 0 ? timeout : null,
      rollback_on_failure: byId("tx-flow-rollback-on-failure").checked,
      dry_run: dryRun,
      connection: connectionPayload(),
      record_level: recordLevelPayload(),
    };
  }
  const rollbackMode = byId("tx-rollback-mode").value || "per_step";
  return {
    name: byId("tx-name").value.trim() || null,
    tx_block_template_name: txBlockTemplateName,
    tx_block_template_content: null,
    tx_block_template_vars: txBlockTemplateVars,
    run_kind: "commands",
    template: byId("tx-template").value.trim() || null,
    vars: parseJsonById("tx-vars"),
    commands: parseTxCommands(),
    rollback_mode: rollbackMode,
    mode: byId("tx-mode").value.trim() || null,
    timeout_secs: Number.isFinite(timeout) && timeout > 0 ? timeout : null,
    resource_rollback_command:
      rollbackMode === "whole_resource"
        ? byId("tx-resource-rollback").value.trim() || null
        : null,
    rollback_on_failure:
      rollbackMode === "per_step"
        ? byId("tx-rollback-on-failure").checked
        : false,
    rollback_trigger_step_index:
      rollbackMode === "whole_resource"
        ? Number(byId("tx-rollback-trigger-step").value || 0)
        : null,
    rollback_commands:
      rollbackMode === "per_step"
        ? parseRollbackLinesRaw(byId("tx-rollback-commands").value || "")
        : [],
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

function buildTxBlockTemplatePayloadFromEditor() {
  const timeoutRaw = byId("tx-timeout-secs").value.trim();
  const timeout = timeoutRaw ? Number(timeoutRaw) : null;
  if (currentTxBlockRunKind === "flow") {
    return {
      name: byId("tx-name").value.trim() || null,
      run_kind: "command-flow",
      flow_template_name: byId("tx-flow-template-name").value.trim() || null,
      flow_vars: parseJsonById("tx-flow-vars"),
      rollback_flow_template_name:
        byId("tx-rollback-flow-template-name").value.trim() || null,
      rollback_flow_vars: parseJsonById("tx-rollback-flow-vars"),
      mode: byId("tx-flow-mode").value.trim() || null,
      timeout_secs: Number.isFinite(timeout) && timeout > 0 ? timeout : null,
      rollback_on_failure: byId("tx-flow-rollback-on-failure").checked,
    };
  }
  const rollbackMode = byId("tx-rollback-mode").value || "per_step";
  return {
    name: byId("tx-name").value.trim() || null,
    run_kind: "commands",
    template: byId("tx-template").value.trim() || null,
    vars: parseJsonById("tx-vars"),
    commands: parseTxCommands(),
    rollback_mode: rollbackMode,
    mode: byId("tx-mode").value.trim() || null,
    timeout_secs: Number.isFinite(timeout) && timeout > 0 ? timeout : null,
    resource_rollback_command:
      rollbackMode === "whole_resource"
        ? byId("tx-resource-rollback").value.trim() || null
        : null,
    rollback_on_failure:
      rollbackMode === "per_step"
        ? byId("tx-rollback-on-failure").checked
        : false,
    rollback_trigger_step_index:
      rollbackMode === "whole_resource"
        ? Number(byId("tx-rollback-trigger-step").value || 0)
        : null,
    rollback_commands:
      rollbackMode === "per_step"
        ? parseRollbackLinesRaw(byId("tx-rollback-commands").value || "")
        : [],
  };
}

function applyTxBlockTemplatePayloadToEditor(payload) {
  const data = payload && typeof payload === "object" ? payload : {};
  const asInput = (value) => (value == null ? "" : String(value));
  const runKind = String(data.run_kind || "").trim() === "command-flow" ? "flow" : "commands";
  currentTxBlockRunKind = runKind;
  applyTxBlockRunKind();
  byId("tx-name").value = asInput(data.name);
  byId("tx-timeout-secs").value =
    data.timeout_secs != null && data.timeout_secs !== ""
      ? String(data.timeout_secs)
      : "";

  if (runKind === "flow") {
    byId("tx-flow-template-name").value = data.flow_template_name || "";
    byId("tx-flow-vars").value = JSON.stringify(data.flow_vars || {}, null, 2);
    byId("tx-rollback-flow-template-name").value =
      data.rollback_flow_template_name || "";
    byId("tx-rollback-flow-vars").value = JSON.stringify(
      data.rollback_flow_vars || {},
      null,
      2
    );
    byId("tx-flow-mode").value = data.mode || "";
    byId("tx-flow-rollback-on-failure").checked = !!data.rollback_on_failure;
    return;
  }

  byId("tx-template").value = data.template || "";
  byId("tx-vars").value = JSON.stringify(data.vars || {}, null, 2);
  byId("tx-commands").value = Array.isArray(data.commands)
    ? data.commands.join("\n")
    : "";
  byId("tx-mode").value = data.mode || "";
  const rollbackMode =
    data.rollback_mode ||
    (data.resource_rollback_command ? "whole_resource" : "per_step");
  byId("tx-rollback-mode").value = rollbackMode;
  byId("tx-resource-rollback").value = data.resource_rollback_command || "";
  byId("tx-rollback-trigger-step").value =
    data.rollback_trigger_step_index != null
      ? String(data.rollback_trigger_step_index)
      : "";
  byId("tx-rollback-on-failure").checked = !!data.rollback_on_failure;
  byId("tx-rollback-commands").value = Array.isArray(data.rollback_commands)
    ? data.rollback_commands.join("\n")
    : "";
  applyTxRollbackMode();
  renderTxRollbackPairs();
}

function txWorkflowPayload(dryRun) {
  const templateMode = txWorkflowViewMode === "template";
  const workflowTemplateName = templateMode
    ? byId("tx-workflow-template-name").value.trim()
    : "";
  const raw = templateMode ? "" : byId("tx-workflow-json").value.trim();
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
  const planTemplateName = byId("orchestration-template-name").value.trim();
  const raw = byId("orchestration-json").value.trim();
  if (!raw && !planTemplateName) {
    throw new Error(t("orchestrationJsonRequired"));
  }
  return {
    plan_template_name: planTemplateName || null,
    plan_template_content: null,
    plan: raw ? JSON.parse(raw) : {},
    plan_vars: parseJsonById("orchestration-vars-json"),
    base_dir: byId("orchestration-base-dir").value.trim() || null,
    dry_run: dryRun,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

function orchestrationInventoryGroupNames() {
  return getMultiSelectValues("orchestration-inventory-groups");
}

function orchestrationInventoryConnectionNames() {
  return getMultiSelectValues("orchestration-inventory-hosts");
}

function orchestrationInventoryLabelNames() {
  return getMultiSelectValues("orchestration-inventory-labels");
}

function buildOrchestrationTargetFromSavedConnection(connection) {
  if (!connection || typeof connection !== "object") return null;
  const target = {};
  if (connection.name) target.name = connection.name;
  if (connection.name) target.connection = connection.name;
  if (connection.host) target.host = connection.host;
  if (connection.username) target.username = connection.username;
  if (connection.port != null) target.port = Number(connection.port);
  if (connection.ssh_security) target.ssh_security = connection.ssh_security;
  if (connection.linux_shell_flavor) target.linux_shell_flavor = connection.linux_shell_flavor;
  if (connection.device_profile) target.device_profile = connection.device_profile;
  if (
    connection.vars &&
    typeof connection.vars === "object" &&
    !Array.isArray(connection.vars)
  ) {
    target.vars = connection.vars;
  }
  return Object.keys(target).length ? target : null;
}

function findSavedConnectionByName(name) {
  const normalized = safeString(name || "").trim();
  if (!normalized) return null;
  return (cachedSavedConnections || []).find((item) => item.name === normalized) || null;
}

function buildOrchestrationInventoryGroupsFromSelection() {
  const groupsMap = {};
  const selectedGroupNames = orchestrationInventoryGroupNames();
  const selectedConnectionNames = orchestrationInventoryConnectionNames();
  const selectedLabelNames = orchestrationInventoryLabelNames();

  for (const groupName of selectedGroupNames) {
    const group = (cachedInventoryGroups || []).find((item) => item.name === groupName);
    if (!group) continue;
    const hosts = Array.isArray(group.hosts) ? group.hosts : [];
    const targets = hosts
      .map((connectionName) => findSavedConnectionByName(connectionName))
      .map((connection) => buildOrchestrationTargetFromSavedConnection(connection))
      .filter(Boolean);
    groupsMap[groupName] = {
      defaults:
        group.vars && typeof group.vars === "object" && !Array.isArray(group.vars)
          ? { vars: group.vars }
          : {},
      targets,
    };
  }

  const standaloneConnections = selectedConnectionNames
    .filter((connectionName) => {
      return !selectedGroupNames.some((groupName) => {
        const group = (cachedInventoryGroups || []).find((item) => item.name === groupName);
        return Array.isArray(group?.hosts) && group.hosts.includes(connectionName);
      });
    })
    .map((connectionName) => findSavedConnectionByName(connectionName))
    .map((connection) => buildOrchestrationTargetFromSavedConnection(connection))
    .filter(Boolean);

  if (standaloneConnections.length) {
    groupsMap.selected_connections = {
      targets: standaloneConnections,
    };
  }

  const labelConnections = (cachedSavedConnections || [])
    .filter((connection) => {
      const labels = Array.isArray(connection?.labels) ? connection.labels : [];
      return selectedLabelNames.some((label) => labels.includes(label));
    })
    .filter((connection) => {
      const connectionName = safeString(connection?.name || "").trim();
      if (!connectionName) return false;
      if (selectedConnectionNames.includes(connectionName)) return false;
      return !selectedGroupNames.some((groupName) => {
        const group = (cachedInventoryGroups || []).find((item) => item.name === groupName);
        return Array.isArray(group?.hosts) && group.hosts.includes(connectionName);
      });
    })
    .map((connection) => buildOrchestrationTargetFromSavedConnection(connection))
    .filter(Boolean);

  if (labelConnections.length) {
    groupsMap.selected_labels = {
      targets: labelConnections,
    };
  }

  return groupsMap;
}

function buildOrchestrationInventoryPlanSkeleton(selectedGroupRefs) {
  return {
    name: "inventory-orchestration",
    fail_fast: true,
    inventory: {
      groups: buildOrchestrationInventoryGroupsFromSelection(),
    },
    stages: [
      {
        name: "stage-1",
        strategy: "serial",
        target_groups: selectedGroupRefs,
        action: {
          kind: "tx_block",
          name: "starter-block",
          commands: ["show version"],
          rollback_commands: [],
          rollback_on_failure: false,
          vars: {},
        },
      },
    ],
  };
}

function applyOrchestrationInventorySelection(mode = "merge") {
  const selectedGroupNames = orchestrationInventoryGroupNames();
  const selectedConnectionNames = orchestrationInventoryConnectionNames();
  const selectedLabelNames = orchestrationInventoryLabelNames();
  if (
    !selectedGroupNames.length &&
    !selectedConnectionNames.length &&
    !selectedLabelNames.length
  ) {
    throw new Error(t("orchestrationInventorySelectionRequired"));
  }

  const selectedGroupRefs = [...selectedGroupNames];
  if (selectedConnectionNames.length) {
    selectedGroupRefs.push("selected_connections");
  }
  if (selectedLabelNames.length) {
    selectedGroupRefs.push("selected_labels");
  }

  if (mode === "build") {
    const plan = buildOrchestrationInventoryPlanSkeleton(selectedGroupRefs);
    byId("orchestration-json").value = JSON.stringify(plan, null, 2);
    renderOrchestrationPreviewFromEditor();
    return;
  }

  const raw = byId("orchestration-json").value.trim();
  const plan = raw ? JSON.parse(raw) : { name: "inventory-orchestration", fail_fast: true, stages: [] };
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error(t("orchestrationJsonRequired"));
  }
  plan.inventory = plan.inventory && typeof plan.inventory === "object" && !Array.isArray(plan.inventory)
    ? plan.inventory
    : {};
  plan.inventory.groups =
    plan.inventory.groups &&
    typeof plan.inventory.groups === "object" &&
    !Array.isArray(plan.inventory.groups)
      ? plan.inventory.groups
      : {};
  Object.assign(plan.inventory.groups, buildOrchestrationInventoryGroupsFromSelection());

  if (Array.isArray(plan.stages) && plan.stages.length === 1) {
    const stage = plan.stages[0];
    const currentTargetGroups = Array.isArray(stage.target_groups) ? stage.target_groups : [];
    if (!currentTargetGroups.length) {
      stage.target_groups = Array.from(new Set(selectedGroupRefs));
    }
  }

  byId("orchestration-json").value = JSON.stringify(plan, null, 2);
  renderOrchestrationPreviewFromEditor();
}

function createTxWorkflowBlock(seed = {}) {
  txWorkflowBlockSeq += 1;
  const sourceKind =
    seed.sourceKind === "tx_block_template" ? "tx_block_template" : "direct";
  const currentTxMode = safeString(byId("tx-mode")?.value || "").trim();
  const fallbackMode = txWorkflowAvailableModes()[0] || "User";
  const block = {
    id: `tx-block-${txWorkflowBlockSeq}`,
    name: seed.name || "",
    sourceKind,
    txBlockTemplateName: seed.txBlockTemplateName || "",
    txBlockTemplateVarsText:
      seed.txBlockTemplateVarsText != null
        ? String(seed.txBlockTemplateVarsText)
        : JSON.stringify(seed.txBlockTemplateVars || {}, null, 2),
    rollbackPolicy: seed.rollbackPolicy || "per_step",
    mode: seed.mode || currentTxMode || fallbackMode,
    timeoutSecs: seed.timeoutSecs != null ? String(seed.timeoutSecs) : "",
    undoCommand: seed.undoCommand || "",
    commandsText: seed.commandsText || "",
    rollbackCommandsText: seed.rollbackCommandsText || "",
    failFast: seed.failFast !== false,
    collapsed: seed.collapsed === true,
    rollbackOnFailure: seed.rollbackOnFailure === true,
    triggerStepIndex:
      seed.triggerStepIndex != null && seed.triggerStepIndex !== ""
        ? String(seed.triggerStepIndex)
        : "",
  };
  return sanitizeTxWorkflowBlock(block);
}

function normalizeTxWorkflowRollbackPolicy(rollbackPolicy) {
  const policy =
    rollbackPolicy === "none" ||
    rollbackPolicy === "per_step" ||
    rollbackPolicy === "whole_resource"
      ? rollbackPolicy
      : "per_step";
  return policy;
}

function sanitizeTxWorkflowBlock(block) {
  if (!block || typeof block !== "object") return block;
  block.sourceKind =
    block.sourceKind === "tx_block_template" ? "tx_block_template" : "direct";
  if (block.txBlockTemplateVarsText == null || block.txBlockTemplateVarsText === "") {
    block.txBlockTemplateVarsText = "{}";
  }
  const availableModes = txWorkflowAvailableModes();
  const normalizedMode = safeString(block.mode || "").trim();
  block.mode = availableModes.includes(normalizedMode)
    ? normalizedMode
    : availableModes[0] || "User";
  block.rollbackPolicy = normalizeTxWorkflowRollbackPolicy(block.rollbackPolicy);
  if (block.rollbackPolicy !== "whole_resource") {
    block.triggerStepIndex =
      block.triggerStepIndex != null && block.triggerStepIndex !== ""
        ? String(block.triggerStepIndex)
        : "";
  }
  return block;
}

function txWorkflowAvailableModes() {
  const fromTxModeSelect = Array.from(byId("tx-mode")?.options || [])
    .map((opt) => safeString(opt.value || "").trim())
    .filter((mode) => !!mode);
  if (fromTxModeSelect.length) return fromTxModeSelect;

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
    if (item.txBlockTemplateName) {
      await loadSelectedTxBlockTemplateForExecution();
    }
    byId("tx-name").value = item.name || "";
  } else {
    txBlockViewMode = "direct";
    applyTxBlockViewMode();
    applyTxBlockTemplatePayloadToEditor({
      name: item.name || "",
      run_kind: "commands",
      template: null,
      vars: {},
      commands: txWorkflowLines(item.commandsText),
      rollback_mode: item.rollbackPolicy || "per_step",
      mode: item.mode || "",
      timeout_secs:
        item.timeoutSecs != null && String(item.timeoutSecs).trim()
          ? Number(item.timeoutSecs)
          : null,
      resource_rollback_command:
        item.rollbackPolicy === "whole_resource"
          ? item.undoCommand || null
          : null,
      rollback_on_failure:
        item.rollbackPolicy === "per_step" ? !!item.rollbackOnFailure : false,
      rollback_trigger_step_index:
        item.rollbackPolicy === "whole_resource" &&
        String(item.triggerStepIndex || "").trim()
          ? Number(item.triggerStepIndex)
          : null,
      rollback_commands:
        item.rollbackPolicy === "per_step"
          ? parseRollbackLinesRaw(item.rollbackCommandsText)
          : [],
    });
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
    const editedName = safeString(byId("tx-name")?.value || "").trim();
    if (editedName) {
      item.name = editedName;
    }
    sanitizeTxWorkflowBlock(item);
    renderTxWorkflowBuilder();
    if (!silent) {
      setStatusMessage("tx-workflow-plan-out", t("txWorkflowEditorBridgeApplied"), "success");
    }
    return;
  }

  if (currentTxBlockRunKind !== "commands") {
    currentTxBlockRunKind = "commands";
    applyTxBlockRunKind();
    if (!silent) {
      setStatusMessage(
        "tx-workflow-plan-out",
        t("txWorkflowEditorBridgeRunKindUnsupported"),
        "error"
      );
    }
    return;
  }
  const payload = buildTxBlockTemplatePayloadFromEditor();
  item.sourceKind = "direct";
  item.name = safeString(payload.name || item.name || "tx-block").trim() || "tx-block";
  item.mode = safeString(payload.mode || item.mode || "").trim();
  item.timeoutSecs =
    payload.timeout_secs != null && payload.timeout_secs !== ""
      ? String(payload.timeout_secs)
      : "";
  item.rollbackPolicy = normalizeTxWorkflowRollbackPolicy(payload.rollback_mode || "per_step");
  item.undoCommand = safeString(payload.resource_rollback_command || "").trim();
  item.triggerStepIndex =
    payload.rollback_trigger_step_index != null &&
    payload.rollback_trigger_step_index !== ""
      ? String(payload.rollback_trigger_step_index)
      : "";
  item.rollbackOnFailure = !!payload.rollback_on_failure;
  item.commandsText = (Array.isArray(payload.commands) ? payload.commands : []).join("\n");
  item.rollbackCommandsText = (
    Array.isArray(payload.rollback_commands) ? payload.rollback_commands : []
  ).join("\n");
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
        const commandCount = txWorkflowLines(block.commandsText).length;
        const sourceKind = block.sourceKind || "direct";
        const templateName = safeString(block.txBlockTemplateName || "").trim();
        const modeText =
          block.mode && block.mode.trim()
            ? block.mode.trim()
            : txWorkflowAvailableModes()[0] || "User";
        const rollbackText = block.rollbackPolicy || "per_step";
        const commandsList = txWorkflowLines(block.commandsText);
        const rollbackList = parseRollbackLinesRaw(block.rollbackCommandsText).filter(Boolean);
        const rollbackPreview =
          block.rollbackPolicy === "none"
            ? t("txWorkflowBlockRollbackNone")
            : block.rollbackPolicy === "whole_resource"
              ? safeString(block.undoCommand || "").trim() || t("txWorkflowBlockUndoPlaceholder")
              : rollbackList.length
                ? rollbackList.join("\n")
                : t("txWorkflowVisualNoRollback");
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
              safeString(block.name || "").trim() || `tx-block-${fullIdx + 1}`
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
                    commandsList.length
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

function txWorkflowLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => !!s);
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

function isCommandOperation(operation) {
  if (!operation || typeof operation !== "object") return false;
  return operation.kind === "command" || typeof operation.command === "string";
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

function buildRollbackCommand(rule, cmd, template) {
  const raw = String(cmd || "").trim();
  if (!raw) return "";
  if (rule === "set_delete") {
    if (raw.startsWith("set ")) return `delete ${raw.slice(4).trim()}`;
    if (raw.startsWith("delete ")) return raw;
    return `no ${raw}`;
  }
  if (rule === "add_remove") {
    if (raw.startsWith("add ")) return `remove ${raw.slice(4).trim()}`;
    if (raw.startsWith("remove ")) return raw;
    return `no ${raw}`;
  }
  if (rule === "custom") {
    const tpl = String(template || "").trim();
    if (!tpl) return "";
    return tpl.replaceAll("{{cmd}}", raw);
  }
  if (raw.startsWith("no ")) return raw;
  return `no ${raw}`;
}

function getFilteredTxWorkflowBlocks() {
  const query = txWorkflowFilterQuery.trim().toLowerCase();
  return txWorkflowBlocks.filter((block) => {
    const rollbackOk =
      txWorkflowFilterRollback === "all" ||
      block.rollbackPolicy === txWorkflowFilterRollback;
    const queryOk =
      !query ||
      String(block.name || "").toLowerCase().includes(query) ||
      String(block.commandsText || "").toLowerCase().includes(query) ||
      String(block.txBlockTemplateName || "").toLowerCase().includes(query);
    return rollbackOk && queryOk;
  });
}

function setAllTxWorkflowBlocksCollapsed(collapsed) {
  txWorkflowBlocks.forEach((block) => {
    block.collapsed = !!collapsed;
  });
  renderTxWorkflowBuilder();
}

function generateTxWorkflowJsonFromBuilder() {
  const name = byId("tx-workflow-name").value.trim() || "tx-workflow";
  const failFast = byId("tx-workflow-fail-fast").checked;
  const blocks = txWorkflowBlocks.map((block) => {
    sanitizeTxWorkflowBlock(block);
    if (block.sourceKind === "tx_block_template") {
      const templateName = safeString(block.txBlockTemplateName || "").trim();
      if (!templateName) {
        throw new Error(t("txWorkflowBlockTemplateNameRequired"));
      }
      return {
        name: block.name.trim() || "tx-block",
        tx_block_template_name: templateName,
        tx_block_template_vars: txWorkflowBlockTemplateVarsObject(
          block,
          txWorkflowBlocks.indexOf(block)
        ),
        fail_fast: block.failFast,
      };
    }
    const commands = txWorkflowLines(block.commandsText);
    const rollbacks = parseRollbackLinesRaw(block.rollbackCommandsText);
    const timeout = block.timeoutSecs ? Number(block.timeoutSecs) : null;
    const timeoutSecs = Number.isFinite(timeout) && timeout > 0 ? timeout : null;
    const mode = block.mode.trim() || txWorkflowAvailableModes()[0] || "User";
    const triggerRaw =
      block.rollbackPolicy === "whole_resource" ? block.triggerStepIndex : "";
    const triggerStepIndex = Number.isFinite(Number(triggerRaw))
      ? Number(triggerRaw)
      : 0;

    const applyRollbackOnFailure =
      block.rollbackPolicy === "per_step" && block.rollbackOnFailure === true;
    const steps = commands.map((command, idx) => ({
      run: {
        kind: "command",
        mode,
        command,
        timeout: timeoutSecs,
      },
      rollback:
        block.rollbackPolicy === "per_step" &&
        rollbacks[idx] &&
        rollbacks[idx].trim()
          ? {
              kind: "command",
              mode,
              command: rollbacks[idx],
              timeout: timeoutSecs,
            }
          : null,
      rollback_on_failure: applyRollbackOnFailure,
    }));

    let rollbackPolicy;
    if (block.rollbackPolicy === "none") {
      rollbackPolicy = "none";
    } else if (block.rollbackPolicy === "whole_resource") {
      rollbackPolicy = {
        whole_resource: {
          rollback: {
            kind: "command",
            mode,
            command: block.undoCommand.trim(),
            timeout: timeoutSecs,
          },
          trigger_step_index: triggerStepIndex,
        },
      };
    } else {
      rollbackPolicy = "per_step";
    }

    return {
      name: block.name.trim() || "tx-block",
      rollback_policy: rollbackPolicy,
      steps,
      fail_fast: block.failFast,
    };
  });
  const workflow = {
    name,
    blocks,
    fail_fast: failFast,
  };
  byId("tx-workflow-json").value = JSON.stringify(workflow, null, 2);
  setTxWorkflowPreview(workflow);
}

function loadTxWorkflowBuilderFromJson() {
  const raw = byId("tx-workflow-json").value.trim();
  if (!raw) return;
  const workflow = JSON.parse(raw);
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    throw new Error(t("txWorkflowLoadInvalidJsonShape"));
  }
  byId("tx-workflow-name").value = workflow.name || "";
  byId("tx-workflow-fail-fast").checked = workflow.fail_fast !== false;
  const blocks = Array.isArray(workflow.blocks) ? workflow.blocks : [];
  txWorkflowBlocks = blocks.map((b) => {
    const templateName = safeString(b && b.tx_block_template_name).trim();
    const templateContent = safeString(b && b.tx_block_template_content).trim();
    if (templateName || templateContent) {
      if (!templateName && templateContent) {
        throw new Error(t("txWorkflowLoadUnsupportedTemplateContent"));
      }
      return createTxWorkflowBlock({
        name: (b && b.name) || "",
        sourceKind: "tx_block_template",
        txBlockTemplateName: templateName,
        txBlockTemplateVarsText: JSON.stringify(
          (b && b.tx_block_template_vars) || {},
          null,
          2
        ),
        failFast: b && b.fail_fast !== false,
      });
    }
    const steps = Array.isArray(b.steps) ? b.steps : [];
    if (
      steps.some((s) => {
        const run = txStepRunOperation(s);
        const rollback = txStepRollbackOperation(s);
        if (run && !isCommandOperation(run)) return true;
        if (rollback && !isCommandOperation(rollback)) return true;
        return false;
      })
    ) {
      throw new Error(t("txWorkflowLoadUnsupportedOperation"));
    }
    if (
      b &&
      b.rollback_policy &&
      typeof b.rollback_policy === "object" &&
      b.rollback_policy.whole_resource
    ) {
      const wholeRollback = txWholeResourceRollbackOperation(b.rollback_policy);
      if (wholeRollback && !isCommandOperation(wholeRollback)) {
        throw new Error(t("txWorkflowLoadUnsupportedOperation"));
      }
    }
    const firstRun = txStepRunOperation(steps[0]);
    const mode = txOperationMode(firstRun) || txWorkflowAvailableModes()[0] || "User";
    const timeoutSecs = txOperationTimeoutSeconds(firstRun);
    const rollbackOnFailure = steps.some((s) => s && s.rollback_on_failure === true);
    let rollbackPolicy = "per_step";
    let undoCommand = "";
    let triggerStepIndex = 0;
    if (typeof b.rollback_policy === "string") {
      rollbackPolicy = b.rollback_policy;
    } else if (
      b.rollback_policy &&
      typeof b.rollback_policy === "object" &&
      b.rollback_policy.whole_resource
    ) {
      rollbackPolicy = "whole_resource";
      undoCommand =
        txOperationDescription(txWholeResourceRollbackOperation(b.rollback_policy)) || "";
      triggerStepIndex = b.rollback_policy.whole_resource.trigger_step_index || 0;
    }
    return createTxWorkflowBlock({
      name: b.name || "",
      rollbackPolicy,
      mode,
      timeoutSecs,
      undoCommand,
      rollbackOnFailure,
      triggerStepIndex,
      commandsText: steps
        .map((s) => txOperationDescription(txStepRunOperation(s)))
        .join("\n"),
      rollbackCommandsText: steps
        .map((s) => txOperationDescription(txStepRollbackOperation(s)))
        .join("\n"),
      failFast: b.fail_fast !== false,
    });
  });
  txWorkflowEditingBlockId = "";
  hideTxWorkflowEditorModal({ rerender: false });
  renderTxWorkflowBuilder();
  renderTxWorkflowPreviewFromEditor();
}

function downloadTxWorkflowJsonFromBuilder() {
  generateTxWorkflowJsonFromBuilder();
  const content = byId("tx-workflow-json").value || "";
  const nameRaw = (byId("tx-workflow-name").value || "").trim() || "tx-workflow";
  const safeName = nameRaw.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const fileName = `${safeName}.json`;
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importTxWorkflowBuilderFromFile() {
  const input = byId("tx-workflow-import-file-input");
  const file = input && input.files && input.files[0] ? input.files[0] : null;
  if (!file) {
    throw new Error(t("txWorkflowImportFileInvalid"));
  }
  const text = await file.text();
  byId("tx-workflow-json").value = text;
  loadTxWorkflowBuilderFromJson();
  renderTxWorkflowPreviewFromEditor();
  setStatusMessage("tx-workflow-plan-out", t("txWorkflowImportFileDone"), "success");
  input.value = "";
}

function downloadOrchestrationJson() {
  const content = byId("orchestration-json").value || "";
  const raw = content.trim();
  let safeName = "orchestration";
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const nameRaw = (parsed && parsed.name ? String(parsed.name) : "").trim();
      if (nameRaw) {
        safeName = nameRaw.replace(/[^a-zA-Z0-9._-]+/g, "-");
      }
    } catch (_) {
      safeName = "orchestration";
    }
  }
  const fileName = `${safeName || "orchestration"}.json`;
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importOrchestrationFromFile() {
  const input = byId("orchestration-import-file-input");
  const file = input && input.files && input.files[0] ? input.files[0] : null;
  if (!file) {
    throw new Error(t("orchestrationImportFileInvalid"));
  }
  const text = await file.text();
  byId("orchestration-json").value = text;
  renderOrchestrationPreviewFromEditor();
  setStatusMessage(
    "orchestration-plan-out",
    t("orchestrationImportFileDone"),
    "success"
  );
  input.value = "";
}

function txBlockToBuilderSeed(block) {
  const steps = Array.isArray(block && block.steps) ? block.steps : [];
  const firstRun = txStepRunOperation(steps[0]);
  const mode = txOperationMode(firstRun) || txWorkflowAvailableModes()[0] || "User";
  const timeoutSecs = txOperationTimeoutSeconds(firstRun);
  let rollbackPolicy = "per_step";
  let triggerStepIndex = 0;
  let undoCommand = "";
  const rp = block && block.rollback_policy;
  if (typeof rp === "string") {
    rollbackPolicy = rp;
  } else if (rp && typeof rp === "object" && rp.whole_resource) {
    rollbackPolicy = "whole_resource";
    undoCommand = txOperationDescription(txWholeResourceRollbackOperation(rp)) || "";
    triggerStepIndex = rp.whole_resource.trigger_step_index || 0;
  }
  return {
    name: (block && block.name) || "",
    rollbackPolicy,
    mode,
    timeoutSecs,
    undoCommand,
    rollbackOnFailure: steps.some((s) => s.rollback_on_failure === true),
    triggerStepIndex,
    commandsText: steps
      .map((s) => txOperationDescription(txStepRunOperation(s)))
      .join("\n"),
    rollbackCommandsText: steps
      .map((s) => txOperationDescription(txStepRollbackOperation(s)))
      .join("\n"),
    failFast: block && block.fail_fast !== false,
  };
}

async function importTxBlockIntoWorkflowBuilder() {
  if (!ensureConnectionTargetSelected("tx-workflow-plan-out")) {
    return;
  }
  if (currentTxBlockRunKind === "flow") {
    setStatusMessage(
      "tx-workflow-plan-out",
      "command flow tx block is not supported by the workflow builder yet",
      "error"
    );
    return;
  }
  setStatusMessage("tx-workflow-plan-out", t("running"), "running");
  try {
    const data = await request("POST", "/api/tx/block", txPayload(true));
    const block = data && data.tx_block ? data.tx_block : null;
    if (!block) {
      setStatusMessage("tx-workflow-plan-out", t("txWorkflowImportEmpty"), "error");
      return;
    }
    const importedBlock = createTxWorkflowBlock(txBlockToBuilderSeed(block));
    txWorkflowBlocks.push(importedBlock);
    await startTxWorkflowBlockEditor(importedBlock.id);
    setStatusMessage("tx-workflow-plan-out", t("txWorkflowImportDone"), "success");
  } catch (e) {
    setStatusMessage("tx-workflow-plan-out", e.message, "error");
  }
}
