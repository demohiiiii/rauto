import { derived, get, writable } from "svelte/store";
import {
  getWebAuthStatus,
  loginWeb,
  setApiUnauthorizedHandler,
} from "../../api/client.js";
import { currentLanguageState, tr } from "../../lib/i18n.js";

const initialWebAuthState = {
  authenticated: false,
  error: "",
  mode: "",
  pending: false,
  status: "loading",
};

export function webAuthPresentation(state = {}) {
  const status = String(state.status || "loading");
  return {
    authenticated: status === "authenticated" && !!state.authenticated,
    busy: status === "loading" || !!state.pending,
    errorMessage: state.error || "",
    loginButtonLabel: tr("webLoginButton", "Log in"),
    loginDescription: tr("webLoginDescription", "Web workbench login"),
    loginFormDescription: tr(
      "webLoginFormDescription",
      "Sign in to continue to your workspace.",
    ),
    loginFormTitle: tr("webLoginFormTitle", "Welcome back"),
    loginTitle: tr("webLoginTitle", "rauto"),
    passwordLabel: tr("webLoginPasswordLabel", "Password"),
    passwordPlaceholder: tr("webLoginPasswordPlaceholder", "Web password"),
    retryButtonLabel: tr("webLoginRetry", "Retry"),
    showError: status === "error",
    showLogin: status === "required",
  };
}

export function createWebAuthWorkspace({
  getStatus = getWebAuthStatus,
  login = loginWeb,
  subscribeUnauthorized = setApiUnauthorizedHandler,
} = {}) {
  const webAuthStateStore = writable({ ...initialWebAuthState });
  const webPasswordStateStore = writable("");
  const webAuthDisplayStateStore = derived(
    [webAuthStateStore, currentLanguageState],
    ([$webAuthState, _currentLanguageState]) =>
      webAuthPresentation($webAuthState),
  );

  async function refresh() {
    webAuthStateStore.set({ ...initialWebAuthState });
    try {
      const payload = await getStatus();
      const mode = payload?.mode === "agent" ? "agent" : "web";
      const authenticated = mode === "agent" || payload?.authenticated === true;
      webAuthStateStore.set({
        authenticated,
        error: "",
        mode,
        pending: false,
        status: authenticated ? "authenticated" : "required",
      });
    } catch (_) {
      webAuthStateStore.set({
        ...initialWebAuthState,
        error: tr("webLoginStatusError", "Unable to check Web login status."),
        status: "error",
      });
    }
  }

  function requireLogin(message = "") {
    webAuthStateStore.update((state) => {
      if (state.mode !== "web") return state;
      return {
        authenticated: false,
        error:
          message ||
          tr("webLoginSessionExpired", "Your Web session has expired."),
        mode: "web",
        pending: false,
        status: "required",
      };
    });
  }

  function initialize() {
    const unsubscribeUnauthorized = subscribeUnauthorized(() => requireLogin());
    void refresh();
    return unsubscribeUnauthorized;
  }

  function setPassword(password = "") {
    webPasswordStateStore.set(String(password || ""));
  }

  async function submitLogin() {
    const password = get(webPasswordStateStore);
    if (!password) {
      requireLogin(tr("webLoginPasswordRequired", "Password is required."));
      return false;
    }
    webAuthStateStore.update((state) => ({
      ...state,
      error: "",
      pending: true,
    }));
    try {
      const payload = await login(password);
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
    } catch (_) {
      requireLogin(tr("webLoginInvalidPassword", "Incorrect Web password."));
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
