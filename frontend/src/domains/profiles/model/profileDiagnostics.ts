import { safeString } from "../../../lib/ui.js";
import { profileValues } from "./profileEditor.js";
import { recordValue } from "./customProfileForm.js";
import type { UnknownRecord } from "./types.js";

export interface ProfileDetectRule {
  pattern: string;
  weight: string;
}

export interface ProfileDetectProbe {
  command: string;
  error_patterns: string[];
  rules: ProfileDetectRule[];
}

export interface ProfileDetectFormState {
  enabled: boolean;
  initialRules: ProfileDetectRule[];
  probes: ProfileDetectProbe[];
}

export interface ProfileDiagnoseStatus {
  message: string;
  tone: string;
}

export interface ProfileDiagnoseState {
  diagnoseLoading: boolean;
  report: UnknownRecord;
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
    report: {},
    resultName: "",
    status: { message: "-", tone: "info" },
  };
}

export function normalizeDetectRule(
  detectRule: unknown = {},
): ProfileDetectRule {
  const rule = recordValue(detectRule);
  return {
    pattern: safeString(rule.pattern ?? ""),
    weight: rule.weight == null ? "50" : safeString(rule.weight),
  };
}

export function normalizeDetectProbe(
  detectProbe: unknown = {},
): ProfileDetectProbe {
  const probe = recordValue(detectProbe);
  const rules = profileValues(probe.rules);
  return {
    command: safeString(probe.command ?? ""),
    error_patterns: profileValues(probe.error_patterns).map((pattern) =>
      safeString(pattern ?? ""),
    ),
    rules: rules.length
      ? rules.map(normalizeDetectRule)
      : [normalizeDetectRule()],
  };
}

export function normalizeDetectProfileForm(
  detectProfile: unknown,
): ProfileDetectFormState {
  const enabled = !!detectProfile;
  const profile = recordValue(detectProfile);
  const initialRules = profileValues(profile.initial_rules).map(
    normalizeDetectRule,
  );
  const probes = profileValues(profile.probes).map(normalizeDetectProbe);
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
  rows: ProfileDetectRule[],
  invalidWeightMessage: string,
): Array<{ pattern: string; weight: number }> {
  return rows.flatMap((rule) => {
    const pattern = safeString(rule.pattern).trim();
    const rawWeight = safeString(rule.weight).trim();
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
): UnknownRecord | null {
  if (!form.enabled) return null;
  const probes = form.probes.flatMap((probe) => {
    const command = safeString(probe.command).trim();
    const rules = collectDetectRules(probe.rules, messages.invalidWeight);
    const error_patterns = probe.error_patterns
      .map((pattern) => safeString(pattern).trim())
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
