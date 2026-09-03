import {
  callIfFunction,
  callbackHandler,
  eventIsSelfTarget,
  eventKeyIs,
} from "../../../lib/events.js";
import { derived, get, writable } from "svelte/store";
import {
  CONNECTION_MODAL_FOCUS_TARGET,
  batchExecTargetPickerFields,
  batchFlowTargetPickerFields,
  batchShowTargetPickerFields,
  configFetchTargetPickerFields,
  connectionModalDisplay,
  savedConnectionEditModalDisplay,
  savedConnectionLibraryPresentation,
  sidebarConnectionPresentation,
  temporaryConnectionFocusDisplay,
  temporaryConnectionPanelPresentation,
} from "$domains/connections/presentation/connectionTargetDisplayState.js";
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
} from "$domains/connections/application/connectionTargetStoreState.js";
import {
  applyTemporaryConnection,
  connectionPayload,
  createConnectionTestState,
  createSavedConnectionDraft,
  currentExecutionConnectionProfile,
  currentTemporaryConnectionDetails,
  deleteConnectionByName,
  detectTemporaryConnectionFacts,
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
} from "$domains/connections/application/connectionTargetRuntimeState.js";
import {
  detectSavedConnectionProfile,
  hideSavedConnectionEditorModal,
  openSavedConnectionEditor,
  savedConnectionAutodetectState,
  savedConnectionEditorBasicFieldWiring,
  savedConnectionEditorFormStateStore,
  savedConnectionEditorStatusState,
  saveSavedConnectionEditor,
  updateSavedConnectionEditorDraftEnabled,
} from "$domains/connections/application/connectionEditorState.js";
import {
  applySavedConnectionEditorDraftFromFormState,
  applyTemporaryConnectionDraftFromFormState,
  connectionBasicFieldsPresentation,
  savedConnectionEditorDraftDefaults,
  temporaryConnectionDraftDefaults,
  visibleConnectionProfileOptions,
} from "$domains/connections/application/connectionFieldState.js";
import {
  CONNECTION_PROFILE_SELECT,
  connectionProfileSelectState,
} from "$domains/connections/application/connectionFieldStoreState.js";
import {
  clearHistoryFilters,
  deleteConnectionHistoryItem,
  formatHistoryTime,
  historyDrawerState,
  historyFilterStateStore,
  loadConnectionHistory,
  loadConnectionHistoryDetail,
  refreshConnectionHistory,
  setHistoryFilterLimit,
  setHistoryFilterOperation,
  setHistoryFilterQuery,
} from "$domains/connections/application/connectionsHistory.js";
import {
  createConnectionModalWorkspace as createConnectionModalBaseWorkspace,
  createHistoryDrawerWorkspace as createHistoryDrawerBaseWorkspace,
  createSavedConnectionEditModalWorkspace as createSavedConnectionEditModalBaseWorkspace,
  createSavedConnectionLibraryWorkspace as createSavedConnectionLibraryBaseWorkspace,
} from "$domains/connections/application/connectionPanelState.js";
import {
  createSavedConnectionEditorWorkspace as createSavedConnectionEditorBaseWorkspace,
  createTemporaryConnectionPanelWorkspace as createTemporaryConnectionPanelBaseWorkspace,
} from "$domains/connections/application/connectionPanelFormState.js";

type WorkspaceHandler = (...args: unknown[]) => unknown;
type ConnectionFieldValueHandler = (value: string) => void;

interface BasicFieldsWorkspaceInput {
  onConnectTimeoutSecsInput?: ConnectionFieldValueHandler | null;
  onCredentialChange?: ConnectionFieldValueHandler | null;
  onDeviceProfileChange?: ConnectionFieldValueHandler | null;
  onHostInput?: ConnectionFieldValueHandler | null;
  onLinuxShellFlavorChange?: ConnectionFieldValueHandler | null;
  onOutputEncodingChange?: ConnectionFieldValueHandler | null;
  onPortInput?: ConnectionFieldValueHandler | null;
  onSshSecurityChange?: ConnectionFieldValueHandler | null;
}

