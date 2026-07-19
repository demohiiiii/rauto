import { executeUpload } from "../../api/client.js";
import { currentLanguageState, tr } from "../../lib/i18n.js";
import { createLoadingRunner } from "../../lib/svelte.js";
import { displayString, statusPresentation } from "../../lib/ui.js";
import { derived, get as getStore, writable } from "svelte/store";
import {
  connectionPayload,
  ensureConnectionTargetSelected,
} from "../connections/connections.js";
import {
  applyRecordDrawerRecording,
  recordLevelPayload,
} from "../overlays/overlays.js";

function createTransferState() {
  return {
    bufferSize: "",
    localPath: "",
    remotePath: "",
    showProgress: false,
    status: null,
    timeoutSecs: "",
    uploadLoading: false,
  };
}

function setTransferLoadingKeys(transferState = {}, keys = []) {
  transferState.uploadLoading = Array.isArray(keys) && keys.includes("upload");
}

function setTransferLocalPath(transferState = {}, localPath = "") {
  transferState.localPath = localPath;
}

function setTransferRemotePath(transferState = {}, remotePath = "") {
  transferState.remotePath = remotePath;
}

function setTransferTimeoutSecs(transferState = {}, timeoutSecs = "") {
  transferState.timeoutSecs = timeoutSecs;
}

function setTransferBufferSize(transferState = {}, bufferSize = "") {
  transferState.bufferSize = bufferSize;
}

function setTransferShowProgress(transferState = {}, enabled = false) {
  transferState.showProgress = !!enabled;
}

function transferUploadPresentation(transferState = {}) {
  const localPathLabelText = tr("uploadLocalPathPlaceholder");
  const remotePathLabelText = tr("uploadRemotePathPlaceholder");
  const timeoutLabelText = tr("uploadTimeoutPlaceholder");
  const bufferSizeLabelText = tr("uploadBufferSizePlaceholder");
  const status = transferState.status
    ? statusPresentation(
        transferState.status.message || "-",
        transferState.status.tone || "info",
        {
          suppressPassiveLoaded: false,
        },
      )
    : { text: "", tone: "info" };
  return {
    transferUploadCardDisplay: {
      hint: tr("uploadHint"),
      title: tr("uploadTitle"),
    },
    transferUploadInputFields: {
      bufferSize: {
        ariaLabelText: bufferSizeLabelText,
        placeholder: bufferSizeLabelText,
        value: displayString(transferState.bufferSize),
      },
      localPath: {
        ariaLabelText: localPathLabelText,
        placeholder: localPathLabelText,
        value: displayString(transferState.localPath),
      },
      remotePath: {
        ariaLabelText: remotePathLabelText,
        placeholder: remotePathLabelText,
        value: displayString(transferState.remotePath),
      },
      showProgress: !!transferState.showProgress,
      showProgressLabel: tr("uploadShowProgressLabel"),
      timeoutSecs: {
        ariaLabelText: timeoutLabelText,
        placeholder: timeoutLabelText,
        value: displayString(transferState.timeoutSecs),
      },
    },
    transferUploadRunButtonDisplay: {
      uploadButtonLabel: tr("uploadExecBtn"),
      uploadLoading: !!transferState.uploadLoading,
    },
    transferUploadStatusDisplay: {
      showStatus: !!status.text,
      statusText: status.text,
      statusTone: status.tone,
    },
  };
}

function setTransferStatus(transferState = {}, message, tone = "info") {
  transferState.status = { message: message || "-", tone };
}

function updateTransferState(transferStateStore, transferMutation) {
  const transferState = getStore(transferStateStore);
  transferMutation(transferState);
  transferStateStore.set(transferState);
}

async function runTransferMutation(transferStateStore, transferMutation) {
  const transferState = getStore(transferStateStore);
  const transferMutationPromise = transferMutation(transferState);
  transferStateStore.set(transferState);
  await transferMutationPromise;
  transferStateStore.set(transferState);
}

