/**
 * render_common.js - Shared HTML render helpers
 */

function renderModeValidationCard(message) {
  const parsed = parseModeValidationMessage(message);
  if (!parsed) return null;
  const badges = parsed.availableModes.length
    ? parsed.availableModes
        .map(
          (mode) =>
            `<span class="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">${escapeHtml(
              mode
            )}</span>`
        )
        .join(" ")
    : `<span class="text-xs text-rose-600">-</span>`;
  return `
    <div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      <div class="font-medium">${escapeHtml(t("invalidModeTitle"))}: ${escapeHtml(parsed.invalidMode)}</div>
      <div class="mt-2 space-y-1 text-xs">
        <div><span class="font-medium">${escapeHtml(t("invalidModeProfile"))}:</span> ${escapeHtml(parsed.profile)}</div>
        <div><span class="font-medium">${escapeHtml(t("invalidModeDefault"))}:</span> ${escapeHtml(parsed.defaultMode)}</div>
      </div>
      <div class="mt-3">
        <div class="mb-1 text-xs font-medium uppercase tracking-wide text-rose-600">${escapeHtml(
          t("invalidModeAvailable")
        )}</div>
        <div class="flex flex-wrap gap-1.5">${badges}</div>
      </div>
      <div class="mt-3 text-xs text-rose-600">${escapeHtml(t("invalidModeHint"))}</div>
    </div>
  `;
}

function renderStatusMessageCard(message, tone = "info") {
  if (tone === "error") {
    const modeCard = renderModeValidationCard(message);
    if (modeCard) return modeCard;
  }
  const text = safeString(message || "-");
  const cls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : tone === "running"
          ? "border-cyan-200 bg-cyan-50 text-cyan-700"
          : "border-slate-200 bg-slate-50 text-slate-600";
  return `<div class="rounded-xl border px-3 py-2 text-sm ${cls}">${escapeHtml(text)}</div>`;
}

function renderStatusToast(message, tone = "info") {
  const text = safeString(message || "-");
  const cls =
    tone === "success"
      ? "alert-success"
      : tone === "warning"
        ? "alert-warning"
        : "alert-error";
  return `
    <div class="alert ${cls} shadow-lg">
      <span>${escapeHtml(text)}</span>
      <button type="button" class="btn btn-ghost btn-xs js-toast-close" aria-label="Close">×</button>
    </div>
  `;
}

function renderFlowTemplateVarField(field, draftValue, options = {}) {
  const value = draftValue !== undefined ? safeString(draftValue) : defaultFlowVarDraft(field);
  const requiredBadge = field.required
    ? `<span class="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">${escapeHtml(
        t("flowVarRequiredLabel")
      )}</span>`
    : `<span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">${escapeHtml(
        t("flowVarOptionalLabel")
      )}</span>`;
  const typeBadge = `<span class="inline-flex items-center rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">${escapeHtml(
    `${t("flowVarTypeLabel")}: ${flowVarTypeLabel(field.kind)}`
  )}</span>`;
  const description = field.description
    ? `<div class="text-xs text-slate-500">${escapeHtml(field.description)}</div>`
    : "";
  const placeholderAttr = field.placeholder
    ? ` placeholder="${escapeHtml(field.placeholder)}"`
    : "";
  const idPrefix = safeString(options.idPrefix || "flow-var").trim() || "flow-var";
  const elementId = `${idPrefix}-${field.name}`;
  let controlHtml = "";

  if (field.options.length && field.kind !== "json" && field.kind !== "boolean") {
    const allowEmpty = !field.required && (field.defaultValue === undefined || field.defaultValue === null);
    const optionsHtml = [
      allowEmpty
        ? `<option value=""></option>`
        : "",
      ...field.options.map((option) => {
        const selected = value === option ? "selected" : "";
        return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(option)}</option>`;
      }),
    ].join("");
    controlHtml = `<select id="${escapeHtml(
      elementId
    )}" class="input" data-flow-var-name="${escapeHtml(field.name)}" data-flow-var-type="${escapeHtml(
      field.kind
    )}">${optionsHtml}</select>`;
  } else if (field.kind === "boolean") {
    const optionsHtml = `
      <option value=""></option>
      <option value="true" ${value === "true" ? "selected" : ""}>true</option>
      <option value="false" ${value === "false" ? "selected" : ""}>false</option>
    `;
    controlHtml = `<select id="${escapeHtml(
      elementId
    )}" class="input" data-flow-var-name="${escapeHtml(field.name)}" data-flow-var-type="boolean">${optionsHtml}</select>`;
  } else if (field.kind === "json") {
    controlHtml = `<textarea id="${escapeHtml(
      elementId
    )}" class="input min-h-24 font-mono" data-flow-var-name="${escapeHtml(
      field.name
    )}" data-flow-var-type="json"${placeholderAttr}>${escapeHtml(value)}</textarea>`;
  } else {
    const inputType = field.kind === "secret" ? "password" : field.kind === "number" ? "number" : "text";
    controlHtml = `<input id="${escapeHtml(
      elementId
    )}" class="input" type="${escapeHtml(inputType)}" value="${escapeHtml(
      value
    )}" data-flow-var-name="${escapeHtml(field.name)}" data-flow-var-type="${escapeHtml(
      field.kind
    )}"${placeholderAttr} />`;
  }

  return `
    <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <div class="text-sm font-semibold text-slate-900">${escapeHtml(field.label)}</div>
        ${requiredBadge}
        ${typeBadge}
      </div>
      ${description}
      <div class="${description ? "mt-2" : ""}">${controlHtml}</div>
    </div>
  `;
}

function renderFlowTemplateVarFields(detail = null, draft = {}) {
  if (detail !== undefined) {
    lastFlowRunTemplateDetail = detail;
  }
  const container = byId("flow-vars-fields");
  const hint = byId("flow-vars-fields-hint");
  if (!container || !hint) return;
  const schema = getFlowRunVarsSchema();
  if (!schema.length) {
    container.innerHTML = "";
    hint.textContent = lastFlowRunTemplateDetail
      ? t("flowVarsFieldsEmpty")
      : t("flowVarsFieldsHint");
    return;
  }
  hint.textContent = t("flowVarsFieldsHint");
  container.innerHTML = schema
    .map((field) => renderFlowTemplateVarField(field, draft[field.name]))
    .join("");
}

function renderFlowTemplateVarFieldsError(message) {
  lastFlowRunTemplateDetail = null;
  const container = byId("flow-vars-fields");
  const hint = byId("flow-vars-fields-hint");
  if (!container || !hint) return;
  container.innerHTML = renderStatusMessageCard(message, "error");
  hint.textContent = t("flowVarsFieldsHint");
}

function renderStatsCards(stats) {
  const cards = [
    [t("statTotal"), stats.total],
    [t("statCommandEvents"), stats.commandEvents],
    [t("statFailedEvents"), stats.failedEvents],
    [t("statKinds"), stats.kinds],
  ];
  return `
    <div class="grid gap-2 md:grid-cols-4">
      ${cards
        .map(
          ([label, value]) => `
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div class="text-xs text-slate-500">${escapeHtml(label)}</div>
              <div class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(value)}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}
