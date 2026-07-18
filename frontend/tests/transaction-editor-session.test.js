import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { get } from "svelte/store";
import {
  createTxInputPanelActionWorkspace,
  createTxInputPanelWorkspace,
  transactionEditorSyncPresentation,
} from "../src/modules/transactionInputState.js";
import {
  defaultTxBlockTemplatePayload,
  txBlockEditorFormStateFromJsonText,
  txBlockFormModelFromJson,
  txBlockFormModelToJsonText,
} from "../src/modules/transactionBlockFormModels.js";
import { createTransactionEditorSession } from "../src/modules/transactionEditorSession.js";
import {
  clearTxJsonEditorsHost,
  createTxJsonEditorWorkspace,
  createTxJsonEditorsHost,
  TX_EDITOR,
  TX_TEMPLATE_KIND,
} from "../src/modules/transactionJsonEditorState.js";
import { createJsonTemplateLibrary } from "../src/modules/transactionJsonTemplateState.js";
import {
  defaultTxWorkflowTemplatePayload,
  txWorkflowEditorFormStateFromJsonText,
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
} from "../src/modules/transactionWorkflowFormModels.js";
import { createTxBlockInputPanelWorkspace } from "../src/modules/transactionInputWorkspaces.js";
import { loadI18nLanguage, t } from "../src/lib/i18n.js";

const buildDefaultFormModel = () => ({ name: "default", enabled: true });
const formModelToJsonText = (model) => JSON.stringify(model, null, 2);

function inputFormStateFromJsonText(jsonText, currentModel) {
  try {
    return {
      formError: "",
      formErrorDetail: null,
      formModel: JSON.parse(jsonText),
    };
  } catch (error) {
    return {
      formError: error.message,
      formErrorDetail: {
        column: 7,
        line: 3,
        message: error.message,
      },
      formModel: currentModel,
    };
  }
}

function createSession(publishFormChange) {
  return createTransactionEditorSession({
    buildDefaultFormModel,
    formModelToJsonText,
    inputFormStateFromJsonText,
    publishFormChange,
  });
}

function createExternalActionHarness({ notifyInput = true } = {}) {
  let actionWorkspace;
  let externalJsonText = formModelToJsonText(buildDefaultFormModel());
  let parserCalls = 0;
  const dependencyObservations = [];
  const snapshots = [];
  const upstreamTexts = [];
  const parseJsonText = (jsonText, currentModel) => {
    parserCalls += 1;
    return inputFormStateFromJsonText(jsonText, currentModel);
  };
  const txInputWorkspace = createTxInputPanelWorkspace({
    buildDefaultFormModel,
    formModelToJsonText,
    inputEditorSyncState: (currentModel) => ({
      ...parseJsonText(externalJsonText, currentModel),
      jsonText: externalJsonText,
    }),
    inputFormStateFromJsonText: parseJsonText,
    saveEditorFormModel: () => {},
  });
  const applyExternalMutation = () => {
    externalJsonText = '{"name":"external-action","enabled":false}';
    if (notifyInput) {
      actionWorkspace.handleEditorJsonInput(externalJsonText);
      dependencyObservations.push({
        formModel: txInputWorkspace.currentFormModel(),
        parserCalls,
      });
    }
    return "external-result";
  };
  const dependencies = {
    onCreateDirectDraft: applyExternalMutation,
    onCreateJsonTemplateDraft: applyExternalMutation,
    onEditorInput: (jsonText) => upstreamTexts.push(jsonText),
    onImportFile: applyExternalMutation,
    onLoadJsonTemplate: applyExternalMutation,
  };
  actionWorkspace = createTxInputPanelActionWorkspace(
    txInputWorkspace,
    dependencies,
  );
  const unsubscribe = txInputWorkspace.sessionStateStore.subscribe((state) =>
    snapshots.push(state),
  );

  return {
    actionWorkspace,
    counts: () => ({ parserCalls, snapshots: snapshots.length }),
    dependencies,
    dependencyObservations,
    externalJsonText: () => externalJsonText,
    setExternalJsonText: (jsonText) => {
      externalJsonText = jsonText;
    },
    txInputWorkspace,
    unsubscribe,
    upstreamTexts,
  };
}

function createDeferredPromise() {
  let reject;
  let resolve;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });
  return { promise, reject, resolve };
}

async function waitForCallCount(calls, expectedCount) {
  for (let index = 0; index < 20; index += 1) {
    if (calls.length >= expectedCount) return;
    await Promise.resolve();
  }
  assert.fail(`expected ${expectedCount} calls, received ${calls.length}`);
}

