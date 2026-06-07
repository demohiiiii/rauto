import {
  createTemplate,
  deleteTemplate as deleteTemplateByName,
  getTemplate,
  listTemplates,
  updateTemplate,
} from "../api/client.js";
import {
  ensureSelectValue,
  promptResourceName,
  setStatus,
  tr,
  withLoading,
} from "./templateUi.js";
import {
  renderTemplateListView,
  renderTemplateSelects,
} from "./templateRender.js";

export function createTemplateManager(node) {
  let cachedTemplateMetas = [];
  let cachedTemplates = [];
  let lastTemplateDetail = null;

  const byId = (id) =>
    node.querySelector(`#${id}`) || document.getElementById(id);

  function syncRuntimeSnapshot() {
    window.setTemplateRuntimeSnapshots?.({
      templates: cachedTemplates,
      metas: cachedTemplateMetas,
      detail: lastTemplateDetail,
    });
  }

  function renderTemplateList(errorMessage = "") {
    renderTemplateListView({
      errorMessage,
      metas: cachedTemplateMetas,
      out: byId("template-list"),
      selectedName: byId("template-pick-name")?.value.trim() || "",
    });
  }

  function renderTemplateOptions(selectedName = "") {
    renderTemplateSelects({
      byId,
      names: cachedTemplates,
      selectedName,
    });
  }

  async function loadTemplatesFromWeb() {
    try {
      const data = await listTemplates();
      const items = Array.isArray(data) ? data : [];
      cachedTemplateMetas = items;
      cachedTemplates = items.map((item) => item.name).filter(Boolean);
      syncRuntimeSnapshot();
      renderTemplateOptions(byId("template-pick-name")?.value || "");
      renderTemplateList();
    } catch (error) {
      cachedTemplateMetas = [];
      cachedTemplates = [];
      lastTemplateDetail = null;
      syncRuntimeSnapshot();
      renderTemplateOptions("");
      renderTemplateList(error.message);
    }
  }

  async function loadTemplateDetailFromWeb() {
    const name = byId("template-pick-name")?.value.trim() || "";
    if (!name) {
      setStatus(
        "template-out",
        tr("templateNameRequired", "template name is required"),
        "error",
      );
      return;
    }
    setStatus("template-out", tr("running", "running"), "running");
    try {
      const data = await getTemplate(name);
      lastTemplateDetail = data;
      syncRuntimeSnapshot();
      ensureSelectValue(byId("template-pick-name"), data.name || name);
      byId("template-content").value = data.content || "";
      setStatus(
        "template-out",
        `${tr("loaded", "Loaded")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      lastTemplateDetail = null;
      syncRuntimeSnapshot();
      setStatus("template-out", error.message, "error");
    }
  }

  async function saveTemplateFromWeb() {
    const name = byId("template-pick-name")?.value.trim() || "";
    const content = byId("template-content")?.value || "";
    if (!name) {
      setStatus(
        "template-out",
        tr("templateNameRequired", "template name is required"),
        "error",
      );
      return;
    }
    setStatus("template-out", tr("running", "running"), "running");
    try {
      const exists = cachedTemplates.includes(name);
      const data = exists
        ? await updateTemplate(name, content)
        : await createTemplate(name, content);
      setStatus(
        "template-out",
        `${exists ? tr("saved", "Saved") : tr("created", "Created")}: ${data.name || name}`,
        "success",
      );
      await loadTemplatesFromWeb();
      ensureSelectValue(byId("template-pick-name"), data.name || name);
      lastTemplateDetail = data;
      syncRuntimeSnapshot();
      renderTemplateList();
    } catch (error) {
      setStatus("template-out", error.message, "error");
    }
  }

  async function createTemplateDraftFromWeb() {
    const name = promptResourceName(
      tr("templateNewPrompt", "New template name"),
    );
    if (!name) return;
    const draftContent = byId("template-content")?.value || "";
    const exists = cachedTemplates.includes(name);
    if (exists) {
      ensureSelectValue(byId("template-pick-name"), name);
      renderTemplateOptions(name);
      renderTemplateList();
      await loadTemplateDetailFromWeb();
      renderTemplateList();
      setStatus(
        "template-out",
        tr("templateExistsHint", "Template already exists"),
        "info",
      );
      return;
    }
    setStatus("template-out", tr("running", "running"), "running");
    try {
      const data = await createTemplate(name, draftContent);
      await loadTemplatesFromWeb();
      ensureSelectValue(byId("template-pick-name"), data.name || name);
      byId("template-content").value = data.content || "";
      lastTemplateDetail = data;
      syncRuntimeSnapshot();
      renderTemplateList();
      setStatus(
        "template-out",
        `${tr("created", "Created")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      const message = String(error?.message || "");
      if (message.includes("already exists")) {
        ensureSelectValue(byId("template-pick-name"), name);
        renderTemplateOptions(name);
        renderTemplateList();
        await loadTemplateDetailFromWeb();
        renderTemplateList();
        setStatus(
          "template-out",
          tr("templateExistsHint", "Template already exists"),
          "info",
        );
        return;
      }
      setStatus(
        "template-out",
        message || tr("requestFailed", "request failed"),
        "error",
      );
    }
  }

  async function deleteTemplateFromWeb() {
    const name = byId("template-pick-name")?.value.trim() || "";
    if (!name) {
      setStatus(
        "template-out",
        tr("templateNameRequired", "template name is required"),
        "error",
      );
      return;
    }
    setStatus("template-out", tr("running", "running"), "running");
    try {
      await deleteTemplateByName(name);
      byId("template-content").value = "";
      setStatus(
        "template-out",
        `${tr("deleted", "Deleted")}: ${name}`,
        "success",
      );
      await loadTemplatesFromWeb();
      if ((byId("template-pick-name")?.value.trim() || "") === name) {
        byId("template-pick-name").value = "";
      }
      lastTemplateDetail = null;
      syncRuntimeSnapshot();
      renderTemplateList();
    } catch (error) {
      setStatus("template-out", error.message, "error");
    }
  }

  async function selectTemplateName(name) {
    if (!name) return;
    ensureSelectValue(byId("template-pick-name"), name);
    renderTemplateOptions(name);
    renderTemplateList();
    await loadTemplateDetailFromWeb();
    renderTemplateList();
  }

  function onTemplateListClick(event) {
    const row = event.target.closest(".js-template-row");
    if (!row) return;
    selectTemplateName(row.getAttribute("data-name") || "");
  }

  async function onTemplatePickerChange() {
    if (!(byId("template-pick-name")?.value.trim() || "")) return;
    await loadTemplateDetailFromWeb();
    renderTemplateList();
  }

  const list = byId("template-list");
  const picker = byId("template-pick-name");
  const newBtn = byId("template-new-btn");
  const saveBtn = byId("template-save-btn");
  const deleteBtn = byId("template-delete-btn");

  const onNewClick = () =>
    withLoading("template-new-btn", createTemplateDraftFromWeb);
  const onSaveClick = () =>
    withLoading("template-save-btn", saveTemplateFromWeb);
  const onDeleteClick = () =>
    withLoading("template-delete-btn", deleteTemplateFromWeb);

  function init() {
    list?.addEventListener("click", onTemplateListClick);
    picker?.addEventListener("change", onTemplatePickerChange);
    newBtn?.addEventListener("click", onNewClick);
    saveBtn?.addEventListener("click", onSaveClick);
    deleteBtn?.addEventListener("click", onDeleteClick);

    window.renderTemplateList = renderTemplateList;
    window.renderTemplateOptions = renderTemplateOptions;
    window.loadTemplates = loadTemplatesFromWeb;
    window.loadTemplateDetail = loadTemplateDetailFromWeb;
    window.saveTemplate = saveTemplateFromWeb;
    window.createTemplateDraft = createTemplateDraftFromWeb;
    window.deleteTemplate = deleteTemplateFromWeb;

    syncRuntimeSnapshot();
    renderTemplateList();
  }

  function destroy() {
    list?.removeEventListener("click", onTemplateListClick);
    picker?.removeEventListener("change", onTemplatePickerChange);
    newBtn?.removeEventListener("click", onNewClick);
    saveBtn?.removeEventListener("click", onSaveClick);
    deleteBtn?.removeEventListener("click", onDeleteClick);
  }

  return {
    destroy,
    init,
  };
}
