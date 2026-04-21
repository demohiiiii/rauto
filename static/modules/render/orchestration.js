/**
 * render_orchestration.js - orchestration preview/detail/result render helpers
 */

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
    const flowTemplateName =
      typeof action.flow_template_name === "string"
        ? action.flow_template_name.trim()
        : "";
    const flowTemplateContent =
      typeof action.flow_template_content === "string"
        ? action.flow_template_content.trim()
        : "";
    if (flowTemplateName) {
      parts.push(`flow_template=${flowTemplateName}`);
    } else if (flowTemplateContent) {
      parts.push("flow_template_content=inline");
    }
    if (
      action.flow_vars &&
      typeof action.flow_vars === "object" &&
      !Array.isArray(action.flow_vars)
    ) {
      parts.push(`flow_vars=${Object.keys(action.flow_vars).length}`);
    }
    if (action.template) parts.push(`template=${action.template}`);
    if (Array.isArray(action.commands) && action.commands.length) {
      parts.push(`commands=${action.commands.length}`);
    }
    if (action.tx_block_template_name) {
      parts.push(`tx_block_template=${action.tx_block_template_name}`);
    } else if (action.tx_block_template_content) {
      parts.push("tx_block_template_content=inline");
    }
    if (action.mode) parts.push(`mode=${action.mode}`);
    return parts.join(", ") || "tx_block";
  }
  if (action.kind === "tx_workflow") {
    if (action.workflow_template_name) {
      return `workflow_template=${action.workflow_template_name}`;
    }
    if (action.workflow_template_content) {
      return "workflow_template_content=inline";
    }
    if (action.workflow_file) return `workflow_file=${action.workflow_file}`;
    if (action.workflow && typeof action.workflow === "object") {
      return "inline workflow";
    }
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

function orchestrationJsonPrimitiveText(value) {
  if (value == null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return safeString(value);
}

function renderOrchestrationJsonTreeNode(value, label = "", depth = 0) {
  const keyLabel = label || "value";
  if (value == null || typeof value !== "object") {
    return `
      <div class="grid gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5">
        <div class="font-mono text-xs text-slate-600">${escapeHtml(keyLabel)}</div>
        <div class="font-mono text-xs text-slate-900 break-all whitespace-pre-wrap">${escapeHtml(
          orchestrationJsonPrimitiveText(value)
        )}</div>
      </div>
    `;
  }

  if (Array.isArray(value)) {
    const count = value.length;
    const children = count
      ? value
          .map((item, idx) =>
            renderOrchestrationJsonTreeNode(item, `[${idx}]`, depth + 1)
          )
          .join("")
      : `<div class="rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-500">[]</div>`;
    return `
      <details class="rounded-md border border-slate-200 bg-slate-50" ${
        depth <= 1 ? "open" : ""
      }>
        <summary class="cursor-pointer px-2 py-1.5 font-mono text-xs text-slate-700">
          ${escapeHtml(keyLabel)} <span class="text-slate-500">[${count}]</span>
        </summary>
        <div class="grid gap-2 border-t border-slate-200 px-2 py-2">
          ${children}
        </div>
      </details>
    `;
  }

  const entries = Object.entries(value);
  const children = entries.length
    ? entries
        .map(([key, item]) => renderOrchestrationJsonTreeNode(item, key, depth + 1))
        .join("")
    : `<div class="rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-500">{}</div>`;
  return `
    <details class="rounded-md border border-slate-200 bg-slate-50" ${
      depth <= 1 ? "open" : ""
    }>
      <summary class="cursor-pointer px-2 py-1.5 font-mono text-xs text-slate-700">
        ${escapeHtml(keyLabel)} <span class="text-slate-500">{${entries.length}}</span>
      </summary>
      <div class="grid gap-2 border-t border-slate-200 px-2 py-2">
        ${children}
      </div>
    </details>
  `;
}

function renderOrchestrationJsonSection(title, value) {
  const tree = renderOrchestrationJsonTreeNode(value, "payload", 0);
  return `
    <section class="rounded-xl border border-slate-200 bg-white p-3">
      <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(title)}</div>
      <div class="max-h-96 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
        ${tree}
      </div>
      <details class="mt-2">
        <summary class="btn btn-xs">${escapeHtml(
          t("orchestrationPayloadRawToggle")
        )}</summary>
        <pre class="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs text-slate-100">${escapeHtml(
          orchestrationJsonText(value)
        )}</pre>
      </details>
    </section>
  `;
}

function parseJsonObjectSafely(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" ? value : null;
  } catch (_) {
    return null;
  }
}

function orchestrationOperationText(operation) {
  if (!operation || typeof operation !== "object") return "";
  if (typeof txOperationDescription === "function") {
    const text = safeString(txOperationDescription(operation)).trim();
    if (text) return text;
  }
  if (typeof operation.command === "string") return operation.command.trim();
  if (operation.kind === "flow" && Array.isArray(operation.steps)) {
    const first = safeString(operation.steps[0] && operation.steps[0].command).trim();
    if (first) return first;
    return `${operation.steps.length} steps`;
  }
  if (operation.kind === "template" && operation.template) {
    return safeString(operation.template.name || "template").trim();
  }
  return "";
}

function collectTxBlockCommandPreview(block, prefix = "") {
  if (!block || typeof block !== "object") return [];
  const steps = Array.isArray(block.steps) ? block.steps : [];
  const items = [];
  steps.forEach((step, idx) => {
    const run = step && typeof step === "object" ? step.run : null;
    const commandText = orchestrationOperationText(run);
    if (!commandText) return;
    const head = prefix ? `${prefix} ` : "";
    items.push(`${head}step[${idx}] ${commandText}`);
  });
  return items;
}

function parseInlineFlowTemplateCommands(content) {
  if (typeof content !== "string" || !content.trim()) return [];
  const commands = [];
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("command")) continue;
    const match = line.match(/^command\s*=\s*"(.*)"\s*$/);
    if (match && match[1]) {
      commands.push(match[1]);
    }
  }
  return commands;
}

