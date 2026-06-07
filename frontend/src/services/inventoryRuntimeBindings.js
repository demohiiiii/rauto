export function createInventoryBindings(byId, handlers) {
  const {
    clearGroupHosts,
    clearLabelHosts,
    createInventoryGroupDraft,
    createInventoryLabelDraft,
    deleteGroupFromForm,
    deleteLabelFromForm,
    loadInventoryGroupDetail,
    loadInventoryLabelDetail,
    onGroupHostChange,
    onGroupListClick,
    onLabelHostChange,
    onLabelListClick,
    renderInventoryGroupHosts,
    renderInventoryLabelHosts,
    saveGroupFromForm,
    saveLabelFromForm,
    selectAllGroupHosts,
    selectAllLabelHosts,
  } = handlers;

  return [
    ["inventory-group-picker", "change", loadInventoryGroupDetail],
    ["inventory-label-picker", "change", loadInventoryLabelDetail],
    ["inventory-group-new-btn", "click", createInventoryGroupDraft],
    ["inventory-group-save-btn", "click", saveGroupFromForm],
    ["inventory-group-delete-btn", "click", deleteGroupFromForm],
    ["inventory-label-new-btn", "click", createInventoryLabelDraft],
    ["inventory-label-save-btn", "click", saveLabelFromForm],
    ["inventory-label-delete-btn", "click", deleteLabelFromForm],
    ["inventory-group-hosts-filter", "input", renderInventoryGroupHosts],
    ["inventory-label-hosts-filter", "input", renderInventoryLabelHosts],
    ["inventory-group-hosts-select-all-btn", "click", selectAllGroupHosts],
    ["inventory-label-hosts-select-all-btn", "click", selectAllLabelHosts],
    ["inventory-group-hosts-clear-btn", "click", clearGroupHosts],
    ["inventory-label-hosts-clear-btn", "click", clearLabelHosts],
    ["inventory-group-hosts", "change", onGroupHostChange],
    ["inventory-label-hosts", "change", onLabelHostChange],
    ["inventory-group-list", "click", onGroupListClick],
    ["inventory-label-list", "click", onLabelListClick],
  ].map(([id, event, handler]) => [byId(id), event, handler]);
}

export function attachInventoryBindings(bindings) {
  bindings.forEach(([element, event, handler]) => {
    element?.addEventListener(event, handler);
  });
  return () => {
    bindings.forEach(([element, event, handler]) => {
      element?.removeEventListener(event, handler);
    });
  };
}

export function registerInventoryGlobals(handlers) {
  const {
    loadInventoryConnections,
    loadInventoryGroupDetail,
    loadInventoryGroups,
    loadInventoryLabelDetail,
    loadInventoryLabels,
    renderInventoryGroupHosts,
    renderInventoryGroupList,
    renderInventoryGroupOptions,
    renderInventoryLabelHosts,
    renderInventoryLabelList,
    renderInventoryLabelOptions,
  } = handlers;

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
}

export function selectInventoryListRow(event, className, onSelect) {
  const row = event.target.closest(className);
  if (!row) return;
  onSelect(row.getAttribute("data-name") || "");
}
