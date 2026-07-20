import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";

import {
  clearTxJsonEditorsHost,
  createTxJsonEditorWorkspace,
  createTxJsonEditorsHost,
  requireTxJsonEditor,
  setTxJsonEditorRawText,
  TX_EDITOR,
} from "../src/modules/transactions/transactionJsonEditorState.js";
import { createOrchestratedWorkspace } from "../src/modules/orchestration/orchestratedWorkspace.js";
import { createOrchestrationEditorPanelWorkspace } from "../src/modules/orchestration/orchestrationEditorState.js";
import { createJsonTemplateLibrary } from "../src/modules/transactions/transactionJsonTemplateState.js";
import { createTxWorkflowInputPanelWorkspace } from "../src/modules/transactions/transactionInputWorkspaces.js";
import {
  createTxWorkflowStageWorkspace,
  setStatus,
  transactionOutputState,
  TX_OUTPUT,
} from "../src/modules/transactions/transactionPanelState.js";

function createDeferredTextFile() {
  let rejectText;
  let resolveText;
  const textPromise = new Promise((resolve, reject) => {
    rejectText = reject;
    resolveText = resolve;
  });
  return {
    file: { text: () => textPromise },
    rejectText,
    resolveText,
  };
}

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("canonical value replaces stale host state when the JSON editor connects", () => {
  const host = createTxJsonEditorsHost();
  host.setTxBlockEditorRawText('{"name":"stale-host"}', { notify: false });
  const notifications = [];
  const canonicalText = '{"name":"canonical","steps":[]}';
  const workspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.txBlock,
    onInput: (value) => notifications.push(value),
    value: canonicalText,
  });

  const disconnect = workspace.connectHost();

  assert.equal(get(workspace.editorTextStore), canonicalText);
  assert.equal(host.txBlockEditorRaw(), canonicalText);
  assert.deepEqual(notifications, []);

  disconnect();
  clearTxJsonEditorsHost();
});

test("external editor values silently update the connected host", () => {
  const host = createTxJsonEditorsHost();
  const notifications = [];
  const workspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.txBlock,
    onInput: (value) => notifications.push(value),
    value: '{"name":"initial"}',
  });
  const disconnect = workspace.connectHost();
  const externalText = '{"name":"external"}';

  workspace.setEditorContext({ value: externalText });

  assert.equal(get(workspace.editorTextStore), externalText);
  assert.equal(host.txBlockEditorRaw(), externalText);
  assert.deepEqual(notifications, []);

  disconnect();
  clearTxJsonEditorsHost();
});

test("active editor context changes reconnect to the new key and callback", () => {
  const host = createTxJsonEditorsHost();
  const previousNotifications = [];
  const nextNotifications = [];
  const replacementNotifications = [];
  const canonicalText = '{"name":"canonical"}';
  const workspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.txBlock,
    onInput: (value) => previousNotifications.push(value),
    value: canonicalText,
  });
  const disconnect = workspace.connectHost();

  workspace.setEditorContext({
    editorKey: TX_EDITOR.txWorkflow,
    onInput: (value) => nextNotifications.push(value),
    value: canonicalText,
  });

  assert.equal(host.txWorkflowEditorRaw(), canonicalText);
  assert.deepEqual(previousNotifications, []);
  assert.deepEqual(nextNotifications, []);

  const manualText = '{"name":"workflow-manual"}';
  workspace.handleChange(manualText);

  assert.equal(host.txWorkflowEditorRaw(), manualText);
  assert.deepEqual(previousNotifications, []);
  assert.deepEqual(nextNotifications, [manualText]);

  const replacementCanonicalText = '{"name":"replacement-canonical"}';
  workspace.setEditorContext({
    editorKey: TX_EDITOR.txWorkflow,
    onInput: (value) => replacementNotifications.push(value),
    value: replacementCanonicalText,
  });

  assert.equal(host.txWorkflowEditorRaw(), replacementCanonicalText);
  assert.deepEqual(nextNotifications, [manualText]);
  assert.deepEqual(replacementNotifications, []);

  const replacementManualText = '{"name":"replacement-manual"}';
  workspace.handleChange(replacementManualText);

  assert.equal(host.txWorkflowEditorRaw(), replacementManualText);
  assert.deepEqual(nextNotifications, [manualText]);
  assert.deepEqual(replacementNotifications, [replacementManualText]);

  disconnect();
  clearTxJsonEditorsHost();
});

