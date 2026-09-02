import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";
import type { Writable } from "svelte/store";

import {
  TX_EXECUTION_MODE,
  normalizeTxExecutionMode,
} from "../../../config/dashboardModes.js";
import type { TxExecutionMode } from "../../../config/dashboardModes.js";
import { currentLanguageState, t, tr as translate } from "../../../lib/i18n.js";
import { createLoadingRunner } from "../../../lib/svelte.js";
import {
  safeString as safeTemplateString,
  statusPresentation,
} from "../../../lib/ui.js";
import { showToast } from "$domains/overlays/index.js";
import type {
  OrchestrationExecutionResult,
  OrchestrationPlan,
} from "$domains/orchestration/model/types.js";
import {
  TX_EDITOR,
  TX_TEMPLATE_KIND,
  clearTxJsonEditorsHost,
  createTxJsonEditorWorkspace,
  createTxJsonEditorsHost,
  requireTxJsonEditor,
  setTxJsonEditorRawText,
  txJsonEditorRawText,
} from "./transactionJsonEditorState.js";
import {
  createJsonTemplateLibrary,
  jsonTemplateSelectStateFor,
  jsonTemplateSelectValue,
  loadAllJsonTemplates,
  setJsonTemplateSelectValue,
  updateJsonTemplateSelectOptions,
} from "./transactionJsonTemplateState.js";
import {
  transactionFallbackDisplay,
  txBlockRunDisplayPresentation,
  txBlockRunPanelDisplay,
  txBlockStageDisplay,
  txWorkflowExecutionPresentation,
  txWorkflowOutputDisplayPresentation,
  txWorkflowOutputPanelDisplay,
  txWorkflowStageDisplay,
} from "../presentation/transactionExecutionDisplays.js";
import {
  TX_VARS,
  TX_VARS_ASSISTANT_VALUE_TYPE_OPTIONS,
  addTxVarsAssistantEntry,
  clearTxVarsAssistantEntries,
  refreshTxVarsAssistants,
  removeTxVarsAssistantEntry,
  requiredTxVarsAssistantConfigByPrefix,
  setTxVarsRawText,
  setupTxVarsAssistants,
  txVarsAssistantPresentation,
  txVarsAssistantStateFor,
  txVarsTextStateFor,
  updateTxVarsAssistantEntry,
} from "./transactionVarsAssistant.js";

type OptionalHandler = (...args: unknown[]) => unknown;
type StatusTone = string;

interface TxExecutionModes {
  orchestration: TxExecutionMode;
  txBlock: TxExecutionMode;
  txWorkflow: TxExecutionMode;
}

interface TransactionOutputState {
  message: string;
  mode: string;
  text: string;
  tone: StatusTone;
}

interface TxBlockPreviewState {
  txBlock: unknown | null;
  txResult: unknown | null;
}

interface OrchestrationPreviewState {
  plan: OrchestrationPlan | null;
  result: OrchestrationExecutionResult | null;
}

interface TxBlockStageContext {
  active?: unknown;
  onExecute?: unknown;
}

interface TxWorkflowStageContext {
  active?: unknown;
  onCreateJsonTemplateDraft?: unknown;
  onDirectMode?: unknown;
  onExecute?: unknown;
  onImportFile?: unknown;
  onPreview?: unknown;
  onTemplateMode?: unknown;
}

interface TxWorkflowEditorPort {
  txWorkflowEditorRaw?: () => string;
}

interface OrchestrationEditorPort {
  orchestrationEditorRaw?: () => string;
}

function callObjectFunction<T extends object>(
  target: T,
  name: keyof T,
  ...args: unknown[]
): unknown {
  const fn = target?.[name];
  return typeof fn === "function" ? fn(...args) : undefined;
}

function normalizeOptionalHandler(handler: unknown): OptionalHandler | null {
  return typeof handler === "function" ? (handler as OptionalHandler) : null;
}

function normalizeTransactionKey(
  rawKey: unknown,
  validKeys: ReadonlySet<string>,
  fallback = "",
): string {
  const key = safeTemplateString(rawKey || "").trim();
  if (!key) return fallback;
  return validKeys.has(key) ? key : fallback || key;
}

function tr(key: string, fallback = key): string {
  return translate(key, fallback);
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return safeTemplateString(error.message);
  }
  return String(error || "");
}

const presentTxWorkflowExecution =
  txWorkflowExecutionPresentation as unknown as (
    workflowRun?: unknown,
  ) => ReturnType<typeof txWorkflowExecutionPresentation>;

