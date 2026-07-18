import { t } from "../lib/i18n.js";
import { displayText, workflowChipClass } from "../lib/ui.js";

const ORCHESTRATION_COMMAND_PREVIEW_LIMIT = 24;

function orchestrationText(displaySource) {
  return displayText(displaySource);
}

const orchestrationSummaryCard = (key, summaryValue) => ({
  label: t(key),
  summaryValue,
});

const orchestrationChip = (chipText) => ({
  chipClass: workflowChipClass(),
  chipText,
});

function orchestrationPrimitiveText(jsonValue) {
  if (jsonValue == null) return "null";
  if (typeof jsonValue === "string") return jsonValue;
  if (typeof jsonValue === "number" || typeof jsonValue === "boolean") {
    return String(jsonValue);
  }
  return orchestrationText(jsonValue);
}

function orchestrationRawJsonText(jsonValue) {
  if (jsonValue == null) return "-";
  try {
    return JSON.stringify(jsonValue, null, 2);
  } catch {
    return orchestrationText(jsonValue);
  }
}

function orchestrationJsonTreeNode(jsonValue, nodeLabel = "value", depth = 0) {
  if (jsonValue == null || typeof jsonValue !== "object") {
    return {
      depth,
      kind: "primitive",
      label: orchestrationText(nodeLabel),
      showPrimitive: true,
      valueText: orchestrationPrimitiveText(jsonValue),
    };
  }

  if (Array.isArray(jsonValue)) {
    return {
      children: jsonValue.map((arrayValue, index) =>
        orchestrationJsonTreeNode(arrayValue, `[${index}]`, depth + 1),
      ),
      countText: `[${jsonValue.length}]`,
      depth,
      emptyText: "[]",
      hasChildren: jsonValue.length > 0,
      kind: "array",
      label: orchestrationText(nodeLabel),
      open: depth <= 1,
      showPrimitive: false,
    };
  }

  const objectEntries = Object.entries(jsonValue);
  return {
    children: objectEntries.map(([objectKey, objectValue]) =>
      orchestrationJsonTreeNode(objectValue, objectKey, depth + 1),
    ),
    countText: `{${objectEntries.length}}`,
    depth,
    emptyText: "{}",
    hasChildren: objectEntries.length > 0,
    kind: "object",
    label: orchestrationText(nodeLabel),
    open: depth <= 1,
    showPrimitive: false,
  };
}

export function orchestrationJsonDisplay(jsonValue) {
  return {
    rawText: orchestrationRawJsonText(jsonValue),
    rawToggleLabel: t("orchestrationPayloadRawToggle"),
    tree: orchestrationJsonTreeNode(jsonValue, "payload", 0),
  };
}

function orchestrationOperationDescription(operation) {
  if (!operation || typeof operation !== "object") return "";
  if (operation.kind === "command" || operation.command != null) {
    return orchestrationText(operation.command).trim();
  }
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    const first = orchestrationText(steps[0]?.command).trim();
    if (!steps.length) return "flow";
    if (steps.length === 1) return first || "flow";
    return first
      ? `${first} ... (${steps.length} steps)`
      : `${steps.length} steps`;
  }
  return "";
}

function orchestrationOperationText(operation) {
  if (!operation || typeof operation !== "object") return "";
  const text = orchestrationText(
    orchestrationOperationDescription(operation),
  ).trim();
  if (text) return text;
  if (typeof operation.command === "string") return operation.command.trim();
  if (operation.kind === "flow" && Array.isArray(operation.steps)) {
    const first = orchestrationText(operation.steps[0]?.command).trim();
    if (first) return first;
    return `${operation.steps.length} steps`;
  }
  return "";
}

function collectTxBlockCommandPreview(block, prefix = "") {
  if (!block || typeof block !== "object") return [];
  const steps = Array.isArray(block.steps) ? block.steps : [];
  const commandPreviewLines = [];
  steps.forEach((step, idx) => {
    const run = step && typeof step === "object" ? step.run : null;
    const commandText = orchestrationOperationText(run);
    if (!commandText) return;
    const head = prefix ? `${prefix} ` : "";
    commandPreviewLines.push(`${head}step[${idx}] ${commandText}`);
  });
  return commandPreviewLines;
}

