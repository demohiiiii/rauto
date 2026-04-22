/**
 * inventory.js — inventory groups / vars preview
 */

let inventoryGroupHostSelection = new Set();

function normalizeInventoryHostNames(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((item) => safeString(item || "").trim())
        .filter(Boolean)
    )
  );
}

function setInventoryGroupHostSelection(values = []) {
  inventoryGroupHostSelection = new Set(normalizeInventoryHostNames(values));
}

function inventoryGroupSelectedHosts() {
  return Array.from(inventoryGroupHostSelection).sort((a, b) => a.localeCompare(b));
}

function inventoryGroupHostsFilterValue() {
  return safeString(byId("inventory-group-hosts-filter")?.value || "").trim();
}

function inventoryGroupHostOptions() {
  const available = normalizeInventoryHostNames(
    (cachedSavedConnections || []).map((item) => item.name)
  );
  const merged = Array.from(new Set([...available, ...inventoryGroupSelectedHosts()])).sort(
    (a, b) => a.localeCompare(b)
  );
  return {
    availableSet: new Set(available),
    names: merged,
  };
}

function renderInventoryGroupHosts() {
  const list = byId("inventory-group-hosts");
  const empty = byId("inventory-group-hosts-empty");
  if (!list || !empty) return;
  const keyword = inventoryGroupHostsFilterValue().toLowerCase();
  const { availableSet, names } = inventoryGroupHostOptions();
  const filtered = names.filter((name) => !keyword || name.toLowerCase().includes(keyword));
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
      const checked = inventoryGroupHostSelection.has(name) ? "checked" : "";
      const missing = !availableSet.has(name);
      const missingTag = missing
        ? ` <span class="text-xs text-amber-600">${escapeHtml(
            t("inventoryHostMissingSuffix")
          )}</span>`
        : "";
      return `<label class="label cursor-pointer justify-start gap-2 rounded-lg px-2 py-1 hover:bg-base-200">
        <input type="checkbox" class="checkbox checkbox-sm" data-inventory-group-host="1" value="${escapeHtml(
          name
        )}" ${checked} />
        <span class="label-text font-medium">${escapeHtml(name)}</span>${missingTag}
      </label>`;
    })
    .join("");
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
  const keyword = inventoryGroupHostsFilterValue().toLowerCase();
  const { names } = inventoryGroupHostOptions();
  names
    .filter((name) => !keyword || name.toLowerCase().includes(keyword))
    .forEach((name) => inventoryGroupHostSelection.add(name));
  renderInventoryGroupHosts();
}

function clearInventoryGroupHostsSelection() {
  inventoryGroupHostSelection.clear();
  renderInventoryGroupHosts();
}

function getMultiSelectValues(selectId) {
  const select = byId(selectId);
  if (!select) return [];
  return Array.from(select.selectedOptions || [])
    .map((option) => safeString(option.value || "").trim())
    .filter(Boolean);
}

function renderInventoryMultiSelect(selectId, values, selectedValues = []) {
  const select = byId(selectId);
  if (!select) return;
  const selected = new Set((selectedValues || []).filter(Boolean));
  select.innerHTML = Array.from(new Set((values || []).filter(Boolean)))
    .map((value) => {
      const isSelected = selected.has(value) ? "selected" : "";
      return `<option value="${escapeHtml(value)}" ${isSelected}>${escapeHtml(value)}</option>`;
    })
    .join("");
}

function renderInventoryConnectionOptions(selectedName = "") {
  const connectionNames = (cachedSavedConnections || []).map((item) => item.name);
  const selects = ["inventory-resolve-host"];
  for (const selectId of selects) {
    const current = byId(selectId)?.value || selectedName || "";
    populateSelectOptions(selectId, connectionNames, {
      placeholder: t("inventoryResolveHostAny"),
      selected: current,
    });
  }
}

function renderInventoryGroupOptions(selectedName = "") {
  const groupNames = (cachedInventoryGroups || []).map((item) => item.name);
  populateSelectOptions("inventory-group-picker", groupNames, {
    placeholder: t("inventoryGroupSelectPlaceholder"),
    selected: selectedName,
  });
  renderInventoryGroupHosts();
  renderInventoryMultiSelect(
    "inventory-resolve-groups",
    groupNames,
    getMultiSelectValues("inventory-resolve-groups")
  );

  if (typeof renderSavedConnectionGroupOptions === "function") {
    renderSavedConnectionGroupOptions(getMultiSelectValues("saved-conn-groups"));
  }
}

function splitCsvValues(raw) {
  return String(raw || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

async function loadInventoryConnections() {
  renderInventoryConnectionOptions();
  renderInventoryGroupHosts();
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

async function resolveInventoryVarsFromWeb() {
  setStatusMessage("inventory-resolve-out", t("running"), "running");
  try {
    const data = await request("POST", "/api/inventory/resolve-vars", {
      host_name: byId("inventory-resolve-host")?.value.trim() || null,
      group_names: getMultiSelectValues("inventory-resolve-groups"),
      runtime_vars: parseInventoryJson("inventory-resolve-runtime"),
    });
    byId("inventory-resolve-result").textContent = JSON.stringify(
      (data && data.resolution) || {},
      null,
      2
    );
    setStatusMessage("inventory-resolve-out", t("inventoryResolveDone"), "success");
  } catch (e) {
    byId("inventory-resolve-result").textContent = "";
    setStatusMessage("inventory-resolve-out", e.message, "error");
  }
}
