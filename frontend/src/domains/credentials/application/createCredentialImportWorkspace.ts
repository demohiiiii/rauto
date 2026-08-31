import { get, writable } from "svelte/store";
import { t } from "../../../lib/i18n.js";
import { credentialsApi } from "../infrastructure/credentialsApi.js";
import { credentialsRuntime } from "../infrastructure/credentialsRuntime.js";
import {
  credentialErrorMessage,
  credentialImportFileAccepted,
  credentialImportReport,
} from "../model/credentials.js";
import type {
  CredentialImportState,
  CredentialImportWorkspace,
  CredentialImportWorkspaceOptions,
  CredentialsApi,
  CredentialsRuntime,
} from "../model/types.js";

function newImportState(): CredentialImportState {
  return {
    error: "",
    file: null,
    importing: false,
    open: false,
    report: null,
    templateLoading: false,
    templateStatus: "",
  };
}

export function createCredentialImportWorkspace(
  options: CredentialImportWorkspaceOptions = {},
): CredentialImportWorkspace {
  const api = Object.assign({}, credentialsApi, options.api) as CredentialsApi;
  const runtime = Object.assign(
    {},
    credentialsRuntime,
    options.runtime,
  ) as CredentialsRuntime;
  const stateStore = writable<CredentialImportState>(newImportState());

  function updateState(mutation: (state: CredentialImportState) => void): void {
    const state = get(stateStore);
    mutation(state);
    stateStore.set(state);
  }

  function setOpen(open: boolean): void {
    if (!open && get(stateStore).importing) return;
    if (!open) {
      stateStore.set(newImportState());
      return;
    }
    updateState((state) => {
      state.open = true;
    });
  }

  async function downloadTemplate(language: string): Promise<void> {
    updateState((state) => {
      state.error = "";
      state.templateLoading = true;
      state.templateStatus = "";
    });
    try {
      const { blob, filename } = await api.downloadImportTemplate(language);
      runtime.download(blob, filename);
      updateState((state) => {
        state.templateStatus = t("credentialImportTemplateDownloaded");
      });
    } catch (error) {
      updateState((state) => {
        state.error = credentialErrorMessage(error, t);
      });
    } finally {
      updateState((state) => {
        state.templateLoading = false;
      });
    }
  }

  async function submitImport(): Promise<void> {
    const file = get(stateStore).file;
    if (!credentialImportFileAccepted(file)) {
      updateState((state) => {
        state.error = t("credentialImportFileRequired");
      });
      return;
    }
    updateState((state) => {
      state.error = "";
      state.importing = true;
      state.report = null;
      state.templateStatus = "";
    });
    try {
      const report = credentialImportReport(await api.importCredentials(file));
      updateState((state) => {
        state.report = report;
      });
      await options.onImported?.(report);
    } catch (error) {
      updateState((state) => {
        state.error = credentialErrorMessage(error, t);
      });
    } finally {
      updateState((state) => {
        state.importing = false;
      });
    }
  }

  return {
    downloadTemplate,
    selectFile(file: File | null) {
      updateState((state) => {
        state.error = "";
        state.file = file;
        state.report = null;
      });
    },
    setOpen,
    stateStore,
    submitImport,
  };
}