function createTemplateCreateRaceHarness() {
  const kind = TX_TEMPLATE_KIND.txWorkflow;
  const listRequests = [];
  const optionUpdates = [];
  const promptNames = ["first", "second"];
  let selectedName = "";
  let currentActionVersion = 0;
  const library = createJsonTemplateLibrary({
    configFor: () => ({
      apiBase: "/tx-workflow-templates",
      nameRequiredKey: "nameRequired",
      newPromptKey: "newTemplate",
      runEditor: TX_EDITOR.txWorkflow,
      runOutput: "txWorkflowPlan",
    }),
    createTemplateResource: (_apiBase, name) => ({ name }),
    getEditorContext: () => ({
      editors: {
        setTxWorkflowEditorText() {},
        txWorkflowEditorRaw: () => "{}",
      },
    }),
    getSelectedName: () => selectedName,
    listTemplateResource: () => {
      const request = createDeferredPromise();
      listRequests.push(request);
      return request.promise;
    },
    normalizeEditorKey: (editorKey) => editorKey,
    promptForResourceName: () => promptNames.shift() || "",
    setSelectedName: (_kind, name) => {
      selectedName = name;
    },
    txEditor: TX_EDITOR,
    txTemplateKind: TX_TEMPLATE_KIND,
    updateOptions: (updatedKind, options) =>
      optionUpdates.push({ kind: updatedKind, options }),
  });

  return {
    kind,
    library,
    listRequests,
    latestOptions: () =>
      optionUpdates.findLast((update) => update.kind === kind)?.options,
    nextActionContext() {
      currentActionVersion += 1;
      const actionVersion = currentActionVersion;
      return {
        isCurrent: () => actionVersion === currentActionVersion,
      };
    },
    optionUpdates,
    selectedName: () => selectedName,
  };
}

test("initializes one canonical form and JSON session", () => {
  const session = createSession();
  const defaultModel = buildDefaultFormModel();

  assert.deepEqual(get(session.formModelStateStore), defaultModel);
  assert.equal(
    get(session.jsonTextStateStore),
    formModelToJsonText(defaultModel),
  );
  assert.equal(
    get(session.lastValidJsonStateStore),
    formModelToJsonText(defaultModel),
  );
  assert.equal(get(session.formErrorStateStore), "");
  assert.equal(get(session.formErrorDetailStateStore), null);
  assert.equal(get(session.editorDisplayModeStateStore), "form");
  assert.equal(get(session.syncStatusStateStore), "synced");
  assert.deepEqual(session.currentFormModel(), defaultModel);
});

test("presents localized transaction editor sync states", async () => {
  await loadI18nLanguage("en");
  assert.deepEqual(transactionEditorSyncPresentation("invalid-json"), {
    text: "Invalid JSON",
    tone: "warning",
  });
  assert.deepEqual(transactionEditorSyncPresentation("dirty"), {
    text: "Unsaved changes",
    tone: "muted",
  });
  assert.deepEqual(transactionEditorSyncPresentation("synced"), {
    text: "Synced",
    tone: "primary",
  });

  await loadI18nLanguage("zh");
  assert.deepEqual(transactionEditorSyncPresentation("invalid-json"), {
    text: "JSON 无效",
    tone: "warning",
  });
  assert.deepEqual(transactionEditorSyncPresentation("dirty"), {
    text: "有未保存更改",
    tone: "muted",
  });
  assert.deepEqual(transactionEditorSyncPresentation(), {
    text: "已同步",
    tone: "primary",
  });
});

test("exposes read-only projections of one canonical session state", () => {
  const session = createSession();
  const projectedStores = [
    session.formModelStateStore,
    session.formErrorStateStore,
    session.formErrorDetailStateStore,
    session.jsonTextStateStore,
    session.lastValidJsonStateStore,
    session.editorDisplayModeStateStore,
    session.syncStatusStateStore,
  ];

  assert.equal(typeof session.sessionStateStore.subscribe, "function");
  assert.equal("set" in session.sessionStateStore, false);
  assert.equal("update" in session.sessionStateStore, false);
  for (const store of projectedStores) {
    assert.equal(typeof store.subscribe, "function");
    assert.equal("set" in store, false);
    assert.equal("update" in store, false);
  }
});

