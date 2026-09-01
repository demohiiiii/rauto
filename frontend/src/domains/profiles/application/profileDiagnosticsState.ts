import { currentLanguageState, t, tr } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import { derived, get as getStore, writable } from "svelte/store";
import { profileDiagnosticsApi } from "../infrastructure/profileDiagnosticsApi.js";
import { recordValue } from "../model/customProfileForm.js";
import {
  collectDetectProfile,
  createProfileDiagnoseState,
  ensureDetectProfileDefaults,
  normalizeDetectProbe,
  normalizeDetectProfileForm,
  normalizeDetectRule,
} from "../model/profileDiagnostics.js";
import type {
  ProfileDetectFormState,
  ProfileDetectProbe,
  ProfileDetectRule,
  ProfileDiagnoseOptionsState,
  ProfileDiagnoseState,
} from "../model/profileDiagnostics.js";
import type { UnknownRecord } from "../model/types.js";
import {
  customProfileDetectPanelDisplay,
  profileDiagnoseDisplay,
  profileDiagnosePanelDisplay,
} from "../presentation/profileDiagnosticsPresentation.js";

export { createProfileDiagnoseState } from "../model/profileDiagnostics.js";
export {
  customProfileDetectPanelDisplay,
  profileDiagnoseDisplay,
  profileDiagnosePanelDisplay,
} from "../presentation/profileDiagnosticsPresentation.js";

export const profileDiagnoseOptionsState =
  writable<ProfileDiagnoseOptionsState>({
    profiles: [],
    selected: "",
  });

