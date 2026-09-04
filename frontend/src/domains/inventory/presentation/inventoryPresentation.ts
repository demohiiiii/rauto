import { tr } from "../../../lib/i18n.js";
import {
  classNames,
  safeString,
  selectOptionsWithCurrent,
} from "../../../lib/ui.js";
import { normalizeHostNames } from "../model/inventory.js";
import type {
  InventoryCollectionState,
  InventoryItem,
  InventoryKind,
  InventoryState,
} from "../model/types.js";

function inventoryCollectionRowClass(selected: boolean): string {
  return classNames(
    "group w-full rounded-lg border px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    selected
      ? "border-primary/40 bg-primary/10 text-foreground"
      : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
  );
}

function inventoryEmptyStatus(message: string, emptyText: [string, string]) {
  return message
    ? { message, tone: "error" as const }
    : { message: tr(emptyText[0], emptyText[1]), tone: "info" as const };
}

function inventoryCollectionRows(
  items: InventoryItem[],
  selectedName: string,
  groups: boolean,
) {
  return items.map((item) => {
    const selected = Boolean(selectedName && item.name === selectedName);
    const hostCount = item.hosts.length;
    return {
      buttonClass: inventoryCollectionRowClass(selected),
      descriptionText:
        item.description || tr("inventoryNoDescription", "no description"),
      hostBadgeText: `${hostCount} ${tr("inventoryHostsCountSuffix", "hosts")}`,
      hostCount,
      name: item.name || "",
      nameText: item.name || "-",
      selected,
      showDescription: groups,
    };
  });
}

function inventoryCollectionListPresentation(
  collection: InventoryCollectionState,
  kind: InventoryKind,
) {
  const groups = kind === "groups";
  const selectedValue = safeString(collection.selectedName);
  const collectionRows = inventoryCollectionRows(
    collection.items,
    selectedValue,
    groups,
  );
  const emptyText: [string, string] = groups
    ? ["inventoryGroupsEmpty", "no groups"]
    : ["inventoryLabelsEmpty", "no labels"];
  return {
    cancelButtonLabel: tr("cancelBtn"),
    catalogSearchPlaceholder: tr("inventoryCatalogSearchPlaceholder"),
    collectionCount: collectionRows.length,
    collectionCountLabel: tr("inventoryCollectionCountLabel"),
    collectionDescription: tr(
      groups ? "inventoryGroupsDescription" : "inventoryLabelsDescription",
    ),
    collectionRows,
    collectionTitle: tr(
      groups ? "inventoryGroupsTitle" : "inventoryLabelsTitle",
    ),
    confirmButtonLabel: tr("confirmBtn"),
    deleteButtonLabel: tr("savedConnDeleteBtn"),
    deleteConfirmText: tr(
      groups ? "inventoryGroupDeleteConfirm" : "inventoryLabelDeleteConfirm",
    ),
    editorDescription: tr(
      groups
        ? "inventoryGroupEditorDescription"
        : "inventoryLabelEditorDescription",
    ),
    editorTitle: tr(
      groups ? "inventoryGroupEditorTitle" : "inventoryLabelEditorTitle",
    ),
    emptyStatus: inventoryEmptyStatus(
      safeString(collection.errorMessage),
      emptyText,
    ),
    emptyTitle: tr(
      groups ? "inventoryGroupsEmptyTitle" : "inventoryLabelsEmptyTitle",
    ),
    hasItems: collectionRows.length > 0,
    kind,
    newButtonLabel: tr("newBtn"),
    newDialogDescription: tr(
      groups
        ? "inventoryGroupCreateDescription"
        : "inventoryLabelCreateDescription",
    ),
    newDialogTitle: tr(
      groups ? "inventoryGroupCreateTitle" : "inventoryLabelCreateTitle",
    ),
    newNameLabel: tr("inventoryFieldName"),
    newNamePlaceholder: tr(
      groups
        ? "inventoryGroupNamePlaceholder"
        : "inventoryLabelNamePlaceholder",
    ),
    newNameRequiredMessage: tr(
      groups ? "inventoryGroupNameRequired" : "inventoryLabelNameRequired",
    ),
    noMatchText: tr("inventoryCatalogNoMatch"),
    optionNames: selectOptionsWithCurrent(
      collection.items.map((item) => item.name).filter(Boolean),
      selectedValue,
    ),
    saveButtonLabel: tr("savedConnSaveBtn"),
    selectPlaceholder: tr(
      groups
        ? "inventoryGroupSelectPlaceholder"
        : "inventoryLabelSelectPlaceholder",
    ),
    selectedValue,
    selectionHint: tr(
      groups ? "inventoryGroupSelectionHint" : "inventoryLabelSelectionHint",
    ),
    showGroupFields: groups,
  };
}

