import { get, writable } from "svelte/store";
import {
  CONNECTION_PICKER,
  connectionPickerState,
} from "$domains/connections/index.js";
import {
  executionHistory,
  downloadCommandOutput,
  exportParsedOutputSheetsExcel,
} from "$domains/execution/index.js";
import { t } from "$lib/i18n.js";
import { standardBatchApi } from "../infrastructure/standardBatchApi.js";
import { standardBatchRuntime } from "../infrastructure/standardBatchRuntime.js";
import {
  normalizeBatchExecMaxParallel,
  buildBatchCommandDeliveryPayload,
  buildBatchInteractiveDeliveryPayload,
  batchCommandDeliveryRows,
  batchDeliveryOutputEntries,
  batchDeliverySheets,
} from "../model/standardBatch.js";
import type {
  StandardBatchExecutionResult,
  StandardBatchInteractiveTargetResponse,
  StandardCommandExecutionPayload,
  StandardInteractiveExecutionPayload,
  StandardCommandRenderPayload,
  StandardCommandTextfsmState,
} from "../model/types.js";

export function createBatchDeliveryWorkspace(kind: "command" | "interactive") {
  const maxParallelStore = writable("");
  const resultStore = writable<
    StandardBatchExecutionResult<StandardBatchInteractiveTargetResponse[]>
  >({ kind: "empty" });
  const downloadErrorStore = writable("");
  let running = false;
  let destroyed = false;
  const selection =
    kind === "command"
      ? standardBatchRuntime.batchExecTargets
      : standardBatchRuntime.batchInteractiveTargets;

  function targetPayload() {
    const selected = selection();
    if (
      !selected.targets.length &&
      !selected.groups.length &&
      !selected.labels.length
    ) {
      throw new Error(t("batchShowTargetRequired"));
    }
    const maxParallel = normalizeBatchExecMaxParallel(get(maxParallelStore));
    return {
      ...selected,
      ...(maxParallel ? { max_parallel: maxParallel } : {}),
    };
  }

  async function downloadOutput(rows = currentRows()) {
    await downloadCommandOutput(
      batchDeliveryOutputEntries(rows),
      `batch-${kind}-output`,
    );
  }

  async function exportExcel(rows = currentRows()) {
    await exportParsedOutputSheetsExcel(batchDeliverySheets(rows), {
      filename: `textfsm-batch-${kind}.xlsx`,
    });
  }

  function currentRows() {
    const result = get(resultStore);
    return result.kind === "result" ? result.resultPayload : [];
  }

  async function execute(
    request: () => Promise<StandardBatchInteractiveTargetResponse[]>,
    settings: StandardCommandTextfsmState,
  ): Promise<boolean> {
    if (running || destroyed) return false;
    running = true;
    const { enabled, autoDownloadExcel, autoDownloadOutput } = settings;
    const historyId = executionHistory.start(kind, "batch", enabled);
    resultStore.set({ kind: "running" });
    downloadErrorStore.set("");
    try {
      const rows = await request();
      executionHistory.finish(
        historyId,
        rows.flatMap((row) => {
          const outputs = row.outputs.map((output) => ({
            ...output,
            device: row.target,
            host: row.host,
            profile: row.profile,
          }));
          if (row.error || !outputs.length)
            outputs.push({
              command: "",
              output: "",
              all: null,
              parsed_output: null,
              parse_error: null,
              exit_code: null,
              error: row.error,
              success: row.success !== false && !row.error,
              device: row.target,
              host: row.host,
              profile: row.profile,
            });
          return outputs;
        }),
        "",
        rows.some((row) => row.success === false),
      );
      if (destroyed) return false;
      resultStore.set({ kind: "result", resultPayload: rows });
      try {
        if (autoDownloadOutput) await downloadOutput(rows);
        if (enabled && autoDownloadExcel) await exportExcel(rows);
      } catch (error) {
        downloadErrorStore.set(
          error instanceof Error ? error.message : String(error),
        );
      }
      return true;
    } catch (error) {
      executionHistory.fail(
        historyId,
        error instanceof Error ? error.message : String(error),
      );
      if (!destroyed)
        resultStore.set({
          kind: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      return false;
    } finally {
      running = false;
    }
  }

  function executeCommand(
    payload: StandardCommandExecutionPayload,
    settings: StandardCommandTextfsmState,
  ) {
    return execute(async () => {
      const response = await standardBatchApi.executeCommand(
        buildBatchCommandDeliveryPayload(payload, targetPayload()),
      );
      return batchCommandDeliveryRows(response);
    }, settings);
  }

  function executeInteractive(
    payload: () => StandardInteractiveExecutionPayload,
    settings: StandardCommandTextfsmState,
  ) {
    return execute(async () => {
      const response = await standardBatchApi.executeInteractive(
        buildBatchInteractiveDeliveryPayload(payload(), targetPayload()),
      );
      return response.results;
    }, settings);
  }

  async function renderTemplate(payload: StandardCommandRenderPayload) {
    const selected = targetPayload();
    // Refresh inventory so recently edited group membership participates in previews.
    const connections = await standardBatchApi.listConnections();
    const names = new Set(selected.targets);
    for (const connection of connections) {
      if (
        (connection.groups || []).some((group) =>
          selected.groups.includes(group),
        ) ||
        (connection.labels || []).some((label) =>
          selected.labels.includes(label),
        )
      )
        names.add(connection.name);
    }
    if (!names.size) throw new Error(t("batchShowObjectsNoTargets"));
    const previews: string[] = [];
    for (const name of [...names].sort()) {
      const result = await standardBatchApi.renderTemplate({
        ...payload,
        connection: { connection_name: name },
      });
      previews.push(`=== ${name} ===\n${result.rendered_commands}`);
    }
    return { rendered_commands: previews.join("\n\n") };
  }

  function subscribeTargets(listener: () => void) {
    const keys =
      kind === "command"
        ? [
            CONNECTION_PICKER.batchExecTargets,
            CONNECTION_PICKER.batchExecGroups,
            CONNECTION_PICKER.batchExecLabels,
          ]
        : [
            CONNECTION_PICKER.batchInteractiveTargets,
            CONNECTION_PICKER.batchInteractiveGroups,
            CONNECTION_PICKER.batchInteractiveLabels,
          ];
    const unsubscribes = keys.map((key) => {
      let previous = "";
      return connectionPickerState(key).subscribe((state) => {
        const next = JSON.stringify(state.values);
        if (next !== previous) {
          previous = next;
          listener();
        }
      });
    });
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }

  return {
    kind,
    maxParallelStore,
    resultStore,
    downloadErrorStore,
    executeCommand,
    executeInteractive,
    renderTemplate,
    subscribeTargets,
    downloadOutput: () => downloadOutput(),
    exportExcel: () => exportExcel(),
    destroy() {
      destroyed = true;
    },
  };
}

export type BatchDeliveryWorkspace = ReturnType<
  typeof createBatchDeliveryWorkspace
>;
