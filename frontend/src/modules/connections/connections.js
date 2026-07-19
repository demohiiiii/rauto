import {
  callIfFunction,
  callbackHandler,
  eventIsSelfTarget,
  eventKeyIs,
} from "../../lib/events.js";
import { derived, get, writable } from "svelte/store";
import {
  CONNECTION_MODAL_FOCUS_TARGET,
  batchShowTargetPickerFields,
  connectionModalDisplay,
  savedConnectionEditModalDisplay,
  savedConnectionLibraryPresentation,
  sidebarConnectionPresentation,
  temporaryConnectionFocusDisplay,
  temporaryConnectionPanelPresentation,
} from "./connectionTargetDisplayState.js";
import {
  activeConnectionTarget,
  closeConnectionModal,
  connectionModalFocusRequest,
  connectionOverlayState,
  connectionTargetState,
  openConnectionModal,
  savedConnectionSelectState,
  savedConnectionStatusState,
  savedConnectionsRefreshState,
  setConnectionModalMode,
  setSavedConnectionStatus,
  sidebarConnectionState,
  visibleSavedConnectionNames,
} from "./connectionTargetStoreState.js";
import {
  applyTemporaryConnection,
  connectionPayload,
  createConnectionTestState,
  createSavedConnectionDraft,
  currentExecutionConnectionProfile,
  currentTemporaryConnectionDetails,
  deleteConnectionByName,
  downloadConnectionImportTemplate,
  ensureConnectionTargetSelected,
  importConnectionsFromFile,
  loadSavedConnectionByName,
  loadSavedConnections,
  refreshActiveTemporaryConnectionTarget,
  refreshConnectionProfileOptions,
  refreshSavedConnectionOptions,
  refreshSidebarConnectionSelector,
  runConnectionTest,
  setConnectionDeviceProfiles,
  setConnectionTestLoadingKeys,
  temporaryConnectionFormStateStore,
  temporaryConnectionBasicFieldWiring,
  updateTemporaryConnectionDraftEnabled,
} from "./connectionTargetRuntimeState.js";
import {
  detectSavedConnectionProfile,
  hideSavedConnectionEditorModal,
  openSavedConnectionEditor,
  replaceSavedConnectionProfileWithDetected,
  savedConnectionAutodetectState,
  savedConnectionEditorBasicFieldWiring,
  savedConnectionEditorFormStateStore,
  savedConnectionEditorStatusState,
  saveSavedConnectionEditor,
  updateSavedConnectionEditorDraftEnabled,
} from "./connectionsEditor.js";
import {
  CONNECTION_PROFILE_SELECT,
  applySavedConnectionEditorDraftFromFormState,
  applyTemporaryConnectionDraftFromFormState,
  connectionBasicFieldsPresentation,
  connectionProfileSelectState,
  savedConnectionEditorDraftDefaults,
  temporaryConnectionDraftDefaults,
  visibleConnectionProfileOptions,
} from "./connectionFields.js";
import {
  clearHistoryFilters,
  deleteConnectionHistoryItem,
  formatHistoryTime,
  historyDrawerState,
  historyFilterStateStore,
  loadConnectionHistory,
  loadConnectionHistoryDetail,
  openConnectionHistoryDrawer,
  refreshConnectionHistory,
  setHistoryFilterLimit,
  setHistoryFilterOperation,
  setHistoryFilterQuery,
} from "./connectionsHistory.js";
import {
  createConnectionModalWorkspace as createConnectionModalBaseWorkspace,
  createHistoryDrawerWorkspace as createHistoryDrawerBaseWorkspace,
  createSavedConnectionEditModalWorkspace as createSavedConnectionEditModalBaseWorkspace,
  createSavedConnectionLibraryWorkspace as createSavedConnectionLibraryBaseWorkspace,
} from "./connectionPanelState.js";
import {
  createSavedConnectionEditorWorkspace as createSavedConnectionEditorBaseWorkspace,
  createTemporaryConnectionPanelWorkspace as createTemporaryConnectionPanelBaseWorkspace,
} from "./connectionPanelFormState.js";

