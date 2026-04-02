/**
 * render.js - Pure HTML rendering functions (extracted from app.js)
 */

function renderModeValidationCard(message) {
  const parsed = parseModeValidationMessage(message);
  if (!parsed) return null;
  const badges = parsed.availableModes.length
    ? parsed.availableModes
        .map(
          (mode) =>
            `<span class="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">${escapeHtml(
              mode
            )}</span>`
        )
        .join(" ")
    : `<span class="text-xs text-rose-600">-</span>`;
  return `
    <div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      <div class="font-medium">${escapeHtml(t("invalidModeTitle"))}: ${escapeHtml(parsed.invalidMode)}</div>
      <div class="mt-2 space-y-1 text-xs">
        <div><span class="font-medium">${escapeHtml(t("invalidModeProfile"))}:</span> ${escapeHtml(parsed.profile)}</div>
        <div><span class="font-medium">${escapeHtml(t("invalidModeDefault"))}:</span> ${escapeHtml(parsed.defaultMode)}</div>
      </div>
      <div class="mt-3">
        <div class="mb-1 text-xs font-medium uppercase tracking-wide text-rose-600">${escapeHtml(
          t("invalidModeAvailable")
        )}</div>
        <div class="flex flex-wrap gap-1.5">${badges}</div>
      </div>
      <div class="mt-3 text-xs text-rose-600">${escapeHtml(t("invalidModeHint"))}</div>
    </div>
  `;
}

function renderStatusMessageCard(message, tone = "info") {
  if (tone === "error") {
    const modeCard = renderModeValidationCard(message);
    if (modeCard) return modeCard;
  }
  const text = safeString(message || "-");
  const cls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : tone === "running"
          ? "border-cyan-200 bg-cyan-50 text-cyan-700"
          : "border-slate-200 bg-slate-50 text-slate-600";
  return `<div class="rounded-xl border px-3 py-2 text-sm ${cls}">${escapeHtml(text)}</div>`;
}

function renderStatusToast(message, tone = "info") {
  const text = safeString(message || "-");
  const cls = tone === "success" ? "alert-success" : "alert-error";
  return `
    <div class="alert ${cls} shadow-lg">
      <span>${escapeHtml(text)}</span>
      <button type="button" class="btn btn-ghost btn-xs js-toast-close" aria-label="Close">×</button>
    </div>
  `;
}

function renderFlowTemplateVarField(field, draftValue) {
  const value = draftValue !== undefined ? safeString(draftValue) : defaultFlowVarDraft(field);
  const requiredBadge = field.required
    ? `<span class="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">${escapeHtml(
        t("flowVarRequiredLabel")
      )}</span>`
    : `<span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">${escapeHtml(
        t("flowVarOptionalLabel")
      )}</span>`;
  const typeBadge = `<span class="inline-flex items-center rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">${escapeHtml(
    `${t("flowVarTypeLabel")}: ${flowVarTypeLabel(field.kind)}`
  )}</span>`;
  const description = field.description
    ? `<div class="text-xs text-slate-500">${escapeHtml(field.description)}</div>`
    : "";
  const placeholderAttr = field.placeholder
    ? ` placeholder="${escapeHtml(field.placeholder)}"`
    : "";
  const elementId = `flow-var-${field.name}`;
  let controlHtml = "";

  if (field.options.length && field.kind !== "json" && field.kind !== "boolean") {
    const allowEmpty = !field.required && (field.defaultValue === undefined || field.defaultValue === null);
    const optionsHtml = [
      allowEmpty
        ? `<option value=""></option>`
        : "",
      ...field.options.map((option) => {
        const selected = value === option ? "selected" : "";
        return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(option)}</option>`;
      }),
    ].join("");
    controlHtml = `<select id="${escapeHtml(
      elementId
    )}" class="input" data-flow-var-name="${escapeHtml(field.name)}" data-flow-var-type="${escapeHtml(
      field.kind
    )}">${optionsHtml}</select>`;
  } else if (field.kind === "boolean") {
    const optionsHtml = `
      <option value=""></option>
      <option value="true" ${value === "true" ? "selected" : ""}>true</option>
      <option value="false" ${value === "false" ? "selected" : ""}>false</option>
    `;
    controlHtml = `<select id="${escapeHtml(
      elementId
    )}" class="input" data-flow-var-name="${escapeHtml(field.name)}" data-flow-var-type="boolean">${optionsHtml}</select>`;
  } else if (field.kind === "json") {
    controlHtml = `<textarea id="${escapeHtml(
      elementId
    )}" class="input min-h-24 font-mono" data-flow-var-name="${escapeHtml(
      field.name
    )}" data-flow-var-type="json"${placeholderAttr}>${escapeHtml(value)}</textarea>`;
  } else {
    const inputType = field.kind === "secret" ? "password" : field.kind === "number" ? "number" : "text";
    controlHtml = `<input id="${escapeHtml(
      elementId
    )}" class="input" type="${escapeHtml(inputType)}" value="${escapeHtml(
      value
    )}" data-flow-var-name="${escapeHtml(field.name)}" data-flow-var-type="${escapeHtml(
      field.kind
    )}"${placeholderAttr} />`;
  }

  return `
    <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <div class="text-sm font-semibold text-slate-900">${escapeHtml(field.label)}</div>
        ${requiredBadge}
        ${typeBadge}
      </div>
      ${description}
      <div class="${description ? "mt-2" : ""}">${controlHtml}</div>
    </div>
  `;
}