export const TX_OUTPUT = Object.freeze({
  orchestrationExec: "orchestrationExec",
  orchestrationPlan: "orchestrationPlan",
  txBlockExec: "txBlockExec",
  txBlockPlan: "txBlockPlan",
  txWorkflowExec: "txWorkflowExec",
  txWorkflowPlan: "txWorkflowPlan",
});

export const TX_VISUAL = Object.freeze({
  orchestrationPreview: "orchestrationPreview",
  txBlockPreview: "txBlockPreview",
  txWorkflowPreview: "txWorkflowPreview",
});

const TX_OUTPUT_KEYS: ReadonlySet<string> = new Set(Object.values(TX_OUTPUT));
const TX_VISUAL_KEYS: ReadonlySet<string> = new Set(Object.values(TX_VISUAL));
const STRUCTURED_TRANSACTION_OUTPUT_KEYS: ReadonlySet<string> = new Set([
  TX_OUTPUT.orchestrationExec,
  TX_OUTPUT.txWorkflowExec,
]);

export const txExecutionModes = writable<TxExecutionModes>({
  orchestration: TX_EXECUTION_MODE.direct,
  txBlock: TX_EXECUTION_MODE.direct,
  txWorkflow: TX_EXECUTION_MODE.direct,
});

export function runTxExecutionModeHandler(
  mode: unknown,
  onDirect: unknown,
  onTemplate: unknown,
): unknown {
  const executor =
    normalizeTxExecutionMode(mode) === TX_EXECUTION_MODE.template
      ? onTemplate
      : onDirect;
  return typeof executor === "function" ? executor() : undefined;
}

export function getTxExecutionModes() {
  return getStore(txExecutionModes);
}

export function setTxExecutionModes(
  modes: Partial<TxExecutionModes> = {},
): void {
  txExecutionModes.update((currentModes) => ({
    orchestration: normalizeTxExecutionMode(
      modes.orchestration,
      currentModes.orchestration,
    ),
    txBlock: normalizeTxExecutionMode(modes.txBlock, currentModes.txBlock),
    txWorkflow: normalizeTxExecutionMode(
      modes.txWorkflow,
      currentModes.txWorkflow,
    ),
  }));
}

export function createTxBlockStageWorkspace(
  inputState: TxBlockStageContext = {},
) {
  const dependencyState = {
    onExecute: normalizeOptionalHandler(inputState.onExecute),
  };
  const activeStateStore = writable(false);
  const loadingKeysStore = writable<string[]>([]);
  const txBlockPlanStatusStateStore = transactionOutputState(
    TX_OUTPUT.txBlockPlan,
  );
  const txBlockExecStatusStateStore = transactionOutputState(
    TX_OUTPUT.txBlockExec,
  );
  const txBlockPreviewFallbackStateStore = visualOutputState(
    TX_VISUAL.txBlockPreview,
  );
  const loadingRunner = createLoadingRunner(
    () => getStore(loadingKeysStore),
    (nextKeys: unknown) =>
      loadingKeysStore.set(
        Array.isArray(nextKeys)
          ? nextKeys.filter((key): key is string => typeof key === "string")
          : [],
      ),
  );
  const txBlockStageDisplayStateStore = deriveStore(
    [
      txExecutionModes,
      txBlockPlanStatusStateStore,
      txBlockExecStatusStateStore,
    ],
    ([$txExecutionModes, $planStatus, $execStatus]) =>
      txBlockStageDisplay($txExecutionModes, $planStatus, $execStatus),
  );
  let lastTxBlockRunDisplay = txBlockRunDisplayPresentation(
    txBlockStageDisplay({}, {}, {}),
    [],
    {
      message: "",
      mode: "empty",
      text: "",
      tone: "info",
      txBlock: null,
      txResult: null,
    },
  );
  const txBlockRunDisplayStateStore = deriveStore(
    [
      activeStateStore,
      txBlockStageDisplayStateStore,
      loadingKeysStore,
      txBlockPreviewState,
      txBlockPreviewFallbackStateStore,
    ],
    ([
      $active,
      $txBlockStageDisplay,
      $loadingKeys,
      $txBlockPreviewState,
      $previewFallbackState,
    ]) => {
      if (!$active) {
        return lastTxBlockRunDisplay;
      }

      const previewFallback = transactionFallbackDisplay($previewFallbackState);
      let previewMode = "block";
      let previewText = "";
      let previewMessage = "";
      let previewTone = "info";
      const txBlock = $txBlockPreviewState.txBlock ?? null;
      const txResult = $txBlockPreviewState.txResult ?? null;

      if (previewFallback) {
        previewMode = previewFallback.mode;
        previewText = previewFallback.text;
        previewMessage = previewFallback.message;
        previewTone = previewFallback.tone;
      }

      lastTxBlockRunDisplay = txBlockRunDisplayPresentation(
        $txBlockStageDisplay,
        $loadingKeys,
        {
          message: previewMessage,
          mode: previewMode,
          text: previewText,
          tone: previewTone,
          txBlock,
          txResult,
        },
      );
      return lastTxBlockRunDisplay;
    },
  );
  const txBlockRunPanelDisplayStateStore = deriveStore(
    [txBlockRunDisplayStateStore, currentLanguageState],
    ([$txBlockRunDisplayStateStore]) =>
      txBlockRunPanelDisplay($txBlockRunDisplayStateStore),
  );

  return {
    execute: () =>
      loadingRunner.run("execute", () => dependencyState.onExecute?.()),
    setTxBlockStageContext({
      active = false,
      onExecute = null,
    }: TxBlockStageContext = {}) {
      activeStateStore.set(!!active);
      dependencyState.onExecute = normalizeOptionalHandler(onExecute);
    },
    txBlockRunDisplayStateStore,
    txBlockRunPanelDisplayStateStore,
  };
}

