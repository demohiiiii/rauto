import { get as getStore, writable } from "svelte/store";
import {
  EMPTY_INVENTORY_HOST_SET,
  INVENTORY_KIND,
} from "../../config/dashboardModes.js";
import { tr } from "../../lib/i18n.js";
import { safeString } from "../../lib/ui.js";
import { setConnectionInventorySnapshots } from "../connections/connectionFieldStoreState.js";

function createInventorySectionStore() {
  return writable({
    collectionItems: [],
    collectionNameText: "—",
    errorMessage: "",
    formDescription: "",
    hostAvailableSet: new Set(),
    hostFilterValue: "",
    hostNames: [],
    hostSelection: new Set(),
    options: [],
    selectedName: "",
    statusMessage: "",
    statusTone: "info",
  });
}

export function createInventoryStateContext() {
  let cachedInventoryGroups = [];
  let cachedInventoryLabels = [];
  const inventoryGroupsState = createInventorySectionStore();
  const inventoryLabelsState = createInventorySectionStore();

  function inventoryStoreFor(kind) {
    return kind === "labels" ? inventoryLabelsState : inventoryGroupsState;
  }

  function inventoryStateValue(kind) {
    return getStore(inventoryStoreFor(kind));
  }

  function updateInventoryState(kind, patch) {
    inventoryStoreFor(kind).update((state) => ({ ...state, ...patch }));
  }

  function selectedInventoryName(kind) {
    return safeString(inventoryStateValue(kind).selectedName || "").trim();
  }

  function setInventorySelectedName(kind, selectedName = "") {
    updateInventoryState(kind, { selectedName: selectedName || "" });
  }

  function updateInventoryGroupDescription(descriptionText = "") {
    updateInventoryState("groups", { formDescription: descriptionText });
  }

  function inventoryHostFilterValue(kind) {
    return safeString(inventoryStateValue(kind).hostFilterValue || "");
  }

  function setInventoryPickerOptions(
    kind,
    inventoryItems = [],
    selectedName = "",
  ) {
    updateInventoryState(kind, {
      options: inventoryItems
        .map((inventoryItem) => inventoryItem.name)
        .filter(Boolean),
      selectedName,
    });
  }

  function refreshInventorySnapshots(workspaceState) {
    cachedInventoryGroups = Array.isArray(workspaceState.groups)
      ? workspaceState.groups
      : [];
    cachedInventoryLabels = Array.isArray(workspaceState.labels)
      ? workspaceState.labels
      : [];
    setConnectionInventorySnapshots({
      groups: cachedInventoryGroups,
      labels: cachedInventoryLabels,
    });
  }

  return {
    inventoryGroupsState,
    inventoryHostFilterValue,
    inventoryLabelsState,
    inventoryStateValue,
    refreshInventorySnapshots,
    selectedInventoryName,
    setInventoryPickerOptions,
    setInventorySelectedName,
    updateInventoryGroupDescription,
    updateInventoryState,
  };
}

function normalizeHostNames(hostNameValues) {
  return Array.from(
    new Set(
      (hostNameValues || [])
        .map((hostName) => safeString(hostName).trim())
        .filter(Boolean),
    ),
  ).sort((leftHostName, rightHostName) =>
    leftHostName.localeCompare(rightHostName),
  );
}

function inventoryHostOptions(savedConnections, selectedHosts = []) {
  const available = normalizeHostNames(
    savedConnections.map((savedConnection) => savedConnection.name),
  );
  return {
    availableSet: new Set(available),
    names: normalizeHostNames([...available, ...selectedHosts]),
  };
}

function normalizeInventoryHostSelection(hosts = []) {
  return new Set(normalizeHostNames(Array.isArray(hosts) ? hosts : []));
}

function updateInventoryHostChecklist({
  kind,
  savedConnections,
  selection,
  stateContext,
}) {
  const { availableSet, names } = inventoryHostOptions(
    savedConnections,
    Array.from(selection),
  );
  stateContext.updateInventoryState(kind, {
    hostAvailableSet: availableSet,
    hostFilterValue: stateContext.inventoryHostFilterValue(kind),
    hostNames: names,
    hostSelection: new Set(selection),
  });
}

function selectVisibleInventoryHosts({
  kind,
  savedConnections,
  selection,
  stateContext,
}) {
  const filter = stateContext
    .inventoryHostFilterValue(kind)
    .trim()
    .toLowerCase();
  inventoryHostOptions(savedConnections, Array.from(selection))
    .names.filter(
      (hostName) => !filter || hostName.toLowerCase().includes(filter),
    )
    .forEach((hostName) => selection.add(hostName));
}

function selectAllInventoryHosts({
  kind,
  refreshHosts,
  savedConnections,
  selection,
  stateContext,
}) {
  selectVisibleInventoryHosts({
    kind,
    savedConnections,
    selection,
    stateContext,
  });
  refreshHosts();
}

function clearInventoryHosts(selection, refreshHosts) {
  selection.clear();
  refreshHosts();
}

function resetInventoryGroupFormState({ inventoryName = "", stateContext }) {
  stateContext.setInventorySelectedName("groups", inventoryName);
  stateContext.updateInventoryState("groups", {
    collectionNameText: inventoryName || "—",
    formDescription: "",
  });
  return new Set();
}

function applyInventoryGroupFormState({ group = {}, stateContext }) {
  stateContext.setInventorySelectedName("groups", group.name || "");
  stateContext.updateInventoryState("groups", {
    collectionNameText: group.name || "—",
    formDescription: group.description || "",
  });
  return normalizeInventoryHostSelection(group.hosts);
}

function resetInventoryLabelFormState({ inventoryName = "", stateContext }) {
  stateContext.setInventorySelectedName("labels", inventoryName);
  stateContext.updateInventoryState("labels", {
    collectionNameText: inventoryName || "—",
  });
  return new Set();
}

