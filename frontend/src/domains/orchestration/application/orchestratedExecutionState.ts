import { get } from "svelte/store";

import {
  executeOrchestration,
  executeTxBlock,
  executeTxWorkflow,
} from "../infrastructure/orchestrationExecutionApi.js";
import {
  orchestrationInlineExecutionPayload,
  txBlockInlineExecutionPayload,
  txWorkflowInlineExecutionPayload,
} from "../model/orchestratedExecutionPayloads.js";
import { tr as translate } from "../../../lib/i18n.js";
import {
  connectionPayload as connectionPayloadFromConnections,
  ensureConnectionTargetSelected,
} from "$domains/connections/index.js";
import {
  applyRecordDrawerRecording,
  recordLevelPayload as recordLevelPayloadFromOverlays,
} from "$domains/overlays/index.js";
import { showToast } from "$domains/overlays/index.js";
import {
  TX_EDITOR,
  TX_OUTPUT,
  TX_TEMPLATE_KIND,
  TX_VISUAL,
  TX_VARS,
  clearTransactionOutput,
  requireTxJsonEditor,
  setErrorStatus,
  setStatus,
  setRunningStatus,
  setTxExecutionModes,
  setTxWorkflowExecutionResult,
  setVisualOutputStatus,
  txVarsTextStateFor,
} from "$domains/transactions/index.js";
import type { JsonObject } from "../model/types.js";

type DependencyMap = Record<string, unknown>;
type UnknownFunction = (...args: unknown[]) => unknown;

interface ExternalActionContext {
  isCurrent?: () => boolean;
  runOwnedEditorMutation?: (operation: () => unknown) => unknown;
}

interface TextFile {
  text(): Promise<string>;
}

interface ExecutionPayloadOptions {
  dependencies: DependencyMap;
  dryRun: boolean;
}

interface OrchestratedExecutionOperationsOptions {
  dependencies?: DependencyMap;
  txJsonEditorsHost?: unknown;
}

interface OrchestratedExecutionDependencyInput {
  setOrchestrationPreview?: unknown;
  setTxBlockVisual?: unknown;
  setTxWorkflowPreview?: unknown;
  setVisualOutputStatus?: unknown;
  updateOrchestrationPreviewFromEditor?: unknown;
  updateTxWorkflowPreviewFromEditor?: unknown;
}

interface JsonTemplateConfig {
  apiBase: string;
  emptyKey: string;
  nameRequiredKey: string;
  newPromptKey: string;
  runEditor: string;
  runOutput: string;
}

const objectValue = (value: unknown): JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};

const errorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String(error.message)
    : String(error || "");

function tr(key: string, fallback = key): string {
  return translate(key, fallback);
}

function callObjectFunction(
  target: unknown,
  name: string,
  ...args: unknown[]
): unknown {
  const targetValue = objectValue(target);
  const operation = targetValue[name];
  return typeof operation === "function"
    ? (operation as UnknownFunction)(...args)
    : undefined;
}

