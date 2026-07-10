import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const templatesPagesRoot = path.resolve("frontend/src/pages/templates");
const filesToCheck = [
  "BuiltinFlowTemplatesPanel.svelte",
  "CustomFlowTemplatesPanel.svelte",
  "CustomShowObjectsPanel.svelte",
  "TemplateLibraryPanel.svelte",
  "TextfsmMappingsPanel.svelte",
  "TextfsmTemplateEditorPanel.svelte",
];

test("template panels do not auto-subscribe workspace objects instead of stores", async () => {
  const fileEntries = await Promise.all(
    filesToCheck.map(async (fileName) => ({
      fileName,
      source: await readFile(path.join(templatesPagesRoot, fileName), "utf8"),
    })),
  );

  for (const { fileName, source } of fileEntries) {
    assert.equal(
      /\$[A-Za-z_][A-Za-z0-9_]*Workspace\./.test(source),
      false,
      `${fileName} should subscribe to the inner store, not the workspace object`,
    );
  }
});
