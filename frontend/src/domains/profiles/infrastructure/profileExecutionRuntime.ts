import { getProfileModes } from "../../../api/client.js";
import {
  connectionTargetState,
  currentExecutionConnectionProfile,
  temporaryConnectionFormStateStore,
} from "$domains/connections/index.js";
import type { ProfileExecutionRuntime } from "../model/types.js";

export const profileExecutionRuntime: ProfileExecutionRuntime = {
  connectionTargetState,
  currentExecutionConnectionProfile,
  getProfileModes,
  temporaryConnectionFormStateStore,
};