interface CloseWorkspaceInput {
  onClose?: WorkspaceHandler | null;
}

interface SavedConnectionLibraryWorkspaceInput {
  active?: boolean;
  onUse?: WorkspaceHandler | null;
}

interface SavedConnectionLibraryContext {
  active?: boolean;
  onUse?: WorkspaceHandler | null;
}

interface HistoryDrawerContentWorkspaceInput {
  onDeleteItem?: ((historyId: string | number) => unknown) | null;
  onLimitChange?: ((limit: string) => unknown) | null;
  onOpenItem?: ((historyId: string | number) => unknown) | null;
  onOperationChange?: ((operation: string) => unknown) | null;
  onQueryInput?: ((query: string) => unknown) | null;
}

export {
  CONNECTION_PROFILE_SELECT,
  batchExecTargetPickerFields,
  batchFlowTargetPickerFields,
  batchShowTargetPickerFields,
  configFetchTargetPickerFields,
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
  detectTemporaryConnectionFacts,
  saveSavedConnectionEditor,
  savedConnectionEditorBasicFieldWiring,
  temporaryConnectionBasicFieldWiring,
  currentExecutionConnectionProfile,
  connectionProfileSelectState,
  ensureConnectionTargetSelected,
  currentTemporaryConnectionDetails,
  activeConnectionTarget,
  loadConnectionHistory,
  refreshConnectionHistory,
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

function normalizeOptionalHandler(handler: unknown): WorkspaceHandler | null {
  return typeof handler === "function" ? (handler as WorkspaceHandler) : null;
}

function basicFieldsWorkspaceInputState(
  inputState: BasicFieldsWorkspaceInput = {},
): BasicFieldsWorkspaceInput {
  return {
    onCredentialChange: inputState.onCredentialChange ?? null,
    onConnectTimeoutSecsInput: inputState.onConnectTimeoutSecsInput ?? null,
    onDeviceProfileChange: inputState.onDeviceProfileChange ?? null,
    onHostInput: inputState.onHostInput ?? null,
    onLinuxShellFlavorChange: inputState.onLinuxShellFlavorChange ?? null,
    onOutputEncodingChange: inputState.onOutputEncodingChange ?? null,
    onPortInput: inputState.onPortInput ?? null,
    onSshSecurityChange: inputState.onSshSecurityChange ?? null,
  };
}

export function createConnectionBasicFieldsWorkspace(
  initialInputState: BasicFieldsWorkspaceInput = {},
) {
  const actionHandlers = connectionBasicFieldActionHandlers(
    basicFieldsWorkspaceInputState(initialInputState),
  );

  return {
    credentialChangeHandler() {
      return actionHandlers.credentialChangeHandler();
    },
    connectTimeoutSecsInputHandler() {
      return actionHandlers.connectTimeoutSecsInputHandler();
    },
    deviceProfileChangeHandler() {
      return actionHandlers.deviceProfileChangeHandler();
    },
    hostInputHandler() {
      return actionHandlers.hostInputHandler();
    },
    linuxShellFlavorChangeHandler() {
      return actionHandlers.linuxShellFlavorChangeHandler();
    },
    outputEncodingChangeHandler() {
      return actionHandlers.outputEncodingChangeHandler();
    },
    portInputHandler() {
      return actionHandlers.portInputHandler();
    },
    sshSecurityChangeHandler() {
      return actionHandlers.sshSecurityChangeHandler();
    },
  };
}

export function createHistoryDrawerWorkspace() {
  return createHistoryDrawerBaseWorkspace();
}

export function createConnectionModalWorkspace(
  initialInputState: CloseWorkspaceInput = {},
) {
  const workspace = createConnectionModalBaseWorkspace();
  const onClose =
    normalizeOptionalHandler(initialInputState.onClose) || closeConnectionModal;

  function closeConnectionModalFromWorkspace() {
    return callIfFunction(onClose);
  }

  function closeOnBackdropHandler(event: unknown) {
    if (eventIsSelfTarget(event)) {
      return closeConnectionModalFromWorkspace();
    }
    return undefined;
  }

  function closeOnEscapeHandler(event: unknown) {
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
  initialInputState: CloseWorkspaceInput = {},
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

export function createSavedConnectionLibraryWorkspace(
  initialInputState: SavedConnectionLibraryWorkspaceInput = {},
) {
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
    setPanelContext({
      active = false,
      onUse: nextOnUse = null,
    }: SavedConnectionLibraryContext = {}) {
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

function historyDrawerContentWorkspaceInputState(
  inputState: HistoryDrawerContentWorkspaceInput = {},
): HistoryDrawerContentWorkspaceInput {
  return {
    onDeleteItem: inputState.onDeleteItem ?? null,
    onLimitChange: inputState.onLimitChange ?? null,
    onOpenItem: inputState.onOpenItem ?? null,
    onOperationChange: inputState.onOperationChange ?? null,
    onQueryInput: inputState.onQueryInput ?? null,
  };
}

export function createHistoryDrawerContentWorkspace(
  initialInputState: HistoryDrawerContentWorkspaceInput = {},
) {
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
  onCredentialChange = null,
  onConnectTimeoutSecsInput = null,
  onDeviceProfileChange = null,
  onHostInput = null,
  onLinuxShellFlavorChange = null,
  onOutputEncodingChange = null,
  onPortInput = null,
  onSshSecurityChange = null,
}: BasicFieldsWorkspaceInput = {}) {
  return {
    credentialChangeHandler() {
      return callbackHandler(onCredentialChange);
    },
    connectTimeoutSecsInputHandler() {
      return callbackHandler(onConnectTimeoutSecsInput);
    },
    deviceProfileChangeHandler() {
      return callbackHandler(onDeviceProfileChange);
    },
    hostInputHandler() {
      return callbackHandler(onHostInput);
    },
    linuxShellFlavorChangeHandler() {
      return callbackHandler(onLinuxShellFlavorChange);
    },
    outputEncodingChangeHandler() {
      return callbackHandler(onOutputEncodingChange);
    },
    portInputHandler() {
      return callbackHandler(onPortInput);
    },
    sshSecurityChangeHandler() {
      return callbackHandler(onSshSecurityChange);
    },
  };
}

function connectionBasicFieldActionHandlers(
  options: BasicFieldsWorkspaceInput = {},
) {
  const inputHandlers = connectionBasicFieldInputHandlers(options);
  return {
    credentialChangeHandler: inputHandlers.credentialChangeHandler,
    connectTimeoutSecsInputHandler:
      inputHandlers.connectTimeoutSecsInputHandler,
    deviceProfileChangeHandler: inputHandlers.deviceProfileChangeHandler,
    hostInputHandler: inputHandlers.hostInputHandler,
    linuxShellFlavorChangeHandler: inputHandlers.linuxShellFlavorChangeHandler,
    outputEncodingChangeHandler: inputHandlers.outputEncodingChangeHandler,
    portInputHandler: inputHandlers.portInputHandler,
    sshSecurityChangeHandler: inputHandlers.sshSecurityChangeHandler,
  };
}

function savedConnectionEditModalActionHandlers({
  onClose = null,
}: CloseWorkspaceInput = {}) {
  return {
    closeOnBackdropHandler() {
      return (event: unknown) => {
        if (eventIsSelfTarget(event)) {
          return callIfFunction(onClose);
        }
        return undefined;
      };
    },
    closeOnEscapeHandler() {
      return (event: unknown) => {
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
}: HistoryDrawerContentWorkspaceInput = {}) {
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
}: HistoryDrawerContentWorkspaceInput = {}) {
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
