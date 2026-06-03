/**
 * render.js - Pure HTML rendering functions (extracted from app.js)
 */

function renderTemplateExecuteResult(data) {
  if (!data || typeof data !== "object") {
    return `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      t("requestFailed"),
    )}</div>`;
  }
  const rendered = safeString(data.rendered_commands);
  const executed = Array.isArray(data.executed) ? data.executed : [];
  const successCount = executed.filter((item) => item && item.success).length;
  const failedCount = Math.max(0, executed.length - successCount);
  const summary = `
    <div class="grid gap-2 md:grid-cols-3">
      ${renderTxWorkflowPreviewMeta(t("templateExecSummaryTotal"), executed.length)}
      ${renderTxWorkflowPreviewMeta(t("templateExecSummarySuccess"), successCount)}
      ${renderTxWorkflowPreviewMeta(t("templateExecSummaryFailed"), failedCount)}
    </div>
  `;
  const renderedCard = `
    <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div class="text-sm font-semibold text-slate-900">${escapeHtml(
        t("templateExecRenderedTitle"),
      )}</div>
      <pre class="output mt-2">${escapeHtml(rendered || "-")}</pre>
    </section>
  `;
  const rows = executed
    .map((item, idx) => {
      const success = !!(item && item.success);
      return `
      <div class="rounded-lg border ${
        success
          ? "border-emerald-200 bg-emerald-50"
          : "border-rose-200 bg-rose-50"
      } px-3 py-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs font-semibold ${
            success ? "text-emerald-700" : "text-rose-700"
          }">#${idx + 1}</div>
          <span class="tx-workflow-chip">${
            success
              ? '<span class="text-emerald-700">OK</span>'
              : '<span class="text-rose-700">FAIL</span>'
          }</span>
        </div>
        <div class="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
            t("fieldCommand"),
          )}</div>
          <div class="mt-1 break-all font-mono text-xs text-slate-900">${escapeHtml(
            safeString(item && item.command),
          )}</div>
        </div>
        ${
          item && item.output
            ? `<pre class="output mt-2">${escapeHtml(safeString(item.output))}</pre>`
            : ""
        }
        ${renderParsedOutputBlock(item)}
        ${
          item && item.error
            ? `<div class="mt-2 rounded-lg border border-rose-200 bg-rose-100 px-3 py-2 text-xs text-rose-700">${escapeHtml(
                safeString(item.error),
              )}</div>`
            : ""
        }
      </div>
    `;
    })
    .join("");
  const executedCard = `
    <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div class="text-sm font-semibold text-slate-900">${escapeHtml(
        t("templateExecExecutedTitle"),
      )}</div>
      <div class="mt-2 grid gap-2">
        ${
          rows ||
          `<div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
            t("templateExecNoItems"),
          )}</div>`
        }
      </div>
    </section>
  `;
  return `<div class="grid gap-3">${summary}${renderedCard}${executedCard}</div>`;
}

function isParsedOutputTableValue(value) {
  return (
    Array.isArray(value) &&
    value.every((row) => row && typeof row === "object" && !Array.isArray(row))
  );
}

function parsedOutputCellText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(parsedOutputCellText).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return safeString(value);
}

