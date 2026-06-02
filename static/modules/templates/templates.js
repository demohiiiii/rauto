/**
 * templates.js — templates
 */

function renderTemplateList(errorMessage = "") {
  const out = byId("template-list");
  if (!out) return;
  if (errorMessage) {
    out.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      errorMessage
    )}</div>`;
    return;
  }
  if (!Array.isArray(cachedTemplateMetas) || cachedTemplateMetas.length === 0) {
    out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("templateListEmpty")
    )}</div>`;
    return;
  }
  const selectedName = byId("template-pick-name").value.trim();
  out.innerHTML = cachedTemplateMetas
    .map((item) => {
      const active = selectedName && item.name === selectedName;
      const cls = active
        ? "border-teal-300 bg-teal-50/70"
        : "border-slate-200 bg-white hover:border-slate-300";
      return `
        <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-template-row ${cls}" data-name="${escapeHtml(
          item.name || ""
        )}">
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

async function loadTemplates() {
  try {
    const data = await request("GET", "/api/templates");
    const items = Array.isArray(data) ? data : [];
    cachedTemplateMetas = items;
    cachedTemplates = items.map((item) => item.name);
    renderTemplateOptions(byId("template-pick-name").value || "");
    renderTemplateList();
  } catch (e) {
    cachedTemplates = [];
    cachedTemplateMetas = [];
    renderTemplateOptions("");
    renderTemplateList(e.message);
  }
}

function renderTemplateOptions(selectedName = "") {
  populateSelectOptions("template-pick-name", cachedTemplates, {
    placeholder: t("templateSelectPlaceholder"),
    selected: selectedName,
  });
  populateSelectOptions("template", cachedTemplates, {
    placeholder: t("templateSelectPlaceholder"),
    selected: byId("template")?.value || "",
  });
}

async function loadTemplateDetail() {
  const name = byId("template-pick-name").value.trim();
  if (!name) {
    setStatusMessage("template-out", t("templateNameRequired"), "error");
    return;
  }
  setStatusMessage("template-out", t("running"), "running");
  try {
    const data = await request("GET", `/api/templates/${encodeURIComponent(name)}`);
    lastTemplateDetail = data;
    byId("template-pick-name").value = data.name || name;
    byId("template-content").value = data.content || "";
    setStatusMessage("template-out", `${t("loaded")}: ${data.name || name}`, "success");
  } catch (e) {
    lastTemplateDetail = null;
    setStatusMessage("template-out", e.message, "error");
  }
}

async function saveTemplate() {
  const name = byId("template-pick-name").value.trim();
  const content = byId("template-content").value;
  if (!name) {
    setStatusMessage("template-out", t("templateNameRequired"), "error");
    return;
  }
  setStatusMessage("template-out", t("running"), "running");
  try {
    const exists = cachedTemplates.includes(name);
    const data = exists
      ? await request("PUT", `/api/templates/${encodeURIComponent(name)}`, { content })
      : await request("POST", "/api/templates", { name, content });
    setStatusMessage(
      "template-out",
      `${exists ? t("saved") : t("created")}: ${data.name || name}`,
      "success"
    );
    await loadTemplates();
    ensureSelectValue("template-pick-name", data.name || name);
    lastTemplateDetail = data;
  } catch (e) {
    setStatusMessage("template-out", e.message, "error");
  }
}

async function createTemplateDraft() {
  const name = promptForResourceName(t("templateNewPrompt"));
  if (!name) return;
  const draftContent = byId("template-content").value || "";
  const exists = cachedTemplates.includes(name);
  if (exists) {
    ensureSelectValue("template-pick-name", name);
    renderTemplateOptions(name);
    renderTemplateList();
    await loadTemplateDetail();
    renderTemplateList();
    setStatusMessage("template-out", t("templateExistsHint"), "info");
    return;
  }
  setStatusMessage("template-out", t("running"), "running");
  try {
    const data = await request("POST", "/api/templates", {
      name,
      content: draftContent,
    });
    await loadTemplates();
    ensureSelectValue("template-pick-name", data.name || name);
    byId("template-content").value = data.content || "";
    lastTemplateDetail = data;
    renderTemplateList();
    setStatusMessage("template-out", `${t("created")}: ${data.name || name}`, "success");
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg.includes("already exists")) {
      ensureSelectValue("template-pick-name", name);
      renderTemplateOptions(name);
      renderTemplateList();
      await loadTemplateDetail();
      renderTemplateList();
      setStatusMessage("template-out", t("templateExistsHint"), "info");
      return;
    }
    setStatusMessage("template-out", msg || t("requestFailed"), "error");
  }
}

async function deleteTemplate() {
  const name = byId("template-pick-name").value.trim();
  if (!name) {
    setStatusMessage("template-out", t("templateNameRequired"), "error");
    return;
  }
  setStatusMessage("template-out", t("running"), "running");
  try {
    await request("DELETE", `/api/templates/${encodeURIComponent(name)}`);
    byId("template-content").value = "";
    setStatusMessage("template-out", `${t("deleted")}: ${name}`, "success");
    await loadTemplates();
    if (byId("template-pick-name").value.trim() === name) {
      byId("template-pick-name").value = "";
    }
    lastTemplateDetail = null;
  } catch (e) {
    setStatusMessage("template-out", e.message, "error");
  }
}

function renderFlowTemplateList(errorMessage = "") {
  const out = byId("flow-template-list");
  if (!out) return;
  if (errorMessage) {
    out.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      errorMessage
    )}</div>`;
    return;
  }
  if (
    !Array.isArray(cachedFlowTemplateMetas) ||
    cachedFlowTemplateMetas.length === 0
  ) {
    out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("flowTemplateListEmpty")
    )}</div>`;
    return;
  }
  const selectedName = byId("flow-template-picker").value.trim();
  out.innerHTML = cachedFlowTemplateMetas
    .map((item) => {
      const active = selectedName && item.name === selectedName;
      const cls = active
        ? "border-teal-300 bg-teal-50/70"
        : "border-slate-200 bg-white hover:border-slate-300";
      return `
        <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-flow-template-row ${cls}" data-name="${escapeHtml(
          item.name || ""
        )}">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm font-semibold text-slate-800">${escapeHtml(
              item.name || "-"
            )}</span>
            <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">${escapeHtml(
              t("flowTemplateUseBtn")
            )}</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderBuiltinFlowTemplateList(errorMessage = "") {
  const out = byId("flow-template-builtin-list");
  if (!out) return;
  if (errorMessage) {
    out.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(
      errorMessage
    )}</div>`;
    return;
  }
  if (
    !Array.isArray(cachedBuiltinFlowTemplateMetas) ||
    cachedBuiltinFlowTemplateMetas.length === 0
  ) {
    out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(
      t("flowBuiltinTemplateListEmpty")
    )}</div>`;
    return;
  }
  const selectedName = byId("flow-template-builtin-picker").value.trim();
  out.innerHTML = cachedBuiltinFlowTemplateMetas
    .map((item) => {
      const active = selectedName && item.name === selectedName;
      const cls = active
        ? "border-cyan-300 bg-cyan-50/60"
        : "border-slate-200 bg-white hover:border-slate-300";
      return `
        <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-flow-builtin-template-row ${cls}" data-name="${escapeHtml(
          item.name || ""
        )}">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm font-semibold text-slate-800">${escapeHtml(
              item.name || "-"
            )}</span>
            <span class="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700">${escapeHtml(
              t("builtinLabel")
            )}</span>
          </div>
        </button>
      `;
    })
    .join("");
}

