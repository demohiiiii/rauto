import {
  EMPTY_INVENTORY_HOST_SET,
  isInventoryGroupsSection,
} from "../../config/dashboardModes.js";
import {
  classNames,
  safeString,
  selectOptionsWithCurrent,
} from "../../lib/ui.js";
import { tr } from "../../lib/i18n.js";

function inventorySectionPresentation(inventorySection = "") {
  return {
    groupsActive: isInventoryGroupsSection(inventorySection),
    labelsActive: !isInventoryGroupsSection(inventorySection),
  };
}

function inventoryPagePresentation() {
  return {
    sectionAriaLabel: tr("inventoryTitle"),
  };
}

function inventoryCollectionRowClass(selected) {
  return classNames(
    "group w-full rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    selected
      ? "border-primary/40 bg-primary/10 text-foreground"
      : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground",
  );
}

function inventoryEmptyStatus(message, emptyText) {
  return message
    ? {
        message,
        tone: "error",
      }
    : {
        message: tr(emptyText[0], emptyText[1]),
        tone: "info",
      };
}

function inventoryCollectionListPresentation({
  collectionItems = [],
  errorMessage = "",
  kind = "groups",
  options = [],
  selectedName = "",
} = {}) {
  const selectedValue = safeString(selectedName);
  const optionNames = (Array.isArray(options) ? options : []).filter(Boolean);
  const groupKind = isInventoryGroupsSection(kind);
  const collectionRows = (
    Array.isArray(collectionItems) ? collectionItems : []
  ).map((collectionItem) => {
    const collectionName = collectionItem?.name || "";
    const selected = Boolean(selectedValue && collectionName === selectedValue);
    const hostCount = Array.isArray(collectionItem?.hosts)
      ? collectionItem.hosts.length
      : 0;
    return {
      buttonClass: inventoryCollectionRowClass(selected),
      descriptionText:
        collectionItem?.description ||
        tr("inventoryNoDescription", "no description"),
      hostBadgeText: `${hostCount} ${tr("inventoryHostsCountSuffix", "hosts")}`,
      hostCount,
      name: collectionName,
      nameText: collectionName || "-",
      selected,
      showDescription: groupKind,
    };
  });
  const emptyText = groupKind
    ? ["inventoryGroupsEmpty", "no groups"]
    : ["inventoryLabelsEmpty", "no labels"];
  const message = safeString(errorMessage || "");
  return {
    cancelButtonLabel: tr("cancelBtn"),
    collectionTitle: tr(
      groupKind ? "inventoryGroupsTitle" : "inventoryLabelsTitle",
    ),
    collectionDescription: tr(
      groupKind ? "inventoryGroupsDescription" : "inventoryLabelsDescription",
    ),
    collectionCount: collectionRows.length,
    collectionCountLabel: tr("inventoryCollectionCountLabel"),
    catalogSearchPlaceholder: tr("inventoryCatalogSearchPlaceholder"),
    confirmButtonLabel: tr("confirmBtn"),
    deleteButtonLabel: tr("savedConnDeleteBtn"),
    deleteConfirmText: tr(
      groupKind ? "inventoryGroupDeleteConfirm" : "inventoryLabelDeleteConfirm",
    ),
    editorTitle: tr(
      groupKind ? "inventoryGroupEditorTitle" : "inventoryLabelEditorTitle",
    ),
    editorDescription: tr(
      groupKind
        ? "inventoryGroupEditorDescription"
        : "inventoryLabelEditorDescription",
    ),
    emptyStatus: inventoryEmptyStatus(message, emptyText),
    emptyTitle: tr(
      groupKind ? "inventoryGroupsEmptyTitle" : "inventoryLabelsEmptyTitle",
    ),
    noMatchText: tr("inventoryCatalogNoMatch"),
    collectionRows,
    hasItems: collectionRows.length > 0,
    newButtonLabel: tr("newBtn"),
    newDialogDescription: tr(
      groupKind
        ? "inventoryGroupCreateDescription"
        : "inventoryLabelCreateDescription",
    ),
    newDialogTitle: tr(
      groupKind ? "inventoryGroupCreateTitle" : "inventoryLabelCreateTitle",
    ),
    newNameLabel: tr("inventoryFieldName"),
    newNamePlaceholder: tr(
      groupKind
        ? "inventoryGroupNamePlaceholder"
        : "inventoryLabelNamePlaceholder",
    ),
    newNameRequiredMessage: tr(
      groupKind ? "inventoryGroupNameRequired" : "inventoryLabelNameRequired",
    ),
    optionNames: selectOptionsWithCurrent(optionNames, selectedValue),
    saveButtonLabel: tr("savedConnSaveBtn"),
    selectPlaceholder: tr(
      groupKind
        ? "inventoryGroupSelectPlaceholder"
        : "inventoryLabelSelectPlaceholder",
    ),
    selectedValue,
    selectionHint: tr(
      groupKind ? "inventoryGroupSelectionHint" : "inventoryLabelSelectionHint",
    ),
    showGroupFields: groupKind,
    kind: groupKind ? "groups" : "labels",
  };
}

