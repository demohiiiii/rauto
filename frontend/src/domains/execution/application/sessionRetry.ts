import { t } from "../../../lib/i18n.js";
import {
  normalizeSessionRetryState,
  sessionRetryValidation,
} from "../model/sessionRetry.js";
import type { SessionRetryPayload } from "../model/types.js";

export function sessionRetryRequestFields(value: unknown = {}): {
  retry?: SessionRetryPayload;
} {
  const validation = sessionRetryValidation(value);
  if (!normalizeSessionRetryState(value).enabled) return {};
  if (!validation.valid) {
    throw new Error(t(validation.errorKey));
  }
  return { retry: validation.value };
}
