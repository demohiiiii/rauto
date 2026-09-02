import type {
  JsonObject,
  OrchestrationWorkflowPreview,
  OrchestrationWorkflowPreviewRow,
  OrchestrationWorkflowPreviewStatus,
} from "./types.js";

const PREVIEW_ROW_LIMIT = 4;

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function textValue(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  const text = typeof value === "string" ? value.trim() : String(value).trim();
  return text || fallback;
}

function operationTexts(operation: unknown): string[] {
  const operationValue = objectValue(operation);
  if (operationValue.kind === "command" || operationValue.command != null) {
    const command = textValue(operationValue.command);
    return command ? [command] : [];
  }
  if (operationValue.kind === "flow") {
    const steps = Array.isArray(operationValue.steps)
      ? operationValue.steps
      : [];
    return steps.flatMap((step) => {
      const stepValue = objectValue(step);
      return operationTexts(stepValue.run || stepValue.operation || step);
    });
  }
  return [];
}

function workflowRows(workflow: unknown): OrchestrationWorkflowPreviewRow[] {
  const workflowValue = objectValue(workflow);
  const blocks = Array.isArray(workflowValue.blocks)
    ? workflowValue.blocks
    : [];
  return blocks.map((block, index) => {
    const blockValue = objectValue(block);
    const steps = Array.isArray(blockValue.steps) ? blockValue.steps : [];
    const commands = steps.flatMap((step) => {
      const stepValue = objectValue(step);
      return operationTexts(stepValue.run || stepValue.operation);
    });
    const commandRows = commands.length ? commands : [`${steps.length} steps`];
    return {
      blockName: textValue(blockValue.name, `Block ${index + 1}`),
      operationText: commandRows[0],
      operationTexts: commandRows,
    };
  });
}

function compactRows(
  rows: readonly OrchestrationWorkflowPreviewRow[],
  limit = PREVIEW_ROW_LIMIT,
): {
  overflowCount: number;
  rows: OrchestrationWorkflowPreviewRow[];
} {
  const normalized = Array.isArray(rows) ? rows : [];
  return {
    rows: normalized.slice(0, limit),
    overflowCount: Math.max(0, normalized.length - limit),
  };
}

interface WorkflowPreviewOptions {
  error?: string;
  sourceKind?: "manual" | "template";
  sourceName?: string;
  status?: OrchestrationWorkflowPreviewStatus;
  unresolvedPaths?: string[];
  workflow?: JsonObject;
}

export function orchestrationWorkflowPreview({
  sourceKind,
  sourceName = "",
  workflow = {},
  unresolvedPaths = [],
  status = "ready",
  error = "",
}: WorkflowPreviewOptions = {}): OrchestrationWorkflowPreview {
  const workflowValue = objectValue(workflow);
  const rows = workflowRows(workflow);
  const compact = compactRows(rows);
  return {
    allRows: rows,
    blockCount: Array.isArray(workflowValue.blocks)
      ? workflowValue.blocks.length
      : 0,
    errorMessage: error,
    overflowCount: compact.overflowCount,
    previewStatus: status,
    rows: compact.rows,
    sourceKind: sourceKind === "template" ? "template" : "manual",
    sourceName,
    unresolvedCount: unresolvedPaths.length,
    unresolvedPaths: [...unresolvedPaths],
    workflow: structuredClone(workflow),
    workflowName: textValue(workflowValue.name, "Unnamed workflow"),
  };
}

export function orchestrationInlineWorkflowPreview(
  workflow: JsonObject = {},
): OrchestrationWorkflowPreview {
  return orchestrationWorkflowPreview({
    sourceKind: "manual",
    workflow,
  });
}

export function orchestrationTemplateWorkflowPreview(
  templateName: string,
  workflow: JsonObject = {},
  unresolvedPaths: string[] = [],
): OrchestrationWorkflowPreview {
  return orchestrationWorkflowPreview({
    sourceKind: "template",
    sourceName: templateName,
    workflow,
    unresolvedPaths,
  });
}
