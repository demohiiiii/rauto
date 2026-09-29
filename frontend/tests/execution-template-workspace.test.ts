import assert from "node:assert/strict";
import test from "node:test";

import { get } from "svelte/store";
import { createExecutionTemplateWorkspace } from "../src/domains/templates/index.js";

type TemplateWorkspaceOptions = NonNullable<
  Parameters<typeof createExecutionTemplateWorkspace>[0]
>;
type GetTemplateResource = NonNullable<
  TemplateWorkspaceOptions["getTemplateResource"]
>;
type TemplateResourceDetail = Awaited<ReturnType<GetTemplateResource>>;
type TemplateListResource = NonNullable<
  TemplateWorkspaceOptions["listTemplateResource"]
>;
type TemplateListItem = Awaited<ReturnType<TemplateListResource>>[number];

interface TemplateMutationCall {
  content: string;
  name: string;
}

interface TemplateHarnessCalls {
  create: TemplateMutationCall[];
  get: string[];
  list: number;
  update: TemplateMutationCall[];
}

function deferred<T>() {
  let resolvePromise!: (value: T | PromiseLike<T>) => void;
  let rejectPromise!: (error: Error) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolvePromise = nextResolve;
    rejectPromise = (error) => nextReject(error);
  });
  return {
    promise,
    reject: rejectPromise,
    resolve: resolvePromise,
  };
}

function createHarness(overrides: TemplateWorkspaceOptions = {}) {
  let currentJson = '{"name":"manual"}';
  const calls: TemplateHarnessCalls = {
    create: [],
    get: [],
    list: 0,
    update: [],
  };
  const templates = new Map<string, string>([
    ["alpha", '{"name":"alpha"}'],
    ["beta", '{"name":"beta"}'],
  ]);
  const workspace = createExecutionTemplateWorkspace({
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
      return { name, content: templates.get(name) ?? "" };
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
    ...overrides,
  });
  return {
    calls,
    display: () => get(workspace.displayStateStore),
    getCurrentJson: () => currentJson,
    setCurrentJson(nextJson: string) {
      currentJson = nextJson;
    },
    templates,
    workspace,
  };
}

test("selecting a template loads content and captures a clean baseline", async () => {
  const harness = createHarness();
  await harness.workspace.initialize();
  assert.deepEqual(harness.display().templateNames, ["alpha", "beta"]);

  assert.equal(await harness.workspace.selectTemplate("alpha"), true);
  assert.equal(harness.getCurrentJson(), '{"name":"alpha"}');
  assert.equal(harness.display().selectedName, "alpha");
  assert.equal(harness.display().selectionKind, "existing");
  assert.equal(harness.display().dirty, false);
});

test("template list initialization survives editor synchronization", async () => {
  const list = deferred<TemplateListItem[]>();
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
  harness.workspace.startEditing();
  harness.setCurrentJson('{"name":"edited"}');
  harness.workspace.markEdited();

  assert.equal(await harness.workspace.selectTemplate("beta"), false);
  assert.equal(confirms, 1);
  assert.equal(harness.display().selectedName, "alpha");
  assert.equal(harness.getCurrentJson(), '{"name":"edited"}');
});

test("save creates a manual template and then updates it after editing", async () => {
  const harness = createHarness();
  await harness.workspace.initialize();
  harness.setCurrentJson('{"name":"created"}');
  harness.workspace.markEdited();

  await harness.workspace.saveTemplate();
  harness.workspace.changeNameDialogValue("next-plan");
  assert.equal(await harness.workspace.submitNameDialog(), true);
  assert.deepEqual(harness.calls.create, [
    { name: "next-plan", content: '{"name":"created"}' },
  ]);
  assert.equal(harness.display().selectionKind, "existing");
  assert.equal(harness.display().dirty, false);

  harness.workspace.startEditing();
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
  harness.workspace.copyToManual();
  harness.setCurrentJson('{"name":"alpha-copy"}');
  harness.workspace.markEdited();
  await harness.workspace.saveTemplate();
  harness.workspace.changeNameDialogValue("alpha-copy");

  assert.equal(await harness.workspace.submitNameDialog(), true);
  assert.deepEqual(harness.calls.create, [
    { name: "alpha-copy", content: '{"name":"alpha-copy"}' },
  ]);
  assert.equal(harness.display().selectedName, "alpha-copy");
  assert.equal(harness.display().selectionKind, "existing");
  assert.equal(harness.display().dirty, false);
});

