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
    "frontend/src/modules/connections/connectionFields.js",
    "frontend/src/modules/connectionsWorkspace.js",
    "frontend/src/modules/connectionsPanels.js",
    "frontend/src/modules/connectionTargetState.js",
    "frontend/src/modules/connectionTargets.js",
    "frontend/src/modules/orchestrationDisplays.js",
    "frontend/src/modules/orchestrationForms.js",
    "frontend/src/modules/orchestration/orchestrationFormDisplayState.js",
    "frontend/src/modules/orchestrationInventoryState.js",
    "frontend/src/modules/orchestrationFormModels.js",
    "frontend/src/modules/orchestrationResultPresentationState.js",
    "frontend/src/modules/orchestrationStageState.js",
    "frontend/src/modules/orchestrationWorkspace.js",
    "frontend/src/modules/operations/show.js",
    "frontend/src/modules/profilePanelWorkspaces.js",
    "frontend/src/modules/profiles/profilePanelEditorState.js",
    "frontend/src/modules/profiles/profilePanelState.js",
    "frontend/src/modules/promptProfileWorkspace.js",
    "frontend/src/modules/profilesEditor.js",
    "frontend/src/modules/standard/standard.js",
    "frontend/src/modules/templates/templates.js",
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
    /from "\.\/(?:connectionFields|connectionPanelWorkspaces|connectionsPanels|connectionsWorkspace|connectionTargets|connectionTargetState|orchestrationDisplays|orchestrationFormDisplayState|orchestrationFormModels|orchestrationForms|orchestrationResultPresentationState|orchestrationStageState|profilePanelEditorState|profilePanelWorkspaces|profilesEditor|promptProfileWorkspace|show|standard|standardExecutions|templates|templatesFlow|transactionEditorState|transactionFormModels|transactionPanelWorkspaces|transactionsWorkspace)\.js"/;

  assert.doesNotMatch(combinedSource, collapsedImportPattern);
});

test("obsolete frontend module APIs stay removed", () => {
  const obsoleteExportsByModule = {
    "frontend/src/modules/orchestration/orchestrationFormFieldState.js": [
      "ORCHESTRATION_CONNECTION_NULLABLE_FIELD_KEYS",
      "ORCHESTRATION_JOB_METADATA_FIELD_DEFS",
      "ORCHESTRATION_PLAN_METADATA_FIELD_DEFS",
      "ORCHESTRATION_STAGE_METADATA_FIELD_DEFS",
      "orchestrationFieldEnabled",
      "orchestrationFieldSupportsNullableMode",
      "orchestrationJsonStructureMapping",
      "orchestrationTextListRows",
      "orchestrationObjectEnabled",
      "orchestrationTextListValue",
    ],
    "frontend/src/modules/orchestration/orchestrationFormState.js": [
      "orchestrationExtraStringPresenceChangeHandler",
      "orchestrationExtraStringValueChangeHandler",
      "orchestrationPatchPresenceChangeHandler",
    ],
    "frontend/src/modules/orchestration/orchestrationPlanFormModels.js": [
      "orchestrationDefaultPlanJson",
    ],
    "frontend/src/modules/orchestration/orchestrationTargetFormModels.js": [
      "orchestrationJsonObjectPatchResult",
      "orchestrationNullableFieldModePatch",
      "orchestrationNullableTextValue",
      "orchestrationToggleNullableFieldPresence",
      "orchestrationToggleObjectFieldPresence",
    ],
    "frontend/src/modules/orchestration/orchestrationStageMutations.js": [
      "orchestrationAddJobStringListItem",
      "orchestrationRemoveJobStringListItem",
      "orchestrationSetJobFieldPresence",
      "orchestrationSetJobListPresence",
      "orchestrationSetRootFieldPresence",
      "orchestrationSetStageFieldPresence",
      "orchestrationUpdateJobStringListItem",
    ],
    "frontend/src/modules/standard/standardExecutionState.js": [
      "prepareCommandFlowOnActive",
      "refreshCommandFlowLanguageFields",
      "selectCommandFlowTemplate",
      "setCommandFlowFields",
    ],
    "frontend/src/modules/templates/templatesFlowDisplayState.js": [
      "builtinFlowTemplatePanelDisplay",
      "customFlowTemplatePanelDisplay",
    ],
    "frontend/src/modules/templates/templatesFlowRuntimeState.js": [
      "getLastFlowRunTemplateDetail",
      "setRunFlowTemplateSelectValue",
    ],
    "frontend/src/modules/transactions/transactionBlockDisplayState.js": [
      "txBlockFlowMetadataFieldRows",
    ],
    "frontend/src/modules/transactions/transactionBlockDisplays.js": [
      "txBlockVisualEditorCoverage",
    ],
    "frontend/src/modules/transactions/transactionBlockBindingState.js": [
      "interactionMetadataPresenceHandler",
      "interactionMetadataValueHandler",
      "promptEditorBindings",
      "promptExtraChangeHandler",
      "promptMetadataPresenceHandler",
      "promptMetadataValueHandler",
      "promptPresenceHandler",
      "promptRecordHandler",
      "promptTextHandler",
      "setInteractionMetadataPresence",
      "setInteractionMetadataValue",
      "setPromptMetadataPresence",
      "setPromptMetadataValue",
    ],
    "frontend/src/modules/transactions/transactionBlockMutations.js": [
      "txBlockNullableTextValue",
      "txBlockSetCommandInteractionPresence",
      "txBlockSetCommandInteractionPromptsPresence",
      "txInteractionExtraSource",
    ],
    "frontend/src/modules/transactions/transactionInputState.js": [
      "txWorkflowTemplateVarsPlaceholder",
    ],
    "frontend/src/modules/transactions/transactionStructure.js": [
      "TX_WORKFLOW_INLINE_BLOCK_METADATA_FIELD_DEFS",
      "TX_WORKFLOW_ROOT_METADATA_FIELD_DEFS",
      "TX_WORKFLOW_TEMPLATE_REF_METADATA_FIELD_DEFS",
      "txBlockFlowMetadataFieldDefs",
      "txBlockFlowStepMetadataFieldDefs",
      "txBlockJsonStructureMapping",
      "txWorkflowInlineCommandMetadataFieldDefs",
      "txWorkflowJsonStructureMapping",
    ],
    "frontend/src/modules/transactions/transactionWorkflowEditorState.js": [
      "blockMetadataPresenceHandler",
      "blockMetadataValueHandler",
      "extraPresenceHandler",
      "extraValueHandler",
      "metadataFieldRows",
      "setBlockMetadataPresence",
      "setBlockMetadataValue",
      "setMetadataPresence",
      "setMetadataValue",
      "setRootExtra",
      "txWorkflowPatchBlockMetadata",
      "txWorkflowSetBlockMetadataPresence",
      "txWorkflowTemplateRefBindings",
      "txWorkflowVisualEditorCoverage",
    ],
    "frontend/src/modules/transactions/transactionWorkflowEditors.js": [
      "rootMetadataFieldRowsStateStore",
      "rootMetadataSourceStateStore",
    ],
  };

  for (const [modulePath, obsoleteExports] of Object.entries(
    obsoleteExportsByModule,
  )) {
    const moduleSource = read(modulePath);
    for (const obsoleteExport of obsoleteExports) {
      assert.doesNotMatch(
        moduleSource,
        new RegExp(`\\b${obsoleteExport}\\b`),
        `${modulePath}: ${obsoleteExport}`,
      );
    }
  }
});

