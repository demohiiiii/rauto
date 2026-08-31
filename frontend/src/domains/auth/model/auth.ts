import type { WebAuthState, WebAuthStatusPayload } from "./types.js";

export function newWebAuthState(): WebAuthState {
  return {
    authenticated: false,
    error: "",
    mode: "",
    pending: false,
    status: "loading",
  };
}

export function authenticatedWebAuthState(
  payload: WebAuthStatusPayload,
): WebAuthState {
  const mode = payload?.mode === "agent" ? "agent" : "web";
  const authenticated = mode === "agent" || payload?.authenticated === true;
  return {
    authenticated,
    error: "",
    mode,
    pending: false,
    status: authenticated ? "authenticated" : "required",
  };
}

export function requiredWebAuthState(
  message: string,
  mode: WebAuthState["mode"] = "web",
): WebAuthState {
  return {
    authenticated: false,
    error: message,
    mode,
    pending: false,
    status: "required",
  };
}
