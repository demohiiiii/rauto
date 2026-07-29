import { t } from "../../lib/i18n.js";
import { safeString } from "../../lib/ui.js";

export const SESSION_RETRY_LIMITS = Object.freeze({
  maxRetries: 20,
  maxBackoffMs: 300_000,
});

export function createSessionRetryState() {
  return {
    enabled: false,
    maxRetries: "1",
    initialBackoffMs: "200",
    maxBackoffMs: "2000",
    retryAuthenticationErrors: false,
  };
}

export function normalizeSessionRetryState(value = {}) {
  return {
    ...createSessionRetryState(),
    ...(value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {}),
    enabled: Boolean(value?.enabled),
    maxRetries: safeString(value?.maxRetries ?? "1"),
    initialBackoffMs: safeString(value?.initialBackoffMs ?? "200"),
    maxBackoffMs: safeString(value?.maxBackoffMs ?? "2000"),
    retryAuthenticationErrors: Boolean(value?.retryAuthenticationErrors),
  };
}

function parseUnsignedInteger(value) {
  const text = safeString(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function sessionRetryValidation(value = {}) {
  const state = normalizeSessionRetryState(value);
  if (!state.enabled) return { errorKey: "", valid: true };

  const maxRetries = parseUnsignedInteger(state.maxRetries);
  if (
    maxRetries === null ||
    maxRetries < 0 ||
    maxRetries > SESSION_RETRY_LIMITS.maxRetries
  ) {
    return { errorKey: "sessionRetryMaxRetriesError", valid: false };
  }

  const initialBackoffMs = parseUnsignedInteger(state.initialBackoffMs);
  const maxBackoffMs = parseUnsignedInteger(state.maxBackoffMs);
  if (
    initialBackoffMs === null ||
    initialBackoffMs > SESSION_RETRY_LIMITS.maxBackoffMs ||
    maxBackoffMs === null ||
    maxBackoffMs > SESSION_RETRY_LIMITS.maxBackoffMs
  ) {
    return { errorKey: "sessionRetryBackoffRangeError", valid: false };
  }
  if (maxRetries > 0 && initialBackoffMs > maxBackoffMs) {
    return { errorKey: "sessionRetryBackoffOrderError", valid: false };
  }

  return {
    errorKey: "",
    valid: true,
    value: {
      max_retries: maxRetries,
      initial_backoff_ms: initialBackoffMs,
      max_backoff_ms: maxBackoffMs,
      retry_authentication_errors: state.retryAuthenticationErrors,
    },
  };
}

export function sessionRetryRequestFields(value = {}) {
  const validation = sessionRetryValidation(value);
  if (!normalizeSessionRetryState(value).enabled) return {};
  if (!validation.valid) {
    throw new Error(t(validation.errorKey));
  }
  return { retry: validation.value };
}
