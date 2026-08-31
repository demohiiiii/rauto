import { safeString } from "../../../lib/ui.js";
import type {
  StandardBatchExecForm,
  StandardBatchExecPayload,
  StandardBatchFlowForm,
  StandardBatchFlowPayload,
  StandardBatchTargetSelection,
  StandardSessionRetryState,
} from "./types.js";

const BUILTIN_TEMPLATE_PREFIX = "builtin:";

export function newStandardBatchExecForm(
  retry: StandardSessionRetryState,
): StandardBatchExecForm {
  return {
    command: "",
    maxParallel: "",
    mode: "",
    retry,
  };
}

export function newStandardBatchFlowForm(
  retry: StandardSessionRetryState,
): StandardBatchFlowForm {
  return {
    maxParallel: "",
    retry,
    template: "",
    varsJson: "",
  };
}

export function normalizeBatchExecMaxParallel(value: unknown): number | null {
  const parsed = Number.parseInt(safeString(value).trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function batchFlowTemplatePayload(
  template: unknown,
): Record<string, string> {
  const trimmed = safeString(template).trim();
  if (trimmed.startsWith(BUILTIN_TEMPLATE_PREFIX)) {
    return {
      builtin_template_name: trimmed.slice(BUILTIN_TEMPLATE_PREFIX.length),
    };
  }
  return { template_name: trimmed };
}

export function parseBatchFlowVars(
  varsJson: unknown,
): { vars: unknown } | { error: string } {
  const trimmed = safeString(varsJson).trim();
  if (!trimmed) return { vars: null };
  try {
    return { vars: JSON.parse(trimmed) as unknown };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : safeString(error),
    };
  }
}

export function buildStandardBatchExecPayload(
  form: StandardBatchExecForm,
  selection: StandardBatchTargetSelection,
  retryFields: Record<string, unknown> = {},
): StandardBatchExecPayload {
  const maxParallel = normalizeBatchExecMaxParallel(form.maxParallel);
  return {
    command: safeString(form.command).trim(),
    mode: safeString(form.mode).trim() || null,
    targets: selection.targets,
    groups: selection.groups,
    labels: selection.labels,
    ...(maxParallel ? { max_parallel: maxParallel } : {}),
    ...retryFields,
  };
}

export function buildStandardBatchFlowPayload(
  form: StandardBatchFlowForm,
  selection: StandardBatchTargetSelection,
  vars: unknown,
  retryFields: Record<string, unknown> = {},
): StandardBatchFlowPayload {
  const maxParallel = normalizeBatchExecMaxParallel(form.maxParallel);
  return {
    ...batchFlowTemplatePayload(form.template),
    ...(vars === null ? {} : { vars }),
    targets: selection.targets,
    groups: selection.groups,
    labels: selection.labels,
    ...(maxParallel ? { max_parallel: maxParallel } : {}),
    ...retryFields,
  };
}
