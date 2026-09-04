import { t } from "../../../lib/i18n.js";
import { displayText, workflowChipClass } from "../../../lib/ui.js";
import type {
  OrchestrationJob,
  OrchestrationJsonObject,
  OrchestrationJsonPrimitive,
  OrchestrationJsonValue,
  OrchestrationPlan,
  OrchestrationStage,
  OrchestrationStrategy,
  OrchestrationTxWorkflowAction,
} from "../model/types.js";

const ORCHESTRATION_COMMAND_PREVIEW_LIMIT = 24;

export interface OrchestrationJsonTreeNode {
  children?: OrchestrationJsonTreeNode[];
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

type DisplayValue = OrchestrationJsonValue | undefined;

const orchestrationDisplayText = displayText as (value: DisplayValue) => string;
const orchestrationWorkflowChipClass = workflowChipClass as (
  ...toneClasses: string[]
) => string;

function orchestrationJsonObjectValue(
  value: OrchestrationJsonValue | undefined,
): OrchestrationJsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function orchestrationText(displaySource: DisplayValue): string {
  return orchestrationDisplayText(displaySource);
}

const orchestrationSummaryCard = (key: string, summaryValue: DisplayValue) => ({
  label: t(key),
  summaryValue,
});

const orchestrationChip = (chipText: string): OrchestrationPreviewChip => ({
  chipClass: orchestrationWorkflowChipClass(),
  chipText,
});

function orchestrationPrimitiveText(
  jsonValue: OrchestrationJsonPrimitive,
): string {
  if (jsonValue === null) return "null";
  if (typeof jsonValue === "string") return jsonValue;
  if (typeof jsonValue === "number" || typeof jsonValue === "boolean") {
    return String(jsonValue);
  }
  return jsonValue;
}

function orchestrationRawJsonText(jsonValue: OrchestrationJsonValue): string {
  if (jsonValue == null) return "-";
  return JSON.stringify(jsonValue, null, 2);
}

function orchestrationJsonTreeNode(
  jsonValue: OrchestrationJsonValue,
  nodeLabel = "value",
  depth = 0,
): OrchestrationJsonTreeNode {
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

export function orchestrationJsonDisplay(
  jsonValue: OrchestrationJsonValue = null,
) {
  return {
    rawText: orchestrationRawJsonText(jsonValue),
    rawToggleLabel: t("orchestrationPayloadRawToggle"),
    tree: orchestrationJsonTreeNode(jsonValue, "payload", 0),
  };
}

function orchestrationOperationDescription(
  operation: OrchestrationJsonValue | undefined,
): string {
  const operationValue = orchestrationJsonObjectValue(operation);
  if (!Object.keys(operationValue).length) return "";
  if (operationValue.kind === "command" || operationValue.command != null) {
    return orchestrationText(operationValue.command).trim();
  }
  if (operationValue.kind === "flow") {
    const steps = Array.isArray(operationValue.steps)
      ? operationValue.steps
      : [];
    const first = orchestrationText(
      orchestrationJsonObjectValue(steps[0]).command,
    ).trim();
    if (!steps.length) return "flow";
    if (steps.length === 1) return first || "flow";
    return first
      ? `${first} ... (${steps.length} steps)`
      : `${steps.length} steps`;
  }
  return "";
}

function orchestrationOperationText(
  operation: OrchestrationJsonValue | undefined,
): string {
  const operationValue = orchestrationJsonObjectValue(operation);
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
      orchestrationJsonObjectValue(operationValue.steps[0]).command,
    ).trim();
    if (first) return first;
    return `${operationValue.steps.length} steps`;
  }
  return "";
}

function collectTxBlockCommandPreview(
  block: OrchestrationJsonValue,
  prefix = "",
): string[] {
  const blockValue = orchestrationJsonObjectValue(block);
  const steps = Array.isArray(blockValue.steps) ? blockValue.steps : [];
  const commandPreviewLines: string[] = [];
  steps.forEach((step, index) => {
    const run = orchestrationJsonObjectValue(step).run;
    const commandText = orchestrationOperationText(run);
    if (!commandText) return;
    const head = prefix ? `${prefix} ` : "";
    commandPreviewLines.push(`${head}step[${index}] ${commandText}`);
  });
  return commandPreviewLines;
}

