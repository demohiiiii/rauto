import { get, writable } from "svelte/store";
import { t } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import { standardBatchApi } from "../infrastructure/standardBatchApi.js";
import { standardBatchRuntime } from "../infrastructure/standardBatchRuntime.js";
import {
  batchFlowTemplatePayload,
  buildStandardBatchExecPayload,
  buildStandardBatchFlowPayload,
  newStandardBatchExecForm,
  newStandardBatchFlowForm,
  normalizeBatchExecMaxParallel,
  parseBatchFlowVars,
} from "../model/standardBatch.js";
import type {
  StandardBatchExecField,
  StandardBatchExecForm,
  StandardBatchExecutionResult,
  StandardBatchFlowField,
  StandardBatchFlowForm,
  StandardBatchTemplateOption,
} from "../model/types.js";

const BUILTIN_TEMPLATE_PREFIX = "builtin:";

export const EMPTY_BATCH_EXEC_RESULT = Object.freeze({
  kind: "empty" as const,
});
export const EMPTY_BATCH_FLOW_RESULT = Object.freeze({
  kind: "empty" as const,
});

export const batchExecFormState = writable<StandardBatchExecForm>(
  newStandardBatchExecForm(standardBatchRuntime.createRetryState()),
);
export const batchExecResultState = writable<StandardBatchExecutionResult>(
  EMPTY_BATCH_EXEC_RESULT,
);
export const batchFlowFormState = writable<StandardBatchFlowForm>(
  newStandardBatchFlowForm(standardBatchRuntime.createRetryState()),
);
export const batchFlowResultState = writable<StandardBatchExecutionResult>(
  EMPTY_BATCH_FLOW_RESULT,
);
export const batchFlowTemplateOptionsState = writable<
  StandardBatchTemplateOption[]
>([]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : safeString(error);
}

function hasTargets(selection: {
  groups: string[];
  labels: string[];
  targets: string[];
}): boolean {
  return Boolean(
    selection.targets.length ||
    selection.groups.length ||
    selection.labels.length,
  );
}

export function setBatchExecField(
  field: StandardBatchExecField,
  value: unknown,
): void {
  batchExecFormState.update((form) => ({
    ...form,
    [field]: safeString(value),
  }));
}

export function setBatchExecRetry(retry: unknown = {}): void {
  batchExecFormState.update((form) => ({
    ...form,
    retry: {
      ...standardBatchRuntime.createRetryState(),
      ...record(retry),
    },
  }));
}

export function batchExecPayload(
  form: StandardBatchExecForm = get(batchExecFormState),
) {
  return buildStandardBatchExecPayload(
    form,
    standardBatchRuntime.batchExecTargets(),
    standardBatchRuntime.retryRequestFields(form.retry),
  );
}

export async function executeBatchExecCommand(): Promise<void> {
  const payload = batchExecPayload();
  if (!payload.command) {
    batchExecResultState.set({
      kind: "error",
      message: t("batchExecCommandRequired"),
    });
    return;
  }
  if (!hasTargets(payload)) {
    batchExecResultState.set({
      kind: "error",
      message: t("batchShowTargetRequired"),
    });
    return;
  }
  batchExecResultState.set({ kind: "running" });
  try {
    const resultPayload = await standardBatchApi.executeCommand({
      ...payload,
      record_level: standardBatchRuntime.recordLevelPayload(),
    });
    batchExecResultState.set({ kind: "result", resultPayload });
  } catch (error) {
    batchExecResultState.set({
      kind: "error",
      message: errorMessage(error),
    });
  }
}

export function setBatchFlowField(
  field: StandardBatchFlowField,
  value: unknown,
): void {
  batchFlowFormState.update((form) => ({
    ...form,
    [field]: safeString(value),
  }));
}

export function setBatchFlowRetry(retry: unknown = {}): void {
  batchFlowFormState.update((form) => ({
    ...form,
    retry: {
      ...standardBatchRuntime.createRetryState(),
      ...record(retry),
    },
  }));
}

function templateOptions(items: unknown, builtin = false) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const name = safeString(record(item).name);
    const value = builtin ? `${BUILTIN_TEMPLATE_PREFIX}${name}` : name;
    return { labelText: value, valueText: value };
  });
}

export async function loadBatchFlowTemplateOptions(): Promise<
  StandardBatchTemplateOption[]
> {
  const [saved, builtins] = await Promise.all([
    standardBatchApi.listTemplates("/api/flow-templates").catch(() => []),
    standardBatchApi
      .listTemplates("/api/flow-templates/builtins")
      .catch(() => []),
  ]);
  const options = [
    ...templateOptions(saved),
    ...templateOptions(builtins, true),
  ];
  batchFlowTemplateOptionsState.set(options);
  return options;
}

export async function executeBatchFlow(): Promise<void> {
  const form = get(batchFlowFormState);
  const template = safeString(form.template).trim();
  if (!template) {
    batchFlowResultState.set({
      kind: "error",
      message: t("batchFlowTemplateRequired"),
    });
    return;
  }
  const selection = standardBatchRuntime.batchFlowTargets();
  if (!hasTargets(selection)) {
    batchFlowResultState.set({
      kind: "error",
      message: t("batchShowTargetRequired"),
    });
    return;
  }
  const parsedVars = parseBatchFlowVars(form.varsJson);
  if ("error" in parsedVars) {
    batchFlowResultState.set({
      kind: "error",
      message: `${t("batchFlowVarsInvalid")}: ${parsedVars.error}`,
    });
    return;
  }
  const payload = buildStandardBatchFlowPayload(
    form,
    selection,
    parsedVars.vars,
    standardBatchRuntime.retryRequestFields(form.retry),
  );
  batchFlowResultState.set({ kind: "running" });
  try {
    const resultPayload = await standardBatchApi.executeFlow({
      ...payload,
      record_level: standardBatchRuntime.recordLevelPayload(),
    });
    batchFlowResultState.set({ kind: "result", resultPayload });
  } catch (error) {
    batchFlowResultState.set({
      kind: "error",
      message: errorMessage(error),
    });
  }
}
