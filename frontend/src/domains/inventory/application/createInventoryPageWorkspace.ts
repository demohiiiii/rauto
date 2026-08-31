import { derived, get, writable } from "svelte/store";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import { inventoryApi } from "../infrastructure/inventoryApi.js";
import { inventoryRuntime } from "../infrastructure/inventoryRuntime.js";
import {
  applyInventoryItem,
  collectionFor,
  newInventoryState,
  normalizeHostNames,
  normalizeInventoryItems,
  normalizeInventorySection,
  normalizeSavedConnections,
  resetInventorySelection,
  sortedInventoryHosts,
} from "../model/inventory.js";
import type {
  InventoryApi,
  InventoryCollectionState,
  InventoryItem,
  InventoryKind,
  InventoryPageWorkspace,
  InventoryRuntime,
  InventoryState,
  InventoryWorkspaceOptions,
} from "../model/types.js";
import {
  inventoryPagePresentation,
  type InventoryPageDisplay,
} from "../presentation/inventoryPresentation.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createInventoryPageWorkspace(
  options: InventoryWorkspaceOptions = {},
): InventoryPageWorkspace<InventoryPageDisplay> {
  const api = Object.assign({}, inventoryApi, options.api) as InventoryApi;
  const runtime = Object.assign(
    {},
    inventoryRuntime,
    options.runtime,
  ) as InventoryRuntime;
  const inventoryStateStore = writable<InventoryState>(newInventoryState());
  const currentInventorySectionState = derived(
    inventoryStateStore,
    ($state) => $state.currentSection,
  );
  const pageDisplayStateStore = derived(
    [inventoryStateStore, currentLanguageState],
    ([$state]) => inventoryPagePresentation($state),
  );
  const requestVersions = {
    connections: 0,
    groups: 0,
    groupDetail: 0,
    labels: 0,
    labelDetail: 0,
  };
  let active = false;
  let didInitialLoad = false;
  let destroyed = false;
  let savedConnectionsRefreshVersion: number | undefined;
  let protectedResourcesRefreshVersion: number | undefined;

  function updateState(mutation: (state: InventoryState) => void): void {
    if (destroyed) return;
    const state = get(inventoryStateStore);
    mutation(state);
    inventoryStateStore.set(state);
  }

  function syncConnectionInventory(state = get(inventoryStateStore)): void {
    runtime.syncConnectionInventory(state.groups.items, state.labels.items);
  }

  function setStatus(
    kind: InventoryKind,
    message: string,
    tone: InventoryCollectionState["statusTone"] = "info",
  ): void {
    updateState((state) => {
      const collection = collectionFor(state, kind);
      collection.statusMessage = message || "";
      collection.statusTone = tone;
    });
  }

  async function loadConnections(): Promise<void> {
    const version = ++requestVersions.connections;
    try {
      const connections = normalizeSavedConnections(
        await api.listConnections(),
      );
      if (version !== requestVersions.connections || destroyed) return;
      updateState((state) => {
        state.savedConnections = connections;
      });
    } catch {
      if (version !== requestVersions.connections || destroyed) return;
      updateState((state) => {
        state.savedConnections = [];
      });
    }
  }

  async function loadCollection(kind: InventoryKind): Promise<void> {
    const requestKey = kind === "groups" ? "groups" : "labels";
    const version = ++requestVersions[requestKey];
    try {
      const items = normalizeInventoryItems(
        await (kind === "groups" ? api.listGroups() : api.listLabels()),
      );
      if (version !== requestVersions[requestKey] || destroyed) return;
      updateState((state) => {
        const collection = collectionFor(state, kind);
        collection.errorMessage = "";
        collection.items = items;
        const selected = items.find(
          (item) => item.name === collection.selectedName,
        );
        if (selected) applyInventoryItem(collection, selected);
        else if (collection.selectedName) resetInventorySelection(collection);
        syncConnectionInventory(state);
      });
    } catch (error) {
      if (version !== requestVersions[requestKey] || destroyed) return;
      updateState((state) => {
        const collection = collectionFor(state, kind);
        collection.errorMessage = errorMessage(error);
        collection.items = [];
        resetInventorySelection(collection);
        syncConnectionInventory(state);
      });
    }
  }

  async function loadCollections(): Promise<void> {
    await Promise.allSettled([
      loadConnections(),
      loadCollection("groups"),
      loadCollection("labels"),
    ]);
  }

  async function loadDetail(kind: InventoryKind, name: string): Promise<void> {
    const requestKey = kind === "groups" ? "groupDetail" : "labelDetail";
    const version = ++requestVersions[requestKey];
    if (!name) {
      updateState((state) => {
        const collection = collectionFor(state, kind);
        resetInventorySelection(collection);
        collection.statusMessage = "-";
        collection.statusTone = "info";
      });
      return;
    }
    setStatus(kind, tr("running", "running"), "running");
    try {
      const item = await (kind === "groups"
        ? api.getGroup(name)
        : api.getLabel(name));
      if (version !== requestVersions[requestKey] || destroyed) return;
      updateState((state) => {
        const collection = collectionFor(state, kind);
        applyInventoryItem(collection, item);
        collection.statusMessage = `${tr("loaded", "loaded")}: ${item.name || name}`;
        collection.statusTone = "success";
      });
    } catch (error) {
      if (version !== requestVersions[requestKey] || destroyed) return;
      setStatus(kind, errorMessage(error), "error");
    }
  }

  function selectCollection(kind: InventoryKind, name = ""): void {
    const normalizedName = String(name || "");
    updateState((state) => {
      collectionFor(state, kind).selectedName = normalizedName;
    });
    void loadDetail(kind, normalizedName);
  }

  function updateCollection(
    kind: InventoryKind,
    mutation: (collection: InventoryCollectionState) => void,
  ): void {
    updateState((state) => mutation(collectionFor(state, kind)));
  }

  function updateHostSelection(
    kind: InventoryKind,
    name = "",
    checked = false,
  ): void {
    if (!name) return;
    updateCollection(kind, (collection) => {
      const selection = new Set(collection.hostSelection);
      if (checked) selection.add(name);
      else selection.delete(name);
      collection.hostSelection = selection;
    });
  }

  function selectAllHosts(kind: InventoryKind): void {
    updateState((state) => {
      const collection = collectionFor(state, kind);
      const filter = collection.hostFilter.trim().toLowerCase();
      const hostNames = normalizeHostNames([
        ...state.savedConnections.map((connection) => connection.name),
        ...collection.hostSelection,
      ]);
      collection.hostSelection = new Set([
        ...collection.hostSelection,
        ...hostNames.filter(
          (name) => !filter || name.toLowerCase().includes(filter),
        ),
      ]);
    });
  }

  function clearHosts(kind: InventoryKind): void {
    updateCollection(kind, (collection) => {
      collection.hostSelection = new Set<string>();
    });
  }

  async function reloadAfterMutation(kind: InventoryKind): Promise<void> {
    await loadCollection(kind);
    if (kind === "labels") await runtime.reloadSavedConnections();
    await loadConnections();
  }

  async function saveByName(
    kind: InventoryKind,
    name: string,
    verb: string,
  ): Promise<void> {
    const collection = collectionFor(get(inventoryStateStore), kind);
    const hosts = sortedInventoryHosts(collection.hostSelection);
    setStatus(kind, tr("running", "running"), "running");
    try {
      const item =
        kind === "groups"
          ? await api.saveGroup(name, {
              description: collection.description.trim() || null,
              hosts,
              name,
            })
          : await api.saveLabel(name, hosts);
      updateState((state) => {
        const current = collectionFor(state, kind);
        applyInventoryItem(current, item);
        current.statusMessage = `${verb}: ${item.name || name}`;
        current.statusTone = "success";
      });
      await reloadAfterMutation(kind);
    } catch (error) {
      setStatus(kind, errorMessage(error), "error");
    }
  }

  async function createDraft(kind: InventoryKind, rawName = ""): Promise<void> {
    const name = rawName.trim();
    if (!name) {
      setStatus(
        kind,
        tr(
          kind === "groups"
            ? "inventoryGroupNameRequired"
            : "inventoryLabelNameRequired",
        ),
        "error",
      );
      return;
    }
    const collection = collectionFor(get(inventoryStateStore), kind);
    if (collection.items.some((item) => item.name === name)) {
      updateState((state) => {
        collectionFor(state, kind).selectedName = name;
      });
      await loadDetail(kind, name);
      setStatus(
        kind,
        tr(
          kind === "groups"
            ? "inventoryGroupExistsHint"
            : "inventoryLabelExistsHint",
        ),
        "info",
      );
      return;
    }
    updateCollection(kind, (current) => resetInventorySelection(current, name));
    await saveByName(kind, name, tr("created", "created"));
  }

  async function saveSelection(kind: InventoryKind): Promise<void> {
    const name = collectionFor(
      get(inventoryStateStore),
      kind,
    ).selectedName.trim();
    if (!name) {
      await createDraft(kind);
      return;
    }
    await saveByName(kind, name, tr("saved", "saved"));
  }

  async function deleteSelection(kind: InventoryKind): Promise<void> {
    const name = collectionFor(
      get(inventoryStateStore),
      kind,
    ).selectedName.trim();
    if (!name) {
      await createDraft(kind);
      return;
    }
    setStatus(kind, tr("running", "running"), "running");
    try {
      await (kind === "groups" ? api.deleteGroup(name) : api.deleteLabel(name));
      updateCollection(kind, (collection) => {
        resetInventorySelection(collection);
        collection.statusMessage = `${tr("deleted", "deleted")}: ${name}`;
        collection.statusTone = "success";
      });
      await reloadAfterMutation(kind);
    } catch (error) {
      setStatus(kind, errorMessage(error), "error");
    }
  }

  const unsubscribeSavedConnections =
    runtime.savedConnectionsRefreshState.subscribe((version) => {
      const changed =
        savedConnectionsRefreshVersion !== undefined &&
        version !== savedConnectionsRefreshVersion;
      savedConnectionsRefreshVersion = version;
      if (changed && active && didInitialLoad) void loadConnections();
    });
  const unsubscribeProtectedResources =
    runtime.protectedResourcesRefreshState.subscribe((version) => {
      const changed =
        protectedResourcesRefreshVersion !== undefined &&
        version !== protectedResourcesRefreshVersion;
      protectedResourcesRefreshVersion = version;
      if (changed && active && didInitialLoad) void loadCollections();
    });

  function setPageContext({ active: nextActive = false } = {}): void {
    active = nextActive;
    if (!active) {
      didInitialLoad = false;
      return;
    }
    if (didInitialLoad) return;
    didInitialLoad = true;
    void loadCollections();
  }

  function destroy(): void {
    active = false;
    didInitialLoad = false;
    destroyed = true;
    Object.keys(requestVersions).forEach((key) => {
      requestVersions[key as keyof typeof requestVersions] += 1;
    });
    unsubscribeSavedConnections();
    unsubscribeProtectedResources();
  }

  return {
    clearGroupHosts: () => clearHosts("groups"),
    clearLabelHosts: () => clearHosts("labels"),
    createInventoryGroupDraft: (name = "") => createDraft("groups", name),
    createInventoryLabelDraft: (name = "") => createDraft("labels", name),
    currentInventorySectionState,
    deleteInventoryGroupSelection: () => deleteSelection("groups"),
    deleteInventoryLabelSelection: () => deleteSelection("labels"),
    destroy,
    inventoryStateStore,
    openInventorySection(section = "") {
      updateState((state) => {
        state.currentSection = normalizeInventorySection(section);
      });
    },
    pageDisplayStateStore,
    saveInventoryGroupSelection: () => saveSelection("groups"),
    saveInventoryLabelSelection: () => saveSelection("labels"),
    selectAllGroupHosts: () => selectAllHosts("groups"),
    selectAllLabelHosts: () => selectAllHosts("labels"),
    selectInventoryGroupName: (name = "") => selectCollection("groups", name),
    selectInventoryLabelName: (name = "") => selectCollection("labels", name),
    setPageContext,
    updateGroupHostFilter: (value = "") =>
      updateCollection("groups", (collection) => {
        collection.hostFilter = value;
      }),
    updateGroupHostSelection: (name = "", checked = false) =>
      updateHostSelection("groups", name, checked),
    updateInventoryGroupDescription: (value = "") =>
      updateCollection("groups", (collection) => {
        collection.description = value;
      }),
    updateLabelHostFilter: (value = "") =>
      updateCollection("labels", (collection) => {
        collection.hostFilter = value;
      }),
    updateLabelHostSelection: (name = "", checked = false) =>
      updateHostSelection("labels", name, checked),
  };
}
