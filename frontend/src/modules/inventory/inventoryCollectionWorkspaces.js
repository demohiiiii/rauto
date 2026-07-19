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

export {
  createInventoryDependencies,
  createInventoryWorkspace,
} from "./inventoryCollectionState.js";

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
    "w-full rounded-xl border px-3 py-2 text-left transition",
    selected
      ? "border-teal-300 bg-teal-50/70"
      : "border-slate-200 bg-white hover:border-slate-300",
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
      hostBadgeClass:
        "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600",
      hostBadgeText: `${hostCount} ${tr("inventoryHostsCountSuffix", "hosts")}`,
      name: collectionName,
      nameText: collectionName || "-",
      showDescription: groupKind,
    };
  });
  const emptyText = groupKind
    ? ["inventoryGroupsEmpty", "no groups"]
    : ["inventoryLabelsEmpty", "no labels"];
  const message = safeString(errorMessage || "");
  return {
    collectionTitle: tr(
      groupKind ? "inventoryGroupsTitle" : "inventoryLabelsTitle",
    ),
    deleteButtonLabel: tr("savedConnDeleteBtn"),
    editorTitle: tr(
      groupKind ? "inventoryGroupEditorTitle" : "inventoryLabelEditorTitle",
    ),
    emptyStatus: inventoryEmptyStatus(message, emptyText),
    collectionRows,
    hasItems: collectionRows.length > 0,
    newButtonLabel: tr("newBtn"),
    optionNames: selectOptionsWithCurrent(optionNames, selectedValue),
    saveButtonLabel: tr("savedConnSaveBtn"),
    selectPlaceholder: tr(
      groupKind
        ? "inventoryGroupSelectPlaceholder"
        : "inventoryLabelSelectPlaceholder",
    ),
    selectedValue,
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
