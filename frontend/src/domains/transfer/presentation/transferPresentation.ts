import { tr } from "../../../lib/i18n.js";
import { displayString, statusPresentation } from "../../../lib/ui.js";
import type {
  TransferInputFieldDisplay,
  TransferState,
  TransferStatusTone,
  TransferUploadDisplay,
  TransferUploadResult,
} from "../model/types.js";

function inputField(
  value: string,
  placeholderKey: string,
): TransferInputFieldDisplay {
  const placeholder = tr(placeholderKey);
  return {
    ariaLabelText: placeholder,
    placeholder,
    value: displayString(value),
  };
}

export function formatTransferUploadResult(
  result: TransferUploadResult,
): string {
  return `${result.ok ? "ok" : tr("orchestrationStatusFailed", "failed")} · ${displayString(result.local_path)} -> ${displayString(result.remote_path)}`;
}

export function transferUploadPresentation(
  state: TransferState,
): TransferUploadDisplay {
  const status = state.status
    ? (statusPresentation(state.status.message, state.status.tone, {
        suppressPassiveLoaded: false,
      }) as { text: string; tone: TransferStatusTone })
    : { text: "", tone: "info" as const };
  return {
    transferUploadCardDisplay: {
      hint: tr("uploadHint"),
      title: tr("uploadTitle"),
    },
    transferUploadInputFields: {
      bufferSize: inputField(state.bufferSize, "uploadBufferSizePlaceholder"),
      localPath: inputField(state.localPath, "uploadLocalPathPlaceholder"),
      remotePath: inputField(state.remotePath, "uploadRemotePathPlaceholder"),
      showProgress: state.showProgress,
      showProgressLabel: tr("uploadShowProgressLabel"),
      timeoutSecs: inputField(state.timeoutSecs, "uploadTimeoutPlaceholder"),
    },
    transferUploadRunButtonDisplay: {
      uploadButtonLabel: tr("uploadExecBtn"),
      uploadLoading: state.uploadLoading,
    },
    transferUploadStatusDisplay: {
      showStatus: Boolean(status.text),
      statusText: status.text,
      statusTone: status.tone,
    },
  };
}
