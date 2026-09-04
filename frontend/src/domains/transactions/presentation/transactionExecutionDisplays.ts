import { derived as deriveStore, writable } from "svelte/store";
import {
  TX_EXECUTION_MODE,
  normalizeTxExecutionMode,
} from "../../../config/dashboardModes.js";
import { t } from "../../../lib/i18n.js";
import { classNames, displayText, workflowChipClass } from "../../../lib/ui.js";
import { parsedOutputBlockDisplayFromItem } from "$domains/execution/index.js";
import type { ParsedOutputBlockDisplay } from "$domains/execution/index.js";

export interface TxOperationStepChipRow {
  chipText: string;
}

export interface TxOperationStepDisplay {
  cardClass: string;
  chipClass: string;
  chipRows: TxOperationStepChipRow[];
  commandLabelText: string;
  exitCodeText: number | string;
  modeText: string;
  operationSummaryText: string;
  outputLabelText: string;
  outputText: string;
  parsedOutputBlock: ParsedOutputBlockDisplay;
  promptLabelText: string;
  promptText: string;
  showPrompt: boolean;
  successText: string;
  titleClass: string;
}

export interface TxOperationStepRow extends TxOperationStepDisplay {
  stepNumberText: string;
  titleText: string;
}

export interface TxStepReasonRow {
  reasonText: string;
  titleText: string;
  variant: "muted";
}

export interface TxStepStateChipRow {
  chipClass: string;
  chipText: string;
}

export interface TxStepResultRow {
  executionStateText: string;
  failureReasonText: string;
  forwardOperationRows: TxOperationStepRow[];
  forwardOutputsTitle: string;
  hasForwardOperationRows: boolean;
  hasRollbackOperationRows: boolean;
  noOperationOutputsMessage: string;
  reasonRows: TxStepReasonRow[];
  rollbackOperationRows: TxOperationStepRow[];
  rollbackOutputsTitle: string;
  rollbackReasonText: string;
  rollbackStateText: string;
  stateChipRows: TxStepStateChipRow[];
  stepNumberText: string;
  titleText: string;
}

export interface TxWorkflowPreviewPanelDisplay {
  message?: string;
  previewModeDisplay?: {
    showStatus: boolean;
    showText: boolean;
  };
  previewPresentation?: TxWorkflowPreviewPresentation;
  text?: string;
  tone?: "error" | "info" | "running" | "success" | "warning";
}

type FlexibleRecord = Record<string, unknown>;

interface TxBlockRunPanelWorkspaceInput {
  panelDisplay?: TxBlockRunPanelDisplay | null;
}

interface WorkflowBlockWorkspaceInput {
  workflowBlockRow?: TxWorkflowExecutionBlockRow | null;
}

interface ToneConfig {
  toneName?: string;
}

export type TxStatusTone = "error" | "info" | "running" | "success" | "warning";

function flexibleRecord(value: unknown): FlexibleRecord {
  return value && typeof value === "object" ? (value as FlexibleRecord) : {};
}

function optionalFlexibleRecord(value: unknown): FlexibleRecord | null {
  return value && typeof value === "object" ? (value as FlexibleRecord) : null;
}

const summaryCard = (key: string, summaryValue: unknown) => ({
  label: t(key),
  summaryValue,
});
const summaryRow = (key: string, valueText: string) => ({
  labelText: t(key),
  valueText,
});
const transactionText = (displaySource: unknown): string =>
  displayText(displaySource);
const displayTextOrDash = (displaySource: unknown): string =>
  transactionText(displaySource) || "-";

function transactionStatusTone(value: string): TxStatusTone {
  return value === "error" ||
    value === "running" ||
    value === "success" ||
    value === "warning"
    ? value
    : "info";
}

function txExecutionModePresentation(mode: unknown = "") {
  const normalized = normalizeTxExecutionMode(mode);
  return {
    isDirect: normalized === TX_EXECUTION_MODE.direct,
    isTemplate: normalized === TX_EXECUTION_MODE.template,
    mode: normalized,
  };
}

const txOutputModePresentation = (mode: unknown = "") => ({
  showText: mode === "text",
  showStatus: mode === "status",
  showResult: mode === "result",
});

export function transactionFallbackDisplay(fallbackInput: unknown = {}) {
  const fallback = flexibleRecord(fallbackInput);
  if (!fallback?.mode || fallback.mode === "empty") return null;
  return {
    mode: transactionText(fallback.mode),
    message: transactionText(fallback.message || ""),
    text: transactionText(fallback.text || ""),
    tone: transactionStatusTone(transactionText(fallback.tone)),
  };
}

function transactionOutputStatusDisplay(outputInput: unknown = {}) {
  const output = flexibleRecord(outputInput);
  const mode = transactionText(output.mode || "");
  return {
    ...txOutputModePresentation(mode),
    message: transactionText(output.message || ""),
    mode,
    text: transactionText(output.text || ""),
    tone: transactionStatusTone(transactionText(output.tone)),
  };
}

export const txBlockStageDisplay = (
  modesInput: unknown = {},
  plan: unknown = {},
  exec: unknown = {},
) => {
  const modes = flexibleRecord(modesInput);
  return {
    execStatus: transactionOutputStatusDisplay(exec),
    mode: txExecutionModePresentation(modes.txBlock),
    planStatus: transactionOutputStatusDisplay(plan),
  };
};

function txBlockPreviewOutputPresentation(
  mode: unknown = "",
  txBlock: unknown = null,
) {
  const showText = mode === "text";
  const showStatus = mode === "status";
  return {
    emptyPreviewMessage: t("txBlockVisualEmpty"),
    executeButtonLabel: t("txExecBtn"),
    planButtonLabel: t("txPlanBtn"),
    showEmptyPreview:
      !showText && !showStatus && (!txBlock || typeof txBlock !== "object"),
    showStatus,
    showText,
    visualTitle: t("txBlockVisualTitle"),
  };
}