test("an older template load cannot replace a newer selection", async () => {
  const alpha = deferred<TemplateResourceDetail>();
  const beta = deferred<TemplateResourceDetail>();
  let currentJson = '{"name":"manual"}';
  const workspace = createExecutionTemplateWorkspace({
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
    createTemplateResource: async () => ({ content: "", name: "" }),
    updateTemplateResource: async () => ({ content: "", name: "" }),
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
  const alpha = deferred<TemplateResourceDetail>();
  const beta = deferred<TemplateResourceDetail>();
  const harness = createHarness({
    getTemplateResource(_basePath, name) {
      return name === "alpha" ? alpha.promise : beta.promise;
    },
  });
  await harness.workspace.initialize();

  const alphaLoad = harness.workspace.selectTemplate("alpha");
  await Promise.resolve();
  await Promise.resolve();
  const betaLoad = harness.workspace.selectTemplate("beta");
  beta.resolve({ name: "beta", content: '{"name":"beta"}' });
  assert.equal(await betaLoad, true);
  alpha.reject(new Error("obsolete failure"));

  assert.equal(await alphaLoad, false);
  assert.equal(harness.display().selectedName, "beta");
  assert.equal(harness.display().errorMessage, "");
  assert.equal(harness.display().loadingAction, "");
});

test("selected templates require editing and cancellation restores the original JSON", async () => {
  const harness = createHarness();
  await harness.workspace.selectTemplate("alpha");
  assert.equal(harness.display().readonly, true);
  assert.equal(harness.workspace.canEdit(), false);
  assert.equal(await harness.workspace.saveTemplate(), false);
  assert.equal(harness.calls.update.length, 0);
  harness.workspace.startEditing();
  assert.equal(harness.workspace.canEdit(), true);
  harness.setCurrentJson('{"name":"changed","blocks":[]}');
  harness.workspace.markEdited();
  assert.equal(harness.display().dirty, true);
  assert.equal(await harness.workspace.cancelEditing(), true);
  assert.equal(harness.getCurrentJson(), '{"name":"alpha"}');
  assert.equal(harness.display().readonly, true);
  assert.equal(harness.display().editing, false);
  assert.equal(harness.calls.update.length, 0);
});

test("copy keeps unrendered content and manual save creates a separate template", async () => {
  const harness = createHarness();
  harness.templates.set("alpha", '{"name":"{{name}}","blocks":[]}');
  await harness.workspace.selectTemplate("alpha");
  harness.workspace.copyToManual();
  assert.equal(harness.display().selectedName, "");
  assert.equal(harness.workspace.canEdit(), true);
  assert.equal(harness.getCurrentJson(), '{"name":"{{name}}","blocks":[]}');
  await harness.workspace.saveTemplate();
  assert.equal(harness.display().nameDialog.open, true);
  assert.equal(await harness.workspace.submitNameDialog(), false);
  assert.equal(harness.display().nameDialog.error, "name_required");
  harness.workspace.changeNameDialogValue("copy");
  assert.equal(await harness.workspace.submitNameDialog(), true);
  assert.equal(harness.display().selectedName, "copy");
  assert.equal(harness.display().readonly, true);
  assert.equal(harness.templates.get("copy"), harness.templates.get("alpha"));
  assert.equal(harness.calls.update.length, 0);
});

test("failed saves keep the editor and snapshot available for retry or cancellation", async () => {
  const harness = createHarness({
    updateTemplateResource: async () => {
      throw new Error("save failed");
    },
  });
  await harness.workspace.selectTemplate("alpha");
  harness.workspace.startEditing();
  harness.setCurrentJson('{"name":"edited"}');
  harness.workspace.markEdited();
  assert.equal(await harness.workspace.saveTemplate(), false);
  assert.equal(harness.display().editing, true);
  assert.equal(harness.display().errorMessage, "save failed");
  assert.equal(harness.getCurrentJson(), '{"name":"edited"}');
  await harness.workspace.cancelEditing();
  assert.equal(harness.getCurrentJson(), '{"name":"alpha"}');
});

test("saving locks edits and selection, and a destroyed workspace ignores late loads", async () => {
  const saving = deferred<TemplateResourceDetail>();
  const harness = createHarness({
    updateTemplateResource: () => saving.promise,
  });
  await harness.workspace.selectTemplate("alpha");
  harness.workspace.startEditing();
  const pending = harness.workspace.saveTemplate();
  assert.equal(harness.workspace.canEdit(), false);
  assert.equal(await harness.workspace.cancelEditing(), false);
  assert.equal(await harness.workspace.selectTemplate("beta"), false);
  assert.equal(await harness.workspace.saveTemplate(), false);
  saving.resolve({ name: "alpha", content: '{"name":"alpha"}' });
  assert.equal(await pending, true);
  const loading = deferred<TemplateResourceDetail>();
  const other = createHarness({ getTemplateResource: () => loading.promise });
  const load = other.workspace.selectTemplate("alpha");
  await Promise.resolve();
  await Promise.resolve();
  other.workspace.destroy();
  loading.resolve({ name: "alpha", content: '{"name":"late"}' });
  assert.equal(await load, false);
  assert.equal(other.getCurrentJson(), '{"name":"manual"}');
});

test("validation failures do not create templates and preserve the name dialog", async () => {
  const harness = createHarness({
    validateContent: () => {
      throw new Error("invalid plan");
    },
  });
  await harness.workspace.saveTemplate();
  harness.workspace.changeNameDialogValue("invalid");
  assert.equal(await harness.workspace.submitNameDialog(), false);
  assert.equal(harness.calls.create.length, 0);
  assert.equal(harness.display().nameDialog.open, true);
  assert.equal(harness.display().errorMessage, "invalid plan");
});

test("import preserves the manual draft on failure and ignores a late file after template selection", async () => {
  const harness = createHarness();
  assert.equal(
    await harness.workspace.importContent(async () => {
      throw new Error("file unavailable");
    }),
    false,
  );
  assert.equal(harness.getCurrentJson(), '{"name":"manual"}');
  assert.equal(harness.display().errorMessage, "file unavailable");
  const file = deferred<string>();
  const importing = harness.workspace.importContent(() => file.promise);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(harness.workspace.canEdit(), false);
  await harness.workspace.selectTemplate("alpha");
  file.resolve('{"name":"imported"}');
  assert.equal(await importing, false);
  assert.equal(harness.display().selectedName, "alpha");
  assert.equal(harness.getCurrentJson(), '{"name":"alpha"}');
  harness.workspace.copyToManual();
  assert.equal(
    await harness.workspace.importContent(async () => '{"name":"imported"}'),
    true,
  );
  assert.equal(harness.getCurrentJson(), '{"name":"imported"}');
  assert.equal(harness.display().readonly, false);
  assert.equal(harness.display().selectedName, "");
});
