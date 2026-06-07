import { listTemplateResource } from "../api/client.js";
import { createBuiltinFlowTemplateManager } from "./builtinFlowTemplateManager.js";
import { renderCommandFlowResult } from "./commandFlowRender.js";
import { createCustomFlowTemplateManager } from "./customFlowTemplateManager.js";
import {
  renderBuiltinFlowTemplateListView,
  renderFlowTemplateListView,
  renderFlowTemplateSelects,
} from "./flowTemplateRender.js";

const FLOW_TEMPLATE_BASE = "/api/flow-templates";
const FLOW_BUILTIN_TEMPLATE_BASE = "/api/flow-templates/builtins";

export function createFlowTemplateManager(node) {
  let cachedFlowTemplateMetas = [];
  let cachedFlowTemplateNames = [];
  let cachedBuiltinFlowTemplateMetas = [];
  let customFlowTemplateManager = null;
  let builtinFlowTemplateManager = null;

  const byId = (id) =>
    node.querySelector(`#${id}`) || document.getElementById(id);

  function syncFlowRuntimeSnapshot() {
    window.setFlowTemplateRuntimeSnapshots?.({
      names: cachedFlowTemplateNames,
      metas: cachedFlowTemplateMetas,
      builtinMetas: cachedBuiltinFlowTemplateMetas,
      detail: customFlowTemplateManager?.getLastDetail?.() || null,
      builtinDetail: builtinFlowTemplateManager?.getLastDetail?.() || null,
    });
  }

  function renderFlowTemplateList(errorMessage = "") {
    renderFlowTemplateListView({
      errorMessage,
      metas: cachedFlowTemplateMetas,
      out: byId("flow-template-list"),
      selectedName: byId("flow-template-picker")?.value.trim() || "",
    });
  }

  function renderBuiltinFlowTemplateList(errorMessage = "") {
    renderBuiltinFlowTemplateListView({
      errorMessage,
      metas: cachedBuiltinFlowTemplateMetas,
      out: byId("flow-template-builtin-list"),
      selectedName: byId("flow-template-builtin-picker")?.value.trim() || "",
    });
  }

  function renderFlowTemplateOptions() {
    renderFlowTemplateSelects({
      builtinMetas: cachedBuiltinFlowTemplateMetas,
      byId,
      names: cachedFlowTemplateNames,
    });
  }

  async function loadFlowTemplatesFromWeb() {
    try {
      const [savedResult, builtinResult] = await Promise.allSettled([
        listTemplateResource(FLOW_TEMPLATE_BASE),
        listTemplateResource(FLOW_BUILTIN_TEMPLATE_BASE),
      ]);
      cachedFlowTemplateMetas =
        savedResult.status === "fulfilled" && Array.isArray(savedResult.value)
          ? savedResult.value
          : [];
      cachedFlowTemplateNames = cachedFlowTemplateMetas
        .map((item) => item.name)
        .filter(Boolean);
      cachedBuiltinFlowTemplateMetas =
        builtinResult.status === "fulfilled" &&
        Array.isArray(builtinResult.value)
          ? builtinResult.value
          : [];
      syncFlowRuntimeSnapshot();
      renderFlowTemplateOptions();
      renderFlowTemplateList();
      renderBuiltinFlowTemplateList();
    } catch (error) {
      cachedFlowTemplateNames = [];
      cachedFlowTemplateMetas = [];
      cachedBuiltinFlowTemplateMetas = [];
      builtinFlowTemplateManager?.clearDetail();
      syncFlowRuntimeSnapshot();
      renderFlowTemplateOptions();
      renderFlowTemplateList(error.message);
      renderBuiltinFlowTemplateList(error.message);
    }
  }

  customFlowTemplateManager = createCustomFlowTemplateManager(node, {
    getNames: () => cachedFlowTemplateNames,
    loadAll: loadFlowTemplatesFromWeb,
    onDetailChange: () => syncFlowRuntimeSnapshot(),
    renderList: renderFlowTemplateList,
  });
  builtinFlowTemplateManager = createBuiltinFlowTemplateManager(node, {
    onBuiltinDetailChange: () => syncFlowRuntimeSnapshot(),
    onCopyToCustom: (detail) =>
      customFlowTemplateManager.setDraftDetail(detail),
    renderBuiltinList: renderBuiltinFlowTemplateList,
    renderFlowList: renderFlowTemplateList,
  });

  function init() {
    customFlowTemplateManager.init();
    builtinFlowTemplateManager.init();

    window.renderFlowTemplateList = renderFlowTemplateList;
    window.renderBuiltinFlowTemplateList = renderBuiltinFlowTemplateList;
    window.renderFlowTemplateOptions = renderFlowTemplateOptions;
    window.loadFlowTemplates = loadFlowTemplatesFromWeb;
    window.renderCommandFlowResult = renderCommandFlowResult;

    syncFlowRuntimeSnapshot();
    renderFlowTemplateList();
    renderBuiltinFlowTemplateList();
  }

  function destroy() {
    customFlowTemplateManager.destroy();
    builtinFlowTemplateManager.destroy();
  }

  return {
    destroy,
    init,
  };
}
