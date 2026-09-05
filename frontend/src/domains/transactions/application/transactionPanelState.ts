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
  OrchestrationJsonValue,
  OrchestrationPlan,
} from "$domains/orchestration/model/types.js";
import type {
  JsonTemplateActionContext,
  TransactionTemplateResource,
} from "../model/types.js";
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

type StatusTone = string;

interface TextFile {
  text(): Promise<string>;
}

type AsyncCommand = () => void | Promise<void>;
type ExecutionModeHandler<TResult> = (() => TResult) | null | undefined;
type JsonTemplateDraftResult = TransactionTemplateResource | null | void;

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
  txBlock: OrchestrationJsonValue | null;
  txResult: OrchestrationJsonValue | null;
}

interface OrchestrationPreviewState {
  plan: OrchestrationPlan | null;
  result: OrchestrationExecutionResult | null;
}

interface TxBlockStageContext {
  active?: boolean;
  onExecute?: AsyncCommand | null;
}

interface TxWorkflowStageContext {
  active?: boolean;
  onCreateJsonTemplateDraft?:
    | ((
        actionContext?: JsonTemplateActionContext | null,
      ) => JsonTemplateDraftResult | Promise<JsonTemplateDraftResult>)
    | null;
  onDirectMode?: AsyncCommand | null;
  onExecute?: AsyncCommand | null;
  onImportFile?:
    | ((
        file: TextFile,
        actionContext?: JsonTemplateActionContext | null,
      ) => void | Promise<void>)
    | null;
  onPreview?: AsyncCommand | null;
  onTemplateMode?: AsyncCommand | null;
}

interface TxWorkflowEditorPort {
  txWorkflowEditorRaw?: () => string;
}

interface OrchestrationEditorPort {
  orchestrationEditorRaw?: () => string;
}

function normalizeTransactionKey(
  rawKey: string,
  validKeys: ReadonlySet<string>,
  fallback = "",
): string {
  const key = rawKey.trim();
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

export const TX_OUTPUT = Object.freeze({
  orchestrationExec: "orchestrationExec",
  orchestrationPlan: "orchestrationPlan",
  txBlockExec: "txBlockExec",
  txBlockPlan: "txBlockPlan",
  txWorkflowExec: "txWorkflowExec",
  txWorkflowPlan: "txWorkflowPlan",
} as const);

export type TransactionOutputKey = (typeof TX_OUTPUT)[keyof typeof TX_OUTPUT];

export const TX_VISUAL = Object.freeze({
  orchestrationPreview: "orchestrationPreview",
  txBlockPreview: "txBlockPreview",
  txWorkflowPreview: "txWorkflowPreview",
} as const);

export type TransactionVisualKey = (typeof TX_VISUAL)[keyof typeof TX_VISUAL];

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

export function runTxExecutionModeHandler<TDirectResult, TTemplateResult>(
  mode: string,
  onDirect: ExecutionModeHandler<TDirectResult>,
  onTemplate: ExecutionModeHandler<TTemplateResult>,
): TDirectResult | TTemplateResult | undefined {
  const executor =
    normalizeTxExecutionMode(mode) === TX_EXECUTION_MODE.template
      ? onTemplate
      : onDirect;
  return executor?.();
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
    onExecute: inputState.onExecute ?? null,
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
  const loadingRunner = createLoadingRunner<string>(
    () => getStore(loadingKeysStore),
    (nextKeys) => loadingKeysStore.set(nextKeys),
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
      dependencyState.onExecute = onExecute;
    },
    txBlockRunDisplayStateStore,
    txBlockRunPanelDisplayStateStore,
  };
}

