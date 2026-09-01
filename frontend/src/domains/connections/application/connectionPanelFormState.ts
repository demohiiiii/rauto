import { derived, get as getStore, writable } from "svelte/store";
import { currentLanguageState, t } from "../../../lib/i18n.js";
import { safeString } from "../../../lib/ui.js";
import { createLoadingStateRunner } from "../../../lib/svelte.js";
import { showToast } from "$domains/overlays/index.js";
import {
  applySavedConnectionEditorDraftFromFormState,
  applyTemporaryConnectionDraftFromFormState,
  connectionBasicFieldsPresentation,
  connectionMetadataFieldsPresentation,
  savedConnectionEditorDraftDefaults,
  temporaryConnectionDraftDefaults,
  visibleConnectionProfileOptions,
} from "$domains/connections/application/connectionFieldState.js";
import {
  CONNECTION_PROFILE_SELECT,
  connectionProfileSelectState,
} from "$domains/connections/application/connectionFieldStoreState.js";
import {
  CONNECTION_MODAL_FOCUS_TARGET,
  savedConnectionEditorPresentation,
  temporaryConnectionFocusDisplay,
  temporaryConnectionPanelPresentation,
} from "$domains/connections/presentation/connectionTargetDisplayState.js";
import { connectionModalFocusRequest } from "$domains/connections/application/connectionTargetStoreState.js";
import {
  createConnectionTestState,
  createSavedConnectionDraft,
  detectTemporaryConnectionFacts,
  runConnectionTest,
  temporaryConnectionBasicFieldWiring,
  temporaryConnectionFormStateStore,
  updateTemporaryConnectionDraftEnabled,
} from "$domains/connections/application/connectionTargetRuntimeState.js";
import {
  detectSavedConnectionProfile,
  hideSavedConnectionEditorModal,
  savedConnectionAutodetectState,
  savedConnectionEditorBasicFieldWiring,
  savedConnectionEditorFormStateStore,
  savedConnectionEditorStatusState,
  saveSavedConnectionEditor,
  testSavedConnectionDraft,
  updateSavedConnectionEditorDraftEnabled,
} from "$domains/connections/application/connectionEditorState.js";
import type {
  ConnectionAutodetectState,
  ConnectionStatus,
} from "../model/types.js";

interface PanelContext {
  active?: boolean;
  formState?: Record<string, unknown>;
}

function panelErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function createSavedConnectionEditorWorkspace() {
  let editorDraft = savedConnectionEditorDraftDefaults();
  const editorDraftStateStore = writable({ ...editorDraft });
  const deviceProfileSelectStateStore = connectionProfileSelectState(
    CONNECTION_PROFILE_SELECT.editor,
  );
  const loadingStateStore = writable({
    detectProfileLoading: false,
    saveLoading: false,
    testConnectionLoading: false,
  });
  const savedConnectionEditorLoadingState = { keys: [] };
  const savedConnectionEditorLoadingRunner = createLoadingStateRunner(
    savedConnectionEditorLoadingState,
    {
      setKeys(keys: string[]) {
        loadingStateStore.set({
          detectProfileLoading: keys.includes("detect-profile"),
          saveLoading: keys.includes("save"),
          testConnectionLoading: keys.includes("test-connection"),
        });
      },
    },
  );

  function publishEditorDraft(): void {
    editorDraftStateStore.set({ ...editorDraft });
  }

  function applyEditorDraftFromFormState(
    formState: Record<string, unknown> = {},
  ): void {
    applySavedConnectionEditorDraftFromFormState(editorDraft, formState);
    publishEditorDraft();
  }

  const savedEditorFieldWiring =
    savedConnectionEditorBasicFieldWiring(editorDraft);

  function onSavedEditorConnectTimeoutSecsInput(fieldValue: unknown): void {
    savedEditorFieldWiring.onConnectTimeoutSecsInput(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorCredentialChange(fieldValue: unknown): void {
    savedEditorFieldWiring.onCredentialChange(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorDeviceProfileChange(fieldValue: unknown): void {
    savedEditorFieldWiring.onDeviceProfileChange(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorDeviceModelInput(fieldValue: unknown): void {
    savedEditorFieldWiring.onDeviceModelInput(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorHostInput(fieldValue: unknown): void {
    savedEditorFieldWiring.onHostInput(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorLinuxShellFlavorChange(fieldValue: unknown): void {
    savedEditorFieldWiring.onLinuxShellFlavorChange(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorOutputEncodingChange(fieldValue: unknown): void {
    savedEditorFieldWiring.onOutputEncodingChange(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorNameInput(fieldValue: unknown): void {
    savedEditorFieldWiring.onNameInput(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorPortInput(fieldValue: unknown): void {
    savedEditorFieldWiring.onPortInput(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorSshSecurityChange(fieldValue: unknown): void {
    savedEditorFieldWiring.onSshSecurityChange(fieldValue);
    publishEditorDraft();
  }

  function onSavedEditorSoftwareVersionInput(fieldValue: unknown): void {
    savedEditorFieldWiring.onSoftwareVersionInput(fieldValue);
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

  function setEnabled(enabled: boolean): void {
    updateSavedConnectionEditorDraftEnabled(editorDraft, enabled);
    publishEditorDraft();
  }

  async function detectProfile() {
    return savedConnectionEditorLoadingRunner.run(
      "detect-profile",
      async () => {
        await detectSavedConnectionProfile({ ...editorDraft });
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

  async function testConnection() {
    return savedConnectionEditorLoadingRunner.run("test-connection", async () =>
      testSavedConnectionDraft({ ...editorDraft }),
    );
  }

  function setEditorContext({
    active = false,
    formState = {},
  }: PanelContext = {}): void {
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
    onSavedEditorCredentialChange,
    onSavedEditorDeviceProfileChange,
    onSavedEditorDeviceModelInput,
    onSavedEditorHostInput,
    onSavedEditorLinuxShellFlavorChange,
    onSavedEditorOutputEncodingChange,
    onSavedEditorNameInput,
    onSavedEditorPortInput,
    onSavedEditorSshSecurityChange,
    onSavedEditorSoftwareVersionInput,
    savedConnectionEditorLoadingStateStore: loadingStateStore,
    saveConnection,
    setEnabled,
    setEditorContext,
    testConnection,
  };
}

export function createTemporaryConnectionPanelWorkspace() {
  let temporaryDraft = temporaryConnectionDraftDefaults();
  const activeStateStore = writable(false);
  const connectionTestState = createConnectionTestState();
  const connectionTestStatusStateStore = writable<ConnectionStatus | null>(
    null,
  );
  const temporaryAutodetectStateStore = writable<ConnectionAutodetectState>({
    detectedModel: "",
    detectedProfile: "",
    detectedVersion: "",
    warning: "",
  });
  const temporaryDraftStateStore = writable({ ...temporaryDraft });
  const temporaryProfileSelectStateStore = connectionProfileSelectState(
    CONNECTION_PROFILE_SELECT.temporary,
  );
  const temporaryConnectionLoadingStateStore = writable({
    createDraftLoading: false,
    detectProfileLoading: false,
    testConnectionLoading: false,
  });
  const temporaryConnectionLoadingState = { keys: [] };
  const temporaryConnectionLoadingRunner = createLoadingStateRunner(
    temporaryConnectionLoadingState,
    {
      setKeys(keys: string[]) {
        temporaryConnectionLoadingStateStore.set({
          createDraftLoading: keys.includes("createDraft"),
          detectProfileLoading: keys.includes("detect-profile"),
          testConnectionLoading: keys.includes("test-connection"),
        });
      },
    },
  );

  function publishTemporaryDraft(): void {
    temporaryDraftStateStore.set({ ...temporaryDraft });
  }

  function applyTemporaryDraftFromFormState(
    formState: Record<string, unknown> = {},
  ): void {
    applyTemporaryConnectionDraftFromFormState(temporaryDraft, formState);
    publishTemporaryDraft();
  }

  const temporaryFieldWiring =
    temporaryConnectionBasicFieldWiring(temporaryDraft);

  function clearTemporaryAutodetectResult(): void {
    temporaryAutodetectStateStore.set({
      detectedModel: "",
      detectedProfile: "",
      detectedVersion: "",
      warning: "",
    });
  }

  function onTemporaryConnectTimeoutSecsInput(fieldValue: unknown): void {
    temporaryFieldWiring.onConnectTimeoutSecsInput(fieldValue);
    clearTemporaryAutodetectResult();
    publishTemporaryDraft();
  }

  function onTemporaryCredentialChange(fieldValue: unknown): void {
    temporaryFieldWiring.onCredentialChange(fieldValue);
    clearTemporaryAutodetectResult();
    publishTemporaryDraft();
  }

  function onTemporaryDeviceProfileChange(fieldValue: unknown): void {
    temporaryFieldWiring.onDeviceProfileChange(fieldValue);
    publishTemporaryDraft();
  }

  function onTemporaryDeviceModelInput(fieldValue: unknown): void {
    temporaryFieldWiring.onDeviceModelInput(fieldValue);
    clearTemporaryAutodetectResult();
    publishTemporaryDraft();
  }

  function onTemporaryHostInput(fieldValue: unknown): void {
    temporaryFieldWiring.onHostInput(fieldValue);
    clearTemporaryAutodetectResult();
    publishTemporaryDraft();
  }

  function onTemporaryLinuxShellFlavorChange(fieldValue: unknown): void {
    temporaryFieldWiring.onLinuxShellFlavorChange(fieldValue);
    clearTemporaryAutodetectResult();
    publishTemporaryDraft();
  }

  function onTemporaryOutputEncodingChange(fieldValue: unknown): void {
    temporaryFieldWiring.onOutputEncodingChange(fieldValue);
    clearTemporaryAutodetectResult();
    publishTemporaryDraft();
  }

  function onTemporaryPortInput(fieldValue: unknown): void {
    temporaryFieldWiring.onPortInput(fieldValue);
    clearTemporaryAutodetectResult();
    publishTemporaryDraft();
  }

  function onTemporarySshSecurityChange(fieldValue: unknown): void {
    temporaryFieldWiring.onSshSecurityChange(fieldValue);
    clearTemporaryAutodetectResult();
    publishTemporaryDraft();
  }

  function onTemporarySoftwareVersionInput(fieldValue: unknown): void {
    temporaryFieldWiring.onSoftwareVersionInput(fieldValue);
    clearTemporaryAutodetectResult();
    publishTemporaryDraft();
  }

  const temporaryDisplayStateStore = derived(
    [
      connectionTestStatusStateStore,
      temporaryAutodetectStateStore,
      currentLanguageState,
    ],
    ([
      $connectionTestStatusStateStore,
      $temporaryAutodetectStateStore,
      _currentLanguageState,
    ]) =>
      temporaryConnectionPanelPresentation(
        $connectionTestStatusStateStore,
        $temporaryAutodetectStateStore,
      ),
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

  function setEnabled(enabled: boolean): void {
    updateTemporaryConnectionDraftEnabled(temporaryDraft, enabled);
    publishTemporaryDraft();
  }

  function setPanelContext({
    active = false,
    formState = {},
  }: PanelContext = {}): void {
    activeStateStore.set(!!active);
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

  async function detectProfile() {
    return temporaryConnectionLoadingRunner.run("detect-profile", async () => {
      const currentProfile =
        safeString(temporaryDraft.deviceProfile || "").trim() || "autodetect";
      clearTemporaryAutodetectResult();
      try {
        const detectResult = await detectTemporaryConnectionFacts();
        applyTemporaryDraftFromFormState(
          getStore(temporaryConnectionFormStateStore),
        );
        const detectedProfile = safeString(
          detectResult?.device_profile || "",
        ).trim();
        temporaryAutodetectStateStore.set({
          detectedModel: safeString(detectResult?.device_model || "").trim(),
          detectedProfile,
          detectedVersion: safeString(
            detectResult?.software_version || "",
          ).trim(),
          warning: safeString(detectResult?.warning || "").trim(),
        });
        const message =
          detectedProfile === currentProfile
            ? `${t("savedConnAutodetectMatched")}: ${detectedProfile}`
            : `${t("savedConnAutodetectDetected")}: ${detectedProfile} (${t("savedConnAutodetectCurrent")}: ${currentProfile})`;
        showToast(message, "success");
        return detectResult;
      } catch (error) {
        clearTemporaryAutodetectResult();
        const message = panelErrorMessage(
          error,
          t("savedConnAutodetectNoResult"),
        );
        showToast(message, "error");
        return null;
      }
    });
  }

  async function testConnection() {
    return temporaryConnectionLoadingRunner.run("test-connection", async () => {
      const connectionTestRun = runConnectionTest(
        connectionTestState,
        "temporary",
      );
      connectionTestStatusStateStore.set(connectionTestState.status);
      await connectionTestRun;
      connectionTestStatusStateStore.set(connectionTestState.status);
    });
  }

  return {
    createTemporaryDraft,
    detectProfile,
    metadataFieldsDisplayStateStore,
    onTemporaryConnectTimeoutSecsInput,
    onTemporaryCredentialChange,
    onTemporaryDeviceProfileChange,
    onTemporaryDeviceModelInput,
    onTemporaryHostInput,
    onTemporaryLinuxShellFlavorChange,
    onTemporaryOutputEncodingChange,
    onTemporaryPortInput,
    onTemporarySshSecurityChange,
    onTemporarySoftwareVersionInput,
    setEnabled,
    setPanelContext,
    testConnection,
    temporaryBasicFieldsDisplayStateStore,
    temporaryConnectionLoadingStateStore,
    temporaryDisplayStateStore,
    temporaryDraftStateStore,
  };
}
