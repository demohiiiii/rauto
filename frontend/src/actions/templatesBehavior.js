import {
  createTemplate,
  createTextfsmTemplate,
  createTemplateResource,
  deleteCustomShowObject,
  deleteTemplate as deleteTemplateByName,
  deleteTemplateResource,
  deleteTextfsmMapping,
  deleteTextfsmTemplate,
  getTemplate,
  getTemplateResource,
  getTextfsmTemplate,
  getDeviceProfilesOverview,
  getProfileModes,
  listCustomShowObjects,
  listTextfsmMappings,
  listTextfsmTemplates,
  listTemplates,
  listTemplateResource,
  saveTextfsmMapping,
  saveCustomShowObject,
  updateTextfsmTemplate,
  updateTemplate,
  updateTemplateResource,
} from "../api/client.js";

const FLOW_TEMPLATE_BASE = "/api/flow-templates";
const FLOW_BUILTIN_TEMPLATE_BASE = "/api/flow-templates/builtins";
const FLOW_BUILTIN_PREFIX = "builtin:";

function tr(key, fallback = key) {
  return typeof window.t === "function" ? window.t(key) : fallback;
}

function safeString(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function escapeHtml(value) {
  return safeString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function statusCard(message, tone = "info") {
  if (typeof window.renderStatusMessageCard === "function") {
    return window.renderStatusMessageCard(message, tone);
  }
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return `<div class="rounded-xl border ${toneClass} px-3 py-2 text-sm">${escapeHtml(message)}</div>`;
}

function setStatus(id, message, tone = "info") {
  if (typeof window.setStatusMessage === "function") {
    window.setStatusMessage(id, message, tone);
    return;
  }
  const out = document.getElementById(id);
  if (!out) return;
  out.innerHTML = statusCard(message, tone);
}

function populateSelect(select, values, config = {}) {
  if (!select) return;
  const {
    placeholder = "-",
    selected = "",
    allowEmpty = true,
    emptyValue = "",
  } = config;
  const items = Array.from(new Set((values || []).filter(Boolean)));
  const options = [];
  if (allowEmpty) {
    options.push(
      `<option value="${escapeHtml(emptyValue)}">${escapeHtml(placeholder)}</option>`,
    );
  }
  items.forEach((value) => {
    options.push(
      `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`,
    );
  });
  select.innerHTML = options.join("");
  if (selected && items.includes(selected)) {
    select.value = selected;
  } else if (selected && !items.includes(selected)) {
    const option = document.createElement("option");
    option.value = selected;
    option.textContent = selected;
    select.appendChild(option);
    select.value = selected;
  } else if (allowEmpty) {
    select.value = emptyValue;
  } else if (items.length > 0) {
    select.value = items[0];
  } else {
    select.value = "";
  }
}

function ensureSelectValue(select, value, config = {}) {
  if (!select) return;
  const normalized = safeString(value).trim();
  if (!normalized) {
    if (config.fallbackToEmpty !== false) {
      select.value = "";
    }
    return;
  }
  const hasOption = Array.from(select.options).some(
    (option) => option.value === normalized,
  );
  if (!hasOption) {
    const option = document.createElement("option");
    option.value = normalized;
    option.textContent = normalized;
    select.appendChild(option);
  }
  select.value = normalized;
}

function promptResourceName(message, initialValue = "") {
  if (typeof window.promptForResourceName === "function") {
    return window.promptForResourceName(message, initialValue);
  }
  const result = window.prompt(message, initialValue);
  if (result == null) return null;
  const normalized = result.trim();
  return normalized || null;
}

function buildBuiltinFlowTemplateValue(name) {
  const normalized = safeString(name).trim();
  return normalized ? `${FLOW_BUILTIN_PREFIX}${normalized}` : "";
}

function renderFlowTemplateVarsIfSelected(name, detail) {
  const runPicker = document.getElementById("flow-template-name");
  if (!runPicker || runPicker.value.trim() !== safeString(name).trim()) return;
  const draft =
    typeof window.getCurrentFlowTemplateFieldDraft === "function"
      ? window.getCurrentFlowTemplateFieldDraft()
      : {};
  window.renderFlowTemplateVarFields?.(detail, draft);
}

function renderParsedOutputBlock(data) {
  return typeof window.renderParsedOutputBlock === "function"
    ? window.renderParsedOutputBlock(data)
    : "";
}

function renderCommandFlowResult(data) {
  const outputs = Array.isArray(data?.outputs) ? data.outputs : [];
  const tone = data?.success ? "success" : "error";
  const exportButton = window.renderParsedOutputSheetsExportButton?.(
    window.parsedOutputSheetsFromItems?.(outputs, {
      filename: "textfsm-flow.xlsx",
      sheetName: (item, index) => item.command || `command_${index + 1}`,
    }) || [],
    { filename: "textfsm-flow.xlsx" },
  );
  const summary = statusCard(
    `${
      data?.success
        ? tr("orchestrationStatusSuccess", "Success")
        : tr("orchestrationStatusFailed", "Failed")
    } · template=${safeString(data?.template_name) || "-"}`,
    tone,
  );
  const items = outputs
    .map(
      (item, idx) => `
      <div class="rounded-xl border border-slate-200 bg-white px-3 py-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-semibold text-slate-800">${escapeHtml(
            `${idx + 1}. ${item.command || "-"}`,
          )}</span>
          <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
            item.success
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }">${escapeHtml(
            item.success
              ? tr("orchestrationStatusSuccess", "Success")
              : tr("orchestrationStatusFailed", "Failed"),
          )}</span>
        </div>
        <div class="mt-2 text-xs text-slate-500">exit_code=${escapeHtml(
          safeString(item.exit_code),
        )}</div>
        <pre class="output mt-2">${escapeHtml(safeString(item.output || item.error || ""))}</pre>
        ${renderParsedOutputBlock(item)}
      </div>`,
    )
    .join("");
  return `${summary}${exportButton ? `<div class="mb-2 flex justify-end">${exportButton}</div>` : ""}${items ? `<div class="grid gap-2">${items}</div>` : ""}`;
}

async function withLoading(buttonOrId, handler) {
  if (typeof window.withButtonLoading === "function") {
    return window.withButtonLoading(buttonOrId, handler);
  }
  const button =
    typeof buttonOrId === "string"
      ? document.getElementById(buttonOrId)
      : buttonOrId;
  const previousDisabled = button?.disabled;
  if (button) button.disabled = true;
  try {
    return await handler();
  } finally {
    if (button) button.disabled = previousDisabled;
  }
}

export function templatesBehavior(node) {
  let cachedTemplateMetas = [];
  let cachedTemplates = [];
  let cachedFlowTemplateMetas = [];
  let cachedFlowTemplateNames = [];
  let cachedBuiltinFlowTemplateMetas = [];
  let cachedTextfsmTemplateMetas = [];
  let cachedTextfsmTemplateNames = [];
  let cachedTextfsmMappings = [];
  let cachedShowObjectTextfsmMappings = [];
  let cachedCustomShowObjects = [];
  let cachedDeviceProfileNames = [];
  let cachedShowObjectModes = [];
  let cachedShowObjectDefaultMode = "";
  let lastTemplateDetail = null;
  let lastFlowTemplateDetail = null;
  let lastBuiltinFlowTemplateDetail = null;
  let lastTextfsmTemplateDetail = null;

  const byId = (id) =>
    node.querySelector(`#${id}`) || document.getElementById(id);

  function syncRuntimeSnapshot() {
    window.setTemplateRuntimeSnapshots?.({
      templates: cachedTemplates,
      metas: cachedTemplateMetas,
      detail: lastTemplateDetail,
    });
  }

  function syncFlowRuntimeSnapshot() {
    window.setFlowTemplateRuntimeSnapshots?.({
      names: cachedFlowTemplateNames,
      metas: cachedFlowTemplateMetas,
      builtinMetas: cachedBuiltinFlowTemplateMetas,
      detail: lastFlowTemplateDetail,
      builtinDetail: lastBuiltinFlowTemplateDetail,
    });
  }

  function renderTemplateList(errorMessage = "") {
    const out = byId("template-list");
    if (!out) return;
    if (errorMessage) {
      out.innerHTML = statusCard(errorMessage, "error");
      return;
    }
    if (
      !Array.isArray(cachedTemplateMetas) ||
      cachedTemplateMetas.length === 0
    ) {
      out.innerHTML = statusCard(
        tr("templateListEmpty", "No templates"),
        "info",
      );
      return;
    }
    const selectedName = byId("template-pick-name")?.value.trim() || "";
    out.innerHTML = cachedTemplateMetas
      .map((item) => {
        const active = selectedName && item.name === selectedName;
        const cls = active
          ? "border-teal-300 bg-teal-50/70"
          : "border-slate-200 bg-white hover:border-slate-300";
        return `
          <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-template-row ${cls}" data-name="${escapeHtml(
            item.name || "",
          )}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-slate-800">${escapeHtml(
                item.name || "-",
              )}</span>
              <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">${escapeHtml(
                tr("templateUseBtn", "Use"),
              )}</span>
            </div>
          </button>`;
      })
      .join("");
  }

  function renderTemplateOptions(selectedName = "") {
    populateSelect(byId("template-pick-name"), cachedTemplates, {
      placeholder: tr("templateSelectPlaceholder", "Select template"),
      selected: selectedName,
    });
    populateSelect(document.getElementById("template"), cachedTemplates, {
      placeholder: tr("templateSelectPlaceholder", "Select template"),
      selected: document.getElementById("template")?.value || "",
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

  function renderFlowTemplateList(errorMessage = "") {
    const out = byId("flow-template-list");
    if (!out) return;
    if (errorMessage) {
      out.innerHTML = statusCard(errorMessage, "error");
      return;
    }
    if (
      !Array.isArray(cachedFlowTemplateMetas) ||
      cachedFlowTemplateMetas.length === 0
    ) {
      out.innerHTML = statusCard(
        tr("flowTemplateListEmpty", "No command flow templates"),
        "info",
      );
      return;
    }
    const selectedName = byId("flow-template-picker")?.value.trim() || "";
    out.innerHTML = cachedFlowTemplateMetas
      .map((item) => {
        const active = selectedName && item.name === selectedName;
        const cls = active
          ? "border-teal-300 bg-teal-50/70"
          : "border-slate-200 bg-white hover:border-slate-300";
        return `
          <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-flow-template-row ${cls}" data-name="${escapeHtml(
            item.name || "",
          )}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-slate-800">${escapeHtml(
                item.name || "-",
              )}</span>
              <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">${escapeHtml(
                tr("flowTemplateUseBtn", "Use"),
              )}</span>
            </div>
          </button>`;
      })
      .join("");
  }

  function renderBuiltinFlowTemplateList(errorMessage = "") {
    const out = byId("flow-template-builtin-list");
    if (!out) return;
    if (errorMessage) {
      out.innerHTML = statusCard(errorMessage, "error");
      return;
    }
    if (
      !Array.isArray(cachedBuiltinFlowTemplateMetas) ||
      cachedBuiltinFlowTemplateMetas.length === 0
    ) {
      out.innerHTML = statusCard(
        tr(
          "flowBuiltinTemplateListEmpty",
          "No built-in command flow templates",
        ),
        "info",
      );
      return;
    }
    const selectedName =
      byId("flow-template-builtin-picker")?.value.trim() || "";
    out.innerHTML = cachedBuiltinFlowTemplateMetas
      .map((item) => {
        const active = selectedName && item.name === selectedName;
        const cls = active
          ? "border-cyan-300 bg-cyan-50/60"
          : "border-slate-200 bg-white hover:border-slate-300";
        return `
          <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-flow-builtin-template-row ${cls}" data-name="${escapeHtml(
            item.name || "",
          )}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-sm font-semibold text-slate-800">${escapeHtml(
                item.name || "-",
              )}</span>
              <span class="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700">${escapeHtml(
                tr("builtinLabel", "Built-in"),
              )}</span>
            </div>
          </button>`;
      })
      .join("");
  }

  function renderFlowTemplateOptions() {
    const builtinRunValues = cachedBuiltinFlowTemplateMetas
      .map((item) => buildBuiltinFlowTemplateValue(item.name))
      .filter(Boolean);
    const runTemplateValues = [...cachedFlowTemplateNames, ...builtinRunValues];

    populateSelect(byId("flow-template-picker"), cachedFlowTemplateNames, {
      placeholder: tr(
        "flowTemplateSelectPlaceholder",
        "Select command flow template",
      ),
      selected: byId("flow-template-picker")?.value || "",
    });
    populateSelect(
      byId("flow-template-builtin-picker"),
      cachedBuiltinFlowTemplateMetas.map((item) => item.name).filter(Boolean),
      {
        placeholder: tr(
          "flowBuiltinTemplateSelectPlaceholder",
          "Select built-in command flow template",
        ),
        selected: byId("flow-template-builtin-picker")?.value || "",
      },
    );
    populateSelect(
      document.getElementById("flow-template-name"),
      runTemplateValues,
      {
        placeholder: tr(
          "flowTemplateRunPlaceholder",
          "Select command flow template",
        ),
        selected: document.getElementById("flow-template-name")?.value || "",
      },
    );
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
      lastBuiltinFlowTemplateDetail = null;
      syncFlowRuntimeSnapshot();
      if (byId("flow-template-builtin-content")) {
        byId("flow-template-builtin-content").value = "";
      }
      renderFlowTemplateOptions();
      renderFlowTemplateList(error.message);
      renderBuiltinFlowTemplateList(error.message);
    }
  }

  async function loadBuiltinFlowTemplateDetailFromWeb(nameOverride = "") {
    const name = safeString(
      nameOverride || byId("flow-template-builtin-picker")?.value || "",
    ).trim();
    if (!name) {
      lastBuiltinFlowTemplateDetail = null;
      syncFlowRuntimeSnapshot();
      if (byId("flow-template-builtin-content")) {
        byId("flow-template-builtin-content").value = "";
      }
      setStatus("flow-template-out", "-", "info");
      renderBuiltinFlowTemplateList();
      return null;
    }
    setStatus("flow-template-out", tr("running", "running"), "running");
    try {
      const data = await getTemplateResource(FLOW_BUILTIN_TEMPLATE_BASE, name);
      lastBuiltinFlowTemplateDetail = data;
      syncFlowRuntimeSnapshot();
      ensureSelectValue(
        byId("flow-template-builtin-picker"),
        data.name || name,
      );
      byId("flow-template-builtin-content").value = data.content || "";
      renderBuiltinFlowTemplateList();
      setStatus(
        "flow-template-out",
        `${tr("loaded", "Loaded")}: ${data.name || name}`,
        "success",
      );
      return data;
    } catch (error) {
      lastBuiltinFlowTemplateDetail = null;
      syncFlowRuntimeSnapshot();
      if (byId("flow-template-builtin-content")) {
        byId("flow-template-builtin-content").value = "";
      }
      renderBuiltinFlowTemplateList();
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
    lastFlowTemplateDetail = {
      ...detail,
      name: targetName,
    };
    syncFlowRuntimeSnapshot();
    renderFlowTemplateList();
    setStatus(
      "flow-template-out",
      `${tr("flowBuiltinTemplateCopied", "Copied")}: ${detail.name} -> ${targetName}`,
      "success",
    );
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
      lastFlowTemplateDetail = data;
      syncFlowRuntimeSnapshot();
      ensureSelectValue(byId("flow-template-picker"), data.name || name);
      byId("flow-template-content").value = data.content || "";
      renderFlowTemplateVarsIfSelected(data.name || name, data);
      renderFlowTemplateList();
      setStatus(
        "flow-template-out",
        `${tr("loaded", "Loaded")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      lastFlowTemplateDetail = null;
      syncFlowRuntimeSnapshot();
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
      const exists = cachedFlowTemplateNames.includes(name);
      const data = exists
        ? await updateTemplateResource(FLOW_TEMPLATE_BASE, name, content)
        : await createTemplateResource(FLOW_TEMPLATE_BASE, name, content);
      setStatus(
        "flow-template-out",
        `${exists ? tr("saved", "Saved") : tr("created", "Created")}: ${data.name || name}`,
        "success",
      );
      await loadFlowTemplatesFromWeb();
      ensureSelectValue(byId("flow-template-picker"), data.name || name);
      lastFlowTemplateDetail = data;
      byId("flow-template-content").value = data.content || content;
      syncFlowRuntimeSnapshot();
      renderFlowTemplateVarsIfSelected(data.name || name, data);
      renderFlowTemplateList();
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
      await loadFlowTemplatesFromWeb();
      ensureSelectValue(byId("flow-template-picker"), data.name || name);
      if (editor) {
        editor.value = data.content || draftContent;
      }
      lastFlowTemplateDetail = data;
      syncFlowRuntimeSnapshot();
      renderFlowTemplateVarsIfSelected(data.name || name, data);
      renderFlowTemplateList();
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
      lastFlowTemplateDetail = null;
      syncFlowRuntimeSnapshot();
      renderFlowTemplateList();
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
      await loadFlowTemplatesFromWeb();
      if ((byId("flow-template-picker")?.value.trim() || "") === name) {
        byId("flow-template-picker").value = "";
      }
      if (
        (document.getElementById("flow-template-name")?.value.trim() || "") ===
        name
      ) {
        window.renderFlowTemplateVarFields?.(null, {});
      }
      lastFlowTemplateDetail = null;
      syncFlowRuntimeSnapshot();
      renderFlowTemplateList();
    } catch (error) {
      setStatus("flow-template-out", error.message, "error");
    }
  }

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

  function renderDeviceProfileOptions() {
    const profiles = (
      cachedDeviceProfileNames.length
        ? cachedDeviceProfileNames
        : Array.isArray(window.cachedDeviceProfiles)
          ? window.cachedDeviceProfiles
          : []
    ).filter((name) => name && name !== "autodetect");
    populateSelect(byId("textfsm-mapping-profile"), profiles, {
      placeholder: tr(
        "inventoryProfileSelectPlaceholder",
        "Select a device profile",
      ),
      selected: byId("textfsm-mapping-profile")?.value || "",
    });
    populateSelect(byId("show-object-profile"), profiles, {
      placeholder: tr(
        "inventoryProfileSelectPlaceholder",
        "Select a device profile",
      ),
      selected: byId("show-object-profile")?.value || "",
    });
  }

  function renderShowObjectModeOptions(selectedMode = "") {
    populateSelect(byId("show-object-mode"), cachedShowObjectModes, {
      selected:
        selectedMode ||
        byId("show-object-mode")?.value ||
        cachedShowObjectDefaultMode ||
        "",
      allowEmpty: false,
    });
  }

  async function loadShowObjectModeOptionsFromWeb(
    profileOverride = "",
    selectedMode = "",
  ) {
    const profile = safeString(
      profileOverride || byId("show-object-profile")?.value || "",
    ).trim();
    if (!profile) {
      cachedShowObjectModes = [];
      cachedShowObjectDefaultMode = "";
      renderShowObjectModeOptions(selectedMode);
      return;
    }
    try {
      const data = await getProfileModes(profile);
      cachedShowObjectModes = Array.isArray(data?.modes)
        ? data.modes.filter(Boolean)
        : [];
      cachedShowObjectDefaultMode = data?.default_mode || "";
    } catch (_) {
      cachedShowObjectModes = [];
      cachedShowObjectDefaultMode = "";
    }
    renderShowObjectModeOptions(selectedMode);
  }

  function renderShowObjectTextfsmMappingOptions() {
    const select = byId("show-object-textfsm-mapping");
    if (!select) return;
    const selected = select.value || "";
    const options = [
      `<option value="">${escapeHtml(
        tr(
          "showObjectMappingSelectPlaceholder",
          "Select profile command mapping",
        ),
      )}</option>`,
      ...cachedShowObjectTextfsmMappings.map((item) => {
        const command = safeString(item.command || "");
        const template = safeString(item.template_name || "");
        return `<option value="${escapeHtml(command)}" data-template="${escapeHtml(
          template,
        )}">${escapeHtml(command)} → ${escapeHtml(template || "-")}</option>`;
      }),
    ];
    select.innerHTML = options.join("");
    if (
      selected &&
      cachedShowObjectTextfsmMappings.some(
        (item) => safeString(item.command || "") === selected,
      )
    ) {
      select.value = selected;
    }
    if (byId("show-object-use-mapping")?.checked) {
      applyShowObjectTextfsmMappingSelection();
    }
  }

  function syncShowObjectMappingRefFromCommand() {
    if (byId("show-object-use-mapping")?.checked) return;
    const select = byId("show-object-textfsm-mapping");
    const command = byId("show-object-command")?.value.trim() || "";
    if (!select) return;
    const matched = cachedShowObjectTextfsmMappings.some(
      (item) => safeString(item.command || "") === command,
    );
    select.value = matched ? command : "";
  }

  function applyShowObjectTextfsmMappingSelection() {
    const select = byId("show-object-textfsm-mapping");
    if (!select) return;
    const command = select.value || "";
    if (!command) return;
    byId("show-object-command").value = command;
    ensureSelectValue(byId("show-object-textfsm-template"), "");
  }

  function syncShowObjectInputMode() {
    const useMapping = !!byId("show-object-use-mapping")?.checked;
    const manualFields = byId("show-object-manual-fields");
    const mappingFields = byId("show-object-mapping-fields");
    if (manualFields) manualFields.hidden = useMapping;
    if (mappingFields) mappingFields.hidden = !useMapping;

    if (useMapping) {
      ensureSelectValue(byId("show-object-textfsm-template"), "");
      applyShowObjectTextfsmMappingSelection();
    } else {
      ensureSelectValue(byId("show-object-textfsm-mapping"), "");
    }
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

  function renderTextfsmMappingList(errorMessage = "") {
    const out = byId("textfsm-mapping-list");
    if (!out) return;
    if (errorMessage) {
      out.innerHTML = statusCard(errorMessage, "error");
      return;
    }
    if (!cachedTextfsmMappings.length) {
      out.innerHTML = statusCard(
        tr("textfsmMappingListEmpty", "No custom TextFSM mappings"),
        "info",
      );
      return;
    }
    const selectedProfile = byId("textfsm-mapping-profile")?.value.trim() || "";
    const selectedCommand = byId("textfsm-mapping-command")?.value.trim() || "";
    out.innerHTML = cachedTextfsmMappings
      .map((item) => {
        const active =
          selectedProfile === safeString(item.device_profile) &&
          selectedCommand === safeString(item.command);
        const cls = active
          ? "border-cyan-300 bg-cyan-50/70"
          : "border-slate-200 bg-white hover:border-slate-300";
        return `
          <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-textfsm-mapping-row ${cls}" data-profile="${escapeHtml(
            item.device_profile || "",
          )}" data-command="${escapeHtml(
            item.command || "",
          )}" data-template="${escapeHtml(item.template_name || "")}">
            <div class="grid gap-1">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-semibold text-slate-800">${escapeHtml(
                  item.device_profile || "-",
                )}</span>
                <span class="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700">${escapeHtml(
                  item.template_name || "-",
                )}</span>
              </div>
              <div class="break-all font-mono text-xs text-slate-600">${escapeHtml(
                item.command || "-",
              )}</div>
            </div>
          </button>`;
      })
      .join("");
  }

  function renderCustomShowObjectList(errorMessage = "") {
    const out = byId("show-object-list");
    if (!out) return;
    if (errorMessage) {
      out.innerHTML = statusCard(errorMessage, "error");
      return;
    }
    if (!cachedCustomShowObjects.length) {
      out.innerHTML = statusCard(
        tr("showObjectCustomListEmpty", "No custom show objects"),
        "info",
      );
      return;
    }
    const selectedProfile = byId("show-object-profile")?.value.trim() || "";
    const selectedObject = byId("show-object-name")?.value.trim() || "";
    out.innerHTML = cachedCustomShowObjects
      .map((item) => {
        const active =
          selectedProfile === safeString(item.device_profile) &&
          selectedObject === safeString(item.object);
        const cls = active
          ? "border-emerald-300 bg-emerald-50/70"
          : "border-slate-200 bg-white hover:border-slate-300";
        const enabledTone = item.enabled
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500";
        return `
          <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-show-object-row ${cls}" data-profile="${escapeHtml(
            item.device_profile || "",
          )}" data-object="${escapeHtml(item.object || "")}" data-command="${escapeHtml(
            item.command || "",
          )}" data-textfsm-mapping-command="${escapeHtml(
            item.textfsm_mapping_command || "",
          )}" data-mode="${escapeHtml(item.mode || "")}" data-template="${escapeHtml(
            item.textfsm_template_name || "",
          )}" data-enabled="${item.enabled ? "true" : "false"}">
            <div class="grid gap-1">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-semibold text-slate-800">${escapeHtml(
                  `${item.device_profile || "-"} / ${item.object || "-"}`,
                )}</span>
                <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${enabledTone}">${escapeHtml(
                  item.enabled
                    ? tr("enabled", "Enabled")
                    : tr("disabled", "Disabled"),
                )}</span>
              </div>
              <div class="break-all font-mono text-xs text-slate-600">${escapeHtml(
                item.command || "-",
              )}</div>
              <div class="text-xs text-slate-500">mode=${escapeHtml(
                item.mode || "-",
              )} · mapping=${escapeHtml(
                item.textfsm_mapping_command || "-",
              )} · textfsm=${escapeHtml(item.textfsm_template_name || "-")}</div>
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
    } catch (error) {
      cachedTextfsmTemplateMetas = [];
      cachedTextfsmTemplateNames = [];
      lastTextfsmTemplateDetail = null;
      renderTextfsmTemplateOptions();
      renderTextfsmTemplateList(error.message);
    }
  }

  async function loadDeviceProfileOptionsFromWeb() {
    try {
      const data = await getDeviceProfilesOverview();
      cachedDeviceProfileNames = [
        ...(Array.isArray(data?.builtins) ? data.builtins : []).map(
          (item) => item.name,
        ),
        ...(Array.isArray(data?.custom) ? data.custom : []).map(
          (item) => item.name,
        ),
      ].filter(
        (name, index, values) => !!name && values.indexOf(name) === index,
      );
      window.cachedDeviceProfiles = cachedDeviceProfileNames;
      renderDeviceProfileOptions();
      loadShowObjectModeOptionsFromWeb();
      window.renderTextfsmPlatformOptions?.();
    } catch (_) {
      cachedDeviceProfileNames = Array.isArray(window.cachedDeviceProfiles)
        ? window.cachedDeviceProfiles
        : [];
      renderDeviceProfileOptions();
      loadShowObjectModeOptionsFromWeb();
      window.renderTextfsmPlatformOptions?.();
    }
  }

  async function loadTextfsmMappingsFromWeb(profileOverride = "") {
    const profile = safeString(
      profileOverride || byId("textfsm-mapping-profile")?.value || "",
    ).trim();
    try {
      const data = await listTextfsmMappings(profile);
      cachedTextfsmMappings = Array.isArray(data) ? data : [];
      renderTextfsmMappingList();
    } catch (error) {
      cachedTextfsmMappings = [];
      renderTextfsmMappingList(error.message);
    }
  }

  async function loadShowObjectTextfsmMappingsFromWeb(profileOverride = "") {
    const profile = safeString(
      profileOverride || byId("show-object-profile")?.value || "",
    ).trim();
    try {
      const data = await listTextfsmMappings(profile);
      cachedShowObjectTextfsmMappings = Array.isArray(data) ? data : [];
      renderShowObjectTextfsmMappingOptions();
      syncShowObjectMappingRefFromCommand();
    } catch (_) {
      cachedShowObjectTextfsmMappings = [];
      renderShowObjectTextfsmMappingOptions();
    }
  }

  async function loadCustomShowObjectsFromWeb(profileOverride = "") {
    const profile = safeString(
      profileOverride || byId("show-object-profile")?.value || "",
    ).trim();
    try {
      const data = await listCustomShowObjects(profile);
      cachedCustomShowObjects = Array.isArray(data) ? data : [];
      renderCustomShowObjectList();
    } catch (error) {
      cachedCustomShowObjects = [];
      renderCustomShowObjectList(error.message);
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
      renderTextfsmMappingList();
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
      await loadTextfsmMappingsFromWeb();
      setStatus(
        "textfsm-template-out",
        `${tr("deleted", "Deleted")}: ${name}`,
        "success",
      );
    } catch (error) {
      setStatus("textfsm-template-out", error.message, "error");
    }
  }

  async function saveTextfsmMappingFromWeb() {
    const deviceProfile = byId("textfsm-mapping-profile")?.value.trim() || "";
    const command = byId("textfsm-mapping-command")?.value.trim() || "";
    const templateName = byId("textfsm-mapping-template")?.value.trim() || "";
    if (!deviceProfile || !command || !templateName) {
      setStatus(
        "textfsm-mapping-out",
        tr(
          "textfsmMappingRequired",
          "profile, command, and template are required",
        ),
        "error",
      );
      return;
    }
    setStatus("textfsm-mapping-out", tr("running", "running"), "running");
    try {
      const data = await saveTextfsmMapping({
        device_profile: deviceProfile,
        command,
        template_name: templateName,
      });
      await loadTextfsmMappingsFromWeb(deviceProfile);
      await loadShowObjectTextfsmMappingsFromWeb(deviceProfile);
      ensureSelectValue(byId("textfsm-mapping-template"), data.template_name);
      renderTextfsmMappingList();
      setStatus(
        "textfsm-mapping-out",
        `${tr("saved", "Saved")}: ${data.device_profile} / ${data.command}`,
        "success",
      );
    } catch (error) {
      setStatus("textfsm-mapping-out", error.message, "error");
    }
  }

  async function deleteTextfsmMappingFromWeb() {
    const deviceProfile = byId("textfsm-mapping-profile")?.value.trim() || "";
    const command = byId("textfsm-mapping-command")?.value.trim() || "";
    if (!deviceProfile || !command) {
      setStatus(
        "textfsm-mapping-out",
        tr("textfsmMappingDeleteRequired", "profile and command are required"),
        "error",
      );
      return;
    }
    setStatus("textfsm-mapping-out", tr("running", "running"), "running");
    try {
      await deleteTextfsmMapping({
        device_profile: deviceProfile,
        command,
      });
      byId("textfsm-mapping-command").value = "";
      await loadTextfsmMappingsFromWeb(deviceProfile);
      await loadShowObjectTextfsmMappingsFromWeb(deviceProfile);
      setStatus(
        "textfsm-mapping-out",
        `${tr("deleted", "Deleted")}: ${deviceProfile} / ${command}`,
        "success",
      );
    } catch (error) {
      setStatus("textfsm-mapping-out", error.message, "error");
    }
  }

  async function saveCustomShowObjectFromWeb() {
    const deviceProfile = byId("show-object-profile")?.value.trim() || "";
    const object = byId("show-object-name")?.value.trim() || "";
    const useMapping = !!byId("show-object-use-mapping")?.checked;
    const manualCommand = byId("show-object-command")?.value.trim() || "";
    const mode = byId("show-object-mode")?.value.trim() || "";
    const textfsmMappingCommand =
      byId("show-object-textfsm-mapping")?.value.trim() || "";
    const textfsmTemplateName =
      byId("show-object-textfsm-template")?.value.trim() || "";
    const enabled = !!byId("show-object-enabled")?.checked;
    const command = useMapping ? textfsmMappingCommand : manualCommand;
    if (!deviceProfile || !object) {
      setStatus(
        "show-object-out",
        tr(
          "showObjectCustomRequired",
          "profile, object, and command are required",
        ),
        "error",
      );
      return;
    }
    if (!mode) {
      setStatus(
        "show-object-out",
        tr("showObjectModeRequired", "mode is required"),
        "error",
      );
      return;
    }
    if (useMapping && !textfsmMappingCommand) {
      setStatus(
        "show-object-out",
        tr("showObjectMappingRequired", "profile command mapping is required"),
        "error",
      );
      return;
    }
    if (!command) {
      setStatus(
        "show-object-out",
        tr(
          "showObjectCustomRequired",
          "profile, object, and command are required",
        ),
        "error",
      );
      return;
    }
    setStatus("show-object-out", tr("running", "running"), "running");
    try {
      const data = await saveCustomShowObject({
        device_profile: deviceProfile,
        object,
        command,
        mode: mode || null,
        textfsm_mapping_command: useMapping ? textfsmMappingCommand : null,
        textfsm_template_name: useMapping ? null : textfsmTemplateName || null,
        enabled,
      });
      await loadCustomShowObjectsFromWeb(deviceProfile);
      await window.loadShowObjects?.();
      byId("show-object-name").value = data.object || object;
      byId("show-object-command").value = data.command || command;
      ensureSelectValue(byId("show-object-mode"), data.mode || "");
      ensureSelectValue(
        byId("show-object-textfsm-mapping"),
        data.textfsm_mapping_command || "",
      );
      byId("show-object-use-mapping").checked = !!data.textfsm_mapping_command;
      byId("show-object-enabled").checked = data.enabled !== false;
      ensureSelectValue(
        byId("show-object-textfsm-template"),
        data.textfsm_template_name || "",
      );
      syncShowObjectInputMode();
      renderCustomShowObjectList();
      setStatus(
        "show-object-out",
        `${tr("saved", "Saved")}: ${data.device_profile} / ${data.object}`,
        "success",
      );
    } catch (error) {
      setStatus("show-object-out", error.message, "error");
    }
  }

  async function deleteCustomShowObjectFromWeb() {
    const deviceProfile = byId("show-object-profile")?.value.trim() || "";
    const object = byId("show-object-name")?.value.trim() || "";
    if (!deviceProfile || !object) {
      setStatus(
        "show-object-out",
        tr("showObjectCustomDeleteRequired", "profile and object are required"),
        "error",
      );
      return;
    }
    setStatus("show-object-out", tr("running", "running"), "running");
    try {
      await deleteCustomShowObject({
        device_profile: deviceProfile,
        object,
      });
      byId("show-object-name").value = "";
      byId("show-object-command").value = "";
      byId("show-object-mode").value = "";
      ensureSelectValue(byId("show-object-textfsm-mapping"), "");
      ensureSelectValue(byId("show-object-textfsm-template"), "");
      byId("show-object-use-mapping").checked = false;
      byId("show-object-enabled").checked = true;
      syncShowObjectInputMode();
      await loadCustomShowObjectsFromWeb(deviceProfile);
      await window.loadShowObjects?.();
      setStatus(
        "show-object-out",
        `${tr("deleted", "Deleted")}: ${deviceProfile} / ${object}`,
        "success",
      );
    } catch (error) {
      setStatus("show-object-out", error.message, "error");
    }
  }

  async function selectTextfsmTemplateName(name) {
    if (!name) return;
    ensureSelectValue(byId("textfsm-template-picker"), name);
    renderTextfsmTemplateList();
    await loadTextfsmTemplateDetailFromWeb(name);
    renderTextfsmTemplateList();
  }

  function selectTextfsmMapping(row) {
    if (!row) return;
    byId("textfsm-mapping-profile").value =
      row.getAttribute("data-profile") || "";
    byId("textfsm-mapping-command").value =
      row.getAttribute("data-command") || "";
    ensureSelectValue(
      byId("textfsm-mapping-template"),
      row.getAttribute("data-template") || "",
    );
    renderTextfsmMappingList();
  }

  async function selectCustomShowObject(row) {
    if (!row) return;
    const profile = row.getAttribute("data-profile") || "";
    const mappingCommand =
      row.getAttribute("data-textfsm-mapping-command") || "";
    const mode = row.getAttribute("data-mode") || "";
    byId("show-object-profile").value = profile;
    byId("show-object-name").value = row.getAttribute("data-object") || "";
    byId("show-object-command").value = row.getAttribute("data-command") || "";
    await loadShowObjectModeOptionsFromWeb(profile, mode);
    await loadShowObjectTextfsmMappingsFromWeb(profile);
    ensureSelectValue(byId("show-object-textfsm-mapping"), mappingCommand);
    ensureSelectValue(
      byId("show-object-textfsm-template"),
      row.getAttribute("data-template") || "",
    );
    byId("show-object-use-mapping").checked = !!mappingCommand;
    byId("show-object-enabled").checked =
      (row.getAttribute("data-enabled") || "true") !== "false";
    syncShowObjectInputMode();
    renderCustomShowObjectList();
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

  async function selectFlowTemplateName(name) {
    if (!name) return;
    ensureSelectValue(byId("flow-template-picker"), name);
    renderFlowTemplateList();
    await loadFlowTemplateDetailFromWeb();
    renderFlowTemplateList();
  }

  async function selectBuiltinFlowTemplateName(name) {
    if (!name) return;
    ensureSelectValue(byId("flow-template-builtin-picker"), name);
    renderBuiltinFlowTemplateList();
    await loadBuiltinFlowTemplateDetailFromWeb(name);
    renderBuiltinFlowTemplateList();
  }

  function onFlowTemplateListClick(event) {
    const row = event.target.closest(".js-flow-template-row");
    if (!row) return;
    selectFlowTemplateName(row.getAttribute("data-name") || "");
  }

  function onBuiltinFlowTemplateListClick(event) {
    const row = event.target.closest(".js-flow-builtin-template-row");
    if (!row) return;
    selectBuiltinFlowTemplateName(row.getAttribute("data-name") || "");
  }

  function onTextfsmTemplateListClick(event) {
    const row = event.target.closest(".js-textfsm-template-row");
    if (!row) return;
    selectTextfsmTemplateName(row.getAttribute("data-name") || "");
  }

  function onTextfsmMappingListClick(event) {
    const row = event.target.closest(".js-textfsm-mapping-row");
    if (!row) return;
    selectTextfsmMapping(row);
  }

  function onCustomShowObjectListClick(event) {
    const row = event.target.closest(".js-show-object-row");
    if (!row) return;
    selectCustomShowObject(row);
  }

  async function onFlowTemplatePickerChange() {
    if (!(byId("flow-template-picker")?.value.trim() || "")) return;
    await loadFlowTemplateDetailFromWeb();
    renderFlowTemplateList();
  }

  async function onBuiltinFlowTemplatePickerChange() {
    if (!(byId("flow-template-builtin-picker")?.value.trim() || "")) {
      if (byId("flow-template-builtin-content")) {
        byId("flow-template-builtin-content").value = "";
      }
      renderBuiltinFlowTemplateList();
      return;
    }
    await loadBuiltinFlowTemplateDetailFromWeb();
    renderBuiltinFlowTemplateList();
  }

  async function onTextfsmTemplatePickerChange() {
    if (!(byId("textfsm-template-picker")?.value.trim() || "")) return;
    await loadTextfsmTemplateDetailFromWeb();
    renderTextfsmTemplateList();
  }

  const list = byId("template-list");
  const picker = byId("template-pick-name");
  const newBtn = byId("template-new-btn");
  const saveBtn = byId("template-save-btn");
  const deleteBtn = byId("template-delete-btn");
  const flowList = byId("flow-template-list");
  const builtinFlowList = byId("flow-template-builtin-list");
  const flowPicker = byId("flow-template-picker");
  const builtinFlowPicker = byId("flow-template-builtin-picker");
  const flowNewBtn = byId("flow-template-new-btn");
  const flowSaveBtn = byId("flow-template-save-btn");
  const flowDeleteBtn = byId("flow-template-delete-btn");
  const builtinDetailBtn = byId("flow-template-builtin-detail-btn");
  const builtinCopyBtn = byId("flow-template-builtin-copy-btn");
  const textfsmTemplateList = byId("textfsm-template-list");
  const textfsmTemplatePicker = byId("textfsm-template-picker");
  const textfsmTemplateNewBtn = byId("textfsm-template-new-btn");
  const textfsmTemplateSaveBtn = byId("textfsm-template-save-btn");
  const textfsmTemplateDeleteBtn = byId("textfsm-template-delete-btn");
  const textfsmMappingList = byId("textfsm-mapping-list");
  const textfsmMappingProfile = byId("textfsm-mapping-profile");
  const textfsmMappingRefreshBtn = byId("textfsm-mapping-refresh-btn");
  const textfsmMappingSaveBtn = byId("textfsm-mapping-save-btn");
  const textfsmMappingDeleteBtn = byId("textfsm-mapping-delete-btn");
  const customShowObjectList = byId("show-object-list");
  const customShowObjectProfile = byId("show-object-profile");
  const customShowObjectUseMapping = byId("show-object-use-mapping");
  const customShowObjectTextfsmMapping = byId("show-object-textfsm-mapping");
  const customShowObjectCommand = byId("show-object-command");
  const customShowObjectRefreshBtn = byId("show-object-refresh-btn");
  const customShowObjectSaveBtn = byId("show-object-save-btn");
  const customShowObjectDeleteBtn = byId("show-object-delete-btn");

  const onNewClick = () =>
    withLoading("template-new-btn", createTemplateDraftFromWeb);
  const onSaveClick = () =>
    withLoading("template-save-btn", saveTemplateFromWeb);
  const onDeleteClick = () =>
    withLoading("template-delete-btn", deleteTemplateFromWeb);
  const onFlowNewClick = () =>
    withLoading("flow-template-new-btn", createFlowTemplateDraftFromWeb);
  const onFlowSaveClick = () =>
    withLoading("flow-template-save-btn", saveFlowTemplateFromWeb);
  const onFlowDeleteClick = () =>
    withLoading("flow-template-delete-btn", deleteFlowTemplateFromWeb);
  const onBuiltinDetailClick = () =>
    withLoading("flow-template-builtin-detail-btn", () =>
      loadBuiltinFlowTemplateDetailFromWeb(),
    );
  const onBuiltinCopyClick = () =>
    withLoading(
      "flow-template-builtin-copy-btn",
      copyBuiltinFlowTemplateToCustomFromWeb,
    );
  const onTextfsmTemplateNewClick = () =>
    withLoading("textfsm-template-new-btn", createTextfsmTemplateDraftFromWeb);
  const onTextfsmTemplateSaveClick = () =>
    withLoading("textfsm-template-save-btn", saveTextfsmTemplateFromWeb);
  const onTextfsmTemplateDeleteClick = () =>
    withLoading("textfsm-template-delete-btn", deleteTextfsmTemplateFromWeb);
  const onTextfsmMappingRefreshClick = () =>
    withLoading("textfsm-mapping-refresh-btn", () =>
      loadTextfsmMappingsFromWeb(),
    );
  const onTextfsmMappingProfileChange = () => loadTextfsmMappingsFromWeb();
  const onTextfsmMappingSaveClick = () =>
    withLoading("textfsm-mapping-save-btn", saveTextfsmMappingFromWeb);
  const onTextfsmMappingDeleteClick = () =>
    withLoading("textfsm-mapping-delete-btn", deleteTextfsmMappingFromWeb);
  const onCustomShowObjectRefreshClick = () =>
    withLoading("show-object-refresh-btn", () =>
      loadCustomShowObjectsFromWeb(),
    );
  const onCustomShowObjectProfileChange = () => {
    loadCustomShowObjectsFromWeb();
    loadShowObjectTextfsmMappingsFromWeb();
    loadShowObjectModeOptionsFromWeb();
  };
  const onCustomShowObjectTextfsmMappingChange = () =>
    applyShowObjectTextfsmMappingSelection();
  const onCustomShowObjectUseMappingChange = () => syncShowObjectInputMode();
  const onCustomShowObjectCommandInput = () =>
    syncShowObjectMappingRefFromCommand();
  const onCustomShowObjectSaveClick = () =>
    withLoading("show-object-save-btn", saveCustomShowObjectFromWeb);
  const onCustomShowObjectDeleteClick = () =>
    withLoading("show-object-delete-btn", deleteCustomShowObjectFromWeb);

  list?.addEventListener("click", onTemplateListClick);
  picker?.addEventListener("change", onTemplatePickerChange);
  newBtn?.addEventListener("click", onNewClick);
  saveBtn?.addEventListener("click", onSaveClick);
  deleteBtn?.addEventListener("click", onDeleteClick);
  flowList?.addEventListener("click", onFlowTemplateListClick);
  builtinFlowList?.addEventListener("click", onBuiltinFlowTemplateListClick);
  flowPicker?.addEventListener("change", onFlowTemplatePickerChange);
  builtinFlowPicker?.addEventListener(
    "change",
    onBuiltinFlowTemplatePickerChange,
  );
  flowNewBtn?.addEventListener("click", onFlowNewClick);
  flowSaveBtn?.addEventListener("click", onFlowSaveClick);
  flowDeleteBtn?.addEventListener("click", onFlowDeleteClick);
  builtinDetailBtn?.addEventListener("click", onBuiltinDetailClick);
  builtinCopyBtn?.addEventListener("click", onBuiltinCopyClick);
  textfsmTemplateList?.addEventListener("click", onTextfsmTemplateListClick);
  textfsmTemplatePicker?.addEventListener(
    "change",
    onTextfsmTemplatePickerChange,
  );
  textfsmTemplateNewBtn?.addEventListener("click", onTextfsmTemplateNewClick);
  textfsmTemplateSaveBtn?.addEventListener("click", onTextfsmTemplateSaveClick);
  textfsmTemplateDeleteBtn?.addEventListener(
    "click",
    onTextfsmTemplateDeleteClick,
  );
  textfsmMappingList?.addEventListener("click", onTextfsmMappingListClick);
  textfsmMappingProfile?.addEventListener(
    "change",
    onTextfsmMappingProfileChange,
  );
  textfsmMappingRefreshBtn?.addEventListener(
    "click",
    onTextfsmMappingRefreshClick,
  );
  textfsmMappingSaveBtn?.addEventListener("click", onTextfsmMappingSaveClick);
  textfsmMappingDeleteBtn?.addEventListener(
    "click",
    onTextfsmMappingDeleteClick,
  );
  customShowObjectList?.addEventListener("click", onCustomShowObjectListClick);
  customShowObjectProfile?.addEventListener(
    "change",
    onCustomShowObjectProfileChange,
  );
  customShowObjectUseMapping?.addEventListener(
    "change",
    onCustomShowObjectUseMappingChange,
  );
  customShowObjectTextfsmMapping?.addEventListener(
    "change",
    onCustomShowObjectTextfsmMappingChange,
  );
  customShowObjectCommand?.addEventListener(
    "input",
    onCustomShowObjectCommandInput,
  );
  customShowObjectRefreshBtn?.addEventListener(
    "click",
    onCustomShowObjectRefreshClick,
  );
  customShowObjectSaveBtn?.addEventListener(
    "click",
    onCustomShowObjectSaveClick,
  );
  customShowObjectDeleteBtn?.addEventListener(
    "click",
    onCustomShowObjectDeleteClick,
  );

  window.renderTemplateList = renderTemplateList;
  window.renderTemplateOptions = renderTemplateOptions;
  window.loadTemplates = loadTemplatesFromWeb;
  window.loadTemplateDetail = loadTemplateDetailFromWeb;
  window.saveTemplate = saveTemplateFromWeb;
  window.createTemplateDraft = createTemplateDraftFromWeb;
  window.deleteTemplate = deleteTemplateFromWeb;
  window.renderFlowTemplateList = renderFlowTemplateList;
  window.renderBuiltinFlowTemplateList = renderBuiltinFlowTemplateList;
  window.renderFlowTemplateOptions = renderFlowTemplateOptions;
  window.loadFlowTemplates = loadFlowTemplatesFromWeb;
  window.loadBuiltinFlowTemplateDetail = loadBuiltinFlowTemplateDetailFromWeb;
  window.copyBuiltinFlowTemplateToCustom =
    copyBuiltinFlowTemplateToCustomFromWeb;
  window.loadFlowTemplateDetail = loadFlowTemplateDetailFromWeb;
  window.saveFlowTemplate = saveFlowTemplateFromWeb;
  window.createFlowTemplateDraft = createFlowTemplateDraftFromWeb;
  window.deleteFlowTemplate = deleteFlowTemplateFromWeb;
  window.loadTextfsmTemplates = loadTextfsmTemplatesFromWeb;
  window.loadTextfsmMappings = loadTextfsmMappingsFromWeb;
  window.loadShowObjectTextfsmMappings = loadShowObjectTextfsmMappingsFromWeb;
  window.renderShowObjectTextfsmMappingOptions =
    renderShowObjectTextfsmMappingOptions;
  window.loadCustomShowObjects = loadCustomShowObjectsFromWeb;
  window.loadTemplateProfileOptions = loadDeviceProfileOptionsFromWeb;
  window.renderCommandFlowResult = renderCommandFlowResult;

  syncRuntimeSnapshot();
  syncFlowRuntimeSnapshot();
  renderDeviceProfileOptions();
  loadDeviceProfileOptionsFromWeb();
  renderTemplateList();
  renderFlowTemplateList();
  renderBuiltinFlowTemplateList();
  renderTextfsmTemplateList();
  renderTextfsmMappingList();
  renderShowObjectTextfsmMappingOptions();
  renderShowObjectModeOptions();
  syncShowObjectInputMode();
  renderCustomShowObjectList();

  return {
    destroy() {
      list?.removeEventListener("click", onTemplateListClick);
      picker?.removeEventListener("change", onTemplatePickerChange);
      newBtn?.removeEventListener("click", onNewClick);
      saveBtn?.removeEventListener("click", onSaveClick);
      deleteBtn?.removeEventListener("click", onDeleteClick);
      flowList?.removeEventListener("click", onFlowTemplateListClick);
      builtinFlowList?.removeEventListener(
        "click",
        onBuiltinFlowTemplateListClick,
      );
      flowPicker?.removeEventListener("change", onFlowTemplatePickerChange);
      builtinFlowPicker?.removeEventListener(
        "change",
        onBuiltinFlowTemplatePickerChange,
      );
      flowNewBtn?.removeEventListener("click", onFlowNewClick);
      flowSaveBtn?.removeEventListener("click", onFlowSaveClick);
      flowDeleteBtn?.removeEventListener("click", onFlowDeleteClick);
      builtinDetailBtn?.removeEventListener("click", onBuiltinDetailClick);
      builtinCopyBtn?.removeEventListener("click", onBuiltinCopyClick);
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
      textfsmMappingList?.removeEventListener(
        "click",
        onTextfsmMappingListClick,
      );
      textfsmMappingProfile?.removeEventListener(
        "change",
        onTextfsmMappingProfileChange,
      );
      textfsmMappingRefreshBtn?.removeEventListener(
        "click",
        onTextfsmMappingRefreshClick,
      );
      textfsmMappingSaveBtn?.removeEventListener(
        "click",
        onTextfsmMappingSaveClick,
      );
      textfsmMappingDeleteBtn?.removeEventListener(
        "click",
        onTextfsmMappingDeleteClick,
      );
      customShowObjectList?.removeEventListener(
        "click",
        onCustomShowObjectListClick,
      );
      customShowObjectProfile?.removeEventListener(
        "change",
        onCustomShowObjectProfileChange,
      );
      customShowObjectUseMapping?.removeEventListener(
        "change",
        onCustomShowObjectUseMappingChange,
      );
      customShowObjectTextfsmMapping?.removeEventListener(
        "change",
        onCustomShowObjectTextfsmMappingChange,
      );
      customShowObjectCommand?.removeEventListener(
        "input",
        onCustomShowObjectCommandInput,
      );
      customShowObjectRefreshBtn?.removeEventListener(
        "click",
        onCustomShowObjectRefreshClick,
      );
      customShowObjectSaveBtn?.removeEventListener(
        "click",
        onCustomShowObjectSaveClick,
      );
      customShowObjectDeleteBtn?.removeEventListener(
        "click",
        onCustomShowObjectDeleteClick,
      );
    },
  };
}
