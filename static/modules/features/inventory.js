/**
 * inventory.js — inventory groups / labels
 */

let inventoryGroupHostSelection = new Set();
let inventoryLabelHostSelection = new Set();

function normalizeInventoryHostNames(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((item) => safeString(item || "").trim())
        .filter(Boolean)
    )
  );
}

function inventoryHostOptions(selectedHosts = []) {
  const available = normalizeInventoryHostNames(
    (cachedSavedConnections || []).map((item) => item.name)
  );
  const merged = Array.from(new Set([...available, ...(selectedHosts || [])])).sort((a, b) =>
    a.localeCompare(b)
  );
  return {
    availableSet: new Set(available),
    names: merged,
  };
}

function renderInventoryHostChecklist({
  listId,
  emptyId,
  filterId,
  selection,
  checkboxAttr,
}) {
  const list = byId(listId);
  const empty = byId(emptyId);
  const filter = safeString(byId(filterId)?.value || "").trim().toLowerCase();
  if (!list || !empty) return;
  const { availableSet, names } = inventoryHostOptions(Array.from(selection));
  const filtered = names.filter((name) => !filter || name.toLowerCase().includes(filter));
  if (filtered.length === 0) {
    list.innerHTML = "";
    const hasAny = names.length > 0;
    empty.textContent = hasAny ? t("inventoryHostsNoMatch") : t("inventoryHostsEmpty");
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  list.innerHTML = filtered
    .map((name) => {
      const checked = selection.has(name) ? "checked" : "";
      const missing = !availableSet.has(name);
      const missingTag = missing
        ? ` <span class="text-xs text-amber-600">${escapeHtml(t("inventoryHostMissingSuffix"))}</span>`
        : "";
      return `<label class="label cursor-pointer justify-start gap-2 rounded-lg px-2 py-1 hover:bg-base-200">
        <input type="checkbox" class="checkbox checkbox-sm" ${checkboxAttr} value="${escapeHtml(
          name
        )}" ${checked} />
        <span class="label-text font-medium">${escapeHtml(name)}</span>${missingTag}
      </label>`;
    })
    .join("");
}

function setInventoryGroupHostSelection(values = []) {
  inventoryGroupHostSelection = new Set(normalizeInventoryHostNames(values));
}

function inventoryGroupSelectedHosts() {
  return Array.from(inventoryGroupHostSelection).sort((a, b) => a.localeCompare(b));
}

function renderInventoryGroupHosts() {
  renderInventoryHostChecklist({
    listId: "inventory-group-hosts",
    emptyId: "inventory-group-hosts-empty",
    filterId: "inventory-group-hosts-filter",
    selection: inventoryGroupHostSelection,
    checkboxAttr: 'data-inventory-group-host="1"',
  });
}

function onInventoryGroupHostFilterInput() {
  renderInventoryGroupHosts();
}

function onInventoryGroupHostSelectionChange(event) {
  const input = event?.target;
  if (!input || !input.matches("[data-inventory-group-host]")) return;
  const name = safeString(input.value || "").trim();
  if (!name) return;
  if (input.checked) {
    inventoryGroupHostSelection.add(name);
  } else {
    inventoryGroupHostSelection.delete(name);
  }
}

function selectAllInventoryGroupHosts() {
  const filter = safeString(byId("inventory-group-hosts-filter")?.value || "")
    .trim()
    .toLowerCase();
  const { names } = inventoryHostOptions(Array.from(inventoryGroupHostSelection));
  names
    .filter((name) => !filter || name.toLowerCase().includes(filter))
    .forEach((name) => inventoryGroupHostSelection.add(name));
  renderInventoryGroupHosts();
}

function clearInventoryGroupHostsSelection() {
  inventoryGroupHostSelection.clear();
  renderInventoryGroupHosts();
}

function setInventoryLabelHostSelection(values = []) {
  inventoryLabelHostSelection = new Set(normalizeInventoryHostNames(values));
}

function inventoryLabelSelectedHosts() {
  return Array.from(inventoryLabelHostSelection).sort((a, b) => a.localeCompare(b));
}

function renderInventoryLabelHosts() {
  renderInventoryHostChecklist({
    listId: "inventory-label-hosts",
    emptyId: "inventory-label-hosts-empty",
    filterId: "inventory-label-hosts-filter",
    selection: inventoryLabelHostSelection,
    checkboxAttr: 'data-inventory-label-host="1"',
  });
}

function onInventoryLabelHostFilterInput() {
  renderInventoryLabelHosts();
}

function onInventoryLabelHostSelectionChange(event) {
  const input = event?.target;
  if (!input || !input.matches("[data-inventory-label-host]")) return;
  const name = safeString(input.value || "").trim();
  if (!name) return;
  if (input.checked) {
    inventoryLabelHostSelection.add(name);
  } else {
    inventoryLabelHostSelection.delete(name);
  }
}

function selectAllInventoryLabelHosts() {
  const filter = safeString(byId("inventory-label-hosts-filter")?.value || "")
    .trim()
    .toLowerCase();
  const { names } = inventoryHostOptions(Array.from(inventoryLabelHostSelection));
  names
    .filter((name) => !filter || name.toLowerCase().includes(filter))
    .forEach((name) => inventoryLabelHostSelection.add(name));
  renderInventoryLabelHosts();
}

function clearInventoryLabelHostsSelection() {
  inventoryLabelHostSelection.clear();
  renderInventoryLabelHosts();
}

function getMultiSelectValues(selectId) {
  const select = byId(selectId);
  if (!select) return [];
  return Array.from(select.selectedOptions || [])
    .map((option) => safeString(option.value || "").trim())
    .filter(Boolean);
}

function renderInventoryGroupOptions(selectedName = "") {
  const groupNames = (cachedInventoryGroups || []).map((item) => item.name);
  populateSelectOptions("inventory-group-picker", groupNames, {
    placeholder: t("inventoryGroupSelectPlaceholder"),
    selected: selectedName,
  });
  renderInventoryGroupHosts();

  if (typeof renderSavedConnectionGroupOptions === "function") {
    renderSavedConnectionGroupOptions(getMultiSelectValues("saved-conn-groups"));
  }
}

function renderInventoryLabelOptions(selectedName = "") {
  const labelNames = (cachedInventoryLabels || []).map((item) => item.name);
  populateSelectOptions("inventory-label-picker", labelNames, {
    placeholder: t("inventoryLabelSelectPlaceholder"),
    selected: selectedName,
  });
  renderInventoryLabelHosts();
}

function parseInventoryJson(id) {
  const raw = byId(id)?.value.trim() || "";
  if (!raw) return {};
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(err.message || String(err));
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(t("inventoryVarsMustBeObject"));
  }
  return parsed;
}

