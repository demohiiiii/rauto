import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import {
  createTransactionBlockTemplateRegistry,
  txWorkflowFormModelFromJson,
  txWorkflowFormModelToJsonText,
  txWorkflowDuplicateBlock,
  txWorkflowMoveBlock,
  txBlockStepDraft,
} from "../src/domains/transactions/index.js";
import type {
  JsonObject,
  TxWorkflowFormModel,
} from "../src/domains/transactions/index.js";

import {
  changeTransactionOperationEditorKind,
  transactionOperationEditorKind,
} from "../src/domains/transactions/model/transactionCommandEditor.js";

const template = {
  name: "base",
  steps: [
    { run: { kind: "command", command: "show {{target}}", mode: "User" } },
  ],
  fail_fast: true,
};
function harness(blocks: JsonObject[] = [{ name: "manual", steps: [] }]) {
  let model = txWorkflowFormModelFromJson({ name: "workflow", blocks });
  let unlocked = true;
  let failSave = false;
  let loadTemplate = async (name: string) => ({
    name,
    content: JSON.stringify(template),
  });
  const writes: Array<{ name: string; content: string; creating: boolean }> =
    [];
  const registry = createTransactionBlockTemplateRegistry({
    getModel: () => model,
    onChange: (next) => {
      model = next;
      registry.sync(next);
    },
    canModify: () => unlocked,
    templateOptions: {
      listTemplateResource: async () => [{ name: "base" }],
      getTemplateResource: (_, name) => loadTemplate(name),
      createTemplateResource: async (_, name, content) => {
        if (failSave) throw new Error("save failed");
        writes.push({ name, content, creating: true });
        return { name, content };
      },
      updateTemplateResource: async (_, name, content) => {
        if (failSave) throw new Error("save failed");
        writes.push({ name, content, creating: false });
        return { name, content };
      },
    },
  });
  return {
    registry,
    writes,
    model: () => model,
    replace: (next: TxWorkflowFormModel) => {
      model = next;
      registry.sync(model);
    },
    workspace: (index = 0) => registry.getWorkspace(model.blocks[index]),
    lock: () => {
      unlocked = false;
    },
    failSave: () => {
      failSave = true;
    },
    loadWith: (load: typeof loadTemplate) => {
      loadTemplate = load;
    },
    json: () => JSON.parse(txWorkflowFormModelToJsonText(model)),
  };
}

test("block templates select readonly, keep variables editable, edit execution content and cancel", async () => {
  const h = harness();
  const w = h.workspace();
  await w.initialize();
  await w.selectTemplate("base");
  assert.equal(get(w.displayStateStore).readonly, true);
  assert.equal(h.json().blocks[0].tx_block_template_name, "base");
  w.changeVariables({ target: "version" });
  w.changeJson('{"name":"forbidden","steps":[]}');
  assert.equal(get(w.formStateStore).formModel?.name, "base");
  w.startEditing();
  w.changeJson('{"name":"edited","steps":[]}');
  assert.equal(h.json().blocks[0].tx_block_template_name, undefined);
  assert.equal(
    JSON.parse(h.json().blocks[0].tx_block_template_content).name,
    "edited",
  );
  assert.equal(await w.cancelEditing(), true);
  assert.equal(h.json().blocks[0].tx_block_template_name, "base");
  assert.equal(h.json().blocks[0].tx_block_template_content, undefined);
  assert.deepEqual(h.json().blocks[0].tx_block_template_vars, {
    target: "version",
  });
  assert.equal(get(w.formStateStore).formModel?.name, "base");
  assert.equal(h.writes.length, 0);
  h.registry.destroy();
});

