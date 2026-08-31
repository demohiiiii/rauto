import type { Readable, Unsubscriber, Writable } from "svelte/store";

export type WebAuthMode = "" | "agent" | "web";
export type WebAuthStatus = "authenticated" | "error" | "loading" | "required";

export interface WebAuthState {
  authenticated: boolean;
  error: string;
  mode: WebAuthMode;
  pending: boolean;
  status: WebAuthStatus;
}

export interface WebAuthStatusPayload {
  authenticated?: boolean;
  mode?: unknown;
}

export interface WebAuthLoginPayload {
  authenticated?: boolean;
  mode?: unknown;
}

export interface WebAuthDisplay {
  authenticated: boolean;
  busy: boolean;
  errorMessage: string;
  loginButtonLabel: string;
  loginDescription: string;
  loginFormDescription: string;
  loginFormTitle: string;
  loginTitle: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  retryButtonLabel: string;
  showError: boolean;
  showLogin: boolean;
}

export interface AuthApi {
  getStatus(): Promise<WebAuthStatusPayload>;
  login(password: string): Promise<WebAuthLoginPayload>;
}

export interface AuthRuntime {
  subscribeUnauthorized(handler: () => void): Unsubscriber;
}

export interface WebAuthWorkspaceOptions {
  api?: Partial<AuthApi>;
  runtime?: Partial<AuthRuntime>;
}

export interface WebAuthWorkspace {
  initialize(): Unsubscriber;
  refresh(): Promise<void>;
  setPassword(password?: string): void;
  submitLogin(): Promise<boolean>;
  webAuthDisplayStateStore: Readable<WebAuthDisplay>;
  webAuthStateStore: Writable<WebAuthState>;
  webPasswordStateStore: Writable<string>;
}