function transactionText(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function requireTxDependency(
  dependencies: DependencyMap,
  dependencyName: string,
): UnknownFunction {
  const dependency = dependencies[dependencyName];
  if (typeof dependency !== "function") {
    throw new Error(`${dependencyName} is not ready`);
  }
  return dependency as UnknownFunction;
}

function ensureTarget(dependencies: DependencyMap): boolean {
  const ensureTargetSelected = dependencies.ensureConnectionTargetSelected;
  if (!ensureTargetSelected) return true;
  return !!(ensureTargetSelected as UnknownFunction)();
}

function applyRecording(recordingPayload: unknown): void {
  applyRecordDrawerRecording(recordingPayload);
}

function setDependencyVisualError(
  dependencies: DependencyMap,
  output: unknown,
  message: string,
): void {
  callObjectFunction(
    dependencies,
    "setVisualOutputStatus",
    output,
    message,
    "error",
  );
}

const connectionPayload = (dependencies: DependencyMap): unknown =>
  requireTxDependency(dependencies, "connectionPayload")();

const recordLevelPayload = (dependencies: DependencyMap): unknown =>
  requireTxDependency(dependencies, "recordLevelPayload")();

function callOptionalTxDependency(
  dependencies: DependencyMap,
  dependencyName: string,
  ...args: unknown[]
): unknown {
  const dependency = dependencies[dependencyName];
  return typeof dependency === "function"
    ? (dependency as UnknownFunction)(...args)
    : undefined;
}

const txBlockEditorRaw = (): string =>
  transactionText(requireTxJsonEditor("txBlockEditorRaw")()).trim();

const txWorkflowEditorRaw = (): string =>
  transactionText(requireTxJsonEditor("txWorkflowEditorRaw")()).trim();

const orchestrationEditorRaw = (): string =>
  transactionText(requireTxJsonEditor("orchestrationEditorRaw")()).trim();

const parseTxBlockEditorJson = (): unknown =>
  requireTxJsonEditor("parseTxBlockEditorJson")();

function txVarsRawText(varsKey: unknown): string {
  const rawText = get(txVarsTextStateFor(varsKey))?.raw;
  if (rawText == null) return "";
  return typeof rawText === "string" ? rawText : String(rawText);
}

function txVarsJsonObject(varsKey: unknown): unknown {
  const raw = txVarsRawText(varsKey).trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return parsed;
}

export function jsonTemplateConfigFor(
  kind: unknown,
): JsonTemplateConfig | null {
  const configs: Record<string, JsonTemplateConfig> = {
    [TX_TEMPLATE_KIND.txBlock]: {
      apiBase: "/api/tx-block-templates",
      emptyKey: "txBlockTemplateListEmpty",
      nameRequiredKey: "txBlockTemplateNameRequired",
      newPromptKey: "txBlockTemplateNewPrompt",
      runEditor: TX_EDITOR.txBlock,
      runOutput: TX_OUTPUT.txBlockPlan,
    },
    [TX_TEMPLATE_KIND.txWorkflow]: {
      apiBase: "/api/tx-workflow-templates",
      emptyKey: "txWorkflowTemplateListEmpty",
      nameRequiredKey: "txWorkflowTemplateNameRequired",
      newPromptKey: "txWorkflowTemplateNewPrompt",
      runEditor: TX_EDITOR.txWorkflow,
      runOutput: TX_OUTPUT.txWorkflowPlan,
    },
    [TX_TEMPLATE_KIND.orchestration]: {
      apiBase: "/api/orchestration-templates",
      emptyKey: "orchestrationTemplateListEmpty",
      nameRequiredKey: "orchestrationTemplateNameRequired",
      newPromptKey: "orchestrationTemplateNewPrompt",
      runEditor: TX_EDITOR.orchestration,
      runOutput: TX_OUTPUT.orchestrationPlan,
    },
  };
  return configs[transactionText(kind)] || null;
}

function txBlockExecutionPayload({
  dependencies,
  dryRun,
}: ExecutionPayloadOptions): JsonObject {
  return txBlockInlineExecutionPayload({
    connection: connectionPayload(dependencies),
    dryRun,
    recordLevel: recordLevelPayload(dependencies),
    txBlock: parseTxBlockEditorJson(),
    txBlockVars: txVarsJsonObject(TX_VARS.txBlockDirect),
  });
}

function txWorkflowExecutionPayload({
  dependencies,
  dryRun,
}: ExecutionPayloadOptions): JsonObject {
  return txWorkflowInlineExecutionPayload({
    connection: connectionPayload(dependencies),
    dryRun,
    recordLevel: recordLevelPayload(dependencies),
    workflowText: txWorkflowEditorRaw(),
    workflowVars: txVarsJsonObject(TX_VARS.txWorkflowDirect),
  });
}

function orchestrationExecutionPayload({
  dependencies,
  dryRun,
}: ExecutionPayloadOptions): JsonObject {
  return orchestrationInlineExecutionPayload({
    connection: connectionPayload(dependencies),
    dryRun,
    planText: orchestrationEditorRaw(),
    planVars: txVarsJsonObject(TX_VARS.orchestrationDirect),
    recordLevel: recordLevelPayload(dependencies),
  });
}

function normalizeTxWorkflowJsonFromEditor(
  txJsonEditorsHost: unknown = null,
  dependencies: DependencyMap = {},
  actionContext: ExternalActionContext | null = null,
): boolean {
  const raw = txWorkflowEditorRaw();
  if (!raw) return false;
  const workflow: unknown = JSON.parse(raw);
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    throw new Error(tr("txWorkflowLoadInvalidJsonShape"));
  }
  if (!externalActionIsCurrent(actionContext)) return false;
  runOwnedEditorMutation(actionContext, () =>
    callObjectFunction(txJsonEditorsHost, "setTxWorkflowEditorJson", workflow),
  );
  callOptionalTxDependency(dependencies, "updateTxWorkflowPreviewFromEditor");
  return true;
}

