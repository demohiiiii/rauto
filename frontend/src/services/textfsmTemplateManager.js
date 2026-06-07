import {
  createTextfsmTemplate,
  deleteTextfsmTemplate,
  getTextfsmTemplate,
  listTextfsmTemplates,
  updateTextfsmTemplate,
} from "../api/client.js";
import {
  ensureSelectValue,
  escapeHtml,
  populateSelect,
  promptResourceName,
  safeString,
  setStatus,
  statusCard,
  tr,
  withLoading,
} from "./templateUi.js";

export function createTextfsmTemplateManager(node, hooks = {}) {
  let cachedTextfsmTemplateMetas = [];
  let cachedTextfsmTemplateNames = [];
  let lastTextfsmTemplateDetail = null;

  const byId = (id) =>
    node.querySelector(`#${id}`) || document.getElementById(id);

  function renderTextfsmTemplateOptions(selectedName = "") {
    populateSelect(
      byId("textfsm-template-picker"),
      cachedTextfsmTemplateNames,
      {
        placeholder: tr(
          "textfsmTemplateSelectPlaceholder",
          "Select TextFSM template",
        ),
        selected: selectedName || byId("textfsm-template-picker")?.value || "",
      },
    );
    populateSelect(
      byId("textfsm-mapping-template"),
      cachedTextfsmTemplateNames,
      {
        placeholder: tr(
          "textfsmTemplateSelectPlaceholder",
          "Select TextFSM template",
        ),
        selected: byId("textfsm-mapping-template")?.value || "",
      },
    );
    populateSelect(
      byId("show-object-textfsm-template"),
      cachedTextfsmTemplateNames,
      {
        placeholder: tr(
          "textfsmTemplateSelectPlaceholder",
          "Select TextFSM template",
        ),
        selected: byId("show-object-textfsm-template")?.value || "",
      },
    );
  }

  function renderTextfsmTemplateList(errorMessage = "") {
    const out = byId("textfsm-template-list");
    if (!out) return;
    if (errorMessage) {
      out.innerHTML = statusCard(errorMessage, "error");
      return;
    }
    if (!cachedTextfsmTemplateMetas.length) {
      out.innerHTML = statusCard(
        tr("textfsmTemplateListEmpty", "No custom TextFSM templates"),
        "info",
      );
      return;
    }
    const selectedName = byId("textfsm-template-picker")?.value.trim() || "";
    out.innerHTML = cachedTextfsmTemplateMetas
      .map((item) => {
        const active = selectedName && item.name === selectedName;
        const cls = active
          ? "border-teal-300 bg-teal-50/70"
          : "border-slate-200 bg-white hover:border-slate-300";
        return `
          <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-textfsm-template-row ${cls}" data-name="${escapeHtml(
            item.name || "",
          )}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-slate-800">${escapeHtml(
                item.name || "-",
              )}</span>
              <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">${escapeHtml(
                `${safeString(item.size_bytes || 0)} B`,
              )}</span>
            </div>
          </button>`;
      })
      .join("");
  }

  async function loadTextfsmTemplatesFromWeb() {
    try {
      const data = await listTextfsmTemplates();
      cachedTextfsmTemplateMetas = Array.isArray(data) ? data : [];
      cachedTextfsmTemplateNames = cachedTextfsmTemplateMetas
        .map((item) => item.name)
        .filter(Boolean);
      renderTextfsmTemplateOptions();
      renderTextfsmTemplateList();
      hooks.onTemplateNamesChange?.(cachedTextfsmTemplateNames);
    } catch (error) {
      cachedTextfsmTemplateMetas = [];
      cachedTextfsmTemplateNames = [];
      lastTextfsmTemplateDetail = null;
      renderTextfsmTemplateOptions();
      renderTextfsmTemplateList(error.message);
      hooks.onTemplateNamesChange?.([]);
    }
  }

  async function loadTextfsmTemplateDetailFromWeb(nameOverride = "") {
    const name = safeString(
      nameOverride || byId("textfsm-template-picker")?.value || "",
    ).trim();
    if (!name) {
      setStatus(
        "textfsm-template-out",
        tr("textfsmTemplateNameRequired", "TextFSM template name is required"),
        "error",
      );
      return;
    }
    setStatus("textfsm-template-out", tr("running", "running"), "running");
    try {
      const data = await getTextfsmTemplate(name);
      lastTextfsmTemplateDetail = data;
      ensureSelectValue(byId("textfsm-template-picker"), data.name || name);
      byId("textfsm-template-content").value = data.content || "";
      renderTextfsmTemplateList();
      setStatus(
        "textfsm-template-out",
        `${tr("loaded", "Loaded")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      lastTextfsmTemplateDetail = null;
      setStatus("textfsm-template-out", error.message, "error");
    }
  }

  async function createTextfsmTemplateDraftFromWeb() {
    const name = promptResourceName(
      tr("textfsmTemplateNewPrompt", "New TextFSM template name"),
    );
    if (!name) return;
    const content = byId("textfsm-template-content")?.value || "";
    setStatus("textfsm-template-out", tr("running", "running"), "running");
    try {
      const data = await createTextfsmTemplate(name, content);
      await loadTextfsmTemplatesFromWeb();
      ensureSelectValue(byId("textfsm-template-picker"), data.name || name);
      byId("textfsm-template-content").value = data.content || "";
      lastTextfsmTemplateDetail = data;
      renderTextfsmTemplateList();
      setStatus(
        "textfsm-template-out",
        `${tr("created", "Created")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      ensureSelectValue(byId("textfsm-template-picker"), name);
      renderTextfsmTemplateList();
      setStatus("textfsm-template-out", error.message, "error");
    }
  }

  async function saveTextfsmTemplateFromWeb() {
    const name = byId("textfsm-template-picker")?.value.trim() || "";
    const content = byId("textfsm-template-content")?.value || "";
    if (!name) {
      setStatus(
        "textfsm-template-out",
        tr("textfsmTemplateNameRequired", "TextFSM template name is required"),
        "error",
      );
      return;
    }
    setStatus("textfsm-template-out", tr("running", "running"), "running");
    try {
      const exists = cachedTextfsmTemplateNames.includes(name);
      const data = exists
        ? await updateTextfsmTemplate(name, content)
        : await createTextfsmTemplate(name, content);
      await loadTextfsmTemplatesFromWeb();
      ensureSelectValue(byId("textfsm-template-picker"), data.name || name);
      byId("textfsm-template-content").value = data.content || content;
      lastTextfsmTemplateDetail = data;
      renderTextfsmTemplateList();
      hooks.onTemplateSaved?.();
      setStatus(
        "textfsm-template-out",
        `${exists ? tr("saved", "Saved") : tr("created", "Created")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      setStatus("textfsm-template-out", error.message, "error");
    }
  }

  async function deleteTextfsmTemplateFromWeb() {
    const name = byId("textfsm-template-picker")?.value.trim() || "";
    if (!name) {
      setStatus(
        "textfsm-template-out",
        tr("textfsmTemplateNameRequired", "TextFSM template name is required"),
        "error",
      );
      return;
    }
    setStatus("textfsm-template-out", tr("running", "running"), "running");
    try {
      await deleteTextfsmTemplate(name);
      byId("textfsm-template-content").value = "";
      lastTextfsmTemplateDetail = null;
      await loadTextfsmTemplatesFromWeb();
      await hooks.onTemplateDeleted?.();
      setStatus(
        "textfsm-template-out",
        `${tr("deleted", "Deleted")}: ${name}`,
        "success",
      );
    } catch (error) {
      setStatus("textfsm-template-out", error.message, "error");
    }
  }

  async function selectTextfsmTemplateName(name) {
    if (!name) return;
    ensureSelectValue(byId("textfsm-template-picker"), name);
    renderTextfsmTemplateList();
    await loadTextfsmTemplateDetailFromWeb(name);
    renderTextfsmTemplateList();
  }

  function onTextfsmTemplateListClick(event) {
    const row = event.target.closest(".js-textfsm-template-row");
    if (!row) return;
    selectTextfsmTemplateName(row.getAttribute("data-name") || "");
  }

  async function onTextfsmTemplatePickerChange() {
    if (!(byId("textfsm-template-picker")?.value.trim() || "")) return;
    await loadTextfsmTemplateDetailFromWeb();
    renderTextfsmTemplateList();
  }

  const textfsmTemplateList = byId("textfsm-template-list");
  const textfsmTemplatePicker = byId("textfsm-template-picker");
  const textfsmTemplateNewBtn = byId("textfsm-template-new-btn");
  const textfsmTemplateSaveBtn = byId("textfsm-template-save-btn");
  const textfsmTemplateDeleteBtn = byId("textfsm-template-delete-btn");

  const onTextfsmTemplateNewClick = () =>
    withLoading("textfsm-template-new-btn", createTextfsmTemplateDraftFromWeb);
  const onTextfsmTemplateSaveClick = () =>
    withLoading("textfsm-template-save-btn", saveTextfsmTemplateFromWeb);
  const onTextfsmTemplateDeleteClick = () =>
    withLoading("textfsm-template-delete-btn", deleteTextfsmTemplateFromWeb);

  function init() {
    textfsmTemplateList?.addEventListener("click", onTextfsmTemplateListClick);
    textfsmTemplatePicker?.addEventListener(
      "change",
      onTextfsmTemplatePickerChange,
    );
    textfsmTemplateNewBtn?.addEventListener("click", onTextfsmTemplateNewClick);
    textfsmTemplateSaveBtn?.addEventListener(
      "click",
      onTextfsmTemplateSaveClick,
    );
    textfsmTemplateDeleteBtn?.addEventListener(
      "click",
      onTextfsmTemplateDeleteClick,
    );

    window.loadTextfsmTemplates = loadTextfsmTemplatesFromWeb;
    renderTextfsmTemplateList();
  }

  function destroy() {
    textfsmTemplateList?.removeEventListener(
      "click",
      onTextfsmTemplateListClick,
    );
    textfsmTemplatePicker?.removeEventListener(
      "change",
      onTextfsmTemplatePickerChange,
    );
    textfsmTemplateNewBtn?.removeEventListener(
      "click",
      onTextfsmTemplateNewClick,
    );
    textfsmTemplateSaveBtn?.removeEventListener(
      "click",
      onTextfsmTemplateSaveClick,
    );
    textfsmTemplateDeleteBtn?.removeEventListener(
      "click",
      onTextfsmTemplateDeleteClick,
    );
  }

  return {
    destroy,
    init,
  };
}
