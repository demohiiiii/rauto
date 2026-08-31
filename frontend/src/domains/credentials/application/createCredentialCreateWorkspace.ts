import { get, writable } from "svelte/store";
import { t } from "../../../lib/i18n.js";
import { credentialsApi } from "../infrastructure/credentialsApi.js";
import {
  credentialErrorMessage,
  credentialFormValidationMessage,
  credentialRow,
  credentialSavePayload,
  newCredentialForm,
} from "../model/credentials.js";
import type {
  CredentialCreateState,
  CredentialCreateWorkspace,
  CredentialCreateWorkspaceOptions,
  CredentialForm,
  CredentialsApi,
} from "../model/types.js";

function newCreateState(): CredentialCreateState {
  return {
    error: "",
    form: newCredentialForm(),
    open: false,
    saving: false,
  };
}

export function createCredentialCreateWorkspace(
  options: CredentialCreateWorkspaceOptions = {},
): CredentialCreateWorkspace {
  const api = Object.assign({}, credentialsApi, options.api) as CredentialsApi;
  const stateStore = writable<CredentialCreateState>(newCreateState());

  function updateState(mutation: (state: CredentialCreateState) => void): void {
    const state = get(stateStore);
    mutation(state);
    stateStore.set(state);
  }

  function setOpen(open: boolean): void {
    if (!open) {
      stateStore.set(newCreateState());
      return;
    }
    updateState((state) => {
      state.open = true;
    });
  }

  async function submit(): Promise<void> {
    const current = get(stateStore);
    const validationMessage = credentialFormValidationMessage(current.form, {
      translate: t,
    });
    if (validationMessage) {
      updateState((state) => {
        state.error = validationMessage;
      });
      return;
    }
    updateState((state) => {
      state.error = "";
      state.saving = true;
    });
    try {
      const row = credentialRow(
        await api.createCredential(credentialSavePayload(current.form)),
      );
      await options.onCreated?.(row);
      setOpen(false);
    } catch (error) {
      updateState((state) => {
        state.error =
          credentialErrorMessage(error, t) || t("credentialCreateFailed");
      });
    } finally {
      updateState((state) => {
        state.saving = false;
      });
    }
  }

  return {
    patchForm(patch: Partial<CredentialForm>) {
      updateState((state) => {
        state.form = { ...state.form, ...patch };
      });
    },
    setEnableEnabled(checked: boolean) {
      updateState((state) => {
        state.form = {
          ...state.form,
          enableEnabled: checked,
          ...(!checked ? { enablePassword: "" } : {}),
        };
      });
    },
    setOpen,
    stateStore,
    submit,
  };
}