function collectTxWorkflowCommandPreview(workflow) {
  if (!workflow || typeof workflow !== "object") return [];
  const blocks = Array.isArray(workflow.blocks) ? workflow.blocks : [];
  const items = [];
  blocks.forEach((block, blockIdx) => {
    if (block && typeof block.tx_block_template_name === "string" && block.tx_block_template_name.trim()) {
      items.push(
        `[block ${blockIdx}] ${t("orchestrationCommandPreviewTemplateRef")}: tx_block_template=${block.tx_block_template_name.trim()}`
      );
      return;
    }
    items.push(
      ...collectTxBlockCommandPreview(
        block,
        `block[${blockIdx}]`
      )
    );
  });
  return items;
}

function orchestrationActionCommandPreviewItems(action) {
  if (!action || typeof action !== "object") return [];
  if (action.kind === "tx_block") {
    if (Array.isArray(action.commands) && action.commands.length) {
      return action.commands
        .map((cmd, idx) => `step[${idx}] ${safeString(cmd).trim()}`)
        .filter((line) => !line.endsWith(" "));
    }
    if (
      typeof action.tx_block_template_content === "string" &&
      action.tx_block_template_content.trim()
    ) {
      const inlineBlock = parseJsonObjectSafely(action.tx_block_template_content);
      if (inlineBlock) {
        return collectTxBlockCommandPreview(inlineBlock);
      }
    }
    if (
      typeof action.flow_template_content === "string" &&
      action.flow_template_content.trim()
    ) {
      const flowCommands = parseInlineFlowTemplateCommands(action.flow_template_content);
      if (flowCommands.length) {
        return flowCommands.map((cmd, idx) => `step[${idx}] ${cmd}`);
      }
    }
    if (typeof action.flow_template_name === "string" && action.flow_template_name.trim()) {
      return [
        `${t("orchestrationCommandPreviewTemplateRef")}: flow_template=${action.flow_template_name.trim()}`,
      ];
    }
    if (
      typeof action.tx_block_template_name === "string" &&
      action.tx_block_template_name.trim()
    ) {
      return [
        `${t("orchestrationCommandPreviewTemplateRef")}: tx_block_template=${action.tx_block_template_name.trim()}`,
      ];
    }
    return [];
  }

  if (action.kind === "tx_workflow") {
    if (action.workflow && typeof action.workflow === "object") {
      return collectTxWorkflowCommandPreview(action.workflow);
    }
    if (
      typeof action.workflow_template_content === "string" &&
      action.workflow_template_content.trim()
    ) {
      const inlineWorkflow = parseJsonObjectSafely(action.workflow_template_content);
      if (inlineWorkflow) {
        return collectTxWorkflowCommandPreview(inlineWorkflow);
      }
    }
    if (
      typeof action.workflow_template_name === "string" &&
      action.workflow_template_name.trim()
    ) {
      return [
        `${t("orchestrationCommandPreviewTemplateRef")}: workflow_template=${action.workflow_template_name.trim()}`,
      ];
    }
    if (typeof action.workflow_file === "string" && action.workflow_file.trim()) {
      return [
        `${t("orchestrationCommandPreviewTemplateRef")}: workflow_file=${action.workflow_file.trim()}`,
      ];
    }
  }
  return [];
}