function collectTxWorkflowCommandPreview(workflow) {
  if (!workflow || typeof workflow !== "object") return [];
  const blocks = Array.isArray(workflow.blocks) ? workflow.blocks : [];
  const commandPreviewLines = [];
  blocks.forEach((block, blockIdx) => {
    if (
      block &&
      typeof block.tx_block_template_name === "string" &&
      block.tx_block_template_name.trim()
    ) {
      commandPreviewLines.push(
        `[block ${blockIdx}] ${t("orchestrationCommandPreviewTemplateRef")}: tx_block_template=${block.tx_block_template_name.trim()}`,
      );
      return;
    }
    commandPreviewLines.push(
      ...collectTxBlockCommandPreview(block, `block[${blockIdx}]`),
    );
  });
  return commandPreviewLines;
}

function txWorkflowActionPreviewItems(action) {
  if (action.workflow && typeof action.workflow === "object") {
    return collectTxWorkflowCommandPreview(action.workflow);
  }
  if (
    typeof action.workflow_template_name === "string" &&
    action.workflow_template_name.trim()
  ) {
    return [
      `${t("orchestrationCommandPreviewTemplateRef")}: workflow_template=${action.workflow_template_name.trim()}`,
    ];
  }
  return [];
}

function orchestrationActionCommandPreviewItems(action) {
  if (!action || typeof action !== "object") return [];
  if (action.kind === "tx_workflow") {
    return txWorkflowActionPreviewItems(action);
  }
  return [];
}

function orchestrationActionField(label, detailValue, fieldCfg = {}) {
  return {
    detailValue: orchestrationText(detailValue || "-"),
    label,
    mono: !!fieldCfg.mono,
  };
}

function orchestrationActionSummaryFields(action) {
  if (!action || typeof action !== "object") {
    return [orchestrationActionField(t("orchestrationStageAction"), "-")];
  }
  if (action.kind === "tx_workflow") {
    const fields = [
      orchestrationActionField("kind", "tx_workflow", { mono: true }),
    ];
    if (action.workflow_template_name) {
      fields.push(
        orchestrationActionField(
          "workflow_template",
          action.workflow_template_name,
          { mono: true },
        ),
      );
    } else if (action.workflow && typeof action.workflow === "object") {
      fields.push(orchestrationActionField("workflow", "inline"));
    }
    return fields;
  }
  return [
    orchestrationActionField(
      t("orchestrationStageAction"),
      orchestrationText(action.kind || "-"),
    ),
  ];
}

function orchestrationTargetPreviewLabel(target) {
  if (typeof target === "string") return target;
  if (target && typeof target === "object") {
    return target.name || target.connection || target.host || "target";
  }
  return "";
}

function resolveOrchestrationJobTargetsPreview(job) {
  const labels = [];
  const groupNames = Array.isArray(job && job.target_groups)
    ? job.target_groups
    : [];
  labels.push(
    ...groupNames.map(
      (groupName) => `${t("inventoryFieldGroups")}: ${groupName}`,
    ),
  );
  const targetTags = Array.isArray(job && job.target_tags)
    ? job.target_tags
    : [];
  labels.push(
    ...targetTags.map((tagName) => `${t("inventoryFieldLabels")}: ${tagName}`),
  );
  const directTargets = Array.isArray(job && job.targets) ? job.targets : [];
  for (const directTarget of directTargets) {
    const targetLabel = orchestrationTargetPreviewLabel(directTarget);
    if (targetLabel) labels.push(orchestrationText(targetLabel));
  }
  return labels;
}

function resolveOrchestrationStageTargetsPreview(stage) {
  const jobs = Array.isArray(stage && stage.jobs) ? stage.jobs : [];
  return jobs.flatMap((job) => resolveOrchestrationJobTargetsPreview(job));
}

function orchestrationStageStrategyLabel(strategy) {
  return orchestrationText(strategy || "serial") === "parallel"
    ? t("orchestrationStrategyParallel")
    : t("orchestrationStrategySerial");
}

const orchestrationPreviewStages = (plan) =>
  Array.isArray(plan?.stages) ? plan.stages : [];

function orchestrationCommandPreviewDisplay(action) {
  const commandPreviewLines = orchestrationActionCommandPreviewItems(action);
  const overflowCount = Math.max(
    0,
    commandPreviewLines.length - ORCHESTRATION_COMMAND_PREVIEW_LIMIT,
  );
  return {
    emptyMessage: t("orchestrationCommandPreviewEmpty"),
    hasLines: commandPreviewLines.length > 0,
    lines: commandPreviewLines.slice(0, ORCHESTRATION_COMMAND_PREVIEW_LIMIT),
    overflowCount,
    overflowText:
      overflowCount > 0
        ? `${t("orchestrationCommandPreviewMorePrefix")}${overflowCount}`
        : "",
    showOverflow: overflowCount > 0,
    titleText: t("orchestrationCommandPreviewTitle"),
  };
}

