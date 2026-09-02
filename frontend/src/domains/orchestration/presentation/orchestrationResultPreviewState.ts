import { t } from "../../../lib/i18n.js";
import { displayText, workflowChipClass } from "../../../lib/ui.js";

const ORCHESTRATION_COMMAND_PREVIEW_LIMIT = 24;

interface JsonTreeNode {
  children?: JsonTreeNode[];
  countText?: string;
  depth: number;
  emptyText?: string;
  hasChildren?: boolean;
  kind: "array" | "object" | "primitive";
  label: string;
  open?: boolean;
  showPrimitive: boolean;
  valueText?: string;
}

export interface OrchestrationPreviewActionField {
  detailValue: string;
  label: string;
  mono: boolean;
}

export interface OrchestrationPreviewChip {
  chipClass: string;
  chipText: string;
}

export interface OrchestrationCommandPreview {
  emptyMessage: string;
  hasLines: boolean;
  lines: string[];
  overflowCount: number;
  overflowText: string;
  showOverflow: boolean;
  titleText: string;
}

export interface OrchestrationPreviewJobRow {
  actionFields: OrchestrationPreviewActionField[];
  chipRows: OrchestrationPreviewChip[];
  commandPreview: OrchestrationCommandPreview;
  hasTargetGroups: boolean;
  hasTargetLabels: boolean;
  hasTargetTags: boolean;
  noTargetText: string;
  strategyLabel: string;
  targetChipRows: OrchestrationPreviewChip[];
  targetCount: number;
  targetGroupsLineText: string;
  targetGroupsText: string;
  targetTagsLineText: string;
  targetTagsText: string;
  title: string;
  titleText: string;
}

export interface OrchestrationPreviewStageRow {
  hasJobs: boolean;
  hasTargetLabels: boolean;
  jobCount: number;
  jobs: OrchestrationPreviewJobRow[];
  label: string;
  noJobsText: string;
  noTargetText: string;
  outlineChipRows: OrchestrationPreviewChip[];
  strategyLabel: string;
  summaryChipRows: OrchestrationPreviewChip[];
  targetChipRows: OrchestrationPreviewChip[];
  targetCount: number;
}

const orchestrationDisplayText = displayText as (value: unknown) => string;
const orchestrationWorkflowChipClass = workflowChipClass as (
  ...toneClasses: string[]
) => string;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function orchestrationText(displaySource: unknown): string {
  return orchestrationDisplayText(displaySource);
}

const orchestrationSummaryCard = (key: string, summaryValue: unknown) => ({
  label: t(key),
  summaryValue,
});

const orchestrationChip = (chipText: string): OrchestrationPreviewChip => ({
  chipClass: orchestrationWorkflowChipClass(),
  chipText,
});

function orchestrationPrimitiveText(jsonValue: unknown): string {
  if (jsonValue == null) return "null";
  if (typeof jsonValue === "string") return jsonValue;
  if (typeof jsonValue === "number" || typeof jsonValue === "boolean") {
    return String(jsonValue);
  }
  return orchestrationText(jsonValue);
}

function orchestrationRawJsonText(jsonValue: unknown): string {
  if (jsonValue == null) return "-";
  try {
    return JSON.stringify(jsonValue, null, 2);
  } catch {
    return orchestrationText(jsonValue);
  }
}