function renderOrchestrationActionCommandPreview(action) {
  const items = orchestrationActionCommandPreviewItems(action);
  const maxItems = 24;
  const trimmed = items.slice(0, maxItems);
  const rows = trimmed
    .map(
      (line) => `<div class="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 font-mono text-xs text-cyan-900 break-all">${escapeHtml(
        line
      )}</div>`
    )
    .join("");
  const more =
    items.length > maxItems
      ? `<div class="text-[11px] text-slate-500">${escapeHtml(
          `${t("orchestrationCommandPreviewMorePrefix")} ${items.length - maxItems}`
        )}</div>`
      : "";
  const body = rows || `<div class="text-xs text-slate-500">${escapeHtml(
    t("orchestrationCommandPreviewEmpty")
  )}</div>`;
  return `
    <div class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
      <div class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(
        t("orchestrationCommandPreviewTitle")
      )}</div>
      <div class="grid gap-1">${body}</div>
      ${more}
    </div>
  `;
}

function resolveOrchestrationJobTargetsPreview(job, inventory) {
  const labels = [];
  const groups = inventory && inventory.groups && typeof inventory.groups === "object"
    ? inventory.groups
    : {};
  const groupNames = Array.isArray(job && job.target_groups)
    ? job.target_groups
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
  const directTargets = Array.isArray(job && job.targets) ? job.targets : [];
  for (const item of directTargets) {
    if (typeof item === "string") {
      labels.push(item);
    } else if (item && typeof item === "object") {
      labels.push(item.name || item.connection || item.host || "target");
    }
  }
  return labels;
}

