import { byId } from "./runtimeGlobals.js";

let connectionVarsRowSeq = 0;

function t(key) {
  return typeof window.t === "function" ? window.t(key) : key;
}

function safeString(value) {
  if (typeof window.safeString === "function") return window.safeString(value);
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function escapeHtml(value) {
  if (typeof window.escapeHtml === "function") return window.escapeHtml(value);
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function connectionVarsConfig(key) {
  const map = {
    "saved-conn-vars": {
      hiddenId: "saved-conn-vars",
      formId: "saved-conn-vars-form",
    },
    "saved-conn-edit-vars": {
      hiddenId: "saved-conn-edit-vars",
      formId: "saved-conn-edit-vars-form",
    },
  };
  return map[key] || null;
}

export function inferConnectionVarType(value) {
  if (value === null) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "string";
}

export function connectionVarValueToInput(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_) {
      return String(value);
    }
  }
  return String(value);
}

export function parseConnectionVarValue(type, rawValue) {
  const value = safeString(rawValue || "");
  if (type === "number") {
    if (!value.trim()) return null;
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error(t("connectionVarNumberInvalid"));
    }
    return number;
  }
  if (type === "boolean") {
    return value === "true";
  }
  if (type === "null") {
    return null;
  }
  return value;
}

export function connectionVarsFromHidden(key) {
  const config = connectionVarsConfig(key);
  const raw = byId(config?.hiddenId || "")?.value.trim() || "";
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(t("inventoryVarsMustBeObject"));
  }
  return parsed;
}

