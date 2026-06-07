export function tr(key, fallback = key) {
  return typeof window.t === "function" ? window.t(key) : fallback;
}

export function safeString(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

export function escapeHtml(value) {
  return safeString(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function statusCard(message, tone = "info") {
  if (typeof window.renderStatusMessageCard === "function") {
    return window.renderStatusMessageCard(message, tone);
  }
  const toneClass =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-50 text-slate-600";
  return `<div class="rounded-xl border ${toneClass} px-3 py-2 text-sm">${escapeHtml(message)}</div>`;
}

export function setStatus(id, message, tone = "info") {
  if (typeof window.setStatusMessage === "function") {
    window.setStatusMessage(id, message, tone);
    return;
  }
  const out = document.getElementById(id);
  if (!out) return;
  out.innerHTML = statusCard(message, tone);
}

export function populateSelect(select, values, config = {}) {
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

export function ensureSelectValue(select, value, config = {}) {
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

export function promptResourceName(message, initialValue = "") {
  if (typeof window.promptForResourceName === "function") {
    return window.promptForResourceName(message, initialValue);
  }
  const result = window.prompt(message, initialValue);
  if (result == null) return null;
  const normalized = result.trim();
  return normalized || null;
}

export async function withLoading(buttonOrId, handler) {
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
