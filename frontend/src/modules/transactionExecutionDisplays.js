import { derived as deriveStore, writable } from "svelte/store";
import {
  TX_EXECUTION_MODE,
  normalizeTxExecutionMode,
} from "../config/dashboardModes.js";
import { t } from "../lib/i18n.js";
import { classNames, displayText, workflowChipClass } from "../lib/ui.js";
import { parsedOutputBlockDisplayFromItem } from "./results.js";

const summaryCard = (key, summaryValue) => ({ label: t(key), summaryValue });
const transactionText = (displaySource) => displayText(displaySource);
const displayTextOrDash = (displaySource) =>
  transactionText(displaySource) || "-";

function txExecutionModePresentation(mode = "") {
  const normalized = normalizeTxExecutionMode(mode);
  return {
    isDirect: normalized === TX_EXECUTION_MODE.direct,
    isTemplate: normalized === TX_EXECUTION_MODE.template,
    mode: normalized,
  };
}

const txOutputModePresentation = (mode = "") => ({
  showText: mode === "text",
  showStatus: mode === "status",
  showResult: mode === "result",
});

export function transactionFallbackDisplay(fallback = {}) {
  if (!fallback?.mode || fallback.mode === "empty") return null;
  return {
    mode: fallback.mode,
    message: fallback.message || "",
    text: fallback.text || "",
    tone: fallback.tone || "info",
  };
}

function transactionOutputStatusDisplay(output = {}) {
  const mode = transactionText(output.mode || "");
  return {
    ...txOutputModePresentation(mode),
    message: transactionText(output.message || ""),
    mode,
    tone: output.tone || "info",
  };
}

export const txBlockStageDisplay = (modes = {}, plan = {}, exec = {}) => ({
  execStatus: transactionOutputStatusDisplay(exec),
  mode: txExecutionModePresentation(modes.txBlock),
  planStatus: transactionOutputStatusDisplay(plan),
});

function txBlockPreviewOutputPresentation(mode = "", txBlock = null) {
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
  directExecute: false,
  directPlan: false,
  templateExecute: false,
  templatePlan: false,
};

export const txBlockRunDisplayPresentation = (
  display = {},
  keys = [],
  preview = {},
) => ({
  execStatus: display.execStatus,
  loading: {
    directExecute: keys.includes("direct-exec"),
    directPlan: keys.includes("direct-plan"),
    templateExecute: keys.includes("template-exec"),
    templatePlan: keys.includes("template-plan"),
  },
  mode: display.mode,
  planStatus: display.planStatus,
  preview,
});

