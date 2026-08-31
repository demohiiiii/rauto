import {
  createBackup,
  downloadBackupBlob,
  listBackups,
  restoreBackup,
} from "../../../api/client.js";
import type { BackupApi } from "../model/types.js";

export const backupApi = {
  createBackup,
  downloadBackupBlob,
  listBackups,
  restoreBackup,
} as BackupApi;
