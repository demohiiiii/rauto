/**
 * templates_json.js - JSON template management (tx block / workflow / orchestration)
 */

const JSON_TEMPLATE_MANAGERS = {
  tx_block: {
    kind: "tx_block",
    apiBase: "/api/tx-block-templates",
    runSelectId: "tx-block-template-name",
    emptyKey: "txBlockTemplateListEmpty",
    newPromptKey: "txBlockTemplateNewPrompt",
    nameRequiredKey: "txBlockTemplateNameRequired",
    runStage: "block",
    runOutId: "tx-plan-out",
  },
  tx_workflow: {
    kind: "tx_workflow",
    apiBase: "/api/tx-workflow-templates",
    runSelectId: "tx-workflow-template-name",
    emptyKey: "txWorkflowTemplateListEmpty",
    newPromptKey: "txWorkflowTemplateNewPrompt",
    nameRequiredKey: "txWorkflowTemplateNameRequired",
    runStage: "workflow",
    runOutId: "tx-workflow-plan-out",
    runEditorId: "tx-workflow-json",
  },
  orchestration: {
    kind: "orchestration",
    apiBase: "/api/orchestration-templates",
    runSelectId: "orchestration-template-name",
    emptyKey: "orchestrationTemplateListEmpty",
    newPromptKey: "orchestrationTemplateNewPrompt",
    nameRequiredKey: "orchestrationTemplateNameRequired",
    runStage: "orchestrate",
    runOutId: "orchestration-plan-out",
    runEditorId: "orchestration-json",
  },
};

function jsonTemplateConfig(kind) {
  return JSON_TEMPLATE_MANAGERS[kind] || null;
}

function setJsonTemplateCache(kind, items) {
  const names = items.map((item) => item.name);
  if (kind === "tx_block") {
    cachedTxBlockTemplateMetas = items;
    cachedTxBlockTemplateNames = names;
    return;
  }
  if (kind === "tx_workflow") {
    cachedTxWorkflowTemplateMetas = items;
    cachedTxWorkflowTemplateNames = names;
    return;
  }
  if (kind === "orchestration") {
    cachedOrchestrationTemplateMetas = items;
    cachedOrchestrationTemplateNames = names;
  }
}

function getJsonTemplateMetas(kind) {
  if (kind === "tx_block") return cachedTxBlockTemplateMetas || [];
  if (kind === "tx_workflow") return cachedTxWorkflowTemplateMetas || [];
  if (kind === "orchestration") return cachedOrchestrationTemplateMetas || [];
  return [];
}

function getJsonTemplateNames(kind) {
  if (kind === "tx_block") return cachedTxBlockTemplateNames || [];
  if (kind === "tx_workflow") return cachedTxWorkflowTemplateNames || [];
  if (kind === "orchestration") return cachedOrchestrationTemplateNames || [];
  return [];
}

function renderJsonTemplateOptionsByKind(kind) {
  const cfg = jsonTemplateConfig(kind);
  if (!cfg) return;
  const selectedPicker = byId(cfg.pickerId)?.value || "";
  const selectedRun = byId(cfg.runSelectId)?.value || "";
  const names = getJsonTemplateNames(kind);
  populateSelectOptions(cfg.pickerId, names, {
    placeholder: t("templateSelectPlaceholder"),
    selected: selectedPicker,
  });
  populateSelectOptions(cfg.runSelectId, names, {
    placeholder: t("templateSelectPlaceholder"),
    selected: selectedRun,
  });
}