export function txBlockRunPanelDisplay(runDisplay = {}) {
  const execStatusDisplay =
    runDisplay?.execStatus || transactionOutputStatusDisplay();
  const planStatusDisplay =
    runDisplay?.planStatus || transactionOutputStatusDisplay();
  const previewDisplay = runDisplay?.preview || { mode: "empty" };
  const previewPresentation = txBlockPreviewPresentation(
    previewDisplay.txBlock ?? null,
    previewDisplay.txResult ?? null,
  );
  return {
    execStatusDisplay: {
      ...execStatusDisplay,
      modeDisplay: txOutputModePresentation(execStatusDisplay.mode),
    },
    loadingDisplay: runDisplay?.loading || emptyTxBlockLoadingDisplay,
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

const emptyTxBlockRunPanelDisplay = txBlockRunPanelDisplay({});

export function createTxBlockRunPanelWorkspace({ panelDisplay = null } = {}) {
  const panelDisplayStateStore = writable(panelDisplay);
  const loadingDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      $panelDisplayStateStore?.loadingDisplay ||
      emptyTxBlockRunPanelDisplay.loadingDisplay,
  );
  const modeDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      $panelDisplayStateStore?.modeDisplay ||
      emptyTxBlockRunPanelDisplay.modeDisplay,
  );
  const previewModeDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      $panelDisplayStateStore?.previewModeDisplay ||
      emptyTxBlockRunPanelDisplay.previewModeDisplay,
  );
  const previewDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      $panelDisplayStateStore?.previewDisplay ||
      emptyTxBlockRunPanelDisplay.previewDisplay,
  );
  const planStatusDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      $panelDisplayStateStore?.planStatusDisplay ||
      emptyTxBlockRunPanelDisplay.planStatusDisplay,
  );
  const execStatusDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      $panelDisplayStateStore?.execStatusDisplay ||
      emptyTxBlockRunPanelDisplay.execStatusDisplay,
  );
  return {
    execStatusDisplayStateStore,
    loadingDisplayStateStore,
    modeDisplayStateStore,
    panelDisplayStateStore,
    planStatusDisplayStateStore,
    previewDisplayStateStore,
    previewModeDisplayStateStore,
    setPanelDisplay(nextPanelDisplay = null) {
      panelDisplayStateStore.set(nextPanelDisplay);
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

export const txWorkflowStageDisplay = (modes = {}, plan = {}) => ({
  activeMode: transactionText(modes.txWorkflow || ""),
  planStatus: transactionOutputStatusDisplay(plan),
});

export function txWorkflowOutputPanelDisplay(outputDisplay = {}) {
  const planStatusDisplay =
    outputDisplay?.planStatus || emptyTxWorkflowOutputDisplay.planStatus;
  const executionDisplay =
    outputDisplay?.execution || emptyTxWorkflowOutputDisplay.execution;
  const previewDisplay =
    outputDisplay?.preview || emptyTxWorkflowOutputDisplay.preview;
  const previewModeDisplay = txOutputModePresentation(previewDisplay.mode);
  const previewPresentation = txWorkflowPreviewPresentation(
    previewDisplay.workflow || null,
  );
  return {
    executeButtonLabel: t("txWorkflowExecBtn"),
    executionPanelDisplay: txWorkflowExecutionPanelDisplay(executionDisplay),
    loadingDisplay:
      outputDisplay?.loading || emptyTxWorkflowOutputDisplay.loading,
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

export function createTxWorkflowRunPanelWorkspace({
  panelDisplay = null,
} = {}) {
  const panelDisplayStateStore = writable(panelDisplay);
  const executionPanelDisplayStateStore = deriveStore(
    panelDisplayStateStore,
    ($panelDisplayStateStore) =>
      $panelDisplayStateStore?.executionPanelDisplay || {},
  );
  const executionModeDisplayStateStore = deriveStore(
    executionPanelDisplayStateStore,
    ($executionPanelDisplayStateStore) =>
      $executionPanelDisplayStateStore?.executionModeDisplay || {},
  );
  const executionStatusDisplayStateStore = deriveStore(
    executionPanelDisplayStateStore,
    ($executionPanelDisplayStateStore) =>
      $executionPanelDisplayStateStore?.statusDisplay || {},
  );
  const workflowExecutionResultDisplayStateStore = deriveStore(
    executionPanelDisplayStateStore,
    ($executionPanelDisplayStateStore) =>
      $executionPanelDisplayStateStore?.workflowExecutionDisplay || {},
  );
  return {
    executionModeDisplayStateStore,
    executionStatusDisplayStateStore,
    panelDisplayStateStore,
    setPanelDisplay(nextPanelDisplay = null) {
      panelDisplayStateStore.set(nextPanelDisplay);
    },
    workflowExecutionResultDisplayStateStore,
  };
}

export function createTxWorkflowBlockResultPanelWorkspace(inputState = {}) {
  const panelInputsStateStore = writable({
    workflowBlockRow:
      inputState?.workflowBlockRow &&
      typeof inputState.workflowBlockRow === "object"
        ? inputState.workflowBlockRow
        : {},
  });
  const panelDisplayStateStore = deriveStore(
    panelInputsStateStore,
    ($panelInputsStateStore) =>
      txWorkflowBlockResultPanelDisplay(
        $panelInputsStateStore?.workflowBlockRow || {},
      ),
  );
  return {
    panelDisplayStateStore,
    setWorkflowBlockRow(workflowBlockRow = {}) {
      panelInputsStateStore.set({
        workflowBlockRow:
          workflowBlockRow && typeof workflowBlockRow === "object"
            ? workflowBlockRow
            : {},
      });
    },
  };
}

export function txWorkflowOutputDisplayPresentation(display = {}) {
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

function failureOutputFromReason(reason) {
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

function operationOutputText(operationStep) {
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

function txStepReasonRow(titleText, reasonText) {
  return { reasonText, titleText, variant: "muted" };
}

const txWorkflowChip = (chipText) => ({
  chipClass: workflowChipClass(),
  chipText,
});

function operationStepNumberText(operationStep, index = 0) {
  const stepIndex = Number(operationStep?.step_index);
  return transactionText((Number.isFinite(stepIndex) ? stepIndex : index) + 1);
}

function txOperationStepDisplay(operationStep, toneName) {
  const success = !!operationStep?.success;
  const toneClasses = operationToneClasses(toneName, success);
  const exitCodeText =
    operationStep?.exit_code != null ? operationStep.exit_code : "-";
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

function txOperationStepRows(steps = [], stepConfig = {}) {
  const toneName = stepConfig.toneName || "cyan";
  return (Array.isArray(steps) ? steps : []).map((operationStep, index) => {
    const stepNumberText = operationStepNumberText(operationStep, index);
    return {
      ...txOperationStepDisplay(operationStep, toneName),
      stepNumberText,
      titleText: `${t("txBlockResultOperationStep")}${stepNumberText}`,
    };
  });
}

function txStepResultRows(stepList = []) {
  return (Array.isArray(stepList) ? stepList : []).map((stepResult, index) => {
    const forwardOperationRows = txOperationStepRows(
      stepResult?.forward_operation_steps,
    );
    const rollbackOperationRows = txOperationStepRows(
      stepResult?.rollback_operation_steps,
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

function txStepRunOperation(step) {
  if (!step || typeof step !== "object") return null;
  return step.run && typeof step.run === "object" ? step.run : null;
}

function txStepRollbackOperation(step) {
  if (!step || typeof step !== "object") return null;
  return step.rollback && typeof step.rollback === "object"
    ? step.rollback
    : null;
}

function txOperationMode(operation) {
  if (!operation || typeof operation !== "object") return "";
  if (typeof operation.mode === "string") return operation.mode.trim();
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    return transactionText(steps[0]?.mode).trim();
  }
  if (operation.kind === "template") {
    return transactionText(operation.runtime?.default_mode).trim();
  }
  return "";
}

function txOperationTimeoutSeconds(operation) {
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

function txOperationDescription(operation) {
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
  if (operation.kind === "template") {
    const templateName = transactionText(operation.template?.name).trim();
    const defaultMode = transactionText(operation.runtime?.default_mode).trim();
    if (templateName && defaultMode) return `${templateName} (${defaultMode})`;
    return templateName || "template";
  }
  return "";
}

function joinedErrorText(errors) {
  return Array.isArray(errors) ? errors.join(" | ") : "";
}

function txWorkflowRollbackPolicyLabel(rollbackPolicy) {
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
    rollbackPolicy.whole_resource
  ) {
    return t("txWorkflowBlockRollbackWhole");
  }
  return t("txWorkflowBlockRollbackPerStep");
}

function txWorkflowExecutionBlockRow(block, index, failedBlockIndex) {
  const rollbackErrors = Array.isArray(block?.rollback_errors)
    ? block.rollback_errors
    : [];
  const failureOutput = failureOutputFromReason(block?.failure_reason);
  const failureReasonText = displayTextOrDash(block?.failure_reason);
  const rollbackStepRows = txOperationStepRows(block?.block_rollback_steps, {
    toneName: "amber",
  });
  const stepResultRows = txStepResultRows(block?.step_results);
  const blockRollbackOperationSummaryText = transactionText(
    block?.block_rollback_operation_summary || "",
  );
  const committedText = String(!!block?.committed);
  const executedStepsText = transactionText(block?.executed_steps ?? "-");
  const rollbackAttemptedText = String(!!block?.rollback_attempted);
  const rollbackSucceededText = String(!!block?.rollback_succeeded);
  return {
    blockRollbackOperationSummaryText,
    blockSummaryRows: [
      {
        labelText: t("txBlockResultExecutedSteps"),
        valueText: executedStepsText,
      },
      {
        labelText: t("txBlockResultRollbackAttempted"),
        valueText: rollbackAttemptedText,
      },
      {
        labelText: t("txBlockResultRollbackSucceeded"),
        valueText: rollbackSucceededText,
      },
    ],
    committedLineText: `${t("txBlockResultCommitted")}: ${committedText}`,
    committedText,
    currentBlockFailed: failedBlockIndex === index,
    executedStepsText,
    failureOutput,
    failureReasonText,
    failureReasonTitle: t("txBlockResultFailureReason"),
    hasRollbackErrors: rollbackErrors.length > 0,
    hasRollbackStepRows: rollbackStepRows.length > 0,
    hasBlockRollbackOperationSummary: !!blockRollbackOperationSummaryText,
    hasStepResultRows: stepResultRows.length > 0,
    noOperationOutputsMessage: t("txBlockResultNoOperationOutputs"),
    noStepDetailsMessage: t("txBlockResultNoStepDetails"),
    outputTitle: t("txBlockResultOutput"),
    rollbackAttemptedLineText: `${t("txBlockResultRollbackAttempted")}: ${rollbackAttemptedText}`,
    rollbackAttemptedText,
    rollbackErrorsText: joinedErrorText(rollbackErrors),
    rollbackErrorsTitle: t("txBlockResultRollbackErrors"),
    rollbackOutputsTitle: t("txBlockResultRollbackOutputs"),
    rollbackStepRows,
    rollbackSucceededLineText: `${t("txBlockResultRollbackSucceeded")}: ${rollbackSucceededText}`,
    rollbackSucceededText,
    blockRollbackOutputsTitle: t("txBlockResultBlockRollbackOutputs"),
    commandLabelText: t("fieldCommand"),
    failedBlockRollbackTitle: t("txWorkflowFailedBlockRollback"),
    showFailureOutput: stepResultRows.length === 0 && !!failureOutput,
    showFailureReason: failureReasonText !== "-",
    stepResultRows,
    title: `block[${index}] ${transactionText(block?.block_name || "-")}`,
  };
}

export function txWorkflowExecutionPresentation(workflowRun = null) {
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

function txWorkflowExecutionPanelDisplay(executionDisplay = {}) {
  const emptyWorkflowExecutionDisplay = {
    blockCountLineText: "",
    blockRows: [],
    blockResultsTitle: "",
    hasBlockRows: false,
    hasResult: false,
    hasRollbackErrors: false,
    noStepDetailsMessage: "",
    requestFailedMessage: "",
    rollbackErrorsText: "",
    rollbackErrorsTitle: "",
    summaryCards: [],
    workflowSummaryChipRows: [],
  };
  const emptyExecutionStatusDisplay = {
    message: "",
    mode: "empty",
    text: "",
    tone: "info",
  };
  const statusDisplay = executionDisplay?.status || emptyExecutionStatusDisplay;
  return {
    executionModeDisplay: txOutputModePresentation(statusDisplay.mode),
    statusDisplay,
    workflowExecutionDisplay:
      executionDisplay?.result || emptyWorkflowExecutionDisplay,
  };
}

function txWorkflowBlockResultPanelDisplay(workflowBlockRow = {}) {
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

function txBlockModeText(steps) {
  const modes = Array.from(
    new Set(
      steps
        .map((step) => txOperationMode(txStepRunOperation(step)))
        .filter((mode) => !!mode),
    ),
  );
  return modes.length ? modes.join(", ") : "Config";
}

function txBlockPreviewStepRow(step, index) {
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

function txBlockWholeResourceRollbackRow(txBlock, modeText) {
  const rollbackPolicy = txBlock?.rollback_policy;
  const operation = rollbackPolicy?.whole_resource?.undo || null;
  if (!operation) return null;
  const triggerStepIndex =
    rollbackPolicy?.whole_resource?.trigger_step_index != null
      ? rollbackPolicy.whole_resource.trigger_step_index
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

function txBlockResultPresentation(txResult = null) {
  const rollbackErrors = Array.isArray(txResult?.rollback_errors)
    ? txResult.rollback_errors
    : [];
  const blockRollbackStepRows = txOperationStepRows(
    txResult?.block_rollback_steps,
    { toneName: "amber" },
  );
  const failureOutput = failureOutputFromReason(txResult?.failure_reason);
  const stepResultRows = txStepResultRows(txResult?.step_results);
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

function txBlockPreviewPresentation(txBlock = null, txResult = null) {
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

function normalizeSummaryCards(summaryCards = [], fallbackSummaryCards = []) {
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

function normalizeTxBlockRollbackPreview(wholeResourceRollback = null) {
  if (!wholeResourceRollback || typeof wholeResourceRollback !== "object") {
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

function normalizeTxBlockResultPanel(resultPanel = null) {
  const fallback = txBlockResultPresentation(null);
  if (!resultPanel || typeof resultPanel !== "object") {
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
  previewPresentation = null,
) {
  const fallback = txBlockPreviewPresentation(null, null);
  if (!previewPresentation || typeof previewPresentation !== "object") {
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

function txWorkflowBlockTemplateName(block) {
  return typeof block?.tx_block_template_name === "string"
    ? block.tx_block_template_name.trim()
    : "";
}

function txWorkflowPreviewBlockRow(block, index) {
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

function txWorkflowPreviewPresentation(workflow = null) {
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