function externalActionIsCurrent(
  actionContext: ExternalActionContext | null = null,
): boolean {
  return (
    typeof actionContext?.isCurrent !== "function" || actionContext.isCurrent()
  );
}

function runOwnedEditorMutation(
  actionContext: ExternalActionContext | null,
  operation: () => unknown,
): unknown {
  if (typeof actionContext?.runOwnedEditorMutation === "function") {
    return actionContext.runOwnedEditorMutation(operation);
  }
  return typeof operation === "function" ? operation() : undefined;
}

async function importTxWorkflowFromFileWithDependencies(
  txJsonEditorsHost: unknown = null,
  dependencies: DependencyMap = {},
  file: TextFile | null,
  actionContext: ExternalActionContext | null = null,
): Promise<null | void> {
  if (!file) throw new Error(tr("txWorkflowImportFileInvalid"));
  const text = await file.text();
  if (!externalActionIsCurrent(actionContext)) return null;
  callObjectFunction(txJsonEditorsHost, "setTxWorkflowEditorText", text, {
    notify: false,
  });
  if (
    !normalizeTxWorkflowJsonFromEditor(
      txJsonEditorsHost,
      dependencies,
      actionContext,
    )
  ) {
    return null;
  }
  callOptionalTxDependency(dependencies, "updateTxWorkflowPreviewFromEditor");
  if (!externalActionIsCurrent(actionContext)) return null;
  setStatus(
    TX_OUTPUT.txWorkflowPlan,
    tr("txWorkflowImportFileDone"),
    "success",
  );
}

async function importTxBlockFromFileWithDependencies(
  txJsonEditorsHost: unknown = null,
  file: TextFile | null,
  actionContext: ExternalActionContext | null = null,
): Promise<null | void> {
  if (!file) throw new Error(tr("txBlockImportFileInvalid"));
  const text = await file.text();
  if (!externalActionIsCurrent(actionContext)) return null;
  try {
    const txBlock: unknown = JSON.parse(text);
    if (!txBlock || typeof txBlock !== "object" || Array.isArray(txBlock)) {
      throw new Error(tr("txBlockJsonInvalidShape"));
    }
    if (!externalActionIsCurrent(actionContext)) return null;
    runOwnedEditorMutation(actionContext, () =>
      callObjectFunction(txJsonEditorsHost, "setTxBlockEditorJson", txBlock),
    );
  } catch (error) {
    if (!externalActionIsCurrent(actionContext)) return null;
    runOwnedEditorMutation(actionContext, () =>
      callObjectFunction(txJsonEditorsHost, "setTxBlockEditorText", text, {
        notify: true,
      }),
    );
    throw error;
  }
  if (!externalActionIsCurrent(actionContext)) return null;
  setStatus(TX_OUTPUT.txBlockPlan, tr("txBlockImportFileDone"), "success");
}

