import type {
  InventoryCollectionActionOptions,
  InventoryCollectionState,
  InventoryHostHandler,
  InventoryItem,
  InventoryKind,
  InventorySection,
  InventoryState,
  InventoryValueHandler,
} from "./types.js";

export function newInventoryCollectionState(): InventoryCollectionState {
  return {
    description: "",
    errorMessage: "",
    hostFilter: "",
    hostSelection: new Set<string>(),
    items: [],
    selectedName: "",
    statusMessage: "",
    statusTone: "info",
  };
}

export function newInventoryState(): InventoryState {
  return {
    currentSection: "devices",
    groups: newInventoryCollectionState(),
    labels: newInventoryCollectionState(),
    savedConnections: [],
  };
}

export function normalizeInventorySection(value: string): InventorySection {
  return value === "groups" || value === "labels" ? value : "devices";
}

export function collectionFor(
  state: InventoryState,
  kind: InventoryKind,
): InventoryCollectionState {
  return kind === "labels" ? state.labels : state.groups;
}

export function normalizeHostNames(values: Iterable<string> = []): string[] {
  return Array.from(
    new Set(
      Array.from(values)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function applyInventoryItem(
  collection: InventoryCollectionState,
  item: InventoryItem,
): void {
  collection.description = item.description || "";
  collection.hostSelection = new Set(normalizeHostNames(item.hosts));
  collection.selectedName = item.name || "";
}

export function resetInventorySelection(
  collection: InventoryCollectionState,
  name = "",
): void {
  collection.description = "";
  collection.hostSelection = new Set<string>();
  collection.selectedName = name;
}

export function sortedInventoryHosts(
  selection: Iterable<string> = [],
): string[] {
  return normalizeHostNames(selection);
}

function optionalValueHandler(
  handler: InventoryValueHandler | null | undefined,
): InventoryValueHandler | undefined {
  return typeof handler === "function" ? handler : undefined;
}

export function inventoryCollectionActionHandlers({
  onDescriptionInput,
  onHostFilter,
  onHostSelection,
  onSelectCollection,
}: InventoryCollectionActionOptions = {}) {
  const selectCollectionHandler = optionalValueHandler(onSelectCollection);
  const hostSelectionHandler: InventoryHostHandler | undefined =
    typeof onHostSelection === "function" ? onHostSelection : undefined;
  return {
    collectionChangeHandler: selectCollectionHandler,
    collectionSelectAction: (collectionName: string) => () =>
      selectCollectionHandler?.(collectionName),
    descriptionChangeHandler: optionalValueHandler(onDescriptionInput),
    hostFilterChangeHandler: optionalValueHandler(onHostFilter),
    hostSelectionToggleHandler: (hostName: string) =>
      hostSelectionHandler
        ? (checked: boolean) => hostSelectionHandler(hostName, checked)
        : undefined,
  };
}
