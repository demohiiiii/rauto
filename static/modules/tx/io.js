/**
 * tx/io.js — tx JSON import/export helpers
 */

function normalizeTxWorkflowJsonFromEditor() {
  const raw = txWorkflowEditorRaw().trim();
  if (!raw) return;
  const workflow = JSON.parse(raw);
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    throw new Error(t("txWorkflowLoadInvalidJsonShape"));
  }
  setTxWorkflowEditorJson(workflow);
  renderTxWorkflowPreviewFromEditor();
}

function generateTxWorkflowJsonFromBuilder() {
  normalizeTxWorkflowJsonFromEditor();
}

function loadTxWorkflowBuilderFromJson() {
  normalizeTxWorkflowJsonFromEditor();
}

function downloadTxWorkflowJson() {
  normalizeTxWorkflowJsonFromEditor();
  const content = txWorkflowEditorRaw();
  let nameRaw = "tx-workflow";
  try {
    const parsed = JSON.parse(content || "{}");
    nameRaw = safeString(parsed && parsed.name).trim() || "tx-workflow";
  } catch (_) {}
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

async function importTxWorkflowFromFile() {
  const input = byId("tx-workflow-import-file-input");
  const file = input && input.files && input.files[0] ? input.files[0] : null;
  if (!file) {
    throw new Error(t("txWorkflowImportFileInvalid"));
  }
  const text = await file.text();
  setTxWorkflowEditorText(text, { notify: false });
  normalizeTxWorkflowJsonFromEditor();
  renderTxWorkflowPreviewFromEditor();
  setStatusMessage("tx-workflow-plan-out", t("txWorkflowImportFileDone"), "success");
  input.value = "";
}

function downloadTxWorkflowJsonFromBuilder() {
  downloadTxWorkflowJson();
}

async function importTxWorkflowBuilderFromFile() {
  await importTxWorkflowFromFile();
}

function downloadOrchestrationJson() {
  const content = orchestrationEditorRaw() || "";
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
  try {
    const parsed = JSON.parse(text);
    setOrchestrationEditorJson(parsed);
  } catch (_) {
    setOrchestrationEditorText(text, { notify: true });
  }
  setStatusMessage(
    "orchestration-plan-out",
    t("orchestrationImportFileDone"),
    "success"
  );
  input.value = "";
}

async function importTxBlockIntoWorkflowBuilder() {
  if (!ensureConnectionTargetSelected("tx-workflow-plan-out")) {
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
    const importedBlock = createTxWorkflowBlock({
      name: (block && block.name) || "",
      failFast: block && block.fail_fast !== false,
      txBlockJsonText: JSON.stringify(block, null, 2),
    });
    txWorkflowBlocks.push(importedBlock);
    await startTxWorkflowBlockEditor(importedBlock.id);
    setStatusMessage("tx-workflow-plan-out", t("txWorkflowImportDone"), "success");
  } catch (e) {
    setStatusMessage("tx-workflow-plan-out", e.message, "error");
  }
}
