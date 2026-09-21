import { get, writable } from "svelte/store";
import {
  defaultStandardExecMode,
  normalizeStandardExecMode,
} from "../../../config/dashboardModes.js";
import { safeString } from "../../../lib/ui.js";
import {
  downloadCommandOutput,
  exportParsedOutputSheetsExcel,
} from "$domains/execution/index.js";
import type { SessionRetryState } from "$domains/execution/index.js";
import { standardCommandFlowApi } from "../infrastructure/standardCommandFlowApi.js";
import { standardCommandFlowRuntime } from "../infrastructure/standardCommandFlowRuntime.js";
import {
  buildCommandFlowExecutionPayload,
  normalizeCommandFlowExecutionSource as normalizeExecutionSource,
  standardCommandFlowTextfsmPayload,
} from "../model/standardCommandFlow.js";
import type {
  StandardCommandExecutionResult,
  StandardCommandFlowExecutionInput,
  StandardCommandFlowExecutionResponse,
  StandardCommandFlowExecutionSourceInput,
  StandardCommandFlowTextfsmFields,
  StandardCommandFlowTextfsmPayload,
  StandardCommandFlowTextfsmState,
  StandardLoadingRunnerFactory,
  StandardParsedOutputSheet,
} from "../model/types.js";

type CommandFlowExecutionResult =
  StandardCommandExecutionResult<StandardCommandFlowExecutionResponse>;

export const EMPTY_RESULT: CommandFlowExecutionResult = { kind: "empty" };
export const DEFAULT_STANDARD_PAGE_MODE = normalizeStandardExecMode(
  defaultStandardExecMode,
);

interface StandardStateContext {
  commandFlowExecutionResult: ReturnType<
    typeof writable<CommandFlowExecutionResult>
  >;
  textfsmFields: StandardCommandFlowTextfsmPayload;
  autoDownloadExcel: boolean;
  autoDownloadOutput: boolean;
}

let standardStateContext: StandardStateContext | null = null;

