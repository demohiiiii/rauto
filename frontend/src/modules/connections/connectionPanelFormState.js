import { derived, get as getStore, writable } from "svelte/store";
import { currentLanguageState } from "../../lib/i18n.js";
import { createLoadingStateRunner } from "../../lib/svelte.js";
import {
  applySavedConnectionEditorDraftFromFormState,
  applyTemporaryConnectionDraftFromFormState,
  connectionBasicFieldsPresentation,
  connectionMetadataFieldsPresentation,
  savedConnectionEditorDraftDefaults,
  temporaryConnectionDraftDefaults,
  visibleConnectionProfileOptions,
} from "./connectionFieldState.js";
import {
  CONNECTION_PROFILE_SELECT,
  connectionProfileSelectState,
} from "./connectionFieldStoreState.js";
import {
  CONNECTION_MODAL_FOCUS_TARGET,
  savedConnectionEditorPresentation,
  temporaryConnectionFocusDisplay,
  temporaryConnectionPanelPresentation,
} from "./connectionTargetDisplayState.js";
import { connectionModalFocusRequest } from "./connectionTargetStoreState.js";
import {
  createSavedConnectionDraft,
  temporaryConnectionBasicFieldWiring,
  temporaryConnectionFormStateStore,
  updateTemporaryConnectionDraftEnabled,
} from "./connectionTargetRuntimeState.js";
import {
  detectSavedConnectionProfile,
  hideSavedConnectionEditorModal,
  savedConnectionAutodetectState,
  savedConnectionEditorBasicFieldWiring,
  savedConnectionEditorFormStateStore,
  savedConnectionEditorStatusState,
  saveSavedConnectionEditor,
  updateSavedConnectionEditorDraftEnabled,
} from "./connectionsEditor.js";