function resetInventoryGroupForm(name = "") {
  ensureSelectValue("inventory-group-picker", name, { fallbackToEmpty: true });
  const nameValue = byId("inventory-group-name-value");
  if (nameValue) nameValue.textContent = name || "—";
  const description = byId("inventory-group-description");
  if (description) description.value = "";
  setInventoryGroupHostSelection([]);
  renderInventoryGroupHosts();
  const vars = byId("inventory-group-vars");
  if (vars) vars.value = "{\n  \n}";
}

function applyInventoryGroupForm(item) {
  const group = item || {};
  ensureSelectValue("inventory-group-picker", group.name || "");
  const nameValue = byId("inventory-group-name-value");
  if (nameValue) nameValue.textContent = safeString(group.name || "—");
  const description = byId("inventory-group-description");
  if (description) description.value = safeString(group.description || "");
  setInventoryGroupHostSelection(Array.isArray(group.hosts) ? group.hosts : []);
  renderInventoryGroupHosts();
  const vars = byId("inventory-group-vars");
  if (vars) vars.value = JSON.stringify(group.vars || {}, null, 2);
}

function resetInventoryLabelForm(name = "") {
  ensureSelectValue("inventory-label-picker", name, { fallbackToEmpty: true });
  const nameValue = byId("inventory-label-name-value");
  if (nameValue) nameValue.textContent = name || "—";
  setInventoryLabelHostSelection([]);
  renderInventoryLabelHosts();
}