const emptyTxBlockLoadingDisplay = {
  execute: false,
};

export const txBlockRunDisplayPresentation = (
  display: FlexibleRecord = {},
  keys: string[] = [],
  preview: FlexibleRecord = {},
) => ({
  execStatus: display.execStatus,
  loading: {
    execute: keys.includes("execute"),
  },
  mode: display.mode,
  planStatus: display.planStatus,
  preview,
});

export function txBlockRunPanelDisplay(runDisplay: FlexibleRecord = {}) {
  const execStatusDisplay = transactionOutputStatusDisplay(
    runDisplay.execStatus,
  );
  const planStatusDisplay = transactionOutputStatusDisplay(
    runDisplay.planStatus,
  );
  const previewDisplay = optionalFlexibleRecord(runDisplay.preview) || {
    mode: "empty",
  };
  const previewPresentation = txBlockPreviewPresentation(
    previewDisplay.txBlock ?? null,
    previewDisplay.txResult ?? null,
  );
  const loadingDisplay = optionalFlexibleRecord(runDisplay.loading);
  return {
    execStatusDisplay: {
      ...execStatusDisplay,
      modeDisplay: txOutputModePresentation(execStatusDisplay.mode),
    },
    loadingDisplay: {
      execute: !!loadingDisplay?.execute,
    },
    modeDisplay: runDisplay?.mode || txExecutionModePresentation(),
    planStatusDisplay: {
      ...planStatusDisplay,
      modeDisplay: txOutputModePresentation(planStatusDisplay.mode),
    },
    previewDisplay: {
      ...previewDisplay,
      previewPresentation,
    },
    previewModeDisplay: txBlockPreviewOutputPresentation(
      previewDisplay.mode,
      previewDisplay.txBlock,
    ),
  };
}

export type TxBlockRunPanelDisplay = ReturnType<typeof txBlockRunPanelDisplay>;

const emptyTxBlockRunPanelDisplay = txBlockRunPanelDisplay({});

export function createTxBlockRunPanelWorkspace({
  panelDisplay = null,
}: TxBlockRunPanelWorkspaceInput = {}) {
  const panelDisplayStateStore = writable<TxBlockRunPanelDisplay>(
    panelDisplay || emptyTxBlockRunPanelDisplay,
  );
  const execStatusDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    (display) => display.execStatusDisplay,
  );
  const loadingDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    (display) => display.loadingDisplay,
  );
  const modeDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    (display) => display.modeDisplay,
  );
  const planStatusDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    (display) => display.planStatusDisplay,
  );
  const previewDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    (display) => display.previewDisplay,
  );
  const previewModeDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    (display) => display.previewModeDisplay,
  );
  return {
    execStatusDisplayStateStore,
    loadingDisplayStateStore,
    modeDisplayStateStore,
    panelDisplayStateStore,
    planStatusDisplayStateStore,
    previewDisplayStateStore,
    previewModeDisplayStateStore,
    setPanelDisplay(nextPanelDisplay: TxBlockRunPanelDisplay | null = null) {
      panelDisplayStateStore.set(
        nextPanelDisplay || emptyTxBlockRunPanelDisplay,
      );
    },
  };
}

const emptyTxWorkflowOutputDisplay = {
  execution: { result: {}, status: transactionOutputStatusDisplay() },
  loading: { execute: false, preview: false },
  planStatus: transactionOutputStatusDisplay(),
  preview: {
    message: "",
    mode: "empty",
    text: "",
    tone: "info",
    workflow: null,
  },
};

export const txWorkflowStageDisplay = (
  modesInput: unknown = {},
  plan: unknown = {},
) => {
  const modes = flexibleRecord(modesInput);
  return {
    activeMode: transactionText(modes.txWorkflow || ""),
    planStatus: transactionOutputStatusDisplay(plan),
  };
};

export function txWorkflowOutputPanelDisplay(
  outputDisplay: FlexibleRecord = {},
) {
  const planStatusDisplay =
    optionalFlexibleRecord(outputDisplay.planStatus) ||
    emptyTxWorkflowOutputDisplay.planStatus;
  const executionDisplay =
    optionalFlexibleRecord(outputDisplay.execution) ||
    emptyTxWorkflowOutputDisplay.execution;
  const previewDisplay =
    optionalFlexibleRecord(outputDisplay.preview) ||
    emptyTxWorkflowOutputDisplay.preview;
  const previewModeDisplay = txOutputModePresentation(previewDisplay.mode);
  const previewPresentation = txWorkflowPreviewPresentation(
    previewDisplay.workflow || null,
  );
  const loadingDisplay =
    optionalFlexibleRecord(outputDisplay.loading) ||
    emptyTxWorkflowOutputDisplay.loading;
  return {
    executeButtonLabel: t("txWorkflowExecBtn"),
    executionPanelDisplay: txWorkflowExecutionPanelDisplay(executionDisplay),
    loadingDisplay: {
      execute: !!loadingDisplay.execute,
      preview: !!loadingDisplay.preview,
    },
    planButtonLabel: t("txWorkflowPlanBtn"),
    planStatusDisplay,
    planStatusModeDisplay: txOutputModePresentation(planStatusDisplay.mode),
    previewDisplay: {
      ...previewDisplay,
      previewModeDisplay,
      previewPresentation,
    },
  };
}

export type TxWorkflowOutputPanelDisplay = ReturnType<
  typeof txWorkflowOutputPanelDisplay
>;

const emptyTxWorkflowOutputPanelDisplay = txWorkflowOutputPanelDisplay();

