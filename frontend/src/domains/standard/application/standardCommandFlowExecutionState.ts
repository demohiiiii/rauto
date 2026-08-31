import { get, writable } from "svelte/store";
import {
  defaultStandardExecMode,
  normalizeStandardExecMode,
} from "../../../config/dashboardModes.js";
import { safeString } from "../../../lib/ui.js";
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
  StandardCommandFlowTextfsmFields,
  StandardCommandFlowTextfsmState,
  StandardLoadingRunnerFactory,
  StandardParsedOutputSheet,
  StandardSessionRetryState,
} from "../model/types.js";

export const EMPTY_RESULT: StandardCommandExecutionResult = { kind: "empty" };
export const DEFAULT_STANDARD_PAGE_MODE = normalizeStandardExecMode(
  defaultStandardExecMode,
);

interface StandardStateContext {
  commandFlowExecutionResult: ReturnType<
    typeof writable<StandardCommandExecutionResult>
  >;
  standardFormFieldsState: Map<string, Record<string, unknown>>;
}

let standardStateContext: StandardStateContext | null = null;

function createStandardStateContext(): StandardStateContext {
  return {
    commandFlowExecutionResult:
      writable<StandardCommandExecutionResult>(EMPTY_RESULT),
    standardFormFieldsState: new Map(),
  };
}

function currentStandardStateContext(): StandardStateContext {
  if (!standardStateContext) {
    standardStateContext = createStandardStateContext();
  }
  return standardStateContext;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
  template: unknown = "",
): void {
  textfsmStateStore.update((textfsmState) => ({
    ...textfsmState,
    template: safeString(template),
  }));
}

function setCommandFlowExecutionResult(
  executionResult: StandardCommandExecutionResult = EMPTY_RESULT,
): void {
  currentStandardStateContext().commandFlowExecutionResult.set(executionResult);
}

function setStandardFormFields(key: string, fields: unknown = {}): void {
  currentStandardStateContext().standardFormFieldsState.set(key, {
    ...record(fields),
  });
}

function standardFormFields(key: string): Record<string, unknown> {
  return currentStandardStateContext().standardFormFieldsState.get(key) || {};
}

function textfsmPayload(): Record<string, unknown> {
  const textfsmForm = standardFormFields("textfsm");
  return standardCommandFlowTextfsmPayload({
    enabled: textfsmForm.parseTextfsm ?? textfsmForm.parse_textfsm,
    platform: textfsmForm.textfsmPlatform ?? textfsmForm.textfsm_platform,
    strictErrors:
      textfsmForm.textfsmStrictErrors ?? textfsmForm.textfsm_strict_errors,
    template: textfsmForm.textfsmTemplate ?? textfsmForm.textfsm_template,
  });
}

export function normalizeCommandFlowExecutionSource(source: unknown = {}) {
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
  setStandardFormFields("textfsm", {
    parseTextfsm: !!textfsmFields.enabled,
    textfsmPlatform: safeString(textfsmFields.platform),
    textfsmStrictErrors: !!textfsmFields.strictErrors,
    textfsmTemplate: safeString(textfsmFields.template),
  });
}

export async function executeCommandFlow(
  executionSource: unknown = null,
  retry: StandardSessionRetryState = standardCommandFlowRuntime.createRetryState(),
): Promise<void> {
  if (!standardCommandFlowRuntime.ensureTarget()) return;
  setCommandFlowExecutionResult({ kind: "running" });
  try {
    const flowForm = standardFormFields("flow");
    const source = normalizeCommandFlowExecutionSource(
      executionSource || {
        kind: "saved",
        templateSelection: flowForm.templateSelection,
      },
    );
    if (source.kind === "saved") {
      await standardCommandFlowRuntime.ensureTemplateDetail(
        source.templateSelection,
        { silent: true },
      );
    }
    const flowResult = await standardCommandFlowApi.executeFlow(
      commandFlowExecutionPayload({
        connection: standardCommandFlowRuntime.connectionPayload(),
        recordLevel: standardCommandFlowRuntime.recordLevelPayload(),
        retry,
        source,
        textfsm: textfsmPayload(),
        vars: standardCommandFlowRuntime.buildVarsPayload(),
      }),
    );
    setCommandFlowExecutionResult({
      kind: "result",
      resultPayload: flowResult,
    });
    standardCommandFlowRuntime.applyRecording(flowResult);
  } catch (error) {
    setCommandFlowExecutionResult({
      kind: "error",
      message: errorMessage(error),
    });
  }
}

export async function exportCommandFlowExcel(
  exportParsedOutputSheetsExcel: (
    sheets: StandardParsedOutputSheet[],
    options: { filename: string },
  ) => Promise<unknown> | unknown,
): Promise<void> {
  await exportParsedOutputSheetsExcel(commandFlowParsedOutputSheets(), {
    filename: "textfsm-flow.xlsx",
  });
}

export function commandFlowParsedOutputSheets(
  flowExecutionResult: StandardCommandExecutionResult = get(
    currentStandardStateContext().commandFlowExecutionResult,
  ),
): StandardParsedOutputSheet[] {
  const resultPayload =
    flowExecutionResult.kind === "result"
      ? flowExecutionResult.resultPayload
      : null;
  const outputs = Array.isArray(resultPayload?.outputs)
    ? resultPayload.outputs
    : [];
  return standardCommandFlowRuntime.parsedOutputSheets(outputs, {
    sheetName: (flowOutput, index) =>
      safeString(flowOutput.command ?? "") || `command_${index + 1}`,
  });
}

export function refreshStandardExecutionModeOptions(): Promise<unknown> {
  return standardCommandFlowRuntime.refreshModeOptions();
}
