import { get, writable } from "svelte/store";
import { safeString } from "../../../lib/ui.js";
import {
  downloadCommandOutput,
  exportParsedOutputSheetsExcel,
} from "$domains/execution/index.js";
import type { SessionRetryState } from "$domains/execution/index.js";
import { standardInteractiveApi as defaultApi } from "../infrastructure/standardInteractiveApi.js";
import { standardInteractiveRuntime as defaultRuntime } from "../infrastructure/standardInteractiveRuntime.js";
import {
  buildInteractiveExecutionPayload,
  normalizeInteractiveExecutionSource as normalizeExecutionSource,
  standardInteractiveTextfsmPayload,
} from "../model/standardInteractive.js";
import type {
  StandardCommandExecutionResult,
  StandardInteractiveExecutionInput,
  StandardInteractiveExecutionResponse,
  StandardInteractiveExecutionSourceInput,
  StandardInteractiveTextfsmFields,
  StandardInteractiveTextfsmPayload,
  StandardInteractiveTextfsmState,
  StandardLoadingRunnerFactory,
  StandardParsedOutputSheet,
} from "../model/types.js";

import type {
  StandardInteractiveApi,
  StandardInteractiveRuntime,
} from "../model/types.js";
export function createStandardInteractiveExecution({
  runtime: standardInteractiveRuntime = defaultRuntime,
  api: standardInteractiveApi = defaultApi,
}: {
  runtime?: StandardInteractiveRuntime;
  api?: StandardInteractiveApi;
} = {}) {
  type InteractiveExecutionResult =
    StandardCommandExecutionResult<StandardInteractiveExecutionResponse>;

  const EMPTY_RESULT: InteractiveExecutionResult = { kind: "empty" };

  interface StandardStateContext {
    interactiveExecutionResult: ReturnType<
      typeof writable<InteractiveExecutionResult>
    >;
    textfsmFields: StandardInteractiveTextfsmPayload;
    autoDownloadExcel: boolean;
    autoDownloadOutput: boolean;
  }

  let standardStateContext: StandardStateContext | null = null;

  function createStandardStateContext(): StandardStateContext {
    return {
      interactiveExecutionResult:
        writable<InteractiveExecutionResult>(EMPTY_RESULT),
      textfsmFields: standardInteractiveTextfsmPayload(),
      autoDownloadExcel: false,
      autoDownloadOutput: false,
    };
  }

  function currentStandardStateContext(): StandardStateContext {
    if (!standardStateContext) {
      standardStateContext = createStandardStateContext();
    }
    return standardStateContext;
  }

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : safeString(error);
  }

  function interactiveExecutionResultState() {
    return currentStandardStateContext().interactiveExecutionResult;
  }

  function createStandardLoadingKeysStore(
    createLoadingRunner: StandardLoadingRunnerFactory,
  ) {
    const loadingKeysStore = writable<string[]>([]);
    const loadingRunner = createLoadingRunner(
      () => get(loadingKeysStore),
      (nextKeys) =>
        loadingKeysStore.set(Array.isArray(nextKeys) ? nextKeys : []),
    );
    return { loadingKeysStore, loadingRunner };
  }

  function createStandardTextfsmStateStore() {
    return writable<StandardInteractiveTextfsmState>({
      autoDownloadExcel: false,
      autoDownloadOutput: false,
      enabled: false,
      strictErrors: false,
      template: "",
    });
  }

  function setStandardTextfsmEnabled(
    textfsmStateStore: ReturnType<
      typeof writable<StandardInteractiveTextfsmState>
    >,
    enabled = false,
  ): void {
    textfsmStateStore.update((textfsmState) => ({
      ...textfsmState,
      enabled: !!enabled,
    }));
  }

  function setStandardTextfsmStrictErrors(
    textfsmStateStore: ReturnType<
      typeof writable<StandardInteractiveTextfsmState>
    >,
    strictErrors = false,
  ): void {
    textfsmStateStore.update((textfsmState) => ({
      ...textfsmState,
      strictErrors: !!strictErrors,
    }));
  }

  function setStandardTextfsmTemplate(
    textfsmStateStore: ReturnType<
      typeof writable<StandardInteractiveTextfsmState>
    >,
    template = "",
  ): void {
    textfsmStateStore.update((textfsmState) => ({
      ...textfsmState,
      template,
    }));
  }

  function setInteractiveExecutionResult(
    executionResult: InteractiveExecutionResult = EMPTY_RESULT,
  ): void {
    currentStandardStateContext().interactiveExecutionResult.set(
      executionResult,
    );
  }

  function textfsmPayload(): StandardInteractiveTextfsmPayload {
    return currentStandardStateContext().textfsmFields;
  }

  function normalizeInteractiveExecutionSource(
    source: StandardInteractiveExecutionSourceInput = { kind: "saved" },
  ) {
    return normalizeExecutionSource(source);
  }

  function interactiveExecutionPayload(
    input: StandardInteractiveExecutionInput = {},
  ) {
    const retry = input.retry ?? standardInteractiveRuntime.createRetryState();
    return buildInteractiveExecutionPayload(
      input,
      standardInteractiveRuntime.retryRequestFields(retry),
    );
  }

  function setStandardTextfsmFields(
    textfsmFields: StandardInteractiveTextfsmFields = {},
  ): void {
    currentStandardStateContext().autoDownloadOutput =
      !!textfsmFields.autoDownloadOutput;
    currentStandardStateContext().autoDownloadExcel =
      !!textfsmFields.autoDownloadExcel;
    currentStandardStateContext().textfsmFields =
      standardInteractiveTextfsmPayload(textfsmFields);
  }

  async function executeInteractive(
    executionSource: StandardInteractiveExecutionSourceInput = {
      kind: "saved",
    },
    retry: SessionRetryState = standardInteractiveRuntime.createRetryState(),
  ): Promise<void> {
    if (!standardInteractiveRuntime.ensureTarget()) return;
    const autoDownloadExcel = currentStandardStateContext().autoDownloadExcel;
    const autoDownloadOutput = currentStandardStateContext().autoDownloadOutput;
    const textfsm = textfsmPayload();
    setInteractiveExecutionResult({ kind: "running" });
    try {
      const connection = standardInteractiveRuntime.connectionPayload();
      const deviceName = connection.connection_name || connection.host || "";
      const source = normalizeInteractiveExecutionSource(executionSource);
      if (source.kind === "saved") {
        await standardInteractiveRuntime.ensureTemplateDetail(
          source.templateSelection,
          { silent: true },
        );
      }
      const interactiveResult = await standardInteractiveApi.executeInteractive(
        interactiveExecutionPayload({
          connection,
          recordLevel: standardInteractiveRuntime.recordLevelPayload(),
          retry,
          source,
          textfsm,
          vars: standardInteractiveRuntime.buildVarsPayload(),
        }),
      );
      setInteractiveExecutionResult({
        kind: "result",
        resultPayload: interactiveResult,
        deviceName,
      });
      if (autoDownloadOutput) {
        await downloadCommandOutput(
          interactiveResult.outputs.map((result) => ({
            ...result,
            device: deviceName,
          })),
          "interactive-output",
        );
      }
      if (autoDownloadExcel && textfsm.parse_textfsm) {
        await exportParsedOutputSheetsExcel(
          interactiveParsedOutputSheets({
            kind: "result",
            resultPayload: interactiveResult,
          }),
          {
            filename: "textfsm-interactive.xlsx",
          },
        );
      }
    } catch (error) {
      setInteractiveExecutionResult({
        kind: "error",
        message: errorMessage(error),
      });
    }
  }

  async function downloadInteractiveOutput(): Promise<void> {
    const result = get(interactiveExecutionResultState());
    if (result.kind !== "result") return;
    await downloadCommandOutput(
      result.resultPayload.outputs.map((item) => ({
        ...item,
        device: result.deviceName,
      })),
      "interactive-output",
    );
  }

  async function exportInteractiveExcel(
    exportParsedOutputSheetsExcel: (
      sheets: StandardParsedOutputSheet[],
      options: { filename: string },
    ) => Promise<void> | void,
  ): Promise<void> {
    await exportParsedOutputSheetsExcel(interactiveParsedOutputSheets(), {
      filename: "textfsm-interactive.xlsx",
    });
  }

  function interactiveParsedOutputSheets(
    interactiveExecutionResult: InteractiveExecutionResult = get(
      currentStandardStateContext().interactiveExecutionResult,
    ),
  ): StandardParsedOutputSheet[] {
    const resultPayload =
      interactiveExecutionResult.kind === "result"
        ? interactiveExecutionResult.resultPayload
        : null;
    const outputs = resultPayload?.outputs ?? [];
    return standardInteractiveRuntime.parsedOutputSheets(outputs, {
      sheetName: (interactiveOutput, index) =>
        safeString(interactiveOutput.command ?? "") || `command_${index + 1}`,
    });
  }

  function refreshStandardExecutionModeOptions(): Promise<void> {
    return standardInteractiveRuntime.refreshModeOptions();
  }

  return {
    EMPTY_RESULT,
    interactiveExecutionResultState,
    createStandardLoadingKeysStore,
    createStandardTextfsmStateStore,
    setStandardTextfsmEnabled,
    setStandardTextfsmStrictErrors,
    setStandardTextfsmTemplate,
    normalizeInteractiveExecutionSource,
    interactiveExecutionPayload,
    setStandardTextfsmFields,
    executeInteractive,
    downloadInteractiveOutput,
    exportInteractiveExcel,
    interactiveParsedOutputSheets,
    refreshStandardExecutionModeOptions,
  };
}

export const {
  EMPTY_RESULT,
  interactiveExecutionResultState,
  createStandardLoadingKeysStore,
  createStandardTextfsmStateStore,
  setStandardTextfsmEnabled,
  setStandardTextfsmStrictErrors,
  setStandardTextfsmTemplate,
  normalizeInteractiveExecutionSource,
  interactiveExecutionPayload,
  setStandardTextfsmFields,
  executeInteractive,
  downloadInteractiveOutput,
  exportInteractiveExcel,
  interactiveParsedOutputSheets,
  refreshStandardExecutionModeOptions,
} = createStandardInteractiveExecution();
