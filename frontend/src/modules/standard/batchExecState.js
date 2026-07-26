import { get, writable } from "svelte/store";
import { executeExecBatch } from "../../api/client.js";
import { t } from "../../lib/i18n.js";
import { safeString } from "../../lib/ui.js";
import {
  CONNECTION_PICKER,
  connectionPickerValues,
} from "../connections/connectionFieldStoreState.js";
import { recordLevelPayload } from "../overlays/overlays.js";

export const EMPTY_BATCH_EXEC_RESULT = Object.freeze({ kind: "empty" });

export const batchExecFormState = writable({
  command: "",
  maxParallel: "",
  mode: "",
});

export const batchExecResultState = writable(EMPTY_BATCH_EXEC_RESULT);

export function setBatchExecField(field, value) {
  batchExecFormState.update((form) => ({
    ...form,
    [field]: safeString(value),
  }));
}

export function normalizeBatchExecMaxParallel(value) {
  const parsed = Number.parseInt(safeString(value).trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function batchExecPayload(form = get(batchExecFormState)) {
  const maxParallel = normalizeBatchExecMaxParallel(form.maxParallel);
  return {
    command: safeString(form.command).trim(),
    mode: safeString(form.mode).trim() || null,
    targets: connectionPickerValues(CONNECTION_PICKER.batchExecTargets),
    groups: connectionPickerValues(CONNECTION_PICKER.batchExecGroups),
    labels: connectionPickerValues(CONNECTION_PICKER.batchExecLabels),
    ...(maxParallel ? { max_parallel: maxParallel } : {}),
  };
}

export async function executeBatchExecCommand() {
  const payload = batchExecPayload();
  if (!payload.command) {
    batchExecResultState.set({
      kind: "error",
      message: t("batchExecCommandRequired"),
    });
    return;
  }
  if (
    !payload.targets.length &&
    !payload.groups.length &&
    !payload.labels.length
  ) {
    batchExecResultState.set({
      kind: "error",
      message: t("batchShowTargetRequired"),
    });
    return;
  }
  batchExecResultState.set({ kind: "running" });
  try {
    const resultPayload = await executeExecBatch({
      ...payload,
      record_level: recordLevelPayload(),
    });
    batchExecResultState.set({ kind: "result", resultPayload });
  } catch (error) {
    batchExecResultState.set({ kind: "error", message: error.message });
  }
}