function transferUploadPayload(transferState = {}) {
  const timeoutRaw = Number(transferState.timeoutSecs || 300);
  const bufferInput = String(transferState.bufferSize || "").trim();
  const bufferRaw = bufferInput ? Number(bufferInput) : null;
  return {
    buffer_size:
      bufferRaw !== null && Number.isFinite(bufferRaw) ? bufferRaw : null,
    connection: connectionPayload(),
    local_path: String(transferState.localPath || "").trim(),
    record_level: recordLevelPayload(),
    remote_path: String(transferState.remotePath || "").trim(),
    show_progress: !!transferState.showProgress,
    timeout_secs: Number.isFinite(timeoutRaw) ? timeoutRaw : 300,
  };
}

function validateUploadPayload(payload = {}) {
  if (!payload.local_path) {
    throw new Error(tr("localPathRequired", "local path is required"));
  }
  if (!payload.remote_path) {
    throw new Error(tr("remotePathRequired", "remote path is required"));
  }
}

function formatUploadResult(uploadResult) {
  return `${uploadResult?.ok ? "ok" : tr("orchestrationStatusFailed", "failed")} · ${displayString(
    uploadResult?.local_path,
  )} -> ${displayString(uploadResult?.remote_path)}`;
}

async function executeUploadFileTransfer(payload) {
  return executeUpload(payload);
}

async function uploadFileTransfer(transferState = {}) {
  setTransferStatus(transferState, tr("running", "running"), "running");
  try {
    const payload = transferUploadPayload(transferState);
    validateUploadPayload(payload);
    const uploadResult = await executeUploadFileTransfer(payload);
    setTransferStatus(
      transferState,
      formatUploadResult(uploadResult),
      uploadResult?.ok ? "success" : "error",
    );
    applyRecordDrawerRecording(uploadResult);
  } catch (error) {
    setTransferStatus(transferState, error.message, "error");
  }
}

function runUploadFileTransfer(transferState = {}) {
  if (!ensureConnectionTargetSelected()) {
    return null;
  }
  return uploadFileTransfer(transferState);
}

export function createTransferPageWorkspace() {
  const transferStateStore = writable(createTransferState());
  const transferUploadDisplayStateStore = derived(
    [transferStateStore, currentLanguageState],
    ([$transferStateStore, _currentLanguageState]) =>
      transferUploadPresentation($transferStateStore),
  );
  const transferLoadingRunner = createLoadingRunner(
    () => (getStore(transferStateStore).uploadLoading ? ["upload"] : []),
    (nextKeys) => {
      updateTransferState(transferStateStore, (transferState) => {
        setTransferLoadingKeys(transferState, nextKeys);
      });
    },
  );

  function updateLocalPath(localPath = "") {
    updateTransferState(transferStateStore, (transferState) => {
      setTransferLocalPath(transferState, localPath);
    });
  }

  function updateRemotePath(remotePath = "") {
    updateTransferState(transferStateStore, (transferState) => {
      setTransferRemotePath(transferState, remotePath);
    });
  }

  function updateTimeoutSecs(timeoutSecs = "") {
    updateTransferState(transferStateStore, (transferState) => {
      setTransferTimeoutSecs(transferState, timeoutSecs);
    });
  }

  function updateBufferSize(bufferSize = "") {
    updateTransferState(transferStateStore, (transferState) => {
      setTransferBufferSize(transferState, bufferSize);
    });
  }

  function updateShowProgress(showProgress = false) {
    updateTransferState(transferStateStore, (transferState) => {
      setTransferShowProgress(transferState, showProgress);
    });
  }

  function runUpload() {
    return runTransferMutation(transferStateStore, (transferState) =>
      transferLoadingRunner.run("upload", () =>
        runUploadFileTransfer(transferState),
      ),
    );
  }

  return {
    runUpload,
    transferUploadDisplayStateStore,
    transferStateStore,
    updateBufferSize,
    updateLocalPath,
    updateRemotePath,
    updateShowProgress,
    updateTimeoutSecs,
  };
}