function orchestrationPreviewJobRow(job, index = 0) {
  const targetGroups = Array.isArray(job?.target_groups)
    ? job.target_groups
    : [];
  const targetTags = Array.isArray(job?.target_tags) ? job.target_tags : [];
  const targetLabels = resolveOrchestrationJobTargetsPreview(job);
  const name = orchestrationText(job?.name || "");
  const strategyLabel = orchestrationText(
    orchestrationStageStrategyLabel(job?.strategy),
  );
  const targetCount = targetLabels.length;
  const actionFields = orchestrationActionSummaryFields(job?.action);
  return {
    actionFields,
    chipRows: [
      orchestrationChip(`${t("orchestrationStageStrategy")}: ${strategyLabel}`),
      orchestrationChip(`${t("orchestrationStageTargets")}: ${targetCount}`),
    ],
    commandPreview: orchestrationCommandPreviewDisplay(job?.action),
    hasTargetGroups: targetGroups.length > 0,
    hasTargetLabels: targetLabels.length > 0,
    hasTargetTags: targetTags.length > 0,
    noTargetText: "-",
    strategyLabel,
    targetChipRows: targetLabels.map(orchestrationChip),
    targetCount,
    targetGroupsLineText: `${t("inventoryFieldGroups")}: ${targetGroups.join(", ")}`,
    targetGroupsText: targetGroups.join(", "),
    targetTagsLineText: `${t("inventoryFieldLabels")}: ${targetTags.join(", ")}`,
    targetTagsText: targetTags.join(", "),
    title: name || "-",
    titleText: `job[${index}] ${name || "-"}`,
  };
}

function orchestrationPreviewStageRow(stage, index) {
  const jobs = Array.isArray(stage?.jobs) ? stage.jobs : [];
  const name = orchestrationText(stage?.name);
  const label = name ? `stage[${index}] ${name}` : `stage[${index}]`;
  const targetLabels = resolveOrchestrationStageTargetsPreview(stage);
  const strategyLabel = orchestrationText(
    orchestrationStageStrategyLabel(stage?.strategy),
  );
  return {
    hasJobs: jobs.length > 0,
    hasTargetLabels: targetLabels.length > 0,
    jobCount: jobs.length,
    jobs: jobs.map((job, jobIndex) =>
      orchestrationPreviewJobRow(job, jobIndex),
    ),
    label,
    noJobsText: "-",
    noTargetText: "-",
    outlineChipRows: [
      orchestrationChip(`${t("orchestrationStageStrategy")}: ${strategyLabel}`),
      orchestrationChip(`${t("orchestrationStageJobs")}: ${jobs.length}`),
    ],
    strategyLabel,
    summaryChipRows: [
      orchestrationChip(`${t("orchestrationStageStrategy")}: ${strategyLabel}`),
      orchestrationChip(
        `${t("orchestrationStageTargets")}: ${targetLabels.length}`,
      ),
      orchestrationChip(`${t("orchestrationStageJobs")}: ${jobs.length}`),
    ],
    targetChipRows: targetLabels.map(orchestrationChip),
    targetCount: targetLabels.length,
  };
}

export function orchestrationPreviewPresentation(plan = null) {
  const hasPlan = Boolean(plan && typeof plan === "object");
  const stages = hasPlan ? orchestrationPreviewStages(plan) : [];
  const stageRows = stages.map((stage, index) =>
    orchestrationPreviewStageRow(stage, index),
  );
  const failFast = String(plan?.fail_fast !== false);
  const jobCount = stageRows.reduce((total, row) => total + row.jobCount, 0);
  const name = plan?.name || "-";
  const stageCount = stageRows.length;
  return {
    emptyMessage: t("orchestrationVisualEmpty"),
    hasPlan,
    hasStageRows: stageRows.length > 0,
    jobCount,
    stageOutlineJobChip: orchestrationChip(
      `${t("orchestrationStageJobs")}: ${jobCount}`,
    ),
    stageOutlineTitle: t("orchestrationVisualStages"),
    stageRows,
    summaryCards: [
      orchestrationSummaryCard("orchestrationVisualName", name),
      orchestrationSummaryCard("orchestrationVisualStages", stageCount),
      orchestrationSummaryCard("orchestrationVisualFailFast", failFast),
      orchestrationSummaryCard("orchestrationStageJobs", jobCount),
    ],
    titleText: t("orchestrationVisualTitle"),
  };
}
