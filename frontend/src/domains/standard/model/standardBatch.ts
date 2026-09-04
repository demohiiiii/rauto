import { safeString } from "../../../lib/ui.js";
import type { JsonValue } from "$lib/jsonValue.js";
import type { SessionRetryState } from "$domains/execution/index.js";
import type {
  StandardBatchExecForm,
  StandardBatchExecPayload,
  StandardBatchFlowForm,
  StandardBatchFlowPayload,
  StandardBatchFlowTemplatePayload,
  StandardBatchRetryFields,
  StandardBatchTargetSelection,
} from "./types.js";

const BUILTIN_TEMPLATE_PREFIX = "builtin:";

export function newStandardBatchExecForm(
  retry: SessionRetryState,
): StandardBatchExecForm {
  return {
    command: "",
    maxParallel: "",
    mode: "",
    retry,
  };
}

export function newStandardBatchFlowForm(
  retry: SessionRetryState,
): StandardBatchFlowForm {
  return {
    maxParallel: "",
    retry,
    template: "",
    varsJson: "",
  };
}

export function normalizeBatchExecMaxParallel(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function batchFlowTemplatePayload(
  template: string,
): StandardBatchFlowTemplatePayload {
  const trimmed = template.trim();
  if (trimmed.startsWith(BUILTIN_TEMPLATE_PREFIX)) {
    return {
      builtin_template_name: trimmed.slice(BUILTIN_TEMPLATE_PREFIX.length),
    };
  }
  return { template_name: trimmed };
}

export function parseBatchFlowVars(
  varsJson: string,
): { vars: JsonValue | null } | { error: string } {
  const trimmed = varsJson.trim();
  if (!trimmed) return { vars: null };
  try {
    return { vars: JSON.parse(trimmed) as JsonValue };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : safeString(error),
    };
  }
}

export function buildStandardBatchExecPayload(
  form: StandardBatchExecForm,
  selection: StandardBatchTargetSelection,
  retryFields: StandardBatchRetryFields = {},
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
  vars: JsonValue | null,
  retryFields: StandardBatchRetryFields = {},
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
