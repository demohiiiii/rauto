import {
  orchestrationTemplateWorkflowPreview,
  orchestrationWorkflowPreview,
} from "../model/orchestrationWorkflowPreview.js";
import type {
  JsonObject,
  OrchestrationWorkflowPreview,
  OrchestrationWorkflowPreviewWorkspace,
} from "../model/types.js";

type PreviewTemplatePort = (
  templateName: string,
  workflowVars: unknown,
) => Promise<unknown>;

interface WorkflowPreviewWorkspaceOptions {
  previewTemplate?: PreviewTemplatePort | null;
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  const source = value as JsonObject;
  return Object.fromEntries(
    Object.keys(source)
      .sort()
      .map((key) => [key, stableValue(source[key])]),
  );
}

function previewCacheKey(name: string, vars: unknown): string {
  return JSON.stringify([name.trim(), stableValue(vars || {})]);
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message) || String(error);
  }
  return String(error);
}

export function createOrchestrationWorkflowPreviewWorkspace({
  previewTemplate = null,
}: WorkflowPreviewWorkspaceOptions = {}): OrchestrationWorkflowPreviewWorkspace {
  const cache = new Map<string, OrchestrationWorkflowPreview>();
  const generations = new Map<string, number>();

  async function previewTemplateValue(
    templateName: unknown,
    workflowVars: unknown = {},
  ): Promise<OrchestrationWorkflowPreview> {
    const name = String(templateName || "").trim();
    const key = previewCacheKey(name, workflowVars);
    const cached = cache.get(key);
    if (cached) return cached;
    const generation = (generations.get(name) || 0) + 1;
    generations.set(name, generation);
    if (!previewTemplate) {
      const errorPreview = orchestrationWorkflowPreview({
        sourceKind: "template",
        sourceName: name,
        status: "error",
        error: "template preview is unavailable",
      });
      cache.set(key, errorPreview);
      return errorPreview;
    }
    try {
      const response = objectValue(await previewTemplate(name, workflowVars));
      if (generations.get(name) !== generation) {
        return orchestrationWorkflowPreview({
          sourceKind: "template",
          sourceName: name,
          status: "loading",
        });
      }
      const preview = orchestrationTemplateWorkflowPreview(
        name,
        response.workflow || {},
        response.unresolved_paths || [],
      );
      cache.set(key, preview);
      return preview;
    } catch (error) {
      const errorPreview = orchestrationWorkflowPreview({
        sourceKind: "template",
        sourceName: name,
        status: "error",
        error: errorMessage(error),
      });
      cache.set(key, errorPreview);
      return errorPreview;
    }
  }

  function clearTemplate(templateName: unknown = ""): void {
    const name = String(templateName || "").trim();
    for (const key of cache.keys()) {
      if (key.startsWith(`["${name}"`)) cache.delete(key);
    }
    generations.set(name, (generations.get(name) || 0) + 1);
  }

  return {
    clearTemplate,
    previewTemplate: previewTemplateValue,
  };
}