function applyInventoryLabelForm(item) {
  const label = item || {};
  ensureSelectValue("inventory-label-picker", label.name || "");
  const nameValue = byId("inventory-label-name-value");
  if (nameValue) nameValue.textContent = safeString(label.name || "—");
  setInventoryLabelHostSelection(Array.isArray(label.hosts) ? label.hosts : []);
  renderInventoryLabelHosts();
}

function renderInventoryGroupList(errorMessage = "") {
  const out = byId("inventory-group-list");
  if (!out) return;
  if (errorMessage) {
    out.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(errorMessage)}</div>`;
    return;
  }
  if (!Array.isArray(cachedInventoryGroups) || cachedInventoryGroups.length === 0) {
    out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(t("inventoryGroupsEmpty"))}</div>`;
    return;
  }
  const selectedName = byId("inventory-group-picker")?.value.trim() || "";
  out.innerHTML = cachedInventoryGroups
    .map((item) => {
      const active = selectedName && item.name === selectedName;
      const cls = active
        ? "border-teal-300 bg-teal-50/70"
        : "border-slate-200 bg-white hover:border-slate-300";
      const hostCount = Array.isArray(item.hosts) ? item.hosts.length : 0;
      return `
        <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-inventory-group-row ${cls}" data-name="${escapeHtml(item.name || "")}">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm font-semibold text-slate-800">${escapeHtml(item.name || "-")}</span>
            <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">${escapeHtml(`${hostCount} ${t("inventoryHostsCountSuffix")}`)}</span>
          </div>
          <div class="mt-1 text-xs text-slate-500">${escapeHtml(safeString(item.description || t("inventoryNoDescription")))}</div>
        </button>
      `;
    })
    .join("");
}

function renderInventoryLabelList(errorMessage = "") {
  const out = byId("inventory-label-list");
  if (!out) return;
  if (errorMessage) {
    out.innerHTML = `<div class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${escapeHtml(errorMessage)}</div>`;
    return;
  }
  if (!Array.isArray(cachedInventoryLabels) || cachedInventoryLabels.length === 0) {
    out.innerHTML = `<div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">${escapeHtml(t("inventoryLabelsEmpty"))}</div>`;
    return;
  }
  const selectedName = byId("inventory-label-picker")?.value.trim() || "";
  out.innerHTML = cachedInventoryLabels
    .map((item) => {
      const active = selectedName && item.name === selectedName;
      const cls = active
        ? "border-teal-300 bg-teal-50/70"
        : "border-slate-200 bg-white hover:border-slate-300";
      const hostCount = Array.isArray(item.hosts) ? item.hosts.length : 0;
      return `
        <button type="button" class="w-full rounded-xl border px-3 py-2 text-left transition js-inventory-label-row ${cls}" data-name="${escapeHtml(item.name || "")}">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-sm font-semibold text-slate-800">${escapeHtml(item.name || "-")}</span>
            <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">${escapeHtml(`${hostCount} ${t("inventoryHostsCountSuffix")}`)}</span>
          </div>
        </button>
      `;
    })
    .join("");
}

async function loadInventoryConnections() {
  renderInventoryGroupHosts();
  renderInventoryLabelHosts();
}

async function loadInventoryGroups() {
  try {
    const data = await request("GET", "/api/inventory/groups");
    cachedInventoryGroups = Array.isArray(data) ? data : [];
    renderInventoryGroupOptions(byId("inventory-group-picker")?.value || "");
    renderInventoryGroupList();
    const selectedName = byId("inventory-group-picker")?.value.trim() || "";
    if (selectedName) {
      const selected = cachedInventoryGroups.find((item) => item.name === selectedName);
      if (selected) applyInventoryGroupForm(selected);
    }
  } catch (e) {
    cachedInventoryGroups = [];
    renderInventoryGroupOptions("");
    renderInventoryGroupList(e.message);
  }
}