function resolveOrchestrationStageTargetsPreview(stage, inventory) {
  const jobs = Array.isArray(stage && stage.jobs) ? stage.jobs : [];
  return jobs.flatMap((job) => resolveOrchestrationJobTargetsPreview(job, inventory));
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
      const jobs = Array.isArray(stage && stage.jobs) ? stage.jobs : [];
      const labels = resolveOrchestrationStageTargetsPreview(stage, inventory);
      const stageTargetTags = labels.length
        ? labels
            .map(
              (label) =>
                `<span class="tx-workflow-chip">${escapeHtml(safeString(label))}</span>`
            )
            .join("")
        : `<span class="text-xs text-slate-500">-</span>`;
      const jobCards = jobs.length
        ? jobs
            .map((job, jobIdx) => {
              const jobLabels = resolveOrchestrationJobTargetsPreview(job, inventory);
              const targetTags = jobLabels.length
                ? jobLabels
                    .map(
                      (label) =>
                        `<span class="tx-workflow-chip">${escapeHtml(
                          safeString(label)
                        )}</span>`
                    )
                    .join("")
                : `<span class="text-xs text-slate-500">-</span>`;
              return `
                <section class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="text-xs font-semibold text-slate-900">job[${jobIdx}] ${escapeHtml(
                      safeString(job && job.name) || "-"
                    )}</div>
                    <div class="inline-flex flex-wrap items-center gap-1">
                      <span class="tx-workflow-chip">${escapeHtml(
                        `${t("orchestrationStageStrategy")}: ${orchestrationStageStrategyLabel(
                          job && job.strategy
                        )}`
                      )}</span>
                      <span class="tx-workflow-chip">${escapeHtml(
                        `${t("orchestrationStageTargets")}: ${jobLabels.length}`
                      )}</span>
                    </div>
                  </div>
                  <div class="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
                    ${escapeHtml(t("orchestrationStageAction"))}: ${escapeHtml(
                      orchestrationActionSummary(job && job.action)
                    )}
                  </div>
                  ${renderOrchestrationActionCommandPreview(job && job.action)}
                  ${
                    Array.isArray(job && job.target_groups) && job.target_groups.length
                      ? `<div class="mt-2 text-xs text-slate-500">groups: ${escapeHtml(
                          job.target_groups.join(", ")
                        )}</div>`
                      : ""
                  }
                  <div class="mt-2 flex flex-wrap gap-2">${targetTags}</div>
                </section>
              `;
            })
            .join("")
        : `<div class="text-xs text-slate-500">-</div>`;
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
              <span class="tx-workflow-chip">${escapeHtml(
                `${t("orchestrationStageJobs")}: ${jobs.length}`
              )}</span>
            </div>
          </div>
          <div class="mt-2 flex flex-wrap gap-2">${stageTargetTags}</div>
          <div class="mt-2 grid gap-2">${jobCards}</div>
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
  const jobs = Array.isArray(stage.jobs) ? stage.jobs : [];
  const jobRows = jobs.length
    ? jobs
        .map((job, jobIdx) => {
          const targets = Array.isArray(job && job.results) ? job.results : [];
          const targetRows = targets.length
            ? targets
                .map(
                  (target) => `
                    <div class="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                      <div class="flex flex-wrap items-center justify-between gap-1">
                        <div class="text-xs font-semibold text-slate-900">${escapeHtml(
                          safeString(target.label)
                        )}</div>
                        ${orchestrationStatusBadge(target.status)}
                      </div>
                      <div class="mt-1 font-mono text-[11px] text-slate-600 break-all">
                        host=${escapeHtml(safeString(target.host || "-"))}
                        op=${escapeHtml(safeString(target.operation || "-"))}
                        duration_ms=${escapeHtml(safeString(target.duration_ms || 0))}
                      </div>
                    </div>
                  `
                )
                .join("")
            : `<div class="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500">-</div>`;
          return `
            <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="text-sm font-semibold text-slate-900">job[${jobIdx}] ${escapeHtml(
                  safeString(job.name || "-")
                )}</div>
                <div class="inline-flex items-center gap-2">
                  ${orchestrationStatusBadge(job.status)}
                  <span class="tx-workflow-chip">${escapeHtml(
                    `ok=${safeString(job.targets_succeeded || 0)}`
                  )}</span>
                  <span class="tx-workflow-chip">${escapeHtml(
                    `failed=${safeString(job.targets_failed || 0)}`
                  )}</span>
                  <span class="tx-workflow-chip">${escapeHtml(
                    `skipped=${safeString(job.targets_skipped || 0)}`
                  )}</span>
                </div>
              </div>
              <div class="mt-1 text-xs text-slate-700">${escapeHtml(
                `${t("orchestrationStageAction")}: ${safeString(job.action_summary || job.action_kind || "-")}`
              )}</div>
              <div class="mt-2 grid gap-2">${targetRows}</div>
            </div>
          `;
        })
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
          ${detailField(t("orchestrationStatusSuccess"), stage.jobs_succeeded ?? 0)}
          ${detailField(t("orchestrationStatusFailed"), stage.jobs_failed ?? 0)}
          ${detailField(t("orchestrationStatusSkipped"), stage.jobs_skipped ?? 0)}
        </div>
      </section>
      <section class="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div class="mb-2 text-xs font-semibold text-slate-600">${escapeHtml(
          t("orchestrationDetailSectionJobs")
        )}</div>
        <div class="grid gap-2">${jobRows}</div>
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
            t("orchestrationDetailLabelJob"),
            `job[${detail && typeof detail.jobIndex === "number" ? detail.jobIndex : 0}] ${safeString(
              detail && detail.jobName ? detail.jobName : "-"
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
      const jobs = Array.isArray(stage.jobs) ? stage.jobs : [];
      const jobRows = jobs
        .map((job, jobIdx) => {
          const targets = Array.isArray(job.results) ? job.results : [];
          const targetRows = targets
            .map((target, targetIdx) => {
              const targetDetailId = rememberOrchestrationDetail({
                kind: "target",
                planName: result.plan_name || "-",
                stageName: stage.name || "-",
                stageIndex: idx,
                jobName: job.name || `job-${jobIdx + 1}`,
                jobIndex: jobIdx,
                targetIndex: targetIdx,
                target,
              });
              return `
                <div class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
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
            <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="font-semibold text-slate-900">job[${jobIdx}] ${escapeHtml(
                  safeString(job.name || "-")
                )}</div>
                <div class="inline-flex flex-wrap items-center gap-2">
                  ${orchestrationStatusBadge(job.status)}
                  <span class="tx-workflow-chip">${escapeHtml(
                    `ok=${safeString(job.targets_succeeded || 0)}`
                  )}</span>
                  <span class="tx-workflow-chip">${escapeHtml(
                    `failed=${safeString(job.targets_failed || 0)}`
                  )}</span>
                  <span class="tx-workflow-chip">${escapeHtml(
                    `skipped=${safeString(job.targets_skipped || 0)}`
                  )}</span>
                </div>
              </div>
              <div class="mt-1 break-all">${escapeHtml(
                `${t("orchestrationStageAction")}: ${safeString(job.action_summary || job.action_kind || "-")}`
              )}</div>
              <div class="mt-2 grid gap-2">${targetRows || `<div class="text-xs text-slate-500">-</div>`}</div>
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
                `ok=${safeString(stage.jobs_succeeded)}`
              )}</span>
              <span class="tx-workflow-chip">${escapeHtml(
                `failed=${safeString(stage.jobs_failed)}`
              )}</span>
              <span class="tx-workflow-chip">${escapeHtml(
                `skipped=${safeString(stage.jobs_skipped)}`
              )}</span>
              <span class="tx-workflow-chip">${escapeHtml(
                `${t("orchestrationStageJobs")}=${safeString(stage.jobs_total)}`
              )}</span>
              </div>
              <button
                class="mini-btn js-orchestration-detail-btn"
                type="button"
                data-orchestration-detail-id="${escapeHtml(stageDetailId)}"
              >${escapeHtml(t("orchestrationDetailBtn"))}</button>
            </div>
          </div>
          <div class="mt-2 grid gap-2">${jobRows || `<div class="text-xs text-slate-500">-</div>`}</div>
        </section>
      `;
    })
    .join("");
  return `<div class="grid gap-3"><div class="text-sm font-semibold text-slate-900">${escapeHtml(
    t("orchestrationResultTitle")
  )}</div>${summary}${stageCards}</div>`;
}
