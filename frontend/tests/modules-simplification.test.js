import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

function sourceFiles(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(?:js|svelte)$/.test(entry.name) ? [entryPath] : [];
  });
}

test("modules are grouped into stable domain directories", () => {
  const moduleRoot = "frontend/src/modules";
  const expectedDomains = [
    "command",
    "connections",
    "dashboard",
    "inventory",
    "operations",
    "orchestration",
    "overlays",
    "profiles",
    "standard",
    "tasks",
    "templates",
    "transactions",
  ];
  const entries = readdirSync(moduleRoot, { withFileTypes: true });

  assert.deepEqual(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
    expectedDomains,
  );
  assert.deepEqual(
    entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
    [],
  );
});

test("thin module re-export files stay collapsed into concrete modules", () => {
  const collapsedModules = [
    "frontend/src/modules/connectionPanelWorkspaces.js",
    "frontend/src/modules/connectionsWorkspace.js",
    "frontend/src/modules/connectionsPanels.js",
    "frontend/src/modules/connectionTargetState.js",
    "frontend/src/modules/connectionTargets.js",
    "frontend/src/modules/orchestrationDisplays.js",
    "frontend/src/modules/orchestrationForms.js",
    "frontend/src/modules/orchestrationInventoryState.js",
    "frontend/src/modules/orchestrationFormModels.js",
    "frontend/src/modules/orchestrationResultPresentationState.js",
    "frontend/src/modules/orchestrationStageState.js",
    "frontend/src/modules/orchestrationWorkspace.js",
    "frontend/src/modules/profilePanelWorkspaces.js",
    "frontend/src/modules/promptProfileWorkspace.js",
    "frontend/src/modules/profilesEditor.js",
    "frontend/src/modules/standardExecutions.js",
    "frontend/src/modules/transactionEditorState.js",
    "frontend/src/modules/transactionFormModels.js",
    "frontend/src/modules/transactionPanelWorkspaces.js",
    "frontend/src/modules/transactionsWorkspace.js",
    "frontend/src/modules/templatesFlow.js",
  ];

  for (const modulePath of collapsedModules) {
    assert.equal(existsSync(modulePath), false, modulePath);
  }
});

test("module imports point at concrete implementation files", () => {
  const combinedSource = sourceFiles("frontend/src").map(read).join("\n");
  const collapsedImportPattern =
    /from "\.\/(?:connectionPanelWorkspaces|connectionsPanels|connectionsWorkspace|connectionTargets|connectionTargetState|orchestrationDisplays|orchestrationFormModels|orchestrationForms|orchestrationResultPresentationState|orchestrationStageState|profilePanelWorkspaces|profilesEditor|promptProfileWorkspace|standardExecutions|templatesFlow|transactionEditorState|transactionFormModels|transactionPanelWorkspaces|transactionsWorkspace)\.js"/;

  assert.doesNotMatch(combinedSource, collapsedImportPattern);
});
