import { safeString } from "../../../lib/ui.js";
import type { SessionRetryState, SessionRetryValidation } from "./types.js";

export const SESSION_RETRY_LIMITS = Object.freeze({
  maxRetries: 20,
  maxBackoffMs: 300_000,
});

export function createSessionRetryState(): SessionRetryState {
  return {
    enabled: false,
    maxRetries: "1",
    initialBackoffMs: "200",
    maxBackoffMs: "2000",
    retryAuthenticationErrors: false,
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeSessionRetryState(
  value: unknown = {},
): SessionRetryState {
  const fields = record(value);
  return {
    ...createSessionRetryState(),
    ...fields,
    enabled: Boolean(fields.enabled),
    maxRetries: safeString(fields.maxRetries ?? "1"),
    initialBackoffMs: safeString(fields.initialBackoffMs ?? "200"),
    maxBackoffMs: safeString(fields.maxBackoffMs ?? "2000"),
    retryAuthenticationErrors: Boolean(fields.retryAuthenticationErrors),
  };
}

function parseUnsignedInteger(value: unknown): number | null {
  const text = safeString(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function sessionRetryValidation(
  value: unknown = {},
): SessionRetryValidation {
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
