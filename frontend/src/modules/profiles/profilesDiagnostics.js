import { diagnoseProfile as diagnoseProfileRequest } from "../../api/client.js";
import { currentLanguageState, t, tr } from "../../lib/i18n.js";
import { createLoadingStateRunner } from "../../lib/svelte.js";
import {
  borderedPillClass,
  safeString,
  statusPresentation,
} from "../../lib/ui.js";
import { derived, get as getStore, writable } from "svelte/store";
import { getCachedDeviceProfiles } from "../templates/templatesShowObjects.js";

function profileValues(listRows) {
  return Array.isArray(listRows) ? listRows : [];
}

function profilePatternEditorRows(patterns = []) {
  return profileValues(patterns).map((pattern, patternIndex) => ({
    pattern: safeString(pattern ?? ""),
    patternIndex,
  }));
}

function profileDetectRuleEditorDisplay({
  titleFallback = "rules",
  titleKey = "detectRulesLabel",
} = {}) {
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

function profileDetectErrorPatternsEditorDisplay() {
  return {
    addButtonLabel: tr("addInlineBtn", "Add"),
    deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
    title: tr("detectErrorPatternsLabel", "error patterns"),
  };
}

const PROFILE_DIAGNOSE_LISTS = Object.freeze(
  "diagUnreachableStates|unreachable_states,diagDeadEndStates|dead_end_states,diagMissingEdgeSources|missing_edge_sources,diagMissingEdgeTargets|missing_edge_targets,diagAmbiguousPromptStates|potentially_ambiguous_prompt_states"
    .split(",")
    .map((diagnoseListDefinition) => {
      const [labelKey, field] = diagnoseListDefinition.split("|");
      return { field, labelKey };
    }),
);

const PROFILE_DIAGNOSE_ISSUE_FIELDS = Object.freeze(
  "missing_edge_sources|missing_edge_targets|unreachable_states|dead_end_states|duplicate_prompt_patterns|self_loop_only_states".split(
    "|",
  ),
);

function profileDiagnoseReportList(report = {}, field = "") {
  const reportValues = report?.[field];
  return Array.isArray(reportValues) ? reportValues : [];
}

export function profileDiagnoseDisplay(
  report = {},
  resultName = "",
  status = null,
) {
  const hasReport = Boolean(resultName);
  const issueCount = PROFILE_DIAGNOSE_ISSUE_FIELDS.reduce(
    (total, field) => total + profileDiagnoseReportList(report, field).length,
    0,
  );
  const issueLists = PROFILE_DIAGNOSE_LISTS.map((diagnoseList) => {
    const reportRows = profileDiagnoseReportList(report, diagnoseList.field);
    const issueValues = hasReport && reportRows.length > 0 ? reportRows : ["-"];
    return {
      ...diagnoseList,
      breakdownClass:
        "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2",
      breakdownLabelClass: "text-[11px] font-semibold text-amber-700",
      breakdownValue: reportRows.length,
      breakdownValueClass: "mt-1 text-base font-semibold text-amber-900",
      cardClass: "rounded-xl border border-slate-200 bg-white px-3 py-2",
      count: reportRows.length,
      issueValues,
      labelText: tr(diagnoseList.labelKey, diagnoseList.field),
    };
  });
  const visibleBreakdown = issueLists.filter(
    (diagnoseList) => diagnoseList.count > 0,
  );
  const statusDisplay = statusPresentation(
    status?.message || "",
    status?.tone || "info",
    { suppressPassiveLoaded: false },
  );
  const healthy = issueCount === 0;
  const healthText = healthy ? tr("diagnoseOk") : tr("diagnoseBad");
  const entryStateCount = profileDiagnoseReportList(
    report,
    "entry_states",
  ).length;
  const graphStateCount = profileDiagnoseReportList(
    report,
    "graph_states",
  ).length;
  const totalStates = hasReport ? (report.total_states ?? 0) : "-";
  const issueCountText = hasReport ? issueCount : "-";
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
    badgeText: hasReport ? `${healthText} · ${resultName || ""}` : "-",
    hasStatus: Boolean(statusDisplay.text),
    hasVisibleBreakdown: visibleBreakdown.length > 0,
    issueLists,
    metricCards: [
      { labelText: tr("diagTotalStates"), metricValue: totalStates },
      {
        labelText: tr("diagGraphStates"),
        metricValue: hasReport ? graphStateCount : "-",
      },
      {
        labelText: tr("diagEntryStates"),
        metricValue: hasReport ? entryStateCount : "-",
      },
      { labelText: tr("diagIssues"), metricValue: issueCountText },
    ],
    resultTitle: tr("profileDiagnoseResultTitle"),
    statusMessage: statusDisplay.text,
    statusTone: statusDisplay.tone,
    summaryCards: [
      {
        cardClass: summaryCardClass,
        labelClass: summaryLabelClass,
        labelText: tr("diagSummaryProfile"),
        summaryValue: resultName || "",
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

export function profileDiagnosePanelDisplay(optionsState = {}) {
  return {
    buttonLabel: tr("profileDiagnoseBtn"),
    profileNames: Array.isArray(optionsState.profiles)
      ? optionsState.profiles
      : [],
    selectPlaceholder: tr("profileDiagnoseSelectPlaceholder"),
    selectedProfile: safeString(optionsState.selected || ""),
    title: tr("profileDiagnoseTitle"),
  };
}

function profileDetectRuleEditorRows(rules = []) {
  return profileValues(rules).map((rule, index) => ({
    index,
    pattern: safeString(rule?.pattern ?? ""),
    weight: safeString(rule?.weight ?? ""),
  }));
}

function profileDetectProbeRows(probes = []) {
  return (Array.isArray(probes) ? probes : []).map((probe) => ({
    command: safeString(probe?.command ?? ""),
    errorPatternRows: profilePatternEditorRows(probe?.error_patterns),
    ruleRows: profileDetectRuleEditorRows(probe?.rules),
  }));
}

export function customProfileDetectPanelDisplay(formState = {}) {
  const initialRules = Array.isArray(formState.initialRules)
    ? formState.initialRules
    : [];
  return {
    addButtonLabel: tr("addInlineBtn", "Add"),
    commandPlaceholder: tr("fieldCommand", "command"),
    deleteButtonLabel: tr("deleteInlineBtn", "Delete"),
    enabled: !!formState.enabled,
    errorPatternsDisplay: profileDetectErrorPatternsEditorDisplay(),
    hint: tr("detectProfileHint"),
    initialRuleEditorDisplay: profileDetectRuleEditorDisplay({
      titleKey: "detectInitialRulesLabel",
      titleFallback: "initial rules",
    }),
    initialRuleRows: profileDetectRuleEditorRows(initialRules),
    label: tr("labelDetectProfile"),
    probeRuleEditorDisplay: profileDetectRuleEditorDisplay(),
    probeRows: profileDetectProbeRows(formState.probes),
    probesLabel: tr("detectProbesLabel"),
  };
}

const PROFILE_DIAGNOSE_DISPLAY_DEFAULTS = Object.freeze({
  diagnoseLoading: false,
  report: {},
  resultName: "",
  status: { message: "-", tone: "info" },
});

export function createProfileDiagnoseState() {
  return {
    ...PROFILE_DIAGNOSE_DISPLAY_DEFAULTS,
    report: {},
    status: { ...PROFILE_DIAGNOSE_DISPLAY_DEFAULTS.status },
  };
}

export const profileDiagnoseOptionsState = writable({
  profiles: [],
  selected: "",
});

export const profileDetectFormStateStore = writable({
  enabled: false,
  initialRules: [],
  probes: [],
});

export function setProfileDiagnoseSelected(profileName = "") {
  const selectedName = safeString(profileName).trim();
  profileDiagnoseOptionsState.update((state) => ({
    ...state,
    selected: state.profiles.includes(selectedName) ? selectedName : "",
  }));
}

async function diagnoseCustomProfile(profileName = "") {
  const selectedProfileName = safeString(profileName).trim();
  if (!selectedProfileName) {
    throw new Error(tr("profileNameRequired", "profile name is required"));
  }
  const diagnosePayload = await diagnoseProfileRequest(selectedProfileName);
  return {
    diagnostics: diagnosePayload?.diagnostics || {},
    name: diagnosePayload?.name || selectedProfileName,
  };
}

function resetProfileDiagnoseState(diagnose = {}) {
  diagnose.resultName = "";
  diagnose.report = {};
  diagnose.status = { message: "-", tone: "info" };
}

function setProfileDiagnoseResult(diagnose = {}, profileName, report = {}) {
  diagnose.resultName = profileName || "";
  diagnose.report = report || {};
  diagnose.status = { message: "", tone: "info" };
}

export async function diagnoseSelectedCustomProfile(diagnose = {}) {
  const profileName = safeString(
    getStore(profileDiagnoseOptionsState).selected,
  ).trim();
  resetProfileDiagnoseState(diagnose);
  diagnose.status = {
    message: tr("running", "running"),
    tone: "running",
  };
  try {
    const diagnoseResult = await diagnoseCustomProfile(profileName);
    setProfileDiagnoseResult(
      diagnose,
      diagnoseResult.name,
      diagnoseResult.diagnostics,
    );
  } catch (error) {
    resetProfileDiagnoseState(diagnose);
    diagnose.status = { message: error.message, tone: "error" };
  }
}

export function createProfileDiagnosePanelWorkspace() {
  const diagnoseStateStore = writable(createProfileDiagnoseState());
  const diagnoseLoadingStateStore = writable({
    diagnoseLoading: false,
  });
  const diagnoseDisplayStateStore = derived(
    [diagnoseStateStore, currentLanguageState],
    ([$diagnoseStateStore, _currentLanguageState]) =>
      profileDiagnoseDisplay(
        $diagnoseStateStore.report,
        $diagnoseStateStore.resultName,
        $diagnoseStateStore.status,
      ),
  );
  const panelDisplayStateStore = derived(
    [profileDiagnoseOptionsState, currentLanguageState],
    ([$profileDiagnoseOptionsState, _currentLanguageState]) =>
      profileDiagnosePanelDisplay($profileDiagnoseOptionsState),
  );
  const diagnoseLoadingState = { keys: [] };
  const diagnoseLoadingRunner = createLoadingStateRunner(diagnoseLoadingState, {
    setKeys(keys) {
      diagnoseLoadingStateStore.set({
        diagnoseLoading: keys.includes("diagnose"),
      });
    },
  });

  async function runProfileDiagnose() {
    return diagnoseLoadingRunner.run("diagnose", async () => {
      const selectedProfileName = safeString(
        getStore(profileDiagnoseOptionsState).selected,
      ).trim();
      diagnoseStateStore.set({
        ...createProfileDiagnoseState(),
        status: {
          message: tr("running", "running"),
          tone: "running",
        },
      });
      try {
        const diagnoseResult = await diagnoseCustomProfile(selectedProfileName);
        diagnoseStateStore.set({
          ...createProfileDiagnoseState(),
          report: diagnoseResult.diagnostics || {},
          resultName: diagnoseResult.name || selectedProfileName,
          status: {
            message: "",
            tone: "info",
          },
        });
      } catch (error) {
        diagnoseStateStore.set({
          ...createProfileDiagnoseState(),
          status: {
            message: error.message,
            tone: "error",
          },
        });
      }
    });
  }

  return {
    diagnoseDisplayStateStore,
    diagnoseLoadingStateStore,
    diagnoseStateStore,
    panelDisplayStateStore,
    runProfileDiagnose,
  };
}

function normalizeDetectRule(detectRule = {}) {
  return {
    pattern: safeString(detectRule.pattern ?? ""),
    weight: detectRule.weight == null ? "50" : safeString(detectRule.weight),
  };
}

function normalizeDetectProbe(detectProbe = {}) {
  const rules = Array.isArray(detectProbe.rules) ? detectProbe.rules : [];
  return {
    command: safeString(detectProbe.command ?? ""),
    error_patterns: Array.isArray(detectProbe.error_patterns)
      ? detectProbe.error_patterns.map((pattern) => safeString(pattern ?? ""))
      : [],
    rules: rules.length
      ? rules.map(normalizeDetectRule)
      : [normalizeDetectRule()],
  };
}

export function setDetectProfileForm(detectProfile) {
  const enabled = !!detectProfile;
  const initialRules = Array.isArray(detectProfile?.initial_rules)
    ? detectProfile.initial_rules.map(normalizeDetectRule)
    : [];
  const probes = Array.isArray(detectProfile?.probes)
    ? detectProfile.probes.map(normalizeDetectProbe)
    : [];
  profileDetectFormStateStore.set({
    enabled,
    initialRules:
      enabled && !initialRules.length ? [normalizeDetectRule()] : initialRules,
    probes: enabled && !probes.length ? [normalizeDetectProbe()] : probes,
  });
}

function updateProfileDetectFormState(formPatch = {}) {
  profileDetectFormStateStore.update((state) => ({ ...state, ...formPatch }));
}

function updateProfileDetectProbes(updater) {
  profileDetectFormStateStore.update((state) => {
    const probes = Array.isArray(state.probes) ? state.probes : [];
    const nextProbes = updater(probes);
    return {
      ...state,
      probes: Array.isArray(nextProbes) ? nextProbes : probes,
    };
  });
}

function updateProfileDetectInitialRules(updater) {
  profileDetectFormStateStore.update((state) => {
    const initialRules = Array.isArray(state.initialRules)
      ? state.initialRules
      : [];
    const nextRules = updater(initialRules);
    return {
      ...state,
      initialRules: Array.isArray(nextRules) ? nextRules : initialRules,
    };
  });
}

export function setProfileDetectEnabled(enabled) {
  profileDetectFormStateStore.update((state) => ({
    ...state,
    enabled: !!enabled,
  }));
}

export function ensureProfileDetectDefaults() {
  const state = getStore(profileDetectFormStateStore);
  if (!state.enabled) return;
  const initialRules = Array.isArray(state.initialRules)
    ? state.initialRules
    : [];
  const probes = Array.isArray(state.probes) ? state.probes : [];
  updateProfileDetectFormState({
    initialRules: initialRules.length ? initialRules : [normalizeDetectRule()],
    probes: probes.length ? probes : [normalizeDetectProbe()],
  });
}

export function addProfileDetectInitialRule(detectRule = {}) {
  updateProfileDetectInitialRules((initialRules) => [
    ...initialRules,
    normalizeDetectRule(detectRule),
  ]);
}

export function patchProfileDetectInitialRule(index, patch) {
  updateProfileDetectInitialRules((initialRules) =>
    initialRules.map((initialRule, currentIndex) =>
      currentIndex === index ? { ...initialRule, ...patch } : initialRule,
    ),
  );
}

export function removeProfileDetectInitialRule(index) {
  updateProfileDetectInitialRules((initialRules) =>
    initialRules.filter((_, currentIndex) => currentIndex !== index),
  );
}

export function addProfileDetectProbe(detectProbe = {}) {
  updateProfileDetectProbes((probes) => [
    ...probes,
    normalizeDetectProbe(detectProbe),
  ]);
}

export function patchProfileDetectProbe(index, patch) {
  updateProfileDetectProbes((probes) =>
    probes.map((probe, currentIndex) =>
      currentIndex === index ? { ...probe, ...patch } : probe,
    ),
  );
}

export function removeProfileDetectProbe(index) {
  updateProfileDetectProbes((probes) =>
    probes.filter((_, currentIndex) => currentIndex !== index),
  );
}

export function addProfileDetectProbeRule(probeIndex, detectRule = {}) {
  updateProfileDetectProbes((probes) =>
    probes.map((probe, currentIndex) => {
      if (currentIndex !== probeIndex) return probe;
      const rules = Array.isArray(probe.rules) ? probe.rules : [];
      return { ...probe, rules: [...rules, normalizeDetectRule(detectRule)] };
    }),
  );
}

export function patchProfileDetectProbeRule(probeIndex, ruleIndex, patch) {
  updateProfileDetectProbes((probes) =>
    probes.map((probe, currentIndex) => {
      if (currentIndex !== probeIndex) return probe;
      const rules = Array.isArray(probe.rules) ? probe.rules : [];
      return {
        ...probe,
        rules: rules.map((rule, currentRuleIndex) =>
          currentRuleIndex === ruleIndex ? { ...rule, ...patch } : rule,
        ),
      };
    }),
  );
}

export function removeProfileDetectProbeRule(probeIndex, ruleIndex) {
  updateProfileDetectProbes((probes) =>
    probes.map((probe, currentIndex) => {
      if (currentIndex !== probeIndex) return probe;
      const rules = Array.isArray(probe.rules) ? probe.rules : [];
      return {
        ...probe,
        rules: rules.filter(
          (_, currentRuleIndex) => currentRuleIndex !== ruleIndex,
        ),
      };
    }),
  );
}

export function addProfileDetectProbeErrorPattern(probeIndex, pattern = "") {
  updateProfileDetectProbes((probes) =>
    probes.map((probe, currentIndex) => {
      if (currentIndex !== probeIndex) return probe;
      const errorPatterns = Array.isArray(probe.error_patterns)
        ? probe.error_patterns
        : [];
      return {
        ...probe,
        error_patterns: [...errorPatterns, safeString(pattern ?? "")],
      };
    }),
  );
}

export function setProfileDetectProbeErrorPattern(
  probeIndex,
  patternIndex,
  value,
) {
  updateProfileDetectProbes((probes) =>
    probes.map((probe, currentIndex) => {
      if (currentIndex !== probeIndex) return probe;
      const patterns = Array.isArray(probe.error_patterns)
        ? probe.error_patterns
        : [];
      return {
        ...probe,
        error_patterns: patterns.map((pattern, currentPatternIndex) =>
          currentPatternIndex === patternIndex
            ? safeString(value ?? "")
            : pattern,
        ),
      };
    }),
  );
}

export function removeProfileDetectProbeErrorPattern(probeIndex, patternIndex) {
  updateProfileDetectProbes((probes) =>
    probes.map((probe, currentIndex) => {
      if (currentIndex !== probeIndex) return probe;
      const patterns = Array.isArray(probe.error_patterns)
        ? probe.error_patterns
        : [];
      return {
        ...probe,
        error_patterns: patterns.filter(
          (_, currentPatternIndex) => currentPatternIndex !== patternIndex,
        ),
      };
    }),
  );
}

function collectDetectRules(rows) {
  return rows
    .map((rule) => {
      const pattern = safeString(rule.pattern).trim();
      const rawWeight = safeString(rule.weight).trim();
      const weight = rawWeight ? Number(rawWeight) : 50;
      if (!pattern) return null;
      if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(weight)) {
        throw new Error(t("detectWeightInvalid"));
      }
      return { pattern, weight };
    })
    .filter(Boolean);
}

export function collectDetectProfileForm() {
  const form = getStore(profileDetectFormStateStore);
  if (!form.enabled) return null;
  const collectedProbes = (Array.isArray(form.probes) ? form.probes : [])
    .map((probe) => {
      const command = safeString(probe.command).trim();
      const rules = collectDetectRules(probe.rules || []);
      const error_patterns = (probe.error_patterns || [])
        .map((pattern) => safeString(pattern).trim())
        .filter(Boolean);
      if (!command && rules.length === 0 && error_patterns.length === 0) {
        return null;
      }
      if (!command) {
        throw new Error(t("detectProbeCommandRequired"));
      }
      return { command, error_patterns, rules };
    })
    .filter(Boolean);
  return {
    initial_rules: collectDetectRules(form.initialRules || []),
    probes: collectedProbes,
  };
}

export function createCustomProfileDetectPanelWorkspace() {
  const detectDisplayStateStore = derived(
    [profileDetectFormStateStore, currentLanguageState],
    ([$profileDetectFormStateStore, _currentLanguageState]) =>
      customProfileDetectPanelDisplay($profileDetectFormStateStore),
  );

  function setPanelContext({ active = false } = {}) {
    if (!active) return;
    ensureProfileDetectDefaults();
  }

  return {
    detectDisplayStateStore,
    setPanelContext,
  };
}