export function createSavedConnectionEditorWorkspace() {
  let editorDraft = savedConnectionEditorDraftDefaults();
  const editorDraftStateStore = writable({ ...editorDraft });
  const deviceProfileSelectStateStore = connectionProfileSelectState(
    CONNECTION_PROFILE_SELECT.editor,
  );
  const loadingStateStore = writable({
    detectProfileLoading: false,
    saveLoading: false,
  });
  const savedConnectionEditorLoadingState = { keys: [] };
  const savedConnectionEditorLoadingRunner = createLoadingStateRunner(
    savedConnectionEditorLoadingState,
    {
      setKeys(keys) {
        loadingStateStore.set({
          detectProfileLoading: keys.includes("detect-profile"),
          saveLoading: keys.includes("save"),
        });
      },
    },
  );

  function publishEditorDraft() {
    editorDraftStateStore.set({ ...editorDraft });
  }

  function applyEditorDraftFromFormState(formState = {}) {
    applySavedConnectionEditorDraftFromFormState(editorDraft, formState);
    publishEditorDraft();
  }

  const savedEditorFieldWiring =
    savedConnectionEditorBasicFieldWiring(editorDraft);

  function onSavedEditorConnectTimeoutSecsInput(fieldValue) {
    savedEditorFieldWiring.onConnectTimeoutSecsInput(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorDeviceProfileChange(fieldValue) {
    savedEditorFieldWiring.onDeviceProfileChange(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorDeviceModelInput(fieldValue) {
    savedEditorFieldWiring.onDeviceModelInput(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorEnablePasswordInput(fieldValue) {
    savedEditorFieldWiring.onEnablePasswordInput(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorHostInput(fieldValue) {
    savedEditorFieldWiring.onHostInput(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorLinuxShellFlavorChange(fieldValue) {
    savedEditorFieldWiring.onLinuxShellFlavorChange(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorNameInput(fieldValue) {
    savedEditorFieldWiring.onNameInput(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorPasswordInput(fieldValue) {
    savedEditorFieldWiring.onPasswordInput(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorPortInput(fieldValue) {
    savedEditorFieldWiring.onPortInput(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorSshSecurityChange(fieldValue) {
    savedEditorFieldWiring.onSshSecurityChange(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorSoftwareVersionInput(fieldValue) {
    savedEditorFieldWiring.onSoftwareVersionInput(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorUsernameInput(fieldValue) {
    savedEditorFieldWiring.onUsernameInput(fieldValue);
    publishEditorDraft();
  }

  const editorDisplayStateStore = derived(
    [
      savedConnectionEditorStatusState,
      savedConnectionAutodetectState,
      currentLanguageState,
    ],
    ([
      $savedConnectionEditorStatusState,
      $savedConnectionAutodetectState,
      _currentLanguageState,
    ]) =>
      savedConnectionEditorPresentation(
        $savedConnectionEditorStatusState,
        $savedConnectionAutodetectState,
      ),
  );
  const basicFieldsDisplayStateStore = derived(
    [
      editorDraftStateStore,
      deviceProfileSelectStateStore,
      currentLanguageState,
    ],
    ([
      $editorDraftStateStore,
      $deviceProfileSelectStateStore,
      _currentLanguageState,
    ]) =>
      connectionBasicFieldsPresentation({
        deviceProfileOptions: visibleConnectionProfileOptions(
          $deviceProfileSelectStateStore.profiles,
          $editorDraftStateStore.deviceProfile,
        ),
        fieldValues: $editorDraftStateStore,
      }),
  );
  const metadataFieldsDisplayStateStore = derived(
    currentLanguageState,
    (_currentLanguageState) => connectionMetadataFieldsPresentation(),
  );

  function setEnabled(enabled) {
    updateSavedConnectionEditorDraftEnabled(editorDraft, enabled);
    publishEditorDraft();
  }

  async function detectProfile() {
    return savedConnectionEditorLoadingRunner.run(
      "detect-profile",
      async () => {
        await detectSavedConnectionProfile();
        applyEditorDraftFromFormState(
          getStore(savedConnectionEditorFormStateStore),
        );
      },
    );
  }

  async function saveConnection() {
    return savedConnectionEditorLoadingRunner.run("save", async () => {
      await saveSavedConnectionEditor();
      applyEditorDraftFromFormState(
        getStore(savedConnectionEditorFormStateStore),
      );
    });
  }

  function setEditorContext({ active = false, formState = {} } = {}) {
    if (!active) return;
    applyEditorDraftFromFormState(formState);
  }

  return {
    basicFieldsDisplayStateStore,
    closeEditor: hideSavedConnectionEditorModal,
    detectProfile,
    editorDisplayStateStore,
    editorDraftStateStore,
    metadataFieldsDisplayStateStore,
    onSavedEditorConnectTimeoutSecsInput,
    onSavedEditorDeviceProfileChange,
    onSavedEditorDeviceModelInput,
    onSavedEditorEnablePasswordInput,
    onSavedEditorHostInput,
    onSavedEditorLinuxShellFlavorChange,
    onSavedEditorNameInput,
    onSavedEditorPasswordInput,
    onSavedEditorPortInput,
    onSavedEditorSshSecurityChange,
    onSavedEditorSoftwareVersionInput,
    onSavedEditorUsernameInput,
    savedConnectionEditorLoadingStateStore: loadingStateStore,
    saveConnection,
    setEnabled,
    setEditorContext,
  };
}

export function createTemporaryConnectionPanelWorkspace() {
  let temporaryDraft = temporaryConnectionDraftDefaults();
  const activeStateStore = writable(false);
  const connectionTestStatusStateStore = writable(null);
  const temporaryDraftStateStore = writable({ ...temporaryDraft });
  const temporaryProfileSelectStateStore = connectionProfileSelectState(
    CONNECTION_PROFILE_SELECT.temporary,
  );
  const temporaryConnectionLoadingStateStore = writable({
    createDraftLoading: false,
  });
  const temporaryConnectionLoadingState = { keys: [] };
  const temporaryConnectionLoadingRunner = createLoadingStateRunner(
    temporaryConnectionLoadingState,
    {
      setKeys(keys) {
        temporaryConnectionLoadingStateStore.set({
          createDraftLoading: keys.includes("createDraft"),
        });
      },
    },
  );

  function publishTemporaryDraft() {
    temporaryDraftStateStore.set({ ...temporaryDraft });
  }

  function applyTemporaryDraftFromFormState(formState = {}) {
    applyTemporaryConnectionDraftFromFormState(temporaryDraft, formState);
    publishTemporaryDraft();
  }

  const temporaryFieldWiring =
    temporaryConnectionBasicFieldWiring(temporaryDraft);

  function onTemporaryConnectTimeoutSecsInput(fieldValue) {
    temporaryFieldWiring.onConnectTimeoutSecsInput(fieldValue);
    publishTemporaryDraft();
  }

  function onTemporaryDeviceProfileChange(fieldValue) {
    temporaryFieldWiring.onDeviceProfileChange(fieldValue);
    publishTemporaryDraft();
  }

  function onTemporaryEnablePasswordInput(fieldValue) {
    temporaryFieldWiring.onEnablePasswordInput(fieldValue);
    publishTemporaryDraft();
  }

  function onTemporaryHostInput(fieldValue) {
    temporaryFieldWiring.onHostInput(fieldValue);
    publishTemporaryDraft();
  }

  function onTemporaryLinuxShellFlavorChange(fieldValue) {
    temporaryFieldWiring.onLinuxShellFlavorChange(fieldValue);
    publishTemporaryDraft();
  }

  function onTemporaryPasswordInput(fieldValue) {
    temporaryFieldWiring.onPasswordInput(fieldValue);
    publishTemporaryDraft();
  }

  function onTemporaryPortInput(fieldValue) {
    temporaryFieldWiring.onPortInput(fieldValue);
    publishTemporaryDraft();
  }

  function onTemporarySshSecurityChange(fieldValue) {
    temporaryFieldWiring.onSshSecurityChange(fieldValue);
    publishTemporaryDraft();
  }

  function onTemporaryUsernameInput(fieldValue) {
    temporaryFieldWiring.onUsernameInput(fieldValue);
    publishTemporaryDraft();
  }

  const temporaryDisplayStateStore = derived(
    [connectionTestStatusStateStore, currentLanguageState],
    ([$connectionTestStatusStateStore, _currentLanguageState]) =>
      temporaryConnectionPanelPresentation($connectionTestStatusStateStore),
  );
  const temporaryBasicFieldsDisplayStateStore = derived(
    [
      temporaryDraftStateStore,
      temporaryProfileSelectStateStore,
      activeStateStore,
      connectionModalFocusRequest,
      currentLanguageState,
    ],
    ([
      $temporaryDraftStateStore,
      $temporaryProfileSelectStateStore,
      $activeStateStore,
      $connectionModalFocusRequest,
      _currentLanguageState,
    ]) =>
      connectionBasicFieldsPresentation({
        deviceProfileOptions: visibleConnectionProfileOptions(
          $temporaryProfileSelectStateStore.profiles,
          $temporaryDraftStateStore.deviceProfile,
        ),
        fieldValues: $temporaryDraftStateStore,
        focusHostRequestVersion: temporaryConnectionFocusDisplay({
          active: $activeStateStore,
          focusRequest: $connectionModalFocusRequest,
          target: CONNECTION_MODAL_FOCUS_TARGET.temporaryHostInput,
        }).hostFocusRequestVersion,
      }),
  );
  const metadataFieldsDisplayStateStore = derived(
    currentLanguageState,
    (_currentLanguageState) => connectionMetadataFieldsPresentation(),
  );

  function setEnabled(enabled) {
    updateTemporaryConnectionDraftEnabled(temporaryDraft, enabled);
    publishTemporaryDraft();
  }

  function setPanelContext({
    active = false,
    connectionTestStatus = null,
    formState = {},
  } = {}) {
    activeStateStore.set(!!active);
    connectionTestStatusStateStore.set(connectionTestStatus || null);
    if (!active) return;
    applyTemporaryDraftFromFormState(formState);
  }

  async function createTemporaryDraft() {
    return temporaryConnectionLoadingRunner.run("createDraft", async () => {
      await createSavedConnectionDraft();
      applyTemporaryDraftFromFormState(
        getStore(temporaryConnectionFormStateStore),
      );
    });
  }

  return {
    createTemporaryDraft,
    metadataFieldsDisplayStateStore,
    onTemporaryConnectTimeoutSecsInput,
    onTemporaryDeviceProfileChange,
    onTemporaryEnablePasswordInput,
    onTemporaryHostInput,
    onTemporaryLinuxShellFlavorChange,
    onTemporaryPasswordInput,
    onTemporaryPortInput,
    onTemporarySshSecurityChange,
    onTemporaryUsernameInput,
    setEnabled,
    setPanelContext,
    temporaryBasicFieldsDisplayStateStore,
    temporaryConnectionLoadingStateStore,
    temporaryDisplayStateStore,
    temporaryDraftStateStore,
  };
}