function renderFlowTemplateVarFields(detail = null, draft = {}) {
  if (detail !== undefined) {
    lastFlowRunTemplateDetail = detail;
  }
  const container = byId("flow-vars-fields");
  const hint = byId("flow-vars-fields-hint");
  if (!container || !hint) return;
  const schema = getFlowRunVarsSchema();
  if (!schema.length) {
    container.innerHTML = "";
    hint.textContent = lastFlowRunTemplateDetail
      ? t("flowVarsFieldsEmpty")
      : t("flowVarsFieldsHint");
    return;
  }
  hint.textContent = t("flowVarsFieldsHint");
  container.innerHTML = schema
    .map((field) => renderFlowTemplateVarField(field, draft[field.name]))
    .join("");
}

function renderFlowTemplateVarFieldsError(message) {
  lastFlowRunTemplateDetail = null;
  const container = byId("flow-vars-fields");
  const hint = byId("flow-vars-fields-hint");
  if (!container || !hint) return;
  container.innerHTML = renderStatusMessageCard(message, "error");
  hint.textContent = t("flowVarsFieldsHint");
}

function renderStatsCards(stats) {
  const cards = [
    [t("statTotal"), stats.total],
    [t("statCommandEvents"), stats.commandEvents],
    [t("statFailedEvents"), stats.failedEvents],
    [t("statKinds"), stats.kinds],
  ];
  return `
    <div class="grid gap-2 md:grid-cols-4">
      ${cards
        .map(
          ([label, value]) => `
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div class="text-xs text-slate-500">${escapeHtml(label)}</div>
              <div class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(value)}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTemplateExecuteResult(data) {
  if (!data || typeof data !== "object") {
    return `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      t("requestFailed")
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
        t("templateExecRenderedTitle")
      )}</div>
      <pre class="output mt-2">${escapeHtml(rendered || "-")}</pre>
    </section>
  `;
  const rows = executed
    .map((item, idx) => {
      const success = !!(item && item.success);
      return `
      <div class="rounded-lg border ${
        success ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
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
            t("fieldCommand")
          )}</div>
          <div class="mt-1 break-all font-mono text-xs text-slate-900">${escapeHtml(
            safeString(item && item.command)
          )}</div>
        </div>
        ${
          item && item.output
            ? `<pre class="output mt-2">${escapeHtml(safeString(item.output))}</pre>`
            : ""
        }
        ${
          item && item.error
            ? `<div class="mt-2 rounded-lg border border-rose-200 bg-rose-100 px-3 py-2 text-xs text-rose-700">${escapeHtml(
                safeString(item.error)
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
        t("templateExecExecutedTitle")
      )}</div>
      <div class="mt-2 grid gap-2">
        ${
          rows ||
          `<div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
            t("templateExecNoItems")
          )}</div>`
        }
      </div>
    </section>
  `;
  return `<div class="grid gap-3">${summary}${renderedCard}${executedCard}</div>`;
}

function renderTxWorkflowResult(result) {
  if (!result) return `<pre class="output">${escapeHtml(t("requestFailed"))}</pre>`;
  const failedIdx =
    typeof result.failed_block === "number" ? result.failed_block : null;
  const blocks = Array.isArray(result.block_results) ? result.block_results : [];
  const summary = `
    <div class="grid gap-2 md:grid-cols-3">
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div class="text-xs text-slate-500">workflow</div>
        <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(
          safeString(result.workflow_name)
        )}</div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div class="text-xs text-slate-500">committed</div>
        <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(
          String(!!result.committed)
        )}</div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <div class="text-xs text-slate-500">rollback</div>
        <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(
          `attempted=${!!result.rollback_attempted} succeeded=${!!result.rollback_succeeded}`
        )}</div>
      </div>
    </div>
  `;
  const blockCards = blocks
    .map((block, idx) => {
      const isFailed = failedIdx === idx;
      const rollbackErrors = Array.isArray(block.rollback_errors)
        ? block.rollback_errors
        : [];
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
      return `
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm font-semibold text-slate-900">block[${idx}] ${escapeHtml(
            safeString(block.block_name)
          )}</div>
          <div class="text-xs text-slate-600">committed=${escapeHtml(
            String(!!block.committed)
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
        ${failedSummary}
      </section>
    `;
    })
    .join("");
  return `<div class="grid gap-3">${summary}${blockCards}</div>`;
}

function txWorkflowKindLabel(kind) {
  return kind === "show"
    ? t("txWorkflowBlockKindShow")
    : t("txWorkflowBlockKindConfig");
}

function txWorkflowRollbackPolicyLabel(rollbackPolicy) {
  if (typeof rollbackPolicy === "string") {
    if (rollbackPolicy === "none") return t("txWorkflowBlockRollbackNone");
    if (rollbackPolicy === "whole_resource") return t("txWorkflowBlockRollbackWhole");
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
      t("txBlockVisualEmpty")
    )}</div>`;
  }
  const steps = Array.isArray(txBlock.steps) ? txBlock.steps : [];
  const modes = Array.from(
    new Set(
      steps
        .map((step) => txOperationMode(txStepRunOperation(step)))
        .filter((s) => !!s)
    )
  );
  const modeText = modes.length ? modes.join(", ") : "Config";
  const rollbackText = txWorkflowRollbackPolicyLabel(txBlock.rollback_policy);
  const wholeResource =
    txBlock.rollback_policy &&
    typeof txBlock.rollback_policy === "object" &&
    txBlock.rollback_policy.whole_resource
      ? txBlock.rollback_policy.whole_resource
      : null;
  const wholeResourceOp = txWholeResourceRollbackOperation(txBlock.rollback_policy);
  const summary = `
    <div class="grid gap-2 md:grid-cols-3">
      ${renderTxWorkflowPreviewMeta(
        t("txBlockSummaryName"),
        txBlock.name || "tx-block"
      )}
      ${renderTxWorkflowPreviewMeta(
        t("txBlockSummaryKind"),
        txWorkflowKindLabel(txBlock.kind)
      )}
      ${renderTxWorkflowPreviewMeta(t("txBlockSummaryMode"), modeText)}
      ${renderTxWorkflowPreviewMeta(t("txBlockSummaryRollback"), rollbackText)}
      ${renderTxWorkflowPreviewMeta(
        t("txBlockSummaryFailFast"),
        String(txBlock.fail_fast !== false)
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
            txOperationDescription(wholeResourceOp) || "-"
          )}
          ${renderTxWorkflowPreviewMeta(
            t("txWorkflowVisualTriggerStep"),
            wholeResource.trigger_step_index != null
              ? wholeResource.trigger_step_index
              : 0
          )}
          ${renderTxWorkflowPreviewMeta(
            t("txWorkflowSummaryMode"),
            txOperationMode(wholeResourceOp) || modeText
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
              `${t("txWorkflowVisualStep")} ${idx + 1}`
            )}</div>
            <div class="inline-flex flex-wrap items-center gap-1">
              <span class="tx-workflow-chip">${escapeHtml(
                `${t("txWorkflowSummaryMode")}: ${
                  txOperationMode(runOperation) || "Config"
                }`
              )}</span>
              <span class="tx-workflow-chip">${escapeHtml(
                `${t("txWorkflowVisualTimeout")}: ${timeoutLabel}`
              )}</span>
              ${
                step && step.rollback_on_failure
                  ? `<span class="tx-workflow-chip">${escapeHtml(
                      t("txWorkflowRollbackOnFailureLabel")
                    )}</span>`
                  : ""
              }
            </div>
          </div>
          <div class="mt-2 grid gap-2 md:grid-cols-2">
            <div class="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
              <div class="text-[11px] font-semibold text-cyan-700">${escapeHtml(
                t("fieldCommand")
              )}</div>
              <div class="mt-1 break-all font-mono text-xs text-slate-900">${escapeHtml(
                txOperationDescription(runOperation)
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
        t("txWorkflowBuilderEmpty")
      )}</div>`;
  const resultSection =
    txResult && typeof txResult === "object"
      ? `
    <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div class="text-sm font-semibold text-slate-900">${escapeHtml(
        t("txBlockResultTitle")
      )}</div>
      <div class="mt-2 grid gap-2 md:grid-cols-3">
        ${renderTxWorkflowPreviewMeta(
          t("txBlockResultCommitted"),
          String(!!txResult.committed)
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txBlockResultExecutedSteps"),
          txResult.executed_steps != null ? txResult.executed_steps : "-"
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txBlockResultRollback"),
          `attempted=${!!txResult.rollback_attempted} succeeded=${!!txResult.rollback_succeeded}`
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txBlockResultRollbackSteps"),
          txResult.rollback_steps != null ? txResult.rollback_steps : "-"
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txBlockResultFailedStep"),
          txResult.failed_step != null ? txResult.failed_step : "-"
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txBlockResultFailureReason"),
          txResult.failure_reason || "-"
        )}
      </div>
      ${
        Array.isArray(txResult.rollback_errors) && txResult.rollback_errors.length
          ? `<div class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <div class="font-semibold">${escapeHtml(
                t("txBlockResultRollbackErrors")
              )}</div>
              <div class="mt-1 break-all">${escapeHtml(
                txResult.rollback_errors.join(" | ")
              )}</div>
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
          t("txBlockSummarySteps")
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
        safeString(value)
      )}</div>
    </div>
  `;
}

function renderTxWorkflowPreview(workflow) {
  if (!workflow || typeof workflow !== "object") {
    return `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("txWorkflowVisualEmpty")
    )}</div>`;
  }
  const blocks = Array.isArray(workflow.blocks) ? workflow.blocks : [];
  const summary = `
    <div class="grid gap-2 md:grid-cols-3">
      ${renderTxWorkflowPreviewMeta(
        t("txWorkflowVisualName"),
        workflow.name || "-"
      )}
      ${renderTxWorkflowPreviewMeta(t("txWorkflowVisualBlocks"), blocks.length)}
      ${renderTxWorkflowPreviewMeta(
        t("txWorkflowVisualFailFast"),
        String(workflow.fail_fast !== false)
      )}
    </div>
  `;
  const blockCards = blocks
    .map((block, blockIdx) => {
      const steps = Array.isArray(block && block.steps) ? block.steps : [];
      const modes = Array.from(
        new Set(
          steps
            .map((step) => txOperationMode(txStepRunOperation(step)))
            .filter((s) => !!s)
        )
      );
      const modeText = modes.length ? modes.join(", ") : "Config";
      const rollbackText = txWorkflowRollbackPolicyLabel(
        block ? block.rollback_policy : null
      );
      const wholeResource =
        block &&
        block.rollback_policy &&
        typeof block.rollback_policy === "object" &&
        block.rollback_policy.whole_resource
          ? block.rollback_policy.whole_resource
          : null;
      const wholeResourceOp = txWholeResourceRollbackOperation(
        block ? block.rollback_policy : null
      );
      const wholeResourceRow = wholeResource
        ? `
      <div class="grid gap-2 md:grid-cols-3">
        ${renderTxWorkflowPreviewMeta(
          t("txWorkflowVisualUndo"),
          txOperationDescription(wholeResourceOp) || "-"
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txWorkflowVisualTriggerStep"),
          wholeResource.trigger_step_index != null
            ? wholeResource.trigger_step_index
            : 0
        )}
        ${renderTxWorkflowPreviewMeta(
          t("txWorkflowSummaryMode"),
          txOperationMode(wholeResourceOp) || modeText
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
                `${t("txWorkflowVisualStep")} ${stepIdx + 1}`
              )}</div>
              <div class="inline-flex flex-wrap items-center gap-1">
                <span class="tx-workflow-chip">${escapeHtml(
                  `${t("txWorkflowSummaryMode")}: ${
                    txOperationMode(runOperation) || "Config"
                  }`
                )}</span>
                <span class="tx-workflow-chip">${escapeHtml(
                  `${t("txWorkflowVisualTimeout")}: ${timeoutLabel}`
                )}</span>
                ${
                  step && step.rollback_on_failure
                    ? `<span class="tx-workflow-chip">${escapeHtml(
                        t("txWorkflowRollbackOnFailureLabel")
                      )}</span>`
                    : ""
                }
              </div>
            </div>
            <div class="mt-2 grid gap-2 md:grid-cols-2">
              <div class="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2">
                  <div class="text-[11px] font-semibold text-cyan-700">${escapeHtml(
                    t("fieldCommand")
                  )}</div>
                  <div class="mt-1 break-all font-mono text-xs text-slate-900">${escapeHtml(
                    txOperationDescription(runOperation)
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
            t("txWorkflowBuilderEmpty")
          )}</div>`;
      return `
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-sm font-semibold text-slate-900">block[${blockIdx}] ${escapeHtml(
            safeString((block && block.name) || "tx-block")
          )}</div>
          <div class="inline-flex flex-wrap items-center gap-1">
            <span class="tx-workflow-chip">${escapeHtml(
              `${t("txWorkflowSummaryKind")}: ${txWorkflowKindLabel(
                block && block.kind
              )}`
            )}</span>
            <span class="tx-workflow-chip">${escapeHtml(
              `${t("txWorkflowVisualRollbackPolicy")}: ${rollbackText}`
            )}</span>
            <span class="tx-workflow-chip">${escapeHtml(
              `${t("txWorkflowSummaryMode")}: ${modeText}`
            )}</span>
            <span class="tx-workflow-chip">${escapeHtml(
              `${t("txWorkflowVisualFailFast")}: ${String(
                block && block.fail_fast !== false
              )}`
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
      t("txWorkflowVisualEmpty")
    )}</div>`;
  return `<div class="grid gap-3">${summary}${blocksView}</div>`;
}

function inventoryGroupTargets(group) {
  if (Array.isArray(group)) return group;
  if (group && typeof group === "object" && Array.isArray(group.targets)) {
    return group.targets;
  }
  return [];
}

function orchestrationStageStrategyLabel(strategy) {
  return safeString(strategy || "serial") === "parallel"
    ? t("orchestrationStrategyParallel")
    : t("orchestrationStrategySerial");
}

function orchestrationActionSummary(action) {
  if (!action || typeof action !== "object") return "-";
  if (action.kind === "tx_block") {
    const parts = [];
    if (action.template) parts.push(`template=${action.template}`);
    if (Array.isArray(action.commands) && action.commands.length) {
      parts.push(`commands=${action.commands.length}`);
    }
    if (action.mode) parts.push(`mode=${action.mode}`);
    return parts.join(", ") || "tx_block";
  }
  if (action.kind === "tx_workflow") {
    if (action.workflow_file) return `workflow_file=${action.workflow_file}`;
    return "inline workflow";
  }
  return safeString(action.kind || "-");
}

function orchestrationStatusLabel(status) {
  const normalized = safeString(status || "-").toLowerCase();
  if (normalized === "success") return t("orchestrationStatusSuccess");
  if (normalized === "failed") return t("orchestrationStatusFailed");
  if (normalized === "skipped") return t("orchestrationStatusSkipped");
  return safeString(status || "-");
}

function orchestrationStatusBadge(status) {
  const normalized = safeString(status || "-").toLowerCase();
  let cls = "border-slate-200 bg-slate-50 text-slate-700";
  if (normalized === "success") {
    cls = "border-emerald-200 bg-emerald-50 text-emerald-700";
  } else if (normalized === "failed") {
    cls = "border-rose-200 bg-rose-50 text-rose-700";
  } else if (normalized === "skipped") {
    cls = "border-amber-200 bg-amber-50 text-amber-700";
  }
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}">${escapeHtml(
    orchestrationStatusLabel(normalized)
  )}</span>`;
}