test("an older same-key cleanup cannot disconnect a remounted editor", () => {
  const host = createTxJsonEditorsHost();
  const firstNotifications = [];
  const secondNotifications = [];
  const firstWorkspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.txBlock,
    onInput: (value) => firstNotifications.push(value),
    value: '{"name":"first"}',
  });
  const disconnectFirst = firstWorkspace.connectHost();
  const secondWorkspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.txBlock,
    onInput: (value) => secondNotifications.push(value),
    value: '{"name":"second"}',
  });
  const disconnectSecond = secondWorkspace.connectHost();

  disconnectFirst();
  const manualText = '{"name":"second-manual"}';
  secondWorkspace.handleChange(manualText);

  assert.equal(host.txBlockEditorRaw(), manualText);
  assert.deepEqual(firstNotifications, []);
  assert.deepEqual(secondNotifications, [manualText]);

  disconnectSecond();
  clearTxJsonEditorsHost();
});

test("context-before-connect synchronizes once and value changes do not reconnect", () => {
  let connectionCount = 0;
  let disconnectionCount = 0;
  const syncCalls = [];
  const onInput = () => {};
  const workspace = createTxJsonEditorWorkspace({
    connectHost: () => {
      connectionCount += 1;
      return () => {
        disconnectionCount += 1;
      };
    },
    setRawText: (...args) => syncCalls.push(args),
  });
  const initialText = '{"name":"initial"}';

  workspace.setEditorContext({
    editorKey: TX_EDITOR.txBlock,
    onInput,
    value: initialText,
  });

  assert.deepEqual(syncCalls, []);

  const disconnect = workspace.connectHost();
  assert.deepEqual(syncCalls, [
    [TX_EDITOR.txBlock, initialText, { notify: false }],
  ]);

  const externalText = '{"name":"external"}';
  workspace.setEditorContext({ value: externalText });

  assert.equal(connectionCount, 1);
  assert.equal(disconnectionCount, 0);
  assert.deepEqual(syncCalls, [
    [TX_EDITOR.txBlock, initialText, { notify: false }],
    [TX_EDITOR.txBlock, externalText, { notify: false }],
  ]);

  disconnect();
  assert.equal(disconnectionCount, 1);
});

test("context change followed by active cleanup reconnects with current context", () => {
  const host = createTxJsonEditorsHost();
  const initialNotifications = [];
  const nextNotifications = [];
  const workspace = createTxJsonEditorWorkspace();
  workspace.setEditorContext({
    editorKey: TX_EDITOR.txBlock,
    onInput: (value) => initialNotifications.push(value),
    value: '{"name":"initial"}',
  });
  const disconnect = workspace.connectHost();

  const nextCanonicalText = '{"name":"workflow-canonical"}';
  workspace.setEditorContext({
    editorKey: TX_EDITOR.txWorkflow,
    onInput: (value) => nextNotifications.push(value),
    value: nextCanonicalText,
  });
  disconnect();

  host.setTxWorkflowEditorRawText('{"name":"while-inactive"}', {
    notify: true,
  });
  assert.deepEqual(initialNotifications, []);
  assert.deepEqual(nextNotifications, []);

  const reconnect = workspace.connectHost();
  assert.equal(host.txWorkflowEditorRaw(), nextCanonicalText);

  const manualText = '{"name":"after-reconnect"}';
  workspace.handleChange(manualText);
  assert.deepEqual(initialNotifications, []);
  assert.deepEqual(nextNotifications, [manualText]);

  reconnect();
  clearTxJsonEditorsHost();
});

test("manual JSON input notifies once and survives an editor reconnect", () => {
  const host = createTxJsonEditorsHost();
  const notifications = [];
  const workspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.txBlock,
    onInput: (value) => notifications.push(value),
    value: '{"name":"initial"}',
  });
  const disconnect = workspace.connectHost();
  const manualText = '{"name":"manual"}';

  workspace.handleChange(manualText);

  assert.equal(get(workspace.editorTextStore), manualText);
  assert.equal(host.txBlockEditorRaw(), manualText);
  assert.deepEqual(notifications, [manualText]);

  disconnect();
  const reconnect = workspace.connectHost();

  assert.equal(get(workspace.editorTextStore), manualText);
  assert.equal(host.txBlockEditorRaw(), manualText);
  assert.deepEqual(notifications, [manualText]);

  reconnect();
  clearTxJsonEditorsHost();
});

