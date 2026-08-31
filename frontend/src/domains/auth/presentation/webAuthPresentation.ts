import { tr } from "../../../lib/i18n.js";
import type { WebAuthDisplay, WebAuthState } from "../model/types.js";

export function webAuthPresentation(state: WebAuthState): WebAuthDisplay {
  return {
    authenticated:
      state.status === "authenticated" && state.authenticated === true,
    busy: state.status === "loading" || state.pending,
    errorMessage: state.error,
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
    showError: state.status === "error",
    showLogin: state.status === "required",
  };
}