function renderParsedOutputTable(value) {
  if (!isParsedOutputTableValue(value)) return "";
  if (!value.length) {
    return `<div class="alert py-2 text-xs">No parsed rows</div>`;
  }
  const columns = [];
  value.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!columns.includes(key)) columns.push(key);
    });
  });
  if (!columns.length) {
    return `<div class="alert py-2 text-xs">No parsed columns</div>`;
  }
  const header = columns
    .map(
      (column) =>
        `<th class="whitespace-nowrap text-[11px] uppercase tracking-wide">${escapeHtml(
          column,
        )}</th>`,
    )
    .join("");
  const rows = value
    .map((row) => {
      const cells = columns
        .map(
          (column) =>
            `<td class="max-w-[22rem] whitespace-pre-wrap break-words align-top text-xs">${escapeHtml(
              parsedOutputCellText(row[column]),
            )}</td>`,
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `
    <div class="overflow-x-auto rounded-box border border-base-300 bg-base-100">
      <table class="table table-zebra table-sm">
        <thead><tr>${header}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderParsedOutputBlock(item) {
  if (!item || typeof item !== "object") return "";
  if (item.parsed_output !== undefined && item.parsed_output !== null) {
    const table = renderParsedOutputTable(item.parsed_output);
    return `
      <section class="card mt-3 border border-base-300 bg-base-100 shadow-sm">
        <div class="card-body gap-3 p-3">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-semibold uppercase tracking-wide text-base-content/70">parsed_output</div>
            <div class="badge badge-outline badge-sm">TextFSM</div>
          </div>
          ${
            table ||
            `<pre class="output">${escapeHtml(JSON.stringify(item.parsed_output, null, 2))}</pre>`
          }
        </div>
      </section>
    `;
  }
  if (item.parse_error) {
    return `
      <div class="alert alert-warning mt-3 items-start py-2 text-xs">
        <div>
          <div class="font-semibold">parse_error</div>
          <pre class="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-amber-50/70 p-3 font-mono text-[11px] text-amber-900">${escapeHtml(safeString(item.parse_error))}</pre>
        </div>
      </div>
    `;
  }
  return "";
}

function extractFailureOutputFromReason(reason) {
  const text = safeString(reason || "").trim();
  if (!text || text === "-") return "";
  const marker = " output='";
  const start = text.indexOf(marker);
  if (start < 0) return "";
  const valueStart = start + marker.length;
  const valueEnd = text.lastIndexOf("'");
  if (valueEnd <= valueStart) return "";
  return text.slice(valueStart, valueEnd).trim();
}

function renderFailureOutputFallback(reason) {
  const output = extractFailureOutputFromReason(reason);
  if (!output) return "";
  return `
    <div class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
      <div class="text-[11px] font-semibold text-rose-700">${escapeHtml(
        t("txBlockResultOutput"),
      )}</div>
      <pre class="output mt-1">${escapeHtml(output)}</pre>
    </div>
  `;
}

function renderTxWorkflowResult(result) {
  if (!result)
    return `<pre class="output">${escapeHtml(t("requestFailed"))}</pre>`;
  const failedIdx =
    typeof result.failed_block === "number" ? result.failed_block : null;
  const blocks = Array.isArray(result.block_results)
    ? result.block_results
    : [];
  const workflowRollbackErrors = Array.isArray(result.rollback_errors)
    ? result.rollback_errors
    : [];
  const summary = `
    <div class="grid gap-2 md:grid-cols-3">
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div class="text-xs text-slate-500">workflow</div>
        <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(
          safeString(result.workflow_name),
        )}</div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div class="text-xs text-slate-500">committed</div>
        <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(
          String(!!result.committed),
        )}</div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div class="text-xs text-slate-500">rollback</div>
        <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(
          `attempted=${!!result.rollback_attempted} succeeded=${!!result.rollback_succeeded}`,
        )}</div>
      </div>
    </div>
  `;
  const workflowRollbackSection = workflowRollbackErrors.length
    ? `<div class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
         <div class="font-semibold">workflow_rollback_errors</div>
         <div class="mt-1 break-all">${escapeHtml(
           workflowRollbackErrors.join(" | "),
         )}</div>
       </div>`
    : "";
  const blockCards = blocks
    .map((block, idx) => {
      const isFailed = failedIdx === idx;
      const rollbackErrors = Array.isArray(block.rollback_errors)
        ? block.rollback_errors
        : [];
      const stepResults = Array.isArray(block.step_results)
        ? block.step_results
        : [];
      const blockRollbackSteps = Array.isArray(block.block_rollback_steps)
        ? block.block_rollback_steps
        : [];
      const failureReason = safeString(block.failure_reason);
      const failedSummary = isFailed
        ? `
      <div class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
        failed_block_rollback: attempted=${!!block.rollback_attempted} succeeded=${!!block.rollback_succeeded}
        ${
          rollbackErrors.length
            ? `<div class="mt-1">errors: ${escapeHtml(rollbackErrors.join(" | "))}</div>`
            : ""
        }
      </div>`
        : "";
      const stepDetailsSection = stepResults.length
        ? `<div class="mt-3 grid gap-3">
             ${stepResults
               .map((item, index) => renderTxStepResultDetail(item, index))
               .join("")}
           </div>`
        : `<div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">${escapeHtml(
            t("txBlockResultNoStepDetails"),
          )}</div>`;
      const blockRollbackSection = blockRollbackSteps.length
        ? `<div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
             <div class="mb-2 text-sm font-semibold text-amber-700">${escapeHtml(
               t("txBlockResultBlockRollbackOutputs"),
             )}</div>
             ${
               block.block_rollback_operation_summary
                 ? `<div class="mb-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
                      <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
                        t("fieldCommand"),
                      )}</div>
                      <div class="mt-1 break-all font-mono text-xs text-slate-900">${escapeHtml(
                        safeString(block.block_rollback_operation_summary),
                      )}</div>
                    </div>`
                 : ""
             }
             ${renderTxOperationStepOutputs(
               t("txBlockResultRollbackOutputs"),
               blockRollbackSteps,
               "amber",
             )}
           </div>`
        : "";
      const failureReasonSection =
        failureReason && failureReason !== "-"
          ? `<div class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
               <div class="font-semibold">${escapeHtml(
                 t("txBlockResultFailureReason"),
               )}</div>
               <div class="mt-1 break-all">${escapeHtml(failureReason)}</div>
             </div>
             ${
               stepResults.length
                 ? ""
                 : renderFailureOutputFallback(failureReason)
             }`
          : "";
      return `
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm font-semibold text-slate-900">block[${idx}] ${escapeHtml(
            safeString(block.block_name),
          )}</div>
          <div class="text-xs text-slate-600">committed=${escapeHtml(
            String(!!block.committed),
          )}</div>
        </div>
        <div class="mt-2 grid gap-2 md:grid-cols-3 text-xs text-slate-700">
          <div>executed_steps=${escapeHtml(String(block.executed_steps))}</div>
          <div>rollback_attempted=${escapeHtml(String(!!block.rollback_attempted))}</div>
          <div>rollback_succeeded=${escapeHtml(String(!!block.rollback_succeeded))}</div>
        </div>
        ${
          rollbackErrors.length
            ? `<div class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                rollback_errors: ${escapeHtml(rollbackErrors.join(" | "))}
              </div>`
            : ""
        }
        ${failureReasonSection}
        ${failedSummary}
        ${stepDetailsSection}
        ${blockRollbackSection}
      </section>
    `;
    })
    .join("");
  return `<div class="grid gap-3">${summary}${workflowRollbackSection}${blockCards}</div>`;
}

function txWorkflowRollbackPolicyLabel(rollbackPolicy) {
  if (typeof rollbackPolicy === "string") {
    if (rollbackPolicy === "none") return t("txWorkflowBlockRollbackNone");
    if (rollbackPolicy === "whole_resource")
      return t("txWorkflowBlockRollbackWhole");
    return t("txWorkflowBlockRollbackPerStep");
  }
  if (
    rollbackPolicy &&
    typeof rollbackPolicy === "object" &&
    rollbackPolicy.whole_resource
  ) {
    return t("txWorkflowBlockRollbackWhole");
  }
  return t("txWorkflowBlockRollbackPerStep");
}

function renderTxBlockPreview(txBlock, txResult) {
  if (!txBlock || typeof txBlock !== "object") {
    return `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txBlockVisualEmpty"),
    )}</div>`;
  }
  const steps = Array.isArray(txBlock.steps) ? txBlock.steps : [];
  const modes = Array.from(
    new Set(
      steps
        .map((step) => txOperationMode(txStepRunOperation(step)))
        .filter((s) => !!s),
    ),
  );
  const modeText = modes.length ? modes.join(", ") : "Config";
  const rollbackText = txWorkflowRollbackPolicyLabel(txBlock.rollback_policy);
  const wholeResource =
    txBlock.rollback_policy &&
    typeof txBlock.rollback_policy === "object" &&
    txBlock.rollback_policy.whole_resource
      ? txBlock.rollback_policy.whole_resource
      : null;
  const wholeResourceOp = txWholeResourceRollbackOperation(
    txBlock.rollback_policy,
  );
  const summary = `
    <div class="grid gap-2 md:grid-cols-3">
      ${renderTxWorkflowPreviewMeta(
        t("txBlockSummaryName"),
        txBlock.name || "tx-block",
      )}
      ${renderTxWorkflowPreviewMeta(t("txBlockSummaryMode"), modeText)}
      ${renderTxWorkflowPreviewMeta(t("txBlockSummaryRollback"), rollbackText)}
      ${renderTxWorkflowPreviewMeta(
        t("txBlockSummaryFailFast"),
        String(txBlock.fail_fast !== false),
      )}
      ${renderTxWorkflowPreviewMeta(t("txBlockSummarySteps"), steps.length)}
    </div>
  `;
  const wholeResourceSection = wholeResource
    ? `
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div class="grid gap-2 md:grid-cols-3">
          ${renderTxWorkflowPreviewMeta(
            t("txWorkflowVisualUndo"),
            txOperationDescription(wholeResourceOp) || "-",
          )}
          ${renderTxWorkflowPreviewMeta(
            t("txWorkflowVisualTriggerStep"),
            wholeResource.trigger_step_index != null
              ? wholeResource.trigger_step_index
              : 0,
          )}
          ${renderTxWorkflowPreviewMeta(
            t("txWorkflowSummaryMode"),
            txOperationMode(wholeResourceOp) || modeText,
          )}
        </div>
      </div>
    `
    : "";
  const stepRows = steps.length
    ? steps
        .map((step, idx) => {
          const runOperation = txStepRunOperation(step);
          const rollbackOperation = txStepRollbackOperation(step);
          const rollbackCmd = txOperationDescription(rollbackOperation);
          const timeoutSeconds = txOperationTimeoutSeconds(runOperation);
          const timeoutLabel = Number.isFinite(timeoutSeconds)
            ? `${timeoutSeconds}s`
            : "-";
          return `
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs font-semibold text-slate-600">${escapeHtml(
              `${t("txWorkflowVisualStep")} ${idx + 1}`,
            )}</div>
            <div class="inline-flex flex-wrap items-center gap-1">
              <span class="tx-workflow-chip">${escapeHtml(
                `${t("txWorkflowSummaryMode")}: ${
                  txOperationMode(runOperation) || "Config"
                }`,
              )}</span>
              <span class="tx-workflow-chip">${escapeHtml(
                `${t("txWorkflowVisualTimeout")}: ${timeoutLabel}`,
              )}</span>
              ${
                step && step.rollback_on_failure
                  ? `<span class="tx-workflow-chip">${escapeHtml(
                      t("txWorkflowRollbackOnFailureLabel"),
                    )}</span>`
                  : ""
              }
            </div>
          </div>
          <div class="mt-2 grid gap-2 md:grid-cols-2">
            <div class="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
              <div class="text-[11px] font-semibold text-cyan-700">${escapeHtml(
                t("fieldCommand"),
              )}</div>
              <div class="mt-1 break-all font-mono text-xs text-slate-900">${escapeHtml(
                txOperationDescription(runOperation),
              )}</div>
            </div>
            <div class="rounded-lg border ${
              rollbackCmd
                ? "border-amber-200 bg-amber-50"
                : "border-slate-200 bg-slate-100"
            } px-3 py-2">
              <div class="text-[11px] font-semibold ${
                rollbackCmd ? "text-amber-700" : "text-slate-500"
              }">${escapeHtml(t("txWorkflowSummaryRollback"))}</div>
              <div class="mt-1 break-all font-mono text-xs ${
                rollbackCmd ? "text-slate-900" : "text-slate-500"
              }">${escapeHtml(rollbackCmd || t("txWorkflowVisualNoRollback"))}</div>
            </div>
          </div>
        </div>
      `;
        })
        .join("")
    : `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
        t("txWorkflowBuilderEmpty"),
      )}</div>`;
  const resultSection =
    txResult && typeof txResult === "object"
      ? `
    <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div class="text-sm font-semibold text-slate-900">${escapeHtml(
        t("txBlockResultTitle"),
      )}</div>
      <div class="mt-2 grid gap-2 md:grid-cols-3">
        ${renderTxWorkflowPreviewMeta(
          t("txBlockResultCommitted"),
          String(!!txResult.committed),
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txBlockResultExecutedSteps"),
          txResult.executed_steps != null ? txResult.executed_steps : "-",
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txBlockResultRollback"),
          `attempted=${!!txResult.rollback_attempted} succeeded=${!!txResult.rollback_succeeded}`,
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txBlockResultRollbackSteps"),
          txResult.rollback_steps != null ? txResult.rollback_steps : "-",
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txBlockResultFailedStep"),
          txResult.failed_step != null ? txResult.failed_step : "-",
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txBlockResultFailureReason"),
          txResult.failure_reason || "-",
        )}
      </div>
      ${
        Array.isArray(txResult.rollback_errors) &&
        txResult.rollback_errors.length
          ? `<div class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <div class="font-semibold">${escapeHtml(
                t("txBlockResultRollbackErrors"),
              )}</div>
              <div class="mt-1 break-all">${escapeHtml(
                txResult.rollback_errors.join(" | "),
              )}</div>
            </div>`
          : ""
      }
      ${
        Array.isArray(txResult.step_results) && txResult.step_results.length
          ? `<div class="mt-3 grid gap-3">
               ${txResult.step_results
                 .map((item, index) => renderTxStepResultDetail(item, index))
                 .join("")}
             </div>`
          : `<div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">${escapeHtml(
              t("txBlockResultNoStepDetails"),
            )}</div>`
      }
      ${
        Array.isArray(txResult.block_rollback_steps) &&
        txResult.block_rollback_steps.length
          ? `<div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
               <div class="mb-2 text-sm font-semibold text-amber-700">${escapeHtml(
                 t("txBlockResultBlockRollbackOutputs"),
               )}</div>
               ${
                 txResult.block_rollback_operation_summary
                   ? `<div class="mb-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
                        <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
                          t("fieldCommand"),
                        )}</div>
                        <div class="mt-1 break-all font-mono text-xs text-slate-900">${escapeHtml(
                          safeString(txResult.block_rollback_operation_summary),
                        )}</div>
                      </div>`
                   : ""
               }
               ${renderTxOperationStepOutputs(
                 t("txBlockResultRollbackOutputs"),
                 txResult.block_rollback_steps,
                 "amber",
               )}
             </div>`
          : ""
      }
    </section>
  `
      : "";
  return `
    <div class="grid gap-3">
      ${summary}
      ${wholeResourceSection}
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="text-sm font-semibold text-slate-900">${escapeHtml(
          t("txBlockSummarySteps"),
        )}</div>
        <div class="mt-2 grid gap-2">${stepRows}</div>
      </section>
      ${resultSection}
    </div>
  `;
}

function renderTxWorkflowPreviewMeta(label, value) {
  return `
    <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div class="text-xs text-slate-500">${escapeHtml(label)}</div>
      <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(
        safeString(value),
      )}</div>
    </div>
  `;
}

function renderTxOperationStepOutputs(title, operationSteps, tone = "cyan") {
  const steps = Array.isArray(operationSteps) ? operationSteps : [];
  const toneClass =
    tone === "amber"
      ? {
          border: "border-amber-200",
          bg: "bg-amber-50",
          title: "text-amber-700",
          chip: "bg-amber-100 text-amber-700",
        }
      : {
          border: "border-cyan-200",
          bg: "bg-cyan-50",
          title: "text-cyan-700",
          chip: "bg-cyan-100 text-cyan-700",
        };
  if (!steps.length) {
    return `
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        ${escapeHtml(t("txBlockResultNoOperationOutputs"))}
      </div>
    `;
  }
  return `
    <div class="grid gap-2">
      <div class="text-xs font-semibold text-slate-600">${escapeHtml(title)}</div>
      ${steps
        .map((item) => {
          const success = !!(item && item.success);
          const outputText = safeString(
            item
              ? success
                ? item.content != null
                  ? item.content
                  : item.all
                : item.all != null
                  ? item.all
                  : item.content
              : null,
          );
          const promptText = safeString(item && item.prompt);
          const operationSummary = safeString(item && item.operation_summary);
          const cardToneClass = success
            ? toneClass
            : {
                border: "border-rose-200",
                bg: "bg-rose-50",
                title: "text-rose-700",
                chip: "bg-rose-100 text-rose-700",
              };
          return `
            <div class="rounded-lg border ${cardToneClass.border} ${cardToneClass.bg} px-3 py-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="text-[11px] font-semibold ${cardToneClass.title}">
                  ${escapeHtml(
                    `${t("txBlockResultOperationStep")} ${Number(item?.step_index || 0) + 1}`,
                  )}
                </div>
                <div class="inline-flex flex-wrap items-center gap-1">
                  <span class="tx-workflow-chip ${cardToneClass.chip}">${escapeHtml(
                    `${t("txBlockResultSuccess")}: ${success}`,
                  )}</span>
                  <span class="tx-workflow-chip ${cardToneClass.chip}">${escapeHtml(
                    `${t("txWorkflowSummaryMode")}: ${safeString(item && item.mode)}`,
                  )}</span>
                  <span class="tx-workflow-chip ${cardToneClass.chip}">${escapeHtml(
                    `${t("txBlockResultExitCode")}: ${
                      item && item.exit_code != null ? item.exit_code : "-"
                    }`,
                  )}</span>
                </div>
              </div>
              <div class="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
                  t("fieldCommand"),
                )}</div>
                <div class="mt-1 break-all font-mono text-xs text-slate-900">${escapeHtml(
                  operationSummary && operationSummary !== "-"
                    ? operationSummary
                    : "-",
                )}</div>
              </div>
              <div class="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
                  t("txBlockResultOutput"),
                )}</div>
                <pre class="output mt-1">${escapeHtml(
                  outputText && outputText !== "-" ? outputText : "-",
                )}</pre>
              </div>
              ${renderParsedOutputBlock(item)}
              ${
                promptText && promptText !== "-"
                  ? `<div class="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                       <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
                         t("txBlockResultPrompt"),
                       )}</div>
                       <div class="mt-1 break-all font-mono text-xs text-slate-900">${escapeHtml(
                         promptText,
                       )}</div>
                     </div>`
                  : ""
              }
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderTxStepResultDetail(stepResult, index) {
  if (!stepResult || typeof stepResult !== "object") return "";
  const stepIndex =
    stepResult.step_index != null &&
    Number.isFinite(Number(stepResult.step_index))
      ? Number(stepResult.step_index)
      : index;
  const executionState = safeString(stepResult.execution_state);
  const rollbackState = safeString(stepResult.rollback_state);
  const failureReason = safeString(stepResult.failure_reason);
  const rollbackReason = safeString(stepResult.rollback_reason);
  return `
    <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-sm font-semibold text-slate-900">${escapeHtml(
          `${t("txWorkflowVisualStep")} ${stepIndex + 1}`,
        )}</div>
        <div class="inline-flex flex-wrap items-center gap-1">
          <span class="tx-workflow-chip">${escapeHtml(
            `${t("txBlockResultExecutionState")}: ${
              executionState && executionState !== "-" ? executionState : "-"
            }`,
          )}</span>
          <span class="tx-workflow-chip">${escapeHtml(
            `${t("txBlockResultRollbackState")}: ${
              rollbackState && rollbackState !== "-" ? rollbackState : "-"
            }`,
          )}</span>
        </div>
      </div>
      <div class="mt-2 grid gap-2 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
            t("txBlockResultFailureReason"),
          )}</div>
          <div class="mt-1 break-all text-xs text-slate-900">${escapeHtml(
            failureReason && failureReason !== "-" ? failureReason : "-",
          )}</div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
            t("txBlockResultRollbackReason"),
          )}</div>
          <div class="mt-1 break-all text-xs text-slate-900">${escapeHtml(
            rollbackReason && rollbackReason !== "-" ? rollbackReason : "-",
          )}</div>
        </div>
      </div>
      <div class="mt-3 grid gap-3">
        ${renderTxOperationStepOutputs(
          t("txBlockResultForwardOutputs"),
          stepResult.forward_operation_steps,
          "cyan",
        )}
        ${renderTxOperationStepOutputs(
          t("txBlockResultRollbackOutputs"),
          stepResult.rollback_operation_steps,
          "amber",
        )}
      </div>
    </section>
  `;
}

function renderTxWorkflowPreview(workflow) {
  if (!workflow || typeof workflow !== "object") {
    return `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowVisualEmpty"),
    )}</div>`;
  }
  const blocks = Array.isArray(workflow.blocks) ? workflow.blocks : [];
  const summary = `
    <div class="grid gap-2 md:grid-cols-3">
      ${renderTxWorkflowPreviewMeta(
        t("txWorkflowVisualName"),
        workflow.name || "-",
      )}
      ${renderTxWorkflowPreviewMeta(t("txWorkflowVisualBlocks"), blocks.length)}
      ${renderTxWorkflowPreviewMeta(
        t("txWorkflowVisualFailFast"),
        String(workflow.fail_fast !== false),
      )}
    </div>
  `;
  const blockCards = blocks
    .map((block, blockIdx) => {
      const blockTemplateName =
        block && typeof block.tx_block_template_name === "string"
          ? block.tx_block_template_name.trim()
          : "";
      if (blockTemplateName) {
        return `
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm font-semibold text-slate-900">block[${blockIdx}] ${escapeHtml(
            safeString((block && block.name) || "tx-block"),
          )}</div>
          <div class="inline-flex flex-wrap items-center gap-1">
            <span class="tx-workflow-chip">${escapeHtml(
              `${t("txWorkflowSummarySource")}: ${t(
                "txWorkflowBlockSourceTemplate",
              )}`,
            )}</span>
            <span class="tx-workflow-chip">${escapeHtml(
              `${t("txWorkflowSummaryTemplate")}: ${blockTemplateName}`,
            )}</span>
            <span class="tx-workflow-chip">${escapeHtml(
              `${t("txWorkflowVisualFailFast")}: ${String(
                block && block.fail_fast !== false,
              )}`,
            )}</span>
          </div>
        </div>
        <div class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          ${escapeHtml(t("txWorkflowTemplateRefHint"))}
        </div>
      </section>
    `;
      }
      const steps = Array.isArray(block && block.steps) ? block.steps : [];
      const modes = Array.from(
        new Set(
          steps
            .map((step) => txOperationMode(txStepRunOperation(step)))
            .filter((s) => !!s),
        ),
      );
      const modeText = modes.length ? modes.join(", ") : "Config";
      const rollbackText = txWorkflowRollbackPolicyLabel(
        block ? block.rollback_policy : null,
      );
      const wholeResource =
        block &&
        block.rollback_policy &&
        typeof block.rollback_policy === "object" &&
        block.rollback_policy.whole_resource
          ? block.rollback_policy.whole_resource
          : null;
      const wholeResourceOp = txWholeResourceRollbackOperation(
        block ? block.rollback_policy : null,
      );
      const wholeResourceRow = wholeResource
        ? `
      <div class="grid gap-2 md:grid-cols-3">
        ${renderTxWorkflowPreviewMeta(
          t("txWorkflowVisualUndo"),
          txOperationDescription(wholeResourceOp) || "-",
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txWorkflowVisualTriggerStep"),
          wholeResource.trigger_step_index != null
            ? wholeResource.trigger_step_index
            : 0,
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txWorkflowSummaryMode"),
          txOperationMode(wholeResourceOp) || modeText,
        )}
      </div>
      `
        : "";
      const stepRows = steps.length
        ? steps
            .map((step, stepIdx) => {
              const runOperation = txStepRunOperation(step);
              const rollbackOperation = txStepRollbackOperation(step);
              const rollbackCmd = txOperationDescription(rollbackOperation);
              const timeoutSeconds = txOperationTimeoutSeconds(runOperation);
              const timeoutLabel = Number.isFinite(timeoutSeconds)
                ? `${timeoutSeconds}s`
                : "-";
              return `
          <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="text-xs font-semibold text-slate-600">${escapeHtml(
                `${t("txWorkflowVisualStep")} ${stepIdx + 1}`,
              )}</div>
              <div class="inline-flex flex-wrap items-center gap-1">
                <span class="tx-workflow-chip">${escapeHtml(
                  `${t("txWorkflowSummaryMode")}: ${
                    txOperationMode(runOperation) || "Config"
                  }`,
                )}</span>
                <span class="tx-workflow-chip">${escapeHtml(
                  `${t("txWorkflowVisualTimeout")}: ${timeoutLabel}`,
                )}</span>
                ${
                  step && step.rollback_on_failure
                    ? `<span class="tx-workflow-chip">${escapeHtml(
                        t("txWorkflowRollbackOnFailureLabel"),
                      )}</span>`
                    : ""
                }
              </div>
            </div>
            <div class="mt-2 grid gap-2 md:grid-cols-2">
              <div class="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                  <div class="text-[11px] font-semibold text-cyan-700">${escapeHtml(
                    t("fieldCommand"),
                  )}</div>
                  <div class="mt-1 break-all font-mono text-xs text-slate-900">${escapeHtml(
                    txOperationDescription(runOperation),
                  )}</div>
                </div>
              <div class="rounded-lg border ${
                rollbackCmd
                  ? "border-amber-200 bg-amber-50"
                  : "border-slate-200 bg-slate-100"
              } px-3 py-2">
                <div class="text-[11px] font-semibold ${
                  rollbackCmd ? "text-amber-700" : "text-slate-500"
                }">${escapeHtml(t("txWorkflowSummaryRollback"))}</div>
                <div class="mt-1 break-all font-mono text-xs ${
                  rollbackCmd ? "text-slate-900" : "text-slate-500"
                }">${escapeHtml(rollbackCmd || t("txWorkflowVisualNoRollback"))}</div>
              </div>
            </div>
          </div>
        `;
            })
            .join("")
        : `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
            t("txWorkflowBuilderEmpty"),
          )}</div>`;
      return `
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm font-semibold text-slate-900">block[${blockIdx}] ${escapeHtml(
            safeString((block && block.name) || "tx-block"),
          )}</div>
          <div class="inline-flex flex-wrap items-center gap-1">
            <span class="tx-workflow-chip">${escapeHtml(
              `${t("txWorkflowVisualRollbackPolicy")}: ${rollbackText}`,
            )}</span>
            <span class="tx-workflow-chip">${escapeHtml(
              `${t("txWorkflowSummaryMode")}: ${modeText}`,
            )}</span>
            <span class="tx-workflow-chip">${escapeHtml(
              `${t("txWorkflowVisualFailFast")}: ${String(
                block && block.fail_fast !== false,
              )}`,
            )}</span>
          </div>
        </div>
        <div class="mt-2 grid gap-2">
          ${wholeResourceRow}
          ${stepRows}
        </div>
      </section>
    `;
    })
    .join("");
  const blocksView =
    blockCards ||
    `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowVisualEmpty"),
    )}</div>`;
  return `<div class="grid gap-3">${summary}${blocksView}</div>`;
}

function successBadge(event) {
  if (event.kind !== "command_output")
    return '<span class="text-slate-400">-</span>';
  if (event.success) {
    return '<span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">OK</span>';
  }
  return '<span class="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">FAIL</span>';
}

function renderFlowCell(beforeValue, afterValue, tone = "slate") {
  const before = escapeHtml(safeString(beforeValue));
  const after = escapeHtml(safeString(afterValue));
  const beforeCls =
    tone === "teal"
      ? "border-cyan-200 bg-cyan-50 text-cyan-800"
      : "border-indigo-200 bg-indigo-50 text-indigo-800";
  const afterCls =
    tone === "teal"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
  const markerCls = tone === "teal" ? "bg-emerald-400" : "bg-amber-400";
  return `
    <div class="min-w-[180px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
      <div class="rounded-md border ${beforeCls} px-2 py-1">
        <div class="text-[10px] font-semibold uppercase tracking-wide opacity-70">${escapeHtml(
          t("flowBefore"),
        )}</div>
        <div class="mt-0.5 font-mono text-xs break-all">${before}</div>
      </div>
      <div class="my-1 flex items-center gap-1 px-1">
        <span class="h-2 w-2 rounded-full ${markerCls}"></span>
        <span class="h-[2px] flex-1 rounded ${markerCls}"></span>
        <span class="h-2 w-2 rounded-full ${markerCls}"></span>
      </div>
      <div class="rounded-md border ${afterCls} px-2 py-1">
        <div class="text-[10px] font-semibold uppercase tracking-wide opacity-70">${escapeHtml(
          t("flowAfter"),
        )}</div>
        <div class="mt-0.5 font-mono text-xs break-all">${after}</div>
      </div>
    </div>
  `;
}

function renderEntriesTable(entries) {
  const baseSeq = detailEntrySeq;
  const rows = entries
    .map((entry, idx) => {
      const event = (entry && entry.event) || {};
      const kind = safeString(event.kind);
      const command =
        event.kind === "command_output" ? safeString(event.command) : "-";
      const modeRaw =
        event.kind === "command_output" ? displayMode(event.mode) : "-";
      const mode = modeRaw || "-";
      const detailId = `entry-${baseSeq + idx}`;
      detailEntryMap.set(detailId, entry);
      const isFailed =
        event.kind === "command_output" && event.success === false;
      return `
        <tr class="align-top ${isFailed ? "bg-rose-50/60 hover:bg-rose-50 border-l-4 border-rose-400" : "hover:bg-slate-50/80"}">
          <td class="whitespace-nowrap px-3 py-2 text-slate-500">${idx + 1}</td>
          <td class="px-3 py-2 font-medium text-slate-800">${escapeHtml(kind)}</td>
          <td class="min-w-[320px] max-w-[420px] px-3 py-2 font-mono text-xs text-slate-700 break-all">${escapeHtml(command)}</td>
          <td class="px-3 py-2 font-mono text-xs text-slate-700">${escapeHtml(mode)}</td>
          <td class="px-3 py-2">${successBadge(event)}</td>
          <td class="px-3 py-2">${renderFlowCell(event.prompt_before, event.prompt_after, "indigo")}</td>
          <td class="px-3 py-2">${renderFlowCell(event.fsm_prompt_before, event.fsm_prompt_after, "teal")}</td>
          <td class="whitespace-nowrap px-3 py-2">
            <button class="mini-btn js-entry-detail-btn" type="button" data-detail-id="${escapeHtml(
              detailId,
            )}">${escapeHtml(t("actionViewDetail"))}</button>
          </td>
        </tr>
      `;
    })
    .join("");
  detailEntrySeq += entries.length;

  return `
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="min-w-[1320px] table-fixed text-sm">
        <thead class="bg-slate-100 text-xs font-semibold text-slate-600">
          <tr>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableIndex"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableEvent"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableCommand"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableMode"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableSuccess"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tablePromptFlow"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableFsmFlow"))}</th>
            <th class="px-3 py-2 text-left">${escapeHtml(t("tableAction"))}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

export function installRenderRuntime() {
  Object.assign(window, {
    renderTemplateExecuteResult,
    isParsedOutputTableValue,
    parsedOutputCellText,
    renderParsedOutputTable,
    renderParsedOutputBlock,
    extractFailureOutputFromReason,
    renderFailureOutputFallback,
    renderTxWorkflowResult,
    txWorkflowRollbackPolicyLabel,
    renderTxBlockPreview,
    renderTxWorkflowPreviewMeta,
    renderTxOperationStepOutputs,
    renderTxStepResultDetail,
    renderTxWorkflowPreview,
    successBadge,
    renderFlowCell,
    renderEntriesTable,
  });
}
