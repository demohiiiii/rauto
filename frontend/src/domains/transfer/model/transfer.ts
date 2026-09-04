import type {
  TransferConnectionPayload,
  TransferRecordLevel,
  TransferState,
  TransferStatusTone,
  TransferUploadPayload,
} from "./types.js";

export function newTransferState(): TransferState {
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

export function setTransferLocalPath(
  state: TransferState,
  localPath = "",
): void {
  state.localPath = localPath;
}

export function setTransferRemotePath(
  state: TransferState,
  remotePath = "",
): void {
  state.remotePath = remotePath;
}

export function setTransferTimeoutSecs(
  state: TransferState,
  timeoutSecs = "",
): void {
  state.timeoutSecs = timeoutSecs;
}

export function setTransferBufferSize(
  state: TransferState,
  bufferSize = "",
): void {
  state.bufferSize = bufferSize;
}

export function setTransferShowProgress(
  state: TransferState,
  enabled = false,
): void {
  state.showProgress = Boolean(enabled);
}

export function setTransferStatus(
  state: TransferState,
  message: string,
  tone: TransferStatusTone = "info",
): void {
  state.status = { message: message || "-", tone };
}

export function transferUploadPayload(
  state: TransferState,
  connection: TransferConnectionPayload,
  recordLevel: TransferRecordLevel,
): TransferUploadPayload {
  const timeoutRaw = Number(state.timeoutSecs || 300);
  const bufferInput = state.bufferSize.trim();
  const bufferRaw = bufferInput ? Number(bufferInput) : null;
  return {
    buffer_size:
      bufferRaw !== null && Number.isFinite(bufferRaw) ? bufferRaw : null,
    connection,
    local_path: state.localPath.trim(),
    record_level: recordLevel,
    remote_path: state.remotePath.trim(),
    show_progress: state.showProgress,
    timeout_secs: Number.isFinite(timeoutRaw) ? timeoutRaw : 300,
  };
}

export function validateTransferUploadPayload(
  payload: TransferUploadPayload,
  messages: { localPathRequired: string; remotePathRequired: string },
): void {
  if (!payload.local_path) throw new Error(messages.localPathRequired);
  if (!payload.remote_path) throw new Error(messages.remotePathRequired);
}