test("publishes one complete canonical snapshot per session change", () => {
  const session = createSession();
  const snapshots = [];
  const unsubscribe = session.sessionStateStore.subscribe((state) =>
    snapshots.push(state),
  );
  const defaultModel = buildDefaultFormModel();
  const defaultJsonText = formModelToJsonText(defaultModel);
  const validJsonText = '{"name":"valid","enabled":false}';

  session.replaceJsonText(validJsonText);
  const invalidJsonText = "{";
  session.replaceJsonText(invalidJsonText);
  const editedModel = { name: "edited", enabled: true };
  const editedJsonText = formModelToJsonText(editedModel);
  session.changeFormModel(editedModel, { notify: false });
  session.selectEditorView("json");
  unsubscribe();

  assert.equal(snapshots.length, 5);
  assert.deepEqual(snapshots[0], {
    editorDisplayMode: "form",
    formError: "",
    formErrorDetail: null,
    formModel: defaultModel,
    jsonText: defaultJsonText,
    lastValidJson: defaultJsonText,
    syncStatus: "synced",
  });
  assert.deepEqual(snapshots[1], {
    ...snapshots[0],
    formModel: { name: "valid", enabled: false },
    jsonText: validJsonText,
    lastValidJson: validJsonText,
  });
  assert.equal(snapshots[2].jsonText, invalidJsonText);
  assert.deepEqual(snapshots[2].formModel, snapshots[1].formModel);
  assert.equal(snapshots[2].lastValidJson, validJsonText);
  assert.match(snapshots[2].formError, /JSON|Unexpected/);
  assert.deepEqual(snapshots[2].formErrorDetail, {
    column: 7,
    line: 3,
    message: snapshots[2].formError,
  });
  assert.equal(snapshots[2].syncStatus, "invalid-json");
  assert.deepEqual(snapshots[3], {
    ...snapshots[0],
    formModel: editedModel,
    jsonText: editedJsonText,
    lastValidJson: editedJsonText,
  });
  assert.deepEqual(snapshots[4], {
    ...snapshots[3],
    editorDisplayMode: "json",
  });
});

test("valid JSON replaces the canonical form model", () => {
  const session = createSession();
  const jsonText = '{"name":"from-json","enabled":false}';

  assert.equal(session.replaceJsonText(jsonText), true);
  assert.deepEqual(session.currentFormModel(), {
    name: "from-json",
    enabled: false,
  });
  assert.equal(get(session.jsonTextStateStore), jsonText);
  assert.equal(get(session.lastValidJsonStateStore), jsonText);
  assert.equal(get(session.formErrorStateStore), "");
  assert.equal(get(session.formErrorDetailStateStore), null);
  assert.equal(get(session.syncStatusStateStore), "synced");
});

test("valid external JSON replaces every canonical session projection", () => {
  const session = createSession();
  session.replaceJsonText("{");
  const jsonText = '{"name":"external","enabled":false}';

  assert.equal(session.replaceExternalJson(jsonText), true);
  assert.deepEqual(session.currentFormModel(), {
    name: "external",
    enabled: false,
  });
  assert.equal(get(session.jsonTextStateStore), jsonText);
  assert.equal(get(session.lastValidJsonStateStore), jsonText);
  assert.equal(get(session.formErrorStateStore), "");
  assert.equal(get(session.formErrorDetailStateStore), null);
  assert.equal(get(session.syncStatusStateStore), "synced");
});

test("invalid external JSON preserves the model and reports its location", () => {
  const session = createSession();
  const priorModel = session.currentFormModel();
  const priorJsonText = get(session.lastValidJsonStateStore);
  const invalidJsonText = '{\n  "name":\n}';

  assert.equal(session.replaceExternalJson(invalidJsonText), false);
  assert.equal(get(session.jsonTextStateStore), invalidJsonText);
  assert.deepEqual(session.currentFormModel(), priorModel);
  assert.equal(get(session.lastValidJsonStateStore), priorJsonText);
  assert.match(get(session.formErrorStateStore), /JSON|Unexpected/);
  assert.deepEqual(get(session.formErrorDetailStateStore), {
    column: 7,
    line: 3,
    message: get(session.formErrorStateStore),
  });
  assert.equal(get(session.syncStatusStateStore), "invalid-json");
});

test("form changes update JSON and publish by default", () => {
  const published = [];
  const session = createSession((...args) => published.push(args));
  const nextModel = { name: "from-form", enabled: false };

  session.changeFormModel(nextModel);

  const nextJsonText = formModelToJsonText(nextModel);
  assert.deepEqual(session.currentFormModel(), nextModel);
  assert.equal(get(session.jsonTextStateStore), nextJsonText);
  assert.equal(get(session.lastValidJsonStateStore), nextJsonText);
  assert.equal(get(session.formErrorStateStore), "");
  assert.equal(get(session.formErrorDetailStateStore), null);
  assert.equal(get(session.syncStatusStateStore), "synced");
  assert.deepEqual(published, [[nextModel, nextJsonText]]);
});

test("notify false suppresses form change publishing", () => {
  const published = [];
  const session = createSession((model) => published.push(model));

  session.changeFormModel({ name: "quiet", enabled: true }, { notify: false });

  assert.deepEqual(published, []);
});

test("invalid JSON retains exact text, prior model, and detailed error", () => {
  const session = createSession();
  const priorModel = session.currentFormModel();
  const priorJsonText = get(session.lastValidJsonStateStore);
  const invalidJsonText = '{\n  "name":\n}  ';

  assert.equal(session.replaceJsonText(invalidJsonText), false);
  assert.equal(get(session.jsonTextStateStore), invalidJsonText);
  assert.deepEqual(session.currentFormModel(), priorModel);
  assert.equal(get(session.lastValidJsonStateStore), priorJsonText);
  assert.match(get(session.formErrorStateStore), /JSON|Unexpected/);
  assert.deepEqual(get(session.formErrorDetailStateStore), {
    column: 7,
    line: 3,
    message: get(session.formErrorStateStore),
  });
  assert.equal(get(session.syncStatusStateStore), "invalid-json");
});

