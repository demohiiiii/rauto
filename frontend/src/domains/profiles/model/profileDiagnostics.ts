import type {
  ProfileDetectConfig,
  ProfileDetectProbe,
  ProfileDetectRule,
  ProfileStateMachineDiagnostics,
  ProfileStatusTone,
  UnknownRecord,
} from "./types.js";

export interface ProfileDetectRuleDraft {
  pattern: string;
  weight: string;
}

export interface ProfileDetectProbeDraft {
  command: string;
  error_patterns: string[];
  rules: ProfileDetectRuleDraft[];
}

export interface ProfileDetectFormState {
  enabled: boolean;
  initialRules: ProfileDetectRuleDraft[];
  probes: ProfileDetectProbeDraft[];
}

export interface ProfileDiagnoseStatus {
  message: string;
  tone: ProfileStatusTone;
}

export interface ProfileDiagnoseState {
  diagnoseLoading: boolean;
  report: ProfileStateMachineDiagnostics | null;
  resultName: string;
  status: ProfileDiagnoseStatus;
}

export interface ProfileDiagnoseOptionsState {
  profiles: string[];
  selected: string;
}

export interface DetectProfileValidationMessages {
  invalidWeight: string;
  probeCommandRequired: string;
}

export function createProfileDiagnoseState(): ProfileDiagnoseState {
  return {
    diagnoseLoading: false,
    report: null,
    resultName: "",
    status: { message: "-", tone: "info" },
  };
}

export function normalizeDetectRule(
  detectRule: Partial<ProfileDetectRuleDraft> | ProfileDetectRule = {},
): ProfileDetectRuleDraft {
  return {
    pattern: detectRule.pattern ?? "",
    weight: detectRule.weight == null ? "50" : String(detectRule.weight),
  };
}

export function normalizeDetectProbe(
  detectProbe: Partial<ProfileDetectProbeDraft> | ProfileDetectProbe = {},
): ProfileDetectProbeDraft {
  const rules = detectProbe.rules ?? [];
  return {
    command: detectProbe.command ?? "",
    error_patterns: [...(detectProbe.error_patterns ?? [])],
    rules: rules.length
      ? rules.map(normalizeDetectRule)
      : [normalizeDetectRule()],
  };
}

export function normalizeDetectProfileForm(
  detectProfile: ProfileDetectConfig | null | undefined,
): ProfileDetectFormState {
  const enabled = !!detectProfile;
  const initialRules = (detectProfile?.initial_rules ?? []).map(
    normalizeDetectRule,
  );
  const probes = (detectProfile?.probes ?? []).map(normalizeDetectProbe);
  return {
    enabled,
    initialRules:
      enabled && !initialRules.length ? [normalizeDetectRule()] : initialRules,
    probes: enabled && !probes.length ? [normalizeDetectProbe()] : probes,
  };
}

export function ensureDetectProfileDefaults(
  form: ProfileDetectFormState,
): ProfileDetectFormState {
  if (!form.enabled) return form;
  return {
    ...form,
    initialRules: form.initialRules.length
      ? form.initialRules
      : [normalizeDetectRule()],
    probes: form.probes.length ? form.probes : [normalizeDetectProbe()],
  };
}

function collectDetectRules(
  rows: ProfileDetectRuleDraft[],
  invalidWeightMessage: string,
): ProfileDetectRule[] {
  return rows.flatMap((rule) => {
    const pattern = rule.pattern.trim();
    const rawWeight = rule.weight.trim();
    const weight = rawWeight ? Number(rawWeight) : 50;
    if (!pattern) return [];
    if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(weight)) {
      throw new Error(invalidWeightMessage);
    }
    return [{ pattern, weight }];
  });
}

export function collectDetectProfile(
  form: ProfileDetectFormState,
  messages: DetectProfileValidationMessages,
): ProfileDetectConfig | null {
  if (!form.enabled) return null;
  const probes = form.probes.flatMap((probe) => {
    const command = probe.command.trim();
    const rules = collectDetectRules(probe.rules, messages.invalidWeight);
    const error_patterns = probe.error_patterns
      .map((pattern) => pattern.trim())
      .filter(Boolean);
    if (!command && rules.length === 0 && error_patterns.length === 0)
      return [];
    if (!command) throw new Error(messages.probeCommandRequired);
    return [{ command, error_patterns, rules }];
  });
  return {
    initial_rules: collectDetectRules(
      form.initialRules,
      messages.invalidWeight,
    ),
    probes,
  };
}
