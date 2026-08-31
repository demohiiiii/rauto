import { derived, get, writable } from "svelte/store";
import { currentLanguageState, tr } from "../../../lib/i18n.js";
import { authApi } from "../infrastructure/authApi.js";
import { authRuntime } from "../infrastructure/authRuntime.js";
import {
  authenticatedWebAuthState,
  newWebAuthState,
  requiredWebAuthState,
} from "../model/auth.js";
import type {
  AuthApi,
  AuthRuntime,
  WebAuthState,
  WebAuthWorkspace,
  WebAuthWorkspaceOptions,
} from "../model/types.js";
import { webAuthPresentation } from "../presentation/webAuthPresentation.js";

export function createWebAuthWorkspace(
  options: WebAuthWorkspaceOptions = {},
): WebAuthWorkspace {
  const api = Object.assign({}, authApi, options.api) as AuthApi;
  const runtime = Object.assign(
    {},
    authRuntime,
    options.runtime,
  ) as AuthRuntime;
  const webAuthStateStore = writable<WebAuthState>(newWebAuthState());
  const webPasswordStateStore = writable("");
  const webAuthDisplayStateStore = derived(
    [webAuthStateStore, currentLanguageState],
    ([$state]) => webAuthPresentation($state),
  );
  let requestVersion = 0;

  async function refresh(): Promise<void> {
    const version = ++requestVersion;
    webAuthStateStore.set(newWebAuthState());
    try {
      const payload = await api.getStatus();
      if (version !== requestVersion) return;
      webAuthStateStore.set(authenticatedWebAuthState(payload));
    } catch {
      if (version !== requestVersion) return;
      webAuthStateStore.set({
        ...newWebAuthState(),
        error: tr("webLoginStatusError", "Unable to check Web login status."),
        status: "error",
      });
    }
  }

  function requireLogin(message = ""): void {
    const state = get(webAuthStateStore);
    if (state.mode !== "web") return;
    requestVersion += 1;
    webAuthStateStore.set(
      requiredWebAuthState(
        message ||
          tr("webLoginSessionExpired", "Your Web session has expired."),
      ),
    );
  }

  function initialize() {
    const unsubscribeUnauthorized = runtime.subscribeUnauthorized(() =>
      requireLogin(),
    );
    void refresh();
    return unsubscribeUnauthorized;
  }

  function setPassword(password = ""): void {
    webPasswordStateStore.set(String(password || ""));
  }

  async function submitLogin(): Promise<boolean> {
    const password = get(webPasswordStateStore);
    if (!password) {
      requireLogin(tr("webLoginPasswordRequired", "Password is required."));
      return false;
    }
    const version = ++requestVersion;
    webAuthStateStore.update((state) => ({
      ...state,
      error: "",
      pending: true,
    }));
    try {
      const payload = await api.login(password);
      if (version !== requestVersion) return false;
      if (payload?.authenticated !== true) {
        throw new Error("Web login did not establish a session");
      }
      webPasswordStateStore.set("");
      webAuthStateStore.set({
        authenticated: true,
        error: "",
        mode: "web",
        pending: false,
        status: "authenticated",
      });
      return true;
    } catch {
      if (version !== requestVersion) {
        const state = get(webAuthStateStore);
        if (state.mode === "web" && state.status === "required") {
          webAuthStateStore.set({
            ...state,
            error: tr("webLoginInvalidPassword", "Incorrect Web password."),
          });
        }
        return false;
      }
      webAuthStateStore.set(
        requiredWebAuthState(
          tr("webLoginInvalidPassword", "Incorrect Web password."),
        ),
      );
      return false;
    }
  }

  return {
    initialize,
    refresh,
    setPassword,
    submitLogin,
    webAuthDisplayStateStore,
    webAuthStateStore,
    webPasswordStateStore,
  };
}
