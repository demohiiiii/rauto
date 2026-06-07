import { escapeHtml, safeString, statusCard, tr } from "./templateUi.js";

function renderParsedOutputBlock(data) {
  return typeof window.renderParsedOutputBlock === "function"
    ? window.renderParsedOutputBlock(data)
    : "";
}

export function renderCommandFlowResult(data) {
  const outputs = Array.isArray(data?.outputs) ? data.outputs : [];
  const tone = data?.success ? "success" : "error";
  const exportButton = window.renderParsedOutputSheetsExportButton?.(
    window.parsedOutputSheetsFromItems?.(outputs, {
      filename: "textfsm-flow.xlsx",
      sheetName: (item, index) => item.command || `command_${index + 1}`,
    }) || [],
    { filename: "textfsm-flow.xlsx" },
  );
  const summary = statusCard(
    `${
      data?.success
        ? tr("orchestrationStatusSuccess", "Success")
        : tr("orchestrationStatusFailed", "Failed")
    } · template=${safeString(data?.template_name) || "-"}`,
    tone,
  );
  const items = outputs
    .map(
      (item, idx) => `
      <div class="rounded-xl border border-slate-200 bg-white px-3 py-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-semibold text-slate-800">${escapeHtml(
            `${idx + 1}. ${item.command || "-"}`,
          )}</span>
          <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
            item.success
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }">${escapeHtml(
            item.success
              ? tr("orchestrationStatusSuccess", "Success")
              : tr("orchestrationStatusFailed", "Failed"),
          )}</span>
        </div>
        <div class="mt-2 text-xs text-slate-500">exit_code=${escapeHtml(
          safeString(item.exit_code),
        )}</div>
        <pre class="output mt-2">${escapeHtml(safeString(item.output || item.error || ""))}</pre>
        ${renderParsedOutputBlock(item)}
      </div>`,
    )
    .join("");
  return `${summary}${exportButton ? `<div class="mb-2 flex justify-end">${exportButton}</div>` : ""}${items ? `<div class="grid gap-2">${items}</div>` : ""}`;
}