export function createTxWorkflowStageWorkspace(
  inputState: TxWorkflowStageContext = {},
) {
  const dependencyState = {
    onCreateJsonTemplateDraft: normalizeOptionalHandler(
      inputState.onCreateJsonTemplateDraft,
    ),
    onDirectMode: normalizeOptionalHandler(inputState.onDirectMode),
    onExecute: normalizeOptionalHandler(inputState.onExecute),
    onImportFile: normalizeOptionalHandler(inputState.onImportFile),
    onPreview: normalizeOptionalHandler(inputState.onPreview),
    onTemplateMode: normalizeOptionalHandler(inputState.onTemplateMode),
  };
  const activeStateStore = writable(false);
  const loadingKeysStore = writable<string[]>([]);
  const txWorkflowPlanStatusStateStore = transactionOutputState(
    TX_OUTPUT.txWorkflowPlan,
  );
  const txWorkflowPreviewFallbackStateStore = visualOutputState(
    TX_VISUAL.txWorkflowPreview,
  );
  const txWorkflowExecutionFallbackStateStore = transactionOutputState(
    TX_OUTPUT.txWorkflowExec,
  );
  const loadingRunner = createLoadingRunner(
    () => getStore(loadingKeysStore),
    (nextKeys: unknown) =>
      loadingKeysStore.set(
        Array.isArray(nextKeys)
          ? nextKeys.filter((key): key is string => typeof key === "string")
          : [],
      ),
  );
  const stageDisplayStateStore = deriveStore(
    [txExecutionModes, txWorkflowPlanStatusStateStore],
    ([$txExecutionModes, $planStatus]) =>
      txWorkflowStageDisplay($txExecutionModes, $planStatus),
  );
  const jsonNewLoadingStateStore = deriveStore(
    loadingKeysStore,
    ($loadingKeys) => $loadingKeys.includes("json-new"),
  );
  let lastTxWorkflowOutputDisplay = txWorkflowOutputDisplayPresentation({
    executeLoading: false,
    executionMessage: "",
    executionMode: "empty",
    executionText: "",
    executionTone: "info",
    planStatus: txWorkflowStageDisplay({}, {}).planStatus,
    previewLoading: false,
    previewMessage: "",
    previewMode: "empty",
    previewText: "",
    previewTone: "info",
    workflow: null,
    workflowExecutionDisplay: presentTxWorkflowExecution(null),
  });
  const txWorkflowOutputDisplayStateStore = deriveStore(
    [
      activeStateStore,
      stageDisplayStateStore,
      loadingKeysStore,
      txWorkflowPreviewState,
      txWorkflowPreviewFallbackStateStore,
      txWorkflowExecutionResultState,
      txWorkflowExecutionFallbackStateStore,
    ],
    ([
      $active,
      $stageDisplay,
      $loadingKeys,
      $workflowPreview,
      $previewFallbackState,
      $workflowExecutionResult,
      $executionFallbackState,
    ]) => {
      if (!$active) {
        return lastTxWorkflowOutputDisplay;
      }

      const previewFallback = transactionFallbackDisplay($previewFallbackState);
      const executionFallback = transactionFallbackDisplay(
        $executionFallbackState,
      );
      const previewLoading = $loadingKeys.includes("preview");
      const executeLoading = $loadingKeys.includes("execute");

      let previewMode = "workflow";
      let previewText = "";
      let previewMessage = "";
      let previewTone = "info";
      const workflow = $workflowPreview ?? null;
      if (previewFallback) {
        previewMode = previewFallback.mode;
        previewText = previewFallback.text;
        previewMessage = previewFallback.message;
        previewTone = previewFallback.tone;
      }

      let executionMode = $workflowExecutionResult ? "result" : "empty";
      let executionText = "";
      let executionMessage = "";
      let executionTone = "info";
      let workflowExecutionPayload = $workflowExecutionResult ?? null;
      if (executionFallback) {
        executionMode = executionFallback.mode;
        executionText = executionFallback.text;
        executionMessage = executionFallback.message;
        executionTone = executionFallback.tone;
        workflowExecutionPayload = null;
      }

      lastTxWorkflowOutputDisplay = txWorkflowOutputDisplayPresentation({
        executeLoading,
        executionMessage,
        executionMode,
        executionText,
        executionTone,
        planStatus: $stageDisplay.planStatus,
        previewLoading,
        previewMessage,
        previewMode,
        previewText,
        previewTone,
        workflow,
        workflowExecutionDisplay: presentTxWorkflowExecution(
          workflowExecutionPayload,
        ),
      });
      return lastTxWorkflowOutputDisplay;
    },
  );
  const workflowOutputPanelDisplayStateStore = deriveStore(
    [txWorkflowOutputDisplayStateStore, currentLanguageState],
    ([$txWorkflowOutputDisplay]) =>
      txWorkflowOutputPanelDisplay($txWorkflowOutputDisplay),
  );

  return {
    createDirectDraft: (actionContext: unknown = null) =>
      loadingRunner.run("json-new", () =>
        callObjectFunction(
          dependencyState,
          "onCreateJsonTemplateDraft",
          actionContext,
        ),
      ),
    executeWorkflow: () =>
      loadingRunner.run("execute", () => dependencyState.onExecute?.()),
    importFile: (file: unknown, actionContext: unknown = null) =>
      callObjectFunction(dependencyState, "onImportFile", file, actionContext),
    jsonNewLoadingStateStore,
    previewWorkflow: () =>
      loadingRunner.run("preview", () => dependencyState.onPreview?.()),
    setTxWorkflowStageContext({
      active = false,
      onCreateJsonTemplateDraft = null,
      onDirectMode = null,
      onExecute = null,
      onImportFile = null,
      onPreview = null,
      onTemplateMode = null,
    }: TxWorkflowStageContext = {}) {
      activeStateStore.set(!!active);
      dependencyState.onCreateJsonTemplateDraft = normalizeOptionalHandler(
        onCreateJsonTemplateDraft,
      );
      dependencyState.onDirectMode = normalizeOptionalHandler(onDirectMode);
      dependencyState.onExecute = normalizeOptionalHandler(onExecute);
      dependencyState.onImportFile = normalizeOptionalHandler(onImportFile);
      dependencyState.onPreview = normalizeOptionalHandler(onPreview);
      dependencyState.onTemplateMode = normalizeOptionalHandler(onTemplateMode);
    },
    selectMode: (txExecutionMode = "") =>
      runTxExecutionModeHandler(
        txExecutionMode,
        dependencyState.onDirectMode,
        dependencyState.onTemplateMode,
      ),
    stageDisplayStateStore,
    workflowOutputPanelDisplayStateStore,
  };
}

