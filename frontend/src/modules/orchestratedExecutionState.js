import { get } from "svelte/store";

import {
  executeOrchestration,
  executeTxBlock,
  executeTxWorkflow,
} from "../api/client.js";
import { tr as translate } from "../lib/i18n.js";
import {
  connectionPayload as connectionPayloadFromConnections,
  ensureConnectionTargetSelected,
} from "./connections.js";
import {
  applyRecordDrawerRecording,
  recordLevelPayload as recordLevelPayloadFromOverlays,
  showToast,
} from "./overlays.js";
import { defaultTxBlockTemplatePayload } from "./transactionBlockFormModels.js";
import { defaultTxWorkflowTemplatePayload } from "./transactionWorkflowFormModels.js";
import {
  TX_EDITOR,
  TX_OUTPUT,
  TX_TEMPLATE_KIND,
  TX_VISUAL,
  TX_VARS,
  clearTransactionOutput,
  getTxExecutionModes,
  jsonTemplateSelectValue,
  requireTxJsonEditor,
  setErrorStatus,
  setStatus,
  setRunningStatus,
  setTxExecutionModes,
  setTxWorkflowExecutionResult,
  setVisualOutputStatus,
  txVarsTextStateFor,
} from "./transactionPanelState.js";

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
    inventory: {
      groups: {
        edge_nodes: {
          defaults: { vars: { site: "dc-a" } },
          targets: [{ name: "edge-01", connection: "edge-01" }],
        },
      },
    },
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

function txBlockExecutionPayload({ dependencies, dryRun, mode }) {
  if (mode === "template") {
    const content = txBlockEditorRaw();
    if (!content) {
      throw new Error(tr("txBlockJsonRequired"));
    }
    return {
      connection: connectionPayload(dependencies),
      dry_run: dryRun,
      record_level: recordLevelPayload(dependencies),
      tx_block: null,
      tx_block_template_content: content,
      tx_block_template_name: null,
      tx_block_template_vars: txVarsJsonObject(TX_VARS.txBlockTemplate),
    };
  }
  return {
    connection: connectionPayload(dependencies),
    dry_run: dryRun,
    record_level: recordLevelPayload(dependencies),
    tx_block: parseTxBlockEditorJson(),
    tx_block_template_content: null,
    tx_block_template_name: null,
    tx_block_template_vars: txVarsJsonObject(TX_VARS.txBlockDirect),
  };
}

function txWorkflowExecutionPayload({ dependencies, dryRun }) {
  const templateMode = getTxExecutionModes().txWorkflow === "template";
  const workflowTemplateName = templateMode
    ? jsonTemplateSelectValue(TX_TEMPLATE_KIND.txWorkflow)
    : "";
  const raw = templateMode ? "" : txWorkflowEditorRaw();
  if (templateMode && !workflowTemplateName) {
    throw new Error(tr("txWorkflowTemplateNameRequired"));
  }
  if (!templateMode && !raw) {
    throw new Error(tr("txWorkflowJsonRequired"));
  }
  return {
    connection: connectionPayload(dependencies),
    dry_run: dryRun,
    record_level: recordLevelPayload(dependencies),
    workflow: raw ? JSON.parse(raw) : {},
    workflow_template_content: null,
    workflow_template_name: workflowTemplateName || null,
    workflow_vars: txVarsJsonObject(
      templateMode ? TX_VARS.txWorkflowTemplate : TX_VARS.txWorkflowDirect,
    ),
  };
}