export {
  CONNECTION_PROFILE_SELECT,
  batchShowTargetPickerFields,
  CONNECTION_MODAL_FOCUS_TARGET,
  connectionModalDisplay,
  savedConnectionEditModalDisplay,
  savedConnectionLibraryPresentation,
  temporaryConnectionPanelPresentation,
  temporaryConnectionFocusDisplay,
  sidebarConnectionPresentation,
  connectionBasicFieldsPresentation,
  createConnectionTestState,
  connectionTargetState,
  temporaryConnectionFormStateStore,
  savedConnectionEditorFormStateStore,
  savedConnectionEditorStatusState,
  connectionOverlayState,
  connectionModalFocusRequest,
  savedConnectionStatusState,
  savedConnectionAutodetectState,
  savedConnectionSelectState,
  historyFilterStateStore,
  historyDrawerState,
  sidebarConnectionState,
  savedConnectionsRefreshState,
  savedConnectionEditorDraftDefaults,
  temporaryConnectionDraftDefaults,
  applySavedConnectionEditorDraftFromFormState,
  applyTemporaryConnectionDraftFromFormState,
  visibleConnectionProfileOptions,
  visibleSavedConnectionNames,
  setSavedConnectionStatus,
  openConnectionModal,
  closeConnectionModal,
  setConnectionModalMode,
  setConnectionTestLoadingKeys,
  runConnectionTest,
  refreshSavedConnectionOptions,
  createSavedConnectionDraft,
  updateSavedConnectionEditorDraftEnabled,
  updateTemporaryConnectionDraftEnabled,
  detectSavedConnectionProfile,
  saveSavedConnectionEditor,
  replaceSavedConnectionProfileWithDetected,
  savedConnectionEditorBasicFieldWiring,
  temporaryConnectionBasicFieldWiring,
  currentExecutionConnectionProfile,
  connectionProfileSelectState,
  ensureConnectionTargetSelected,
  currentTemporaryConnectionDetails,
  activeConnectionTarget,
  loadConnectionHistory,
  refreshConnectionHistory,
  openConnectionHistoryDrawer,
  loadConnectionHistoryDetail,
  deleteConnectionHistoryItem,
  clearHistoryFilters,
  setHistoryFilterLimit,
  setHistoryFilterOperation,
  setHistoryFilterQuery,
  formatHistoryTime,
  refreshSidebarConnectionSelector,
  refreshConnectionProfileOptions,
  setConnectionDeviceProfiles,
  refreshActiveTemporaryConnectionTarget,
  loadSavedConnectionByName,
  openSavedConnectionEditor,
  deleteConnectionByName,
  loadSavedConnections,
  connectionPayload,
  hideSavedConnectionEditorModal,
  applyTemporaryConnection,
  importConnectionsFromFile,
  downloadConnectionImportTemplate,
};

function normalizeOptionalHandler(handler) {
  return typeof handler === "function" ? handler : null;
}

function basicFieldsWorkspaceInputState(inputState = {}) {
  return {
    onConnectTimeoutSecsInput: normalizeOptionalHandler(
      inputState.onConnectTimeoutSecsInput,
    ),
    onDeviceProfileChange: normalizeOptionalHandler(
      inputState.onDeviceProfileChange,
    ),
    onEnablePasswordInput: normalizeOptionalHandler(
      inputState.onEnablePasswordInput,
    ),
    onHostInput: normalizeOptionalHandler(inputState.onHostInput),
    onLinuxShellFlavorChange: normalizeOptionalHandler(
      inputState.onLinuxShellFlavorChange,
    ),
    onPasswordInput: normalizeOptionalHandler(inputState.onPasswordInput),
    onPortInput: normalizeOptionalHandler(inputState.onPortInput),
    onSshSecurityChange: normalizeOptionalHandler(
      inputState.onSshSecurityChange,
    ),
    onUsernameInput: normalizeOptionalHandler(inputState.onUsernameInput),
  };
}

export function createConnectionBasicFieldsWorkspace(initialInputState = {}) {
  const actionHandlers = connectionBasicFieldActionHandlers(
    basicFieldsWorkspaceInputState(initialInputState),
  );

  return {
    connectTimeoutSecsInputHandler() {
      return actionHandlers.connectTimeoutSecsInputHandler();
    },
    deviceProfileChangeHandler() {
      return actionHandlers.deviceProfileChangeHandler();
    },
    enablePasswordInputHandler() {
      return actionHandlers.enablePasswordInputHandler();
    },
    hostInputHandler() {
      return actionHandlers.hostInputHandler();
    },
    linuxShellFlavorChangeHandler() {
      return actionHandlers.linuxShellFlavorChangeHandler();
    },
    passwordInputHandler() {
      return actionHandlers.passwordInputHandler();
    },
    portInputHandler() {
      return actionHandlers.portInputHandler();
    },
    sshSecurityChangeHandler() {
      return actionHandlers.sshSecurityChangeHandler();
    },
    usernameInputHandler() {
      return actionHandlers.usernameInputHandler();
    },
  };
}

