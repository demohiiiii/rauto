import type { BlacklistState, BlacklistStatusTone } from "./types.js";

export function newBlacklistState(): BlacklistState {
  return {
    checkError: "",
    checkResult: null,
    commandInput: "",
    listError: "",
    patternInput: "",
    patterns: [],
    status: { message: "-", tone: "info" },
  };
}

export function normalizeBlacklistPatterns(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((entry) => {
      if (typeof entry === "object" && entry !== null && "pattern" in entry) {
        return String(entry.pattern ?? "");
      }
      return String(entry ?? "");
    })
    .filter(Boolean);
}

export function setBlacklistStatus(
  state: BlacklistState,
  message: string,
  tone: BlacklistStatusTone = "info",
): void {
  state.status = { message: message || "-", tone };
}

export function setBlacklistCommandInput(
  state: BlacklistState,
  commandInput = "",
): void {
  state.commandInput = commandInput;
}

export function setBlacklistPatternInput(
  state: BlacklistState,
  patternInput = "",
): void {
  state.patternInput = patternInput;
}