export function createTxWorkflowRunPanelWorkspace({
  panelDisplay = null,
}: {
  panelDisplay?: TxWorkflowOutputPanelDisplay | null;
} = {}) {
  const panelDisplayStateStore = writable<TxWorkflowOutputPanelDisplay>(
    panelDisplay || emptyTxWorkflowOutputPanelDisplay,
  );
  const executionModeDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    (display) => display.executionPanelDisplay.executionModeDisplay,
  );
  const executionStatusDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    (display) => display.executionPanelDisplay.statusDisplay,
  );
  const workflowExecutionResultDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    (display) => display.executionPanelDisplay.workflowExecutionDisplay,
  );
  return {
    executionModeDisplayStateStore,
    executionStatusDisplayStateStore,
    panelDisplayStateStore,
    setPanelDisplay(
      nextPanelDisplay: TxWorkflowOutputPanelDisplay | null = null,
    ) {
      panelDisplayStateStore.set(
        nextPanelDisplay || emptyTxWorkflowOutputPanelDisplay,
      );
    },
    workflowExecutionResultDisplayStateStore,
  };
}

export function createTxWorkflowBlockResultPanelWorkspace(
  inputState: WorkflowBlockWorkspaceInput = {},
) {
  const workflowBlockRowStateStore =
    writable<TxWorkflowExecutionBlockRow | null>(
      inputState.workflowBlockRow || null,
    );
  const panelDisplayStateStore = deriveStore(
    workflowBlockRowStateStore,
    (workflowBlockRow) => txWorkflowBlockResultPanelDisplay(workflowBlockRow),
  );
  return {
    panelDisplayStateStore,
    setWorkflowBlockRow(
      workflowBlockRow: TxWorkflowExecutionBlockRow | null = null,
    ) {
      workflowBlockRowStateStore.set(workflowBlockRow);
    },
  };
}

export function txWorkflowOutputDisplayPresentation(
  display: FlexibleRecord = {},
) {
  return {
    execution: {
      result: display.workflowExecutionDisplay || {},
      status: {
        message: display.executionMessage || "",
        mode: display.executionMode || "empty",
        text: display.executionText || "",
        tone: display.executionTone || "info",
      },
    },
    loading: {
      execute: !!display.executeLoading,
      preview: !!display.previewLoading,
    },
    planStatus: display.planStatus || null,
    preview: {
      message: display.previewMessage || "",
      mode: display.previewMode || "empty",
      text: display.previewText || "",
      tone: display.previewTone || "info",
      workflow: display.workflow || null,
    },
  };
}

function failureOutputFromReason(reason: unknown): string {
  const text = transactionText(reason || "").trim();
  if (!text || text === "-") return "";
  const marker = " output='";
  const start = text.indexOf(marker);
  if (start < 0) return "";
  const valueStart = start + marker.length;
  const valueEnd = text.lastIndexOf("'");
  if (valueEnd <= valueStart) return "";
  return text.slice(valueStart, valueEnd).trim();
}

function operationOutputText(operationStep: FlexibleRecord): string {
  return transactionText(
    operationStep?.success
      ? operationStep?.content != null
        ? operationStep.content
        : operationStep?.all
      : operationStep?.all != null
        ? operationStep.all
        : operationStep?.content,
  );
}

function operationToneClasses(toneName = "cyan", success = true) {
  const color = !success ? "rose" : toneName === "amber" ? "amber" : "cyan";
  return {
    bg: `bg-${color}-50`,
    border: `border-${color}-200`,
    chip: `bg-${color}-100 text-${color}-700`,
    title: `text-${color}-700`,
  };
}

function txStepReasonRow(
  titleText: string,
  reasonText: string,
): TxStepReasonRow {
  return { reasonText, titleText, variant: "muted" };
}

const txWorkflowChip = (chipText: string) => ({
  chipClass: workflowChipClass(),
  chipText,
});

function operationStepNumberText(
  operationStep: FlexibleRecord,
  index = 0,
): string {
  const stepIndex = Number(operationStep?.step_index);
  return transactionText((Number.isFinite(stepIndex) ? stepIndex : index) + 1);
}

function txOperationStepDisplay(
  operationStep: FlexibleRecord,
  toneName: string,
): TxOperationStepDisplay {
  const success = !!operationStep?.success;
  const toneClasses = operationToneClasses(toneName, success);
  const exitCodeText =
    operationStep?.exit_code != null
      ? transactionText(operationStep.exit_code)
      : "-";
  const modeText = transactionText(operationStep?.mode);
  const promptText = transactionText(operationStep?.prompt);
  const successText = String(success);
  return {
    cardClass: classNames(
      "rounded-lg border px-3 py-2",
      toneClasses.border,
      toneClasses.bg,
    ),
    chipClass: workflowChipClass(toneClasses.chip),
    chipRows: [
      { chipText: `${t("txBlockResultSuccess")}: ${successText}` },
      { chipText: `${t("txWorkflowSummaryMode")}: ${modeText}` },
      { chipText: `${t("txBlockResultExitCode")}: ${exitCodeText}` },
    ],
    commandLabelText: t("fieldCommand"),
    exitCodeText,
    modeText,
    operationSummaryText: transactionText(operationStep?.operation_summary),
    outputLabelText: t("txBlockResultOutput"),
    outputText: operationOutputText(operationStep) || "-",
    parsedOutputBlock: parsedOutputBlockDisplayFromItem(operationStep, {
      command: operationStep?.operation_summary,
      parsed_output: operationStep?.parsed_output,
    }),
    promptLabelText: t("txBlockResultPrompt"),
    promptText,
    showPrompt: !!promptText,
    successText,
    titleClass: classNames("text-[11px] font-semibold", toneClasses.title),
  };
}

