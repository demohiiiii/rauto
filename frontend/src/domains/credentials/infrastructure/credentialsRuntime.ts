import { downloadBlob } from "../../../lib/ui.js";
import type { CredentialsRuntime } from "../model/types.js";

export const credentialsRuntime: CredentialsRuntime = {
  download: downloadBlob,
};
