import {
  orchestrationTemplateWorkflowPreview,
  orchestrationWorkflowPreview,
} from "../model/orchestrationWorkflowPreview.js";
import type {
  JsonObject,
  OrchestrationJsonValue,
  OrchestrationWorkflowPreview,
  OrchestrationWorkflowPreviewPort,
  OrchestrationWorkflowPreviewWorkspace,
} from "../model/types.js";

interface WorkflowPreviewWorkspaceOptions {
  previewTemplate?: OrchestrationWorkflowPreviewPort | null;
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

function previewCacheKey(name: string, vars: JsonObject): string {
  return JSON.stringify([name.trim(), stableValue(vars)]);
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message) || String(error);
  }
  return String(error);
}

function workflowObject(value: OrchestrationJsonValue): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("template workflow preview must be a JSON object");
  }
  return value;
}

export function createOrchestrationWorkflowPreviewWorkspace({
  previewTemplate = null,
}: WorkflowPreviewWorkspaceOptions = {}): OrchestrationWorkflowPreviewWorkspace {
  const cache = new Map<string, OrchestrationWorkflowPreview>();
  const generations = new Map<string, number>();

  async function previewTemplateValue(
    templateName: string,
    workflowVars: JsonObject = {},
  ): Promise<OrchestrationWorkflowPreview> {
    const name = templateName.trim();
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
      const response = await previewTemplate(name, workflowVars);
      if (generations.get(name) !== generation) {
        return orchestrationWorkflowPreview({
          sourceKind: "template",
          sourceName: name,
          status: "loading",
        });
      }
      const preview = orchestrationTemplateWorkflowPreview(
        name,
        workflowObject(response.workflow),
        response.unresolved_paths,
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

  function clearTemplate(templateName = ""): void {
    const name = templateName.trim();
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