function renderJsonTemplateListByKind(kind, errorMessage = "") {
  const cfg = jsonTemplateConfig(kind);
  if (!cfg) return;
  const out = byId(cfg.listId);
  if (!out) return;
  if (errorMessage) {
    out.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      errorMessage
    )}</div>`;
    return;
  }
  const metas = getJsonTemplateMetas(kind);
  if (!Array.isArray(metas) || metas.length === 0) {
    out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t(cfg.emptyKey)
    )}</div>`;
    return;
  }
  const selectedName = byId(cfg.pickerId)?.value?.trim() || "";
  out.innerHTML = metas
    .map((item) => {
      const active = selectedName && item.name === selectedName;
      const cls = active
        ? "border-teal-300 bg-teal-50/70"
        : "border-slate-200 bg-white hover:border-slate-300";
      return `
        <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-json-template-row ${cls}" data-manager="${escapeHtml(
          kind
        )}" data-name="${escapeHtml(item.name || "")}">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm font-semibold text-slate-800">${escapeHtml(
              item.name || "-"
            )}</span>
            <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">${escapeHtml(
              t("templateUseBtn")
            )}</span>
          </div>
        </button>
      `;
    })
    .join("");
}

async function loadJsonTemplatesByKind(kind) {
  const cfg = jsonTemplateConfig(kind);
  if (!cfg) return;
  try {
    const data = await request("GET", cfg.apiBase);
    const items = Array.isArray(data) ? data : [];
    setJsonTemplateCache(kind, items);
    renderJsonTemplateOptionsByKind(kind);
    renderJsonTemplateListByKind(kind);
  } catch (e) {
    setJsonTemplateCache(kind, []);
    renderJsonTemplateOptionsByKind(kind);
    renderJsonTemplateListByKind(kind, e.message);
  }
}