export function setConnectionVarsValue(key, vars = {}, triggerEvents = true) {
  const config = connectionVarsConfig(key);
  const hidden = byId(config?.hiddenId || "");
  if (!config || !hidden) return;
  const normalized =
    vars && typeof vars === "object" && !Array.isArray(vars) ? vars : {};
  hidden.value = JSON.stringify(normalized);
  renderConnectionVarsForm(key, normalized);
  if (triggerEvents) {
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
    hidden.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export function connectionVarsRows(key, options = {}) {
  const { strict = true } = options;
  const config = connectionVarsConfig(key);
  const form = byId(config?.formId || "");
  if (!form) return {};
  const vars = {};
  form.querySelectorAll(".js-connection-vars-row").forEach((row) => {
    const keyInput = row.querySelector(".js-connection-vars-key");
    const typeInput = row.querySelector(".js-connection-vars-type");
    const valueInput = row.querySelector(".js-connection-vars-value");
    const name = safeString(keyInput?.value || "").trim();
    if (!name) return;
    try {
      vars[name] = parseConnectionVarValue(
        safeString(typeInput?.value || "string"),
        valueInput?.value || "",
      );
    } catch (err) {
      if (strict) throw err;
    }
  });
  return vars;
}

export function syncConnectionVarsFromForm(
  key,
  triggerEvents = true,
  options = {},
) {
  const config = connectionVarsConfig(key);
  const hidden = byId(config?.hiddenId || "");
  if (!config || !hidden) return false;
  const vars = connectionVarsRows(key, { strict: !!options.strict });
  hidden.value = JSON.stringify(vars);
  if (triggerEvents) {
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
    hidden.dispatchEvent(new Event("change", { bubbles: true }));
  }
  return true;
}

export function connectionVarRowHtml(key, name = "", value = "") {
  const rowId = `connection-var-${++connectionVarsRowSeq}`;
  const type = inferConnectionVarType(value);
  const renderedValue = connectionVarValueToInput(value);
  return `<div class="connection-vars-row js-connection-vars-row" data-vars-key="${escapeHtml(key)}" data-row-id="${escapeHtml(rowId)}">
    <input class="input input-sm js-connection-vars-key" value="${escapeHtml(name)}" placeholder="${escapeHtml(t("connectionVarKeyPlaceholder"))}" />
    <select class="select select-sm js-connection-vars-type" title="${escapeHtml(t("connectionVarTypeLabel"))}" aria-label="${escapeHtml(t("connectionVarTypeLabel"))}">
      <option value="string"${type === "string" ? " selected" : ""}>${escapeHtml(t("connectionVarTypeString"))}</option>
      <option value="number"${type === "number" ? " selected" : ""}>${escapeHtml(t("connectionVarTypeNumber"))}</option>
      <option value="boolean"${type === "boolean" ? " selected" : ""}>${escapeHtml(t("connectionVarTypeBoolean"))}</option>
      <option value="null"${type === "null" ? " selected" : ""}>${escapeHtml(t("connectionVarTypeNull"))}</option>
    </select>
    <input class="input input-sm js-connection-vars-value" value="${escapeHtml(renderedValue)}" placeholder="${escapeHtml(t("connectionVarValuePlaceholder"))}" />
    <button type="button" class="btn btn-sm connection-vars-remove js-connection-vars-remove" title="${escapeHtml(t("delete"))}" aria-label="${escapeHtml(t("delete"))}">x</button>
  </div>`;
}

export function renderConnectionVarsForm(key, vars = null) {
  const config = connectionVarsConfig(key);
  const form = byId(config?.formId || "");
  if (!config || !form) return;
  let source = vars;
  if (!source) {
    try {
      source = connectionVarsFromHidden(key);
    } catch (_) {
      source = {};
    }
  }
  const entries = Object.entries(source || {});
  if (entries.length === 0) {
    form.innerHTML = `<div class="connection-vars-empty">${escapeHtml(t("connectionVarsEmpty"))}</div>`;
    return;
  }
  form.innerHTML = entries
    .map(([name, value]) => connectionVarRowHtml(key, name, value))
    .join("");
  form
    .querySelectorAll(".js-connection-vars-row")
    .forEach(updateConnectionVarRowType);
}

export function addConnectionVarsRow(key) {
  const config = connectionVarsConfig(key);
  const form = byId(config?.formId || "");
  if (!config || !form) return;
  const empty = form.querySelector(".connection-vars-empty");
  if (empty) empty.remove();
  form.insertAdjacentHTML("beforeend", connectionVarRowHtml(key));
  syncConnectionVarsFromForm(key);
  form
    .querySelector(".js-connection-vars-row:last-child .js-connection-vars-key")
    ?.focus();
}

export function getConnectionVarsValue(key) {
  syncConnectionVarsFromForm(key, false, { strict: true });
  return connectionVarsFromHidden(key);
}

export function updateConnectionVarRowType(row) {
  const type =
    row?.querySelector(".js-connection-vars-type")?.value || "string";
  const valueInput = row?.querySelector(".js-connection-vars-value");
  if (!valueInput) return;
  valueInput.disabled = type === "null";
  if (type === "boolean") {
    valueInput.setAttribute("list", "connection-vars-boolean-options");
    if (valueInput.value !== "true" && valueInput.value !== "false") {
      valueInput.value = "false";
    }
  } else {
    valueInput.removeAttribute("list");
  }
  if (type === "null") {
    valueInput.value = "";
  }
}

export function initConnectionVarsForms() {
  if (!byId("connection-vars-boolean-options")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<datalist id="connection-vars-boolean-options"><option value="true"></option><option value="false"></option></datalist>',
    );
  }
  ["saved-conn-vars", "saved-conn-edit-vars"].forEach((key) => {
    renderConnectionVarsForm(key, {});
    const addBtn = byId(`${key}-add-btn`);
    if (addBtn && addBtn.dataset.connectionVarsBound !== "1") {
      addBtn.dataset.connectionVarsBound = "1";
      addBtn.addEventListener("click", () => addConnectionVarsRow(key));
    }
  });
  if (document.body?.dataset.connectionVarsBound === "1") return;
  document.body.dataset.connectionVarsBound = "1";
  document.addEventListener("input", (event) => {
    const row = event.target.closest(".js-connection-vars-row");
    if (!row) return;
    syncConnectionVarsFromForm(row.getAttribute("data-vars-key") || "");
  });
  document.addEventListener("change", (event) => {
    const row = event.target.closest(".js-connection-vars-row");
    if (!row) return;
    updateConnectionVarRowType(row);
    syncConnectionVarsFromForm(row.getAttribute("data-vars-key") || "");
  });
  document.addEventListener("click", (event) => {
    const removeBtn = event.target.closest(".js-connection-vars-remove");
    if (!removeBtn) return;
    const row = removeBtn.closest(".js-connection-vars-row");
    const key = row?.getAttribute("data-vars-key") || "";
    row?.remove();
    syncConnectionVarsFromForm(key);
    renderConnectionVarsForm(key);
  });
}