function orchestrationJsonText(value) {
  if (value == null) return "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return safeString(value);
  }
}

function renderOrchestrationJsonSection(title, value) {
  return `
    <section class="rounded-xl border border-slate-200 bg-white p-3">
      <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(title)}</div>
      <pre class="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">${escapeHtml(
        orchestrationJsonText(value)
      )}</pre>
    </section>
  `;
}

function resolveOrchestrationTargetsPreview(stage, inventory) {
  const labels = [];
  const groups = inventory && inventory.groups && typeof inventory.groups === "object"
    ? inventory.groups
    : {};
  const groupNames = Array.isArray(stage && stage.target_groups)
    ? stage.target_groups
    : [];
  for (const groupName of groupNames) {
    const group = groups[groupName];
    for (const item of inventoryGroupTargets(group)) {
      if (typeof item === "string") {
        labels.push(item);
      } else if (item && typeof item === "object") {
        labels.push(item.name || item.connection || item.host || "target");
      }
    }
  }
  const directTargets = Array.isArray(stage && stage.targets) ? stage.targets : [];
  for (const item of directTargets) {
    if (typeof item === "string") {
      labels.push(item);
    } else if (item && typeof item === "object") {
      labels.push(item.name || item.connection || item.host || "target");
    }
  }
  return labels;
}

