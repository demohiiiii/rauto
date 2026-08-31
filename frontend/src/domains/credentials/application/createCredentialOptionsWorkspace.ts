import { derived, get, writable } from "svelte/store";
import { currentLanguageState, t } from "../../../lib/i18n.js";
import { credentialsApi } from "../infrastructure/credentialsApi.js";
import { credentialErrorMessage, credentialRow } from "../model/credentials.js";
import type {
  CredentialOptionsState,
  CredentialOptionsWorkspace,
  CredentialRow,
  CredentialsApi,
  CredentialsWorkspaceOptions,
} from "../model/types.js";
import { credentialOptionsPresentation } from "../presentation/credentialsPresentation.js";

export function createCredentialOptionsWorkspace(
  options: CredentialsWorkspaceOptions = {},
): CredentialOptionsWorkspace {
  const api = Object.assign({}, credentialsApi, options.api) as CredentialsApi;
  const stateStore = writable<CredentialOptionsState>({
    credentials: [],
    error: "",
    loading: false,
  });
  const displayStateStore = derived(
    [stateStore, currentLanguageState],
    ([$state]) => credentialOptionsPresentation($state),
  );

  async function loadOptions(): Promise<void> {
    stateStore.update((state) => ({ ...state, error: "", loading: true }));
    try {
      const payload = await api.listCredentials();
      stateStore.update((state) => ({
        ...state,
        credentials: Array.isArray(payload) ? payload.map(credentialRow) : [],
      }));
    } catch (error) {
      stateStore.update((state) => ({
        ...state,
        error: credentialErrorMessage(error, t) || t("credentialLoadFailed"),
      }));
    } finally {
      stateStore.update((state) => ({ ...state, loading: false }));
    }
  }

  return {
    displayStateStore,
    handleCreated(row: CredentialRow) {
      const state = get(stateStore);
      state.credentials = [...state.credentials, row].sort((left, right) =>
        left.name.localeCompare(right.name),
      );
      stateStore.set(state);
    },
    loadOptions,
    stateStore,
  };
}
