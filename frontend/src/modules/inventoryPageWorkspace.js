import {
  defaultInventorySection,
  normalizeInventorySection,
} from "../config/dashboardModes.js";
import { derived, get as getStore, writable } from "svelte/store";
import { callbackHandler } from "../lib/events.js";
import { currentLanguageState } from "../lib/i18n.js";
import { savedConnectionsRefreshState } from "./connections.js";
import { protectedDashboardResourcesRefreshState } from "./dashboardApp.js";
import {
  createInventoryDependencies,
  createInventoryWorkspace,
  inventoryPageDisplay,
} from "./inventoryCollectionWorkspaces.js";

function normalizeOptionalHandler(handler) {
  return typeof handler === "function" ? handler : null;
}

export function inventoryCollectionActionHandlers({
  onDescriptionInput = null,
  onHostFilter = null,
  onHostSelection = null,
  onSelectCollection = null,
  onVarsInput = null,
} = {}) {
  const selectCollectionHandler = normalizeOptionalHandler(onSelectCollection);
  const descriptionInputHandler = normalizeOptionalHandler(onDescriptionInput);
  const hostFilterHandler = normalizeOptionalHandler(onHostFilter);
  const hostSelectionHandler = normalizeOptionalHandler(onHostSelection);
  const varsInputHandler = normalizeOptionalHandler(onVarsInput);

  return {
    collectionChangeHandler: selectCollectionHandler,
    collectionSelectAction(collectionName) {
      return () =>
        typeof selectCollectionHandler === "function"
          ? selectCollectionHandler(collectionName)
          : undefined;
    },
    descriptionChangeHandler: descriptionInputHandler,
    hostFilterChangeHandler: hostFilterHandler,
    hostSelectionToggleHandler(hostName) {
      return hostSelectionHandler
        ? callbackHandler(hostSelectionHandler, hostName)
        : null;
    },
    varsInputChangeHandler: varsInputHandler,
  };
}

const inventorySavedConnectionsRefreshState = savedConnectionsRefreshState;
const inventoryProtectedResourcesRefreshState =
  protectedDashboardResourcesRefreshState;

export function createInventoryPageWorkspace() {
  const inventoryWorkspace = createInventoryWorkspace(
    createInventoryDependencies(),
  );
  const currentInventorySectionState = writable(
    normalizeInventorySection(defaultInventorySection),
  );
  const pageDisplayStateStore = derived(
    [
      inventoryWorkspace.inventoryGroupsState,
      inventoryWorkspace.inventoryLabelsState,
      currentInventorySectionState,
      currentLanguageState,
    ],
    ([
      $inventoryGroupsState,
      $inventoryLabelsState,
      $currentInventorySectionState,
      _currentLanguageState,
    ]) =>
      inventoryPageDisplay(
        $inventoryGroupsState,
        $inventoryLabelsState,
        $currentInventorySectionState,
      ),
  );
  const pageSyncStateStore = derived(
    [
      currentLanguageState,
      inventoryProtectedResourcesRefreshState,
      inventorySavedConnectionsRefreshState,
    ],
    ([
      $currentLanguageState,
      $inventoryProtectedResourcesRefreshState,
      $inventorySavedConnectionsRefreshState,
    ]) => ({
      language: $currentLanguageState,
      protectedResourcesRefreshVersion:
        $inventoryProtectedResourcesRefreshState,
      savedConnectionsRefreshVersion: $inventorySavedConnectionsRefreshState,
    }),
  );
  let didLoadInventoryCollections = false;
  let lastInventoryLanguage = "";
  let lastProtectedResourcesRefreshVersion = 0;
  let lastSavedConnectionsRefreshVersion = 0;

  function openInventorySection(nextInventorySection = "") {
    currentInventorySectionState.set(
      normalizeInventorySection(nextInventorySection),
    );
  }

  function setPageContext({ active = false } = {}) {
    if (!active) {
      didLoadInventoryCollections = false;
      lastInventoryLanguage = "";
      lastProtectedResourcesRefreshVersion = 0;
      lastSavedConnectionsRefreshVersion = 0;
      return;
    }
    const {
      language,
      protectedResourcesRefreshVersion,
      savedConnectionsRefreshVersion,
    } = getStore(pageSyncStateStore);
    inventoryWorkspace.init();
    if (!didLoadInventoryCollections) {
      didLoadInventoryCollections = true;
      void inventoryWorkspace.loadInventoryCollections();
    }
    if (lastInventoryLanguage !== language) {
      lastInventoryLanguage = language;
      inventoryWorkspace.refreshInventoryLanguageFields();
    }
    if (lastSavedConnectionsRefreshVersion !== savedConnectionsRefreshVersion) {
      lastSavedConnectionsRefreshVersion = savedConnectionsRefreshVersion;
      void inventoryWorkspace.refreshInventoryConnections();
    }
    if (
      lastProtectedResourcesRefreshVersion !== protectedResourcesRefreshVersion
    ) {
      lastProtectedResourcesRefreshVersion = protectedResourcesRefreshVersion;
      void inventoryWorkspace.loadInventoryCollections();
    }
  }

  function destroy() {
    didLoadInventoryCollections = false;
    lastInventoryLanguage = "";
    lastProtectedResourcesRefreshVersion = 0;
    lastSavedConnectionsRefreshVersion = 0;
  }

  return {
    clearGroupHosts: inventoryWorkspace.clearGroupHosts,
    clearLabelHosts: inventoryWorkspace.clearLabelHosts,
    createInventoryGroupDraft: inventoryWorkspace.createInventoryGroupDraft,
    createInventoryLabelDraft: inventoryWorkspace.createInventoryLabelDraft,
    currentInventorySectionState,
    deleteInventoryGroupSelection:
      inventoryWorkspace.deleteInventoryGroupSelection,
    deleteInventoryLabelSelection:
      inventoryWorkspace.deleteInventoryLabelSelection,
    destroy,
    openInventorySection,
    pageDisplayStateStore,
    saveInventoryGroupSelection: inventoryWorkspace.saveInventoryGroupSelection,
    saveInventoryLabelSelection: inventoryWorkspace.saveInventoryLabelSelection,
    selectAllGroupHosts: inventoryWorkspace.selectAllGroupHosts,
    selectAllLabelHosts: inventoryWorkspace.selectAllLabelHosts,
    selectInventoryGroupName: inventoryWorkspace.selectInventoryGroupName,
    selectInventoryLabelName: inventoryWorkspace.selectInventoryLabelName,
    setPageContext,
    updateGroupHostFilter: inventoryWorkspace.updateGroupHostFilter,
    updateGroupHostSelection: inventoryWorkspace.updateGroupHostSelection,
    updateInventoryGroupDescription:
      inventoryWorkspace.updateInventoryGroupDescription,
    updateInventoryGroupVars: inventoryWorkspace.updateInventoryGroupVars,
    updateLabelHostFilter: inventoryWorkspace.updateLabelHostFilter,
    updateLabelHostSelection: inventoryWorkspace.updateLabelHostSelection,
  };
}
