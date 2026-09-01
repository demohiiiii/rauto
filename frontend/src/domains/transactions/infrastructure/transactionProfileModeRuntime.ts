import { getProfileModes } from "../../../api/client.js";
import { savedConnectionsRefreshState } from "$domains/connections/application/connectionTargetStoreState.js";
import { executionConnectionProfileState } from "$domains/profiles/index.js";
import type { TxProfileModeRuntime } from "../model/types.js";

export const transactionProfileModeRuntime: TxProfileModeRuntime = {
  executionConnectionProfileState,
  getProfileModes,
  savedConnectionsRefreshState,
};
