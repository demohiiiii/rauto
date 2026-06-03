import {
  executeOrchestration,
  executeTxBlock,
  executeTxWorkflow,
} from "../api/client.js";
import {
  orchestrationExecutionPayload,
  txBlockExecutionPayload,
  txWorkflowExecutionPayload,
} from "../services/txPayloads.js";

function tr(key, fallback = key) {
  return typeof window.t === "function" ? window.t(key) : fallback;
}

function safeString(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function statusCard(message, tone = "info") {
  if (typeof window.renderStatusMessageCard === "function") {
    return window.renderStatusMessageCard(message, tone);
  }
  const text = safeString(message || "-")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return `<div class="rounded-xl border ${toneClass} px-3 py-2 text-sm">${text}</div>`;
}

function setStatus(id, message, tone = "info") {
  if (typeof window.setStatusMessage === "function") {
    window.setStatusMessage(id, message, tone);
    return;
  }
  const out = document.getElementById(id);
  if (out) out.innerHTML = statusCard(message, tone);
}

async function withLoading(buttonOrId, handler) {
  if (typeof window.withButtonLoading === "function") {
    return window.withButtonLoading(buttonOrId, handler);
  }
  const button =
    typeof buttonOrId === "string"
      ? document.getElementById(buttonOrId)
      : buttonOrId;
  const previousDisabled = button?.disabled;
  if (button) button.disabled = true;
  try {
    return await handler();
  } finally {
    if (button) button.disabled = previousDisabled;
  }
}

function setTxMode(modes) {
  window.setTxRuntimeViewModes?.(modes);
  if (modes.txBlock) window.applyTxBlockViewMode?.();
  if (modes.txWorkflow) window.applyTxWorkflowViewMode?.();
  if (modes.orchestration) window.applyOrchestrationViewMode?.();
}

function ensureTarget(statusId, renderTargetId) {
  if (typeof window.ensureConnectionTargetSelected !== "function") return true;
  return window.ensureConnectionTargetSelected(statusId, renderTargetId);
}

function applyRecording(data) {
  window.applyRecordingFromResponse?.(data);
}

function setVisualError(id, message) {
  const out = document.getElementById(id);
  if (out) out.innerHTML = statusCard(message, "error");
}

export function txExecutionBehavior(node) {
  const byId = (id) =>
    node.querySelector(`#${id}`) || document.getElementById(id);

  function normalizeTxWorkflowJsonFromEditor() {
    const raw = window.txWorkflowEditorRaw?.().trim() || "";
    if (!raw) return;
    const workflow = JSON.parse(raw);
    if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
      throw new Error(tr("txWorkflowLoadInvalidJsonShape"));
    }
    window.setTxWorkflowEditorJson?.(workflow);
    window.renderTxWorkflowPreviewFromEditor?.();
  }

  async function importTxWorkflowFromFile() {
    const input = byId("tx-workflow-import-file-input");
    const file = input?.files?.[0] || null;
    if (!file) {
      throw new Error(tr("txWorkflowImportFileInvalid"));
    }
    const text = await file.text();
    window.setTxWorkflowEditorText?.(text, { notify: false });
    normalizeTxWorkflowJsonFromEditor();
    window.renderTxWorkflowPreviewFromEditor?.();
    setStatus(
      "tx-workflow-plan-out",
      tr("txWorkflowImportFileDone"),
      "success",
    );
    input.value = "";
  }

  async function importOrchestrationFromFile() {
    const input = byId("orchestration-import-file-input");
    const file = input?.files?.[0] || null;
    if (!file) {
      throw new Error(tr("orchestrationImportFileInvalid"));
    }
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      window.setOrchestrationEditorJson?.(parsed);
    } catch (_) {
      window.setOrchestrationEditorText?.(text, { notify: true });
    }
    setStatus(
      "orchestration-plan-out",
      tr("orchestrationImportFileDone"),
      "success",
    );
    input.value = "";
  }

  async function runTxBlock(mode, dryRun, statusId) {
    if (!ensureTarget(statusId, "tx-block-visual")) return;
    setTxMode({ txBlock: mode });
    const payload = txBlockExecutionPayload({ dryRun, mode });
    if (
      mode === "template" &&
      !safeString(payload.tx_block_template_content || "").trim()
    ) {
      throw new Error(tr("txBlockJsonRequired"));
    }
    if (
      mode === "direct" &&
      (!payload.tx_block ||
        typeof payload.tx_block !== "object" ||
        Array.isArray(payload.tx_block))
    ) {
      throw new Error(tr("txBlockJsonInvalidShape"));
    }
    setStatus(statusId, tr("running", "running"), "running");
    const data = await executeTxBlock(payload);
    window.setTxBlockVisual?.(
      data?.tx_block || {},
      dryRun ? null : data?.tx_result || {},
    );
    if (dryRun) {
      setStatus(statusId, tr("txBlockPreviewDone"), "success");
      const execOut = byId("tx-exec-out");
      if (execOut) execOut.innerHTML = "";
    } else {
      setStatus(statusId, tr("txBlockExecuteDone"), "success");
      applyRecording(data);
    }
  }

  async function previewTxWorkflow() {
    const visualOut = byId("tx-workflow-plan-visual");
    if (!ensureTarget("tx-workflow-plan-out", "tx-workflow-plan-visual"))
      return;
    setStatus("tx-workflow-plan-out", tr("running", "running"), "running");
    try {
      const data = await executeTxWorkflow(
        txWorkflowExecutionPayload({ dryRun: true }),
      );
      window.setTxWorkflowPreview?.(data?.workflow || {});
      setStatus("tx-workflow-plan-out", tr("txWorkflowPreviewDone"), "success");
    } catch (error) {
      setStatus("tx-workflow-plan-out", error.message, "error");
      if (visualOut) visualOut.innerHTML = statusCard(error.message, "error");
    }
  }

  async function executeWorkflow() {
    const out = byId("tx-workflow-exec-out");
    if (!ensureTarget("tx-workflow-exec-out", "tx-workflow-exec-out")) return;
    setStatus("tx-workflow-exec-out", tr("running", "running"), "running");
    try {
      const data = await executeTxWorkflow(
        txWorkflowExecutionPayload({ dryRun: false }),
      );
      const result = data?.tx_workflow_result || {};
      if (out) out.innerHTML = window.renderTxWorkflowResult?.(result) || "";
      window.showToast?.(tr("txWorkflowExecuteDone"), "success");
      applyRecording(data);
    } catch (error) {
      setStatus("tx-workflow-exec-out", error.message, "error");
    }
  }

  async function previewOrchestration() {
    const visualOut = byId("orchestration-visual");
    setStatus("orchestration-plan-out", tr("running", "running"), "running");
    try {
      const data = await executeOrchestration(
        orchestrationExecutionPayload({ dryRun: true }),
      );
      window.setOrchestrationPreview?.(
        data?.plan || {},
        data?.inventory || {},
        null,
      );
      setStatus(
        "orchestration-plan-out",
        tr("orchestrationPreviewDone"),
        "success",
      );
      const execOut = byId("orchestration-exec-out");
      if (execOut) execOut.innerHTML = "";
    } catch (error) {
      setStatus("orchestration-plan-out", error.message, "error");
      if (visualOut) visualOut.innerHTML = statusCard(error.message, "error");
    }
  }

  async function executeOrchestrationRun() {
    const out = byId("orchestration-exec-out");
    setStatus("orchestration-exec-out", tr("running", "running"), "running");
    try {
      const data = await executeOrchestration(
        orchestrationExecutionPayload({ dryRun: false }),
      );
      const result = data?.orchestration_result || {};
      window.setOrchestrationPreview?.(
        data?.plan || {},
        data?.inventory || {},
        result,
      );
      if (out) out.innerHTML = window.renderOrchestrationResult?.(result) || "";
    } catch (error) {
      setStatus("orchestration-exec-out", error.message, "error");
    }
  }

  const bindings = [
    ["tx-block-view-direct", "click", () => setTxMode({ txBlock: "direct" })],
    [
      "tx-block-view-template",
      "click",
      () => setTxMode({ txBlock: "template" }),
    ],
    [
      "tx-workflow-view-direct",
      "click",
      () => setTxMode({ txWorkflow: "direct" }),
    ],
    [
      "tx-workflow-view-template",
      "click",
      () => setTxMode({ txWorkflow: "template" }),
    ],
    [
      "orchestration-view-direct",
      "click",
      () => setTxMode({ orchestration: "direct" }),
    ],
    [
      "orchestration-view-template",
      "click",
      () => setTxMode({ orchestration: "template" }),
    ],
    [
      "tx-plan-btn",
      "click",
      () =>
        withLoading("tx-plan-btn", async () => {
          try {
            await runTxBlock("direct", true, "tx-plan-out");
          } catch (error) {
            setStatus("tx-plan-out", error.message, "error");
            setVisualError("tx-block-visual", error.message);
          }
        }),
    ],
    [
      "tx-exec-btn",
      "click",
      () =>
        withLoading("tx-exec-btn", async () => {
          try {
            await runTxBlock("direct", false, "tx-exec-out");
          } catch (error) {
            setStatus("tx-exec-out", error.message, "error");
            setVisualError("tx-block-visual", error.message);
          }
        }),
    ],
    [
      "tx-template-plan-btn",
      "click",
      () =>
        withLoading("tx-template-plan-btn", async () => {
          try {
            await runTxBlock("template", true, "tx-plan-out");
          } catch (error) {
            setStatus("tx-plan-out", error.message, "error");
            setVisualError("tx-block-visual", error.message);
          }
        }),
    ],
    [
      "tx-template-exec-btn",
      "click",
      () =>
        withLoading("tx-template-exec-btn", async () => {
          try {
            await runTxBlock("template", false, "tx-exec-out");
          } catch (error) {
            setStatus("tx-exec-out", error.message, "error");
            setVisualError("tx-block-visual", error.message);
          }
        }),
    ],
    [
      "tx-workflow-plan-btn",
      "click",
      () => withLoading("tx-workflow-plan-btn", previewTxWorkflow),
    ],
    [
      "tx-workflow-exec-btn",
      "click",
      () => withLoading("tx-workflow-exec-btn", executeWorkflow),
    ],
    [
      "orchestration-plan-btn",
      "click",
      () => withLoading("orchestration-plan-btn", previewOrchestration),
    ],
    [
      "orchestration-exec-btn",
      "click",
      () => withLoading("orchestration-exec-btn", executeOrchestrationRun),
    ],
    [
      "orchestration-import-file-btn",
      "click",
      () => byId("orchestration-import-file-input")?.click(),
    ],
    [
      "orchestration-import-file-input",
      "change",
      async () => {
        try {
          await importOrchestrationFromFile();
        } catch (error) {
          setStatus("orchestration-plan-out", error.message, "error");
        }
      },
    ],
    [
      "tx-workflow-import-file-btn",
      "click",
      () => byId("tx-workflow-import-file-input")?.click(),
    ],
    [
      "tx-workflow-import-file-input",
      "change",
      async () => {
        try {
          await importTxWorkflowFromFile();
        } catch (error) {
          setStatus("tx-workflow-plan-out", error.message, "error");
        }
      },
    ],
    [
      "tx-workflow-json",
      "input",
      () => window.renderTxWorkflowPreviewFromEditor?.(),
    ],
    [
      "orchestration-json",
      "input",
      () => window.renderOrchestrationPreviewFromEditor?.(),
    ],
  ];

  bindings.forEach(([id, event, handler]) => {
    byId(id)?.addEventListener(event, handler);
  });

  window.importTxWorkflowFromFile = importTxWorkflowFromFile;
  window.importOrchestrationFromFile = importOrchestrationFromFile;

  return {
    destroy() {
      bindings.forEach(([id, event, handler]) => {
        byId(id)?.removeEventListener(event, handler);
      });
    },
  };
}
