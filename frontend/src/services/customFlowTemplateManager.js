import {
  createTemplateResource,
  deleteTemplateResource,
  getTemplateResource,
  updateTemplateResource,
} from "../api/client.js";
import {
  ensureSelectValue,
  promptResourceName,
  safeString,
  setStatus,
  tr,
  withLoading,
} from "./templateUi.js";

const FLOW_TEMPLATE_BASE = "/api/flow-templates";

function renderFlowTemplateVarsIfSelected(name, detail) {
  const runPicker = document.getElementById("flow-template-name");
  if (!runPicker || runPicker.value.trim() !== safeString(name).trim()) return;
  const draft =
    typeof window.getCurrentFlowTemplateFieldDraft === "function"
      ? window.getCurrentFlowTemplateFieldDraft()
      : {};
  window.renderFlowTemplateVarFields?.(detail, draft);
}

export function createCustomFlowTemplateManager(node, hooks = {}) {
  let lastFlowTemplateDetail = null;

  const byId = (id) =>
    node.querySelector(`#${id}`) || document.getElementById(id);

  function setLastDetail(detail) {
    lastFlowTemplateDetail = detail;
    hooks.onDetailChange?.(detail);
  }

  async function loadFlowTemplateDetailFromWeb() {
    const name = byId("flow-template-picker")?.value.trim() || "";
    if (!name) {
      setStatus(
        "flow-template-out",
        tr(
          "flowTemplateNameRequired",
          "command flow template name is required",
        ),
        "error",
      );
      return;
    }
    setStatus("flow-template-out", tr("running", "running"), "running");
    try {
      const data = await getTemplateResource(FLOW_TEMPLATE_BASE, name);
      setLastDetail(data);
      ensureSelectValue(byId("flow-template-picker"), data.name || name);
      byId("flow-template-content").value = data.content || "";
      renderFlowTemplateVarsIfSelected(data.name || name, data);
      hooks.renderList?.();
      setStatus(
        "flow-template-out",
        `${tr("loaded", "Loaded")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      setLastDetail(null);
      setStatus("flow-template-out", error.message, "error");
    }
  }

  async function saveFlowTemplateFromWeb() {
    const name = byId("flow-template-picker")?.value.trim() || "";
    const content = byId("flow-template-content")?.value || "";
    if (!name) {
      setStatus(
        "flow-template-out",
        tr(
          "flowTemplateNameRequired",
          "command flow template name is required",
        ),
        "error",
      );
      return;
    }
    setStatus("flow-template-out", tr("running", "running"), "running");
    try {
      const exists = hooks.getNames?.().includes(name);
      const data = exists
        ? await updateTemplateResource(FLOW_TEMPLATE_BASE, name, content)
        : await createTemplateResource(FLOW_TEMPLATE_BASE, name, content);
      setStatus(
        "flow-template-out",
        `${exists ? tr("saved", "Saved") : tr("created", "Created")}: ${data.name || name}`,
        "success",
      );
      await hooks.loadAll?.();
      ensureSelectValue(byId("flow-template-picker"), data.name || name);
      setLastDetail(data);
      byId("flow-template-content").value = data.content || content;
      renderFlowTemplateVarsIfSelected(data.name || name, data);
      hooks.renderList?.();
    } catch (error) {
      setStatus("flow-template-out", error.message, "error");
    }
  }

  async function createFlowTemplateDraftFromWeb() {
    const name = promptResourceName(
      tr("flowTemplateNewPrompt", "New command flow template name"),
    );
    if (!name) return;
    const editor = byId("flow-template-content");
    const currentContent = (editor?.value || "").trim();
    const fallbackDraft = `name = "${name}"
description = ""
stop_on_error = true
default_mode = "User"

[[steps]]
command = "echo hello"
`;
    const draftContent = currentContent ? editor?.value || "" : fallbackDraft;
    setStatus("flow-template-out", tr("running", "running"), "running");
    try {
      const data = await createTemplateResource(
        FLOW_TEMPLATE_BASE,
        name,
        draftContent,
      );
      await hooks.loadAll?.();
      ensureSelectValue(byId("flow-template-picker"), data.name || name);
      if (editor) {
        editor.value = data.content || draftContent;
      }
      setLastDetail(data);
      renderFlowTemplateVarsIfSelected(data.name || name, data);
      hooks.renderList?.();
      setStatus(
        "flow-template-out",
        `${tr("created", "Created")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      ensureSelectValue(byId("flow-template-picker"), name);
      if (editor) {
        editor.value = draftContent;
      }
      setLastDetail(null);
      hooks.renderList?.();
      setStatus("flow-template-out", error.message, "error");
    }
  }

  async function deleteFlowTemplateFromWeb() {
    const name = byId("flow-template-picker")?.value.trim() || "";
    if (!name) {
      setStatus(
        "flow-template-out",
        tr(
          "flowTemplateNameRequired",
          "command flow template name is required",
        ),
        "error",
      );
      return;
    }
    setStatus("flow-template-out", tr("running", "running"), "running");
    try {
      await deleteTemplateResource(FLOW_TEMPLATE_BASE, name);
      byId("flow-template-content").value = "";
      setStatus(
        "flow-template-out",
        `${tr("deleted", "Deleted")}: ${name}`,
        "success",
      );
      await hooks.loadAll?.();
      if ((byId("flow-template-picker")?.value.trim() || "") === name) {
        byId("flow-template-picker").value = "";
      }
      if (
        (document.getElementById("flow-template-name")?.value.trim() || "") ===
        name
      ) {
        window.renderFlowTemplateVarFields?.(null, {});
      }
      setLastDetail(null);
      hooks.renderList?.();
    } catch (error) {
      setStatus("flow-template-out", error.message, "error");
    }
  }

  async function selectFlowTemplateName(name) {
    if (!name) return;
    ensureSelectValue(byId("flow-template-picker"), name);
    hooks.renderList?.();
    await loadFlowTemplateDetailFromWeb();
    hooks.renderList?.();
  }

  function onFlowTemplateListClick(event) {
    const row = event.target.closest(".js-flow-template-row");
    if (!row) return;
    selectFlowTemplateName(row.getAttribute("data-name") || "");
  }

  async function onFlowTemplatePickerChange() {
    if (!(byId("flow-template-picker")?.value.trim() || "")) return;
    await loadFlowTemplateDetailFromWeb();
    hooks.renderList?.();
  }

  const flowList = byId("flow-template-list");
  const flowPicker = byId("flow-template-picker");
  const flowNewBtn = byId("flow-template-new-btn");
  const flowSaveBtn = byId("flow-template-save-btn");
  const flowDeleteBtn = byId("flow-template-delete-btn");

  const onFlowNewClick = () =>
    withLoading("flow-template-new-btn", createFlowTemplateDraftFromWeb);
  const onFlowSaveClick = () =>
    withLoading("flow-template-save-btn", saveFlowTemplateFromWeb);
  const onFlowDeleteClick = () =>
    withLoading("flow-template-delete-btn", deleteFlowTemplateFromWeb);

  function init() {
    flowList?.addEventListener("click", onFlowTemplateListClick);
    flowPicker?.addEventListener("change", onFlowTemplatePickerChange);
    flowNewBtn?.addEventListener("click", onFlowNewClick);
    flowSaveBtn?.addEventListener("click", onFlowSaveClick);
    flowDeleteBtn?.addEventListener("click", onFlowDeleteClick);

    window.loadFlowTemplateDetail = loadFlowTemplateDetailFromWeb;
    window.saveFlowTemplate = saveFlowTemplateFromWeb;
    window.createFlowTemplateDraft = createFlowTemplateDraftFromWeb;
    window.deleteFlowTemplate = deleteFlowTemplateFromWeb;
  }

  function destroy() {
    flowList?.removeEventListener("click", onFlowTemplateListClick);
    flowPicker?.removeEventListener("change", onFlowTemplatePickerChange);
    flowNewBtn?.removeEventListener("click", onFlowNewClick);
    flowSaveBtn?.removeEventListener("click", onFlowSaveClick);
    flowDeleteBtn?.removeEventListener("click", onFlowDeleteClick);
  }

  return {
    destroy,
    getLastDetail() {
      return lastFlowTemplateDetail;
    },
    init,
    setDraftDetail: setLastDetail,
  };
}
