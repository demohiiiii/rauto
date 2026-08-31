import type { Readable } from "svelte/store";
import { downloadBlob } from "../../../lib/ui.js";
import {
  activeConnectionTarget,
  connectionTargetState,
} from "../../../modules/connections/connectionTargetStoreState.js";
import type { ConnectionTarget } from "../model/types.js";

export const configHistoryConnectionTargetStore =
  connectionTargetState as unknown as Readable<ConnectionTarget>;

export function currentConfigHistoryConnectionTarget(): ConnectionTarget {
  return activeConnectionTarget() as ConnectionTarget;
}

export function downloadConfigHistoryFile(blob: Blob, filename: string): void {
  downloadBlob(blob, filename);
}