test("destroying an older orchestrated workspace preserves the newer editor host", async () => {
  const olderWorkspace = createOrchestratedWorkspace();
  await olderWorkspace.ensureEditors();
  olderWorkspace.updateTxBlockEditorInput('{"name":"older"}');

  const newerWorkspace = createOrchestratedWorkspace();
  await newerWorkspace.ensureEditors();
  newerWorkspace.updateTxBlockEditorInput('{"name":"newer"}');

  olderWorkspace.destroy();
  assert.equal(requireTxJsonEditor("txBlockEditorRaw")(), '{"name":"newer"}');

  newerWorkspace.updateTxBlockEditorInput('{"name":"still-active"}');
  assert.equal(
    requireTxJsonEditor("txBlockEditorRaw")(),
    '{"name":"still-active"}',
  );

  newerWorkspace.destroy();
  assert.throws(
    () => requireTxJsonEditor("txBlockEditorRaw"),
    /txBlockEditorRaw is not ready/,
  );
});

test("latest transaction workflow file import wins out of order completion", async () => {
  const orchestratedWorkspace = createOrchestratedWorkspace();
  await orchestratedWorkspace.ensureEditors();
  const stageWorkspace = createTxWorkflowStageWorkspace({
    onImportFile: orchestratedWorkspace.importTxWorkflowFile,
  });
  const inputWorkspace = createTxWorkflowInputPanelWorkspace({
    onImportFile: stageWorkspace.importFile,
  });
  const firstFile = createDeferredTextFile();
  const secondFile = createDeferredTextFile();

  const firstImport = inputWorkspace.importFile(firstFile.file);
  const secondImport = inputWorkspace.importFile(secondFile.file);
  secondFile.resolveText('{"name":"second","blocks":[]}');
  await secondImport;
  const secondText = requireTxJsonEditor("txWorkflowEditorRaw")();
  assert.equal(JSON.parse(secondText).name, "second");

  firstFile.resolveText('{"name":"first","blocks":[]}');
  await firstImport;
  assert.equal(requireTxJsonEditor("txWorkflowEditorRaw")(), secondText);

  orchestratedWorkspace.destroy();
});

test("transaction block file import updates the canonical editor", async () => {
  const orchestratedWorkspace = createOrchestratedWorkspace();
  await orchestratedWorkspace.ensureEditors();
  await orchestratedWorkspace.importTxBlockFile({
    text: async () => '{"name":"imported-block","steps":[]}',
  });

  assert.equal(
    JSON.parse(requireTxJsonEditor("txBlockEditorRaw")()).name,
    "imported-block",
  );
  assert.equal(
    get(transactionOutputState(TX_OUTPUT.txBlockPlan)).tone,
    "success",
  );

  orchestratedWorkspace.destroy();
});

test("latest orchestration file import wins out of order completion", async () => {
  const orchestratedWorkspace = createOrchestratedWorkspace();
  await orchestratedWorkspace.ensureEditors();
  const editorWorkspace = createOrchestrationEditorPanelWorkspace({
    onImportFile: orchestratedWorkspace.importOrchestrationFile,
  });
  const firstFile = createDeferredTextFile();
  const secondFile = createDeferredTextFile();

  const firstImport = editorWorkspace.importFile(firstFile.file);
  const secondImport = editorWorkspace.importFile(secondFile.file);
  secondFile.resolveText('{"name":"second","stages":[]}');
  await secondImport;
  const secondText = requireTxJsonEditor("orchestrationEditorRaw")();
  assert.equal(JSON.parse(secondText).name, "second");

  firstFile.resolveText('{"name":"first","stages":[]}');
  await firstImport;
  assert.equal(requireTxJsonEditor("orchestrationEditorRaw")(), secondText);

  orchestratedWorkspace.destroy();
});