test("invalid JSON blocks form view until repaired", () => {
  const session = createSession();
  session.selectEditorView("json");
  session.replaceJsonText("{");

  assert.equal(session.selectEditorView("form"), false);
  assert.equal(get(session.editorDisplayModeStateStore), "json");

  assert.equal(session.replaceJsonText('{"name":"repaired"}'), true);
  assert.equal(session.selectEditorView("anything-else"), true);
  assert.equal(get(session.editorDisplayModeStateStore), "form");
  assert.deepEqual(session.currentFormModel(), { name: "repaired" });
});

test("read-only view shares the canonical model and rejects invalid JSON", () => {
  const session = createSession();

  session.changeFormModel({ name: "form-live", enabled: false });
  assert.equal(session.selectEditorView("readonly"), true);
  assert.equal(get(session.editorDisplayModeStateStore), "readonly");
  assert.equal(session.currentFormModel().name, "form-live");

  session.selectEditorView("json");
  session.replaceJsonText("{");
  assert.equal(session.selectEditorView("readonly"), false);
  assert.equal(get(session.editorDisplayModeStateStore), "json");

  session.replaceJsonText('{"name":"json-live","enabled":true}');
  assert.equal(session.selectEditorView("readonly"), true);
  assert.equal(get(session.editorDisplayModeStateStore), "readonly");
  assert.equal(session.currentFormModel().name, "json-live");
});

test("transaction editors reject empty and non-object JSON roots", async (testContext) => {
  const editorCases = [
    {
      name: "block",
      buildDefaultFormModel: () =>
        txBlockFormModelFromJson(defaultTxBlockTemplatePayload()),
      formModelToJsonText: txBlockFormModelToJsonText,
      inputFormStateFromJsonText: txBlockEditorFormStateFromJsonText,
      requiredKey: "txBlockJsonRequired",
      shapeKey: "txBlockJsonInvalidShape",
    },
    {
      name: "workflow",
      buildDefaultFormModel: () =>
        txWorkflowFormModelFromJson(defaultTxWorkflowTemplatePayload()),
      formModelToJsonText: txWorkflowFormModelToJsonText,
      inputFormStateFromJsonText: txWorkflowEditorFormStateFromJsonText,
      requiredKey: "txWorkflowJsonRequired",
      shapeKey: "txWorkflowLoadInvalidJsonShape",
    },
  ];
  const invalidRoots = [
    ["", "requiredKey"],
    [" \n\t", "requiredKey"],
    ["null", "shapeKey"],
    ["[]", "shapeKey"],
    ["42", "shapeKey"],
    ['"text"', "shapeKey"],
  ];

  for (const editorCase of editorCases) {
    await testContext.test(editorCase.name, async (editorTest) => {
      for (const [jsonText, errorKeyName] of invalidRoots) {
        await editorTest.test(JSON.stringify(jsonText), () => {
          const session = createTransactionEditorSession(editorCase);
          const priorModel = session.currentFormModel();
          const priorJsonText = get(session.lastValidJsonStateStore);
          session.selectEditorView("json");

          assert.equal(session.replaceJsonText(jsonText), false);
          assert.equal(get(session.jsonTextStateStore), jsonText);
          assert.equal(session.currentFormModel(), priorModel);
          assert.equal(get(session.lastValidJsonStateStore), priorJsonText);
          assert.equal(
            get(session.formErrorStateStore),
            t(editorCase[errorKeyName]),
          );
          assert.deepEqual(get(session.formErrorDetailStateStore), {
            message: t(editorCase[errorKeyName]),
            line: null,
            column: null,
          });
          assert.equal(get(session.syncStatusStateStore), "invalid-json");
          assert.equal(session.selectEditorView("form"), false);
          assert.equal(get(session.editorDisplayModeStateStore), "json");
        });
      }
    });
  }
});

