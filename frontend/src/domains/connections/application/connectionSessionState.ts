import { createConnectionSessionWorkspace } from "./createConnectionSessionWorkspace.js";
import { connectionApi } from "../infrastructure/connectionApi.js";
import {
  readConnectionSessionPreferences,
  saveConnectionSessionPreferences,
} from "../infrastructure/connectionSessionPreferences.js";
import { showToast } from "$domains/overlays/index.js";
import { subscribeConnectionStatusChecks } from "../infrastructure/connectionSessionRuntime.js";

export const connectionSession = createConnectionSessionWorkspace(
  {
    connect: connectionApi.connect,
    disconnect: connectionApi.disconnect,
    savePreferences: saveConnectionSessionPreferences,
    notifyError: (message) => showToast(message, "error"),
    subscribeStatusChecks: subscribeConnectionStatusChecks,
  },
  readConnectionSessionPreferences(),
);
