import assert from "node:assert/strict";
import test from "node:test";

import { get } from "svelte/store";
import { createOrchestrationTemplateWorkspace } from "../src/modules/orchestration/orchestrationTemplateWorkspace.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

function createHarness(overrides = {}) {
  let currentJson = '{"name":"manual"}';
  const calls = {
    create: [],
    delete: [],
    get: [],
    list: 0,
    update: [],
  };
  const templates = new Map([
    ["alpha", '{"name":"alpha"}'],
    ["beta", '{"name":"beta"}'],
  ]);
  const workspace = createOrchestrationTemplateWorkspace({
    confirmReplace: () => true,
    createDraft() {
      currentJson = '{"name":"draft"}';
    },
    getCurrentJson: () => currentJson,
    replaceJson(nextJson) {
      currentJson = nextJson;
    },
    async listTemplateResource() {
      calls.list += 1;
      return [...templates.keys()].map((name) => ({ name }));
    },
    async getTemplateResource(_basePath, name) {
      calls.get.push(name);
      return { name, content: templates.get(name) };
    },
    async createTemplateResource(_basePath, name, content) {
      calls.create.push({ content, name });
      templates.set(name, content);
      return { name, content };
    },
    async updateTemplateResource(_basePath, name, content) {
      calls.update.push({ content, name });
      templates.set(name, content);
      return { name, content };
    },
    async deleteTemplateResource(_basePath, name) {
      calls.delete.push(name);
      templates.delete(name);
      return { ok: true };
    },
    ...overrides,
  });
  return {
    calls,
    display: () => get(workspace.displayStateStore),
    getCurrentJson: () => currentJson,
    setCurrentJson(nextJson) {
      currentJson = nextJson;
    },
    templates,
    workspace,
  };
}

test("selecting a template loads content and captures a clean baseline", async () => {
  const harness = createHarness();
  await harness.workspace.initialize();
  assert.deepEqual(
    harness.display().templateOptions.map((option) => option.value),
    ["", "alpha", "beta"],
  );

  assert.equal(await harness.workspace.selectTemplate("alpha"), true);
  assert.equal(harness.getCurrentJson(), '{"name":"alpha"}');
  assert.equal(harness.display().selectedName, "alpha");
  assert.equal(harness.display().selectionKind, "existing");
  assert.equal(harness.display().dirty, false);
});

test("template list initialization survives editor synchronization", async () => {
  const list = deferred();
  const harness = createHarness({
    listTemplateResource: () => list.promise,
  });
  const initialization = harness.workspace.initialize();
  harness.setCurrentJson('{"name":"synchronized"}');
  harness.workspace.markEdited();
  list.resolve([{ name: "alpha" }]);

  assert.equal(await initialization, true);
  assert.deepEqual(harness.display().templateNames, ["alpha"]);
});

test("dirty template replacement can be cancelled", async () => {
  let confirms = 0;
  const harness = createHarness({
    confirmReplace() {
      confirms += 1;
      return false;
    },
  });
  await harness.workspace.initialize();
  await harness.workspace.selectTemplate("alpha");
  harness.setCurrentJson('{"name":"edited"}');
  harness.workspace.markEdited();

  assert.equal(await harness.workspace.selectTemplate("beta"), false);
  assert.equal(confirms, 1);
  assert.equal(harness.display().selectedName, "alpha");
  assert.equal(harness.getCurrentJson(), '{"name":"edited"}');
});

test("new creates a named unsaved draft without writing the API", async () => {
  const harness = createHarness();
  await harness.workspace.initialize();
  harness.workspace.openNewDialog();
  harness.workspace.changeNameDialogValue("next-plan");

  assert.equal(await harness.workspace.submitNameDialog(), true);
  assert.equal(harness.getCurrentJson(), '{"name":"draft"}');
  assert.equal(harness.display().selectedName, "next-plan");
  assert.equal(harness.display().selectionKind, "new");
  assert.equal(harness.calls.create.length, 0);
  assert.equal(harness.calls.update.length, 0);
});