async function importOrchestrationFromFileWithDependencies(
  txJsonEditorsHost: unknown = null,
  file: TextFile | null,
  actionContext: ExternalActionContext | null = null,
): Promise<null | void> {
  if (!file) throw new Error(tr("orchestrationImportFileInvalid"));
  const text = await file.text();
  if (!externalActionIsCurrent(actionContext)) return null;
  try {
    const plan: unknown = JSON.parse(text);
    if (!externalActionIsCurrent(actionContext)) return null;
    runOwnedEditorMutation(actionContext, () =>
      callObjectFunction(txJsonEditorsHost, "setOrchestrationEditorJson", plan),
    );
  } catch {
    if (!externalActionIsCurrent(actionContext)) return null;
    runOwnedEditorMutation(actionContext, () =>
      callObjectFunction(
        txJsonEditorsHost,
        "setOrchestrationEditorText",
        text,
        {
          notify: true,
        },
      ),
    );
  }
  if (!externalActionIsCurrent(actionContext)) return null;
  setStatus(
    TX_OUTPUT.orchestrationPlan,
    tr("orchestrationImportFileDone"),
    "success",
  );
}

async function previewOrchestrationWithDependencies(
  dependencies: DependencyMap = {},
): Promise<void> {
  setRunningStatus(TX_OUTPUT.orchestrationPlan);
  try {
    const orchestrationPreviewPayload = objectValue(
      await executeOrchestration(
        orchestrationExecutionPayload({ dependencies, dryRun: true }),
      ),
    );
    callOptionalTxDependency(
      dependencies,
      "setOrchestrationPreview",
      orchestrationPreviewPayload?.plan || {},
      null,
    );
    setStatus(
      TX_OUTPUT.orchestrationPlan,
      tr("orchestrationPreviewDone"),
      "success",
    );
    clearTransactionOutput(TX_OUTPUT.orchestrationExec);
  } catch (error) {
    setErrorStatus(TX_OUTPUT.orchestrationPlan, error);
    setDependencyVisualError(
      dependencies,
      TX_VISUAL.orchestrationPreview,
      errorMessage(error),
    );
  }
}

async function executeOrchestrationRunWithDependencies(
  dependencies: DependencyMap = {},
): Promise<void> {
  setRunningStatus(TX_OUTPUT.orchestrationExec);
  try {
    const orchestrationRunPayload = objectValue(
      await executeOrchestration(
        orchestrationExecutionPayload({ dependencies, dryRun: false }),
      ),
    );
    callOptionalTxDependency(
      dependencies,
      "setOrchestrationPreview",
      orchestrationRunPayload?.plan || {},
      orchestrationRunPayload?.orchestration_result || {},
    );
  } catch (error) {
    setErrorStatus(TX_OUTPUT.orchestrationExec, error);
  }
}

async function runTxBlockWithDependencies(
  dependencies: DependencyMap = {},
  dryRun: boolean,
  output: unknown,
): Promise<void> {
  if (!ensureTarget(dependencies)) return;
  setTxExecutionModes({ txBlock: "direct" });
  const payload = txBlockExecutionPayload({ dependencies, dryRun });
  if (
    !payload.tx_block ||
    typeof payload.tx_block !== "object" ||
    Array.isArray(payload.tx_block)
  ) {
    throw new Error(tr("txBlockJsonInvalidShape"));
  }
  setRunningStatus(output);
  const txBlockPayload = objectValue(await executeTxBlock(payload));
  callOptionalTxDependency(
    dependencies,
    "setTxBlockVisual",
    txBlockPayload?.tx_block || {},
    dryRun ? null : txBlockPayload?.tx_result || {},
  );
  if (dryRun) {
    setStatus(output, tr("txBlockPreviewDone"), "success");
    clearTransactionOutput(TX_OUTPUT.txBlockExec);
    return;
  }
  setStatus(output, tr("txBlockExecuteDone"), "success");
  applyRecording(txBlockPayload);
}