test("manual orchestration Form change invalidates a pending file import", async () => {
  const orchestratedWorkspace = createOrchestratedWorkspace();
  await orchestratedWorkspace.ensureEditors();
  const deferredFile = createDeferredTextFile();
  const editorWorkspace = createOrchestrationEditorPanelWorkspace({
    onImportFile: orchestratedWorkspace.importOrchestrationFile,
  });
  const importPromise = editorWorkspace.importFile(deferredFile.file);
  const manualModel = {
    ...get(editorWorkspace.formModelStateStore),
    name: "manual-form",
  };

  editorWorkspace.changeFormModel(manualModel);
  deferredFile.resolveText('{"name":"stale-import","stages":[]}');
  await importPromise;

  assert.equal(get(editorWorkspace.formModelStateStore).name, "manual-form");
  assert.equal(
    JSON.parse(requireTxJsonEditor("orchestrationEditorRaw")()).name,
    "manual-form",
  );

  orchestratedWorkspace.destroy();
});

test("mounted orchestration Form change publishes canonical model once", () => {
  createTxJsonEditorsHost();
  const editorWorkspace = createOrchestrationEditorPanelWorkspace();
  let hostNotifications = 0;
  let modelPublications = 0;
  const unsubscribeModel = editorWorkspace.formModelStateStore.subscribe(() => {
    modelPublications += 1;
  });
  const jsonWorkspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.orchestration,
    onInput(jsonText) {
      hostNotifications += 1;
      editorWorkspace.handleEditorJsonInput(jsonText);
    },
    value: get(editorWorkspace.jsonTextStateStore),
  });
  const disconnect = jsonWorkspace.connectHost();
  modelPublications = 0;
  const nextModel = {
    ...get(editorWorkspace.formModelStateStore),
    name: "mounted-form",
  };

  editorWorkspace.changeFormModel(nextModel);

  assert.equal(hostNotifications, 1);
  assert.equal(modelPublications, 1);
  assert.equal(get(editorWorkspace.formModelStateStore).name, "mounted-form");
  assert.equal(
    JSON.parse(get(editorWorkspace.jsonTextStateStore)).name,
    "mounted-form",
  );

  unsubscribeModel();
  disconnect();
  clearTxJsonEditorsHost();
});

test("obsolete workflow import failure cannot replace latest success status", async () => {
  const orchestratedWorkspace = createOrchestratedWorkspace();
  await orchestratedWorkspace.ensureEditors();
  const stageWorkspace = createTxWorkflowStageWorkspace({
    onImportFile: orchestratedWorkspace.importTxWorkflowFile,
  });
  const inputWorkspace = createTxWorkflowInputPanelWorkspace({
    onImportFile: stageWorkspace.importFile,
  });
  const firstFile = createDeferredTextFile();
  const secondFile = createDeferredTextFile();

  const firstImport = inputWorkspace.importFile(firstFile.file);
  const secondImport = inputWorkspace.importFile(secondFile.file);
  secondFile.resolveText('{"name":"latest","blocks":[]}');
  await secondImport;
  const latestStatus = get(transactionOutputState(TX_OUTPUT.txWorkflowPlan));
  assert.equal(latestStatus.tone, "success");

  firstFile.rejectText(new Error("obsolete workflow failure"));
  await firstImport;
  assert.deepEqual(
    get(transactionOutputState(TX_OUTPUT.txWorkflowPlan)),
    latestStatus,
  );

  const currentFailure = createDeferredTextFile();
  const currentImport = inputWorkspace.importFile(currentFailure.file);
  currentFailure.rejectText(new Error("current workflow failure"));
  await currentImport;
  assert.equal(
    get(transactionOutputState(TX_OUTPUT.txWorkflowPlan)).message,
    "current workflow failure",
  );
  assert.equal(
    get(transactionOutputState(TX_OUTPUT.txWorkflowPlan)).tone,
    "error",
  );

  orchestratedWorkspace.destroy();
});