function applyInventoryLabelFormState({ label = {}, stateContext }) {
  stateContext.setInventorySelectedName("labels", label.name || "");
  stateContext.updateInventoryState("labels", {
    collectionNameText: label.name || "—",
  });
  return normalizeInventoryHostSelection(label.hosts);
}

export function buildInventoryGroupFormPayload({
  hostSelection,
  inventoryName,
  stateContext,
}) {
  const groupForm = stateContext.inventoryStateValue("groups");
  return {
    description: safeString(groupForm.formDescription || "").trim() || null,
    hosts: Array.from(hostSelection).sort((leftHostName, rightHostName) =>
      leftHostName.localeCompare(rightHostName),
    ),
    name: inventoryName,
  };
}

export function createInventoryWorkspaceState() {
  return {
    groupHostSelection: new Set(),
    groups: [],
    labelHostSelection: new Set(),
    labels: [],
    savedConnections: [],
  };
}

function inventorySelectionKey(kind) {
  return kind === INVENTORY_KIND.labels
    ? "labelHostSelection"
    : "groupHostSelection";
}

export function inventorySelectionFor(workspaceState, kind) {
  return workspaceState[inventorySelectionKey(kind)];
}

export function setInventorySelection(workspaceState, kind, selection) {
  workspaceState[inventorySelectionKey(kind)] = selection;
}

export function normalizeInventoryItems(inventoryItemsPayload) {
  return Array.isArray(inventoryItemsPayload) ? inventoryItemsPayload : [];
}

export function requireInventoryName({
  kind,
  message,
  setStatus,
  stateContext,
  statusKind = kind,
}) {
  const inventoryName = stateContext.selectedInventoryName(kind);
  if (inventoryName) return inventoryName;
  setStatus(statusKind, message, "error");
  return "";
}

export function applySelectedInventoryItem({
  applyForm,
  inventoryItems,
  kind,
  stateContext,
}) {
  const selectedName = stateContext.selectedInventoryName(kind);
  const selectedInventoryItem = inventoryItems.find(
    (inventoryItem) => inventoryItem.name === selectedName,
  );
  if (selectedInventoryItem) applyForm(selectedInventoryItem);
}

export function refreshInventoryHostChecklist({ kind, workspaceState }) {
  updateInventoryHostChecklist({
    kind,
    savedConnections: workspaceState.savedConnections,
    selection: inventorySelectionFor(workspaceState, kind),
    stateContext: workspaceState.stateContext,
  });
}

export function createInventoryHostSelection({
  loadInventoryGroupDetail,
  loadInventoryLabelDetail,
  stateContext,
  workspaceState,
  coordinator,
}) {
  function refreshHostsFor(kind) {
    return kind === INVENTORY_KIND.labels
      ? coordinator.refreshInventoryLabelHosts
      : coordinator.refreshInventoryGroupHosts;
  }

  function loadDetailFor(kind) {
    return kind === INVENTORY_KIND.labels
      ? loadInventoryLabelDetail
      : loadInventoryGroupDetail;
  }

  function selectAllHosts(kind) {
    selectAllInventoryHosts({
      kind,
      refreshHosts: refreshHostsFor(kind),
      savedConnections: workspaceState.savedConnections,
      selection: inventorySelectionFor(workspaceState, kind),
      stateContext,
    });
  }

  function clearHosts(kind) {
    clearInventoryHosts(
      inventorySelectionFor(workspaceState, kind),
      refreshHostsFor(kind),
    );
  }

  function updateHostSelection(kind, hostName = "", checked = false) {
    if (!hostName) return;
    const selection = inventorySelectionFor(workspaceState, kind);
    if (checked) selection.add(hostName);
    else selection.delete(hostName);
    refreshHostsFor(kind)();
  }

  function updateHostFilter(kind, hostFilterValue = "") {
    stateContext.updateInventoryState(kind, { hostFilterValue });
    refreshHostsFor(kind)();
  }

  function selectInventoryName(kind, selectedName = "") {
    stateContext.setInventorySelectedName(kind, selectedName);
    void loadDetailFor(kind)();
  }

  return {
    clearGroupHosts: () => clearHosts(INVENTORY_KIND.groups),
    clearLabelHosts: () => clearHosts(INVENTORY_KIND.labels),
    selectAllGroupHosts: () => selectAllHosts(INVENTORY_KIND.groups),
    selectAllLabelHosts: () => selectAllHosts(INVENTORY_KIND.labels),
    selectInventoryGroupName: (selectedName = "") =>
      selectInventoryName(INVENTORY_KIND.groups, selectedName),
    selectInventoryLabelName: (selectedName = "") =>
      selectInventoryName(INVENTORY_KIND.labels, selectedName),
    updateGroupHostFilter: (hostFilterValue = "") =>
      updateHostFilter(INVENTORY_KIND.groups, hostFilterValue),
    updateGroupHostSelection: (hostName = "", checked = false) =>
      updateHostSelection(INVENTORY_KIND.groups, hostName, checked),
    updateLabelHostFilter: (hostFilterValue = "") =>
      updateHostFilter(INVENTORY_KIND.labels, hostFilterValue),
    updateLabelHostSelection: (hostName = "", checked = false) =>
      updateHostSelection(INVENTORY_KIND.labels, hostName, checked),
  };
}

export function sortedInventoryHosts(selection = EMPTY_INVENTORY_HOST_SET) {
  return Array.from(selection).sort((leftHostName, rightHostName) =>
    leftHostName.localeCompare(rightHostName),
  );
}

export {
  applyInventoryGroupFormState,
  applyInventoryLabelFormState,
  resetInventoryGroupFormState,
  resetInventoryLabelFormState,
};
