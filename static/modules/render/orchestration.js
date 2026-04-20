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