function renderOrchestrationPreviewHtml(plan, inventory) {
  if (!plan || typeof plan !== "object") {
    return `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("orchestrationVisualEmpty")
    )}</div>`;
  }
  const stages = Array.isArray(plan.stages) ? plan.stages : [];
  const groupCount =
    inventory && inventory.groups && typeof inventory.groups === "object"
      ? Object.keys(inventory.groups).length
      : 0;
  const summary = `
    <div class="grid gap-2 md:grid-cols-4">
      ${renderTxWorkflowPreviewMeta(
        t("orchestrationVisualName"),
        plan.name || "-"
      )}
      ${renderTxWorkflowPreviewMeta(
        t("orchestrationVisualStages"),
        stages.length
      )}
      ${renderTxWorkflowPreviewMeta(
        t("orchestrationVisualFailFast"),
        String(plan.fail_fast !== false)
      )}
      ${renderTxWorkflowPreviewMeta(
        t("orchestrationVisualGroups"),
        groupCount
      )}
    </div>
  `;
  const stageCards = stages
    .map((stage, idx) => {
      const labels = resolveOrchestrationTargetsPreview(stage, inventory);
      const targetTags = labels.length
        ? labels
            .map(
              (label) =>
                `<span class="tx-workflow-chip">${escapeHtml(safeString(label))}</span>`
            )
            .join("")
        : `<span class="text-xs text-slate-500">-</span>`;
      return `
        <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-sm font-semibold text-slate-900">stage[${idx}] ${escapeHtml(
              safeString(stage && stage.name)
            )}</div>
            <div class="inline-flex flex-wrap items-center gap-1">
              <span class="tx-workflow-chip">${escapeHtml(
                `${t("orchestrationStageStrategy")}: ${orchestrationStageStrategyLabel(
                  stage && stage.strategy
                )}`
              )}</span>
              <span class="tx-workflow-chip">${escapeHtml(
                `${t("orchestrationStageTargets")}: ${labels.length}`
              )}</span>
            </div>
          </div>
          <div class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            ${escapeHtml(t("orchestrationStageAction"))}: ${escapeHtml(
              orchestrationActionSummary(stage && stage.action)
            )}
          </div>
          ${
            Array.isArray(stage && stage.target_groups) && stage.target_groups.length
              ? `<div class="mt-2 text-xs text-slate-500">groups: ${escapeHtml(
                  stage.target_groups.join(", ")
                )}</div>`
              : ""
          }
          <div class="mt-2 flex flex-wrap gap-2">${targetTags}</div>
        </section>
      `;
    })
    .join("");
  return `<div class="grid gap-3">${summary}${stageCards || `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
    t("orchestrationVisualEmpty")
  )}</div>`}</div>`;
}