export function createTxWorkflowStageWorkspace(
  inputState: TxWorkflowStageContext = {},
) {
  const dependencyState = {
    onCreateJsonTemplateDraft: inputState.onCreateJsonTemplateDraft ?? null,
    onDirectMode: inputState.onDirectMode ?? null,
    onExecute: inputState.onExecute ?? null,
    onImportFile: inputState.onImportFile ?? null,
    onPreview: inputState.onPreview ?? null,
    onTemplateMode: inputState.onTemplateMode ?? null,
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
  const loadingRunner = createLoadingRunner<string>(
    () => getStore(loadingKeysStore),
    (nextKeys) => loadingKeysStore.set(nextKeys),
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
    workflowExecutionDisplay: txWorkflowExecutionPresentation(null),
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
        workflowExecutionDisplay: txWorkflowExecutionPresentation(
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
    createDirectDraft: (
      actionContext: JsonTemplateActionContext | null = null,
    ) =>
      loadingRunner.run("json-new", () =>
        dependencyState.onCreateJsonTemplateDraft?.(actionContext),
      ),
    executeWorkflow: () =>
      loadingRunner.run("execute", () => dependencyState.onExecute?.()),
    importFile: (
      file: TextFile,
      actionContext: JsonTemplateActionContext | null = null,
    ) => dependencyState.onImportFile?.(file, actionContext),
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
      dependencyState.onCreateJsonTemplateDraft = onCreateJsonTemplateDraft;
      dependencyState.onDirectMode = onDirectMode;
      dependencyState.onExecute = onExecute;
      dependencyState.onImportFile = onImportFile;
      dependencyState.onPreview = onPreview;
      dependencyState.onTemplateMode = onTemplateMode;
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
export const txWorkflowExecutionResultState =
  writable<OrchestrationJsonValue | null>(null);

function emptyTransactionOutputState(): TransactionOutputState {
  return {
    mode: "empty",
    message: "",
    text: "",
    tone: "info",
  };
}

function normalizeTransactionOutputKey(outputKey: string): string {
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
  output: string,
): Writable<TransactionOutputState> {
  const key = normalizeTransactionOutputKey(output);
  return transactionStateStoreFor(transactionOutputStores, key);
}

export function transactionOutputState(
  output: string,
): Writable<TransactionOutputState> {
  return transactionOutputStoreFor(output);
}

function isTransactionOutput(output: string): boolean {
  return TX_OUTPUT_KEYS.has(normalizeTransactionOutputKey(output));
}

function isStructuredTransactionOutput(output: string): boolean {
  return STRUCTURED_TRANSACTION_OUTPUT_KEYS.has(
    normalizeTransactionOutputKey(output),
  );
}

function setTransactionOutput(
  output: string,
  nextState: Partial<TransactionOutputState> = {},
): void {
  transactionOutputStoreFor(output).set({
    ...emptyTransactionOutputState(),
    ...nextState,
  });
}

export function setTxWorkflowExecutionResult(
  workflowRun: OrchestrationJsonValue | null,
): void {
  txWorkflowExecutionResultState.set(workflowRun);
}

export function clearTransactionOutput(output: string): void {
  if (isTransactionOutput(output)) {
    setTransactionOutput(output, emptyTransactionOutputState());
  }
}

function setTransactionOutputStatus(
  output: string,
  message: string,
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
const txWorkflowPreviewState = writable<OrchestrationJsonValue | null>(null);

function normalizeVisualOutputKey(outputKey: string): string {
  return normalizeTransactionKey(outputKey, TX_VISUAL_KEYS);
}

function visualOutputStoreFor(
  output: string,
): Writable<TransactionOutputState> {
  const key = normalizeVisualOutputKey(output);
  return transactionStateStoreFor(visualOutputStores, key);
}

export function visualOutputState(
  output: string,
): Writable<TransactionOutputState> {
  return visualOutputStoreFor(output);
}

function setVisualOutput(
  output: string,
  nextState: Partial<TransactionOutputState> = {},
): void {
  visualOutputStoreFor(output).set({
    ...emptyTransactionOutputState(),
    ...nextState,
  });
}

function clearVisualOutput(output: string): void {
  setVisualOutput(output, emptyTransactionOutputState());
}

export function setVisualOutputStatus(
  output: string,
  message: string,
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

export function setTxBlockVisual(
  txBlock: OrchestrationJsonValue,
  txResult: OrchestrationJsonValue | null,
): void {
  lastTxBlockPreviewState = {
    txBlock,
    txResult,
  };
  refreshTxBlockPreview();
}

export function setTxWorkflowPreview(workflow: OrchestrationJsonValue): void {
  clearVisualOutput(TX_VISUAL.txWorkflowPreview);
  txWorkflowPreviewState.set(workflow);
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
    const workflow = JSON.parse(raw) as OrchestrationJsonValue;
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
    const plan = JSON.parse(raw) as OrchestrationPlan;
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
  output: string,
  message: string,
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

export function setRunningStatus(output: string): void {
  setStatus(output, tr("running", "running"), "running");
}

export function setErrorStatus(output: string, error: unknown): void {
  setStatus(output, errorMessage(error), "error");
}

export function setNamedStatus(
  output: string,
  key: string,
  fallback: string,
  resourceName: string,
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