test("workspace JSON input returns parsed state and updates canonical stores", () => {
  let parserCalls = 0;
  const workspace = createTxInputPanelWorkspace({
    buildDefaultFormModel,
    formModelToJsonText,
    inputEditorSyncState: (formModel) => ({
      formError: "",
      formErrorDetail: null,
      formModel,
      jsonText: formModelToJsonText(formModel),
    }),
    inputFormStateFromJsonText: (...args) => {
      parserCalls += 1;
      return inputFormStateFromJsonText(...args);
    },
    saveEditorFormModel: () => {},
  });
  const validJsonText = '{"name":"workspace-valid","enabled":false}';

  const validState = workspace.handleJsonInput(validJsonText);

  assert.equal(parserCalls, 1);
  assert.deepEqual(validState, {
    formError: "",
    formErrorDetail: null,
    formModel: { name: "workspace-valid", enabled: false },
  });
  assert.deepEqual(get(workspace.formModelStateStore), validState.formModel);
  assert.equal(get(workspace.jsonTextStateStore), validJsonText);
  assert.equal(get(workspace.lastValidJsonStateStore), validJsonText);
  assert.equal(get(workspace.syncStatusStateStore), "synced");

  const invalidJsonText = '{"name":';
  const invalidState = workspace.handleJsonInput(invalidJsonText);

  assert.equal(parserCalls, 2);
  assert.equal(invalidState.formModel, validState.formModel);
  assert.match(invalidState.formError, /JSON|Unexpected/);
  assert.deepEqual(invalidState.formErrorDetail, {
    column: 7,
    line: 3,
    message: invalidState.formError,
  });
  assert.equal(get(workspace.jsonTextStateStore), invalidJsonText);
  assert.deepEqual(get(workspace.formModelStateStore), validState.formModel);
  assert.equal(get(workspace.lastValidJsonStateStore), validJsonText);
  assert.equal(get(workspace.formErrorStateStore), invalidState.formError);
  assert.deepEqual(
    get(workspace.formErrorDetailStateStore),
    invalidState.formErrorDetail,
  );
  assert.equal(get(workspace.syncStatusStateStore), "invalid-json");
});

test("workspace form changes save once with the requested notify flag", () => {
  const saved = [];
  const workspace = createTxInputPanelWorkspace({
    buildDefaultFormModel,
    formModelToJsonText,
    inputEditorSyncState: (formModel) => ({
      formError: "",
      formErrorDetail: null,
      formModel,
      jsonText: formModelToJsonText(formModel),
    }),
    inputFormStateFromJsonText,
    saveEditorFormModel: (model, options) => saved.push([model, options]),
  });
  const notifyingModel = { name: "notify", enabled: true };
  const quietModel = { name: "quiet", enabled: false };

  workspace.changeFormModel(notifyingModel, { notify: true });
  workspace.changeFormModel(quietModel, { notify: false });

  assert.deepEqual(saved, [
    [notifyingModel, { notify: true }],
    [quietModel, { notify: false }],
  ]);
  assert.deepEqual(workspace.currentFormModel(), quietModel);
  assert.equal(
    get(workspace.jsonTextStateStore),
    formModelToJsonText(quietModel),
  );
});

test("workspace external refresh parses and publishes one canonical snapshot", () => {
  let parserCalls = 0;
  const snapshots = [];
  const externalJsonText = '{"name":"external-refresh","enabled":false}';
  const parseExternalJson = (jsonText, currentModel) => {
    parserCalls += 1;
    return inputFormStateFromJsonText(jsonText, currentModel);
  };
  const workspace = createTxInputPanelWorkspace({
    buildDefaultFormModel,
    formModelToJsonText,
    inputEditorSyncState: (currentModel) => ({
      ...parseExternalJson(externalJsonText, currentModel),
      jsonText: externalJsonText,
    }),
    inputFormStateFromJsonText: parseExternalJson,
    saveEditorFormModel: () => {},
  });
  const unsubscribe = workspace.sessionStateStore.subscribe((state) =>
    snapshots.push(state),
  );

  workspace.refreshFromFormModel();
  unsubscribe();

  assert.equal(parserCalls, 1);
  assert.equal(snapshots.length, 2);
  assert.deepEqual(workspace.currentFormModel(), {
    name: "external-refresh",
    enabled: false,
  });
  assert.equal(get(workspace.jsonTextStateStore), externalJsonText);
  assert.equal(get(workspace.lastValidJsonStateStore), externalJsonText);
});

test("notified external actions parse immediately and do not refresh twice", async (t) => {
  const actionCases = [
    ["createJsonDraft", []],
    ["createTemplateDraft", []],
    ["createDirectDraft", []],
    ["importFile", [{ name: "draft.json" }]],
    ["loadJsonTemplate", ["saved-template"]],
  ];

  for (const [actionName, args] of actionCases) {
    await t.test(actionName, async () => {
      const harness = createExternalActionHarness();

      assert.equal(
        await harness.actionWorkspace[actionName](...args),
        "external-result",
      );
      harness.unsubscribe();

      assert.deepEqual(harness.counts(), {
        parserCalls: 1,
        snapshots: 2,
      });
      assert.deepEqual(harness.upstreamTexts, [harness.externalJsonText()]);
      assert.deepEqual(harness.dependencyObservations, [
        {
          formModel: { name: "external-action", enabled: false },
          parserCalls: 1,
        },
      ]);
      assert.deepEqual(harness.txInputWorkspace.currentFormModel(), {
        name: "external-action",
        enabled: false,
      });
    });
  }
});