function renderOrchestrationStageDetail(detail) {
  const stage = (detail && detail.stage) || {};
  const targets = Array.isArray(stage.results) ? stage.results : [];
  const targetRows = targets.length
    ? targets
        .map(
          (target) => `
            <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="text-sm font-semibold text-slate-900">${escapeHtml(
                  safeString(target.label)
                )}</div>
                ${orchestrationStatusBadge(target.status)}
              </div>
              <div class="mt-1 font-mono text-xs text-slate-600 break-all">
                host=${escapeHtml(safeString(target.host || "-"))}
                connection=${escapeHtml(safeString(target.connection_name || "-"))}
                op=${escapeHtml(safeString(target.operation || "-"))}
                duration_ms=${escapeHtml(safeString(target.duration_ms || 0))}
              </div>
              ${
                target.error
                  ? `<div class="mt-1 text-xs text-rose-700 break-all">${escapeHtml(
                      target.error
                    )}</div>`
                  : ""
              }
            </div>
          `
        )
        .join("")
    : `<div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">-</div>`;

  return `
    <div class="grid gap-3">
      <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
          t("detailSectionBasic")
        )}</div>
        <div class="grid gap-2 md:grid-cols-2">
          ${detailField(
            t("orchestrationVisualName"),
            detail && detail.planName ? detail.planName : "-"
          )}
          ${detailField(
            t("orchestrationDetailLabelStage"),
            `stage[${detail && typeof detail.stageIndex === "number" ? detail.stageIndex : 0}] ${safeString(stage.name)}`
          )}
          <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
              t("orchestrationDetailLabelStatus")
            )}</div>
            <div class="mt-1">${orchestrationStatusBadge(stage.status)}</div>
          </div>
          ${detailField(
            t("orchestrationStageStrategy"),
            orchestrationStageStrategyLabel(stage.strategy)
          )}
          <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
              t("orchestrationVisualFailFast")
            )}</div>
            <div class="mt-1">${detailBoolBadge(stage.fail_fast)}</div>
          </div>
          ${detailField(
            t("orchestrationStageAction"),
            stage.action_summary || stage.action_kind || "-"
          )}
          ${detailField(t("orchestrationStatusSuccess"), stage.targets_succeeded ?? 0)}
          ${detailField(t("orchestrationStatusFailed"), stage.targets_failed ?? 0)}
          ${detailField(t("orchestrationStatusSkipped"), stage.targets_skipped ?? 0)}
        </div>
      </section>
      <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
          t("orchestrationDetailSectionTargets")
        )}</div>
        <div class="grid gap-2">${targetRows}</div>
      </section>
      ${renderOrchestrationJsonSection(t("detailSectionRaw"), stage)}
    </div>
  `;
}