function txOperationStepRows(
  steps: readonly FlexibleRecord[] = [],
  stepConfig: ToneConfig = {},
): TxOperationStepRow[] {
  const toneName = stepConfig.toneName || "cyan";
  return steps.map((operationStep, index) => {
    const stepNumberText = operationStepNumberText(operationStep, index);
    return {
      ...txOperationStepDisplay(operationStep, toneName),
      stepNumberText,
      titleText: `${t("txBlockResultOperationStep")}${stepNumberText}`,
    };
  });
}

function txStepResultRows(
  stepList: readonly FlexibleRecord[] = [],
): TxStepResultRow[] {
  return stepList.map((stepResult, index) => {
    const forwardOperationRows = txOperationStepRows(
      Array.isArray(stepResult?.forward_operation_steps)
        ? stepResult.forward_operation_steps
        : [],
    );
    const rollbackOperationRows = txOperationStepRows(
      Array.isArray(stepResult?.rollback_operation_steps)
        ? stepResult.rollback_operation_steps
        : [],
      { toneName: "amber" },
    );
    const executionStateText = displayTextOrDash(stepResult?.execution_state);
    const failureReasonText = displayTextOrDash(stepResult?.failure_reason);
    const rollbackReasonText = displayTextOrDash(stepResult?.rollback_reason);
    const rollbackStateText = displayTextOrDash(stepResult?.rollback_state);
    const stepNumberText = operationStepNumberText(stepResult, index);
    return {
      executionStateText,
      failureReasonText,
      forwardOutputsTitle: t("txBlockResultForwardOutputs"),
      forwardOperationRows,
      hasForwardOperationRows: forwardOperationRows.length > 0,
      hasRollbackOperationRows: rollbackOperationRows.length > 0,
      noOperationOutputsMessage: t("txBlockResultNoOperationOutputs"),
      reasonRows: [
        txStepReasonRow(t("txBlockResultFailureReason"), failureReasonText),
        txStepReasonRow(t("txBlockResultRollbackReason"), rollbackReasonText),
      ],
      rollbackOutputsTitle: t("txBlockResultRollbackOutputs"),
      rollbackOperationRows,
      rollbackReasonText,
      rollbackStateText,
      stateChipRows: [
        txWorkflowChip(
          `${t("txBlockResultExecutionState")}: ${executionStateText}`,
        ),
        txWorkflowChip(
          `${t("txBlockResultRollbackState")}: ${rollbackStateText}`,
        ),
      ],
      stepNumberText,
      titleText: `${t("txWorkflowVisualStep")}${stepNumberText}`,
    };
  });
}

function transactionResultPanelDisplay() {
  return {
    blockRollbackOutputsTitle: t("txBlockResultBlockRollbackOutputs"),
    commandLabelText: t("fieldCommand"),
    noStepDetailsMessage: t("txBlockResultNoStepDetails"),
    outputTitle: t("txBlockResultOutput"),
    resultTitle: t("txBlockResultTitle"),
    rollbackErrorsTitle: t("txBlockResultRollbackErrors"),
    rollbackOutputsTitle: t("txBlockResultRollbackOutputs"),
  };
}

function txStepRunOperation(step: FlexibleRecord): FlexibleRecord | null {
  if (!step || typeof step !== "object") return null;
  return optionalFlexibleRecord(step.run);
}

function txStepRollbackOperation(step: FlexibleRecord): FlexibleRecord | null {
  if (!step || typeof step !== "object") return null;
  return optionalFlexibleRecord(step.rollback);
}

function txOperationMode(operation: FlexibleRecord | null): string {
  if (!operation || typeof operation !== "object") return "";
  if (typeof operation.mode === "string") return operation.mode.trim();
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    return transactionText(steps[0]?.mode).trim();
  }
  return "";
}

function txOperationTimeoutSeconds(
  operation: FlexibleRecord | null,
): number | null {
  if (!operation || typeof operation !== "object") return null;
  if (operation.timeout != null && String(operation.timeout).trim()) {
    return Number(operation.timeout);
  }
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    return steps[0]?.timeout != null ? Number(steps[0].timeout) : null;
  }
  return null;
}

function txOperationDescription(operation: FlexibleRecord | null): string {
  if (!operation || typeof operation !== "object") return "";
  if (operation.kind === "command" || operation.command != null) {
    return transactionText(operation.command).trim();
  }
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    const first = transactionText(steps[0]?.command).trim();
    if (!steps.length) return "flow";
    if (steps.length === 1) return first || "flow";
    return first
      ? `${first} ... (${steps.length} steps)`
      : `${steps.length} steps`;
  }
  return "";
}

function joinedErrorText(errors: unknown): string {
  return Array.isArray(errors) ? errors.join(" | ") : "";
}

function txWorkflowRollbackPolicyLabel(rollbackPolicy: unknown): string {
  if (typeof rollbackPolicy === "string") {
    if (rollbackPolicy === "none") return t("txWorkflowBlockRollbackNone");
    if (rollbackPolicy === "whole_resource") {
      return t("txWorkflowBlockRollbackWhole");
    }
    return t("txWorkflowBlockRollbackPerStep");
  }
  if (
    rollbackPolicy &&
    typeof rollbackPolicy === "object" &&
    flexibleRecord(rollbackPolicy).whole_resource
  ) {
    return t("txWorkflowBlockRollbackWhole");
  }
  return t("txWorkflowBlockRollbackPerStep");
}

