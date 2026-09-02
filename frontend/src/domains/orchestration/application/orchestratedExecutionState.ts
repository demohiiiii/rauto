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
import type { ConnectionRequestPayload } from "$domains/connections/index.js";
import {
  applyRecordDrawerRecording,
  recordLevelPayload as recordLevelPayloadFromOverlays,
} from "$domains/overlays/index.js";
import { showToast } from "$domains/overlays/index.js";
import type { OverlayToastTone, RecordLevel } from "$domains/overlays/index.js";
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
import type { TxJsonEditorsHost } from "$domains/transactions/index.js";
import type {
  OrchestrationExecutionResult,
  OrchestrationJsonObject,
  OrchestrationJsonValue,
  OrchestrationPlan,
} from "../model/types.js";

interface ExternalActionContext {
  isCurrent?: () => boolean;
  runOwnedEditorMutation?: (operation: () => void) => void;
}

interface TextFile {
  text(): Promise<string>;
}

interface ExecutionPayloadOptions {
  dependencies: OrchestratedExecutionDependencies;
  dryRun: boolean;
}

interface OrchestratedExecutionOperationsOptions {
  dependencies?: OrchestratedExecutionDependencies;
  txJsonEditorsHost?: TxJsonEditorsHost | null;
}

export interface OrchestratedExecutionDependencies {
  connectionPayload(): ConnectionRequestPayload;
  ensureConnectionTargetSelected(): boolean;
  recordLevelPayload(): RecordLevel;
  setOrchestrationPreview?: (
    plan: OrchestrationPlan,
    result: OrchestrationExecutionResult | null,
  ) => void;
  setTxBlockVisual?: (
    txBlock: OrchestrationJsonValue,
    txResult: OrchestrationJsonValue | null,
  ) => void;
  setTxWorkflowPreview?: (workflow: OrchestrationJsonValue) => void;
  setVisualOutputStatus?: (
    output: string,
    message: string,
    tone: string,
  ) => void;
  showToast?: (message: string, tone: OverlayToastTone) => void;
  updateOrchestrationPreviewFromEditor?: () => void;
  updateTxWorkflowPreviewFromEditor?: () => void;
}

type OrchestratedExecutionDependencyInput = Partial<
  Pick<
    OrchestratedExecutionDependencies,
    | "setOrchestrationPreview"
    | "setTxBlockVisual"
    | "setTxWorkflowPreview"
    | "setVisualOutputStatus"
    | "updateOrchestrationPreviewFromEditor"
    | "updateTxWorkflowPreviewFromEditor"
  >
>;

interface JsonTemplateConfig {
  apiBase: string;
  emptyKey: string;
  nameRequiredKey: string;
  newPromptKey: string;
  runEditor: string;
  runOutput: string;
}

const errorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String(error.message)
    : String(error || "");

function tr(key: string, fallback = key): string {
  return translate(key, fallback);
}

function applyRecording(recordingPayload: {
  recording_jsonl: string | null;
}): void {
  applyRecordDrawerRecording(recordingPayload);
}

function setDependencyVisualError(
  dependencies: OrchestratedExecutionDependencies,
  output: string,
  message: string,
): void {
  dependencies.setVisualOutputStatus?.(output, message, "error");
}

const connectionPayload = (
  dependencies: OrchestratedExecutionDependencies,
): ConnectionRequestPayload => dependencies.connectionPayload();

const recordLevelPayload = (
  dependencies: OrchestratedExecutionDependencies,
): RecordLevel => dependencies.recordLevelPayload();

const txBlockEditorRaw = (): string =>
  requireTxJsonEditor("txBlockEditorRaw")().trim();

const txWorkflowEditorRaw = (): string =>
  requireTxJsonEditor("txWorkflowEditorRaw")().trim();

const orchestrationEditorRaw = (): string =>
  requireTxJsonEditor("orchestrationEditorRaw")().trim();