function renderOrchestrationTargetDetail(detail) {
  const target = (detail && detail.target) || {};
  const payloadCards = [];
  if (target.tx_result != null) {
    payloadCards.push(
      renderOrchestrationJsonSection(t("orchestrationPayloadTxResult"), target.tx_result)
    );
  }
  if (target.workflow_result != null) {
    payloadCards.push(
      renderOrchestrationJsonSection(
        t("orchestrationPayloadWorkflowResult"),
        target.workflow_result
      )
    );
  }
  const payloadSection = payloadCards.length
    ? `
      <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
          t("orchestrationDetailSectionPayload")
        )}</div>
        <div class="grid gap-3">${payloadCards.join("")}</div>
      </section>
    `
    : `
      <section class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        ${escapeHtml(t("orchestrationDetailNoPayload"))}
      </section>
    `;

  return `
    <div class="grid gap-3">
      <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
          t("detailSectionBasic")
        )}</div>
        <div class="grid gap-2 md:grid-cols-2">
          ${detailField(
            t("orchestrationVisualName"),
            detail && detail.planName ? detail.planName : "-"
          )}
          ${detailField(
            t("orchestrationDetailLabelStage"),
            `stage[${detail && typeof detail.stageIndex === "number" ? detail.stageIndex : 0}] ${safeString(
              detail && detail.stageName ? detail.stageName : "-"
            )}`
          )}
          ${detailField(
            t("orchestrationDetailLabelTarget"),
            `target[${detail && typeof detail.targetIndex === "number" ? detail.targetIndex : 0}] ${safeString(
              target.label
            )}`
          )}
          <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div class="text-[11px] font-semibold text-slate-500">${escapeHtml(
              t("orchestrationDetailLabelStatus")
            )}</div>
            <div class="mt-1">${orchestrationStatusBadge(target.status)}</div>
          </div>
          ${detailField(
            t("orchestrationDetailLabelConnection"),
            target.connection_name || "-"
          )}
          ${detailField(t("orchestrationDetailLabelHost"), target.host || "-", true)}
          ${detailField(
            t("orchestrationDetailLabelOperation"),
            target.operation || "-",
            true
          )}
          ${detailField(
            t("orchestrationDetailLabelDurationMs"),
            target.duration_ms ?? 0,
            true
          )}
        </div>
      </section>
      ${
        target.error
          ? `
            <section class="rounded-xl border border-rose-200 bg-rose-50 p-3">
              <div class="mb-2 text-xs font-semibold text-rose-700">${escapeHtml(
                t("detailLabelError")
              )}</div>
              <pre class="whitespace-pre-wrap break-all text-xs text-rose-800">${escapeHtml(
                safeString(target.error)
              )}</pre>
            </section>
          `
          : ""
      }
      ${payloadSection}
      ${renderOrchestrationJsonSection(t("detailSectionRaw"), target)}
    </div>
  `;
}