test("silent external action refreshes and parses final editor JSON once", async () => {
  const harness = createExternalActionHarness({ notifyInput: false });

  assert.equal(
    await harness.actionWorkspace.loadJsonTemplate("saved-template"),
    "external-result",
  );
  harness.unsubscribe();

  assert.deepEqual(harness.counts(), {
    parserCalls: 1,
    snapshots: 2,
  });
  assert.deepEqual(harness.upstreamTexts, []);
});

test("nested silent external actions perform one outer refresh", async () => {
  const harness = createExternalActionHarness({ notifyInput: false });
  harness.dependencies.onCreateDirectDraft = async () => {
    harness.setExternalJsonText('{"name":"outer-silent","enabled":false}');
    await harness.actionWorkspace.createTemplateDraft();
    return "outer-result";
  };
  harness.dependencies.onCreateJsonTemplateDraft = () => {
    harness.setExternalJsonText('{"name":"nested-silent","enabled":true}');
    return "nested-result";
  };

  assert.equal(
    await harness.actionWorkspace.createDirectDraft(),
    "outer-result",
  );
  harness.unsubscribe();

  assert.deepEqual(harness.counts(), {
    parserCalls: 1,
    snapshots: 2,
  });
  assert.deepEqual(harness.txInputWorkspace.currentFormModel(), {
    name: "nested-silent",
    enabled: true,
  });
});

test("overlapping silent external actions refresh after an earlier rejection", async () => {
  const harness = createExternalActionHarness({ notifyInput: false });
  const firstAction = createDeferredPromise();
  const secondAction = createDeferredPromise();
  const dependencyError = new Error("first external mutation failed");
  harness.dependencies.onLoadJsonTemplate = (templateName) =>
    templateName === "first" ? firstAction.promise : secondAction.promise;

  const firstLoad = harness.actionWorkspace.loadJsonTemplate("first");
  const firstRejection = assert.rejects(firstLoad, dependencyError);
  const secondLoad = harness.actionWorkspace.loadJsonTemplate("second");

  firstAction.reject(dependencyError);
  await firstRejection;
  harness.setExternalJsonText('{"name":"second-success","enabled":true}');
  secondAction.resolve("second-result");

  assert.equal(await secondLoad, "second-result");
  harness.unsubscribe();

  assert.deepEqual(harness.counts(), {
    parserCalls: 1,
    snapshots: 2,
  });
  assert.deepEqual(harness.txInputWorkspace.currentFormModel(), {
    name: "second-success",
    enabled: true,
  });
});

test("latest successful external action wins out of order completion", async () => {
  const harness = createExternalActionHarness({ notifyInput: false });
  const firstAction = createDeferredPromise();
  const secondAction = createDeferredPromise();
  const appliedTemplates = [];
  harness.dependencies.onLoadJsonTemplate = async (
    templateName,
    actionContext,
  ) => {
    const result = await (templateName === "first"
      ? firstAction.promise
      : secondAction.promise);
    if (actionContext && !actionContext.isCurrent()) {
      return `${templateName}-obsolete`;
    }
    appliedTemplates.push(templateName);
    harness.setExternalJsonText(
      JSON.stringify({ name: templateName, enabled: true }),
    );
    return result;
  };

  const firstLoad = harness.actionWorkspace.loadJsonTemplate("first");
  const secondLoad = harness.actionWorkspace.loadJsonTemplate("second");
  secondAction.resolve("second-result");
  assert.equal(await secondLoad, "second-result");
  firstAction.resolve("first-result");
  assert.equal(await firstLoad, "first-obsolete");
  harness.unsubscribe();

  assert.deepEqual(appliedTemplates, ["second"]);
  assert.deepEqual(harness.counts(), {
    parserCalls: 1,
    snapshots: 2,
  });
  assert.deepEqual(harness.txInputWorkspace.currentFormModel(), {
    name: "second",
    enabled: true,
  });
});

test("template loader checks latest action before mutating editor state", () => {
  const loaderSource = readFileSync(
    "frontend/src/modules/transactionJsonTemplateState.js",
    "utf8",
  );
  const loadBody = loaderSource.match(
    /return async function loadTemplateIntoEditor[\s\S]*?\n  };\n}/,
  )?.[0];
  assert.ok(loadBody);
  assert.ok(
    loadBody.indexOf("await getTemplateResource") <
      loadBody.indexOf("!actionContext.isCurrent()"),
  );
  assert.ok(
    loadBody.indexOf("!actionContext.isCurrent()") <
      loadBody.indexOf("setSelectedName"),
  );
  assert.ok(
    loadBody.indexOf("!actionContext.isCurrent()") <
      loadBody.indexOf("setPrettyJsonToEditor"),
  );
  assert.match(
    loadBody,
    /setPrettyJsonToEditor\([\s\S]*actionContext[\s\S]*\)/,
  );

  const workspaceSource = readFileSync(
    "frontend/src/modules/orchestratedWorkspace.js",
    "utf8",
  );
  assert.match(
    workspaceSource,
    /onLoadJsonTemplate: \(name, actionContext\)[\s\S]*loadTemplateIntoEditor\(kind, name, actionContext\)/,
  );
  assert.match(
    workspaceSource,
    /onCreateJsonTemplateDraft: \(actionContext\)[\s\S]*createTemplateDraft\(kind, actionContext\)/,
  );

  const createDraftBody = loaderSource.match(
    /return async function createTemplateDraft[\s\S]*?\n  };\n}/,
  )?.[0];
  assert.ok(createDraftBody);
  assert.match(
    createDraftBody,
    /loadTemplateIntoEditor\(kind, "", actionContext\)/,
  );
});

