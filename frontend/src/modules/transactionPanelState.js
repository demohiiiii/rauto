import {
  derived as deriveStore,
  get as getStore,
  writable,
} from "svelte/store";

import {
  TX_EXECUTION_MODE,
  normalizeTxExecutionMode,
} from "../config/dashboardModes.js";
import { currentLanguageState, t, tr as translate } from "../lib/i18n.js";
import { createLoadingRunner } from "../lib/svelte.js";
import {
  safeString as safeTemplateString,
  statusPresentation,
} from "../lib/ui.js";
import { showToast } from "./overlays.js";
import {
  TX_EDITOR,
  TX_TEMPLATE_KIND,
  clearTxJsonEditorsHost,
  createJsonTemplateLibrary,
  createTxJsonEditorWorkspace,
  createTxJsonEditorsHost,
  jsonTemplateSelectStateFor,
  jsonTemplateSelectValue,
  loadAllJsonTemplates,
  requireTxJsonEditor,
  setJsonTemplateSelectValue,
  setTxJsonEditorRawText,
  txJsonEditorRawText,
  updateJsonTemplateSelectOptions,
} from "./transactionEditorState.js";
import {
  transactionFallbackDisplay,
  txBlockRunDisplayPresentation,
  txBlockRunPanelDisplay,
  txBlockStageDisplay,
  txWorkflowExecutionPresentation,
  txWorkflowOutputDisplayPresentation,
  txWorkflowOutputPanelDisplay,
  txWorkflowStageDisplay,
} from "./transactionExecutionDisplays.js";
import {
  TX_VARS,
  TX_VARS_ASSISTANT_VALUE_TYPE_OPTIONS,
  addTxVarsAssistantEntry,
  applyTxVarsAssistantEntriesFromText as applyTxVarsAssistantEntriesFromTextBase,
  clearTxVarsAssistantEntries,
  createTxVarsAssistantCardWorkspace as createTxVarsAssistantCardWorkspaceBase,
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

function callObjectFunction(target, name, ...args) {
  const fn = target?.[name];
  return typeof fn === "function" ? fn(...args) : undefined;
}

function normalizeOptionalHandler(handler) {
  return typeof handler === "function" ? handler : null;
}

function normalizeTransactionKey(rawKey, validKeys, fallback = "") {
  const key = safeTemplateString(rawKey || "").trim();
  if (!key) return fallback;
  return validKeys.has(key) ? key : fallback || key;
}

function tr(key, fallback = key) {
  return translate(key, fallback);
}

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

const TX_OUTPUT_KEYS = new Set(Object.values(TX_OUTPUT));
const TX_VISUAL_KEYS = new Set(Object.values(TX_VISUAL));
const STRUCTURED_TRANSACTION_OUTPUT_KEYS = new Set([
  TX_OUTPUT.orchestrationExec,
  TX_OUTPUT.txWorkflowExec,
]);

export const txExecutionModes = writable({
  orchestration: TX_EXECUTION_MODE.direct,
  txBlock: TX_EXECUTION_MODE.direct,
  txWorkflow: TX_EXECUTION_MODE.direct,
});

export function runTxExecutionModeHandler(mode, onDirect, onTemplate) {
  const executor =
    normalizeTxExecutionMode(mode) === TX_EXECUTION_MODE.template
      ? onTemplate
      : onDirect;
  return typeof executor === "function" ? executor() : undefined;
}

export function getTxExecutionModes() {
  return getStore(txExecutionModes);
}

export function setTxExecutionModes(modes = {}) {
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

export function createTxBlockStageWorkspace(inputState = {}) {
  const dependencyState = {
    onDirectExecute: normalizeOptionalHandler(inputState.onDirectExecute),
    onDirectPlan: normalizeOptionalHandler(inputState.onDirectPlan),
    onTemplateExecute: normalizeOptionalHandler(inputState.onTemplateExecute),
    onTemplatePlan: normalizeOptionalHandler(inputState.onTemplatePlan),
  };
  const activeStateStore = writable(false);
  const loadingKeysStore = writable([]);
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
    (nextKeys) => loadingKeysStore.set(Array.isArray(nextKeys) ? nextKeys : []),
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
    runDirectExecute: () =>
      loadingRunner.run("direct-exec", dependencyState.onDirectExecute),
    runDirectPlan: () =>
      loadingRunner.run("direct-plan", dependencyState.onDirectPlan),
    setTxBlockStageContext({
      active = false,
      onDirectExecute = null,
      onDirectPlan = null,
      onTemplateExecute = null,
      onTemplatePlan = null,
    } = {}) {
      activeStateStore.set(!!active);
      dependencyState.onDirectExecute =
        normalizeOptionalHandler(onDirectExecute);
      dependencyState.onDirectPlan = normalizeOptionalHandler(onDirectPlan);
      dependencyState.onTemplateExecute =
        normalizeOptionalHandler(onTemplateExecute);
      dependencyState.onTemplatePlan = normalizeOptionalHandler(onTemplatePlan);
    },
    runTemplateExecute: () =>
      loadingRunner.run("template-exec", dependencyState.onTemplateExecute),
    runTemplatePlan: () =>
      loadingRunner.run("template-plan", dependencyState.onTemplatePlan),
    txBlockRunDisplayStateStore,
    txBlockRunPanelDisplayStateStore,
  };
}

export function createTxWorkflowStageWorkspace(inputState = {}) {
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
  const loadingKeysStore = writable([]);
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
    (nextKeys) => loadingKeysStore.set(Array.isArray(nextKeys) ? nextKeys : []),
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
    createDirectDraft: () =>
      loadingRunner.run("json-new", dependencyState.onCreateJsonTemplateDraft),
    executeWorkflow: () =>
      loadingRunner.run("execute", dependencyState.onExecute),
    importFile: (file) =>
      callObjectFunction(dependencyState, "onImportFile", file),
    jsonNewLoadingStateStore,
    previewWorkflow: () =>
      loadingRunner.run("preview", dependencyState.onPreview),
    setTxWorkflowStageContext({
      active = false,
      onCreateJsonTemplateDraft = null,
      onDirectMode = null,
      onExecute = null,
      onImportFile = null,
      onPreview = null,
      onTemplateMode = null,
    } = {}) {
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

const transactionOutputStores = new Map();
export const txWorkflowExecutionResultState = writable(null);

function emptyTransactionOutputState() {
  return {
    mode: "empty",
    message: "",
    text: "",
    tone: "info",
  };
}

function normalizeTransactionOutputKey(outputKey) {
  return normalizeTransactionKey(outputKey, TX_OUTPUT_KEYS);
}

function transactionStateStoreFor(storeMap, key) {
  if (!storeMap.has(key)) {
    storeMap.set(key, writable(emptyTransactionOutputState()));
  }
  return storeMap.get(key);
}

function transactionOutputStoreFor(output) {
  const key = normalizeTransactionOutputKey(output);
  return transactionStateStoreFor(transactionOutputStores, key);
}

export function transactionOutputState(output) {
  return transactionOutputStoreFor(output);
}

function isTransactionOutput(output) {
  return TX_OUTPUT_KEYS.has(normalizeTransactionOutputKey(output));
}

function isStructuredTransactionOutput(output) {
  return STRUCTURED_TRANSACTION_OUTPUT_KEYS.has(
    normalizeTransactionOutputKey(output),
  );
}

function setTransactionOutput(output, nextState = {}) {
  transactionOutputStoreFor(output).set({
    ...emptyTransactionOutputState(),
    ...nextState,
  });
}

export function setTxWorkflowExecutionResult(workflowRun) {
  txWorkflowExecutionResultState.set(workflowRun || null);
}

export function clearTransactionOutput(output) {
  if (isTransactionOutput(output)) {
    setTransactionOutput(output, emptyTransactionOutputState());
  }
}

function setTransactionOutputStatus(output, message, tone = "info") {
  setTransactionOutput(output, {
    message: message || "",
    mode: message ? "status" : "empty",
    tone: tone || "info",
  });
}

let lastTxBlockPreviewState = {
  txBlock: null,
  txResult: null,
};
let lastOrchestrationPreviewState = {
  plan: null,
  inventory: null,
  result: null,
};
const visualOutputStores = new Map();

export const orchestrationPreviewState = writable({
  inventory: lastOrchestrationPreviewState.inventory,
  plan: lastOrchestrationPreviewState.plan,
});
export const orchestrationResultState = writable(
  lastOrchestrationPreviewState.result,
);
export const txBlockPreviewState = writable({ ...lastTxBlockPreviewState });
const txWorkflowPreviewState = writable(null);

function normalizeVisualOutputKey(outputKey) {
  return normalizeTransactionKey(outputKey, TX_VISUAL_KEYS);
}

function visualOutputStoreFor(output) {
  const key = normalizeVisualOutputKey(output);
  return transactionStateStoreFor(visualOutputStores, key);
}

export function visualOutputState(output) {
  return visualOutputStoreFor(output);
}

function setVisualOutput(output, nextState = {}) {
  visualOutputStoreFor(output).set({
    ...emptyTransactionOutputState(),
    ...nextState,
  });
}

function clearVisualOutput(output) {
  setVisualOutput(output, emptyTransactionOutputState());
}

export function setVisualOutputStatus(output, message, tone = "info") {
  setVisualOutput(output, {
    message: message || "",
    mode: message ? "status" : "empty",
    tone: tone || "info",
  });
}

export function getLastOrchestrationPreview() {
  return lastOrchestrationPreviewState;
}

export function refreshTxBlockPreview() {
  clearVisualOutput(TX_VISUAL.txBlockPreview);
  txBlockPreviewState.set({ ...lastTxBlockPreviewState });
}

export function setTxBlockVisual(txBlock, txResult) {
  lastTxBlockPreviewState = {
    txBlock: txBlock || null,
    txResult: txResult || null,
  };
  refreshTxBlockPreview();
}

export function setTxWorkflowPreview(workflow) {
  clearVisualOutput(TX_VISUAL.txWorkflowPreview);
  txWorkflowPreviewState.set(workflow || {});
}

export function updateTxWorkflowPreviewFromEditor(editors = null) {
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
      `${tr("txWorkflowVisualInvalid")}: ${error.message || tr("requestFailed")}`,
      "error",
    );
  }
}

export function setOrchestrationPreview(
  plan,
  inventory,
  orchestrationRun = null,
) {
  lastOrchestrationPreviewState = {
    plan: plan || null,
    inventory: inventory || null,
    result: orchestrationRun || null,
  };
  refreshOrchestrationPreview();
  refreshOrchestrationResult();
}

export function refreshOrchestrationPreview() {
  clearVisualOutput(TX_VISUAL.orchestrationPreview);
  orchestrationPreviewState.set({
    inventory: lastOrchestrationPreviewState.inventory,
    plan: lastOrchestrationPreviewState.plan,
  });
}

export function updateOrchestrationPreviewFromEditor(editors = null) {
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
    setOrchestrationPreview(plan, plan.inventory || null, null);
  } catch (error) {
    setVisualOutputStatus(
      TX_VISUAL.orchestrationPreview,
      `${tr("orchestrationVisualInvalid")}: ${error.message || tr("requestFailed")}`,
      "error",
    );
  }
}