async function previewTxWorkflowWithDependencies(
  dependencies: DependencyMap = {},
): Promise<void> {
  if (!ensureTarget(dependencies)) return;
  setRunningStatus(TX_OUTPUT.txWorkflowPlan);
  try {
    const workflowPreviewPayload = objectValue(
      await executeTxWorkflow(
        txWorkflowExecutionPayload({ dependencies, dryRun: true }),
      ),
    );
    callOptionalTxDependency(
      dependencies,
      "setTxWorkflowPreview",
      workflowPreviewPayload?.workflow || {},
    );
    setStatus(TX_OUTPUT.txWorkflowPlan, tr("txWorkflowPreviewDone"), "success");
  } catch (error) {
    setErrorStatus(TX_OUTPUT.txWorkflowPlan, error);
    setDependencyVisualError(
      dependencies,
      TX_VISUAL.txWorkflowPreview,
      errorMessage(error),
    );
  }
}

async function executeWorkflowWithDependencies(
  dependencies: DependencyMap = {},
): Promise<void> {
  if (!ensureTarget(dependencies)) return;
  setRunningStatus(TX_OUTPUT.txWorkflowExec);
  try {
    const workflowExecutionPayload = objectValue(
      await executeTxWorkflow(
        txWorkflowExecutionPayload({ dependencies, dryRun: false }),
      ),
    );
    setTxWorkflowExecutionResult(
      workflowExecutionPayload?.tx_workflow_result || {},
    );
    callOptionalTxDependency(
      dependencies,
      "showToast",
      tr("txWorkflowExecuteDone"),
      "success",
    );
    applyRecording(workflowExecutionPayload);
  } catch (error) {
    setErrorStatus(TX_OUTPUT.txWorkflowExec, error);
  }
}

export function orchestratedExecutionOperations({
  txJsonEditorsHost = null,
  dependencies = {},
}: OrchestratedExecutionOperationsOptions = {}) {
  return {
    executeOrchestration: () =>
      executeOrchestrationRunWithDependencies(dependencies),
    importTxBlockFile: (
      file: TextFile | null,
      actionContext: ExternalActionContext | null = null,
    ) =>
      importTxBlockFromFileWithDependencies(
        txJsonEditorsHost,
        file,
        actionContext,
      ),
    executeTxWorkflow: () => executeWorkflowWithDependencies(dependencies),
    importOrchestrationFile: (
      file: TextFile | null,
      actionContext: ExternalActionContext | null = null,
    ) =>
      importOrchestrationFromFileWithDependencies(
        txJsonEditorsHost,
        file,
        actionContext,
      ),
    importTxWorkflowFile: (
      file: TextFile | null,
      actionContext: ExternalActionContext | null = null,
    ) =>
      importTxWorkflowFromFileWithDependencies(
        txJsonEditorsHost,
        dependencies,
        file,
        actionContext,
      ),
    previewOrchestration: () =>
      previewOrchestrationWithDependencies(dependencies),
    previewTxWorkflow: () => previewTxWorkflowWithDependencies(dependencies),
    runTxBlock: (dryRun: boolean, output: unknown) =>
      runTxBlockWithDependencies(dependencies, dryRun, output),
  };
}

export function createOrchestratedExecutionDependencies({
  setOrchestrationPreview,
  setTxBlockVisual,
  setTxWorkflowPreview,
  setVisualOutputStatus,
  updateOrchestrationPreviewFromEditor,
  updateTxWorkflowPreviewFromEditor,
}: OrchestratedExecutionDependencyInput = {}): DependencyMap {
  return {
    connectionPayload: connectionPayloadFromConnections,
    ensureConnectionTargetSelected,
    recordLevelPayload: recordLevelPayloadFromOverlays,
    setOrchestrationPreview,
    setTxBlockVisual,
    setTxWorkflowPreview,
    setVisualOutputStatus,
    showToast,
    updateOrchestrationPreviewFromEditor,
    updateTxWorkflowPreviewFromEditor,
  };
}