const parseTxBlockEditorJson = (): OrchestrationJsonObject =>
  requireTxJsonEditor("parseTxBlockEditorJson")() as OrchestrationJsonObject;

function txVarsRawText(varsKey: string): string {
  const rawText = get(txVarsTextStateFor(varsKey))?.raw;
  return rawText || "";
}

function txVarsJsonObject(varsKey: string): OrchestrationJsonObject {
  const raw = txVarsRawText(varsKey).trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as OrchestrationJsonObject)
    : {};
}

export function jsonTemplateConfigFor(kind: string): JsonTemplateConfig | null {
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
  return configs[kind] || null;
}

function txBlockExecutionPayload({
  dependencies,
  dryRun,
}: ExecutionPayloadOptions) {
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
}: ExecutionPayloadOptions) {
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
}: ExecutionPayloadOptions) {
  return orchestrationInlineExecutionPayload({
    connection: connectionPayload(dependencies),
    dryRun,
    planText: orchestrationEditorRaw(),
    planVars: txVarsJsonObject(TX_VARS.orchestrationDirect),
    recordLevel: recordLevelPayload(dependencies),
  });
}

function normalizeTxWorkflowJsonFromEditor(
  txJsonEditorsHost: TxJsonEditorsHost | null = null,
  dependencies: OrchestratedExecutionDependencies,
  actionContext: ExternalActionContext | null = null,
): boolean {
  const raw = txWorkflowEditorRaw();
  if (!raw) return false;
  const workflow: unknown = JSON.parse(raw);
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    throw new Error(tr("txWorkflowLoadInvalidJsonShape"));
  }
  if (!externalActionIsCurrent(actionContext)) return false;
  runOwnedEditorMutation(actionContext, () => {
    txJsonEditorsHost?.setTxWorkflowEditorJson(
      workflow as OrchestrationJsonObject,
    );
  });
  dependencies.updateTxWorkflowPreviewFromEditor?.();
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
  operation: () => void,
): void {
  if (typeof actionContext?.runOwnedEditorMutation === "function") {
    actionContext.runOwnedEditorMutation(operation);
    return;
  }
  operation();
}

async function importTxWorkflowFromFileWithDependencies(
  txJsonEditorsHost: TxJsonEditorsHost | null,
  dependencies: OrchestratedExecutionDependencies,
  file: TextFile | null,
  actionContext: ExternalActionContext | null = null,
): Promise<null | void> {
  if (!file) throw new Error(tr("txWorkflowImportFileInvalid"));
  const text = await file.text();
  if (!externalActionIsCurrent(actionContext)) return null;
  txJsonEditorsHost?.setTxWorkflowEditorText(text, {
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
  dependencies.updateTxWorkflowPreviewFromEditor?.();
  if (!externalActionIsCurrent(actionContext)) return null;
  setStatus(
    TX_OUTPUT.txWorkflowPlan,
    tr("txWorkflowImportFileDone"),
    "success",
  );
}

async function importTxBlockFromFileWithDependencies(
  txJsonEditorsHost: TxJsonEditorsHost | null,
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
    runOwnedEditorMutation(actionContext, () => {
      txJsonEditorsHost?.setTxBlockEditorJson(
        txBlock as OrchestrationJsonObject,
      );
    });
  } catch (error) {
    if (!externalActionIsCurrent(actionContext)) return null;
    runOwnedEditorMutation(actionContext, () => {
      txJsonEditorsHost?.setTxBlockEditorText(text, {
        notify: true,
      });
    });
    throw error;
  }
  if (!externalActionIsCurrent(actionContext)) return null;
  setStatus(TX_OUTPUT.txBlockPlan, tr("txBlockImportFileDone"), "success");
}

async function importOrchestrationFromFileWithDependencies(
  txJsonEditorsHost: TxJsonEditorsHost | null,
  file: TextFile | null,
  actionContext: ExternalActionContext | null = null,
): Promise<null | void> {
  if (!file) throw new Error(tr("orchestrationImportFileInvalid"));
  const text = await file.text();
  if (!externalActionIsCurrent(actionContext)) return null;
  try {
    const plan: unknown = JSON.parse(text);
    if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
      throw new Error(tr("orchestrationJsonRequired"));
    }
    if (!externalActionIsCurrent(actionContext)) return null;
    runOwnedEditorMutation(actionContext, () => {
      txJsonEditorsHost?.setOrchestrationEditorJson(
        plan as OrchestrationJsonObject,
      );
    });
  } catch (error) {
    if (!externalActionIsCurrent(actionContext)) return null;
    runOwnedEditorMutation(actionContext, () => {
      txJsonEditorsHost?.setOrchestrationEditorText(text, { notify: true });
    });
    throw error;
  }
  if (!externalActionIsCurrent(actionContext)) return null;
  setStatus(
    TX_OUTPUT.orchestrationPlan,
    tr("orchestrationImportFileDone"),
    "success",
  );
}

