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