test("manual save creates, editing updates, and copying creates a separate block template", async () => {
  const h = harness();
  const w = h.workspace();
  await w.initialize();
  await w.saveTemplate();
  w.changeNameDialogValue("created");
  assert.equal(await w.submitNameDialog(), true);
  assert.equal(get(w.displayStateStore).readonly, true);
  w.startEditing();
  w.changeJson('{"name":"updated","steps":[]}');
  assert.equal(await w.saveTemplate(), true);
  w.copyToManual();
  assert.equal(get(w.displayStateStore).selectedName, "");
  assert.equal(get(w.formStateStore).formModel?.name, "updated");
  await w.saveTemplate();
  w.changeNameDialogValue("copy");
  assert.equal(await w.submitNameDialog(), true);
  assert.deepEqual(
    h.writes.map(({ name, creating }) => ({ name, creating })),
    [
      { name: "created", creating: true },
      { name: "created", creating: false },
      { name: "copy", creating: true },
    ],
  );
  assert.equal(h.json().blocks[0].tx_block_template_name, "copy");
  await w.selectTemplate("");
  assert.equal(h.model().blocks[0].sourceKind, "inline");
  assert.equal(get(w.displayStateStore).readonly, false);
  h.registry.destroy();
});

test("opening existing references loads a readonly editor without rewriting the workflow", async () => {
  const h = harness([
    {
      tx_block_template_name: "base",
      tx_block_template_vars: { target: "clock" },
      name: "override",
      fail_fast: false,
    },
  ]);
  const original = h.json();
  const w = h.workspace();
  assert.equal(get(w.displayStateStore).readonly, true);
  await w.initialize();
  assert.equal(get(w.formStateStore).formModel?.name, "base");
  assert.deepEqual(h.json(), original);
  w.copyToManual();
  assert.deepEqual(h.json().blocks[0].tx_block_template_vars, {
    target: "clock",
  });
  assert.equal(h.json().blocks[0].name, "override");
  assert.equal(h.json().blocks[0].fail_fast, false);
  assert.ok(
    h.json().blocks[0].tx_block_template_content.includes("{{target}}"),
  );
  h.registry.destroy();
});

test("template drafts survive panel remounts and reordering without leaking into duplicated blocks", async () => {
  const h = harness([
    { name: "first", steps: [] },
    { name: "second", steps: [] },
  ]);
  const w = h.workspace();
  await w.initialize();
  await w.selectTemplate("base");
  w.startEditing();
  w.changeJson('{"name":"unsaved","steps":[]}');
  assert.equal(h.workspace(), w);
  h.replace(txWorkflowMoveBlock(h.model(), 0, 1) as TxWorkflowFormModel);
  assert.equal(h.workspace(1), w);
  assert.equal(get(w.displayStateStore).editing, true);
  h.replace(txWorkflowDuplicateBlock(h.model(), 1) as TxWorkflowFormModel);
  assert.notEqual(h.model().blocks[1].editorId, h.model().blocks[2].editorId);
  assert.notEqual(h.workspace(2), w);
  await w.cancelEditing();
  assert.equal(h.json().blocks[1].tx_block_template_name, "base");
  assert.equal(
    JSON.parse(h.json().blocks[2].tx_block_template_content).name,
    "unsaved",
  );
  assert.equal(JSON.stringify(h.json()).includes("editorId"), false);
  h.registry.destroy();
});

test("failed saves retain the block draft, and parent readonly prevents all mutations", async () => {
  const h = harness();
  const w = h.workspace();
  await w.initialize();
  await w.selectTemplate("base");
  w.startEditing();
  w.changeJson('{"name":"draft","steps":[]}');
  h.failSave();
  assert.equal(await w.saveTemplate(), false);
  assert.equal(get(w.displayStateStore).editing, true);
  assert.equal(get(w.displayStateStore).errorMessage, "save failed");
  const before = h.json();
  h.lock();
  w.changeJson('{"name":"forbidden","steps":[]}');
  w.changeVariables({ secret: "no" });
  assert.equal(await w.cancelEditing(), false);
  assert.equal(await w.selectTemplate(""), false);
  assert.equal(await w.saveTemplate(), false);
  assert.deepEqual(h.json(), before);
  h.registry.destroy();
});

