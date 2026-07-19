const PREVIEW_ROW_LIMIT = 4;

function textValue(value, fallback = "") {
  if (value == null) return fallback;
  const text = typeof value === "string" ? value.trim() : String(value).trim();
  return text || fallback;
}

function operationTexts(operation) {
  if (!operation || typeof operation !== "object") return [];
  if (operation.kind === "command" || operation.command != null) {
    const command = textValue(operation.command);
    return command ? [command] : [];
  }
  if (operation.kind === "flow") {
    const steps = Array.isArray(operation.steps) ? operation.steps : [];
    return steps.flatMap((step) =>
      operationTexts(step?.run || step?.operation || step),
    );
  }
  return [];
}

function workflowRows(workflow) {
  const blocks = Array.isArray(workflow?.blocks) ? workflow.blocks : [];
  return blocks.map((block, index) => {
    const steps = Array.isArray(block?.steps) ? block.steps : [];
    const commands = steps.flatMap((step) =>
      operationTexts(step?.run || step?.operation),
    );
    const commandRows = commands.length ? commands : [`${steps.length} steps`];
    return {
      blockName: textValue(block?.name, `Block ${index + 1}`),
      operationText: commandRows[0],
      operationTexts: commandRows,
    };
  });
}

function compactRows(rows, limit = PREVIEW_ROW_LIMIT) {
  const normalized = Array.isArray(rows) ? rows : [];
  return {
    rows: normalized.slice(0, limit),
    overflowCount: Math.max(0, normalized.length - limit),
  };
}

function workflowPreview({
  sourceKind,
  sourceName = "",
  workflow = {},
  unresolvedPaths = [],
  status = "ready",
  error = "",
} = {}) {
  const rows = workflowRows(workflow);
  const compact = compactRows(rows);
  return {
    allRows: rows,
    blockCount: Array.isArray(workflow?.blocks) ? workflow.blocks.length : 0,
    errorMessage: textValue(error),
    overflowCount: compact.overflowCount,
    previewStatus: status,
    rows: compact.rows,
    sourceKind,
    sourceName: textValue(sourceName),
    unresolvedCount: Array.isArray(unresolvedPaths)
      ? unresolvedPaths.length
      : 0,
    unresolvedPaths: Array.isArray(unresolvedPaths) ? unresolvedPaths : [],
    workflow:
      workflow && typeof workflow === "object" ? structuredClone(workflow) : {},
    workflowName: textValue(workflow?.name, "Unnamed workflow"),
  };
}

export function orchestrationInlineWorkflowPreview(workflow = {}) {
  return workflowPreview({
    sourceKind: "manual",
    workflow,
  });
}

export function orchestrationTemplateWorkflowPreview(
  templateName,
  workflow = {},
  unresolvedPaths = [],
) {
  return workflowPreview({
    sourceKind: "template",
    sourceName: templateName,
    workflow,
    unresolvedPaths,
  });
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

function previewCacheKey(name, vars) {
  return JSON.stringify([String(name || "").trim(), stableValue(vars || {})]);
}

export function createOrchestrationWorkflowPreviewWorkspace({
  previewTemplate = null,
} = {}) {
  const cache = new Map();
  const generations = new Map();

  async function previewTemplateValue(templateName, workflowVars = {}) {
    const name = String(templateName || "").trim();
    const key = previewCacheKey(name, workflowVars);
    const cached = cache.get(key);
    if (cached) return cached;
    const generation = (generations.get(name) || 0) + 1;
    generations.set(name, generation);
    if (typeof previewTemplate !== "function") {
      const errorPreview = workflowPreview({
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
        return workflowPreview({
          sourceKind: "template",
          sourceName: name,
          status: "loading",
        });
      }
      const preview = orchestrationTemplateWorkflowPreview(
        name,
        response?.workflow || {},
        response?.unresolved_paths || [],
      );
      cache.set(key, preview);
      return preview;
    } catch (error) {
      const errorPreview = workflowPreview({
        sourceKind: "template",
        sourceName: name,
        status: "error",
        error: error?.message || String(error),
      });
      cache.set(key, errorPreview);
      return errorPreview;
    }
  }

  function clearTemplate(templateName = "") {
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
