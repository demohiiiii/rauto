import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import {
  MANUAL_COMMAND_SOURCE,
  createCommandTemplateCatalog,
} from "../src/modules/command/commandTemplateCatalog.js";
import { createTxBlockCommandEditorWorkspace } from "../src/modules/transactions/transactionBlockDisplays.js";

test("transaction commands import an editable command template snapshot", async () => {
  const changes = [];
  const catalog = createCommandTemplateCatalog({
    load: async () => [{ name: "show-version" }, { name: "backup" }],
  });
  const workspace = createTxBlockCommandEditorWorkspace({
    command: { command: "", mode: "Enable", timeout: 30 },
    confirmReplace: async () => true,
    onChange: (patch) => changes.push(patch),
    templateApi: {
      getTemplate: async (name) => ({
        name,
        content: "show version {{detail}}",
      }),
    },
    templateCatalog: catalog,
  });

  assert.equal(await workspace.initializeCommandTemplates(), true);
  assert.deepEqual(
    get(workspace.commandTemplateSourceStateStore).optionValues,
    ["show-version", "backup"],
  );
  assert.equal(await workspace.selectCommandTemplate("show-version"), true);
  assert.deepEqual(changes, [{ command: "show version {{detail}}" }]);
  assert.equal(
    get(workspace.commandTemplateSourceStateStore).selection,
    "show-version",
  );
  assert.equal(get(workspace.commandTemplateSourceStateStore).dirty, false);
  workspace.destroy();
});

test("transaction template import respects dirty replacement cancellation", async () => {
  let templateLoads = 0;
  const workspace = createTxBlockCommandEditorWorkspace({
    command: { command: "show clock", mode: "Enable" },
    confirmReplace: async () => false,
    templateApi: {
      getTemplate: async () => {
        templateLoads += 1;
        return { content: "show version" };
      },
    },
    templateCatalog: createCommandTemplateCatalog({ load: async () => [] }),
  });

  assert.equal(await workspace.selectCommandTemplate("show-version"), false);
  assert.equal(templateLoads, 0);
  assert.equal(
    get(workspace.commandTemplateSourceStateStore).selection,
    MANUAL_COMMAND_SOURCE,
  );
  workspace.destroy();
});

test("switching an imported transaction command back to manual clears its snapshot", async () => {
  const changes = [];
  const workspace = createTxBlockCommandEditorWorkspace({
    command: { command: "" },
    confirmReplace: async () => true,
    onChange: (patch) => changes.push(patch),
    templateApi: {
      getTemplate: async () => ({ content: "show version" }),
    },
    templateCatalog: createCommandTemplateCatalog({ load: async () => [] }),
  });

  await workspace.selectCommandTemplate("show-version");
  assert.equal(
    await workspace.selectCommandTemplate(MANUAL_COMMAND_SOURCE),
    true,
  );
  assert.deepEqual(changes, [{ command: "show version" }, { command: "" }]);
  workspace.destroy();
});