function txWorkflowExecutionBlockRow(
  block: FlexibleRecord,
  index: number,
  failedBlockIndex: number | null,
) {
  const resultPanel = txBlockResultPresentation(block);
  const failureReasonText = displayTextOrDash(block?.failure_reason);
  const executedStepsText = transactionText(block?.executed_steps ?? "-");
  const rollbackAttemptedText = String(!!block?.rollback_attempted);
  const rollbackSucceededText = String(!!block?.rollback_succeeded);
  return {
    blockRollbackOperationSummaryText:
      resultPanel.blockRollbackOperationSummaryText,
    blockSummaryRows: [
      summaryRow("txBlockResultExecutedSteps", executedStepsText),
      summaryRow("txBlockResultRollbackAttempted", rollbackAttemptedText),
      summaryRow("txBlockResultRollbackSucceeded", rollbackSucceededText),
    ],
    committedLineText: `${t("txBlockResultCommitted")}: ${String(!!block?.committed)}`,
    currentBlockFailed: failedBlockIndex === index,
    failureOutput: resultPanel.failureOutput,
    failureReasonText,
    failureReasonTitle: t("txBlockResultFailureReason"),
    hasRollbackErrors: resultPanel.hasRollbackErrors,
    hasRollbackStepRows: resultPanel.hasBlockRollbackStepRows,
    hasBlockRollbackOperationSummary:
      resultPanel.hasBlockRollbackOperationSummary,
    hasStepResultRows: resultPanel.hasStepResultRows,
    noStepDetailsMessage: t("txBlockResultNoStepDetails"),
    outputTitle: t("txBlockResultOutput"),
    rollbackAttemptedLineText: `${t("txBlockResultRollbackAttempted")}: ${rollbackAttemptedText}`,
    rollbackErrorsText: resultPanel.rollbackErrorsText,
    rollbackErrorsTitle: t("txBlockResultRollbackErrors"),
    rollbackOutputsTitle: t("txBlockResultRollbackOutputs"),
    rollbackStepRows: resultPanel.blockRollbackStepRows,
    rollbackSucceededLineText: `${t("txBlockResultRollbackSucceeded")}: ${rollbackSucceededText}`,
    blockRollbackOutputsTitle: t("txBlockResultBlockRollbackOutputs"),
    commandLabelText: t("fieldCommand"),
    failedBlockRollbackTitle: t("txWorkflowFailedBlockRollback"),
    showFailureOutput: resultPanel.showFailureOutput,
    showFailureReason: failureReasonText !== "-",
    stepResultRows: resultPanel.stepResultRows,
    title: `block[${index}] ${transactionText(block?.block_name || "-")}`,
  };
}

export function txWorkflowExecutionPresentation(
  workflowRunInput: unknown = null,
) {
  const workflowRun = optionalFlexibleRecord(workflowRunInput);
  const hasResult = Boolean(workflowRun);
  const blockResults = workflowRun?.block_results;
  const blocks = Array.isArray(blockResults) ? blockResults : [];
  const failedBlock = workflowRun?.failed_block;
  const failedBlockIndex = typeof failedBlock === "number" ? failedBlock : null;
  const rollbackList = workflowRun?.rollback_errors;
  const rollbackErrors = Array.isArray(rollbackList) ? rollbackList : [];
  const blockRows = blocks.map((block, index) =>
    txWorkflowExecutionBlockRow(block, index, failedBlockIndex),
  );
  const committed = !!workflowRun?.committed;
  const hasFailedBlock = failedBlockIndex !== null;
  const rollbackAttemptedText = String(!!workflowRun?.rollback_attempted);
  const rollbackSucceededText = String(!!workflowRun?.rollback_succeeded);
  const workflowName = workflowRun?.workflow_name || "-";
  return {
    blockCountLineText: `${t("txWorkflowVisualBlocks")}: ${String(blockRows.length)}`,
    blockRows,
    blockCountText: String(blockRows.length),
    blockResultsTitle: t("txWorkflowBlockResultsTitle"),
    failedBlockIndex,
    hasBlockRows: blockRows.length > 0,
    hasFailedBlock,
    hasRollbackErrors: rollbackErrors.length > 0,
    hasResult,
    noStepDetailsMessage: t("txBlockResultNoStepDetails"),
    requestFailedMessage: t("requestFailed"),
    rollbackErrorsText: joinedErrorText(rollbackErrors),
    rollbackErrorsTitle: t("txWorkflowRollbackErrors"),
    summaryCards: [
      summaryCard("txWorkflowVisualName", workflowName || "-"),
      summaryCard("txWorkflowVisualBlocks", blockRows.length),
      summaryCard("txBlockResultCommitted", String(committed)),
      summaryCard("txBlockResultRollbackAttempted", rollbackAttemptedText),
      summaryCard("txBlockResultRollbackSucceeded", rollbackSucceededText),
      summaryCard(
        "txBlockResultFailedStep",
        hasFailedBlock ? failedBlockIndex : "-",
      ),
    ],
    workflowSummaryChipRows: [
      txWorkflowChip(
        `${t("txWorkflowFailedBlock")}: ${hasFailedBlock ? failedBlockIndex : "-"}`,
      ),
      txWorkflowChip(
        `${t("txBlockResultRollbackAttempted")}: ${rollbackAttemptedText}`,
      ),
      txWorkflowChip(
        `${t("txBlockResultRollbackSucceeded")}: ${rollbackSucceededText}`,
      ),
    ],
  };
}

export type TxWorkflowExecutionPresentation = ReturnType<
  typeof txWorkflowExecutionPresentation
>;
export type TxWorkflowExecutionBlockRow =
  TxWorkflowExecutionPresentation["blockRows"][number];

function txWorkflowExecutionPanelDisplay(
  executionDisplay: FlexibleRecord = {},
) {
  const statusDisplay = transactionOutputStatusDisplay(executionDisplay.status);
  const resultDisplay = optionalFlexibleRecord(executionDisplay.result);
  return {
    executionModeDisplay: txOutputModePresentation(statusDisplay.mode),
    statusDisplay,
    workflowExecutionDisplay: resultDisplay
      ? (resultDisplay as TxWorkflowExecutionPresentation)
      : txWorkflowExecutionPresentation(),
  };
}