export function createHistoryDrawerWorkspace() {
  return createHistoryDrawerBaseWorkspace();
}

export function createConnectionModalWorkspace(initialInputState = {}) {
  const workspace = createConnectionModalBaseWorkspace();
  const onClose =
    normalizeOptionalHandler(initialInputState.onClose) || closeConnectionModal;

  function closeConnectionModalFromWorkspace() {
    return callIfFunction(onClose);
  }

  function closeOnBackdropHandler(event) {
    if (eventIsSelfTarget(event)) {
      return closeConnectionModalFromWorkspace();
    }
    return undefined;
  }

  function closeOnEscapeHandler(event) {
    if (eventKeyIs(event, "Escape")) {
      return closeConnectionModalFromWorkspace();
    }
    return undefined;
  }

  return {
    ...workspace,
    closeOnBackdropHandler,
    closeOnEscapeHandler,
  };
}

export function createSavedConnectionEditModalWorkspace(
  initialInputState = {},
) {
  const workspace = createSavedConnectionEditModalBaseWorkspace();
  const onClose =
    normalizeOptionalHandler(initialInputState.onClose) ||
    hideSavedConnectionEditorModal;

  function currentActionHandlers() {
    return savedConnectionEditModalActionHandlers({
      onClose,
    });
  }

  return {
    ...workspace,
    closeOnBackdropHandler() {
      return currentActionHandlers().closeOnBackdropHandler();
    },
    closeOnEscapeHandler() {
      return currentActionHandlers().closeOnEscapeHandler();
    },
  };
}

export function createSavedConnectionLibraryWorkspace(initialInputState = {}) {
  const workspace = createSavedConnectionLibraryBaseWorkspace();
  let onUse = normalizeOptionalHandler(initialInputState.onUse);
  workspace.setPanelContext({ active: !!initialInputState.active });

  const selectedSavedConnectionHandler = callbackHandler(
    workspace.selectSavedConnection,
  );

  function useSavedConnectionAction() {
    return workspace.useSavedConnection(onUse);
  }

  return {
    ...workspace,
    selectedSavedConnectionHandler,
    setPanelContext({ active = false, onUse: nextOnUse = null } = {}) {
      onUse = normalizeOptionalHandler(nextOnUse);
      workspace.setPanelContext({ active });
    },
    useSavedConnectionAction,
  };
}

export function createSavedConnectionEditorWorkspace() {
  return createSavedConnectionEditorBaseWorkspace();
}

export function createTemporaryConnectionPanelWorkspace() {
  return createTemporaryConnectionPanelBaseWorkspace();
}

function historyDrawerContentWorkspaceInputState(inputState = {}) {
  return {
    onDeleteItem: normalizeOptionalHandler(inputState.onDeleteItem),
    onLimitChange: normalizeOptionalHandler(inputState.onLimitChange),
    onOpenItem: normalizeOptionalHandler(inputState.onOpenItem),
    onOperationChange: normalizeOptionalHandler(inputState.onOperationChange),
    onQueryInput: normalizeOptionalHandler(inputState.onQueryInput),
  };
}

export function createHistoryDrawerContentWorkspace(initialInputState = {}) {
  const actionHandlers = historyDrawerContentActionHandlers(
    historyDrawerContentWorkspaceInputState(initialInputState),
  );

  return {
    deleteHistoryItemAction(historyId = "") {
      return actionHandlers.deleteHistoryItemAction(historyId);
    },
    historyLimitChangeHandler() {
      return actionHandlers.historyLimitChangeHandler();
    },
    historyOperationChangeHandler() {
      return actionHandlers.historyOperationChangeHandler();
    },
    historyQueryInputHandler() {
      return actionHandlers.historyQueryInputHandler();
    },
    openHistoryItemAction(historyId = "") {
      return actionHandlers.openHistoryItemAction(historyId);
    },
  };
}

