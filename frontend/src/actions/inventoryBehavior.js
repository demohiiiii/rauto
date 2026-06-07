import {
  deleteInventoryGroup,
  deleteInventoryLabel,
  getInventoryGroup,
  getInventoryLabel,
  listConnections,
  listInventoryGroups,
  listInventoryLabels,
  saveInventoryGroup,
  saveInventoryLabel,
} from "../api/client.js";
import {
  normalizeHostNames,
  renderHostChecklistView,
  renderInventoryGroupListView,
  renderInventoryLabelListView,
} from "../services/inventoryRender.js";
import {
  populateSelect,
  safeString,
  statusCard,
  tr,
} from "../services/templateUi.js";

export function inventoryBehavior(node) {
  let savedConnections = [];
  let groups = [];
  let labels = [];
  let groupHostSelection = new Set();
  let labelHostSelection = new Set();

  const byId = (id) => node.querySelector(`#${id}`);

  function setStatus(id, message, tone = "info") {
    const out = byId(id);
    if (!out) return;
    out.innerHTML = statusCard(message, tone);
  }

  function syncInventoryRuntimeSnapshots() {
    if (typeof window.setInventoryRuntimeSnapshots === "function") {
      window.setInventoryRuntimeSnapshots({ groups, labels });
    }
  }

  function ensureSelectValue(id, value) {
    const select = byId(id);
    if (!select) return;
    select.value = value || "";
  }

  function hostOptions(selectedHosts = []) {
    const available = normalizeHostNames(
      savedConnections.map((item) => item.name),
    );
    return {
      availableSet: new Set(available),
      names: normalizeHostNames([...available, ...selectedHosts]),
    };
  }

  function renderHostChecklist({
    listId,
    emptyId,
    filterId,
    selection,
    checkboxAttr,
  }) {
    const { availableSet, names } = hostOptions(Array.from(selection));
    renderHostChecklistView({
      availableSet,
      checkboxAttr,
      empty: byId(emptyId),
      filterValue: byId(filterId)?.value || "",
      list: byId(listId),
      names,
      selection,
    });
  }

  function renderInventoryGroupHosts() {
    renderHostChecklist({
      listId: "inventory-group-hosts",
      emptyId: "inventory-group-hosts-empty",
      filterId: "inventory-group-hosts-filter",
      selection: groupHostSelection,
      checkboxAttr: 'data-inventory-group-host="1"',
    });
  }

  function renderInventoryLabelHosts() {
    renderHostChecklist({
      listId: "inventory-label-hosts",
      emptyId: "inventory-label-hosts-empty",
      filterId: "inventory-label-hosts-filter",
      selection: labelHostSelection,
      checkboxAttr: 'data-inventory-label-host="1"',
    });
  }

  function renderInventoryGroupOptions(selectedName = "") {
    populateSelect(
      byId("inventory-group-picker"),
      groups.map((item) => item.name).filter(Boolean),
      {
        placeholder: tr("inventoryGroupSelectPlaceholder", "select group"),
        selected: selectedName,
      },
    );
    renderInventoryGroupHosts();
    if (typeof window.renderSavedConnectionGroupOptions === "function") {
      window.renderSavedConnectionGroupOptions(
        Array.from(
          document.getElementById("saved-conn-groups")?.selectedOptions || [],
        ).map((option) => option.value),
      );
    }
  }

  function renderInventoryLabelOptions(selectedName = "") {
    populateSelect(
      byId("inventory-label-picker"),
      labels.map((item) => item.name).filter(Boolean),
      {
        placeholder: tr("inventoryLabelSelectPlaceholder", "select label"),
        selected: selectedName,
      },
    );
    renderInventoryLabelHosts();
    if (typeof window.renderSavedConnectionLabelOptions === "function") {
      window.renderSavedConnectionLabelOptions();
    }
  }

  function renderInventoryGroupList(errorMessage = "") {
    renderInventoryGroupListView({
      errorMessage,
      groups,
      out: byId("inventory-group-list"),
      selectedName: byId("inventory-group-picker")?.value.trim() || "",
    });
  }

  function renderInventoryLabelList(errorMessage = "") {
    renderInventoryLabelListView({
      errorMessage,
      labels,
      out: byId("inventory-label-list"),
      selectedName: byId("inventory-label-picker")?.value.trim() || "",
    });
  }

  function resetInventoryGroupForm(name = "") {
    ensureSelectValue("inventory-group-picker", name);
    byId("inventory-group-name-value").textContent = name || "—";
    byId("inventory-group-description").value = "";
    groupHostSelection = new Set();
    byId("inventory-group-vars").value = "{\n  \n}";
    renderInventoryGroupHosts();
  }

  function applyInventoryGroupForm(item) {
    const group = item || {};
    ensureSelectValue("inventory-group-picker", group.name || "");
    byId("inventory-group-name-value").textContent = safeString(
      group.name || "—",
    );
    byId("inventory-group-description").value = safeString(
      group.description || "",
    );
    groupHostSelection = new Set(
      normalizeHostNames(Array.isArray(group.hosts) ? group.hosts : []),
    );
    byId("inventory-group-vars").value = JSON.stringify(
      group.vars || {},
      null,
      2,
    );
    renderInventoryGroupHosts();
  }

  function resetInventoryLabelForm(name = "") {
    ensureSelectValue("inventory-label-picker", name);
    byId("inventory-label-name-value").textContent = name || "—";
    labelHostSelection = new Set();
    renderInventoryLabelHosts();
  }

  function applyInventoryLabelForm(item) {
    const label = item || {};
    ensureSelectValue("inventory-label-picker", label.name || "");
    byId("inventory-label-name-value").textContent = safeString(
      label.name || "—",
    );
    labelHostSelection = new Set(
      normalizeHostNames(Array.isArray(label.hosts) ? label.hosts : []),
    );
    renderInventoryLabelHosts();
  }

  function parseInventoryJson(id) {
    const raw = byId(id)?.value.trim() || "";
    if (!raw) return {};
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(error.message || String(error));
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(
        tr("inventoryVarsMustBeObject", "vars must be a JSON object"),
      );
    }
    return parsed;
  }

  async function loadInventoryConnections() {
    try {
      const data = await listConnections();
      savedConnections = Array.isArray(data) ? data : [];
    } catch (_) {
      savedConnections = [];
    }
    renderInventoryGroupHosts();
    renderInventoryLabelHosts();
  }

  async function loadInventoryGroups() {
    try {
      const data = await listInventoryGroups();
      groups = Array.isArray(data) ? data : [];
      syncInventoryRuntimeSnapshots();
      renderInventoryGroupOptions(byId("inventory-group-picker")?.value || "");
      renderInventoryGroupList();
      const selectedName = byId("inventory-group-picker")?.value.trim() || "";
      const selected = groups.find((item) => item.name === selectedName);
      if (selected) applyInventoryGroupForm(selected);
    } catch (error) {
      groups = [];
      syncInventoryRuntimeSnapshots();
      renderInventoryGroupOptions("");
      renderInventoryGroupList(error.message);
    }
  }

  async function loadInventoryLabels() {
    try {
      const data = await listInventoryLabels();
      labels = Array.isArray(data) ? data : [];
      syncInventoryRuntimeSnapshots();
      renderInventoryLabelOptions(byId("inventory-label-picker")?.value || "");
      renderInventoryLabelList();
      const selectedName = byId("inventory-label-picker")?.value.trim() || "";
      const selected = labels.find((item) => item.name === selectedName);
      if (selected) applyInventoryLabelForm(selected);
    } catch (error) {
      labels = [];
      syncInventoryRuntimeSnapshots();
      renderInventoryLabelOptions("");
      renderInventoryLabelList(error.message);
    }
  }

  async function loadInventoryGroupDetail() {
    const name = byId("inventory-group-picker")?.value.trim() || "";
    if (!name) {
      resetInventoryGroupForm("");
      setStatus("inventory-group-out", "-", "info");
      renderInventoryGroupList();
      return;
    }
    setStatus("inventory-group-out", tr("running", "running"), "running");
    try {
      const data = await getInventoryGroup(name);
      applyInventoryGroupForm(data);
      renderInventoryGroupList();
      setStatus(
        "inventory-group-out",
        `${tr("loaded", "loaded")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      setStatus("inventory-group-out", error.message, "error");
    }
  }

  async function loadInventoryLabelDetail() {
    const name = byId("inventory-label-picker")?.value.trim() || "";
    if (!name) {
      resetInventoryLabelForm("");
      setStatus("inventory-label-out", "-", "info");
      renderInventoryLabelList();
      return;
    }
    setStatus("inventory-label-out", tr("running", "running"), "running");
    try {
      const data = await getInventoryLabel(name);
      applyInventoryLabelForm(data);
      renderInventoryLabelList();
      setStatus(
        "inventory-label-out",
        `${tr("loaded", "loaded")}: ${data.name || name}`,
        "success",
      );
    } catch (error) {
      setStatus("inventory-label-out", error.message, "error");
    }
  }

  function inventoryGroupFormPayload(name) {
    return {
      name,
      description: byId("inventory-group-description")?.value.trim() || null,
      hosts: Array.from(groupHostSelection).sort((a, b) => a.localeCompare(b)),
      vars: parseInventoryJson("inventory-group-vars"),
    };
  }

  async function createInventoryGroupDraft() {
    const name = window.prompt(
      tr("inventoryGroupNewPrompt", "New inventory group name"),
    );
    if (!name?.trim()) return;
    if (groups.some((item) => item.name === name.trim())) {
      ensureSelectValue("inventory-group-picker", name.trim());
      await loadInventoryGroupDetail();
      setStatus(
        "inventory-group-out",
        tr("inventoryGroupExistsHint", "group already exists"),
        "info",
      );
      return;
    }
    await saveGroupByName(name.trim(), tr("created", "created"));
  }

  async function createInventoryLabelDraft() {
    const name = window.prompt(
      tr("inventoryLabelNewPrompt", "New inventory label name"),
    );
    if (!name?.trim()) return;
    if (labels.some((item) => item.name === name.trim())) {
      ensureSelectValue("inventory-label-picker", name.trim());
      await loadInventoryLabelDetail();
      setStatus(
        "inventory-label-out",
        tr("inventoryLabelExistsHint", "label already exists"),
        "info",
      );
      return;
    }
    await saveLabelByName(name.trim(), tr("created", "created"));
  }

  async function saveGroupByName(name, verb = tr("saved", "saved")) {
    setStatus("inventory-group-out", tr("running", "running"), "running");
    try {
      const data = await saveInventoryGroup(
        name,
        inventoryGroupFormPayload(name),
      );
      applyInventoryGroupForm(data);
      setStatus(
        "inventory-group-out",
        `${verb}: ${data.name || name}`,
        "success",
      );
      await loadInventoryGroups();
      await loadInventoryConnections();
    } catch (error) {
      setStatus("inventory-group-out", error.message, "error");
    }
  }

  async function saveGroupFromForm() {
    const name = byId("inventory-group-picker")?.value.trim() || "";
    if (!name) {
      setStatus(
        "inventory-group-out",
        tr("inventoryGroupNameRequired", "group name is required"),
        "error",
      );
      return;
    }
    await saveGroupByName(name);
  }

  async function saveLabelByName(name, verb = tr("saved", "saved")) {
    setStatus("inventory-label-out", tr("running", "running"), "running");
    try {
      const data = await saveInventoryLabel(
        name,
        Array.from(labelHostSelection).sort((a, b) => a.localeCompare(b)),
      );
      applyInventoryLabelForm(data);
      setStatus(
        "inventory-label-out",
        `${verb}: ${data.name || name}`,
        "success",
      );
      await loadInventoryLabels();
      if (typeof window.loadSavedConnections === "function") {
        await window.loadSavedConnections();
      }
    } catch (error) {
      setStatus("inventory-label-out", error.message, "error");
    }
  }

  async function saveLabelFromForm() {
    const name = byId("inventory-label-picker")?.value.trim() || "";
    if (!name) {
      setStatus(
        "inventory-label-out",
        tr("inventoryLabelNameRequired", "label name is required"),
        "error",
      );
      return;
    }
    await saveLabelByName(name);
  }

  async function deleteGroupFromForm() {
    const name = byId("inventory-group-picker")?.value.trim() || "";
    if (!name) {
      setStatus(
        "inventory-group-out",
        tr("inventoryGroupNameRequired", "group name is required"),
        "error",
      );
      return;
    }
    setStatus("inventory-group-out", tr("running", "running"), "running");
    try {
      await deleteInventoryGroup(name);
      resetInventoryGroupForm("");
      setStatus(
        "inventory-group-out",
        `${tr("deleted", "deleted")}: ${name}`,
        "success",
      );
      await loadInventoryGroups();
      await loadInventoryConnections();
    } catch (error) {
      setStatus("inventory-group-out", error.message, "error");
    }
  }

  async function deleteLabelFromForm() {
    const name = byId("inventory-label-picker")?.value.trim() || "";
    if (!name) {
      setStatus(
        "inventory-label-out",
        tr("inventoryLabelNameRequired", "label name is required"),
        "error",
      );
      return;
    }
    setStatus("inventory-label-out", tr("running", "running"), "running");
    try {
      await deleteInventoryLabel(name);
      resetInventoryLabelForm("");
      setStatus(
        "inventory-label-out",
        `${tr("deleted", "deleted")}: ${name}`,
        "success",
      );
      await loadInventoryLabels();
      if (typeof window.loadSavedConnections === "function") {
        await window.loadSavedConnections();
      }
    } catch (error) {
      setStatus("inventory-label-out", error.message, "error");
    }
  }

  function selectAllGroupHosts() {
    const filter = safeString(byId("inventory-group-hosts-filter")?.value || "")
      .trim()
      .toLowerCase();
    hostOptions(Array.from(groupHostSelection))
      .names.filter((name) => !filter || name.toLowerCase().includes(filter))
      .forEach((name) => groupHostSelection.add(name));
    renderInventoryGroupHosts();
  }

  function selectAllLabelHosts() {
    const filter = safeString(byId("inventory-label-hosts-filter")?.value || "")
      .trim()
      .toLowerCase();
    hostOptions(Array.from(labelHostSelection))
      .names.filter((name) => !filter || name.toLowerCase().includes(filter))
      .forEach((name) => labelHostSelection.add(name));
    renderInventoryLabelHosts();
  }

  function clearGroupHosts() {
    groupHostSelection.clear();
    renderInventoryGroupHosts();
  }

  function clearLabelHosts() {
    labelHostSelection.clear();
    renderInventoryLabelHosts();
  }

  function onGroupHostChange(event) {
    const input = event.target;
    if (!input?.matches("[data-inventory-group-host]")) return;
    if (input.checked) groupHostSelection.add(input.value);
    else groupHostSelection.delete(input.value);
  }

  function onLabelHostChange(event) {
    const input = event.target;
    if (!input?.matches("[data-inventory-label-host]")) return;
    if (input.checked) labelHostSelection.add(input.value);
    else labelHostSelection.delete(input.value);
  }

  function onGroupListClick(event) {
    const row = event.target.closest(".js-inventory-group-row");
    if (!row) return;
    ensureSelectValue(
      "inventory-group-picker",
      row.getAttribute("data-name") || "",
    );
    loadInventoryGroupDetail();
  }

  function onLabelListClick(event) {
    const row = event.target.closest(".js-inventory-label-row");
    if (!row) return;
    ensureSelectValue(
      "inventory-label-picker",
      row.getAttribute("data-name") || "",
    );
    loadInventoryLabelDetail();
  }

  const groupPicker = byId("inventory-group-picker");
  const labelPicker = byId("inventory-label-picker");
  const groupNew = byId("inventory-group-new-btn");
  const groupSave = byId("inventory-group-save-btn");
  const groupDelete = byId("inventory-group-delete-btn");
  const labelNew = byId("inventory-label-new-btn");
  const labelSave = byId("inventory-label-save-btn");
  const labelDelete = byId("inventory-label-delete-btn");
  const groupFilter = byId("inventory-group-hosts-filter");
  const labelFilter = byId("inventory-label-hosts-filter");
  const groupSelectAll = byId("inventory-group-hosts-select-all-btn");
  const labelSelectAll = byId("inventory-label-hosts-select-all-btn");
  const groupClear = byId("inventory-group-hosts-clear-btn");
  const labelClear = byId("inventory-label-hosts-clear-btn");
  const groupHosts = byId("inventory-group-hosts");
  const labelHosts = byId("inventory-label-hosts");
  const groupList = byId("inventory-group-list");
  const labelList = byId("inventory-label-list");

  groupPicker?.addEventListener("change", loadInventoryGroupDetail);
  labelPicker?.addEventListener("change", loadInventoryLabelDetail);
  groupNew?.addEventListener("click", createInventoryGroupDraft);
  groupSave?.addEventListener("click", saveGroupFromForm);
  groupDelete?.addEventListener("click", deleteGroupFromForm);
  labelNew?.addEventListener("click", createInventoryLabelDraft);
  labelSave?.addEventListener("click", saveLabelFromForm);
  labelDelete?.addEventListener("click", deleteLabelFromForm);
  groupFilter?.addEventListener("input", renderInventoryGroupHosts);
  labelFilter?.addEventListener("input", renderInventoryLabelHosts);
  groupSelectAll?.addEventListener("click", selectAllGroupHosts);
  labelSelectAll?.addEventListener("click", selectAllLabelHosts);
  groupClear?.addEventListener("click", clearGroupHosts);
  labelClear?.addEventListener("click", clearLabelHosts);
  groupHosts?.addEventListener("change", onGroupHostChange);
  labelHosts?.addEventListener("change", onLabelHostChange);
  groupList?.addEventListener("click", onGroupListClick);
  labelList?.addEventListener("click", onLabelListClick);

  window.loadInventoryConnections = loadInventoryConnections;
  window.loadInventoryGroups = loadInventoryGroups;
  window.loadInventoryLabels = loadInventoryLabels;
  window.loadInventoryGroupDetail = loadInventoryGroupDetail;
  window.loadInventoryLabelDetail = loadInventoryLabelDetail;
  window.renderInventoryGroupHosts = renderInventoryGroupHosts;
  window.renderInventoryLabelHosts = renderInventoryLabelHosts;
  window.renderInventoryGroupOptions = renderInventoryGroupOptions;
  window.renderInventoryLabelOptions = renderInventoryLabelOptions;
  window.renderInventoryGroupList = renderInventoryGroupList;
  window.renderInventoryLabelList = renderInventoryLabelList;

  renderInventoryGroupHosts();
  renderInventoryLabelHosts();
  renderInventoryGroupList();
  renderInventoryLabelList();

  return {
    destroy() {
      groupPicker?.removeEventListener("change", loadInventoryGroupDetail);
      labelPicker?.removeEventListener("change", loadInventoryLabelDetail);
      groupNew?.removeEventListener("click", createInventoryGroupDraft);
      groupSave?.removeEventListener("click", saveGroupFromForm);
      groupDelete?.removeEventListener("click", deleteGroupFromForm);
      labelNew?.removeEventListener("click", createInventoryLabelDraft);
      labelSave?.removeEventListener("click", saveLabelFromForm);
      labelDelete?.removeEventListener("click", deleteLabelFromForm);
      groupFilter?.removeEventListener("input", renderInventoryGroupHosts);
      labelFilter?.removeEventListener("input", renderInventoryLabelHosts);
      groupSelectAll?.removeEventListener("click", selectAllGroupHosts);
      labelSelectAll?.removeEventListener("click", selectAllLabelHosts);
      groupClear?.removeEventListener("click", clearGroupHosts);
      labelClear?.removeEventListener("click", clearLabelHosts);
      groupHosts?.removeEventListener("change", onGroupHostChange);
      labelHosts?.removeEventListener("change", onLabelHostChange);
      groupList?.removeEventListener("click", onGroupListClick);
      labelList?.removeEventListener("click", onLabelListClick);
    },
  };
}