export const profileDetectFormStateStore = writable<ProfileDetectFormState>({
  enabled: false,
  initialRules: [],
  probes: [],
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : safeString(error);
}

export function setProfileDiagnoseSelected(profileName = ""): void {
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
  const payload = recordValue(
    await profileDiagnosticsApi.diagnoseProfile(selectedProfileName),
  );
  return {
    diagnostics: recordValue(payload.diagnostics),
    name: safeString(payload.name || selectedProfileName),
  };
}

function resetProfileDiagnoseState(diagnose: UnknownRecord): void {
  diagnose.resultName = "";
  diagnose.report = {};
  diagnose.status = { message: "-", tone: "info" };
}

export async function diagnoseSelectedCustomProfile(
  diagnoseValue: unknown = {},
): Promise<void> {
  const diagnose = recordValue(diagnoseValue);
  const profileName = safeString(
    getStore(profileDiagnoseOptionsState).selected,
  ).trim();
  resetProfileDiagnoseState(diagnose);
  diagnose.status = { message: tr("running", "running"), tone: "running" };
  try {
    const result = await diagnoseCustomProfile(profileName);
    diagnose.resultName = result.name;
    diagnose.report = result.diagnostics;
    diagnose.status = { message: "", tone: "info" };
  } catch (error) {
    resetProfileDiagnoseState(diagnose);
    diagnose.status = { message: errorMessage(error), tone: "error" };
  }
}

export function createProfileDiagnosePanelWorkspace() {
  const diagnoseStateStore = writable<ProfileDiagnoseState>(
    createProfileDiagnoseState(),
  );
  const diagnoseLoadingStateStore = writable({ diagnoseLoading: false });
  const diagnoseDisplayStateStore = derived(
    [diagnoseStateStore, currentLanguageState],
    ([$state]) =>
      profileDiagnoseDisplay($state.report, $state.resultName, $state.status),
  );
  const panelDisplayStateStore = derived(
    [profileDiagnoseOptionsState, currentLanguageState],
    ([$options]) => profileDiagnosePanelDisplay($options),
  );
  let diagnoseLoading = false;

  async function runProfileDiagnose(): Promise<void> {
    if (diagnoseLoading) return;
    diagnoseLoading = true;
    diagnoseLoadingStateStore.set({ diagnoseLoading: true });
    const selected = safeString(
      getStore(profileDiagnoseOptionsState).selected,
    ).trim();
    diagnoseStateStore.set({
      ...createProfileDiagnoseState(),
      status: { message: tr("running", "running"), tone: "running" },
    });
    try {
      const result = await diagnoseCustomProfile(selected);
      diagnoseStateStore.set({
        ...createProfileDiagnoseState(),
        report: result.diagnostics,
        resultName: result.name || selected,
        status: { message: "", tone: "info" },
      });
    } catch (error) {
      diagnoseStateStore.set({
        ...createProfileDiagnoseState(),
        status: { message: errorMessage(error), tone: "error" },
      });
    } finally {
      diagnoseLoading = false;
      diagnoseLoadingStateStore.set({ diagnoseLoading: false });
    }
  }

  return {
    diagnoseDisplayStateStore,
    diagnoseLoadingStateStore,
    diagnoseStateStore,
    panelDisplayStateStore,
    runProfileDiagnose,
  };
}

export function setDetectProfileForm(detectProfile: unknown): void {
  profileDetectFormStateStore.set(normalizeDetectProfileForm(detectProfile));
}

function updateProfileDetectProbes(
  updater: (probes: ProfileDetectProbe[]) => ProfileDetectProbe[],
): void {
  profileDetectFormStateStore.update((state) => ({
    ...state,
    probes: updater(state.probes),
  }));
}

function updateProfileDetectInitialRules(
  updater: (rules: ProfileDetectRule[]) => ProfileDetectRule[],
): void {
  profileDetectFormStateStore.update((state) => ({
    ...state,
    initialRules: updater(state.initialRules),
  }));
}

export function setProfileDetectEnabled(enabled: unknown): void {
  profileDetectFormStateStore.update((state) => ({
    ...state,
    enabled: !!enabled,
  }));
}

export function ensureProfileDetectDefaults(): void {
  if (!getStore(profileDetectFormStateStore).enabled) return;
  profileDetectFormStateStore.update(ensureDetectProfileDefaults);
}

export function addProfileDetectInitialRule(detectRule: unknown = {}): void {
  updateProfileDetectInitialRules((rules) => [
    ...rules,
    normalizeDetectRule(detectRule),
  ]);
}

export function patchProfileDetectInitialRule(
  index: number,
  patch: unknown,
): void {
  const value = recordValue(patch);
  updateProfileDetectInitialRules((rules) =>
    rules.map((rule, currentIndex) =>
      currentIndex === index
        ? ({ ...rule, ...value } as ProfileDetectRule)
        : rule,
    ),
  );
}

export function removeProfileDetectInitialRule(index: number): void {
  updateProfileDetectInitialRules((rules) =>
    rules.filter((_, currentIndex) => currentIndex !== index),
  );
}

export function addProfileDetectProbe(detectProbe: unknown = {}): void {
  updateProfileDetectProbes((probes) => [
    ...probes,
    normalizeDetectProbe(detectProbe),
  ]);
}

export function patchProfileDetectProbe(index: number, patch: unknown): void {
  const value = recordValue(patch);
  updateProfileDetectProbes((probes) =>
    probes.map((probe, currentIndex) =>
      currentIndex === index
        ? ({ ...probe, ...value } as ProfileDetectProbe)
        : probe,
    ),
  );
}

export function removeProfileDetectProbe(index: number): void {
  updateProfileDetectProbes((probes) =>
    probes.filter((_, currentIndex) => currentIndex !== index),
  );
}

export function addProfileDetectProbeRule(
  probeIndex: number,
  detectRule: unknown = {},
): void {
  updateProfileDetectProbes((probes) =>
    probes.map((probe, index) =>
      index === probeIndex
        ? { ...probe, rules: [...probe.rules, normalizeDetectRule(detectRule)] }
        : probe,
    ),
  );
}

export function patchProfileDetectProbeRule(
  probeIndex: number,
  ruleIndex: number,
  patch: unknown,
): void {
  const value = recordValue(patch);
  updateProfileDetectProbes((probes) =>
    probes.map((probe, index) =>
      index === probeIndex
        ? {
            ...probe,
            rules: probe.rules.map((rule, currentRuleIndex) =>
              currentRuleIndex === ruleIndex
                ? ({ ...rule, ...value } as ProfileDetectRule)
                : rule,
            ),
          }
        : probe,
    ),
  );
}

export function removeProfileDetectProbeRule(
  probeIndex: number,
  ruleIndex: number,
): void {
  updateProfileDetectProbes((probes) =>
    probes.map((probe, index) =>
      index === probeIndex
        ? { ...probe, rules: probe.rules.filter((_, i) => i !== ruleIndex) }
        : probe,
    ),
  );
}

export function addProfileDetectProbeErrorPattern(
  probeIndex: number,
  pattern = "",
): void {
  updateProfileDetectProbes((probes) =>
    probes.map((probe, index) =>
      index === probeIndex
        ? {
            ...probe,
            error_patterns: [...probe.error_patterns, safeString(pattern)],
          }
        : probe,
    ),
  );
}

export function setProfileDetectProbeErrorPattern(
  probeIndex: number,
  patternIndex: number,
  value: unknown,
): void {
  updateProfileDetectProbes((probes) =>
    probes.map((probe, index) =>
      index === probeIndex
        ? {
            ...probe,
            error_patterns: probe.error_patterns.map((pattern, currentIndex) =>
              currentIndex === patternIndex ? safeString(value ?? "") : pattern,
            ),
          }
        : probe,
    ),
  );
}

export function removeProfileDetectProbeErrorPattern(
  probeIndex: number,
  patternIndex: number,
): void {
  updateProfileDetectProbes((probes) =>
    probes.map((probe, index) =>
      index === probeIndex
        ? {
            ...probe,
            error_patterns: probe.error_patterns.filter(
              (_, i) => i !== patternIndex,
            ),
          }
        : probe,
    ),
  );
}

export function collectDetectProfileForm(): UnknownRecord | null {
  return collectDetectProfile(getStore(profileDetectFormStateStore), {
    invalidWeight: t("detectWeightInvalid"),
    probeCommandRequired: t("detectProbeCommandRequired"),
  });
}

export function createCustomProfileDetectPanelWorkspace() {
  const detectDisplayStateStore = derived(
    [profileDetectFormStateStore, currentLanguageState],
    ([$state]) => customProfileDetectPanelDisplay($state),
  );
  return {
    detectDisplayStateStore,
    setPanelContext({ active = false }: { active?: boolean } = {}) {
      if (active) ensureProfileDetectDefaults();
    },
  };
}