function txWorkflowBlockResultPanelDisplay(
  workflowBlockRowInput: TxWorkflowExecutionBlockRow | null = null,
) {
  const workflowBlockRow =
    workflowBlockRowInput || txWorkflowExecutionBlockRow({}, 0, null);
  return {
    blockSummaryRows: workflowBlockRow.blockSummaryRows || [],
    failedBlockRollbackDisplay: {
      rollbackAttemptedLineText:
        workflowBlockRow.rollbackAttemptedLineText || "",
      rollbackErrorsLineText: workflowBlockRow.hasRollbackErrors
        ? `${workflowBlockRow.rollbackErrorsTitle}: ${workflowBlockRow.rollbackErrorsText}`
        : "",
      rollbackSucceededLineText:
        workflowBlockRow.rollbackSucceededLineText || "",
      showRollbackErrors: !!workflowBlockRow.hasRollbackErrors,
      showSection: !!workflowBlockRow.currentBlockFailed,
      title: workflowBlockRow.failedBlockRollbackTitle || "",
    },
    failureOutputDisplay: {
      showSection: !!workflowBlockRow.showFailureOutput,
      text: workflowBlockRow.failureOutput || "",
      title: workflowBlockRow.outputTitle || "",
    },
    failureReasonDisplay: {
      showSection: !!workflowBlockRow.showFailureReason,
      text: workflowBlockRow.failureReasonText || "",
      title: workflowBlockRow.failureReasonTitle || "",
    },
    headerDisplay: {
      committedLineText: workflowBlockRow.committedLineText || "",
      title: workflowBlockRow.title || "",
    },
    rollbackErrorsDisplay: {
      lineText: workflowBlockRow.hasRollbackErrors
        ? `${workflowBlockRow.rollbackErrorsTitle}: ${workflowBlockRow.rollbackErrorsText}`
        : "",
      showSection: !!workflowBlockRow.hasRollbackErrors,
    },
    rollbackOutputsDisplay: {
      commandLabelText: workflowBlockRow.commandLabelText || "",
      operationSummaryText:
        workflowBlockRow.blockRollbackOperationSummaryText || "",
      rollbackStepRows: workflowBlockRow.rollbackStepRows || [],
      sectionTitle: workflowBlockRow.blockRollbackOutputsTitle || "",
      showOperationSummary: !!workflowBlockRow.hasBlockRollbackOperationSummary,
      showSection: !!workflowBlockRow.hasRollbackStepRows,
      stepRowsTitle: workflowBlockRow.rollbackOutputsTitle || "",
    },
    stepDetailsDisplay: {
      noStepDetailsMessage: workflowBlockRow.noStepDetailsMessage || "",
      showStepRows: !!workflowBlockRow.hasStepResultRows,
      stepResultRows: workflowBlockRow.stepResultRows || [],
    },
  };
}

function txBlockModeText(steps: FlexibleRecord[]): string {
  const modes = Array.from(
    new Set(
      steps
        .map((step) => txOperationMode(txStepRunOperation(step)))
        .filter((mode) => !!mode),
    ),
  );
  return modes.length ? modes.join(", ") : "Config";
}

function txBlockPreviewStepRow(step: FlexibleRecord, index: number) {
  const run = txStepRunOperation(step);
  const rollback = txStepRollbackOperation(step);
  const rollbackCommand = txOperationDescription(rollback);
  const timeoutText = txOperationTimeoutSeconds(run);
  return {
    command: txOperationDescription(run),
    commandLabelText: t("fieldCommand"),
    index,
    stepLabelText: `${t("txWorkflowVisualStep")} ${index + 1}`,
    stepChipRows: [
      txWorkflowChip(
        `${t("txWorkflowSummaryMode")}: ${txOperationMode(run) || "Config"}`,
      ),
      txWorkflowChip(
        `${t("txWorkflowVisualTimeout")}: ${Number.isFinite(timeoutText) ? `${timeoutText}s` : "-"}`,
      ),
      ...(step?.rollback_on_failure
        ? [txWorkflowChip(t("txWorkflowRollbackOnFailureLabel"))]
        : []),
    ],
    rollbackCardClass: classNames(
      "rounded-lg border px-3 py-2",
      rollbackCommand
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-slate-100",
    ),
    rollbackCommand: rollbackCommand || t("txWorkflowVisualNoRollback"),
    rollbackCommandClass: classNames(
      "mt-1 break-all font-mono text-xs",
      rollbackCommand ? "text-slate-900" : "text-slate-500",
    ),
    rollbackTitleText: t("txWorkflowSummaryRollback"),
    rollbackTitleClass: classNames(
      "text-[11px] font-semibold",
      rollbackCommand ? "text-amber-700" : "text-slate-500",
    ),
  };
}

function txBlockWholeResourceRollbackRow(
  txBlock: FlexibleRecord | null,
  modeText: string,
) {
  const rollbackPolicy = optionalFlexibleRecord(txBlock?.rollback_policy);
  const wholeResource = optionalFlexibleRecord(rollbackPolicy?.whole_resource);
  const operation = optionalFlexibleRecord(wholeResource?.undo);
  if (!operation) return null;
  const triggerStepIndex =
    wholeResource?.trigger_step_index != null
      ? wholeResource.trigger_step_index
      : 0;
  const undoDescription = txOperationDescription(operation) || "-";
  return {
    modeText: txOperationMode(operation) || modeText,
    summaryCards: [
      summaryCard("txWorkflowVisualUndo", undoDescription),
      summaryCard("txWorkflowVisualTriggerStep", triggerStepIndex),
      summaryCard(
        "txWorkflowSummaryMode",
        txOperationMode(operation) || modeText,
      ),
    ],
    triggerStepIndex,
    undoDescription,
  };
}