function inventoryCollectionEditorPresentation({
  collectionNameText = "—",
  formDescription = "",
  hostAvailableSet = EMPTY_INVENTORY_HOST_SET,
  hostFilterValue = "",
  hostNames = [],
  hostSelection = EMPTY_INVENTORY_HOST_SET,
  kind = "groups",
  statusMessage = "",
  statusTone = "info",
} = {}) {
  const normalizedHostNames = Array.isArray(hostNames) ? hostNames : [];
  const groupKind = isInventoryGroupsSection(kind);
  const filter = safeString(hostFilterValue).trim().toLowerCase();
  const filteredHostNames = normalizedHostNames.filter((hostName) =>
    filter ? safeString(hostName).toLowerCase().includes(filter) : true,
  );
  const emptyText = normalizedHostNames.length
    ? ["inventoryHostsNoMatch", "no matching saved connections"]
    : ["inventoryHostsEmpty", "no saved connections"];
  return {
    clearHostsButtonLabel: tr("inventoryHostsClearBtn"),
    collectionNameText: safeString(collectionNameText || "—"),
    descriptionLabel: tr("inventoryFieldDescription"),
    descriptionPlaceholder: tr("inventoryFieldDescriptionPlaceholder"),
    descriptionValue: safeString(formDescription),
    emptyText: tr(emptyText[0], emptyText[1]),
    hasFilteredHosts: filteredHostNames.length > 0,
    hostFilterPlaceholder: tr("inventoryFieldHostsFilterPlaceholder"),
    hostFilterValue: safeString(hostFilterValue),
    hostMissingSuffix: tr("inventoryHostMissingSuffix", "(missing)"),
    hostsLabel: tr("inventoryFieldHosts"),
    hostRows: filteredHostNames.map((hostName) => ({
      available: Boolean(hostAvailableSet?.has(hostName)),
      name: hostName,
      selected: Boolean(hostSelection?.has(hostName)),
    })),
    hostCount: normalizedHostNames.length,
    selectedHostCount: hostSelection?.size || 0,
    canEdit: Boolean(
      safeString(collectionNameText).trim() && collectionNameText !== "—",
    ),
    identityGridClass: groupKind ? "grid gap-2 md:grid-cols-2" : "grid gap-1",
    nameLabel: tr("inventoryFieldName"),
    selectAllHostsButtonLabel: tr("inventoryHostsSelectAllBtn"),
    showGroupFields: groupKind,
    showStatus: Boolean(safeString(statusMessage)),
    statusMessage: safeString(statusMessage),
    statusTone: safeString(statusTone) || "info",
  };
}

function inventoryCollectionPanelDisplay(
  collection = {},
  kind = "groups",
  active,
) {
  const collectionDisplay = {
    collectionItems: Array.isArray(collection.collectionItems)
      ? collection.collectionItems
      : [],
    collectionNameText: safeString(collection.collectionNameText || "—"),
    errorMessage: safeString(collection.errorMessage || ""),
    formDescription: collection.formDescription || "",
    hostAvailableSet: collection.hostAvailableSet || EMPTY_INVENTORY_HOST_SET,
    hostFilterValue: collection.hostFilterValue || "",
    hostNames: Array.isArray(collection.hostNames) ? collection.hostNames : [],
    hostSelection: collection.hostSelection || EMPTY_INVENTORY_HOST_SET,
    kind,
    options: Array.isArray(collection.options) ? collection.options : [],
    selectedName: safeString(collection.selectedName || ""),
    statusMessage: safeString(collection.statusMessage || ""),
    statusTone: collection.statusTone || "info",
  };

  return {
    active: !!active,
    editorDisplay: inventoryCollectionEditorPresentation(collectionDisplay),
    listDisplay: inventoryCollectionListPresentation(collectionDisplay),
  };
}

export function inventoryPageDisplay(
  groupsState = {},
  labelsState = {},
  inventorySection = "",
) {
  const sectionDisplay = inventorySectionPresentation(inventorySection);
  return {
    ...inventoryPagePresentation(),
    ...sectionDisplay,
    groups: inventoryCollectionPanelDisplay(
      groupsState,
      "groups",
      sectionDisplay.groupsActive,
    ),
    labels: inventoryCollectionPanelDisplay(
      labelsState,
      "labels",
      sectionDisplay.labelsActive,
    ),
  };
}
