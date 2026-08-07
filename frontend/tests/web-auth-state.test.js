import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import { createWebAuthWorkspace } from "../src/modules/auth/webAuth.js";

test("web auth blocks the dashboard until login succeeds", async () => {
  const workspace = createWebAuthWorkspace({
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
  const workspace = createWebAuthWorkspace({
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
  const workspace = createWebAuthWorkspace({
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
  const workspace = createWebAuthWorkspace({
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