const transactionOutputStores = new Map<
  string,
  Writable<TransactionOutputState>
>();
export const txWorkflowExecutionResultState = writable<unknown | null>(null);

function emptyTransactionOutputState(): TransactionOutputState {
  return {
    mode: "empty",
    message: "",
    text: "",
    tone: "info",
  };
}

function normalizeTransactionOutputKey(outputKey: unknown): string {
  return normalizeTransactionKey(outputKey, TX_OUTPUT_KEYS);
}

function transactionStateStoreFor(
  storeMap: Map<string, Writable<TransactionOutputState>>,
  key: string,
): Writable<TransactionOutputState> {
  if (!storeMap.has(key)) {
    storeMap.set(key, writable(emptyTransactionOutputState()));
  }
  return storeMap.get(key)!;
}

function transactionOutputStoreFor(
  output: unknown,
): Writable<TransactionOutputState> {
  const key = normalizeTransactionOutputKey(output);
  return transactionStateStoreFor(transactionOutputStores, key);
}

export function transactionOutputState(
  output: unknown,
): Writable<TransactionOutputState> {
  return transactionOutputStoreFor(output);
}

function isTransactionOutput(output: unknown): boolean {
  return TX_OUTPUT_KEYS.has(normalizeTransactionOutputKey(output));
}

