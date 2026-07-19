import { get } from "svelte/store";

import {
  executeOrchestration,
  executeTxBlock,
  executeTxWorkflow,
} from "../../api/client.js";
import { tr as translate } from "../../lib/i18n.js";
import {
  connectionPayload as connectionPayloadFromConnections,
  ensureConnectionTargetSelected,
} from "../connections/connections.js";
import {
  applyRecordDrawerRecording,
  recordLevelPayload as recordLevelPayloadFromOverlays,
  showToast,
} from "../overlays/overlays.js";
import { defaultTxBlockTemplatePayload } from "../transactions/transactionBlockFormModels.js";
import { defaultTxWorkflowTemplatePayload } from "../transactions/transactionWorkflowFormModels.js";
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
} from "../transactions/transactionPanelState.js";

function tr(key, fallback = key) {
  return translate(key, fallback);
}

function callObjectFunction(target, name, ...args) {
  return typeof target?.[name] === "function"
    ? target[name](...args)
    : undefined;
}

function transactionText(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function requireTxDependency(dependencies, dependencyName) {
  const dependency = dependencies[dependencyName];
  if (typeof dependency !== "function") {
    throw new Error(`${dependencyName} is not ready`);
  }
  return dependency;
}

function ensureTarget(dependencies) {
  const ensureTargetSelected = dependencies.ensureConnectionTargetSelected;
  if (!ensureTargetSelected) return true;
  return ensureTargetSelected();
}

function applyRecording(recordingPayload) {
  applyRecordDrawerRecording(recordingPayload);
}

function setDependencyVisualError(dependencies, output, message) {
  callObjectFunction(
    dependencies,
    "setVisualOutputStatus",
    output,
    message,
    "error",
  );
}

const connectionPayload = (dependencies) =>
  requireTxDependency(dependencies, "connectionPayload")();

const recordLevelPayload = (dependencies) =>
  requireTxDependency(dependencies, "recordLevelPayload")();

function callOptionalTxDependency(dependencies, dependencyName, ...args) {
  const dependency = dependencies[dependencyName];
  return typeof dependency === "function" ? dependency(...args) : undefined;
}

const txBlockEditorRaw = () => requireTxJsonEditor("txBlockEditorRaw")().trim();

const txWorkflowEditorRaw = () =>
  requireTxJsonEditor("txWorkflowEditorRaw")().trim();

const orchestrationEditorRaw = () =>
  requireTxJsonEditor("orchestrationEditorRaw")().trim();

const parseTxBlockEditorJson = () =>
  requireTxJsonEditor("parseTxBlockEditorJson")();

function txVarsRawText(varsKey) {
  const rawText = get(txVarsTextStateFor(varsKey))?.raw;
  if (rawText == null) return "";
  return typeof rawText === "string" ? rawText : String(rawText);
}

function txVarsJsonObject(varsKey) {
  const raw = txVarsRawText(varsKey).trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

export function defaultOrchestrationTemplatePayload() {
  return {
    name: "campus-rollout-demo",
    fail_fast: true,
    rollback_on_stage_failure: true,
    rollback_completed_stages_on_failure: false,
    stages: [
      {
        name: "deploy-phase",
        strategy: "parallel",
        max_parallel: 2,
        jobs: [
          {
            name: "transfer-image",
            strategy: "serial",
            target_groups: ["edge_nodes"],
            target_tags: ["edge"],
            action: {
              kind: "tx_block",
              name: "scp-transfer",
              flow_template_name: "scp",
              flow_vars: {
                peer: "edge94",
                local_path: "/tmp/app.tar",
                remote_path: "/tmp/app.tar",
              },
              timeout_secs: 1200,
            },
          },
          {
            name: "precheck",
            strategy: "parallel",
            max_parallel: 4,
            target_groups: ["edge_nodes"],
            action: {
              kind: "tx_block",
              tx_block_template_name: "precheck",
              tx_block_template_vars: {},
            },
          },
          {
            name: "deploy",
            strategy: "parallel",
            max_parallel: 4,
            target_groups: ["edge_nodes"],
            action: {
              kind: "tx_workflow",
              workflow_template_name: "safe-deploy",
              workflow_vars: {},
            },
          },
        ],
      },
    ],
  };
}

export function jsonTemplateConfigFor(kind) {
  const configs = {
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

export function txBlockInlineExecutionPayload({
  connection,
  dryRun,
  recordLevel,
  txBlock = {},
  txBlockVars = {},
} = {}) {
  return {
    connection,
    dry_run: dryRun,
    record_level: recordLevel,
    tx_block: txBlock,
    tx_block_template_content: null,
    tx_block_template_name: null,
    tx_block_template_vars:
      txBlockVars &&
      typeof txBlockVars === "object" &&
      !Array.isArray(txBlockVars)
        ? txBlockVars
        : {},
  };
}

function txBlockExecutionPayload({ dependencies, dryRun }) {
  return txBlockInlineExecutionPayload({
    connection: connectionPayload(dependencies),
    dryRun,
    recordLevel: recordLevelPayload(dependencies),
    txBlock: parseTxBlockEditorJson(),
    txBlockVars: txVarsJsonObject(TX_VARS.txBlockDirect),
  });
}

export function txWorkflowInlineExecutionPayload({
  connection,
  dryRun,
  recordLevel,
  workflowText = "",
  workflowVars = {},
} = {}) {
  const raw = transactionText(workflowText).trim();
  if (!raw) {
    throw new Error(tr("txWorkflowJsonRequired"));
  }
  return {
    connection,
    dry_run: dryRun,
    record_level: recordLevel,
    workflow: JSON.parse(raw),
    workflow_template_content: null,
    workflow_template_name: null,
    workflow_vars:
      workflowVars &&
      typeof workflowVars === "object" &&
      !Array.isArray(workflowVars)
        ? workflowVars
        : {},
  };
}

function txWorkflowExecutionPayload({ dependencies, dryRun }) {
  return txWorkflowInlineExecutionPayload({
    connection: connectionPayload(dependencies),
    dryRun,
    recordLevel: recordLevelPayload(dependencies),
    workflowText: txWorkflowEditorRaw(),
    workflowVars: txVarsJsonObject(TX_VARS.txWorkflowDirect),
  });
}

export function orchestrationInlineExecutionPayload({
  connection,
  dryRun,
  planText = "",
  planVars = {},
  recordLevel,
} = {}) {
  const raw = transactionText(planText).trim();
  if (!raw) {
    throw new Error(tr("orchestrationJsonRequired"));
  }
  return {
    base_dir: null,
    connection,
    dry_run: dryRun,
    plan: JSON.parse(raw),
    plan_template_content: null,
    plan_template_name: null,
    plan_vars:
      planVars && typeof planVars === "object" && !Array.isArray(planVars)
        ? planVars
        : {},
    record_level: recordLevel,
  };
}

function orchestrationExecutionPayload({ dependencies, dryRun }) {
  return orchestrationInlineExecutionPayload({
    connection: connectionPayload(dependencies),
    dryRun,
    planText: orchestrationEditorRaw(),
    planVars: txVarsJsonObject(TX_VARS.orchestrationDirect),
    recordLevel: recordLevelPayload(dependencies),
  });
}

function normalizeTxWorkflowJsonFromEditor(
  txJsonEditorsHost = null,
  dependencies = {},
  actionContext = null,
) {
  const raw = txWorkflowEditorRaw();
  if (!raw) return false;
  const workflow = JSON.parse(raw);
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

function externalActionIsCurrent(actionContext = null) {
  return (
    typeof actionContext?.isCurrent !== "function" || actionContext.isCurrent()
  );
}

function runOwnedEditorMutation(actionContext, operation) {
  if (typeof actionContext?.runOwnedEditorMutation === "function") {
    return actionContext.runOwnedEditorMutation(operation);
  }
  return typeof operation === "function" ? operation() : undefined;
}

async function importTxWorkflowFromFileWithDependencies(
  txJsonEditorsHost = null,
  dependencies = {},
  file,
  actionContext = null,
) {
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
  txJsonEditorsHost = null,
  file,
  actionContext = null,
) {
  if (!file) throw new Error(tr("txBlockImportFileInvalid"));
  const text = await file.text();
  if (!externalActionIsCurrent(actionContext)) return null;
  try {
    const txBlock = JSON.parse(text);
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
  txJsonEditorsHost = null,
  file,
  actionContext = null,
) {
  if (!file) throw new Error(tr("orchestrationImportFileInvalid"));
  const text = await file.text();
  if (!externalActionIsCurrent(actionContext)) return null;
  try {
    const plan = JSON.parse(text);
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

async function previewOrchestrationWithDependencies(dependencies = {}) {
  setRunningStatus(TX_OUTPUT.orchestrationPlan);
  try {
    const orchestrationPreviewPayload = await executeOrchestration(
      orchestrationExecutionPayload({ dependencies, dryRun: true }),
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
      error.message,
    );
  }
}

async function executeOrchestrationRunWithDependencies(dependencies = {}) {
  setRunningStatus(TX_OUTPUT.orchestrationExec);
  try {
    const orchestrationRunPayload = await executeOrchestration(
      orchestrationExecutionPayload({ dependencies, dryRun: false }),
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

async function runTxBlockWithDependencies(dependencies = {}, dryRun, output) {
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
  const txBlockPayload = await executeTxBlock(payload);
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

async function previewTxWorkflowWithDependencies(dependencies = {}) {
  if (!ensureTarget(dependencies)) return;
  setRunningStatus(TX_OUTPUT.txWorkflowPlan);
  try {
    const workflowPreviewPayload = await executeTxWorkflow(
      txWorkflowExecutionPayload({ dependencies, dryRun: true }),
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
      error.message,
    );
  }
}

async function executeWorkflowWithDependencies(dependencies = {}) {
  if (!ensureTarget(dependencies)) return;
  setRunningStatus(TX_OUTPUT.txWorkflowExec);
  try {
    const workflowExecutionPayload = await executeTxWorkflow(
      txWorkflowExecutionPayload({ dependencies, dryRun: false }),
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
} = {}) {
  return {
    executeOrchestration: () =>
      executeOrchestrationRunWithDependencies(dependencies),
    importTxBlockFile: (file, actionContext = null) =>
      importTxBlockFromFileWithDependencies(
        txJsonEditorsHost,
        file,
        actionContext,
      ),
    executeTxWorkflow: () => executeWorkflowWithDependencies(dependencies),
    importOrchestrationFile: (file, actionContext = null) =>
      importOrchestrationFromFileWithDependencies(
        txJsonEditorsHost,
        file,
        actionContext,
      ),
    importTxWorkflowFile: (file, actionContext = null) =>
      importTxWorkflowFromFileWithDependencies(
        txJsonEditorsHost,
        dependencies,
        file,
        actionContext,
      ),
    previewOrchestration: () =>
      previewOrchestrationWithDependencies(dependencies),
    previewTxWorkflow: () => previewTxWorkflowWithDependencies(dependencies),
    runTxBlock: (dryRun, output) =>
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
} = {}) {
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

export {
  TX_EDITOR,
  TX_OUTPUT,
  TX_TEMPLATE_KIND,
  TX_VISUAL,
  TX_VARS,
  defaultTxBlockTemplatePayload,
  defaultTxWorkflowTemplatePayload,
};
