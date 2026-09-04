import { derived, get, writable } from "svelte/store";
import { currentLanguageState, t } from "../../../lib/i18n.js";
import { credentialsApi } from "../infrastructure/credentialsApi.js";
import {
  credentialErrorMessage,
  credentialFormValidationMessage,
  credentialRow,
  credentialSavePayload,
  newCredentialForm,
  newCredentialsPageState,
} from "../model/credentials.js";
import type {
  CredentialForm,
  CredentialImportReport,
  CredentialsApi,
  CredentialsPageState,
  CredentialsPageWorkspace,
  CredentialsWorkspaceOptions,
} from "../model/types.js";
import { credentialsPagePresentation } from "../presentation/credentialsPresentation.js";

export function createCredentialsPageWorkspace(
  options: CredentialsWorkspaceOptions = {},
): CredentialsPageWorkspace {
  const api = Object.assign({}, credentialsApi, options.api) as CredentialsApi;
  const stateStore = writable<CredentialsPageState>(newCredentialsPageState());
  const displayStateStore = derived(
    [stateStore, currentLanguageState],
    ([$state]) => credentialsPagePresentation($state),
  );

  function updateState(mutation: (state: CredentialsPageState) => void): void {
    const state = get(stateStore);
    mutation(state);
    stateStore.set(state);
  }

  async function selectCredential(id: string): Promise<void> {
    updateState((state) => {
      state.selectedId = id;
    });
    try {
      const row = credentialRow(await api.getCredential(id));
      updateState((state) => {
        if (state.selectedId !== id) return;
        state.form = newCredentialForm(row);
        state.status = { text: "", tone: "info" };
      });
    } catch (error) {
      updateState((state) => {
        if (state.selectedId !== id) return;
        state.status = {
          text: credentialErrorMessage(error, t),
          tone: "error",
        };
      });
    }
  }

  function resetForm(): void {
    updateState((state) => {
      state.form = newCredentialForm();
      state.selectedId = "";
      state.status = { text: "", tone: "info" };
    });
  }

  async function loadCredentials(selectId = ""): Promise<void> {
    updateState((state) => {
      state.loading = true;
    });
    try {
      const payload = await api.listCredentials();
      const credentials = payload.map(credentialRow);
      const current = get(stateStore);
      const nextId = selectId || current.selectedId || credentials[0]?.id || "";
      updateState((state) => {
        state.credentials = credentials;
      });
      if (nextId) await selectCredential(nextId);
      else resetForm();
    } catch (error) {
      updateState((state) => {
        state.status = {
          text: credentialErrorMessage(error, t),
          tone: "error",
        };
      });
    } finally {
      updateState((state) => {
        state.loading = false;
      });
    }
  }

  async function save(): Promise<void> {
    const current = get(stateStore);
    const validationMessage = credentialFormValidationMessage(current.form, {
      editing: Boolean(current.selectedId),
      translate: t,
    });
    if (validationMessage) {
      updateState((state) => {
        state.status = { text: validationMessage, tone: "error" };
      });
      return;
    }
    updateState((state) => {
      state.saving = true;
    });
    try {
      const payload = credentialSavePayload(current.form);
      const response = current.selectedId
        ? await api.updateCredential(current.selectedId, payload)
        : await api.createCredential(payload);
      const row = credentialRow(response);
      updateState((state) => {
        state.selectedId = row.id;
      });
      await loadCredentials(row.id);
      updateState((state) => {
        state.status = { text: t("credentialSaved"), tone: "success" };
      });
    } catch (error) {
      updateState((state) => {
        state.status = {
          text: credentialErrorMessage(error, t),
          tone: "error",
        };
      });
    } finally {
      updateState((state) => {
        state.saving = false;
      });
    }
  }

  async function remove(): Promise<void> {
    const current = get(stateStore);
    if (!current.selectedId || current.form.referencingConnections.length) {
      return;
    }
    try {
      await api.deleteCredential(current.selectedId);
      await loadCredentials();
      updateState((state) => {
        state.status = { text: t("credentialDeleted"), tone: "success" };
      });
    } catch (error) {
      updateState((state) => {
        state.status = {
          text: credentialErrorMessage(error, t),
          tone: "error",
        };
      });
    }
  }

  async function handleImported(report: CredentialImportReport): Promise<void> {
    await loadCredentials(get(stateStore).selectedId);
    updateState((state) => {
      state.status = {
        text: `${t("credentialImportComplete")}: ${report.imported}/${report.totalRows}`,
        tone: report.failed ? "error" : "success",
      };
    });
  }

  return {
    displayStateStore,
    handleImported,
    loadCredentials,
    patchForm(patch: Partial<CredentialForm>) {
      updateState((state) => {
        state.form = { ...state.form, ...patch };
      });
    },
    remove,
    resetForm,
    save,
    selectCredential,
    setEnableEnabled(checked: boolean) {
      updateState((state) => {
        state.form = {
          ...state.form,
          enableEnabled: checked,
          ...(!checked ? { enablePassword: "" } : {}),
        };
      });
    },
    async setPageContext({ active }: { active: boolean }): Promise<void> {
      if (!active || get(stateStore).loaded) return;
      updateState((state) => {
        state.loaded = true;
      });
      await loadCredentials();
    },
    setSearchQuery(searchQuery: string) {
      updateState((state) => {
        state.searchQuery = searchQuery;
      });
    },
    stateStore,
  };
}