async function loadFlowTemplates() {
  try {
    const [savedResult, builtinResult] = await Promise.allSettled([
      request("GET", "/api/flow-templates"),
      request("GET", "/api/flow-templates/builtins"),
    ]);
    const savedItems =
      savedResult.status === "fulfilled" && Array.isArray(savedResult.value)
        ? savedResult.value
        : [];
    const builtinItems =
      builtinResult.status === "fulfilled" && Array.isArray(builtinResult.value)
        ? builtinResult.value
        : [];
    cachedFlowTemplateMetas = savedItems;
    cachedFlowTemplateNames = savedItems.map((item) => item.name);
    cachedBuiltinFlowTemplateMetas = builtinItems;
    renderFlowTemplateOptions();
    renderFlowTemplateList();
    renderBuiltinFlowTemplateList();
  } catch (e) {
    cachedFlowTemplateNames = [];
    cachedFlowTemplateMetas = [];
    cachedBuiltinFlowTemplateMetas = [];
    lastBuiltinFlowTemplateDetail = null;
    byId("flow-template-builtin-content").value = "";
    renderFlowTemplateOptions();
    renderFlowTemplateList(e.message);
    renderBuiltinFlowTemplateList(e.message);
  }
}

function renderFlowTemplateOptions() {
  const builtinRunValues = (cachedBuiltinFlowTemplateMetas || [])
    .map((item) => buildBuiltinFlowTemplateValue(item.name))
    .filter(Boolean);
  const runTemplateValues = [...cachedFlowTemplateNames, ...builtinRunValues];

  populateSelectOptions("flow-template-picker", cachedFlowTemplateNames, {
    placeholder: t("flowTemplateSelectPlaceholder"),
    selected: byId("flow-template-picker")?.value || "",
  });
  populateSelectOptions(
    "flow-template-builtin-picker",
    (cachedBuiltinFlowTemplateMetas || []).map((item) => item.name),
    {
      placeholder: t("flowBuiltinTemplateSelectPlaceholder"),
      selected: byId("flow-template-builtin-picker")?.value || "",
    }
  );
  populateSelectOptions("flow-template-name", runTemplateValues, {
    placeholder: t("flowTemplateRunPlaceholder"),
    selected: byId("flow-template-name")?.value || "",
  });
}