test("obsolete create list success cannot replace latest template cache and options", async () => {
  const harness = createTemplateCreateRaceHarness();
  const firstCreate = harness.library.createTemplateDraft(
    harness.kind,
    harness.nextActionContext(),
  );
  await waitForCallCount(harness.listRequests, 1);
  const secondCreate = harness.library.createTemplateDraft(
    harness.kind,
    harness.nextActionContext(),
  );
  await waitForCallCount(harness.listRequests, 2);

  harness.listRequests[1].resolve([{ name: "second" }]);
  await secondCreate;
  assert.equal(harness.selectedName(), "second");
  assert.deepEqual(harness.latestOptions()?.names, ["second"]);

  harness.listRequests[0].resolve([{ name: "first" }]);
  await firstCreate;
  harness.library.refreshAllJsonTemplateOptions();
  assert.equal(harness.selectedName(), "second");
  assert.deepEqual(harness.latestOptions()?.names, ["second"]);
});

test("obsolete create list failure cannot clear latest template cache and options", async () => {
  const harness = createTemplateCreateRaceHarness();
  const firstCreate = harness.library.createTemplateDraft(
    harness.kind,
    harness.nextActionContext(),
  );
  await waitForCallCount(harness.listRequests, 1);
  const secondCreate = harness.library.createTemplateDraft(
    harness.kind,
    harness.nextActionContext(),
  );
  await waitForCallCount(harness.listRequests, 2);

  harness.listRequests[1].resolve([{ name: "second" }]);
  await secondCreate;
  harness.listRequests[0].reject(new Error("obsolete list failure"));
  await firstCreate;
  harness.library.refreshAllJsonTemplateOptions();

  assert.equal(harness.selectedName(), "second");
  assert.deepEqual(harness.latestOptions()?.names, ["second"]);
});

test("manual input during a rejected external action remains canonical", async () => {
  const harness = createExternalActionHarness({ notifyInput: false });
  const deferred = createDeferredPromise();
  const dependencyError = new Error("external mutation failed");
  harness.dependencies.onLoadJsonTemplate = () => deferred.promise;
  const loadPromise = harness.actionWorkspace.loadJsonTemplate("pending");
  const rejection = assert.rejects(loadPromise, dependencyError);
  const manualJsonText = '{"name":"manual-pending","enabled":true}';

  harness.actionWorkspace.handleEditorJsonInput(manualJsonText);
  deferred.reject(dependencyError);
  await rejection;
  harness.unsubscribe();

  assert.deepEqual(harness.counts(), {
    parserCalls: 1,
    snapshots: 2,
  });
  assert.deepEqual(harness.upstreamTexts, [manualJsonText]);
  assert.deepEqual(harness.txInputWorkspace.currentFormModel(), {
    name: "manual-pending",
    enabled: true,
  });
  assert.equal(
    get(harness.txInputWorkspace.jsonTextStateStore),
    manualJsonText,
  );
});

test("manual block and workflow Form changes invalidate pending external actions", async (testContext) => {
  for (const editorKind of ["block", "workflow"]) {
    await testContext.test(editorKind, async () => {
      const harness = createExternalActionHarness({ notifyInput: false });
      const deferred = createDeferredPromise();
      harness.dependencies.onImportFile = async (_file, actionContext) => {
        await deferred.promise;
        if (actionContext.isCurrent()) {
          harness.setExternalJsonText(
            '{"name":"stale-import","enabled":false}',
          );
        }
        return "imported";
      };
      const importPromise = harness.actionWorkspace.importFile({
        name: `${editorKind}.json`,
      });
      const manualModel = { name: `manual-${editorKind}`, enabled: true };

      harness.actionWorkspace.changeFormModel(manualModel);
      deferred.resolve("ready");
      assert.equal(await importPromise, "imported");
      harness.unsubscribe();

      assert.deepEqual(
        harness.txInputWorkspace.currentFormModel(),
        manualModel,
      );
      assert.equal(
        get(harness.txInputWorkspace.jsonTextStateStore),
        formModelToJsonText(manualModel),
      );
    });
  }
});