function collectTxWorkflowCommandPreview(
  workflow: OrchestrationJsonValue,
): string[] {
  const workflowValue = orchestrationJsonObjectValue(workflow);
  const blocks = Array.isArray(workflowValue.blocks)
    ? workflowValue.blocks
    : [];
  const commandPreviewLines: string[] = [];
  blocks.forEach((block, blockIndex) => {
    const blockValue = orchestrationJsonObjectValue(block);
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

function txWorkflowActionPreviewItems(
  action: OrchestrationTxWorkflowAction,
): string[] {
  if (action.workflow != null) {
    return collectTxWorkflowCommandPreview(action.workflow);
  }
  if (action.workflow_template_name?.trim()) {
    return [
      `${t("orchestrationCommandPreviewTemplateRef")}: workflow_template=${action.workflow_template_name.trim()}`,
    ];
  }
  return [];
}

function orchestrationActionCommandPreviewItems(
  action: OrchestrationTxWorkflowAction,
): string[] {
  return txWorkflowActionPreviewItems(action);
}

function orchestrationActionField(
  label: string,
  detailValue: DisplayValue,
  { mono = false }: { mono?: boolean } = {},
): OrchestrationPreviewActionField {
  return {
    detailValue: orchestrationText(detailValue || "-"),
    label,
    mono,
  };
}

function orchestrationActionSummaryFields(
  action: OrchestrationTxWorkflowAction,
): OrchestrationPreviewActionField[] {
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
  } else if (action.workflow != null) {
    fields.push(orchestrationActionField("workflow", "inline"));
  }
  return fields;
}

function resolveOrchestrationJobTargetsPreview(
  job: OrchestrationJob,
): string[] {
  const labels: string[] = [];
  const groupNames = job.target_groups ?? [];
  labels.push(
    ...groupNames.map(
      (groupName) => `${t("inventoryFieldGroups")}: ${groupName}`,
    ),
  );
  const targetTags = job.target_tags ?? [];
  labels.push(
    ...targetTags.map((tagName) => `${t("inventoryFieldLabels")}: ${tagName}`),
  );
  labels.push(...(job.targets ?? []));
  return labels;
}

function resolveOrchestrationStageTargetsPreview(
  stage: OrchestrationStage,
): string[] {
  return (stage.jobs ?? []).flatMap((job) =>
    resolveOrchestrationJobTargetsPreview(job),
  );
}

function orchestrationStageStrategyLabel(
  strategy: OrchestrationStrategy | undefined,
): string {
  return orchestrationText(strategy || "serial") === "parallel"
    ? t("orchestrationStrategyParallel")
    : t("orchestrationStrategySerial");
}

function orchestrationCommandPreviewDisplay(
  action: OrchestrationTxWorkflowAction,
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
  job: OrchestrationJob,
  index = 0,
): OrchestrationPreviewJobRow {
  const targetGroups = job.target_groups ?? [];
  const targetTags = job.target_tags ?? [];
  const targetLabels = resolveOrchestrationJobTargetsPreview(job);
  const name = orchestrationText(job.name || "");
  const strategyLabel = orchestrationText(
    orchestrationStageStrategyLabel(job.strategy),
  );
  const targetCount = targetLabels.length;
  const actionFields = orchestrationActionSummaryFields(job.action);
  return {
    actionFields,
    chipRows: [
      orchestrationChip(`${t("orchestrationStageStrategy")}: ${strategyLabel}`),
      orchestrationChip(`${t("orchestrationStageTargets")}: ${targetCount}`),
    ],
    commandPreview: orchestrationCommandPreviewDisplay(job.action),
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
  stage: OrchestrationStage,
  index: number,
): OrchestrationPreviewStageRow {
  const jobs = stage.jobs ?? [];
  const name = orchestrationText(stage.name);
  const label = name ? `stage[${index}] ${name}` : `stage[${index}]`;
  const targetLabels = resolveOrchestrationStageTargetsPreview(stage);
  const strategyLabel = orchestrationText(
    orchestrationStageStrategyLabel(stage.strategy),
  );
  return {
    hasJobs: jobs.length > 0,
    hasTargetLabels: targetLabels.length > 0,
    jobCount: jobs.length,
    jobs: jobs.map(orchestrationPreviewJobRow),
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
  plan: OrchestrationPlan | null = null,
) {
  const hasPlan = Boolean(plan);
  const stages = plan?.stages ?? [];
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