function createStandardStateContext(): StandardStateContext {
  return {
    commandFlowExecutionResult:
      writable<CommandFlowExecutionResult>(EMPTY_RESULT),
    textfsmFields: standardCommandFlowTextfsmPayload(),
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

export function commandFlowExecutionResultState() {
  return currentStandardStateContext().commandFlowExecutionResult;
}

export function createStandardLoadingKeysStore(
  createLoadingRunner: StandardLoadingRunnerFactory,
) {
  const loadingKeysStore = writable<string[]>([]);
  const loadingRunner = createLoadingRunner(
    () => get(loadingKeysStore),
    (nextKeys) => loadingKeysStore.set(Array.isArray(nextKeys) ? nextKeys : []),
  );
  return { loadingKeysStore, loadingRunner };
}

export function createStandardTextfsmStateStore() {
  return writable<StandardCommandFlowTextfsmState>({
    autoDownloadExcel: false,
    autoDownloadOutput: false,
    enabled: false,
    strictErrors: false,
    template: "",
  });
}

export function setStandardTextfsmEnabled(
  textfsmStateStore: ReturnType<
    typeof writable<StandardCommandFlowTextfsmState>
  >,
  enabled = false,
): void {
  textfsmStateStore.update((textfsmState) => ({
    ...textfsmState,
    enabled: !!enabled,
  }));
}

export function setStandardTextfsmStrictErrors(
  textfsmStateStore: ReturnType<
    typeof writable<StandardCommandFlowTextfsmState>
  >,
  strictErrors = false,
): void {
  textfsmStateStore.update((textfsmState) => ({
    ...textfsmState,
    strictErrors: !!strictErrors,
  }));
}

export function setStandardTextfsmTemplate(
  textfsmStateStore: ReturnType<
    typeof writable<StandardCommandFlowTextfsmState>
  >,
  template = "",
): void {
  textfsmStateStore.update((textfsmState) => ({
    ...textfsmState,
    template,
  }));
}

function setCommandFlowExecutionResult(
  executionResult: CommandFlowExecutionResult = EMPTY_RESULT,
): void {
  currentStandardStateContext().commandFlowExecutionResult.set(executionResult);
}

function textfsmPayload(): StandardCommandFlowTextfsmPayload {
  return currentStandardStateContext().textfsmFields;
}

export function normalizeCommandFlowExecutionSource(
  source: StandardCommandFlowExecutionSourceInput = { kind: "saved" },
) {
  return normalizeExecutionSource(source);
}

export function commandFlowExecutionPayload(
  input: StandardCommandFlowExecutionInput = {},
) {
  const retry = input.retry ?? standardCommandFlowRuntime.createRetryState();
  return buildCommandFlowExecutionPayload(
    input,
    standardCommandFlowRuntime.retryRequestFields(retry),
  );
}

export function setStandardTextfsmFields(
  textfsmFields: StandardCommandFlowTextfsmFields = {},
): void {
  currentStandardStateContext().autoDownloadOutput =
    !!textfsmFields.autoDownloadOutput;
  currentStandardStateContext().autoDownloadExcel =
    !!textfsmFields.autoDownloadExcel;
  currentStandardStateContext().textfsmFields =
    standardCommandFlowTextfsmPayload(textfsmFields);
}

export async function executeCommandFlow(
  executionSource: StandardCommandFlowExecutionSourceInput = { kind: "saved" },
  retry: SessionRetryState = standardCommandFlowRuntime.createRetryState(),
): Promise<void> {
  if (!standardCommandFlowRuntime.ensureTarget()) return;
  const autoDownloadExcel = currentStandardStateContext().autoDownloadExcel;
  const autoDownloadOutput = currentStandardStateContext().autoDownloadOutput;
  const textfsm = textfsmPayload();
  setCommandFlowExecutionResult({ kind: "running" });
  try {
    const connection = standardCommandFlowRuntime.connectionPayload();
    const deviceName = connection.connection_name || connection.host || "";
    const source = normalizeCommandFlowExecutionSource(executionSource);
    if (source.kind === "saved") {
      await standardCommandFlowRuntime.ensureTemplateDetail(
        source.templateSelection,
        { silent: true },
      );
    }
    const flowResult = await standardCommandFlowApi.executeFlow(
      commandFlowExecutionPayload({
        connection,
        recordLevel: standardCommandFlowRuntime.recordLevelPayload(),
        retry,
        source,
        textfsm,
        vars: standardCommandFlowRuntime.buildVarsPayload(),
      }),
    );
    setCommandFlowExecutionResult({
      kind: "result",
      resultPayload: flowResult,
      deviceName,
    });
    if (autoDownloadOutput) {
      await downloadCommandOutput(
        flowResult.outputs.map((result) => ({ ...result, device: deviceName })),
        "flow-output",
      );
    }
    if (autoDownloadExcel && textfsm.parse_textfsm) {
      await exportParsedOutputSheetsExcel(
        commandFlowParsedOutputSheets({
          kind: "result",
          resultPayload: flowResult,
        }),
        {
          filename: "textfsm-flow.xlsx",
        },
      );
    }
  } catch (error) {
    setCommandFlowExecutionResult({
      kind: "error",
      message: errorMessage(error),
    });
  }
}

export async function downloadCommandFlowOutput(): Promise<void> {
  const result = get(commandFlowExecutionResultState());
  if (result.kind !== "result") return;
  await downloadCommandOutput(
    result.resultPayload.outputs.map((item) => ({
      ...item,
      device: result.deviceName,
    })),
    "flow-output",
  );
}

export async function exportCommandFlowExcel(
  exportParsedOutputSheetsExcel: (
    sheets: StandardParsedOutputSheet[],
    options: { filename: string },
  ) => Promise<void> | void,
): Promise<void> {
  await exportParsedOutputSheetsExcel(commandFlowParsedOutputSheets(), {
    filename: "textfsm-flow.xlsx",
  });
}

export function commandFlowParsedOutputSheets(
  flowExecutionResult: CommandFlowExecutionResult = get(
    currentStandardStateContext().commandFlowExecutionResult,
  ),
): StandardParsedOutputSheet[] {
  const resultPayload =
    flowExecutionResult.kind === "result"
      ? flowExecutionResult.resultPayload
      : null;
  const outputs = resultPayload?.outputs ?? [];
  return standardCommandFlowRuntime.parsedOutputSheets(outputs, {
    sheetName: (flowOutput, index) =>
      safeString(flowOutput.command ?? "") || `command_${index + 1}`,
  });
}

export function refreshStandardExecutionModeOptions(): Promise<void> {
  return standardCommandFlowRuntime.refreshModeOptions();
}