test("late template loads cannot populate a deleted block or replacement workflow", async () => {
  const h = harness();
  const w = h.workspace();
  await w.initialize();
  let resolve!: (detail: { name: string; content: string }) => void;
  h.loadWith(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const pending = w.selectTemplate("base");
  await new Promise((r) => setImmediate(r));
  h.replace(
    txWorkflowFormModelFromJson({
      name: "replacement",
      blocks: [{ name: "untouched", steps: [] }],
    }),
  );
  resolve({ name: "base", content: JSON.stringify(template) });
  assert.equal(await pending, false);
  assert.equal(h.json().blocks[0].name, "untouched");
  h.registry.destroy();
});

test("failed reference hydration cannot overwrite a template with placeholder content and can retry", async () => {
  const h = harness([{ tx_block_template_name: "base" }]);
  h.loadWith(async () => {
    throw new Error("load failed");
  });
  const w = h.workspace();
  assert.equal(await w.initialize(), false);
  assert.equal(get(w.contentReadyStateStore), false);
  w.startEditing();
  w.copyToManual();
  assert.equal(await w.saveTemplate(), false);
  assert.equal(get(w.displayStateStore).readonly, true);
  assert.equal(h.writes.length, 0);
  h.loadWith(async (name) => ({ name, content: JSON.stringify(template) }));
  assert.equal(await w.initialize(), true);
  assert.equal(get(w.contentReadyStateStore), true);
  w.startEditing();
  assert.equal(get(w.displayStateStore).editing, true);
  h.registry.destroy();
});

test("visual edits retain inactive operation drafts while execution JSON only includes the selected kind", async () => {
  const h = harness();
  const w = h.workspace();
  await w.initialize();
  const form = get(w.formStateStore).formModel!;
  const step = txBlockStepDraft();
  step.run.command.command = "plain command";
  step.run.flow.steps[0].command = "interactive command";
  form.steps.push(step);
  w.changeFormModel(form);
  const stored = get(w.formStateStore).formModel!;
  assert.equal(
    stored.steps[0].run.flow.steps[0].command,
    "interactive command",
  );
  assert.equal(
    JSON.parse(get(w.jsonTextStateStore)).steps[0].run.kind,
    "command",
  );
  assert.equal(
    get(w.jsonTextStateStore).includes("interactive command"),
    false,
  );
  form.steps[0].run.flow.steps[0].command = "external mutation";
  assert.equal(
    stored.steps[0].run.flow.steps[0].command,
    "interactive command",
  );
  const next = structuredClone(stored);
  next.steps[0].run.kind = "flow";
  w.changeFormModel(next);
  assert.equal(
    JSON.parse(get(w.jsonTextStateStore)).steps[0].run.steps[0].command,
    "interactive command",
  );
  h.lock();
  next.steps[0].run.flow.steps[0].command = "forbidden";
  w.changeFormModel(next);
  assert.equal(
    JSON.parse(get(w.jsonTextStateStore)).steps[0].run.steps[0].command,
    "interactive command",
  );
  h.registry.destroy();
});

test("block visual authoring keeps an empty interactive editor selected while publishing command JSON", async () => {
  const h = harness();
  const w = h.workspace();
  await w.initialize();
  const form = get(w.formStateStore).formModel!;
  const step = txBlockStepDraft();
  step.run = changeTransactionOperationEditorKind(step.run, "interactive");
  form.steps.push(step);
  w.changeFormModel(form);
  assert.equal(
    transactionOperationEditorKind(
      get(w.formStateStore).formModel!.steps[0].run,
    ),
    "interactive",
  );
  assert.equal(h.workspace(), w);
  assert.equal(h.json().blocks[0].steps[0].run.kind, "command");
  assert.equal(h.json().blocks[0].steps[0].run.steps, undefined);
  h.registry.destroy();
});