function orchestrationExecutionPayload({ dependencies, dryRun }) {
  const templateMode = getTxExecutionModes().orchestration === "template";
  const planTemplateName = templateMode
    ? jsonTemplateSelectValue(TX_TEMPLATE_KIND.orchestration)
    : "";
  const raw = templateMode ? "" : orchestrationEditorRaw();
  if (templateMode && !planTemplateName) {
    throw new Error(tr("orchestrationTemplateNameRequired"));
  }
  if (!templateMode && !raw) {
    throw new Error(tr("orchestrationJsonRequired"));
  }
  return {
    base_dir: null,
    connection: connectionPayload(dependencies),
    dry_run: dryRun,
    plan: raw ? JSON.parse(raw) : {},
    plan_template_content: null,
    plan_template_name: planTemplateName || null,
    plan_vars: txVarsJsonObject(
      templateMode
        ? TX_VARS.orchestrationTemplate
        : TX_VARS.orchestrationDirect,
    ),
    record_level: recordLevelPayload(dependencies),
  };
}

function normalizeTxWorkflowJsonFromEditor(
  txJsonEditorsHost = null,
  dependencies = {},
) {
  const raw = txWorkflowEditorRaw();
  if (!raw) return;
  const workflow = JSON.parse(raw);
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    throw new Error(tr("txWorkflowLoadInvalidJsonShape"));
  }
  callObjectFunction(txJsonEditorsHost, "setTxWorkflowEditorJson", workflow);
  callOptionalTxDependency(dependencies, "updateTxWorkflowPreviewFromEditor");
}

async function importTxWorkflowFromFileWithDependencies(
  txJsonEditorsHost = null,
  dependencies = {},
  file,
) {
  if (!file) throw new Error(tr("txWorkflowImportFileInvalid"));
  const text = await file.text();
  callObjectFunction(txJsonEditorsHost, "setTxWorkflowEditorText", text, {
    notify: false,
  });
  normalizeTxWorkflowJsonFromEditor(txJsonEditorsHost, dependencies);
  callOptionalTxDependency(dependencies, "updateTxWorkflowPreviewFromEditor");
  setStatus(
    TX_OUTPUT.txWorkflowPlan,
    tr("txWorkflowImportFileDone"),
    "success",
  );
}

async function importOrchestrationFromFileWithDependencies(
  txJsonEditorsHost = null,
  file,
) {
  if (!file) throw new Error(tr("orchestrationImportFileInvalid"));
  const text = await file.text();
  try {
    callObjectFunction(
      txJsonEditorsHost,
      "setOrchestrationEditorJson",
      JSON.parse(text),
    );
  } catch {
    callObjectFunction(txJsonEditorsHost, "setOrchestrationEditorText", text, {
      notify: true,
    });
  }
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
      orchestrationPreviewPayload?.inventory || {},
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
      orchestrationRunPayload?.inventory || {},
      orchestrationRunPayload?.orchestration_result || {},
    );
  } catch (error) {
    setErrorStatus(TX_OUTPUT.orchestrationExec, error);
  }
}

async function runTxBlockWithDependencies(
  dependencies = {},
  mode,
  dryRun,
  output,
) {
  if (!ensureTarget(dependencies)) return;
  setTxExecutionModes({ txBlock: mode });
  const payload = txBlockExecutionPayload({ dependencies, dryRun, mode });
  if (
    mode === "template" &&
    !transactionText(payload.tx_block_template_content).trim()
  ) {
    throw new Error(tr("txBlockJsonRequired"));
  }
  if (
    mode === "direct" &&
    (!payload.tx_block ||
      typeof payload.tx_block !== "object" ||
      Array.isArray(payload.tx_block))
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
    executeTxWorkflow: () => executeWorkflowWithDependencies(dependencies),
    importOrchestrationFile: (file) =>
      importOrchestrationFromFileWithDependencies(txJsonEditorsHost, file),
    importTxWorkflowFile: (file) =>
      importTxWorkflowFromFileWithDependencies(
        txJsonEditorsHost,
        dependencies,
        file,
      ),
    previewOrchestration: () =>
      previewOrchestrationWithDependencies(dependencies),
    previewTxWorkflow: () => previewTxWorkflowWithDependencies(dependencies),
    runTxBlock: (mode, dryRun, output) =>
      runTxBlockWithDependencies(dependencies, mode, dryRun, output),
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