function inventoryCollectionEditorPresentation(
  state: InventoryState,
  collection: InventoryCollectionState,
  kind: InventoryKind,
) {
  const groups = kind === "groups";
  const availableHostNames = normalizeHostNames(
    state.savedConnections.map((connection) => connection.name),
  );
  const availableHostSet = new Set(availableHostNames);
  const hostNames = normalizeHostNames([
    ...availableHostNames,
    ...collection.hostSelection,
  ]);
  const filter = collection.hostFilter.trim().toLowerCase();
  const filteredHostNames = hostNames.filter((hostName) =>
    filter ? hostName.toLowerCase().includes(filter) : true,
  );
  const emptyText = hostNames.length
    ? ["inventoryHostsNoMatch", "no matching saved connections"]
    : ["inventoryHostsEmpty", "no saved connections"];
  return {
    canEdit: Boolean(collection.selectedName.trim()),
    clearHostsButtonLabel: tr("inventoryHostsClearBtn"),
    collectionNameText: collection.selectedName || "—",
    descriptionLabel: tr("inventoryFieldDescription"),
    descriptionPlaceholder: tr("inventoryFieldDescriptionPlaceholder"),
    descriptionValue: collection.description,
    emptyText: tr(emptyText[0], emptyText[1]),
    hasFilteredHosts: filteredHostNames.length > 0,
    hostCount: hostNames.length,
    hostFilterPlaceholder: tr("inventoryFieldHostsFilterPlaceholder"),
    hostFilterValue: collection.hostFilter,
    hostMissingSuffix: tr("inventoryHostMissingSuffix", "(missing)"),
    hostRows: filteredHostNames.map((name) => ({
      available: availableHostSet.has(name),
      name,
      selected: collection.hostSelection.has(name),
    })),
    hostsLabel: tr("inventoryFieldHosts"),
    identityGridClass: groups ? "grid gap-2 md:grid-cols-2" : "grid gap-1",
    nameLabel: tr("inventoryFieldName"),
    selectAllHostsButtonLabel: tr("inventoryHostsSelectAllBtn"),
    selectedHostCount: collection.hostSelection.size,
    showGroupFields: groups,
    showStatus: Boolean(collection.statusMessage),
    statusMessage: collection.statusMessage,
    statusTone: collection.statusTone,
  };
}

function inventoryCollectionPanelDisplay(
  state: InventoryState,
  kind: InventoryKind,
) {
  const collection = kind === "groups" ? state.groups : state.labels;
  return {
    active: state.currentSection === kind,
    editorDisplay: inventoryCollectionEditorPresentation(
      state,
      collection,
      kind,
    ),
    listDisplay: inventoryCollectionListPresentation(collection, kind),
  };
}

export function inventoryPagePresentation(state: InventoryState) {
  return {
    devicesActive: state.currentSection === "devices",
    groups: inventoryCollectionPanelDisplay(state, "groups"),
    groupsActive: state.currentSection === "groups",
    labels: inventoryCollectionPanelDisplay(state, "labels"),
    labelsActive: state.currentSection === "labels",
    sectionAriaLabel: tr("inventoryTitle"),
  };
}

export type InventoryPageDisplay = ReturnType<typeof inventoryPagePresentation>;
export type InventoryCollectionDisplay = InventoryPageDisplay["groups"];
export type InventoryCollectionRow =
  InventoryCollectionDisplay["listDisplay"]["collectionRows"][number];
