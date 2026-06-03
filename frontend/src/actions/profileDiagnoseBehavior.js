import { diagnoseProfile } from "../api/client.js";

function tr(key, fallback = key) {
  return typeof window.t === "function" ? window.t(key) : fallback;
}

function safeString(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function escapeHtml(value) {
  return safeString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function issueCount(report = {}) {
  return (
    (report.missing_edge_sources || []).length +
    (report.missing_edge_targets || []).length +
    (report.unreachable_states || []).length +
    (report.dead_end_states || []).length +
    (report.duplicate_prompt_patterns || []).length +
    (report.self_loop_only_states || []).length
  );
}

function setStatus(id, message, tone = "info") {
  if (typeof window.setStatusMessage === "function") {
    window.setStatusMessage(id, message, tone);
    return;
  }
  const out = document.getElementById(id);
  if (out) out.textContent = safeString(message || "-");
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

function renderDiagList(id, values) {
  const ul = document.getElementById(id);
  if (!ul) return;
  const list = Array.isArray(values) ? values : [];
  if (list.length === 0) {
    ul.innerHTML = "<li>-</li>";
    return;
  }
  ul.innerHTML = list.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
}

function renderDiagnoseSummaryPanel(name, report, issues) {
  const healthy = issues === 0;
  const statusText = healthy ? tr("diagnoseOk") : tr("diagnoseBad");
  const statusCls = healthy
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-rose-200 bg-rose-50 text-rose-700";
  const breakdown = [
    [tr("diagUnreachableStates"), (report.unreachable_states || []).length],
    [tr("diagDeadEndStates"), (report.dead_end_states || []).length],
    [tr("diagMissingEdgeSources"), (report.missing_edge_sources || []).length],
    [tr("diagMissingEdgeTargets"), (report.missing_edge_targets || []).length],
    [
      tr("diagAmbiguousPromptStates"),
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
              <div class="text-[11px] font-semibold text-amber-700">${escapeHtml(label)}</div>
              <div class="mt-1 text-base font-semibold text-amber-900">${escapeHtml(count)}</div>
            </div>`,
        )
        .join("")
    : `<div class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">${escapeHtml(
        tr("diagSummaryNone"),
      )}</div>`;
  return `
    <div class="grid gap-3">
      <div class="grid gap-2 md:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div class="text-xs text-slate-500">${escapeHtml(tr("diagSummaryProfile"))}</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(name)}</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div class="text-xs text-slate-500">${escapeHtml(tr("diagSummaryIssueCount"))}</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(issues)}</div>
        </div>
        <div class="rounded-xl border px-3 py-2 ${statusCls}">
          <div class="text-xs">${escapeHtml(tr("diagSummaryHealth"))}</div>
          <div class="mt-1 text-sm font-semibold">${escapeHtml(statusText)}</div>
        </div>
      </div>
      <section class="rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div class="text-xs font-semibold text-slate-500">${escapeHtml(tr("diagSummaryBreakdown"))}</div>
        <div class="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          ${breakdownCards}
        </div>
      </section>
    </div>`;
}

export function profileDiagnoseBehavior(node) {
  const byId = (id) =>
    node.querySelector(`#${id}`) || document.getElementById(id);

  function syncSnapshot(snapshot) {
    window.setProfileDiagnoseRuntimeSnapshot?.(snapshot);
  }

  function resetDiagnoseView() {
    syncSnapshot(null);
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
    setStatus("profile-diagnose-out", "-", "info");
  }

  function renderDiagnoseResult(name, report = {}) {
    syncSnapshot({ name, report });
    const issues = issueCount(report);
    const healthy = issues === 0;
    const badge = byId("profile-diagnose-badge");
    badge.className = `diag-badge ${healthy ? "ok" : "bad"}`;
    badge.textContent = `${healthy ? tr("diagnoseOk") : tr("diagnoseBad")} · ${name}`;

    byId("diag-total-states").textContent = String(report.total_states ?? 0);
    byId("diag-graph-states").textContent = String(
      (report.graph_states || []).length,
    );
    byId("diag-entry-states").textContent = String(
      (report.entry_states || []).length,
    );
    byId("diag-issues-count").textContent = String(issues);

    renderDiagList("diag-unreachable-states", report.unreachable_states || []);
    renderDiagList("diag-dead-end-states", report.dead_end_states || []);
    renderDiagList("diag-missing-sources", report.missing_edge_sources || []);
    renderDiagList("diag-missing-targets", report.missing_edge_targets || []);
    renderDiagList(
      "diag-ambiguous-states",
      report.potentially_ambiguous_prompt_states || [],
    );

    byId("profile-diagnose-out").innerHTML = renderDiagnoseSummaryPanel(
      name,
      report,
      issues,
    );
  }

  async function diagnoseCustomProfile() {
    const name = byId("profile-diagnose-picker").value.trim();
    if (!name) {
      setStatus("profile-diagnose-out", tr("profileNameRequired"), "error");
      return;
    }
    resetDiagnoseView();
    setStatus("profile-diagnose-out", tr("running"), "running");
    try {
      const data = await diagnoseProfile(name);
      const report = data.diagnostics || {};
      renderDiagnoseResult(data.name || name, report);
    } catch (error) {
      resetDiagnoseView();
      setStatus("profile-diagnose-out", error.message, "error");
    }
  }

  const diagnoseBtn = byId("profile-diagnose-btn");
  const onDiagnoseClick = () =>
    withLoading("profile-diagnose-btn", diagnoseCustomProfile);
  diagnoseBtn?.addEventListener("click", onDiagnoseClick);

  window.resetDiagnoseView = resetDiagnoseView;
  window.renderDiagnoseResult = renderDiagnoseResult;
  window.diagnoseCustomProfile = diagnoseCustomProfile;
  resetDiagnoseView();

  return {
    destroy() {
      diagnoseBtn?.removeEventListener("click", onDiagnoseClick);
    },
  };
}
