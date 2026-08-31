import { derived, get, writable } from "svelte/store";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import { transferApi } from "../infrastructure/transferApi.js";
import { transferRuntime } from "../infrastructure/transferRuntime.js";
import {
  newTransferState,
  setTransferBufferSize,
  setTransferLocalPath,
  setTransferRemotePath,
  setTransferShowProgress,
  setTransferStatus,
  setTransferTimeoutSecs,
  transferUploadPayload,
  validateTransferUploadPayload,
} from "../model/transfer.js";
import type {
  TransferApi,
  TransferPageWorkspace,
  TransferRuntime,
  TransferState,
  TransferUploadResult,
  TransferWorkspaceOptions,
} from "../model/types.js";
import {
  formatTransferUploadResult,
  transferUploadPresentation,
} from "../presentation/transferPresentation.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createTransferPageWorkspace(
  options: TransferWorkspaceOptions = {},
): TransferPageWorkspace {
  const api = Object.assign({}, transferApi, options.api) as TransferApi;
  const runtime = Object.assign(
    {},
    transferRuntime,
    options.runtime,
  ) as TransferRuntime;
  const transferStateStore = writable<TransferState>(newTransferState());
  const transferUploadDisplayStateStore = derived(
    [transferStateStore, currentLanguageState],
    ([$state]) => transferUploadPresentation($state),
  );

  function updateState(mutation: (state: TransferState) => void): void {
    const state = get(transferStateStore);
    mutation(state);
    transferStateStore.set(state);
  }

  async function uploadFileTransfer(
    state: TransferState,
  ): Promise<TransferUploadResult | undefined> {
    setTransferStatus(state, tr("running", "running"), "running");
    transferStateStore.set(state);
    try {
      const payload = transferUploadPayload(
        state,
        runtime.connectionPayload(),
        runtime.recordLevelPayload(),
      );
      validateTransferUploadPayload(payload, {
        localPathRequired: tr("localPathRequired", "local path is required"),
        remotePathRequired: tr("remotePathRequired", "remote path is required"),
      });
      const result = await api.executeUpload(payload);
      setTransferStatus(
        state,
        formatTransferUploadResult(result),
        result.ok ? "success" : "error",
      );
      runtime.applyRecording(result);
      return result;
    } catch (error) {
      setTransferStatus(state, errorMessage(error), "error");
      return undefined;
    } finally {
      transferStateStore.set(state);
    }
  }

  async function runUpload(): Promise<TransferUploadResult | null | undefined> {
    if (get(transferStateStore).uploadLoading) return undefined;
    updateState((state) => {
      state.uploadLoading = true;
    });
    try {
      if (!runtime.ensureConnectionTargetSelected()) return null;
      return await uploadFileTransfer(get(transferStateStore));
    } finally {
      updateState((state) => {
        state.uploadLoading = false;
      });
    }
  }

  return {
    runUpload,
    transferStateStore,
    transferUploadDisplayStateStore,
    updateBufferSize(bufferSize = "") {
      updateState((state) => setTransferBufferSize(state, bufferSize));
    },
    updateLocalPath(localPath = "") {
      updateState((state) => setTransferLocalPath(state, localPath));
    },
    updateRemotePath(remotePath = "") {
      updateState((state) => setTransferRemotePath(state, remotePath));
    },
    updateShowProgress(showProgress = false) {
      updateState((state) => setTransferShowProgress(state, showProgress));
    },
    updateTimeoutSecs(timeoutSecs = "") {
      updateState((state) => setTransferTimeoutSecs(state, timeoutSecs));
    },
  };
}
