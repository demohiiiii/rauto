import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const modulesRoot = path.resolve("frontend/src/modules");
const bindingsPath = path.join(
  modulesRoot,
  "transactionBlockTemplateBindings.js",
);
const displaysPath = path.join(
  modulesRoot,
  "transactionBlockTemplateDisplays.js",
);
const workspacesPath = path.join(
  modulesRoot,
  "transactionBlockTemplateWorkspaces.js",
);
const editorStatePath = path.join(
  modulesRoot,
  "transactionBlockTemplateEditorState.js",
);
const statePath = path.join(modulesRoot, "transactionBlockTemplateState.js");

test("transaction block template modules collapse the extra re-export layers", async () => {
  await assert.rejects(access(bindingsPath));
  await assert.rejects(access(displaysPath));
  await assert.rejects(access(editorStatePath));
  await access(workspacesPath);

  const [workspacesSource, stateSource] = await Promise.all([
    readFile(workspacesPath, "utf8"),
    readFile(statePath, "utf8"),
  ]);

  assert.equal(
    workspacesSource.includes("./transactionBlockTemplateBindings.js") ||
      workspacesSource.includes("./transactionBlockTemplateBindings.js"),
    false,
  );
  assert.equal(
    stateSource.includes("./transactionBlockTemplateEditorState.js") ||
      stateSource.includes("./transactionBlockTemplateEditorState.js"),
    false,
  );
});
