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

function parseOrchestrationJsonObjectSafely(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  try {
    const jsonValue = JSON.parse(text);
    return jsonValue && typeof jsonValue === "object" ? jsonValue : null;
  } catch {
    return null;
  }
}

function parseInlineFlowTemplateCommands(content) {
  if (typeof content !== "string" || !content.trim()) return [];
  const commands = [];
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("command")) continue;
    const match = line.match(/^command\s*=\s*"(.*)"\s*$/);
    if (match && match[1]) commands.push(match[1]);
  }
  return commands;
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
  if (operation.kind === "template") {
    const templateName = orchestrationText(operation.template?.name).trim();
    const defaultMode = orchestrationText(
      operation.runtime?.default_mode,
    ).trim();
    if (templateName && defaultMode) return `${templateName} (${defaultMode})`;
    return templateName || "template";
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
  if (operation.kind === "template" && operation.template) {
    return orchestrationText(operation.template.name || "template").trim();
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

function txBlockActionPreviewItems(action) {
  if (Array.isArray(action.commands) && action.commands.length) {
    return action.commands
      .map((cmd, idx) => `step[${idx}] ${orchestrationText(cmd).trim()}`)
      .filter((line) => !line.endsWith(" "));
  }
  if (typeof action.template === "string" && action.template.trim()) {
    return [
      `${t("orchestrationCommandPreviewTemplateRef")}: template=${action.template.trim()}`,
    ];
  }
  if (
    typeof action.tx_block_template_content === "string" &&
    action.tx_block_template_content.trim()
  ) {
    const inlineBlock = parseOrchestrationJsonObjectSafely(
      action.tx_block_template_content,
    );
    if (inlineBlock) return collectTxBlockCommandPreview(inlineBlock);
  }
  if (
    typeof action.flow_template_content === "string" &&
    action.flow_template_content.trim()
  ) {
    const flowCommands = parseInlineFlowTemplateCommands(
      action.flow_template_content,
    );
    if (flowCommands.length) {
      return flowCommands.map((cmd, idx) => `step[${idx}] ${cmd}`);
    }
  }
  if (
    typeof action.flow_template_name === "string" &&
    action.flow_template_name.trim()
  ) {
    return [
      `${t("orchestrationCommandPreviewTemplateRef")}: flow_template=${action.flow_template_name.trim()}`,
    ];
  }
  if (
    typeof action.tx_block_template_name === "string" &&
    action.tx_block_template_name.trim()
  ) {
    return [
      `${t("orchestrationCommandPreviewTemplateRef")}: tx_block_template=${action.tx_block_template_name.trim()}`,
    ];
  }
  return [];
}

function txWorkflowActionPreviewItems(action) {
  if (action.workflow && typeof action.workflow === "object") {
    return collectTxWorkflowCommandPreview(action.workflow);
  }
  if (
    typeof action.workflow_template_content === "string" &&
    action.workflow_template_content.trim()
  ) {
    const inlineWorkflow = parseOrchestrationJsonObjectSafely(
      action.workflow_template_content,
    );
    if (inlineWorkflow) return collectTxWorkflowCommandPreview(inlineWorkflow);
  }
  if (
    typeof action.workflow_template_name === "string" &&
    action.workflow_template_name.trim()
  ) {
    return [
      `${t("orchestrationCommandPreviewTemplateRef")}: workflow_template=${action.workflow_template_name.trim()}`,
    ];
  }
  if (typeof action.workflow_file === "string" && action.workflow_file.trim()) {
    return [
      `${t("orchestrationCommandPreviewTemplateRef")}: workflow_file=${action.workflow_file.trim()}`,
    ];
  }
  return [];
}

function orchestrationActionCommandPreviewItems(action) {
  if (!action || typeof action !== "object") return [];
  if (action.kind === "tx_block") return txBlockActionPreviewItems(action);
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
  if (action.kind === "tx_block") {
    const fields = [
      orchestrationActionField("kind", "tx_block", { mono: true }),
    ];
    const flowTemplateName = orchestrationText(action.flow_template_name || "");
    const flowTemplateContent = orchestrationText(
      action.flow_template_content || "",
    );
    if (flowTemplateName) {
      fields.push(
        orchestrationActionField("flow_template", flowTemplateName, {
          mono: true,
        }),
      );
    } else if (flowTemplateContent) {
      fields.push(orchestrationActionField("flow_template_content", "inline"));
    }
    if (
      action.flow_vars &&
      typeof action.flow_vars === "object" &&
      !Array.isArray(action.flow_vars)
    ) {
      fields.push(
        orchestrationActionField(
          "flow_vars",
          String(Object.keys(action.flow_vars).length),
        ),
      );
    }
    if (action.template) {
      fields.push(
        orchestrationActionField("template", action.template, { mono: true }),
      );
    }
    if (Array.isArray(action.commands) && action.commands.length) {
      fields.push(orchestrationActionField("commands", action.commands.length));
    }
    if (action.tx_block_template_name) {
      fields.push(
        orchestrationActionField(
          "tx_block_template",
          action.tx_block_template_name,
          { mono: true },
        ),
      );
    } else if (action.tx_block_template_content) {
      fields.push(
        orchestrationActionField("tx_block_template_content", "inline"),
      );
    }
    if (action.mode) {
      fields.push(
        orchestrationActionField("mode", action.mode, { mono: true }),
      );
    }
    return fields;
  }
  if (action.kind === "tx_workflow") {
    const fields = [
      orchestrationActionField("kind", "tx_workflow", { mono: true }),
    ];
    if (action.workflow) {
      fields.push(orchestrationActionField("workflow", "inline"));
    }
    if (action.workflow_template_name) {
      fields.push(
        orchestrationActionField(
          "workflow_template",
          action.workflow_template_name,
          { mono: true },
        ),
      );
    } else if (action.workflow_template_content) {
      fields.push(
        orchestrationActionField("workflow_template_content", "inline"),
      );
    } else if (action.workflow_file) {
      fields.push(
        orchestrationActionField("workflow_file", action.workflow_file, {
          mono: true,
        }),
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

function inventoryGroupTargets(group) {
  if (Array.isArray(group)) return group;
  if (group && typeof group === "object" && Array.isArray(group.targets)) {
    return group.targets;
  }
  return [];
}

function orchestrationTargetPreviewLabel(target) {
  if (typeof target === "string") return target;
  if (target && typeof target === "object") {
    return target.name || target.connection || target.host || "target";
  }
  return "";
}

function resolveOrchestrationJobTargetsPreview(job, inventory) {
  const labels = [];
  const groups =
    inventory && inventory.groups && typeof inventory.groups === "object"
      ? inventory.groups
      : {};
  const groupNames = Array.isArray(job && job.target_groups)
    ? job.target_groups
    : [];
  for (const groupName of groupNames) {
    const group = groups[groupName];
    for (const inventoryTarget of inventoryGroupTargets(group)) {
      const targetLabel = orchestrationTargetPreviewLabel(inventoryTarget);
      if (targetLabel) labels.push(targetLabel);
    }
  }
  const directTargets = Array.isArray(job && job.targets) ? job.targets : [];
  for (const directTarget of directTargets) {
    const targetLabel = orchestrationTargetPreviewLabel(directTarget);
    if (targetLabel) labels.push(orchestrationText(targetLabel));
  }
  return labels;
}

function resolveOrchestrationStageTargetsPreview(stage, inventory) {
  const jobs = Array.isArray(stage && stage.jobs) ? stage.jobs : [];
  return jobs.flatMap((job) =>
    resolveOrchestrationJobTargetsPreview(job, inventory),
  );
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

function orchestrationPreviewGroupCount(inventory) {
  if (!inventory?.groups || typeof inventory.groups !== "object") return 0;
  return Object.keys(inventory.groups).length;
}

function orchestrationPreviewJobRow(job, inventory, index = 0) {
  const targetGroups = Array.isArray(job?.target_groups)
    ? job.target_groups
    : [];
  const targetTags = Array.isArray(job?.target_tags) ? job.target_tags : [];
  const targetLabels = resolveOrchestrationJobTargetsPreview(job, inventory);
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

function orchestrationPreviewStageRow(stage, index, inventory) {
  const jobs = Array.isArray(stage?.jobs) ? stage.jobs : [];
  const name = orchestrationText(stage?.name);
  const label = name ? `stage[${index}] ${name}` : `stage[${index}]`;
  const targetLabels = resolveOrchestrationStageTargetsPreview(
    stage,
    inventory,
  );
  const strategyLabel = orchestrationText(
    orchestrationStageStrategyLabel(stage?.strategy),
  );
  return {
    hasJobs: jobs.length > 0,
    hasTargetLabels: targetLabels.length > 0,
    jobCount: jobs.length,
    jobs: jobs.map((job, jobIndex) =>
      orchestrationPreviewJobRow(job, inventory, jobIndex),
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

export function orchestrationPreviewPresentation(
  plan = null,
  inventory = null,
) {
  const hasPlan = Boolean(plan && typeof plan === "object");
  const stages = hasPlan ? orchestrationPreviewStages(plan) : [];
  const stageRows = stages.map((stage, index) =>
    orchestrationPreviewStageRow(stage, index, inventory),
  );
  const failFast = String(plan?.fail_fast !== false);
  const groupCount = orchestrationPreviewGroupCount(inventory);
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
      orchestrationSummaryCard("orchestrationVisualGroups", groupCount),
      orchestrationSummaryCard("orchestrationStageJobs", jobCount),
    ],
    titleText: t("orchestrationVisualTitle"),
  };
}
