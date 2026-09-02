import { tr } from "../../../lib/i18n.js";
import {
  borderedPillClass,
  safeString,
  statusPresentation,
} from "../../../lib/ui.js";
import { profileValues } from "../model/profileEditor.js";
import { recordValue } from "../model/customProfileForm.js";
import type {
  ProfileDetectFormState,
  ProfileDiagnoseOptionsState,
} from "../model/profileDiagnostics.js";
import type { UnknownRecord } from "../model/types.js";
import type { ProfileStatusTone } from "../model/types.js";

function profileStatusTone(tone: string): ProfileStatusTone {
  if (
    tone === "error" ||
    tone === "running" ||
    tone === "success" ||
    tone === "warning"
  ) {
    return tone;
  }
  return "info";
}

const PROFILE_DIAGNOSE_LISTS = Object.freeze(
  "diagUnreachableStates|unreachable_states,diagDeadEndStates|dead_end_states,diagMissingEdgeSources|missing_edge_sources,diagMissingEdgeTargets|missing_edge_targets,diagAmbiguousPromptStates|potentially_ambiguous_prompt_states"
    .split(",")
    .map((definition) => {
      const [labelKey, field] = definition.split("|");
      return { field, labelKey };
    }),
);

const PROFILE_DIAGNOSE_ISSUE_FIELDS = Object.freeze(
  "missing_edge_sources|missing_edge_targets|unreachable_states|dead_end_states|duplicate_prompt_patterns|self_loop_only_states".split(
    "|",
  ),
);

function profileDiagnoseReportList(
  report: UnknownRecord,
  field: string,
): unknown[] {
  return profileValues(report[field]);
}

export function profileDiagnoseDisplay(
  reportValue: unknown = {},
  resultName = "",
  statusValue: unknown = null,
) {
  const report = recordValue(reportValue);
  const status = recordValue(statusValue);
  const hasReport = Boolean(resultName);
  const issueCount = PROFILE_DIAGNOSE_ISSUE_FIELDS.reduce(
    (total, field) => total + profileDiagnoseReportList(report, field).length,
    0,
  );
  const issueLists = PROFILE_DIAGNOSE_LISTS.map((diagnoseList) => {
    const reportRows = profileDiagnoseReportList(report, diagnoseList.field);
    return {
      ...diagnoseList,
      breakdownClass:
        "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2",
      breakdownLabelClass: "text-[11px] font-semibold text-amber-700",
      breakdownValue: reportRows.length,
      breakdownValueClass: "mt-1 text-base font-semibold text-amber-900",
      cardClass: "rounded-xl border border-slate-200 bg-white px-3 py-2",
      count: reportRows.length,
      issueValues: hasReport && reportRows.length > 0 ? reportRows : ["-"],
      labelText: tr(diagnoseList.labelKey, diagnoseList.field),
    };
  });
  const visibleBreakdown = issueLists.filter((list) => list.count > 0);
  const statusDisplay = statusPresentation(
    safeString(status.message || ""),
    safeString(status.tone || "info"),
    { suppressPassiveLoaded: false },
  );
  const healthy = issueCount === 0;
  const healthText = healthy ? tr("diagnoseOk") : tr("diagnoseBad");
  const metric = (field: string) =>
    profileDiagnoseReportList(report, field).length;
  const summaryCardClass =
    "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2";
  const summaryLabelClass = "text-xs text-slate-500";
  const summaryValueClass = "mt-1 text-sm font-semibold text-slate-900";
  const healthClass = healthy
    ? "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700"
    : "rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700";
  const badgeClass = borderedPillClass(
    hasReport
      ? healthy
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-200 bg-slate-50 text-slate-600",
  );
  return {
    badgeClass,
    badgeText: hasReport ? `${healthText} · ${resultName}` : "-",
    hasStatus: Boolean(statusDisplay.text),
    hasVisibleBreakdown: visibleBreakdown.length > 0,
    issueLists,
    metricCards: [
      {
        labelText: tr("diagTotalStates"),
        metricValue: hasReport ? (report.total_states ?? 0) : "-",
      },
      {
        labelText: tr("diagGraphStates"),
        metricValue: hasReport ? metric("graph_states") : "-",
      },
      {
        labelText: tr("diagEntryStates"),
        metricValue: hasReport ? metric("entry_states") : "-",
      },
      {
        labelText: tr("diagIssues"),
        metricValue: hasReport ? issueCount : "-",
      },
    ],
    resultTitle: tr("profileDiagnoseResultTitle"),
    statusMessage: statusDisplay.text,
    statusTone: profileStatusTone(statusDisplay.tone),
    summaryCards: [
      {
        cardClass: summaryCardClass,
        labelClass: summaryLabelClass,
        labelText: tr("diagSummaryProfile"),
        summaryValue: resultName,
        summaryValueClass,
      },
      {
        cardClass: summaryCardClass,
        labelClass: summaryLabelClass,
        labelText: tr("diagSummaryIssueCount"),
        summaryValue: issueCount,
        summaryValueClass,
      },
      {
        cardClass: healthClass,
        labelClass: "text-xs",
        labelText: tr("diagSummaryHealth"),
        summaryValue: healthText,
        summaryValueClass: "mt-1 text-sm font-semibold",
      },
    ],
    summaryBreakdownTitle: tr("diagSummaryBreakdown"),
    summaryNoneText: tr("diagSummaryNone"),
    visibleBreakdown,
    showSummary: !statusDisplay.text && hasReport,
  };
}