export function refreshOrchestrationResult() {
  orchestrationResultState.set(lastOrchestrationPreviewState.result);
}

export function setStatus(output, message, tone = "info") {
  if (isTransactionOutput(output)) {
    setTransactionOutputStatus(output, message, tone);
    const presentation = statusPresentation(message, tone, {
      suppressPassiveLoaded: false,
    });
    if (presentation.shouldToast && !isStructuredTransactionOutput(output)) {
      showToast(presentation.text, presentation.tone);
    }
    return;
  }
  const presentation = statusPresentation(message, tone, {
    suppressPassiveLoaded: false,
  });
  if (presentation.shouldToast) {
    showToast(presentation.text, presentation.tone);
  }
}

export function setRunningStatus(output) {
  setStatus(output, tr("running", "running"), "running");
}

export function setErrorStatus(output, error) {
  setStatus(output, error?.message || String(error || ""), "error");
}

export function setNamedStatus(output, key, fallback, resourceName) {
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

export function applyTxVarsAssistantEntriesFromText(varsKey, options = {}) {
  return applyTxVarsAssistantEntriesFromTextBase(varsKey, {
    ...options,
    setStatus,
  });
}

export function createTxVarsAssistantCardWorkspace(options = {}) {
  return createTxVarsAssistantCardWorkspaceBase({
    ...options,
    setStatus,
  });
}
