import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { get } from "svelte/store";
import { createWebAuthWorkspace } from "../src/domains/auth/index.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createTestWorkspace({ getStatus, login, subscribeUnauthorized } = {}) {
  return createWebAuthWorkspace({
    api: {
      getStatus: getStatus || (async () => ({ authenticated: false })),
      login: login || (async () => ({ authenticated: false })),
    },
    runtime: {
      subscribeUnauthorized: subscribeUnauthorized || (() => () => {}),
    },
  });
}

test("web auth uses the auth domain boundary", () => {
  const app = readFileSync("frontend/src/App.svelte", "utf8");

  assert.match(app, /<script lang="ts">/);
  assert.match(app, /\$domains\/auth\/index\.js/);
  assert.doesNotMatch(app, /modules\/auth/);
});

test("web auth blocks the dashboard until login succeeds", async () => {
  const workspace = createTestWorkspace({
    getStatus: async () => ({ authenticated: false, mode: "web" }),
    login: async (password) => ({
      authenticated: password === "correct-password",
      mode: "web",
    }),
    subscribeUnauthorized: () => () => {},
  });

  await workspace.refresh();
  assert.equal(get(workspace.webAuthStateStore).status, "required");

  workspace.setPassword("correct-password");
  assert.equal(await workspace.submitLogin(), true);
  assert.equal(get(workspace.webAuthStateStore).status, "authenticated");
  assert.equal(get(workspace.webPasswordStateStore), "");
});

test("web auth keeps an invalid password on the login screen", async () => {
  const workspace = createTestWorkspace({
    getStatus: async () => ({ authenticated: false, mode: "web" }),
    login: async () => {
      throw new Error("unauthorized");
    },
    subscribeUnauthorized: () => () => {},
  });

  await workspace.refresh();
  workspace.setPassword("wrong-password");
  assert.equal(await workspace.submitLogin(), false);
  assert.equal(get(workspace.webAuthStateStore).status, "required");
  assert.ok(get(workspace.webAuthStateStore).error);
});

test("agent mode bypasses the web password gate", async () => {
  const workspace = createTestWorkspace({
    getStatus: async () => ({ authenticated: false, mode: "agent" }),
    subscribeUnauthorized: () => () => {},
  });

  await workspace.refresh();
  assert.deepEqual(
    {
      authenticated: get(workspace.webAuthStateStore).authenticated,
      mode: get(workspace.webAuthStateStore).mode,
      status: get(workspace.webAuthStateStore).status,
    },
    { authenticated: true, mode: "agent", status: "authenticated" },
  );
});

test("an expired web session returns the workspace to login", async () => {
  let unauthorizedHandler = null;
  const workspace = createTestWorkspace({
    getStatus: async () => ({ authenticated: true, mode: "web" }),
    subscribeUnauthorized: (handler) => {
      unauthorizedHandler = handler;
      return () => {
        unauthorizedHandler = null;
      };
    },
  });

  const cleanup = workspace.initialize();
  await new Promise((resolve) => setTimeout(resolve, 0));
  unauthorizedHandler();
  assert.equal(get(workspace.webAuthStateStore).status, "required");
  cleanup();
  assert.equal(unauthorizedHandler, null);
});

test("latest auth status response wins when refreshes overlap", async () => {
  const first = deferred();
  const second = deferred();
  let requestCount = 0;
  const workspace = createTestWorkspace({
    getStatus() {
      requestCount += 1;
      return requestCount === 1 ? first.promise : second.promise;
    },
  });

  const firstRefresh = workspace.refresh();
  const secondRefresh = workspace.refresh();
  second.resolve({ authenticated: true, mode: "web" });
  await secondRefresh;
  first.resolve({ authenticated: false, mode: "web" });
  await firstRefresh;

  assert.equal(get(workspace.webAuthStateStore).status, "authenticated");
});

test("expired sessions invalidate a pending login response", async () => {
  const loginResponse = deferred();
  let unauthorizedHandler = null;
  const workspace = createTestWorkspace({
    getStatus: async () => ({ authenticated: true, mode: "web" }),
    login: () => loginResponse.promise,
    subscribeUnauthorized(handler) {
      unauthorizedHandler = handler;
      return () => {};
    },
  });
  const cleanup = workspace.initialize();
  await new Promise((resolve) => setTimeout(resolve, 0));
  workspace.setPassword("password");
  const loginRequest = workspace.submitLogin();

  unauthorizedHandler();
  loginResponse.resolve({ authenticated: true, mode: "web" });

  assert.equal(await loginRequest, false);
  assert.equal(get(workspace.webAuthStateStore).status, "required");
  cleanup();
});

test("login rejection replaces the global unauthorized session message", async () => {
  const loginResponse = deferred();
  let unauthorizedHandler = null;
  const workspace = createTestWorkspace({
    getStatus: async () => ({ authenticated: false, mode: "web" }),
    login: () => loginResponse.promise,
    subscribeUnauthorized(handler) {
      unauthorizedHandler = handler;
      return () => {};
    },
  });
  workspace.initialize();
  await new Promise((resolve) => setTimeout(resolve, 0));
  workspace.setPassword("incorrect");
  const loginRequest = workspace.submitLogin();

  unauthorizedHandler();
  const sessionError = get(workspace.webAuthStateStore).error;
  loginResponse.reject(new Error("unauthorized"));

  assert.equal(await loginRequest, false);
  const state = get(workspace.webAuthStateStore);
  assert.equal(state.status, "required");
  assert.ok(state.error);
  assert.notEqual(state.error, sessionError);
});
