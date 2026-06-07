import { byId } from "./runtimeGlobals.js";

const CONNECTION_MULTI_PICKERS = {
  devices: {
    allowCustom: false,
    inputIds: ["batch-show-targets-picker"],
    hiddenIds: ["batch-show-targets"],
  },
  labels: {
    allowCustom: true,
    inputIds: ["saved-conn-labels-picker", "saved-conn-edit-labels-picker"],
    hiddenIds: [
      "saved-conn-labels",
      "saved-conn-edit-labels",
      "batch-show-labels",
    ],
  },
  groups: {
    allowCustom: false,
    inputIds: [
      "saved-conn-groups-picker",
      "saved-conn-edit-groups-picker",
      "batch-show-groups-picker",
    ],
    hiddenIds: [
      "saved-conn-groups",
      "saved-conn-edit-groups",
      "batch-show-groups",
    ],
  },
  "show-objects": {
    allowCustom: false,
    inputIds: ["show-object-picker", "batch-show-object-picker"],
    hiddenIds: ["show-object", "batch-show-object"],
  },
};

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

function splitCsvValues(rawValue) {
  if (typeof window.splitCsvValues === "function") {
    return window.splitCsvValues(rawValue);
  }
  return String(rawValue ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeConnectionPickerValues(values = []) {
  const seen = new Set();
  return (values || [])
    .map((item) => safeString(item || "").trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

export function connectionPickerConfig(key) {
  const map = {
    "saved-conn-labels": {
      key: "saved-conn-labels",
      kind: "labels",
      hiddenId: "saved-conn-labels",
      inputId: "saved-conn-labels-picker",
      selectedId: "saved-conn-labels-selected",
      menuId: "saved-conn-labels-menu",
    },
    "saved-conn-edit-labels": {
      key: "saved-conn-edit-labels",
      kind: "labels",
      hiddenId: "saved-conn-edit-labels",
      inputId: "saved-conn-edit-labels-picker",
      selectedId: "saved-conn-edit-labels-selected",
      menuId: "saved-conn-edit-labels-menu",
    },
    "saved-conn-groups": {
      key: "saved-conn-groups",
      kind: "groups",
      hiddenId: "saved-conn-groups",
      inputId: "saved-conn-groups-picker",
      selectedId: "saved-conn-groups-selected",
      menuId: "saved-conn-groups-menu",
    },
    "saved-conn-edit-groups": {
      key: "saved-conn-edit-groups",
      kind: "groups",
      hiddenId: "saved-conn-edit-groups",
      inputId: "saved-conn-edit-groups-picker",
      selectedId: "saved-conn-edit-groups-selected",
      menuId: "saved-conn-edit-groups-menu",
    },
    "batch-show-targets": {
      key: "batch-show-targets",
      kind: "devices",
      hiddenId: "batch-show-targets",
      inputId: "batch-show-targets-picker",
      selectedId: "batch-show-targets-selected",
      menuId: "batch-show-targets-menu",
    },
    "batch-show-groups": {
      key: "batch-show-groups",
      kind: "groups",
      hiddenId: "batch-show-groups",
      inputId: "batch-show-groups-picker",
      selectedId: "batch-show-groups-selected",
      menuId: "batch-show-groups-menu",
    },
    "batch-show-labels": {
      key: "batch-show-labels",
      kind: "labels",
      hiddenId: "batch-show-labels",
      inputId: "batch-show-labels-picker",
      selectedId: "batch-show-labels-selected",
      menuId: "batch-show-labels-menu",
    },
    "show-object": {
      key: "show-object",
      kind: "show-objects",
      hiddenId: "show-object",
      inputId: "show-object-picker",
      selectedId: "show-object-selected",
      menuId: "show-object-menu",
    },
    "batch-show-object": {
      key: "batch-show-object",
      kind: "show-objects",
      hiddenId: "batch-show-object",
      inputId: "batch-show-object-picker",
      selectedId: "batch-show-object-selected",
      menuId: "batch-show-object-menu",
    },
  };
  return map[key] || null;
}

function showObjectOptionValues(selectId) {
  const select = byId(selectId);
  if (!select) return [];
  return Array.from(select.options || []).map((option) =>
    safeString(option.value || "").trim(),
  );
}

function showObjectOptionMeta(selectId, value) {
  const select = byId(selectId);
  const option = Array.from(select?.options || []).find(
    (item) => safeString(item.value || "").trim() === value,
  );
  return {
    object: value,
    command: safeString(option?.dataset?.command || "").trim(),
    mode: safeString(option?.dataset?.mode || "").trim(),
    source: safeString(option?.dataset?.source || "").trim(),
    textfsmTemplate: safeString(option?.dataset?.textfsmTemplate || "").trim(),
  };
}

function showObjectSearchText(selectId, value) {
  return showObjectOptionMeta(selectId, value).object.toLowerCase();
}

export function connectionPickerOptionValues(
  kind,
  selectedValues = [],
  sourceId = "",
) {
  const selected = normalizeConnectionPickerValues(selectedValues);
  const available =
    kind === "groups"
      ? (window.cachedInventoryGroups || []).map((item) =>
          safeString(item?.name || "").trim(),
        )
      : kind === "devices"
        ? (window.cachedSavedConnections || []).map((item) =>
            safeString(item?.name || "").trim(),
          )
        : kind === "show-objects"
          ? showObjectOptionValues(sourceId)
          : (window.cachedInventoryLabels || []).map((item) =>
              safeString(item?.name || "").trim(),
            );
  return normalizeConnectionPickerValues([...available, ...selected]).sort(
    (a, b) => a.localeCompare(b),
  );
}

export function getMultiSelectValuesById(selectId) {
  const select = byId(selectId);
  if (!select) return [];
  return Array.from(select.selectedOptions || [])
    .map((option) => safeString(option.value || "").trim())
    .filter(Boolean);
}

export function getMultiSelectValues(selectId) {
  return getMultiSelectValuesById(selectId);
}

export function connectionPickerValues(key) {
  const config = connectionPickerConfig(key);
  if (!config) return [];
  if (config.kind === "groups" || config.kind === "show-objects") {
    return getMultiSelectValuesById(config.hiddenId);
  }
  return splitCsvValues(byId(config.hiddenId)?.value || "");
}

export function hideConnectionPickerMenu(key) {
  const config = connectionPickerConfig(key);
  const menu = byId(config?.menuId || "");
  if (!menu) return;
  menu.innerHTML = "";
  menu.classList.add("hidden");
}

export function syncConnectionPickerHiddenValue(
  key,
  values,
  triggerEvents = true,
) {
  const config = connectionPickerConfig(key);
  if (!config) return;
  const normalized = normalizeConnectionPickerValues(values);
  const hidden = byId(config.hiddenId);
  if (!hidden) return;
  if (config.kind === "groups") {
    hidden.innerHTML = normalized
      .map(
        (value) =>
          `<option value="${escapeHtml(value)}" selected>${escapeHtml(value)}</option>`,
      )
      .join("");
  } else if (config.kind === "show-objects") {
    Array.from(hidden.options || []).forEach((option) => {
      option.selected = normalized.includes(safeString(option.value).trim());
    });
  } else {
    hidden.value = normalized.join(", ");
  }
  if (triggerEvents) {
    hidden.dispatchEvent(new Event("input", { bubbles: true }));
    hidden.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export function renderConnectionPickerSelected(key) {
  const config = connectionPickerConfig(key);
  const out = byId(config?.selectedId || "");
  if (!config || !out) return;
  const selected = connectionPickerValues(key);
  if (selected.length === 0) {
    out.innerHTML = "";
    return;
  }
  out.innerHTML = selected
    .map(
      (
        value,
      ) => `<span class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
        <span>${escapeHtml(value)}</span>
        <button
          type="button"
          class="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
          data-connection-picker-remove="${escapeHtml(key)}"
          data-value="${escapeHtml(value)}"
          aria-label="${escapeHtml(t("connectionPickerRemoveItem"))}"
          title="${escapeHtml(t("connectionPickerRemoveItem"))}"
        >x</button>
      </span>`,
    )
    .join("");
}

export function renderShowObjectPickerOption(key, selectId, value) {
  const meta = showObjectOptionMeta(selectId, value);
  return `<li>
    <button
      type="button"
      class="connection-show-object-option"
      data-connection-picker-add="${escapeHtml(key)}"
      data-value="${escapeHtml(value)}"
    >
      <span class="connection-show-object-option-head">
        <span class="connection-show-object-name">${escapeHtml(meta.object)}</span>
        <span class="connection-show-object-add">+</span>
      </span>
    </button>
  </li>`;
}

export function renderConnectionPickerMenu(key) {
  const config = connectionPickerConfig(key);
  const input = byId(config?.inputId || "");
  const menu = byId(config?.menuId || "");
  if (!config || !input || !menu) return;
  menu.classList.toggle(
    "connection-show-object-menu",
    config.kind === "show-objects",
  );
  const selected = new Set(connectionPickerValues(key));
  const query = safeString(input.value || "").trim();
  const lowerQuery = query.toLowerCase();
  const options = connectionPickerOptionValues(
    config.kind,
    Array.from(selected),
    config.hiddenId,
  ).filter(
    (value) =>
      !selected.has(value) &&
      (!lowerQuery ||
        (config.kind === "show-objects"
          ? showObjectSearchText(config.hiddenId, value).includes(lowerQuery)
          : value.toLowerCase().includes(lowerQuery))),
  );
  const canAddCustom =
    CONNECTION_MULTI_PICKERS[config.kind]?.allowCustom &&
    !!query &&
    !selected.has(query) &&
    !options.some((value) => value === query);
  if (options.length === 0 && !canAddCustom) {
    menu.innerHTML = `<li><span class="px-3 py-2 text-xs text-slate-500">${escapeHtml(
      t("connectionPickerNoMatch"),
    )}</span></li>`;
    menu.classList.remove("hidden");
    return;
  }
  const customHtml = canAddCustom
    ? `<li><button
          type="button"
          class="justify-between"
          data-connection-picker-add="${escapeHtml(key)}"
          data-value="${escapeHtml(query)}"
        >
          <span>${escapeHtml(t("connectionLabelsAddCustom"))}</span>
          <span class="font-medium">${escapeHtml(query)}</span>
        </button></li>`
    : "";
  menu.innerHTML = `${customHtml}${options
    .map((value) =>
      config.kind === "show-objects"
        ? renderShowObjectPickerOption(key, config.hiddenId, value)
        : `<li><button
          type="button"
          data-connection-picker-add="${escapeHtml(key)}"
          data-value="${escapeHtml(value)}"
        >
          <span>${escapeHtml(value)}</span>
        </button></li>`,
    )
    .join("")}`;
  menu.classList.remove("hidden");
}

export function renderConnectionPicker(key) {
  renderConnectionPickerSelected(key);
  renderConnectionPickerMenu(key);
}

export function setConnectionPickerValues(key, values, triggerEvents = true) {
  syncConnectionPickerHiddenValue(key, values, triggerEvents);
  const input = byId(connectionPickerConfig(key)?.inputId || "");
  if (input) input.value = "";
  renderConnectionPicker(key);
  if (input && triggerEvents) {
    input.focus({ preventScroll: true });
  }
}

export function addConnectionPickerValue(key, rawValue) {
  const value = safeString(rawValue || "").trim();
  if (!value) return false;
  const config = connectionPickerConfig(key);
  if (!config) return false;
  if (
    config.kind === "groups" ||
    config.kind === "devices" ||
    config.kind === "show-objects"
  ) {
    const available = connectionPickerOptionValues(
      config.kind,
      [],
      config.hiddenId,
    );
    if (!available.includes(value)) {
      return false;
    }
  }
  const next = normalizeConnectionPickerValues([
    ...connectionPickerValues(key),
    value,
  ]);
  setConnectionPickerValues(key, next);
  return true;
}

export function removeConnectionPickerValue(key, rawValue) {
  const value = safeString(rawValue || "").trim();
  if (!value) return;
  const next = connectionPickerValues(key).filter((item) => item !== value);
  setConnectionPickerValues(key, next);
}

export function commitConnectionPickerInput(key) {
  const config = connectionPickerConfig(key);
  const input = byId(config?.inputId || "");
  if (!config || !input) return false;
  const raw = safeString(input.value || "").trim();
  if (!raw) {
    hideConnectionPickerMenu(key);
    return false;
  }
  if (config.kind === "labels") {
    return addConnectionPickerValue(key, raw);
  }
  const options = connectionPickerOptionValues(
    config.kind,
    [],
    config.hiddenId,
  );
  const filtered = options.filter((value) =>
    value.toLowerCase().includes(raw.toLowerCase()),
  );
  const exact = filtered.find(
    (value) => value.toLowerCase() === raw.toLowerCase(),
  );
  if (exact) {
    return addConnectionPickerValue(key, exact);
  }
  if (filtered.length === 1) {
    return addConnectionPickerValue(key, filtered[0]);
  }
  renderConnectionPickerMenu(key);
  return false;
}

export function renderConnectionGroupsForSelect(selectId, selectedValues = []) {
  const select = byId(selectId);
  if (!select) return;
  const selected = new Set((selectedValues || []).filter(Boolean));
  select.innerHTML = (window.cachedInventoryGroups || [])
    .map((item) => safeString(item.name).trim())
    .filter(Boolean)
    .map((name) => {
      const isSelected = selected.has(name) ? "selected" : "";
      return `<option value="${escapeHtml(name)}" ${isSelected}>${escapeHtml(name)}</option>`;
    })
    .join("");
}

export function renderSavedConnectionGroupOptions(selectedValues = []) {
  renderConnectionGroupsForSelect("saved-conn-groups", selectedValues);
  renderConnectionGroupsForSelect(
    "saved-conn-edit-groups",
    getMultiSelectValuesById("saved-conn-edit-groups"),
  );
  renderConnectionGroupsForSelect(
    "batch-show-groups",
    getMultiSelectValuesById("batch-show-groups"),
  );
  renderConnectionPicker("batch-show-groups");
}

export function renderSavedConnectionLabelOptions(selectedValues = null) {
  if (selectedValues !== null) {
    setConnectionPickerValues("saved-conn-labels", selectedValues, false);
  } else {
    renderConnectionPicker("saved-conn-labels");
  }
  renderConnectionPicker("saved-conn-edit-labels");
  renderConnectionPicker("batch-show-labels");
}

export function renderBatchShowTargetPickerOptions() {
  renderConnectionPicker("batch-show-targets");
  renderConnectionPicker("batch-show-groups");
  renderConnectionPicker("batch-show-labels");
}

export function getConnectionLabelValues(key) {
  return connectionPickerValues(key);
}

export function getConnectionGroupValues(key) {
  return connectionPickerValues(key);
}

export function connectionPickerKeys() {
  return [
    "saved-conn-labels",
    "saved-conn-edit-labels",
    "saved-conn-groups",
    "saved-conn-edit-groups",
    "batch-show-targets",
    "batch-show-groups",
    "batch-show-labels",
    "show-object",
    "batch-show-object",
  ];
}

export function connectionPickerConfigMap() {
  return {
    "saved-conn-labels": connectionPickerConfig("saved-conn-labels"),
    "saved-conn-edit-labels": connectionPickerConfig("saved-conn-edit-labels"),
    "saved-conn-groups": connectionPickerConfig("saved-conn-groups"),
    "saved-conn-edit-groups": connectionPickerConfig("saved-conn-edit-groups"),
    "batch-show-targets": connectionPickerConfig("batch-show-targets"),
    "batch-show-groups": connectionPickerConfig("batch-show-groups"),
    "batch-show-labels": connectionPickerConfig("batch-show-labels"),
    "show-object": connectionPickerConfig("show-object"),
    "batch-show-object": connectionPickerConfig("batch-show-object"),
  };
}

export function initConnectionSelectionPickers() {
  Object.values(CONNECTION_MULTI_PICKERS)
    .flatMap((group) => group.inputIds)
    .forEach((inputId) => {
      const input = byId(inputId);
      if (!input || input.dataset.connectionPickerBound === "1") return;
      const hiddenId = Object.keys(connectionPickerConfigMap()).find(
        (key) => connectionPickerConfig(key)?.inputId === inputId,
      );
      input.dataset.connectionPickerBound = "1";
      input.addEventListener("focus", () => {
        renderConnectionPicker(hiddenId);
      });
      input.addEventListener("input", () => {
        renderConnectionPicker(hiddenId);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          hideConnectionPickerMenu(hiddenId);
          input.blur();
          return;
        }
        if (
          event.key === "Backspace" &&
          !safeString(input.value || "").trim()
        ) {
          const values = connectionPickerValues(hiddenId);
          if (values.length > 0) {
            event.preventDefault();
            removeConnectionPickerValue(hiddenId, values[values.length - 1]);
          }
          return;
        }
        const isLabelPicker =
          connectionPickerConfig(hiddenId)?.kind === "labels";
        if (event.key === "Enter" || (isLabelPicker && event.key === ",")) {
          event.preventDefault();
          commitConnectionPickerInput(hiddenId);
        }
      });
    });
  if (document.body?.dataset.connectionPickerBound !== "1") {
    document.body.dataset.connectionPickerBound = "1";
    document.addEventListener("click", (event) => {
      const addBtn = event.target.closest("[data-connection-picker-add]");
      if (addBtn) {
        const key = addBtn.getAttribute("data-connection-picker-add") || "";
        const value = addBtn.getAttribute("data-value") || "";
        addConnectionPickerValue(key, value);
        return;
      }
      const removeBtn = event.target.closest("[data-connection-picker-remove]");
      if (removeBtn) {
        const key =
          removeBtn.getAttribute("data-connection-picker-remove") || "";
        const value = removeBtn.getAttribute("data-value") || "";
        removeConnectionPickerValue(key, value);
        return;
      }
      connectionPickerKeys().forEach((key) => {
        const config = connectionPickerConfig(key);
        const input = byId(config?.inputId || "");
        const menu = byId(config?.menuId || "");
        const selected = byId(config?.selectedId || "");
        if (
          input?.contains(event.target) ||
          menu?.contains(event.target) ||
          selected?.contains(event.target)
        ) {
          return;
        }
        hideConnectionPickerMenu(key);
      });
    });
  }
  renderSavedConnectionLabelOptions([]);
  renderSavedConnectionGroupOptions([]);
  renderBatchShowTargetPickerOptions();
}