async function loadTxBlockTemplates() {
  await loadJsonTemplatesByKind("tx_block");
  if (typeof renderTxWorkflowBuilder === "function") {
    renderTxWorkflowBuilder();
  }
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

function setPrettyJsonToTextarea(id, rawContent) {
  if (id === "tx-block-json" && typeof setTxBlockEditorRawText === "function") {
    const text = String(rawContent || "").trim();
    if (!text) {
      setTxBlockEditorRawText("");
      return;
    }
    try {
      setTxBlockEditorRawText(JSON.stringify(JSON.parse(text), null, 2));
    } catch (_) {
      setTxBlockEditorRawText(text);
    }
    return;
  }
  if (id === "tx-workflow-json" && typeof setTxWorkflowEditorText === "function") {
    const text = String(rawContent || "").trim();
    if (!text) {
      setTxWorkflowEditorText("", { notify: true });
      return;
    }
    try {
      setTxWorkflowEditorText(JSON.stringify(JSON.parse(text), null, 2), {
        notify: true,
      });
    } catch (_) {
      setTxWorkflowEditorText(text, { notify: true });
    }
    return;
  }
  if (id === "orchestration-json" && typeof setOrchestrationEditorText === "function") {
    const text = String(rawContent || "").trim();
    if (!text) {
      setOrchestrationEditorText("", { notify: true });
      return;
    }
    try {
      setOrchestrationEditorText(JSON.stringify(JSON.parse(text), null, 2), {
        notify: true,
      });
    } catch (_) {
      setOrchestrationEditorText(text, { notify: true });
    }
    return;
  }
  const textarea = byId(id);
  if (!textarea) return;
  const text = String(rawContent || "").trim();
  if (!text) {
    textarea.value = "";
    return;
  }
  try {
    textarea.value = JSON.stringify(JSON.parse(text), null, 2);
  } catch (_) {
    textarea.value = text;
  }
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

async function loadTxBlockTemplateIntoEditorByName(nameOverride = "") {
  const name = (nameOverride || byId("tx-block-template-name")?.value || "").trim();
  if (!name) {
    setStatusMessage("tx-plan-out", t("txBlockTemplateNameRequired"), "error");
    return null;
  }
  setStatusMessage("tx-plan-out", t("running"), "running");
  try {
    const data = await request("GET", `/api/tx-block-templates/${encodeURIComponent(name)}`);
    ensureSelectValue("tx-block-template-name", data.name || name);
    setPrettyJsonToTextarea("tx-block-json", data.content || "");
    setStatusMessage("tx-plan-out", `${t("loaded")}: ${data.name || name}`, "success");
    return data;
  } catch (e) {
    setStatusMessage("tx-plan-out", e.message, "error");
    return null;
  }
}

async function saveTxBlockTemplateFromEditor() {
  const name = (byId("tx-block-template-name")?.value || "").trim();
  if (!name) {
    setStatusMessage("tx-plan-out", t("txBlockTemplateNameRequired"), "error");
    return;
  }
  setStatusMessage("tx-plan-out", t("running"), "running");
  try {
    const content = JSON.stringify(buildTxBlockTemplatePayloadFromEditor(), null, 2);
    const exists = getJsonTemplateNames("tx_block").includes(name);
    const data = exists
      ? await request("PUT", `/api/tx-block-templates/${encodeURIComponent(name)}`, {
          content,
        })
      : await request("POST", "/api/tx-block-templates", { name, content });
    await loadTxBlockTemplates();
    ensureSelectValue("tx-block-template-name", data.name || name);
    setStatusMessage("tx-plan-out", `${exists ? t("saved") : t("created")}: ${data.name || name}`, "success");
  } catch (e) {
    setStatusMessage("tx-plan-out", e.message, "error");
  }
}

async function deleteTxBlockTemplateFromManager() {
  const name = (byId("tx-block-template-name")?.value || "").trim();
  if (!name) {
    setStatusMessage("tx-plan-out", t("txBlockTemplateNameRequired"), "error");
    return;
  }
  setStatusMessage("tx-plan-out", t("running"), "running");
  try {
    await request("DELETE", `/api/tx-block-templates/${encodeURIComponent(name)}`);
    await loadTxBlockTemplates();
    ensureSelectValue("tx-block-template-name", "");
    setStatusMessage("tx-plan-out", `${t("deleted")}: ${name}`, "success");
  } catch (e) {
    setStatusMessage("tx-plan-out", e.message, "error");
  }
}

async function createTxBlockTemplateDraftFromManager() {
  const name = promptForResourceName(t("txBlockTemplateNewPrompt"));
  if (!name) return;
  if (getJsonTemplateNames("tx_block").includes(name)) {
    ensureSelectValue("tx-block-template-name", name);
    await loadSelectedTxBlockTemplateForExecution();
    setStatusMessage("tx-plan-out", t("templateExistsHint"), "warning");
    return;
  }
  txBlockViewMode = "template";
  if (typeof applyTxBlockViewMode === "function") {
    applyTxBlockViewMode();
  }
  setStatusMessage("tx-plan-out", t("running"), "running");
  try {
    const content = JSON.stringify(buildTxBlockTemplatePayloadFromEditor(), null, 2);
    const data = await request("POST", "/api/tx-block-templates", { name, content });
    await loadTxBlockTemplates();
    ensureSelectValue("tx-block-template-name", data.name || name);
    setStatusMessage("tx-plan-out", `${t("created")}: ${data.name || name}`, "success");
  } catch (e) {
    setStatusMessage("tx-plan-out", e.message, "error");
  }
}

async function loadSelectedTxBlockTemplateForExecution() {
  const name = (byId("tx-block-template-name")?.value || "").trim();
  if (!name) {
    setStatusMessage("tx-plan-out", t("txBlockTemplateNameRequired"), "error");
    return null;
  }
  return loadTxBlockTemplateIntoEditorByName(name);
}

function txWorkflowTemplateExecutionContent() {
  let raw =
    typeof txWorkflowEditorRaw === "function"
      ? txWorkflowEditorRaw().trim()
      : (byId("tx-workflow-json")?.value || "").trim();
  if (!raw) {
    throw new Error(t("txWorkflowJsonRequired"));
  }
  const normalized = JSON.stringify(JSON.parse(raw), null, 2);
  if (typeof setTxWorkflowEditorText === "function") {
    setTxWorkflowEditorText(normalized, { notify: true });
  } else {
    byId("tx-workflow-json").value = normalized;
  }
  return normalized;
}

async function loadSelectedTxWorkflowTemplateForExecution() {
  const name = (byId("tx-workflow-template-name")?.value || "").trim();
  if (!name) {
    setStatusMessage("tx-workflow-plan-out", t("txWorkflowTemplateNameRequired"), "error");
    return null;
  }
  setStatusMessage("tx-workflow-plan-out", t("running"), "running");
  try {
    const detail = await request(
      "GET",
      `/api/tx-workflow-templates/${encodeURIComponent(name)}`
    );
    if (detail && detail.content) {
      setPrettyJsonToTextarea("tx-workflow-json", detail.content);
      if (typeof renderTxWorkflowPreviewFromEditor === "function") {
        renderTxWorkflowPreviewFromEditor();
      }
    }
    setStatusMessage("tx-workflow-plan-out", `${t("loaded")}: ${detail?.name || name}`, "success");
    return detail;
  } catch (e) {
    setStatusMessage("tx-workflow-plan-out", e.message, "error");
    return null;
  }
}

async function saveTxWorkflowTemplateFromExecution() {
  const name = (byId("tx-workflow-template-name")?.value || "").trim();
  if (!name) {
    setStatusMessage("tx-workflow-plan-out", t("txWorkflowTemplateNameRequired"), "error");
    return;
  }
  setStatusMessage("tx-workflow-plan-out", t("running"), "running");
  try {
    const content = txWorkflowTemplateExecutionContent();
    const exists = getJsonTemplateNames("tx_workflow").includes(name);
    const data = exists
      ? await request("PUT", `/api/tx-workflow-templates/${encodeURIComponent(name)}`, {
          content,
        })
      : await request("POST", "/api/tx-workflow-templates", { name, content });
    await loadJsonTemplatesByKind("tx_workflow");
    ensureSelectValue("tx-workflow-template-name", data.name || name);
    setStatusMessage(
      "tx-workflow-plan-out",
      `${exists ? t("saved") : t("created")}: ${data.name || name}`,
      "success"
    );
  } catch (e) {
    setStatusMessage("tx-workflow-plan-out", e.message, "error");
  }
}

async function deleteTxWorkflowTemplateFromExecution() {
  const name = (byId("tx-workflow-template-name")?.value || "").trim();
  if (!name) {
    setStatusMessage("tx-workflow-plan-out", t("txWorkflowTemplateNameRequired"), "error");
    return;
  }
  setStatusMessage("tx-workflow-plan-out", t("running"), "running");
  try {
    await request("DELETE", `/api/tx-workflow-templates/${encodeURIComponent(name)}`);
    await loadJsonTemplatesByKind("tx_workflow");
    ensureSelectValue("tx-workflow-template-name", "");
    setStatusMessage("tx-workflow-plan-out", `${t("deleted")}: ${name}`, "success");
  } catch (e) {
    setStatusMessage("tx-workflow-plan-out", e.message, "error");
  }
}

async function createTxWorkflowTemplateDraftFromExecution() {
  const name = promptForResourceName(t("txWorkflowTemplateNewPrompt"));
  if (!name) return;
  if (getJsonTemplateNames("tx_workflow").includes(name)) {
    ensureSelectValue("tx-workflow-template-name", name);
    await loadSelectedTxWorkflowTemplateForExecution();
    setStatusMessage("tx-workflow-plan-out", t("templateExistsHint"), "warning");
    return;
  }
  txWorkflowViewMode = "template";
  if (typeof applyTxWorkflowViewMode === "function") {
    applyTxWorkflowViewMode();
  }
  setStatusMessage("tx-workflow-plan-out", t("running"), "running");
  try {
    const content = txWorkflowTemplateExecutionContent();
    const data = await request("POST", "/api/tx-workflow-templates", { name, content });
    await loadJsonTemplatesByKind("tx_workflow");
    ensureSelectValue("tx-workflow-template-name", data.name || name);
    setStatusMessage("tx-workflow-plan-out", `${t("created")}: ${data.name || name}`, "success");
  } catch (e) {
    setStatusMessage("tx-workflow-plan-out", e.message, "error");
  }
}

function orchestrationTemplateExecutionContent() {
  const raw =
    typeof orchestrationEditorRaw === "function"
      ? orchestrationEditorRaw().trim()
      : (byId("orchestration-json")?.value || "").trim();
  if (!raw) {
    throw new Error(t("orchestrationJsonRequired"));
  }
  const normalized = JSON.stringify(JSON.parse(raw), null, 2);
  setPrettyJsonToTextarea("orchestration-json", normalized);
  return normalized;
}

async function loadSelectedOrchestrationTemplateForExecution() {
  const name = (byId("orchestration-template-name")?.value || "").trim();
  if (!name) {
    setStatusMessage("orchestration-plan-out", t("orchestrationTemplateNameRequired"), "error");
    return null;
  }
  setStatusMessage("orchestration-plan-out", t("running"), "running");
  try {
    const detail = await request(
      "GET",
      `/api/orchestration-templates/${encodeURIComponent(name)}`
    );
    if (detail && detail.content) {
      setPrettyJsonToTextarea("orchestration-json", detail.content);
      if (typeof renderOrchestrationPreviewFromEditor === "function") {
        renderOrchestrationPreviewFromEditor();
      }
    }
    setStatusMessage(
      "orchestration-plan-out",
      `${t("loaded")}: ${detail?.name || name}`,
      "success"
    );
    return detail;
  } catch (e) {
    setStatusMessage("orchestration-plan-out", e.message, "error");
    return null;
  }
}

async function saveOrchestrationTemplateFromExecution() {
  const name = (byId("orchestration-template-name")?.value || "").trim();
  if (!name) {
    setStatusMessage("orchestration-plan-out", t("orchestrationTemplateNameRequired"), "error");
    return;
  }
  setStatusMessage("orchestration-plan-out", t("running"), "running");
  try {
    const content = orchestrationTemplateExecutionContent();
    const exists = getJsonTemplateNames("orchestration").includes(name);
    const data = exists
      ? await request("PUT", `/api/orchestration-templates/${encodeURIComponent(name)}`, {
          content,
        })
      : await request("POST", "/api/orchestration-templates", { name, content });
    await loadJsonTemplatesByKind("orchestration");
    ensureSelectValue("orchestration-template-name", data.name || name);
    setStatusMessage(
      "orchestration-plan-out",
      `${exists ? t("saved") : t("created")}: ${data.name || name}`,
      "success"
    );
  } catch (e) {
    setStatusMessage("orchestration-plan-out", e.message, "error");
  }
}

async function deleteOrchestrationTemplateFromExecution() {
  const name = (byId("orchestration-template-name")?.value || "").trim();
  if (!name) {
    setStatusMessage("orchestration-plan-out", t("orchestrationTemplateNameRequired"), "error");
    return;
  }
  setStatusMessage("orchestration-plan-out", t("running"), "running");
  try {
    await request("DELETE", `/api/orchestration-templates/${encodeURIComponent(name)}`);
    await loadJsonTemplatesByKind("orchestration");
    ensureSelectValue("orchestration-template-name", "");
    setStatusMessage("orchestration-plan-out", `${t("deleted")}: ${name}`, "success");
  } catch (e) {
    setStatusMessage("orchestration-plan-out", e.message, "error");
  }
}

async function createOrchestrationTemplateDraftFromExecution() {
  const name = promptForResourceName(t("orchestrationTemplateNewPrompt"));
  if (!name) return;
  if (getJsonTemplateNames("orchestration").includes(name)) {
    ensureSelectValue("orchestration-template-name", name);
    await loadSelectedOrchestrationTemplateForExecution();
    setStatusMessage("orchestration-plan-out", t("templateExistsHint"), "warning");
    return;
  }
  orchestrationViewMode = "template";
  if (typeof applyOrchestrationViewMode === "function") {
    applyOrchestrationViewMode();
  }
  setStatusMessage("orchestration-plan-out", t("running"), "running");
  try {
    const content = orchestrationTemplateExecutionContent();
    const data = await request("POST", "/api/orchestration-templates", { name, content });
    await loadJsonTemplatesByKind("orchestration");
    ensureSelectValue("orchestration-template-name", data.name || name);
    setStatusMessage("orchestration-plan-out", `${t("created")}: ${data.name || name}`, "success");
  } catch (e) {
    setStatusMessage("orchestration-plan-out", e.message, "error");
  }
}
