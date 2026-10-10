import type {
  JsonObject,
  OrchestrationWorkflowPreview,
  OrchestrationWorkflowPreviewStatus,
} from "./types.js";
import { txWorkflowEditorFormStateFromJsonText } from "$domains/transactions/index.js";

export function orchestrationWorkflowPreviewFormState(workflow: JsonObject) {
  return txWorkflowEditorFormStateFromJsonText(JSON.stringify(workflow));
}

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
  const formError =
    status === "ready"
      ? orchestrationWorkflowPreviewFormState(workflowValue).formError
      : "";
  return {
    blockCount: Array.isArray(workflowValue.blocks)
      ? workflowValue.blocks.length
      : 0,
    errorMessage: error || formError,
    previewStatus: formError ? "error" : status,
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
