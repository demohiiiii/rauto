import { confirmUserChoice } from "../../../lib/ui.js";
import type { BlacklistRuntime } from "../model/types.js";

export const blacklistRuntime: BlacklistRuntime = {
  confirmDelete: confirmUserChoice,
};