test("obsolete orchestration import failure cannot replace latest success status", async () => {
  const orchestratedWorkspace = createOrchestratedWorkspace();
  await orchestratedWorkspace.ensureEditors();
  const editorWorkspace = createOrchestrationEditorPanelWorkspace({
    onImportFile: orchestratedWorkspace.importOrchestrationFile,
  });
  const firstFile = createDeferredTextFile();
  const secondFile = createDeferredTextFile();

  const firstImport = editorWorkspace.importFile(firstFile.file);
  const secondImport = editorWorkspace.importFile(secondFile.file);
  secondFile.resolveText('{"name":"latest","stages":[]}');
  await secondImport;
  const latestStatus = get(transactionOutputState(TX_OUTPUT.orchestrationPlan));
  assert.equal(latestStatus.tone, "success");

  firstFile.rejectText(new Error("obsolete orchestration failure"));
  await firstImport;
  assert.deepEqual(
    get(transactionOutputState(TX_OUTPUT.orchestrationPlan)),
    latestStatus,
  );

  const currentFailure = createDeferredTextFile();
  const currentImport = editorWorkspace.importFile(currentFailure.file);
  currentFailure.rejectText(new Error("current orchestration failure"));
  await currentImport;
  assert.equal(
    get(transactionOutputState(TX_OUTPUT.orchestrationPlan)).message,
    "current orchestration failure",
  );
  assert.equal(
    get(transactionOutputState(TX_OUTPUT.orchestrationPlan)).tone,
    "error",
  );

  orchestratedWorkspace.destroy();
});

test("mounted workflow import owns its notification and publishes success once", async () => {
  const orchestratedWorkspace = createOrchestratedWorkspace();
  await orchestratedWorkspace.ensureEditors();
  let importActionContext = null;
  const stageWorkspace = createTxWorkflowStageWorkspace({
    onImportFile(file, actionContext) {
      importActionContext = actionContext;
      return orchestratedWorkspace.importTxWorkflowFile(file, actionContext);
    },
  });
  const inputWorkspace = createTxWorkflowInputPanelWorkspace({
    onImportFile: stageWorkspace.importFile,
  });
  let inputNotifications = 0;
  let modelPublications = 0;
  const unsubscribeModel = inputWorkspace.formModelStateStore.subscribe(() => {
    modelPublications += 1;
  });
  modelPublications = 0;
  const jsonWorkspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.txWorkflow,
    onInput(jsonText) {
      inputNotifications += 1;
      inputWorkspace.handleWorkflowEditorInput(jsonText);
    },
    value: '{"name":"before-import","blocks":[]}',
  });
  const disconnect = jsonWorkspace.connectHost();
  setStatus(TX_OUTPUT.txWorkflowPlan, "old workflow error", "error");

  await inputWorkspace.importFile({
    text: async () => '{"name":"mounted-workflow","blocks":[]}',
  });
  assert.equal(inputNotifications, 1);
  assert.equal(modelPublications, 1);
  assert.equal(
    get(inputWorkspace.formModelStateStore).name,
    "mounted-workflow",
  );
  assert.equal(importActionContext?.isCurrent(), true);
  assert.equal(
    get(transactionOutputState(TX_OUTPUT.txWorkflowPlan)).tone,
    "success",
  );

  jsonWorkspace.handleChange('{"name":"manual-workflow","blocks":[]}');
  assert.equal(importActionContext.isCurrent(), false);

  unsubscribeModel();
  disconnect();
  orchestratedWorkspace.destroy();
});

test("mounted orchestration import owns its notification and publishes success once", async () => {
  const orchestratedWorkspace = createOrchestratedWorkspace();
  await orchestratedWorkspace.ensureEditors();
  let importActionContext = null;
  const editorWorkspace = createOrchestrationEditorPanelWorkspace({
    onImportFile(file, actionContext) {
      importActionContext = actionContext;
      return orchestratedWorkspace.importOrchestrationFile(file, actionContext);
    },
  });
  let inputNotifications = 0;
  let modelPublications = 0;
  const unsubscribeModel = editorWorkspace.formModelStateStore.subscribe(() => {
    modelPublications += 1;
  });
  modelPublications = 0;
  const jsonWorkspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.orchestration,
    onInput(jsonText) {
      inputNotifications += 1;
      editorWorkspace.handleEditorJsonInput(jsonText);
    },
    value: '{"name":"before-import","stages":[]}',
  });
  const disconnect = jsonWorkspace.connectHost();
  setStatus(TX_OUTPUT.orchestrationPlan, "old orchestration error", "error");

  await editorWorkspace.importFile({
    text: async () => '{"name":"mounted-orchestration","stages":[]}',
  });
  assert.equal(inputNotifications, 1);
  assert.equal(modelPublications, 1);
  assert.equal(
    get(editorWorkspace.formModelStateStore).name,
    "mounted-orchestration",
  );
  assert.equal(importActionContext?.isCurrent(), true);
  assert.equal(
    get(transactionOutputState(TX_OUTPUT.orchestrationPlan)).tone,
    "success",
  );

  jsonWorkspace.handleChange('{"name":"manual-orchestration","stages":[]}');
  assert.equal(importActionContext.isCurrent(), false);

  unsubscribeModel();
  disconnect();
  orchestratedWorkspace.destroy();
});

