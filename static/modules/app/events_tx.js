/**
 * app_events_tx.js - tx/workflow/orchestration execution event bindings
 */

function bindTxExecutionEvents() {
  byId("tx-block-view-direct").onclick = () => {
    txBlockViewMode = "direct";
    applyTxBlockViewMode();
    syncSelectedTxWorkflowBlockFromEditor();
  };
  byId("tx-block-view-template").onclick = () => {
    txBlockViewMode = "template";
    applyTxBlockViewMode();
    syncSelectedTxWorkflowBlockFromEditor();
  };
  byId("tx-workflow-view-direct").onclick = () => {
    txWorkflowViewMode = "direct";
    applyTxWorkflowViewMode();
  };
  byId("tx-workflow-view-template").onclick = () => {
    txWorkflowViewMode = "template";
    applyTxWorkflowViewMode();
  };
  byId("tx-workflow-template-run-new-btn").onclick =
    createTxWorkflowTemplateDraftFromExecution;
  byId("tx-workflow-template-run-save-btn").onclick =
    saveTxWorkflowTemplateFromExecution;
  byId("tx-workflow-template-run-delete-btn").onclick =
    deleteTxWorkflowTemplateFromExecution;
  byId("tx-workflow-template-name").onchange = async () => {
    if (!byId("tx-workflow-template-name").value.trim()) return;
    await loadSelectedTxWorkflowTemplateForExecution();
  };
  byId("orchestration-view-direct").onclick = () => {
    orchestrationViewMode = "direct";
    applyOrchestrationViewMode();
  };
  byId("orchestration-view-template").onclick = () => {
    orchestrationViewMode = "template";
    applyOrchestrationViewMode();
  };
  byId("orchestration-template-run-new-btn").onclick =
    createOrchestrationTemplateDraftFromExecution;
  byId("orchestration-template-run-save-btn").onclick =
    saveOrchestrationTemplateFromExecution;
  byId("orchestration-template-run-delete-btn").onclick =
    deleteOrchestrationTemplateFromExecution;
  byId("orchestration-template-name").onchange = async () => {
    if (!byId("orchestration-template-name").value.trim()) return;
    await loadSelectedOrchestrationTemplateForExecution();
  };
  byId("orchestration-json-new-btn").onclick = () => {
    createOrchestrationTemplateDraftFromExecution();
  };
  byId("tx-block-editor-new-btn").onclick = () => {
    setTxBlockEditorJson(defaultTxBlockTemplatePayload());
    setStatusMessage("tx-plan-out", t("editingNew"), "info");
  };
  byId("tx-block-template-run-new-btn").onclick = createTxBlockTemplateDraftFromManager;
  byId("tx-block-template-run-save-btn").onclick = saveTxBlockTemplateFromEditor;
  byId("tx-block-template-run-delete-btn").onclick = deleteTxBlockTemplateFromManager;
  byId("tx-block-template-name").onchange = async () => {
    if (!byId("tx-block-template-name").value.trim()) return;
    await loadSelectedTxBlockTemplateForExecution();
    syncSelectedTxWorkflowBlockFromEditor();
  };

  const runTxBlock = async (dryRun, statusId) => {
    const visualOut = byId("tx-block-visual");
    if (!ensureConnectionTargetSelected(statusId, "tx-block-visual")) {
      return;
    }
    const payload = txPayload(dryRun);
    if (
      txBlockViewMode === "template" &&
      !safeString(payload.tx_block_template_content || "").trim()
    ) {
      throw new Error(t("txBlockJsonRequired"));
    }
    if (
      txBlockViewMode === "direct" &&
      (!payload.tx_block || typeof payload.tx_block !== "object" || Array.isArray(payload.tx_block))
    ) {
      throw new Error(t("txBlockJsonInvalidShape"));
    }
    setStatusMessage(statusId, t("running"), "running");
    const data = await request("POST", "/api/tx/block", payload);
    setTxBlockVisual(
      data && data.tx_block ? data.tx_block : {},
      dryRun ? null : data && data.tx_result ? data.tx_result : {}
    );
    if (dryRun) {
      setStatusMessage(statusId, t("txBlockPreviewDone"), "success");
      byId("tx-exec-out").innerHTML = "";
    } else {
      setStatusMessage(statusId, t("txBlockExecuteDone"), "success");
      applyRecordingFromResponse(data);
    }
    if (!data && visualOut) {
      visualOut.innerHTML = "";
    }
  };

  byId("tx-plan-btn").onclick = async () => {
    try {
      txBlockViewMode = "direct";
      applyTxBlockViewMode();
      await runTxBlock(true, "tx-plan-out");
    } catch (e) {
      setStatusMessage("tx-plan-out", e.message, "error");
      byId("tx-block-visual").innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };

  byId("tx-exec-btn").onclick = async () => {
    try {
      txBlockViewMode = "direct";
      applyTxBlockViewMode();
      await runTxBlock(false, "tx-exec-out");
    } catch (e) {
      setStatusMessage("tx-exec-out", e.message, "error");
      byId("tx-block-visual").innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };
  byId("tx-template-plan-btn").onclick = async () => {
    try {
      txBlockViewMode = "template";
      applyTxBlockViewMode();
      await runTxBlock(true, "tx-plan-out");
    } catch (e) {
      setStatusMessage("tx-plan-out", e.message, "error");
      byId("tx-block-visual").innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };
  byId("tx-template-exec-btn").onclick = async () => {
    try {
      txBlockViewMode = "template";
      applyTxBlockViewMode();
      await runTxBlock(false, "tx-exec-out");
    } catch (e) {
      setStatusMessage("tx-exec-out", e.message, "error");
      byId("tx-block-visual").innerHTML = renderStatusMessageCard(e.message, "error");
    }
  };
  byId("tx-workflow-plan-btn").onclick = async () => {
    const visualOut = byId("tx-workflow-plan-visual");
    if (!ensureConnectionTargetSelected("tx-workflow-plan-out", "tx-workflow-plan-visual")) {
      return;
    }
    setStatusMessage("tx-workflow-plan-out", t("running"), "running");
    try {
      const data = await request("POST", "/api/tx/workflow", txWorkflowPayload(true));
      const workflow = data && data.workflow ? data.workflow : {};
      setTxWorkflowEditorJson(workflow);
      setTxWorkflowPreview(workflow);
      setStatusMessage("tx-workflow-plan-out", t("txWorkflowPreviewDone"), "success");
    } catch (e) {
      setStatusMessage("tx-workflow-plan-out", e.message, "error");
      if (visualOut) {
        visualOut.innerHTML = renderStatusMessageCard(e.message, "error");
      }
    }
  };

  byId("tx-workflow-exec-btn").onclick = async () => {
    const out = byId("tx-workflow-exec-out");
    if (!ensureConnectionTargetSelected("tx-workflow-exec-out", "tx-workflow-exec-out")) {
      return;
    }
    setStatusMessage("tx-workflow-exec-out", t("running"), "running");
    try {
      const data = await request("POST", "/api/tx/workflow", txWorkflowPayload(false));
      const result = data.tx_workflow_result || {};
      out.innerHTML = renderTxWorkflowResult(result);
      applyRecordingFromResponse(data);
    } catch (e) {
      setStatusMessage("tx-workflow-exec-out", e.message, "error");
    }
  };
  byId("tx-workflow-json-new-btn").onclick = () => {
    createTxWorkflowTemplateDraftFromExecution();
  };
  byId("orchestration-plan-btn").onclick = async () => {
    const visualOut = byId("orchestration-visual");
    setStatusMessage("orchestration-plan-out", t("running"), "running");
    try {
      const data = await request("POST", "/api/orchestrate", orchestrationPayload(true));
      const plan = data && data.plan ? data.plan : {};
      const inventory = data && data.inventory ? data.inventory : {};
      setOrchestrationEditorJson(plan);
      setOrchestrationPreview(plan, inventory, null);
      setStatusMessage(
        "orchestration-plan-out",
        t("orchestrationPreviewDone"),
        "success"
      );
      byId("orchestration-exec-out").innerHTML = "";
    } catch (e) {
      setStatusMessage("orchestration-plan-out", e.message, "error");
      if (visualOut) {
        visualOut.innerHTML = renderStatusMessageCard(e.message, "error");
      }
    }
  };
  byId("orchestration-exec-btn").onclick = async () => {
    const out = byId("orchestration-exec-out");
    setStatusMessage("orchestration-exec-out", t("running"), "running");
    try {
      const data = await request("POST", "/api/orchestrate", orchestrationPayload(false));
      const plan = data && data.plan ? data.plan : {};
      const inventory = data && data.inventory ? data.inventory : {};
      const result = data && data.orchestration_result ? data.orchestration_result : {};
      setOrchestrationPreview(plan, inventory, result);
      out.innerHTML = renderOrchestrationResult(result);
    } catch (e) {
      setStatusMessage("orchestration-exec-out", e.message, "error");
    }
  };
  byId("orchestration-import-file-btn").onclick = () => {
    byId("orchestration-import-file-input").click();
  };
  byId("orchestration-import-file-input").onchange = async () => {
    try {
      await importOrchestrationFromFile();
    } catch (e) {
      setStatusMessage("orchestration-plan-out", e.message, "error");
    }
  };
  byId("tx-workflow-import-file-btn").onclick = () => {
    byId("tx-workflow-import-file-input").click();
  };
  byId("tx-workflow-import-file-input").onchange = async () => {
    try {
      await importTxWorkflowFromFile();
    } catch (e) {
      setStatusMessage("tx-workflow-plan-out", e.message, "error");
    }
  };
  byId("tx-workflow-json").oninput = () => {
    renderTxWorkflowPreviewFromEditor();
  };
  byId("orchestration-json").oninput = () => {
    renderOrchestrationPreviewFromEditor();
  };
  byId("template").onchange = loadSelectedTemplateContent;
}