function orchestrationJsonTreeNode(
  jsonValue: unknown,
  nodeLabel: unknown = "value",
  depth = 0,
): JsonTreeNode {
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
    children: objectEntries.map(([objectKey, objectEntryValue]) =>
      orchestrationJsonTreeNode(objectEntryValue, objectKey, depth + 1),
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

export function orchestrationJsonDisplay(jsonValue: unknown) {
  return {
    rawText: orchestrationRawJsonText(jsonValue),
    rawToggleLabel: t("orchestrationPayloadRawToggle"),
    tree: orchestrationJsonTreeNode(jsonValue, "payload", 0),
  };
}

function orchestrationOperationDescription(operation: unknown): string {
  const operationValue = objectValue(operation);
  if (!Object.keys(operationValue).length) return "";
  if (operationValue.kind === "command" || operationValue.command != null) {
    return orchestrationText(operationValue.command).trim();
  }
  if (operationValue.kind === "flow") {
    const steps = Array.isArray(operationValue.steps)
      ? operationValue.steps
      : [];
    const first = orchestrationText(objectValue(steps[0]).command).trim();
    if (!steps.length) return "flow";
    if (steps.length === 1) return first || "flow";
    return first
      ? `${first} ... (${steps.length} steps)`
      : `${steps.length} steps`;
  }
  return "";
}

function orchestrationOperationText(operation: unknown): string {
  const operationValue = objectValue(operation);
  if (!Object.keys(operationValue).length) return "";
  const text = orchestrationText(
    orchestrationOperationDescription(operationValue),
  ).trim();
  if (text) return text;
  if (typeof operationValue.command === "string") {
    return operationValue.command.trim();
  }
  if (operationValue.kind === "flow" && Array.isArray(operationValue.steps)) {
    const first = orchestrationText(
      objectValue(operationValue.steps[0]).command,
    ).trim();
    if (first) return first;
    return `${operationValue.steps.length} steps`;
  }
  return "";
}

function collectTxBlockCommandPreview(block: unknown, prefix = ""): string[] {
  const blockValue = objectValue(block);
  const steps = Array.isArray(blockValue.steps) ? blockValue.steps : [];
  const commandPreviewLines: string[] = [];
  steps.forEach((step, index) => {
    const run = objectValue(step).run;
    const commandText = orchestrationOperationText(run);
    if (!commandText) return;
    const head = prefix ? `${prefix} ` : "";
    commandPreviewLines.push(`${head}step[${index}] ${commandText}`);
  });
  return commandPreviewLines;
}

function collectTxWorkflowCommandPreview(workflow: unknown): string[] {
  const workflowValue = objectValue(workflow);
  const blocks = Array.isArray(workflowValue.blocks)
    ? workflowValue.blocks
    : [];
  const commandPreviewLines: string[] = [];
  blocks.forEach((block, blockIndex) => {
    const blockValue = objectValue(block);
    if (
      typeof blockValue.tx_block_template_name === "string" &&
      blockValue.tx_block_template_name.trim()
    ) {
      commandPreviewLines.push(
        `[block ${blockIndex}] ${t("orchestrationCommandPreviewTemplateRef")}: tx_block_template=${blockValue.tx_block_template_name.trim()}`,
      );
      return;
    }
    commandPreviewLines.push(
      ...collectTxBlockCommandPreview(blockValue, `block[${blockIndex}]`),
    );
  });
  return commandPreviewLines;
}

function txWorkflowActionPreviewItems(action: unknown): string[] {
  const actionValue = objectValue(action);
  if (actionValue.workflow && typeof actionValue.workflow === "object") {
    return collectTxWorkflowCommandPreview(actionValue.workflow);
  }
  if (
    typeof actionValue.workflow_template_name === "string" &&
    actionValue.workflow_template_name.trim()
  ) {
    return [
      `${t("orchestrationCommandPreviewTemplateRef")}: workflow_template=${actionValue.workflow_template_name.trim()}`,
    ];
  }
  return [];
}

function orchestrationActionCommandPreviewItems(action: unknown): string[] {
  const actionValue = objectValue(action);
  return actionValue.kind === "tx_workflow"
    ? txWorkflowActionPreviewItems(actionValue)
    : [];
}

function orchestrationActionField(
  label: string,
  detailValue: unknown,
  { mono = false }: { mono?: boolean } = {},
): OrchestrationPreviewActionField {
  return {
    detailValue: orchestrationText(detailValue || "-"),
    label,
    mono,
  };
}

function orchestrationActionSummaryFields(
  action: object,
): OrchestrationPreviewActionField[] {
  const actionValue = objectValue(action);
  if (!Object.keys(actionValue).length) {
    return [orchestrationActionField(t("orchestrationStageAction"), "-")];
  }
  if (actionValue.kind === "tx_workflow") {
    const fields = [
      orchestrationActionField("kind", "tx_workflow", { mono: true }),
    ];
    if (actionValue.workflow_template_name) {
      fields.push(
        orchestrationActionField(
          "workflow_template",
          actionValue.workflow_template_name,
          { mono: true },
        ),
      );
    } else if (
      actionValue.workflow &&
      typeof actionValue.workflow === "object"
    ) {
      fields.push(orchestrationActionField("workflow", "inline"));
    }
    return fields;
  }
  return [
    orchestrationActionField(
      t("orchestrationStageAction"),
      orchestrationText(actionValue.kind || "-"),
    ),
  ];
}

function orchestrationTargetPreviewLabel(target: unknown): unknown {
  if (typeof target === "string") return target;
  if (target && typeof target === "object") {
    const targetValue = objectValue(target);
    return (
      targetValue.name || targetValue.connection || targetValue.host || "target"
    );
  }
  return "";
}

function resolveOrchestrationJobTargetsPreview(job: unknown): string[] {
  const jobValue = objectValue(job);
  const labels: string[] = [];
  const groupNames = Array.isArray(jobValue.target_groups)
    ? jobValue.target_groups
    : [];
  labels.push(
    ...groupNames.map(
      (groupName) => `${t("inventoryFieldGroups")}: ${groupName}`,
    ),
  );
  const targetTags = Array.isArray(jobValue.target_tags)
    ? jobValue.target_tags
    : [];
  labels.push(
    ...targetTags.map((tagName) => `${t("inventoryFieldLabels")}: ${tagName}`),
  );
  const directTargets = Array.isArray(jobValue.targets) ? jobValue.targets : [];
  for (const directTarget of directTargets) {
    const targetLabel = orchestrationTargetPreviewLabel(directTarget);
    if (targetLabel) labels.push(orchestrationText(targetLabel));
  }
  return labels;
}

function resolveOrchestrationStageTargetsPreview(stage: unknown): string[] {
  const jobs = objectValue(stage).jobs;
  return (Array.isArray(jobs) ? jobs : []).flatMap((job) =>
    resolveOrchestrationJobTargetsPreview(job),
  );
}

function orchestrationStageStrategyLabel(strategy: unknown): string {
  return orchestrationText(strategy || "serial") === "parallel"
    ? t("orchestrationStrategyParallel")
    : t("orchestrationStrategySerial");
}

function orchestrationPreviewStages(plan: unknown): unknown[] {
  const stages = objectValue(plan).stages;
  return Array.isArray(stages) ? stages : [];
}

function orchestrationCommandPreviewDisplay(
  action: unknown,
): OrchestrationCommandPreview {
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

function orchestrationPreviewJobRow(
  job: object,
  index = 0,
): OrchestrationPreviewJobRow {
  const jobValue = objectValue(job);
  const targetGroups = Array.isArray(jobValue.target_groups)
    ? jobValue.target_groups
    : [];
  const targetTags = Array.isArray(jobValue.target_tags)
    ? jobValue.target_tags
    : [];
  const targetLabels = resolveOrchestrationJobTargetsPreview(jobValue);
  const name = orchestrationText(jobValue.name || "");
  const strategyLabel = orchestrationText(
    orchestrationStageStrategyLabel(jobValue.strategy),
  );
  const targetCount = targetLabels.length;
  const actionFields = orchestrationActionSummaryFields(
    objectValue(jobValue.action),
  );
  return {
    actionFields,
    chipRows: [
      orchestrationChip(`${t("orchestrationStageStrategy")}: ${strategyLabel}`),
      orchestrationChip(`${t("orchestrationStageTargets")}: ${targetCount}`),
    ],
    commandPreview: orchestrationCommandPreviewDisplay(jobValue.action),
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

function orchestrationPreviewStageRow(
  stage: unknown,
  index: number,
): OrchestrationPreviewStageRow {
  const stageValue = objectValue(stage);
  const jobs = Array.isArray(stageValue.jobs) ? stageValue.jobs : [];
  const name = orchestrationText(stageValue.name);
  const label = name ? `stage[${index}] ${name}` : `stage[${index}]`;
  const targetLabels = resolveOrchestrationStageTargetsPreview(stageValue);
  const strategyLabel = orchestrationText(
    orchestrationStageStrategyLabel(stageValue.strategy),
  );
  return {
    hasJobs: jobs.length > 0,
    hasTargetLabels: targetLabels.length > 0,
    jobCount: jobs.length,
    jobs: jobs.map((job, jobIndex) =>
      orchestrationPreviewJobRow(objectValue(job), jobIndex),
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

export function orchestrationPreviewPresentation(plan: unknown = null) {
  const hasPlan = Boolean(plan && typeof plan === "object");
  const planValue = objectValue(plan);
  const stages = hasPlan ? orchestrationPreviewStages(planValue) : [];
  const stageRows = stages.map((stage, index) =>
    orchestrationPreviewStageRow(stage, index),
  );
  const failFast = String(planValue.fail_fast !== false);
  const jobCount = stageRows.reduce((total, row) => total + row.jobCount, 0);
  const name = planValue.name || "-";
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