function renderOrchestrationResult(result) {
  if (!result || typeof result !== "object") {
    return `<pre class="output">${escapeHtml(t("requestFailed"))}</pre>`;
  }
  orchestrationDetailMap.clear();
  const stages = Array.isArray(result.stages) ? result.stages : [];
  const summary = `
    <div class="grid gap-2 md:grid-cols-4">
      ${renderTxWorkflowPreviewMeta(
        t("orchestrationVisualName"),
        result.plan_name || "-"
      )}
      ${renderTxWorkflowPreviewMeta(
        t("orchestrationResultSuccess"),
        String(!!result.success)
      )}
      ${renderTxWorkflowPreviewMeta(
        t("orchestrationVisualStages"),
        `${result.executed_stages || 0}/${result.total_stages || stages.length}`
      )}
      ${renderTxWorkflowPreviewMeta(
        t("orchestrationVisualFailFast"),
        String(result.fail_fast !== false)
      )}
    </div>
  `;
  const stageCards = stages
    .map((stage, idx) => {
      const stageDetailId = rememberOrchestrationDetail({
        kind: "stage",
        planName: result.plan_name || "-",
        stageIndex: idx,
        stage,
      });
      const targets = Array.isArray(stage.results) ? stage.results : [];
      const targetRows = targets
        .map((target, targetIdx) => {
          const targetDetailId = rememberOrchestrationDetail({
            kind: "target",
            planName: result.plan_name || "-",
            stageName: stage.name || "-",
            stageIndex: idx,
            targetIndex: targetIdx,
            target,
          });
          return `
            <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="font-semibold text-slate-900">${escapeHtml(
                  safeString(target.label)
                )}</div>
                <div class="inline-flex items-center gap-2">
                  ${orchestrationStatusBadge(target.status)}
                  <button
                    class="mini-btn js-orchestration-detail-btn"
                    type="button"
                    data-orchestration-detail-id="${escapeHtml(targetDetailId)}"
                  >${escapeHtml(t("orchestrationDetailBtn"))}</button>
                </div>
              </div>
              <div class="mt-1 break-all">host=${escapeHtml(
                safeString(target.host || "-")
              )} op=${escapeHtml(
                safeString(target.operation || "-")
              )} duration_ms=${escapeHtml(safeString(target.duration_ms || 0))}</div>
              ${
                target.error
                  ? `<div class="mt-1 text-rose-700">${escapeHtml(target.error)}</div>`
                  : ""
              }
            </div>
          `;
        })
        .join("");
      return `
        <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-sm font-semibold text-slate-900">stage[${idx}] ${escapeHtml(
              safeString(stage.name)
            )}</div>
            <div class="inline-flex flex-wrap items-center gap-2">
              ${orchestrationStatusBadge(stage.status)}
              <div class="inline-flex flex-wrap items-center gap-1">
              <span class="tx-workflow-chip">${escapeHtml(
                `ok=${safeString(stage.targets_succeeded)}`
              )}</span>
              <span class="tx-workflow-chip">${escapeHtml(
                `failed=${safeString(stage.targets_failed)}`
              )}</span>
              <span class="tx-workflow-chip">${escapeHtml(
                `skipped=${safeString(stage.targets_skipped)}`
              )}</span>
              </div>
              <button
                class="mini-btn js-orchestration-detail-btn"
                type="button"
                data-orchestration-detail-id="${escapeHtml(stageDetailId)}"
              >${escapeHtml(t("orchestrationDetailBtn"))}</button>
            </div>
          </div>
          <div class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            ${escapeHtml(t("orchestrationStageAction"))}: ${escapeHtml(
              safeString(stage.action_summary || stage.action_kind)
            )}
          </div>
          <div class="mt-2 grid gap-2">${targetRows || `<div class="text-xs text-slate-500">-</div>`}</div>
        </section>
      `;
    })
    .join("");
  return `<div class="grid gap-3"><div class="text-sm font-semibold text-slate-900">${escapeHtml(
    t("orchestrationResultTitle")
  )}</div>${summary}${stageCards}</div>`;
}

function successBadge(event) {
  if (event.kind !== "command_output") return '<span class="text-slate-400">-</span>';
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
          t("flowBefore")
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
          t("flowAfter")
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
      const command = event.kind === "command_output" ? safeString(event.command) : "-";
      const modeRaw = event.kind === "command_output" ? displayMode(event.mode) : "-";
      const mode = modeRaw || "-";
      const detailId = `entry-${baseSeq + idx}`;
      detailEntryMap.set(detailId, entry);
      const isFailed = event.kind === "command_output" && event.success === false;
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
              detailId
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
