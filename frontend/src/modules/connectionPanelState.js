import { derived, writable } from "svelte/store";
import { currentLanguageState } from "../lib/i18n.js";
import { createLoadingStateRunner } from "../lib/svelte.js";
import {
  clearHistoryFilters,
  deleteConnectionHistoryItem,
  historyDrawerState,
  historyFilterStateStore,
  loadConnectionHistory,
  loadConnectionHistoryDetail,
  refreshConnectionHistory,
  setHistoryFilterLimit,
  setHistoryFilterOperation,
  setHistoryFilterQuery,
} from "./connectionsHistory.js";
import { historyDrawerPresentation, overlayDrawerState } from "./overlays.js";
import {
  CONNECTION_MODAL_FOCUS_TARGET,
  connectionModalDisplay,
  savedConnectionEditModalDisplay,
  savedConnectionLibraryPresentation,
} from "./connectionTargetDisplayState.js";
import {
  connectionModalFocusRequest,
  connectionOverlayState,
  savedConnectionSelectState,
  savedConnectionStatusState,
} from "./connectionTargetStoreState.js";
import {
  createConnectionTestState,
  deleteConnectionByName,
  downloadConnectionImportTemplate,
  importConnectionsFromFile,
  loadSavedConnectionByName,
  refreshSavedConnectionOptions,
  runConnectionTest,
  setConnectionTestLoadingKeys,
} from "./connectionTargetRuntimeState.js";
import { openSavedConnectionEditor } from "./connectionsEditor.js";

export function createHistoryDrawerWorkspace() {
  const historyDisplayStateStore = derived(
    [
      historyDrawerState,
      historyFilterStateStore,
      overlayDrawerState,
      currentLanguageState,
    ],
    ([
      $historyDrawerState,
      $historyFilterStateStore,
      $overlayDrawerState,
      _currentLanguageState,
    ]) =>
      historyDrawerPresentation({
        drawerState: $historyDrawerState,
        filterState: $historyFilterStateStore,
        overlayState: $overlayDrawerState,
      }),
  );

  function changeLimit(limitValue = "") {
    setHistoryFilterLimit(limitValue);
    return loadConnectionHistory();
  }

  function changeOperation(historyOperation = "") {
    return setHistoryFilterOperation(historyOperation);
  }

  function changeQuery(queryText = "") {
    return setHistoryFilterQuery(queryText);
  }

  return {
    changeLimit,
    changeOperation,
    changeQuery,
    clearFilters: clearHistoryFilters,
    deleteHistoryItem: deleteConnectionHistoryItem,
    historyDisplayStateStore,
    openHistoryItem: loadConnectionHistoryDetail,
    refreshHistory: refreshConnectionHistory,
  };
}

export function createConnectionModalWorkspace() {
  const connectionTestState = createConnectionTestState();
  const connectionTestLoadingState = { keys: [] };
  const connectionTestStateStore = writable({ ...connectionTestState });
  const modalDisplayStateStore = derived(
    [connectionOverlayState, currentLanguageState],
    ([$connectionOverlayState, _currentLanguageState]) =>
      connectionModalDisplay($connectionOverlayState),
  );
  const connectionTestLoadingRunner = createLoadingStateRunner(
    connectionTestLoadingState,
    {
      setKeys(keys) {
        setConnectionTestLoadingKeys(connectionTestState, keys);
        connectionTestStateStore.set({ ...connectionTestState });
      },
    },
  );

  async function testConnection(mode = "temporary") {
    return connectionTestLoadingRunner.run("test", async () => {
      const connectionTestRun = runConnectionTest(connectionTestState, mode);
      connectionTestStateStore.set({ ...connectionTestState });
      await connectionTestRun;
      connectionTestStateStore.set({ ...connectionTestState });
    });
  }

  return {
    connectionTestStateStore,
    modalDisplayStateStore,
    testConnection,
  };
}

export function createSavedConnectionEditModalWorkspace() {
  const modalDisplayStateStore = derived(
    [connectionOverlayState, currentLanguageState],
    ([$connectionOverlayState, _currentLanguageState]) =>
      savedConnectionEditModalDisplay($connectionOverlayState),
  );

  return {
    modalDisplayStateStore,
  };
}

export function createSavedConnectionLibraryWorkspace() {
  const activeStateStore = writable(false);
  const savedConnectionLoadingState = { keys: [] };
  const loadingStateStore = writable({
    deleteLoading: false,
    editLoading: false,
    templateLoading: false,
    useLoading: false,
  });
  const savedConnectionLoadingRunner = createLoadingStateRunner(
    savedConnectionLoadingState,
    {
      setKeys(keys) {
        loadingStateStore.set({
          deleteLoading: keys.includes("delete"),
          editLoading: keys.includes("edit"),
          templateLoading: keys.includes("template"),
          useLoading: keys.includes("use"),
        });
      },
    },
  );
  const libraryDisplayStateStore = derived(
    [
      savedConnectionSelectState,
      savedConnectionStatusState,
      currentLanguageState,
    ],
    ([
      $savedConnectionSelectState,
      $savedConnectionStatusState,
      _currentLanguageState,
    ]) =>
      savedConnectionLibraryPresentation(
        $savedConnectionSelectState,
        $savedConnectionStatusState,
      ),
  );
  const savedConnectionSelectFocusRequestVersionStateStore = derived(
    [activeStateStore, connectionModalFocusRequest],
    ([$activeStateStore, $connectionModalFocusRequest]) => {
      if (
        !$activeStateStore ||
        $connectionModalFocusRequest.target !==
          CONNECTION_MODAL_FOCUS_TARGET.savedConnectionSelect
      ) {
        return 0;
      }
      return $connectionModalFocusRequest.version || 0;
    },
  );

  function setPanelContext({ active = false } = {}) {
    activeStateStore.set(!!active);
  }

  function selectSavedConnection(selectedName) {
    return refreshSavedConnectionOptions(selectedName);
  }

  async function downloadTemplate() {
    return savedConnectionLoadingRunner.run(
      "template",
      downloadConnectionImportTemplate,
    );
  }

  async function importConnections(file) {
    return importConnectionsFromFile(file);
  }

  async function useSavedConnection(onUse) {
    return savedConnectionLoadingRunner.run("use", async () => {
      const ok = await loadSavedConnectionByName();
      if (ok && typeof onUse === "function") {
        onUse();
      }
    });
  }

  async function editSavedConnection() {
    return savedConnectionLoadingRunner.run("edit", openSavedConnectionEditor);
  }

  async function deleteSavedConnection() {
    return savedConnectionLoadingRunner.run("delete", deleteConnectionByName);
  }

  return {
    deleteSavedConnection,
    downloadTemplate,
    editSavedConnection,
    importConnections,
    libraryDisplayStateStore,
    loadingStateStore,
    savedConnectionSelectFocusRequestVersionStateStore,
    selectSavedConnection,
    setPanelContext,
    useSavedConnection,
  };
}