test("save creates a new draft and then updates the existing template", async () => {
  const harness = createHarness();
  await harness.workspace.initialize();
  harness.workspace.openNewDialog();
  harness.workspace.changeNameDialogValue("next-plan");
  await harness.workspace.submitNameDialog();
  harness.setCurrentJson('{"name":"created"}');
  harness.workspace.markEdited();

  assert.equal(await harness.workspace.saveTemplate(), true);
  assert.deepEqual(harness.calls.create, [
    { name: "next-plan", content: '{"name":"created"}' },
  ]);
  assert.equal(harness.display().selectionKind, "existing");
  assert.equal(harness.display().dirty, false);

  harness.setCurrentJson('{"name":"updated"}');
  harness.workspace.markEdited();
  assert.equal(await harness.workspace.saveTemplate(), true);
  assert.deepEqual(harness.calls.update, [
    { name: "next-plan", content: '{"name":"updated"}' },
  ]);
});

test("save as creates and selects a new template", async () => {
  const harness = createHarness();
  await harness.workspace.initialize();
  await harness.workspace.selectTemplate("alpha");
  harness.setCurrentJson('{"name":"alpha-copy"}');
  harness.workspace.markEdited();
  harness.workspace.openSaveAsDialog();
  harness.workspace.changeNameDialogValue("alpha-copy");

  assert.equal(await harness.workspace.submitNameDialog(), true);
  assert.deepEqual(harness.calls.create, [
    { name: "alpha-copy", content: '{"name":"alpha-copy"}' },
  ]);
  assert.equal(harness.display().selectedName, "alpha-copy");
  assert.equal(harness.display().selectionKind, "existing");
  assert.equal(harness.display().dirty, false);
});

test("delete preserves the selected content as a manual draft", async () => {
  const harness = createHarness();
  await harness.workspace.initialize();
  await harness.workspace.selectTemplate("alpha");
  harness.setCurrentJson('{"name":"edited-alpha"}');
  harness.workspace.markEdited();

  assert.equal(await harness.workspace.deleteTemplate(), true);
  assert.deepEqual(harness.calls.delete, ["alpha"]);
  assert.equal(harness.getCurrentJson(), '{"name":"edited-alpha"}');
  assert.equal(harness.display().selectedName, "");
  assert.equal(harness.display().selectionKind, "manual");
  assert.equal(harness.display().dirty, false);
});

test("an older template load cannot replace a newer selection", async () => {
  const alpha = deferred();
  const beta = deferred();
  let currentJson = '{"name":"manual"}';
  const workspace = createOrchestrationTemplateWorkspace({
    confirmReplace: () => true,
    createDraft() {},
    getCurrentJson: () => currentJson,
    replaceJson(nextJson) {
      currentJson = nextJson;
    },
    listTemplateResource: async () => [{ name: "alpha" }, { name: "beta" }],
    getTemplateResource(_basePath, name) {
      return name === "alpha" ? alpha.promise : beta.promise;
    },
    createTemplateResource: async () => ({}),
    updateTemplateResource: async () => ({}),
    deleteTemplateResource: async () => ({}),
  });
  await workspace.initialize();

  const alphaLoad = workspace.selectTemplate("alpha");
  const betaLoad = workspace.selectTemplate("beta");
  beta.resolve({ name: "beta", content: '{"name":"beta"}' });
  assert.equal(await betaLoad, true);
  alpha.resolve({ name: "alpha", content: '{"name":"alpha"}' });
  assert.equal(await alphaLoad, false);

  assert.equal(currentJson, '{"name":"beta"}');
  assert.equal(get(workspace.displayStateStore).selectedName, "beta");
});

test("template action failures clear loading and expose the error", async () => {
  const harness = createHarness({
    getTemplateResource: async () => {
      throw new Error("template load failed");
    },
  });
  await harness.workspace.initialize();

  assert.equal(await harness.workspace.selectTemplate("alpha"), false);
  assert.equal(harness.display().loadingAction, "");
  assert.equal(harness.display().errorMessage, "template load failed");
});

test("an obsolete template failure cannot replace the latest success", async () => {
  const alpha = deferred();
  const beta = deferred();
  const harness = createHarness({
    getTemplateResource(_basePath, name) {
      return name === "alpha" ? alpha.promise : beta.promise;
    },
  });
  await harness.workspace.initialize();

  const alphaLoad = harness.workspace.selectTemplate("alpha");
  const betaLoad = harness.workspace.selectTemplate("beta");
  beta.resolve({ name: "beta", content: '{"name":"beta"}' });
  assert.equal(await betaLoad, true);
  alpha.reject(new Error("obsolete failure"));

  assert.equal(await alphaLoad, false);
  assert.equal(harness.display().selectedName, "beta");
  assert.equal(harness.display().errorMessage, "");
  assert.equal(harness.display().loadingAction, "");
});
