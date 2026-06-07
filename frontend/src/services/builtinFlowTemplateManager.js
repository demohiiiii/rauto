import { getTemplateResource } from "../api/client.js";
import {
  ensureSelectValue,
  promptResourceName,
  safeString,
  setStatus,
  tr,
  withLoading,
} from "./templateUi.js";

const FLOW_BUILTIN_TEMPLATE_BASE = "/api/flow-templates/builtins";

export function createBuiltinFlowTemplateManager(node, hooks = {}) {
  let lastBuiltinFlowTemplateDetail = null;

  const byId = (id) =>
    node.querySelector(`#${id}`) || document.getElementById(id);

  function setLastDetail(detail) {
    lastBuiltinFlowTemplateDetail = detail;
    hooks.onBuiltinDetailChange?.(detail);
  }

  function clearBuiltinContent() {
    const content = byId("flow-template-builtin-content");
    if (content) content.value = "";
  }

  async function loadBuiltinFlowTemplateDetailFromWeb(nameOverride = "") {
    const name = safeString(
      nameOverride || byId("flow-template-builtin-picker")?.value || "",
    ).trim();
    if (!name) {
      setLastDetail(null);
      clearBuiltinContent();
      setStatus("flow-template-out", "-", "info");
      hooks.renderBuiltinList?.();
      return null;
    }
    setStatus("flow-template-out", tr("running", "running"), "running");
    try {
      const data = await getTemplateResource(FLOW_BUILTIN_TEMPLATE_BASE, name);
      setLastDetail(data);
      ensureSelectValue(
        byId("flow-template-builtin-picker"),
        data.name || name,
      );
      byId("flow-template-builtin-content").value = data.content || "";
      hooks.renderBuiltinList?.();
      setStatus(
        "flow-template-out",
        `${tr("loaded", "Loaded")}: ${data.name || name}`,
        "success",
      );
      return data;
    } catch (error) {
      setLastDetail(null);
      clearBuiltinContent();
      hooks.renderBuiltinList?.();
      setStatus("flow-template-out", error.message, "error");
      return null;
    }
  }

  async function copyBuiltinFlowTemplateToCustomFromWeb() {
    const selectedName =
      byId("flow-template-builtin-picker")?.value.trim() || "";
    if (!selectedName) {
      setStatus(
        "flow-template-out",
        tr(
          "flowBuiltinTemplateNameRequired",
          "built-in command flow template is required",
        ),
        "error",
      );
      return;
    }
    let detail = lastBuiltinFlowTemplateDetail;
    if (!detail || safeString(detail.name).trim() !== selectedName) {
      detail = await loadBuiltinFlowTemplateDetailFromWeb(selectedName);
    }
    if (!detail) {
      setStatus(
        "flow-template-out",
        tr("needLoadBuiltinFirst", "load built-in template first"),
        "error",
      );
      return;
    }
    const targetName = promptResourceName(
      tr("flowBuiltinTemplateCopyPrompt", "Copy as custom template name"),
      `${detail.name}_custom`,
    );
    if (!targetName) return;
    ensureSelectValue(byId("flow-template-picker"), targetName);
    byId("flow-template-content").value = detail.content || "";
    hooks.onCopyToCustom?.({
      ...detail,
      name: targetName,
    });
    hooks.renderFlowList?.();
    setStatus(
      "flow-template-out",
      `${tr("flowBuiltinTemplateCopied", "Copied")}: ${detail.name} -> ${targetName}`,
      "success",
    );
  }

  async function selectBuiltinFlowTemplateName(name) {
    if (!name) return;
    ensureSelectValue(byId("flow-template-builtin-picker"), name);
    hooks.renderBuiltinList?.();
    await loadBuiltinFlowTemplateDetailFromWeb(name);
    hooks.renderBuiltinList?.();
  }

  function onBuiltinFlowTemplateListClick(event) {
    const row = event.target.closest(".js-flow-builtin-template-row");
    if (!row) return;
    selectBuiltinFlowTemplateName(row.getAttribute("data-name") || "");
  }

  async function onBuiltinFlowTemplatePickerChange() {
    if (!(byId("flow-template-builtin-picker")?.value.trim() || "")) {
      clearBuiltinContent();
      setLastDetail(null);
      hooks.renderBuiltinList?.();
      return;
    }
    await loadBuiltinFlowTemplateDetailFromWeb();
    hooks.renderBuiltinList?.();
  }

  const builtinFlowList = byId("flow-template-builtin-list");
  const builtinFlowPicker = byId("flow-template-builtin-picker");
  const builtinDetailBtn = byId("flow-template-builtin-detail-btn");
  const builtinCopyBtn = byId("flow-template-builtin-copy-btn");

  const onBuiltinDetailClick = () =>
    withLoading("flow-template-builtin-detail-btn", () =>
      loadBuiltinFlowTemplateDetailFromWeb(),
    );
  const onBuiltinCopyClick = () =>
    withLoading(
      "flow-template-builtin-copy-btn",
      copyBuiltinFlowTemplateToCustomFromWeb,
    );

  function init() {
    builtinFlowList?.addEventListener("click", onBuiltinFlowTemplateListClick);
    builtinFlowPicker?.addEventListener(
      "change",
      onBuiltinFlowTemplatePickerChange,
    );
    builtinDetailBtn?.addEventListener("click", onBuiltinDetailClick);
    builtinCopyBtn?.addEventListener("click", onBuiltinCopyClick);

    window.loadBuiltinFlowTemplateDetail = loadBuiltinFlowTemplateDetailFromWeb;
    window.copyBuiltinFlowTemplateToCustom =
      copyBuiltinFlowTemplateToCustomFromWeb;
  }

  function destroy() {
    builtinFlowList?.removeEventListener(
      "click",
      onBuiltinFlowTemplateListClick,
    );
    builtinFlowPicker?.removeEventListener(
      "change",
      onBuiltinFlowTemplatePickerChange,
    );
    builtinDetailBtn?.removeEventListener("click", onBuiltinDetailClick);
    builtinCopyBtn?.removeEventListener("click", onBuiltinCopyClick);
  }

  return {
    clearDetail() {
      setLastDetail(null);
      clearBuiltinContent();
    },
    destroy,
    getLastDetail() {
      return lastBuiltinFlowTemplateDetail;
    },
    init,
    loadDetail: loadBuiltinFlowTemplateDetailFromWeb,
  };
}