function isStructuredTransactionOutput(output: unknown): boolean {
  return STRUCTURED_TRANSACTION_OUTPUT_KEYS.has(
    normalizeTransactionOutputKey(output),
  );
}

function setTransactionOutput(
  output: unknown,
  nextState: Partial<TransactionOutputState> = {},
): void {
  transactionOutputStoreFor(output).set({
    ...emptyTransactionOutputState(),
    ...nextState,
  });
}

export function setTxWorkflowExecutionResult(workflowRun: unknown): void {
  txWorkflowExecutionResultState.set(workflowRun || null);
}

export function clearTransactionOutput(output: unknown): void {
  if (isTransactionOutput(output)) {
    setTransactionOutput(output, emptyTransactionOutputState());
  }
}

function setTransactionOutputStatus(
  output: unknown,
  message: unknown,
  tone: StatusTone = "info",
): void {
  const statusMessage = safeTemplateString(message || "");
  setTransactionOutput(output, {
    message: statusMessage,
    mode: statusMessage ? "status" : "empty",
    tone: tone || "info",
  });
}

let lastTxBlockPreviewState: TxBlockPreviewState = {
  txBlock: null,
  txResult: null,
};
let lastOrchestrationPreviewState: OrchestrationPreviewState = {
  plan: null,
  result: null,
};
const visualOutputStores = new Map<string, Writable<TransactionOutputState>>();

export const orchestrationPreviewState = writable<{
  plan: OrchestrationPlan | null;
}>({
  plan: lastOrchestrationPreviewState.plan,
});
export const orchestrationResultState =
  writable<OrchestrationExecutionResult | null>(
    lastOrchestrationPreviewState.result,
  );
export const txBlockPreviewState = writable<TxBlockPreviewState>({
  ...lastTxBlockPreviewState,
});
const txWorkflowPreviewState = writable<unknown | null>(null);

function normalizeVisualOutputKey(outputKey: unknown): string {
  return normalizeTransactionKey(outputKey, TX_VISUAL_KEYS);
}

function visualOutputStoreFor(
  output: unknown,
): Writable<TransactionOutputState> {
  const key = normalizeVisualOutputKey(output);
  return transactionStateStoreFor(visualOutputStores, key);
}

export function visualOutputState(
  output: unknown,
): Writable<TransactionOutputState> {
  return visualOutputStoreFor(output);
}

function setVisualOutput(
  output: unknown,
  nextState: Partial<TransactionOutputState> = {},
): void {
  visualOutputStoreFor(output).set({
    ...emptyTransactionOutputState(),
    ...nextState,
  });
}

function clearVisualOutput(output: unknown): void {
  setVisualOutput(output, emptyTransactionOutputState());
}

export function setVisualOutputStatus(
  output: unknown,
  message: unknown,
  tone: StatusTone = "info",
): void {
  const statusMessage = safeTemplateString(message || "");
  setVisualOutput(output, {
    message: statusMessage,
    mode: statusMessage ? "status" : "empty",
    tone: tone || "info",
  });
}

export function getLastOrchestrationPreview(): OrchestrationPreviewState {
  return lastOrchestrationPreviewState;
}

export function refreshTxBlockPreview(): void {
  clearVisualOutput(TX_VISUAL.txBlockPreview);
  txBlockPreviewState.set({ ...lastTxBlockPreviewState });
}

export function setTxBlockVisual(txBlock: unknown, txResult: unknown): void {
  lastTxBlockPreviewState = {
    txBlock: txBlock || null,
    txResult: txResult || null,
  };
  refreshTxBlockPreview();
}

export function setTxWorkflowPreview(workflow: unknown): void {
  clearVisualOutput(TX_VISUAL.txWorkflowPreview);
  txWorkflowPreviewState.set(workflow || {});
}