function connectionBasicFieldInputHandlers({
  onConnectTimeoutSecsInput = null,
  onDeviceProfileChange = null,
  onEnablePasswordInput = null,
  onHostInput = null,
  onLinuxShellFlavorChange = null,
  onPasswordInput = null,
  onPortInput = null,
  onSshSecurityChange = null,
  onUsernameInput = null,
} = {}) {
  return {
    connectTimeoutSecsInputHandler() {
      return callbackHandler(onConnectTimeoutSecsInput);
    },
    deviceProfileChangeHandler() {
      return callbackHandler(onDeviceProfileChange);
    },
    enablePasswordInputHandler() {
      return callbackHandler(onEnablePasswordInput);
    },
    hostInputHandler() {
      return callbackHandler(onHostInput);
    },
    linuxShellFlavorChangeHandler() {
      return callbackHandler(onLinuxShellFlavorChange);
    },
    passwordInputHandler() {
      return callbackHandler(onPasswordInput);
    },
    portInputHandler() {
      return callbackHandler(onPortInput);
    },
    sshSecurityChangeHandler() {
      return callbackHandler(onSshSecurityChange);
    },
    usernameInputHandler() {
      return callbackHandler(onUsernameInput);
    },
  };
}

function connectionBasicFieldActionHandlers(options = {}) {
  const inputHandlers = connectionBasicFieldInputHandlers(options);
  return {
    connectTimeoutSecsInputHandler:
      inputHandlers.connectTimeoutSecsInputHandler,
    deviceProfileChangeHandler: inputHandlers.deviceProfileChangeHandler,
    enablePasswordInputHandler: inputHandlers.enablePasswordInputHandler,
    hostInputHandler: inputHandlers.hostInputHandler,
    linuxShellFlavorChangeHandler: inputHandlers.linuxShellFlavorChangeHandler,
    passwordInputHandler: inputHandlers.passwordInputHandler,
    portInputHandler: inputHandlers.portInputHandler,
    sshSecurityChangeHandler: inputHandlers.sshSecurityChangeHandler,
    usernameInputHandler: inputHandlers.usernameInputHandler,
  };
}

function savedConnectionEditModalActionHandlers({ onClose = null } = {}) {
  return {
    closeOnBackdropHandler() {
      return (event) => {
        if (eventIsSelfTarget(event)) {
          return callIfFunction(onClose);
        }
        return undefined;
      };
    },
    closeOnEscapeHandler() {
      return (event) => {
        if (eventKeyIs(event, "Escape")) {
          return callIfFunction(onClose);
        }
        return undefined;
      };
    },
  };
}

function historyDrawerContentInputHandlers({
  onDeleteItem = null,
  onLimitChange = null,
  onOpenItem = null,
  onOperationChange = null,
  onQueryInput = null,
} = {}) {
  return {
    deleteItemHandler(historyId = "") {
      return callbackHandler(onDeleteItem, historyId);
    },
    limitChangeHandler() {
      return callbackHandler(onLimitChange);
    },
    openItemHandler(historyId = "") {
      return callbackHandler(onOpenItem, historyId);
    },
    operationChangeHandler() {
      return callbackHandler(onOperationChange);
    },
    queryInputHandler() {
      return callbackHandler(onQueryInput);
    },
  };
}

function historyDrawerContentActionHandlers({
  onDeleteItem = null,
  onLimitChange = null,
  onOpenItem = null,
  onOperationChange = null,
  onQueryInput = null,
} = {}) {
  const inputHandlers = historyDrawerContentInputHandlers({
    onDeleteItem,
    onLimitChange,
    onOpenItem,
    onOperationChange,
    onQueryInput,
  });
  return {
    deleteHistoryItemAction(historyId = "") {
      return inputHandlers.deleteItemHandler(historyId);
    },
    historyLimitChangeHandler() {
      return inputHandlers.limitChangeHandler();
    },
    openHistoryItemAction(historyId = "") {
      return inputHandlers.openItemHandler(historyId);
    },
    historyOperationChangeHandler() {
      return inputHandlers.operationChangeHandler();
    },
    historyQueryInputHandler() {
      return inputHandlers.queryInputHandler();
    },
  };
}