async function loadInventoryLabels() {
  try {
    const data = await request("GET", "/api/inventory/labels");
    cachedInventoryLabels = Array.isArray(data) ? data : [];
    renderInventoryLabelOptions(byId("inventory-label-picker")?.value || "");
    renderInventoryLabelList();
    const selectedName = byId("inventory-label-picker")?.value.trim() || "";
    if (selectedName) {
      const selected = cachedInventoryLabels.find((item) => item.name === selectedName);
      if (selected) applyInventoryLabelForm(selected);
    }
  } catch (e) {
    cachedInventoryLabels = [];
    renderInventoryLabelOptions("");
    renderInventoryLabelList(e.message);
  }
}

async function loadInventoryGroupDetail() {
  const name = byId("inventory-group-picker")?.value.trim() || "";
  if (!name) {
    resetInventoryGroupForm("");
    setStatusMessage("inventory-group-out", "-", "info");
    renderInventoryGroupList();
    return;
  }
  setStatusMessage("inventory-group-out", t("running"), "running");
  try {
    const data = await request("GET", `/api/inventory/groups/${encodeURIComponent(name)}`);
    applyInventoryGroupForm(data);
    renderInventoryGroupList();
    setStatusMessage("inventory-group-out", `${t("loaded")}: ${data.name || name}`, "success");
  } catch (e) {
    setStatusMessage("inventory-group-out", e.message, "error");
  }
}

async function loadInventoryLabelDetail() {
  const name = byId("inventory-label-picker")?.value.trim() || "";
  if (!name) {
    resetInventoryLabelForm("");
    setStatusMessage("inventory-label-out", "-", "info");
    renderInventoryLabelList();
    return;
  }
  setStatusMessage("inventory-label-out", t("running"), "running");
  try {
    const data = await request("GET", `/api/inventory/labels/${encodeURIComponent(name)}`);
    applyInventoryLabelForm(data);
    renderInventoryLabelList();
    setStatusMessage("inventory-label-out", `${t("loaded")}: ${data.name || name}`, "success");
  } catch (e) {
    setStatusMessage("inventory-label-out", e.message, "error");
  }
}

async function createInventoryGroupDraft() {
  const name = promptForResourceName(t("inventoryGroupNewPrompt"));
  if (!name) return;
  const exists = (cachedInventoryGroups || []).some((item) => item.name === name);
  if (exists) {
    ensureSelectValue("inventory-group-picker", name);
    await loadInventoryGroupDetail();
    setStatusMessage("inventory-group-out", t("inventoryGroupExistsHint"), "info");
    return;
  }
  setStatusMessage("inventory-group-out", t("running"), "running");
  try {
    const payload = inventoryGroupFormPayload(name);
    const data = await request("PUT", `/api/inventory/groups/${encodeURIComponent(name)}`, {
      group: payload,
    });
    ensureSelectValue("inventory-group-picker", data.name || name);
    applyInventoryGroupForm(data);
    renderInventoryGroupList();
    setStatusMessage("inventory-group-out", `${t("created")}: ${data.name || name}`, "success");
    await loadInventoryGroups();
    await loadInventoryConnections();
  } catch (e) {
    setStatusMessage("inventory-group-out", e.message, "error");
  }
}