async function loadBuiltinFlowTemplateDetail(nameOverride = "") {
  const name = safeString(nameOverride || byId("flow-template-builtin-picker").value || "").trim();
  if (!name) {
    lastBuiltinFlowTemplateDetail = null;
    byId("flow-template-builtin-content").value = "";
    setStatusMessage("flow-template-out", "-", "info");
    renderBuiltinFlowTemplateList();
    return null;
  }
  setStatusMessage("flow-template-out", t("running"), "running");
  try {
    const data = await request(
      "GET",
      `/api/flow-templates/builtins/${encodeURIComponent(name)}`
    );
    lastBuiltinFlowTemplateDetail = data;
    ensureSelectValue("flow-template-builtin-picker", data.name || name);
    byId("flow-template-builtin-content").value = data.content || "";
    renderBuiltinFlowTemplateList();
    setStatusMessage(
      "flow-template-out",
      `${t("loaded")}: ${data.name || name}`,
      "success"
    );
    return data;
  } catch (e) {
    lastBuiltinFlowTemplateDetail = null;
    byId("flow-template-builtin-content").value = "";
    renderBuiltinFlowTemplateList();
    setStatusMessage("flow-template-out", e.message, "error");
    return null;
  }
}

async function copyBuiltinFlowTemplateToCustom() {
  const selectedName = byId("flow-template-builtin-picker").value.trim();
  if (!selectedName) {
    setStatusMessage("flow-template-out", t("flowBuiltinTemplateNameRequired"), "error");
    return;
  }
  let detail = lastBuiltinFlowTemplateDetail;
  if (!detail || safeString(detail.name || "").trim() !== selectedName) {
    detail = await loadBuiltinFlowTemplateDetail(selectedName);
  }
  if (!detail) {
    setStatusMessage("flow-template-out", t("needLoadBuiltinFirst"), "error");
    return;
  }
  const targetName = promptForResourceName(
    t("flowBuiltinTemplateCopyPrompt"),
    `${detail.name}_custom`
  );
  if (!targetName) return;
  ensureSelectValue("flow-template-picker", targetName);
  byId("flow-template-content").value = detail.content || "";
  lastFlowTemplateDetail = {
    ...detail,
    name: targetName,
  };
  renderFlowTemplateList();
  setStatusMessage(
    "flow-template-out",
    `${t("flowBuiltinTemplateCopied")}: ${detail.name} -> ${targetName}`,
    "success"
  );
}

async function loadFlowTemplateDetail() {
  const name = byId("flow-template-picker").value.trim();
  if (!name) {
    setStatusMessage(
      "flow-template-out",
      t("flowTemplateNameRequired"),
      "error"
    );
    return;
  }
  setStatusMessage("flow-template-out", t("running"), "running");
  try {
    const data = await request(
      "GET",
      `/api/flow-templates/${encodeURIComponent(name)}`
    );
    lastFlowTemplateDetail = data;
    byId("flow-template-picker").value = data.name || name;
    byId("flow-template-content").value = data.content || "";
    if (byId("flow-template-name").value.trim() === (data.name || name)) {
      renderFlowTemplateVarFields(data, getCurrentFlowTemplateFieldDraft());
    }
    renderFlowTemplateList();
    setStatusMessage(
      "flow-template-out",
      `${t("loaded")}: ${data.name || name}`,
      "success"
    );
  } catch (e) {
    lastFlowTemplateDetail = null;
    setStatusMessage("flow-template-out", e.message, "error");
  }
}

async function saveFlowTemplate() {
  const name = byId("flow-template-picker").value.trim();
  const content = byId("flow-template-content").value;
  if (!name) {
    setStatusMessage(
      "flow-template-out",
      t("flowTemplateNameRequired"),
      "error"
    );
    return;
  }
  setStatusMessage("flow-template-out", t("running"), "running");
  try {
    const exists = cachedFlowTemplateNames.includes(name);
    const data = exists
      ? await request("PUT", `/api/flow-templates/${encodeURIComponent(name)}`, {
          content,
        })
      : await request("POST", "/api/flow-templates", { name, content });
    setStatusMessage(
      "flow-template-out",
      `${exists ? t("saved") : t("created")}: ${data.name || name}`,
      "success"
    );
    await loadFlowTemplates();
    ensureSelectValue("flow-template-picker", data.name || name);
    lastFlowTemplateDetail = data;
    byId("flow-template-content").value = data.content || content;
    if (byId("flow-template-name").value.trim() === (data.name || name)) {
      renderFlowTemplateVarFields(data, getCurrentFlowTemplateFieldDraft());
    }
    renderFlowTemplateList();
  } catch (e) {
    setStatusMessage("flow-template-out", e.message, "error");
  }
}