export function updateTxWorkflowPreviewFromEditor(
  editors: TxWorkflowEditorPort | null = null,
): void {
  const raw =
    typeof editors?.txWorkflowEditorRaw === "function"
      ? editors.txWorkflowEditorRaw().trim()
      : "";
  if (!raw) {
    setVisualOutputStatus(
      TX_VISUAL.txWorkflowPreview,
      tr("txWorkflowVisualEmpty"),
    );
    return;
  }
  try {
    const workflow = JSON.parse(raw);
    setTxWorkflowPreview(workflow);
  } catch (error) {
    setVisualOutputStatus(
      TX_VISUAL.txWorkflowPreview,
      `${tr("txWorkflowVisualInvalid")}: ${errorMessage(error) || tr("requestFailed")}`,
      "error",
    );
  }
}

export function setOrchestrationPreview(
  plan: OrchestrationPlan,
  orchestrationRun: OrchestrationExecutionResult | null = null,
): void {
  lastOrchestrationPreviewState = {
    plan: plan || null,
    result: orchestrationRun || null,
  };
  refreshOrchestrationPreview();
  refreshOrchestrationResult();
}

export function refreshOrchestrationPreview(): void {
  clearVisualOutput(TX_VISUAL.orchestrationPreview);
  orchestrationPreviewState.set({
    plan: lastOrchestrationPreviewState.plan,
  });
}

export function updateOrchestrationPreviewFromEditor(
  editors: OrchestrationEditorPort | null = null,
): void {
  const raw =
    typeof editors?.orchestrationEditorRaw === "function"
      ? editors.orchestrationEditorRaw().trim()
      : "";
  if (!raw) {
    setVisualOutputStatus(
      TX_VISUAL.orchestrationPreview,
      tr("orchestrationVisualEmpty"),
    );
    return;
  }
  try {
    const plan = JSON.parse(raw);
    setOrchestrationPreview(plan, null);
  } catch (error) {
    setVisualOutputStatus(
      TX_VISUAL.orchestrationPreview,
      `${tr("orchestrationVisualInvalid")}: ${errorMessage(error) || tr("requestFailed")}`,
      "error",
    );
  }
}

export function refreshOrchestrationResult(): void {
  orchestrationResultState.set(lastOrchestrationPreviewState.result);
}

export function setStatus(
  output: unknown,
  message: unknown,
  tone: StatusTone = "info",
): void {
  const statusMessage = safeTemplateString(message || "");
  if (isTransactionOutput(output)) {
    setTransactionOutputStatus(output, statusMessage, tone);
    const presentation = statusPresentation(statusMessage, tone, {
      suppressPassiveLoaded: false,
    });
    if (presentation.shouldToast && !isStructuredTransactionOutput(output)) {
      showToast(presentation.text, presentation.tone);
    }
    return;
  }
  const presentation = statusPresentation(statusMessage, tone, {
    suppressPassiveLoaded: false,
  });
  if (presentation.shouldToast) {
    showToast(presentation.text, presentation.tone);
  }
}

export function setRunningStatus(output: unknown): void {
  setStatus(output, tr("running", "running"), "running");
}

export function setErrorStatus(output: unknown, error: unknown): void {
  setStatus(output, errorMessage(error), "error");
}

export function setNamedStatus(
  output: unknown,
  key: string,
  fallback: string,
  resourceName: unknown,
): void {
  setStatus(output, `${tr(key, fallback)}: ${resourceName}`, "success");
}

export { TX_VARS, TX_VARS_ASSISTANT_VALUE_TYPE_OPTIONS, setTxVarsRawText };
export {
  TX_EDITOR,
  TX_TEMPLATE_KIND,
  createTxJsonEditorWorkspace,
  createTxJsonEditorsHost,
  createJsonTemplateLibrary,
  clearTxJsonEditorsHost,
  jsonTemplateSelectStateFor,
  jsonTemplateSelectValue,
  requireTxJsonEditor,
  setJsonTemplateSelectValue,
  setTxJsonEditorRawText,
  txJsonEditorRawText,
  loadAllJsonTemplates,
  updateJsonTemplateSelectOptions,
};
export {
  addTxVarsAssistantEntry,
  clearTxVarsAssistantEntries,
  refreshTxVarsAssistants,
  removeTxVarsAssistantEntry,
  requiredTxVarsAssistantConfigByPrefix,
  setupTxVarsAssistants,
  txVarsAssistantPresentation,
  txVarsAssistantStateFor,
  txVarsTextStateFor,
  updateTxVarsAssistantEntry,
};
