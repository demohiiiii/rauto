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
    <div role="alert" class="alert alert-error">
      <div class="grid gap-2">
        <div class="font-medium">${escapeHtml(t("invalidModeTitle"))}: ${escapeHtml(parsed.invalidMode)}</div>
        <div class="grid gap-1 text-xs">
          <div><span class="font-medium">${escapeHtml(t("invalidModeProfile"))}:</span> ${escapeHtml(parsed.profile)}</div>
          <div><span class="font-medium">${escapeHtml(t("invalidModeDefault"))}:</span> ${escapeHtml(parsed.defaultMode)}</div>
        </div>
        <div>
          <div class="mb-1 text-xs font-medium uppercase tracking-wide">${escapeHtml(
            t("invalidModeAvailable")
          )}</div>
          <div class="flex flex-wrap gap-1.5">${badges}</div>
        </div>
        <div class="text-xs">${escapeHtml(t("invalidModeHint"))}</div>
      </div>
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
      ? "alert-success"
      : tone === "warning"
        ? "alert-warning"
        : tone === "error"
          ? "alert-error"
          : "alert-info";
  const leading =
    tone === "running"
      ? `<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>`
      : "";
  return `
    <div role="alert" class="alert ${cls}">
      ${leading}
      <span class="break-all whitespace-pre-wrap">${escapeHtml(text)}</span>
    </div>
  `;
}

function renderStatusToast(message, tone = "info") {
  const text = safeString(message || "-");
  const cls =
    tone === "success"
      ? "alert-success"
      : tone === "warning"
        ? "alert-warning"
        : tone === "error"
          ? "alert-error"
          : "alert-info";
  const icon =
    tone === "success"
      ? "✓"
      : tone === "warning"
        ? "!"
        : tone === "error"
          ? "×"
          : "i";
  return `
    <div role="alert" class="app-toast pointer-events-auto alert ${cls}" data-tone="${escapeHtml(
      tone
    )}">
      <span class="app-toast-icon" aria-hidden="true">${escapeHtml(icon)}</span>
      <div class="min-w-0 flex-1">
        <div class="app-toast-message">${escapeHtml(text)}</div>
      </div>
      <button type="button" class="js-toast-close btn btn-ghost btn-xs" aria-label="${escapeHtml(
        t("close")
      )}">✕</button>
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