test("transaction workspace modules do not re-export implementation state", () => {
  const workspaceModules = [
    "frontend/src/modules/transactions/transactionBlockDisplays.js",
    "frontend/src/modules/transactions/transactionInputWorkspaces.js",
    "frontend/src/modules/transactions/transactionWorkflowEditors.js",
    "frontend/src/modules/orchestration/orchestrationFormStructureState.js",
    "frontend/src/modules/orchestration/orchestrationEditorState.js",
    "frontend/src/modules/orchestration/orchestrationFormState.js",
    "frontend/src/modules/orchestration/orchestrationPanelState.js",
    "frontend/src/modules/orchestration/orchestrationResultDisplayState.js",
    "frontend/src/modules/orchestration/orchestrationResultState.js",
    "frontend/src/modules/inventory/inventoryCollectionWorkspaces.js",
    "frontend/src/modules/operations/replay.js",
    "frontend/src/modules/operations/showQueryWorkspaces.js",
    "frontend/src/modules/standard/standardCommandExecutionWorkspace.js",
    "frontend/src/modules/standard/standardExecutionWorkspaces.js",
  ];

  for (const modulePath of workspaceModules) {
    assert.doesNotMatch(read(modulePath), /^export (?:\*|\{)/m, modulePath);
  }

  assert.doesNotMatch(
    read("frontend/src/modules/orchestration/orchestrationFormState.js"),
    /^export \{/m,
    "orchestrationFormState.js",
  );

  assert.doesNotMatch(
    read("frontend/src/modules/profiles/profiles.js"),
    /from "\.\/profilePanelState\.js"/,
    "profiles.js",
  );
});

test("transaction pages import state-owned helpers directly", () => {
  const directVarsPanel = read(
    "frontend/src/pages/orchestrated/TxDirectVarsPanel.svelte",
  );

  assert.match(
    directVarsPanel,
    /createTxDirectVarsPanelWorkspace \} from "\.\.\/\.\.\/modules\/transactions\/transactionInputState\.js"/,
  );
});