test("mounted workflow template create owns its normalization notification", async () => {
  const host = createTxJsonEditorsHost();
  const kind = "tx_workflow";
  let createActionContext = null;
  let selectedName = "";
  const statuses = [];
  const library = createJsonTemplateLibrary({
    configFor: () => ({
      apiBase: "/tx-workflow-templates",
      newPromptKey: "newTemplate",
      runEditor: TX_EDITOR.txWorkflow,
      runOutput: TX_OUTPUT.txWorkflowPlan,
    }),
    createTemplateResource: async (_apiBase, name) => ({ name }),
    getEditorContext: () => ({ editors: host }),
    getSelectedName: () => selectedName,
    listTemplateResource: async () => [{ name: "mounted-create" }],
    normalizeEditorKey: (editorKey) => editorKey,
    promptForResourceName: () => "mounted-create",
    setNamedStatus: (...args) => statuses.push(args),
    setSelectedName: (_kind, name) => {
      selectedName = name;
    },
    txEditor: TX_EDITOR,
    txTemplateKind: {
      orchestration: "orchestration",
      txBlock: "tx_block",
      txWorkflow: kind,
    },
    updateOptions() {},
  });
  const inputWorkspace = createTxWorkflowInputPanelWorkspace({
    onCreateJsonTemplateDraft(actionContext) {
      createActionContext = actionContext;
      return library.createTemplateDraft(kind, actionContext);
    },
  });
  let inputNotifications = 0;
  let modelPublications = 0;
  const unsubscribeModel = inputWorkspace.formModelStateStore.subscribe(() => {
    modelPublications += 1;
  });
  modelPublications = 0;
  const jsonWorkspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.txWorkflow,
    onInput(jsonText) {
      inputNotifications += 1;
      inputWorkspace.handleWorkflowEditorInput(jsonText);
    },
    value: '{"name":"before-create","blocks":[]}',
  });
  const disconnect = jsonWorkspace.connectHost();

  await inputWorkspace.createTemplateDraft();
  assert.equal(inputNotifications, 1);
  assert.equal(modelPublications, 1);
  assert.equal(createActionContext?.isCurrent(), true);
  assert.equal(selectedName, "mounted-create");
  assert.equal(statuses.at(-1)?.[1], "created");

  unsubscribeModel();
  disconnect();
  clearTxJsonEditorsHost();
});

test("orchestration draft reset stays current until a real editor input", async () => {
  createTxJsonEditorsHost();
  const deferredCreate = createDeferred();
  const updates = [];
  let inputNotifications = 0;
  let createActionContext = null;
  const editorWorkspace = createOrchestrationEditorPanelWorkspace({
    onCreateDraft(actionContext) {
      createActionContext = actionContext;
      if (actionContext.isCurrent()) {
        updates.push("loading", "selection", "status");
      }
      return deferredCreate.promise;
    },
  });
  let modelPublications = 0;
  const unsubscribeModel = editorWorkspace.formModelStateStore.subscribe(() => {
    modelPublications += 1;
  });
  modelPublications = 0;
  const jsonWorkspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.orchestration,
    onInput(jsonText) {
      inputNotifications += 1;
      editorWorkspace.handleEditorJsonInput(jsonText);
    },
    value: '{"name":"before-create","stages":[]}',
  });
  const disconnect = jsonWorkspace.connectHost();

  const createPromise = editorWorkspace.createJsonDraft();
  assert.equal(createActionContext?.isCurrent(), true);
  assert.deepEqual(updates, ["loading", "selection", "status"]);
  assert.equal(inputNotifications, 1);
  assert.equal(modelPublications, 1);

  jsonWorkspace.handleChange('{"name":"manual-after-reset","stages":[]}');
  assert.equal(createActionContext.isCurrent(), false);
  assert.equal(inputNotifications, 2);
  deferredCreate.resolve("created");
  assert.equal(await createPromise, "created");

  unsubscribeModel();
  disconnect();
  clearTxJsonEditorsHost();
});