function txBlockResultPresentation(txResultInput: unknown = null) {
  const txResult = optionalFlexibleRecord(txResultInput);
  const rollbackErrors = Array.isArray(txResult?.rollback_errors)
    ? txResult.rollback_errors
    : [];
  const blockRollbackStepRows = txOperationStepRows(
    Array.isArray(txResult?.block_rollback_steps)
      ? txResult.block_rollback_steps
      : [],
    { toneName: "amber" },
  );
  const failureOutput = failureOutputFromReason(txResult?.failure_reason);
  const stepResultRows = txStepResultRows(
    Array.isArray(txResult?.step_results) ? txResult.step_results : [],
  );
  const summaryItems = [
    ["txBlockResultCommitted", String(!!txResult?.committed)],
    [
      "txBlockResultExecutedSteps",
      transactionText(txResult?.executed_steps ?? "-"),
    ],
    ["txBlockResultRollbackAttempted", String(!!txResult?.rollback_attempted)],
    ["txBlockResultRollbackSucceeded", String(!!txResult?.rollback_succeeded)],
    [
      "txBlockResultRollbackSteps",
      transactionText(txResult?.rollback_steps ?? "-"),
    ],
    ["txBlockResultFailedStep", transactionText(txResult?.failed_step ?? "-")],
    [
      "txBlockResultFailureReason",
      transactionText(txResult?.failure_reason || "-"),
    ],
  ];
  return {
    blockRollbackOperationSummaryText: transactionText(
      txResult?.block_rollback_operation_summary || "",
    ),
    blockRollbackStepRows,
    failureOutput,
    ...transactionResultPanelDisplay(),
    hasBlockRollbackStepRows: blockRollbackStepRows.length > 0,
    hasBlockRollbackOperationSummary: !!transactionText(
      txResult?.block_rollback_operation_summary || "",
    ),
    hasRollbackErrors: rollbackErrors.length > 0,
    hasStepResultRows: stepResultRows.length > 0,
    hasTxResult: Boolean(txResult && typeof txResult === "object"),
    rollbackErrorsText: joinedErrorText(rollbackErrors),
    showFailureOutput: stepResultRows.length === 0 && !!failureOutput,
    stepResultRows,
    summaryCards: summaryItems.map(([labelKey, summaryValue]) => ({
      label: t(labelKey),
      summaryValue,
    })),
  };
}

export type TxBlockResultPanelDisplay = ReturnType<
  typeof txBlockResultPresentation
>;

export function txBlockPreviewPresentation(
  txBlockInput: unknown = null,
  txResult: unknown = null,
) {
  const txBlock = optionalFlexibleRecord(txBlockInput);
  const steps = Array.isArray(txBlock?.steps) ? txBlock.steps : [];
  const modeText = txBlockModeText(steps);
  const failFastText = String(txBlock?.fail_fast !== false);
  const name = txBlock?.name || "tx-block";
  const rollbackText = txWorkflowRollbackPolicyLabel(txBlock?.rollback_policy);
  const stepCount = steps.length;
  return {
    emptyMessage: t("txWorkflowBuilderEmpty"),
    hasSteps: steps.length > 0,
    resultPanel: txBlockResultPresentation(txResult),
    stepRows: steps.map(txBlockPreviewStepRow),
    stepsTitle: t("txBlockSummarySteps"),
    summaryCards: [
      summaryCard("txBlockSummaryName", name),
      summaryCard("txBlockSummaryMode", modeText),
      summaryCard("txBlockSummaryRollback", rollbackText),
      summaryCard("txBlockSummaryFailFast", failFastText),
      summaryCard("txBlockSummarySteps", stepCount),
    ],
    wholeResourceRollback: txBlockWholeResourceRollbackRow(txBlock, modeText),
  };
}

export type TxBlockPreviewPresentation = ReturnType<
  typeof txBlockPreviewPresentation
>;

function normalizeSummaryCards(
  summaryCards: unknown = [],
  fallbackSummaryCards: FlexibleRecord[] = [],
) {
  const cards = Array.isArray(summaryCards)
    ? summaryCards
    : fallbackSummaryCards;
  return cards.map((summaryCard, index) => {
    const fallbackCard = fallbackSummaryCards[index] || {};
    return {
      label: transactionText(summaryCard?.label ?? fallbackCard.label ?? ""),
      summaryValue: transactionText(
        summaryCard?.summaryValue ?? fallbackCard.summaryValue ?? "-",
      ),
    };
  });
}

function normalizeTxBlockRollbackPreview(
  wholeResourceRollbackInput: unknown = null,
) {
  const wholeResourceRollback = optionalFlexibleRecord(
    wholeResourceRollbackInput,
  );
  if (!wholeResourceRollback) {
    return null;
  }
  return {
    ...wholeResourceRollback,
    modeText: transactionText(wholeResourceRollback.modeText || ""),
    summaryCards: normalizeSummaryCards(wholeResourceRollback.summaryCards, []),
    triggerStepIndex:
      wholeResourceRollback.triggerStepIndex ??
      wholeResourceRollback.trigger_step_index ??
      0,
    undoDescription: transactionText(wholeResourceRollback.undoDescription),
  };
}