async function previewOrchestrationWithDependencies(
  dependencies: OrchestratedExecutionDependencies,
): Promise<void> {
  setRunningStatus(TX_OUTPUT.orchestrationPlan);
  try {
    const orchestrationPreviewPayload = await executeOrchestration(
      orchestrationExecutionPayload({ dependencies, dryRun: true }),
    );
    dependencies.setOrchestrationPreview?.(
      orchestrationPreviewPayload.plan,
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
  dependencies: OrchestratedExecutionDependencies,
): Promise<void> {
  setRunningStatus(TX_OUTPUT.orchestrationExec);
  try {
    const orchestrationRunPayload = await executeOrchestration(
      orchestrationExecutionPayload({ dependencies, dryRun: false }),
    );
    dependencies.setOrchestrationPreview?.(
      orchestrationRunPayload.plan,
      orchestrationRunPayload.orchestration_result,
    );
  } catch (error) {
    setErrorStatus(TX_OUTPUT.orchestrationExec, error);
  }
}

async function runTxBlockWithDependencies(
  dependencies: OrchestratedExecutionDependencies,
  dryRun: boolean,
  output: string,
): Promise<void> {
  if (!dependencies.ensureConnectionTargetSelected()) return;
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
  const txBlockPayload = await executeTxBlock(payload);
  dependencies.setTxBlockVisual?.(
    txBlockPayload.tx_block,
    dryRun ? null : txBlockPayload.tx_result,
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
  dependencies: OrchestratedExecutionDependencies,
): Promise<void> {
  if (!dependencies.ensureConnectionTargetSelected()) return;
  setRunningStatus(TX_OUTPUT.txWorkflowPlan);
  try {
    const workflowPreviewPayload = await executeTxWorkflow(
      txWorkflowExecutionPayload({ dependencies, dryRun: true }),
    );
    dependencies.setTxWorkflowPreview?.(workflowPreviewPayload.workflow);
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
  dependencies: OrchestratedExecutionDependencies,
): Promise<void> {
  if (!dependencies.ensureConnectionTargetSelected()) return;
  setRunningStatus(TX_OUTPUT.txWorkflowExec);
  try {
    const workflowExecutionPayload = await executeTxWorkflow(
      txWorkflowExecutionPayload({ dependencies, dryRun: false }),
    );
    setTxWorkflowExecutionResult(workflowExecutionPayload.tx_workflow_result);
    dependencies.showToast?.(tr("txWorkflowExecuteDone"), "success");
    applyRecording(workflowExecutionPayload);
  } catch (error) {
    setErrorStatus(TX_OUTPUT.txWorkflowExec, error);
  }
}

export function orchestratedExecutionOperations({
  txJsonEditorsHost = null,
  dependencies = createOrchestratedExecutionDependencies(),
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
    runTxBlock: (dryRun: boolean, output: string) =>
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
}: OrchestratedExecutionDependencyInput = {}): OrchestratedExecutionDependencies {
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
