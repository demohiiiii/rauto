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
  createInventoryDraft,
  deleteInventoryEntity,
  loadInventoryCollection,
  loadInventoryDetail,
  requireInventoryName,
  saveInventoryEntity,
} from "../services/inventoryActions.js";
import {
  applyInventoryGroupFormView,
  applyInventoryLabelFormView,
  ensureInventorySelectValue,
  inventoryGroupFormPayload as buildInventoryGroupFormPayload,
  resetInventoryGroupFormView,
  resetInventoryLabelFormView,
  sortedInventoryHosts,
} from "../services/inventoryForms.js";
import {
  renderInventoryGroupListView,
  renderInventoryLabelListView,
} from "../services/inventoryRender.js";
import {
  clearInventoryHosts,
  onInventoryHostSelectionChange,
  renderInventoryHostChecklist,
  selectAllInventoryHosts,
} from "../services/inventoryHostSelection.js";
import {
  applySelectedInventoryItem,
  normalizeInventoryItems,
} from "../services/inventoryLoaders.js";
import {
  inventoryGroupPlaceholder,
  inventoryLabelPlaceholder,
  refreshSavedConnectionGroupOptions,
  refreshSavedConnectionLabelOptions,
  renderInventoryEntityOptions,
} from "../services/inventoryOptions.js";
import {
  attachInventoryBindings,
  createInventoryBindings,
  registerInventoryGlobals,
  selectInventoryListRow,
} from "../services/inventoryRuntimeBindings.js";
import { statusCard, tr } from "../services/templateUi.js";

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

  function renderInventoryGroupHosts() {
    renderInventoryHostChecklist({
      byId,
      listId: "inventory-group-hosts",
      emptyId: "inventory-group-hosts-empty",
      filterId: "inventory-group-hosts-filter",
      savedConnections,
      selection: groupHostSelection,
      checkboxAttr: 'data-inventory-group-host="1"',
    });
  }

  function renderInventoryLabelHosts() {
    renderInventoryHostChecklist({
      byId,
      listId: "inventory-label-hosts",
      emptyId: "inventory-label-hosts-empty",
      filterId: "inventory-label-hosts-filter",
      savedConnections,
      selection: labelHostSelection,
      checkboxAttr: 'data-inventory-label-host="1"',
    });
  }

  function renderInventoryGroupOptions(selectedName = "") {
    renderInventoryEntityOptions({
      byId,
      items: groups,
      pickerId: "inventory-group-picker",
      placeholder: inventoryGroupPlaceholder(),
      selectedName,
    });
    renderInventoryGroupHosts();
    refreshSavedConnectionGroupOptions();
  }

  function renderInventoryLabelOptions(selectedName = "") {
    renderInventoryEntityOptions({
      byId,
      items: labels,
      pickerId: "inventory-label-picker",
      placeholder: inventoryLabelPlaceholder(),
      selectedName,
    });
    renderInventoryLabelHosts();
    refreshSavedConnectionLabelOptions();
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
    groupHostSelection = resetInventoryGroupFormView({ byId, name });
    renderInventoryGroupHosts();
  }

  function applyInventoryGroupForm(item) {
    groupHostSelection = applyInventoryGroupFormView({
      byId,
      group: item || {},
    });
    renderInventoryGroupHosts();
  }

  function resetInventoryLabelForm(name = "") {
    labelHostSelection = resetInventoryLabelFormView({ byId, name });
    renderInventoryLabelHosts();
  }

  function applyInventoryLabelForm(item) {
    labelHostSelection = applyInventoryLabelFormView({
      byId,
      label: item || {},
    });
    renderInventoryLabelHosts();
  }

  async function loadInventoryConnections() {
    try {
      const data = await listConnections();
      savedConnections = normalizeInventoryItems(data);
    } catch (_) {
      savedConnections = [];
    }
    renderInventoryGroupHosts();
    renderInventoryLabelHosts();
  }

  async function loadInventoryGroups() {
    await loadInventoryCollection({
      applySelected: () =>
        applySelectedInventoryItem({
          applyForm: applyInventoryGroupForm,
          byId,
          items: groups,
          pickerId: "inventory-group-picker",
        }),
      listItems: async () =>
        normalizeInventoryItems(await listInventoryGroups()),
      onLoaded: (items) => {
        groups = items;
      },
      onReset: () => {
        groups = [];
      },
      renderList: renderInventoryGroupList,
      renderOptions: renderInventoryGroupOptions,
      selectedName: byId("inventory-group-picker")?.value || "",
      syncSnapshots: syncInventoryRuntimeSnapshots,
    });
  }

  async function loadInventoryLabels() {
    await loadInventoryCollection({
      applySelected: () =>
        applySelectedInventoryItem({
          applyForm: applyInventoryLabelForm,
          byId,
          items: labels,
          pickerId: "inventory-label-picker",
        }),
      listItems: async () =>
        normalizeInventoryItems(await listInventoryLabels()),
      onLoaded: (items) => {
        labels = items;
      },
      onReset: () => {
        labels = [];
      },
      renderList: renderInventoryLabelList,
      renderOptions: renderInventoryLabelOptions,
      selectedName: byId("inventory-label-picker")?.value || "",
      syncSnapshots: syncInventoryRuntimeSnapshots,
    });
  }

  async function loadInventoryGroupDetail() {
    await loadInventoryDetail({
      applyForm: applyInventoryGroupForm,
      byId,
      getDetail: getInventoryGroup,
      pickerId: "inventory-group-picker",
      renderList: renderInventoryGroupList,
      resetForm: resetInventoryGroupForm,
      setStatus,
      statusId: "inventory-group-out",
    });
  }

  async function loadInventoryLabelDetail() {
    await loadInventoryDetail({
      applyForm: applyInventoryLabelForm,
      byId,
      getDetail: getInventoryLabel,
      pickerId: "inventory-label-picker",
      renderList: renderInventoryLabelList,
      resetForm: resetInventoryLabelForm,
      setStatus,
      statusId: "inventory-label-out",
    });
  }

  function inventoryGroupFormPayload(name) {
    return buildInventoryGroupFormPayload({
      byId,
      hostSelection: groupHostSelection,
      name,
    });
  }

  async function createInventoryGroupDraft() {
    await createInventoryDraft({
      byId,
      existsHint: tr("inventoryGroupExistsHint", "group already exists"),
      items: groups,
      loadDetail: loadInventoryGroupDetail,
      pickerId: "inventory-group-picker",
      promptMessage: tr("inventoryGroupNewPrompt", "New inventory group name"),
      saveByName: saveGroupByName,
      setStatus,
      statusId: "inventory-group-out",
    });
  }

  async function createInventoryLabelDraft() {
    await createInventoryDraft({
      byId,
      existsHint: tr("inventoryLabelExistsHint", "label already exists"),
      items: labels,
      loadDetail: loadInventoryLabelDetail,
      pickerId: "inventory-label-picker",
      promptMessage: tr("inventoryLabelNewPrompt", "New inventory label name"),
      saveByName: saveLabelByName,
      setStatus,
      statusId: "inventory-label-out",
    });
  }

  async function saveGroupByName(name, verb = tr("saved", "saved")) {
    await saveInventoryEntity({
      applyForm: applyInventoryGroupForm,
      buildPayload: inventoryGroupFormPayload,
      name,
      reload: reloadGroupsAndConnections,
      saveEntity: saveInventoryGroup,
      setStatus,
      statusId: "inventory-group-out",
      verb,
    });
  }

  async function refreshSavedConnections() {
    if (typeof window.loadSavedConnections === "function") {
      await window.loadSavedConnections();
    }
  }

  async function reloadLabelsAndSavedConnections() {
    await loadInventoryLabels();
    await refreshSavedConnections();
  }

  async function reloadGroupsAndConnections() {
    await loadInventoryGroups();
    await loadInventoryConnections();
  }

  async function saveGroupFromForm() {
    const name = requireInventoryName({
      byId,
      message: tr("inventoryGroupNameRequired", "group name is required"),
      pickerId: "inventory-group-picker",
      setStatus,
      statusId: "inventory-group-out",
    });
    if (!name) return;
    await saveGroupByName(name);
  }

  async function saveLabelByName(name, verb = tr("saved", "saved")) {
    await saveInventoryEntity({
      applyForm: applyInventoryLabelForm,
      buildPayload: () => sortedInventoryHosts(labelHostSelection),
      name,
      reload: reloadLabelsAndSavedConnections,
      saveEntity: saveInventoryLabel,
      setStatus,
      statusId: "inventory-label-out",
      verb,
    });
  }

  async function saveLabelFromForm() {
    const name = requireInventoryName({
      byId,
      message: tr("inventoryLabelNameRequired", "label name is required"),
      pickerId: "inventory-label-picker",
      setStatus,
      statusId: "inventory-label-out",
    });
    if (!name) return;
    await saveLabelByName(name);
  }

  async function deleteGroupFromForm() {
    const name = requireInventoryName({
      byId,
      message: tr("inventoryGroupNameRequired", "group name is required"),
      pickerId: "inventory-group-picker",
      setStatus,
      statusId: "inventory-group-out",
    });
    if (!name) return;
    await deleteInventoryEntity({
      deleteEntity: deleteInventoryGroup,
      name,
      reload: reloadGroupsAndConnections,
      resetForm: resetInventoryGroupForm,
      setStatus,
      statusId: "inventory-group-out",
    });
  }

  async function deleteLabelFromForm() {
    const name = requireInventoryName({
      byId,
      message: tr("inventoryLabelNameRequired", "label name is required"),
      pickerId: "inventory-label-picker",
      setStatus,
      statusId: "inventory-label-out",
    });
    if (!name) return;
    await deleteInventoryEntity({
      deleteEntity: deleteInventoryLabel,
      name,
      reload: reloadLabelsAndSavedConnections,
      resetForm: resetInventoryLabelForm,
      setStatus,
      statusId: "inventory-label-out",
    });
  }

  function selectAllGroupHosts() {
    selectAllInventoryHosts({
      byId,
      filterId: "inventory-group-hosts-filter",
      renderHosts: renderInventoryGroupHosts,
      savedConnections,
      selection: groupHostSelection,
    });
  }

  function selectAllLabelHosts() {
    selectAllInventoryHosts({
      byId,
      filterId: "inventory-label-hosts-filter",
      renderHosts: renderInventoryLabelHosts,
      savedConnections,
      selection: labelHostSelection,
    });
  }

  function clearGroupHosts() {
    clearInventoryHosts(groupHostSelection, renderInventoryGroupHosts);
  }

  function clearLabelHosts() {
    clearInventoryHosts(labelHostSelection, renderInventoryLabelHosts);
  }

  function onGroupHostChange(event) {
    onInventoryHostSelectionChange({
      event,
      selection: groupHostSelection,
      selector: "[data-inventory-group-host]",
    });
  }

  function onLabelHostChange(event) {
    onInventoryHostSelectionChange({
      event,
      selection: labelHostSelection,
      selector: "[data-inventory-label-host]",
    });
  }

  function onGroupListClick(event) {
    selectInventoryListRow(event, ".js-inventory-group-row", (name) => {
      ensureInventorySelectValue(byId, "inventory-group-picker", name);
      loadInventoryGroupDetail();
    });
  }

  function onLabelListClick(event) {
    selectInventoryListRow(event, ".js-inventory-label-row", (name) => {
      ensureInventorySelectValue(byId, "inventory-label-picker", name);
      loadInventoryLabelDetail();
    });
  }

  const handlers = {
    clearGroupHosts,
    clearLabelHosts,
    createInventoryGroupDraft,
    createInventoryLabelDraft,
    deleteGroupFromForm,
    deleteLabelFromForm,
    loadInventoryConnections,
    loadInventoryGroupDetail,
    loadInventoryGroups,
    loadInventoryLabelDetail,
    loadInventoryLabels,
    onGroupHostChange,
    onGroupListClick,
    onLabelHostChange,
    onLabelListClick,
    renderInventoryGroupHosts,
    renderInventoryGroupList,
    renderInventoryGroupOptions,
    renderInventoryLabelHosts,
    renderInventoryLabelList,
    renderInventoryLabelOptions,
    saveGroupFromForm,
    saveLabelFromForm,
    selectAllGroupHosts,
    selectAllLabelHosts,
  };
  const detachInventoryBindings = attachInventoryBindings(
    createInventoryBindings(byId, handlers),
  );
  registerInventoryGlobals(handlers);

  renderInventoryGroupHosts();
  renderInventoryLabelHosts();
  renderInventoryGroupList();
  renderInventoryLabelList();

  return {
    destroy() {
      detachInventoryBindings();
    },
  };
}