function normalizeTxBlockResultPanel(resultPanelInput: unknown = null) {
  const fallback = txBlockResultPresentation(null);
  const resultPanel = optionalFlexibleRecord(resultPanelInput);
  if (!resultPanel) {
    return fallback;
  }
  const blockRollbackStepRows = Array.isArray(resultPanel.blockRollbackStepRows)
    ? resultPanel.blockRollbackStepRows
    : fallback.blockRollbackStepRows;
  const stepResultRows = Array.isArray(resultPanel.stepResultRows)
    ? resultPanel.stepResultRows
    : fallback.stepResultRows;
  return {
    ...fallback,
    ...resultPanel,
    blockRollbackStepRows,
    hasBlockRollbackStepRows:
      typeof resultPanel.hasBlockRollbackStepRows === "boolean"
        ? resultPanel.hasBlockRollbackStepRows
        : blockRollbackStepRows.length > 0,
    hasRollbackErrors:
      typeof resultPanel.hasRollbackErrors === "boolean"
        ? resultPanel.hasRollbackErrors
        : false,
    hasStepResultRows:
      typeof resultPanel.hasStepResultRows === "boolean"
        ? resultPanel.hasStepResultRows
        : stepResultRows.length > 0,
    hasTxResult:
      typeof resultPanel.hasTxResult === "boolean"
        ? resultPanel.hasTxResult
        : fallback.hasTxResult,
    stepResultRows,
    summaryCards: normalizeSummaryCards(
      resultPanel.summaryCards,
      fallback.summaryCards,
    ),
  };
}

export function normalizeTxBlockPreviewPresentation(
  previewPresentationInput: unknown = null,
) {
  const fallback = txBlockPreviewPresentation(null, null);
  const previewPresentation = optionalFlexibleRecord(previewPresentationInput);
  if (!previewPresentation) {
    return {
      ...fallback,
      hasWholeResourceRollback: Boolean(fallback.wholeResourceRollback),
      previewSummaryCards: fallback.summaryCards,
      rollbackSummaryCards: fallback.wholeResourceRollback
        ? fallback.wholeResourceRollback.summaryCards
        : [],
    };
  }
  const stepRows = Array.isArray(previewPresentation.stepRows)
    ? previewPresentation.stepRows.map((stepRow) => ({
        ...stepRow,
        stepChipRows: Array.isArray(stepRow?.stepChipRows)
          ? stepRow.stepChipRows
          : [],
      }))
    : fallback.stepRows;
  const summaryCards = normalizeSummaryCards(
    previewPresentation.summaryCards,
    fallback.summaryCards,
  );
  const wholeResourceRollback = normalizeTxBlockRollbackPreview(
    previewPresentation.wholeResourceRollback,
  );
  return {
    ...fallback,
    ...previewPresentation,
    hasSteps:
      typeof previewPresentation.hasSteps === "boolean"
        ? previewPresentation.hasSteps
        : stepRows.length > 0,
    hasWholeResourceRollback: Boolean(wholeResourceRollback),
    previewSummaryCards: summaryCards,
    resultPanel: normalizeTxBlockResultPanel(previewPresentation.resultPanel),
    rollbackSummaryCards: wholeResourceRollback
      ? normalizeSummaryCards(wholeResourceRollback.summaryCards, [])
      : [],
    stepRows,
    summaryCards,
    wholeResourceRollback,
  };
}

function txWorkflowBlockTemplateName(block: FlexibleRecord): string {
  return typeof block?.tx_block_template_name === "string"
    ? block.tx_block_template_name.trim()
    : "";
}

function txWorkflowPreviewBlockRow(block: FlexibleRecord, index: number) {
  const templateName = txWorkflowBlockTemplateName(block);
  const isTemplate = Boolean(templateName);
  const failFastText = String(block?.fail_fast !== false);
  const modeText = txBlockModeText(
    Array.isArray(block?.steps) ? block.steps : [],
  );
  const rollbackPolicyLabel = txWorkflowRollbackPolicyLabel(
    block?.rollback_policy,
  );
  return {
    chipRows: isTemplate
      ? [
          txWorkflowChip(
            `${t("txWorkflowSummarySource")}: ${t("txWorkflowBlockSourceTemplate")}`,
          ),
          txWorkflowChip(`${t("txWorkflowSummaryTemplate")}: ${templateName}`),
          txWorkflowChip(`${t("txWorkflowVisualFailFast")}: ${failFastText}`),
        ]
      : [
          txWorkflowChip(
            `${t("txWorkflowVisualRollbackPolicy")}: ${rollbackPolicyLabel}`,
          ),
          txWorkflowChip(`${t("txWorkflowSummaryMode")}: ${modeText}`),
          txWorkflowChip(`${t("txWorkflowVisualFailFast")}: ${failFastText}`),
        ],
    failFastText,
    index,
    isTemplate,
    modeText,
    rollbackPolicyLabel,
    templateName,
    templateHintText: t("txWorkflowTemplateRefHint"),
    title: `block[${index}] ${transactionText(block?.name || "tx-block")}`,
    previewPresentation: txBlockPreviewPresentation(block, null),
    txBlock: block,
  };
}

export function txWorkflowPreviewPresentation(workflowInput: unknown = null) {
  const workflow = optionalFlexibleRecord(workflowInput);
  const hasWorkflow = Boolean(workflow && typeof workflow === "object");
  const blocks =
    hasWorkflow && Array.isArray(workflow?.blocks) ? workflow.blocks : [];
  const failFastText = String(workflow?.fail_fast !== false);
  const name = workflow?.name || "-";
  return {
    blockRows: blocks.map(txWorkflowPreviewBlockRow),
    emptyMessage: t("txWorkflowVisualEmpty"),
    hasBlocks: blocks.length > 0,
    hasWorkflow,
    summaryCards: [
      summaryCard("txWorkflowVisualName", name),
      summaryCard("txWorkflowVisualBlocks", blocks.length),
      summaryCard("txWorkflowVisualFailFast", failFastText),
    ],
    titleText: t("txWorkflowVisualTitle"),
  };
}

export type TxWorkflowPreviewPresentation = ReturnType<
  typeof txWorkflowPreviewPresentation
>;
