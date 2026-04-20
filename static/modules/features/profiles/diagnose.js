/**
 * features/profiles/diagnose.js — profile diagnose helpers
 */

function issueCount(report) {
  return (
    (report.missing_edge_sources || []).length +
    (report.missing_edge_targets || []).length +
    (report.unreachable_states || []).length +
    (report.dead_end_states || []).length +
    (report.duplicate_prompt_patterns || []).length +
    (report.self_loop_only_states || []).length
  );
}

function renderDiagList(id, values) {
  const ul = byId(id);
  if (!ul) return;
  const list = Array.isArray(values) ? values : [];
  if (list.length === 0) {
    ul.innerHTML = "<li>-</li>";
    return;
  }
  ul.innerHTML = list.map((v) => `<li>${v}</li>`).join("");
}

function renderDiagnoseSummaryPanel(name, report, issues) {
  const healthy = issues === 0;
  const statusText = healthy ? t("diagnoseOk") : t("diagnoseBad");
  const statusCls = healthy
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-rose-200 bg-rose-50 text-rose-700";
  const breakdown = [
    [t("diagUnreachableStates"), (report.unreachable_states || []).length],
    [t("diagDeadEndStates"), (report.dead_end_states || []).length],
    [t("diagMissingEdgeSources"), (report.missing_edge_sources || []).length],
    [t("diagMissingEdgeTargets"), (report.missing_edge_targets || []).length],
    [
      t("diagAmbiguousPromptStates"),
      (report.potentially_ambiguous_prompt_states || []).length,
    ],
  ];
  const hasIssue = breakdown.some(([, count]) => count > 0);
  const breakdownCards = hasIssue
    ? breakdown
        .filter(([, count]) => count > 0)
        .map(
          ([label, count]) => `
            <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <div class="text-[11px] font-semibold text-amber-700">${escapeHtml(
                label
              )}</div>
              <div class="mt-1 text-base font-semibold text-amber-900">${escapeHtml(
                count
              )}</div>
            </div>
          `
        )
        .join("")
    : `<div class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">${escapeHtml(
        t("diagSummaryNone")
      )}</div>`;
  return `
    <div class="grid gap-3">
      <div class="grid gap-2 md:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div class="text-xs text-slate-500">${escapeHtml(t("diagSummaryProfile"))}</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(name)}</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div class="text-xs text-slate-500">${escapeHtml(
            t("diagSummaryIssueCount")
          )}</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(issues)}</div>
        </div>
        <div class="rounded-xl border px-3 py-2 ${statusCls}">
          <div class="text-xs">${escapeHtml(t("diagSummaryHealth"))}</div>
          <div class="mt-1 text-sm font-semibold">${escapeHtml(statusText)}</div>
        </div>
      </div>
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="text-xs font-semibold text-slate-500">${escapeHtml(
          t("diagSummaryBreakdown")
        )}</div>
        <div class="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          ${breakdownCards}
        </div>
      </section>
    </div>
  `;
}

function resetDiagnoseView() {
  lastDiagnoseSnapshot = null;
  byId("profile-diagnose-badge").textContent = "-";
  byId("profile-diagnose-badge").className = "diag-badge";
  byId("diag-total-states").textContent = "-";
  byId("diag-graph-states").textContent = "-";
  byId("diag-entry-states").textContent = "-";
  byId("diag-issues-count").textContent = "-";
  [
    "diag-unreachable-states",
    "diag-dead-end-states",
    "diag-missing-sources",
    "diag-missing-targets",
    "diag-ambiguous-states",
  ].forEach((id) => renderDiagList(id, []));
  setStatusMessage("profile-diagnose-out", "-", "info");
}

function renderDiagnoseResult(name, report) {
  lastDiagnoseSnapshot = {
    name,
    report: report || {},
  };
  const issues = issueCount(report);
  const healthy = issues === 0;
  const badge = byId("profile-diagnose-badge");
  badge.className = `diag-badge ${healthy ? "ok" : "bad"}`;
  badge.textContent = `${healthy ? t("diagnoseOk") : t("diagnoseBad")} · ${name}`;

  byId("diag-total-states").textContent = String(report.total_states ?? 0);
  byId("diag-graph-states").textContent = String((report.graph_states || []).length);
  byId("diag-entry-states").textContent = String((report.entry_states || []).length);
  byId("diag-issues-count").textContent = String(issues);

  renderDiagList("diag-unreachable-states", report.unreachable_states || []);
  renderDiagList("diag-dead-end-states", report.dead_end_states || []);
  renderDiagList("diag-missing-sources", report.missing_edge_sources || []);
  renderDiagList("diag-missing-targets", report.missing_edge_targets || []);
  renderDiagList(
    "diag-ambiguous-states",
    report.potentially_ambiguous_prompt_states || []
  );

  byId("profile-diagnose-out").innerHTML = renderDiagnoseSummaryPanel(
    name,
    report,
    issues
  );
}

async function diagnoseCustomProfile() {
  const name = byId("profile-diagnose-picker").value.trim();
  if (!name) {
    setStatusMessage("profile-diagnose-out", t("profileNameRequired"), "error");
    return;
  }
  resetDiagnoseView();
  setStatusMessage("profile-diagnose-out", t("running"), "running");
  try {
    const data = await request("POST", "/api/device-profiles/diagnose", {
      name,
    });
    const report = data.diagnostics || {};
    renderDiagnoseResult(data.name || name, report);
  } catch (e) {
    resetDiagnoseView();
    setStatusMessage("profile-diagnose-out", e.message, "error");
  }
}