async function createFlowTemplateDraft() {
  const name = promptForResourceName(t("flowTemplateNewPrompt"));
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
  const draftContent = currentContent ? (editor?.value || "") : fallbackDraft;
  setStatusMessage("flow-template-out", t("running"), "running");
  try {
    const data = await request("POST", "/api/flow-templates", {
      name,
      content: draftContent,
    });
    await loadFlowTemplates();
    ensureSelectValue("flow-template-picker", data.name || name);
    if (editor) {
      editor.value = data.content || draftContent;
    }
    lastFlowTemplateDetail = data;
    if (byId("flow-template-name").value.trim() === (data.name || name)) {
      renderFlowTemplateVarFields(data, getCurrentFlowTemplateFieldDraft());
    }
    renderFlowTemplateList();
    setStatusMessage(
      "flow-template-out",
      `${t("created")}: ${data.name || name}`,
      "success"
    );
  } catch (e) {
    ensureSelectValue("flow-template-picker", name);
    if (editor) {
      editor.value = draftContent;
    }
    lastFlowTemplateDetail = null;
    renderFlowTemplateList();
    setStatusMessage("flow-template-out", e.message, "error");
  }
}

async function deleteFlowTemplate() {
  const name = byId("flow-template-picker").value.trim();
  if (!name) {
    setStatusMessage(
      "flow-template-out",
      t("flowTemplateNameRequired"),
      "error"
    );
    return;
  }
  setStatusMessage("flow-template-out", t("running"), "running");
  try {
    await request("DELETE", `/api/flow-templates/${encodeURIComponent(name)}`);
    byId("flow-template-content").value = "";
    setStatusMessage("flow-template-out", `${t("deleted")}: ${name}`, "success");
    await loadFlowTemplates();
    if (byId("flow-template-picker").value.trim() === name) {
      byId("flow-template-picker").value = "";
    }
    if (byId("flow-template-name").value.trim() === name) {
      renderFlowTemplateVarFields(null, {});
    }
    lastFlowTemplateDetail = null;
    renderFlowTemplateList();
  } catch (e) {
    setStatusMessage("flow-template-out", e.message, "error");
  }
}

function uploadPayload() {
  const timeoutRaw = Number(byId("upload-timeout-secs").value || 300);
  const bufferInput = (byId("upload-buffer-size").value || "").trim();
  const bufferRaw = bufferInput ? Number(bufferInput) : null;
  return {
    local_path: byId("upload-local-path").value.trim(),
    remote_path: byId("upload-remote-path").value.trim(),
    timeout_secs: Number.isFinite(timeoutRaw) ? timeoutRaw : 300,
    buffer_size:
      bufferRaw !== null && Number.isFinite(bufferRaw) ? bufferRaw : null,
    show_progress: !!byId("upload-show-progress").checked,
    connection: connectionPayload(),
    record_level: recordLevelPayload(),
  };
}

function renderCommandFlowResult(data) {
  const outputs = Array.isArray(data && data.outputs) ? data.outputs : [];
  const tone = data && data.success ? "success" : "error";
  const summary = renderStatusMessageCard(
    `${data && data.success ? t("orchestrationStatusSuccess") : t("orchestrationStatusFailed")} · template=${safeString(
      data && data.template_name
    )}`,
    tone
  );
  const items = outputs
    .map(
      (item, idx) => `
      <div class="rounded-xl border border-slate-200 bg-white px-3 py-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-semibold text-slate-800">${escapeHtml(`${idx + 1}. ${item.command || "-"}`)}</span>
          <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
            item.success
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }">${escapeHtml(item.success ? t("orchestrationStatusSuccess") : t("orchestrationStatusFailed"))}</span>
        </div>
        <div class="mt-2 text-xs text-slate-500">exit_code=${escapeHtml(safeString(item.exit_code))}</div>
        <pre class="output mt-2">${escapeHtml(
          safeString(item.output || item.error || "")
        )}</pre>
        ${renderParsedOutputBlock(item)}
      </div>
    `
    )
    .join("");
  return `${summary}${items ? `<div class="grid gap-2">${items}</div>` : ""}`;
}

function renderUploadResult(data) {
  return renderStatusMessageCard(
    `${data && data.ok ? "ok" : t("orchestrationStatusFailed")} · ${safeString(
      data && data.local_path
    )} -> ${safeString(data && data.remote_path)}`,
    data && data.ok ? "success" : "error"
  );
}