export function profileDiagnosePanelDisplay(
  optionsState: ProfileDiagnoseOptionsState,
) {
  return {
    buttonLabel: tr("profileDiagnoseBtn"),
    profileNames: optionsState.profiles,
    selectPlaceholder: tr("profileDiagnoseSelectPlaceholder"),
    selectedProfile: safeString(optionsState.selected),
    title: tr("profileDiagnoseTitle"),
  };
}

function profilePatternEditorRows(patterns: unknown) {
  return profileValues(patterns).map((pattern, patternIndex) => ({
    pattern: safeString(pattern ?? ""),
    patternIndex,
  }));
}

function profileDetectRuleEditorRows(rules: unknown) {
  return profileValues(rules).map((ruleValue, index) => {
    const rule = recordValue(ruleValue);
    return {
      index,
      pattern: safeString(rule.pattern ?? ""),
      weight: safeString(rule.weight ?? ""),
    };
  });
}

function profileDetectProbeRows(probes: unknown) {
  return profileValues(probes).map((probeValue) => {
    const probe = recordValue(probeValue);
    return {
      command: safeString(probe.command ?? ""),
      errorPatternRows: profilePatternEditorRows(probe.error_patterns),
      ruleRows: profileDetectRuleEditorRows(probe.rules),
    };
  });
}

function profileDetectRuleEditorDisplay(
  titleKey = "detectRulesLabel",
  titleFallback = "rules",
) {
  return {
    addButtonLabel: tr("addInlineBtn", "Add"),
    deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
    patternInputDisplay: {
      placeholder: tr("fieldPattern", "pattern"),
      type: "text",
    },
    title: tr(titleKey, titleFallback),
    weightInputDisplay: {
      min: "0",
      placeholder: tr("fieldWeight", "weight"),
      step: "1",
      type: "number",
    },
  };
}

export function customProfileDetectPanelDisplay(
  formState: ProfileDetectFormState,
) {
  return {
    addButtonLabel: tr("addInlineBtn", "Add"),
    commandPlaceholder: tr("fieldCommand", "command"),
    deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
    enabled: formState.enabled,
    errorPatternsDisplay: {
      addButtonLabel: tr("addInlineBtn", "Add"),
      deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
      title: tr("detectErrorPatternsLabel", "error patterns"),
    },
    hint: tr("detectProfileHint"),
    initialRuleEditorDisplay: profileDetectRuleEditorDisplay(
      "detectInitialRulesLabel",
      "initial rules",
    ),
    initialRuleRows: profileDetectRuleEditorRows(formState.initialRules),
    label: tr("labelDetectProfile"),
    probeRuleEditorDisplay: profileDetectRuleEditorDisplay(),
    probeRows: profileDetectProbeRows(formState.probes),
    probesLabel: tr("detectProbesLabel"),
  };
}