test("orchestration draft reset publishes once without an editor callback", async () => {
  clearTxJsonEditorsHost();
  const editorWorkspace = createOrchestrationEditorPanelWorkspace({
    onCreateDraft: () => "created",
  });
  let modelPublications = 0;
  const unsubscribeModel = editorWorkspace.formModelStateStore.subscribe(() => {
    modelPublications += 1;
  });
  modelPublications = 0;

  assert.equal(await editorWorkspace.createJsonDraft(), "created");
  assert.equal(modelPublications, 1);
  assert.equal(get(editorWorkspace.formModelStateStore).name, "campus-rollout");

  unsubscribeModel();
});

test("successful mounted orchestration draft publishes once when reset changes JSON", async () => {
  createTxJsonEditorsHost();
  const editorWorkspace = createOrchestrationEditorPanelWorkspace({
    onCreateDraft: () => "created",
  });
  let inputNotifications = 0;
  let modelPublications = 0;
  const unsubscribeModel = editorWorkspace.formModelStateStore.subscribe(() => {
    modelPublications += 1;
  });
  modelPublications = 0;
  const jsonWorkspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.orchestration,
    onInput(jsonText) {
      inputNotifications += 1;
      editorWorkspace.handleEditorJsonInput(jsonText);
    },
    value: '{"name":"before-create","stages":[]}',
  });
  const disconnect = jsonWorkspace.connectHost();

  assert.equal(await editorWorkspace.createJsonDraft(), "created");
  assert.equal(inputNotifications, 1);
  assert.equal(modelPublications, 1);

  unsubscribeModel();
  disconnect();
  clearTxJsonEditorsHost();
});

test("successful mounted orchestration draft publishes once when reset JSON is unchanged", async () => {
  createTxJsonEditorsHost();
  const editorWorkspace = createOrchestrationEditorPanelWorkspace({
    onCreateDraft: () => "created",
  });
  let inputNotifications = 0;
  let modelPublications = 0;
  const unsubscribeModel = editorWorkspace.formModelStateStore.subscribe(() => {
    modelPublications += 1;
  });
  modelPublications = 0;
  const jsonWorkspace = createTxJsonEditorWorkspace({
    editorKey: TX_EDITOR.orchestration,
    onInput(jsonText) {
      inputNotifications += 1;
      editorWorkspace.handleEditorJsonInput(jsonText);
    },
    value: get(editorWorkspace.jsonTextStateStore),
  });
  const disconnect = jsonWorkspace.connectHost();

  assert.equal(await editorWorkspace.createJsonDraft(), "created");
  assert.equal(inputNotifications, 0);
  assert.equal(modelPublications, 1);

  unsubscribeModel();
  disconnect();
  clearTxJsonEditorsHost();
});

test("successful orchestration draft publishes a silently changed editor model once", async () => {
  createTxJsonEditorsHost();
  const changedJson = '{"name":"silent-change","stages":[]}';
  const editorWorkspace = createOrchestrationEditorPanelWorkspace({
    onCreateDraft() {
      setTxJsonEditorRawText(TX_EDITOR.orchestration, changedJson, {
        notify: false,
      });
      return "created";
    },
  });
  const publishedNames = [];
  const unsubscribeModel = editorWorkspace.formModelStateStore.subscribe(
    (model) => publishedNames.push(model.name),
  );
  publishedNames.length = 0;

  assert.equal(await editorWorkspace.createJsonDraft(), "created");
  assert.deepEqual(publishedNames, ["campus-rollout", "silent-change"]);
  assert.equal(get(editorWorkspace.formModelStateStore).name, "silent-change");

  unsubscribeModel();
  clearTxJsonEditorsHost();
});

test("orchestration draft refresh clears changed diagnostics without republishing the same model", async () => {
  clearTxJsonEditorsHost();
  let editorWorkspace;
  editorWorkspace = createOrchestrationEditorPanelWorkspace({
    onCreateDraft() {
      editorWorkspace.setFormError("stale diagnostic");
      return "created";
    },
  });
  let modelPublications = 0;
  const unsubscribeModel = editorWorkspace.formModelStateStore.subscribe(() => {
    modelPublications += 1;
  });
  modelPublications = 0;

  assert.equal(await editorWorkspace.createJsonDraft(), "created");
  assert.equal(modelPublications, 1);
  assert.equal(get(editorWorkspace.formErrorStateStore), "");

  unsubscribeModel();
});
