import {
  createTemplateResource,
  deleteTemplateResource,
  getTemplateResource,
  listTemplateResource,
  updateTemplateResource,
} from "../api/client.js";
import { jsonTemplateConfigFor } from "../config/jsonTemplateManagers.js";
import {
  normalizeJsonEditorContent,
  setPrettyJsonToTextarea,
  switchTxViewMode,
} from "../services/jsonTemplateEditors.js";
import {
  ensureSelectValue,
  populateSelect,
  promptResourceName,
  safeString,
  setStatus,
  tr,
} from "../services/templateUi.js";
import {
  attachJsonTemplateBindings,
  createJsonTemplateBindings,
  registerJsonTemplateGlobals,
} from "../services/jsonTemplateRuntimeBindings.js";

export function jsonTemplatesBehavior(node) {
  const cache = {
    tx_block: [],
    tx_workflow: [],
    orchestration: [],
  };

  const byId = (id) =>
    node.querySelector(`#${id}`) || document.getElementById(id);
  const namesFor = (kind) =>
    cache[kind].map((item) => item.name).filter(Boolean);
  const configFor = (kind) => jsonTemplateConfigFor(kind);

  function syncRuntimeSnapshot() {
    window.setJsonTemplateRuntimeSnapshots?.({
      txBlockNames: namesFor("tx_block"),
      txBlockMetas: cache.tx_block,
      txWorkflowNames: namesFor("tx_workflow"),
      txWorkflowMetas: cache.tx_workflow,
      orchestrationNames: namesFor("orchestration"),
      orchestrationMetas: cache.orchestration,
    });
  }

  function renderJsonTemplateOptionsByKind(kind) {
    const cfg = configFor(kind);
    if (!cfg) return;
    populateSelect(byId(cfg.runSelectId), namesFor(kind), {
      placeholder: tr("templateSelectPlaceholder", "Select template"),
      selected: byId(cfg.runSelectId)?.value || "",
    });
  }

  function renderJsonTemplateListByKind() {
    // Manager lists are rendered by Svelte pages; keep the global hook stable for runtime callers.
  }

  async function loadJsonTemplatesByKind(kind) {
    const cfg = configFor(kind);
    if (!cfg) return;
    try {
      const data = await listTemplateResource(cfg.apiBase);
      cache[kind] = Array.isArray(data) ? data : [];
      syncRuntimeSnapshot();
      renderJsonTemplateOptionsByKind(kind);
      renderJsonTemplateListByKind(kind);
    } catch (error) {
      cache[kind] = [];
      syncRuntimeSnapshot();
      renderJsonTemplateOptionsByKind(kind);
      renderJsonTemplateListByKind(kind, error.message);
    }
  }

  async function loadTxBlockTemplates() {
    await loadJsonTemplatesByKind("tx_block");
    window.renderTxWorkflowBuilder?.();
  }

  async function loadTxWorkflowTemplates() {
    await loadJsonTemplatesByKind("tx_workflow");
  }

  async function loadOrchestrationTemplates() {
    await loadJsonTemplatesByKind("orchestration");
  }

  async function loadAllJsonTemplates() {
    await Promise.allSettled([
      loadTxBlockTemplates(),
      loadTxWorkflowTemplates(),
      loadOrchestrationTemplates(),
    ]);
  }

  function renderAllJsonTemplateOptions() {
    renderJsonTemplateOptionsByKind("tx_block");
    renderJsonTemplateOptionsByKind("tx_workflow");
    renderJsonTemplateOptionsByKind("orchestration");
  }

  function renderAllJsonTemplateLists() {
    renderJsonTemplateListByKind("tx_block");
    renderJsonTemplateListByKind("tx_workflow");
    renderJsonTemplateListByKind("orchestration");
  }

  async function loadTemplateIntoEditor(kind, nameOverride = "") {
    const cfg = configFor(kind);
    const name = safeString(
      nameOverride || byId(cfg.runSelectId)?.value || "",
    ).trim();
    if (!name) {
      setStatus(cfg.runOutId, tr(cfg.nameRequiredKey), "error");
      return null;
    }
    setStatus(cfg.runOutId, tr("running", "running"), "running");
    try {
      const detail = await getTemplateResource(cfg.apiBase, name);
      ensureSelectValue(byId(cfg.runSelectId), detail.name || name);
      if (detail?.content) {
        setPrettyJsonToTextarea(cfg.runEditorId, detail.content);
        if (kind === "tx_workflow")
          window.renderTxWorkflowPreviewFromEditor?.();
        if (kind === "orchestration")
          window.renderOrchestrationPreviewFromEditor?.();
      }
      setStatus(
        cfg.runOutId,
        `${tr("loaded", "Loaded")}: ${detail?.name || name}`,
        "success",
      );
      return detail;
    } catch (error) {
      setStatus(cfg.runOutId, error.message, "error");
      return null;
    }
  }

  async function saveTemplateFromExecution(kind) {
    const cfg = configFor(kind);
    const name = safeString(byId(cfg.runSelectId)?.value || "").trim();
    if (!name) {
      setStatus(cfg.runOutId, tr(cfg.nameRequiredKey), "error");
      return;
    }
    setStatus(cfg.runOutId, tr("running", "running"), "running");
    try {
      const content =
        kind === "tx_block"
          ? JSON.stringify(
              window.buildTxBlockTemplatePayloadFromEditor?.(),
              null,
              2,
            )
          : normalizeJsonEditorContent(
              cfg.runEditorId,
              kind === "tx_workflow"
                ? "txWorkflowJsonRequired"
                : "orchestrationJsonRequired",
            );
      const exists = namesFor(kind).includes(name);
      const data = exists
        ? await updateTemplateResource(cfg.apiBase, name, content)
        : await createTemplateResource(cfg.apiBase, name, content);
      await loadJsonTemplatesByKind(kind);
      ensureSelectValue(byId(cfg.runSelectId), data.name || name);
      if (kind === "tx_block") window.renderTxWorkflowBuilder?.();
      setStatus(
        cfg.runOutId,
        `${exists ? tr("saved", "Saved") : tr("created", "Created")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      setStatus(cfg.runOutId, error.message, "error");
    }
  }

  async function deleteTemplateFromExecution(kind) {
    const cfg = configFor(kind);
    const name = safeString(byId(cfg.runSelectId)?.value || "").trim();
    if (!name) {
      setStatus(cfg.runOutId, tr(cfg.nameRequiredKey), "error");
      return;
    }
    setStatus(cfg.runOutId, tr("running", "running"), "running");
    try {
      await deleteTemplateResource(cfg.apiBase, name);
      await loadJsonTemplatesByKind(kind);
      ensureSelectValue(byId(cfg.runSelectId), "");
      if (kind === "tx_block") window.renderTxWorkflowBuilder?.();
      setStatus(
        cfg.runOutId,
        `${tr("deleted", "Deleted")}: ${name}`,
        "success",
      );
    } catch (error) {
      setStatus(cfg.runOutId, error.message, "error");
    }
  }

  async function createTemplateDraft(kind) {
    const cfg = configFor(kind);
    const name = promptResourceName(tr(cfg.newPromptKey));
    if (!name) return;
    if (namesFor(kind).includes(name)) {
      ensureSelectValue(byId(cfg.runSelectId), name);
      await loadTemplateIntoEditor(kind);
      setStatus(
        cfg.runOutId,
        tr("templateExistsHint", "Template already exists"),
        "warning",
      );
      return;
    }
    switchTxViewMode(kind);
    setStatus(cfg.runOutId, tr("running", "running"), "running");
    try {
      const content =
        kind === "tx_block"
          ? JSON.stringify(
              window.buildTxBlockTemplatePayloadFromEditor?.(),
              null,
              2,
            )
          : normalizeJsonEditorContent(
              cfg.runEditorId,
              kind === "tx_workflow"
                ? "txWorkflowJsonRequired"
                : "orchestrationJsonRequired",
            );
      const data = await createTemplateResource(cfg.apiBase, name, content);
      await loadJsonTemplatesByKind(kind);
      ensureSelectValue(byId(cfg.runSelectId), data.name || name);
      if (kind === "tx_block") window.renderTxWorkflowBuilder?.();
      setStatus(
        cfg.runOutId,
        `${tr("created", "Created")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      setStatus(cfg.runOutId, error.message, "error");
    }
  }

  const handlers = {
    createTemplateDraft,
    deleteTemplateFromExecution,
    loadAllJsonTemplates,
    loadJsonTemplatesByKind,
    loadOrchestrationTemplates,
    loadTemplateIntoEditor,
    loadTxBlockTemplates,
    loadTxWorkflowTemplates,
    renderAllJsonTemplateLists,
    renderAllJsonTemplateOptions,
    saveTemplateFromExecution,
  };
  const destroyBindings = attachJsonTemplateBindings(
    byId,
    createJsonTemplateBindings(byId, handlers),
  );

  registerJsonTemplateGlobals(handlers);

  syncRuntimeSnapshot();
  renderAllJsonTemplateOptions();

  return {
    destroy() {
      destroyBindings();
    },
  };
}
