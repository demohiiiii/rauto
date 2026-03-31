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

function renderTemplateOptions(keyword = "") {
  const q = keyword.trim().toLowerCase();
  const names = cachedTemplates.filter((name) =>
    !q ? true : name.toLowerCase().includes(q)
  );
  byId("template-options").innerHTML = names
    .map((name) => `<option value="${name}"></option>`)
    .join("");
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
    byId("template-pick-name").value = name;
    lastTemplateDetail = data;
  } catch (e) {
    setStatusMessage("template-out", e.message, "error");
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

async function loadFlowTemplates() {
  try {
    const data = await request("GET", "/api/flow-templates");
    const items = Array.isArray(data) ? data : [];
    cachedFlowTemplateMetas = items;
    cachedFlowTemplateNames = items.map((item) => item.name);
    renderFlowTemplateOptions();
    renderFlowTemplateList();
  } catch (e) {
    cachedFlowTemplateNames = [];
    cachedFlowTemplateMetas = [];
    renderFlowTemplateOptions();
    renderFlowTemplateList(e.message);
  }
}

function renderFlowTemplateOptions() {
  const list = byId("flow-template-options");
  if (!list) return;
  list.innerHTML = cachedFlowTemplateNames
    .map((name) => `<option value="${name}"></option>`)
    .join("");
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
    byId("flow-template-picker").value = name;
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
