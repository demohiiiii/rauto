import { get, writable } from "svelte/store";
import { executeFlowBatch, listTemplateResource } from "../../api/client.js";
import { t } from "../../lib/i18n.js";
import { safeString } from "../../lib/ui.js";
import {
  CONNECTION_PICKER,
  connectionPickerValues,
} from "../connections/connectionFieldStoreState.js";
import { recordLevelPayload } from "../overlays/overlays.js";
import { normalizeBatchExecMaxParallel } from "./batchExecState.js";
import {
  createSessionRetryState,
  sessionRetryRequestFields,
} from "../operations/sessionRetry.js";

export const EMPTY_BATCH_FLOW_RESULT = Object.freeze({ kind: "empty" });

const BUILTIN_TEMPLATE_PREFIX = "builtin:";

export const batchFlowFormState = writable({
  maxParallel: "",
  retry: createSessionRetryState(),
  template: "",
  varsJson: "",
});

export const batchFlowResultState = writable(EMPTY_BATCH_FLOW_RESULT);
export const batchFlowTemplateOptionsState = writable([]);

export function setBatchFlowField(field, value) {
  batchFlowFormState.update((form) => ({
    ...form,
    [field]: safeString(value),
  }));
}

export function setBatchFlowRetry(retry = {}) {
  batchFlowFormState.update((form) => ({
    ...form,
    retry: { ...createSessionRetryState(), ...retry },
  }));
}

export async function loadBatchFlowTemplateOptions() {
  const [saved, builtins] = await Promise.all([
    listTemplateResource("/api/flow-templates").catch(() => []),
    listTemplateResource("/api/flow-templates/builtins").catch(() => []),
  ]);
  const options = [
    ...(Array.isArray(saved) ? saved : []).map((item) => ({
      labelText: item.name,
      valueText: item.name,
    })),
    ...(Array.isArray(builtins) ? builtins : []).map((item) => ({
      labelText: `${BUILTIN_TEMPLATE_PREFIX}${item.name}`,
      valueText: `${BUILTIN_TEMPLATE_PREFIX}${item.name}`,
    })),
  ];
  batchFlowTemplateOptionsState.set(options);
  return options;
}

export function batchFlowTemplatePayload(template) {
  const trimmed = safeString(template).trim();
  if (trimmed.startsWith(BUILTIN_TEMPLATE_PREFIX)) {
    return {
      builtin_template_name: trimmed.slice(BUILTIN_TEMPLATE_PREFIX.length),
    };
  }
  return { template_name: trimmed };
}

export function parseBatchFlowVars(varsJson) {
  const trimmed = safeString(varsJson).trim();
  if (!trimmed) return { vars: null };
  try {
    return { vars: JSON.parse(trimmed) };
  } catch (error) {
    return { error: error.message };
  }
}

export async function executeBatchFlow() {
  const form = get(batchFlowFormState);
  const template = safeString(form.template).trim();
  if (!template) {
    batchFlowResultState.set({
      kind: "error",
      message: t("batchFlowTemplateRequired"),
    });
    return;
  }
  const targets = connectionPickerValues(CONNECTION_PICKER.batchFlowTargets);
  const groups = connectionPickerValues(CONNECTION_PICKER.batchFlowGroups);
  const labels = connectionPickerValues(CONNECTION_PICKER.batchFlowLabels);
  if (!targets.length && !groups.length && !labels.length) {
    batchFlowResultState.set({
      kind: "error",
      message: t("batchShowTargetRequired"),
    });
    return;
  }
  const parsedVars = parseBatchFlowVars(form.varsJson);
  if (parsedVars.error) {
    batchFlowResultState.set({
      kind: "error",
      message: `${t("batchFlowVarsInvalid")}: ${parsedVars.error}`,
    });
    return;
  }
  const maxParallel = normalizeBatchExecMaxParallel(form.maxParallel);
  batchFlowResultState.set({ kind: "running" });
  try {
    const resultPayload = await executeFlowBatch({
      ...batchFlowTemplatePayload(template),
      ...(parsedVars.vars === null ? {} : { vars: parsedVars.vars }),
      targets,
      groups,
      labels,
      ...(maxParallel ? { max_parallel: maxParallel } : {}),
      ...sessionRetryRequestFields(form.retry),
      record_level: recordLevelPayload(),
    });
    batchFlowResultState.set({ kind: "result", resultPayload });
  } catch (error) {
    batchFlowResultState.set({ kind: "error", message: error.message });
  }
}
