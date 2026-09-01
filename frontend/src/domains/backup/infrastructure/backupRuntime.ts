import { stopEventPropagation } from "../../../lib/events.js";
import { confirmUserChoice, downloadBlob } from "../../../lib/ui.js";
import { refreshProtectedDashboardResources } from "$domains/dashboard/index.js";
import type { BackupRuntime } from "../model/types.js";

export const backupRuntime: BackupRuntime = {
  confirmRestore: confirmUserChoice,
  download: downloadBlob,
  onRestored: refreshProtectedDashboardResources,
  stopEventPropagation,
};