test("manual block form changes invalidate a pending template load", async () => {
  const host = createTxJsonEditorsHost();
  const deferred = createDeferredPromise();
  let loadActionContext = null;
  const staleModel = txBlockFormModelFromJson({
    ...defaultTxBlockTemplatePayload(),
    name: "stale-load",
  });
  const workspace = createTxBlockInputPanelWorkspace({
    onLoadJsonTemplate: async (_name, actionContext) => {
      loadActionContext = actionContext;
      await deferred.promise;
      if (actionContext.isCurrent()) {
        host.setTxBlockEditorRawText(txBlockFormModelToJsonText(staleModel), {
          notify: false,
        });
      }
    },
  });
  workspace.selectEditorView("json");
  let hostNotifications = 0;
  let modelPublications = 0;
  let sessionPublications = 0;
  const unsubscribeModel = workspace.formModelStateStore.subscribe(() => {
    modelPublications += 1;
  });
  const unsubscribeSession = workspace.sessionStateStore.subscribe(() => {
    sessionPublications += 1;
  });
  const jsonWorkspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.txBlock,
    onInput(jsonText) {
      hostNotifications += 1;
      workspace.handleEditorJsonInput(jsonText);
    },
    value: get(workspace.jsonTextStateStore),
  });
  const disconnect = jsonWorkspace.connectHost();
  modelPublications = 0;
  sessionPublications = 0;

  const loadPromise = workspace.loadJsonTemplate("pending");
  const replacementModel = txBlockFormModelFromJson({
    ...defaultTxBlockTemplatePayload(),
    name: "replacement",
  });
  workspace.changeFormModel(replacementModel, {
    editorDisplayMode: "form",
    notify: true,
  });
  assert.equal(loadActionContext?.isCurrent(), false);
  assert.equal(hostNotifications, 1);
  assert.equal(modelPublications, 1);
  assert.equal(sessionPublications, 1);
  deferred.resolve("loaded");
  await loadPromise;

  assert.deepEqual(workspace.currentFormModel(), replacementModel);
  assert.equal(
    get(workspace.jsonTextStateStore),
    txBlockFormModelToJsonText(replacementModel),
  );
  assert.equal(hostNotifications, 1);
  assert.equal(modelPublications, 1);
  assert.equal(sessionPublications, 1);
  assert.equal(get(workspace.editorDisplayModeStateStore), "form");

  disconnect();
  unsubscribeSession();
  unsubscribeModel();
  clearTxJsonEditorsHost();
});

test("manual action workspace JSON input parses immediately once", () => {
  const harness = createExternalActionHarness();
  const manualJsonText = '{"name":"manual-only","enabled":false}';

  harness.actionWorkspace.handleEditorJsonInput(manualJsonText);
  harness.unsubscribe();

  assert.deepEqual(harness.counts(), {
    parserCalls: 1,
    snapshots: 2,
  });
  assert.deepEqual(harness.upstreamTexts, [manualJsonText]);
});

test("workspace initializes once and reset restores the default session", () => {
  let syncCalls = 0;
  const syncedModel = { name: "synced", enabled: false };
  const syncedJsonText = formModelToJsonText(syncedModel);
  const workspace = createTxInputPanelWorkspace({
    buildDefaultFormModel,
    formModelToJsonText,
    inputEditorSyncState: () => {
      syncCalls += 1;
      return {
        formError: "",
        formErrorDetail: null,
        formModel: syncedModel,
        jsonText: syncedJsonText,
      };
    },
    inputFormStateFromJsonText,
    saveEditorFormModel: () => {},
  });

  workspace.ensureInitialized();
  workspace.ensureInitialized();

  assert.equal(syncCalls, 1);
  assert.deepEqual(workspace.currentFormModel(), syncedModel);
  workspace.selectEditorView("json");
  workspace.handleJsonInput("{");
  workspace.loadingKeysStore.set(["pending"]);

  workspace.reset();

  const defaultModel = buildDefaultFormModel();
  const defaultJsonText = formModelToJsonText(defaultModel);
  assert.deepEqual(workspace.currentFormModel(), defaultModel);
  assert.equal(get(workspace.jsonTextStateStore), defaultJsonText);
  assert.equal(get(workspace.lastValidJsonStateStore), defaultJsonText);
  assert.equal(get(workspace.editorDisplayModeStateStore), "form");
  assert.equal(get(workspace.syncStatusStateStore), "synced");
  assert.deepEqual(get(workspace.loadingKeysStore), []);

  workspace.ensureInitialized();
  assert.equal(syncCalls, 2);
});

test("transaction input resetDraft creates a local default without template callbacks", () => {
  const workspace = createTxBlockInputPanelWorkspace();
  workspace.ensureInitialized();
  workspace.changeFormModel(
    txBlockFormModelFromJson({
      ...defaultTxBlockTemplatePayload(),
      name: "edited",
    }),
  );

  const draft = workspace.resetDraft();

  assert.equal(draft.name, defaultTxBlockTemplatePayload().name);
  assert.equal(workspace.currentFormModel().name, draft.name);
  assert.equal(get(workspace.editorDisplayModeStateStore), "form");
});