async function createInventoryLabelDraft() {
  const name = promptForResourceName(t("inventoryLabelNewPrompt"));
  if (!name) return;
  const exists = (cachedInventoryLabels || []).some((item) => item.name === name);
  if (exists) {
    ensureSelectValue("inventory-label-picker", name);
    await loadInventoryLabelDetail();
    setStatusMessage("inventory-label-out", t("inventoryLabelExistsHint"), "info");
    return;
  }
  setStatusMessage("inventory-label-out", t("running"), "running");
  try {
    const data = await request("PUT", `/api/inventory/labels/${encodeURIComponent(name)}`, {
      hosts: inventoryLabelSelectedHosts(),
    });
    ensureSelectValue("inventory-label-picker", data.name || name);
    applyInventoryLabelForm(data);
    renderInventoryLabelList();
    setStatusMessage("inventory-label-out", `${t("created")}: ${data.name || name}`, "success");
    await loadInventoryLabels();
    if (typeof loadSavedConnections === "function") {
      await loadSavedConnections();
    }
  } catch (e) {
    setStatusMessage("inventory-label-out", e.message, "error");
  }
}

function inventoryGroupFormPayload(name) {
  return {
    name,
    description: byId("inventory-group-description")?.value.trim() || null,
    hosts: inventoryGroupSelectedHosts(),
    vars: parseInventoryJson("inventory-group-vars"),
  };
}

async function saveInventoryGroup() {
  const name = byId("inventory-group-picker")?.value.trim() || "";
  if (!name) {
    setStatusMessage("inventory-group-out", t("inventoryGroupNameRequired"), "error");
    return;
  }
  setStatusMessage("inventory-group-out", t("running"), "running");
  try {
    const data = await request("PUT", `/api/inventory/groups/${encodeURIComponent(name)}`, {
      group: inventoryGroupFormPayload(name),
    });
    applyInventoryGroupForm(data);
    setStatusMessage("inventory-group-out", `${t("saved")}: ${data.name || name}`, "success");
    await loadInventoryGroups();
    await loadInventoryConnections();
  } catch (e) {
    setStatusMessage("inventory-group-out", e.message, "error");
  }
}

async function saveInventoryLabel() {
  const name = byId("inventory-label-picker")?.value.trim() || "";
  if (!name) {
    setStatusMessage("inventory-label-out", t("inventoryLabelNameRequired"), "error");
    return;
  }
  setStatusMessage("inventory-label-out", t("running"), "running");
  try {
    const data = await request("PUT", `/api/inventory/labels/${encodeURIComponent(name)}`, {
      hosts: inventoryLabelSelectedHosts(),
    });
    applyInventoryLabelForm(data);
    setStatusMessage("inventory-label-out", `${t("saved")}: ${data.name || name}`, "success");
    await loadInventoryLabels();
    if (typeof loadSavedConnections === "function") {
      await loadSavedConnections();
    }
  } catch (e) {
    setStatusMessage("inventory-label-out", e.message, "error");
  }
}

async function deleteInventoryGroup() {
  const name = byId("inventory-group-picker")?.value.trim() || "";
  if (!name) {
    setStatusMessage("inventory-group-out", t("inventoryGroupNameRequired"), "error");
    return;
  }
  setStatusMessage("inventory-group-out", t("running"), "running");
  try {
    await request("DELETE", `/api/inventory/groups/${encodeURIComponent(name)}`);
    resetInventoryGroupForm("");
    setStatusMessage("inventory-group-out", `${t("deleted")}: ${name}`, "success");
    await loadInventoryGroups();
    await loadInventoryConnections();
  } catch (e) {
    setStatusMessage("inventory-group-out", e.message, "error");
  }
}

async function deleteInventoryLabel() {
  const name = byId("inventory-label-picker")?.value.trim() || "";
  if (!name) {
    setStatusMessage("inventory-label-out", t("inventoryLabelNameRequired"), "error");
    return;
  }
  setStatusMessage("inventory-label-out", t("running"), "running");
  try {
    await request("DELETE", `/api/inventory/labels/${encodeURIComponent(name)}`);
    resetInventoryLabelForm("");
    setStatusMessage("inventory-label-out", `${t("deleted")}: ${name}`, "success");
    await loadInventoryLabels();
    if (typeof loadSavedConnections === "function") {
      await loadSavedConnections();
    }
  } catch (e) {
    setStatusMessage("inventory-label-out", e.message, "error");
  }
}
