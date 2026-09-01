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
    return /\.(?:js|svelte|ts)$/.test(entry.name) ? [entryPath] : [];
  });
}

test("modules are grouped into stable domain directories", () => {
  const moduleRoot = "frontend/src/modules";
  const expectedDomains = ["orchestration"];
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

test("connection fields and presentation use the typed domain boundary", () => {
  const fieldState = read(
    "frontend/src/domains/connections/application/connectionFieldState.ts",
  );
  const fieldStoreState = read(
    "frontend/src/domains/connections/application/connectionFieldStoreState.ts",
  );
  const presentation = read(
    "frontend/src/domains/connections/presentation/connectionTargetDisplayState.ts",
  );
  const targetState = read(
    "frontend/src/domains/connections/application/connectionTargetStoreState.ts",
  );
  const targetRuntimeState = read(
    "frontend/src/domains/connections/application/connectionTargetRuntimeState.ts",
  );
  const targetPersistence = read(
    "frontend/src/domains/connections/infrastructure/connectionTargetPersistence.ts",
  );
  const historyState = read(
    "frontend/src/domains/connections/application/connectionsHistory.ts",
  );
  const connectionApi = read(
    "frontend/src/domains/connections/infrastructure/connectionApi.ts",
  );
  const historyPersistence = read(
    "frontend/src/domains/connections/infrastructure/connectionHistoryPersistence.ts",
  );
  const panelState = read(
    "frontend/src/domains/connections/application/connectionPanelState.ts",
  );
  const panelFormState = read(
    "frontend/src/domains/connections/application/connectionPanelFormState.ts",
  );
  const editorState = read(
    "frontend/src/domains/connections/application/connectionEditorState.ts",
  );
  const viteConfig = read("vite.config.js");

  assert.doesNotMatch(fieldState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(fieldStoreState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(presentation, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(targetState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(targetState, /lib\/browser\.js/);
  assert.doesNotMatch(targetRuntimeState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(
    targetRuntimeState,
    /api\/client\.js|modules\/connections/,
  );
  assert.match(targetPersistence, /lib\/browser\.js/);
  assert.doesNotMatch(historyState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(historyState, /api\/client\.js|lib\/browser\.js/);
  assert.match(connectionApi, /api\/client\.js/);
  assert.match(historyPersistence, /lib\/browser\.js/);
  assert.doesNotMatch(panelState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(panelState, /modules\/connections/);
  assert.doesNotMatch(panelFormState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(panelFormState, /modules\/connections/);
  assert.doesNotMatch(editorState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(editorState, /api\/client\.js|modules\/connections/);
  assert.match(viteConfig, /domains\/connections\/.*dashboard-connections/s);
});

test("thin module re-export files stay collapsed into concrete modules", () => {
  const collapsedModules = [
    "frontend/src/modules/command/commandFlowAccentState.js",
    "frontend/src/modules/command/commandFlowDraftState.js",
    "frontend/src/modules/command/commandFlowReadonlyState.js",
    "frontend/src/modules/command/commandFlowTemplateModel.js",
    "frontend/src/modules/command/commandTemplateCatalog.js",
    "frontend/src/modules/standard/standardCommandExecutionWorkspace.js",
    "frontend/src/modules/standard/standardCommandFlowAuthoringState.js",
    "frontend/src/modules/standard/standardExecutionState.js",
    "frontend/src/modules/standard/standardExecutionWorkspaces.js",
    "frontend/src/modules/standard/batchExecState.js",
    "frontend/src/modules/standard/batchFlowState.js",
    "frontend/src/modules/operations/results.js",
    "frontend/src/modules/operations/sessionRetry.js",
    "frontend/src/modules/templates/templateManagerState.js",
    "frontend/src/modules/templates/templatesFlowDisplayState.js",
    "frontend/src/modules/templates/templatesFlowRuntimeState.js",
    "frontend/src/modules/templates/templatesShowObjects.js",
    "frontend/src/config/dashboardNavigation.js",
    "frontend/src/modules/dashboard/themeSystem.js",
    "frontend/src/modules/dashboard/dashboardOverlays.js",
    "frontend/src/modules/dashboard/dashboardApp.js",
    "frontend/src/modules/dashboard/dashboardAppState.js",
    "frontend/src/modules/dashboard/dashboardShell.js",
    "frontend/src/modules/overlays/overlays.js",
    "frontend/src/modules/overlays/overlaysToastState.js",
    "frontend/src/modules/overlays/overlaysDetail.js",
    "frontend/src/modules/overlays/overlaysDrawerState.js",
    "frontend/src/modules/connectionPanelWorkspaces.js",
    "frontend/src/modules/connections/connectionFields.js",
    "frontend/src/modules/connections/connectionFieldState.js",
    "frontend/src/modules/connections/connectionFieldStoreState.js",
    "frontend/src/modules/connections/connectionPanelState.js",
    "frontend/src/modules/connections/connectionPanelFormState.js",
    "frontend/src/modules/connections/connectionTargetDisplayState.js",
    "frontend/src/modules/connections/connectionTargetStoreState.js",
    "frontend/src/modules/connections/connectionTargetRuntimeState.js",
    "frontend/src/modules/connections/connectionsHistory.js",
    "frontend/src/modules/connections/connectionsEditor.js",
    "frontend/src/modules/connections/connections.js",
    "frontend/src/domains/connections/infrastructure/connectionPanelRuntime.ts",
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
    "frontend/src/modules/profiles/profilePanelChildWorkspaces.js",
    "frontend/src/modules/profiles/profilePanelState.js",
    "frontend/src/modules/profiles/profiles.js",
    "frontend/src/modules/profiles/profileModeExpressions.js",
    "frontend/src/modules/profiles/profilesDiagnostics.js",
    "frontend/src/modules/profiles/profilesEditorState.js",
    "frontend/src/modules/profiles/profilesCustomEditorState.js",
    "frontend/src/modules/profiles/profilesCustomFormState.js",
    "frontend/src/modules/profiles/profilesListState.js",
    "frontend/src/modules/profiles/promptProfileState.js",
    "frontend/src/modules/profiles/promptProfileExecutionState.js",
    "frontend/src/modules/promptProfileWorkspace.js",
    "frontend/src/modules/profilesEditor.js",
    "frontend/src/modules/standard/standard.js",
    "frontend/src/modules/templates/templates.js",
    "frontend/src/modules/standardExecutions.js",
    "frontend/src/modules/transactionEditorState.js",
    "frontend/src/modules/transactionFormModels.js",
    "frontend/src/modules/transactionPanelWorkspaces.js",
    "frontend/src/modules/transactionsWorkspace.js",
    "frontend/src/modules/transactions/transactionMetadataFields.js",
    "frontend/src/modules/transactions/transactionBlockFormModels.js",
    "frontend/src/modules/transactions/transactionBlockMutations.js",
    "frontend/src/modules/transactions/transactionEditorSession.js",
    "frontend/src/modules/transactions/transactionJsonEditorState.js",
    "frontend/src/modules/transactions/transactionJsonTemplateState.js",
    "frontend/src/modules/transactions/transactionWorkflowEditors.js",
    "frontend/src/modules/transactions/transactionWorkflowEditorState.js",
    "frontend/src/modules/transactions/transactionBlockDisplayState.js",
    "frontend/src/modules/transactions/transactionBlockBindingState.js",
    "frontend/src/modules/transactions/transactionBlockDisplays.js",
    "frontend/src/modules/transactions/transactionInputState.js",
    "frontend/src/modules/transactions/transactionInputWorkspaces.js",
    "frontend/src/modules/transactions/transactionVarsAssistant.js",
    "frontend/src/modules/transactions/transactionPanelState.js",
    "frontend/src/modules/transactions/transactionExecutionDisplays.js",
    "frontend/src/modules/transactions/transactionProfileModes.js",
    "frontend/src/modules/transactions/transactionStructure.js",
    "frontend/src/modules/transactions/transactionWorkflowFormModels.js",
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
    "frontend/src/domains/standard/application/standardCommandFlowExecutionState.ts":
      [
        "prepareCommandFlowOnActive",
        "refreshCommandFlowLanguageFields",
        "selectCommandFlowTemplate",
        "setCommandFlowFields",
      ],
    "frontend/src/domains/templates/presentation/flowVarsPresentation.ts": [
      "builtinFlowTemplatePanelDisplay",
      "customFlowTemplatePanelDisplay",
    ],
    "frontend/src/domains/templates/application/flowTemplateRuntime.ts": [
      "getLastFlowRunTemplateDetail",
      "setRunFlowTemplateSelectValue",
    ],
    "frontend/src/domains/transactions/presentation/transactionBlockDisplayState.ts":
      ["txBlockFlowMetadataFieldRows"],
    "frontend/src/domains/transactions/application/transactionBlockDisplays.ts":
      ["txBlockVisualEditorCoverage"],
    "frontend/src/domains/transactions/application/transactionBlockBindingState.ts":
      [
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
    "frontend/src/domains/transactions/model/transactionBlockMutations.ts": [
      "txBlockNullableTextValue",
      "txBlockSetCommandInteractionPresence",
      "txBlockSetCommandInteractionPromptsPresence",
      "txInteractionExtraSource",
    ],
    "frontend/src/domains/transactions/application/transactionInputState.ts": [
      "txWorkflowTemplateVarsPlaceholder",
    ],
    "frontend/src/domains/transactions/model/transactionStructure.ts": [
      "TX_WORKFLOW_INLINE_BLOCK_METADATA_FIELD_DEFS",
      "TX_WORKFLOW_ROOT_METADATA_FIELD_DEFS",
      "TX_WORKFLOW_TEMPLATE_REF_METADATA_FIELD_DEFS",
      "txBlockFlowMetadataFieldDefs",
      "txBlockFlowStepMetadataFieldDefs",
      "txBlockJsonStructureMapping",
      "txWorkflowInlineCommandMetadataFieldDefs",
      "txWorkflowJsonStructureMapping",
    ],
    "frontend/src/domains/transactions/application/transactionWorkflowEditorState.ts":
      [
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
    "frontend/src/domains/transactions/application/transactionWorkflowEditors.ts":
      ["rootMetadataFieldRowsStateStore", "rootMetadataSourceStateStore"],
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

test("transaction foundations use the typed domain boundary", () => {
  const blockFormModels = read(
    "frontend/src/domains/transactions/model/transactionBlockFormModels.ts",
  );
  const blockMutations = read(
    "frontend/src/domains/transactions/model/transactionBlockMutations.ts",
  );
  const metadataFields = read(
    "frontend/src/domains/transactions/model/transactionMetadataFields.ts",
  );
  const editorSession = read(
    "frontend/src/domains/transactions/application/transactionEditorSession.ts",
  );
  const jsonEditorState = read(
    "frontend/src/domains/transactions/application/transactionJsonEditorState.ts",
  );
  const jsonTemplateState = read(
    "frontend/src/domains/transactions/application/transactionJsonTemplateState.ts",
  );
  const jsonTemplateRuntime = read(
    "frontend/src/domains/transactions/infrastructure/transactionJsonTemplateRuntime.ts",
  );
  const profileModes = read(
    "frontend/src/domains/transactions/application/transactionProfileModes.ts",
  );
  const profileModeRuntime = read(
    "frontend/src/domains/transactions/infrastructure/transactionProfileModeRuntime.ts",
  );
  const workflowFormModels = read(
    "frontend/src/domains/transactions/model/transactionWorkflowFormModels.ts",
  );
  const workflowEditors = read(
    "frontend/src/domains/transactions/application/transactionWorkflowEditors.ts",
  );
  const workflowEditorState = read(
    "frontend/src/domains/transactions/application/transactionWorkflowEditorState.ts",
  );
  const blockDisplayState = read(
    "frontend/src/domains/transactions/presentation/transactionBlockDisplayState.ts",
  );
  const blockBindingState = read(
    "frontend/src/domains/transactions/application/transactionBlockBindingState.ts",
  );
  const blockDisplays = read(
    "frontend/src/domains/transactions/application/transactionBlockDisplays.ts",
  );
  const blockRuntime = read(
    "frontend/src/domains/transactions/infrastructure/transactionBlockRuntime.ts",
  );
  const inputState = read(
    "frontend/src/domains/transactions/application/transactionInputState.ts",
  );
  const inputWorkspaces = read(
    "frontend/src/domains/transactions/application/transactionInputWorkspaces.ts",
  );
  const varsAssistant = read(
    "frontend/src/domains/transactions/application/transactionVarsAssistant.ts",
  );
  const panelState = read(
    "frontend/src/domains/transactions/application/transactionPanelState.ts",
  );
  const executionDisplays = read(
    "frontend/src/domains/transactions/presentation/transactionExecutionDisplays.ts",
  );

  assert.doesNotMatch(blockFormModels, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(blockMutations, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(editorSession, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(jsonEditorState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(jsonTemplateState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(jsonTemplateState, /api\/client\.js|lib\/ui\.js/);
  assert.match(jsonTemplateRuntime, /api\/client\.js|lib\/ui\.js/);
  assert.doesNotMatch(metadataFields, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(profileModes, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(profileModes, /api\/client\.js|modules\/transactions/);
  assert.match(profileModeRuntime, /api\/client\.js/);
  assert.doesNotMatch(workflowFormModels, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(workflowEditors, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(workflowEditors, /api\/client\.js/);
  assert.doesNotMatch(workflowEditorState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(workflowEditorState, /api\/client\.js/);
  assert.doesNotMatch(blockDisplayState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(blockDisplayState, /api\/client\.js/);
  assert.doesNotMatch(blockBindingState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(blockBindingState, /api\/client\.js/);
  assert.doesNotMatch(blockDisplays, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(blockDisplays, /api\/client\.js|lib\/browser\.js/);
  assert.match(blockRuntime, /api\/client\.js|lib\/browser\.js/);
  assert.doesNotMatch(inputState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(inputState, /api\/client\.js|lib\/browser\.js/);
  assert.doesNotMatch(inputWorkspaces, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(inputWorkspaces, /api\/client\.js|lib\/browser\.js/);
  assert.doesNotMatch(varsAssistant, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(varsAssistant, /api\/client\.js|lib\/browser\.js/);
  assert.doesNotMatch(panelState, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(panelState, /api\/client\.js|lib\/browser\.js/);
  assert.doesNotMatch(executionDisplays, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(
    executionDisplays,
    /api\/client\.js|lib\/browser\.js|modules\/transactions/,
  );
  assert.doesNotMatch(
    `${blockFormModels}\n${blockMutations}\n${editorSession}\n${jsonEditorState}\n${jsonTemplateState}\n${workflowFormModels}`,
    /modules\/transactions|api\/client\.js/,
  );
});

test("transaction workspace modules do not re-export implementation state", () => {
  const workspaceModules = [
    "frontend/src/domains/transactions/application/transactionBlockDisplays.ts",
    "frontend/src/domains/transactions/application/transactionInputWorkspaces.ts",
    "frontend/src/domains/transactions/application/transactionWorkflowEditors.ts",
    "frontend/src/modules/orchestration/orchestrationFormStructureState.js",
    "frontend/src/modules/orchestration/orchestrationEditorState.js",
    "frontend/src/modules/orchestration/orchestrationFormState.js",
    "frontend/src/modules/orchestration/orchestrationPanelState.js",
    "frontend/src/modules/orchestration/orchestrationResultDisplayState.js",
    "frontend/src/modules/orchestration/orchestrationResultState.js",
    "frontend/src/domains/replay/application/createReplayPageWorkspace.ts",
    "frontend/src/domains/show/application/createShowWorkspaces.ts",
    "frontend/src/domains/standard/application/createStandardCommandExecutionWorkspace.ts",
    "frontend/src/domains/standard/application/standardCommandFlowExecutionState.ts",
    "frontend/src/domains/standard/application/createStandardExecutionWorkspaces.ts",
  ];

  for (const modulePath of workspaceModules) {
    assert.doesNotMatch(read(modulePath), /^export (?:\*|\{)/m, modulePath);
  }

  assert.doesNotMatch(
    read("frontend/src/modules/orchestration/orchestrationFormState.js"),
    /^export \{/m,
    "orchestrationFormState.js",
  );
});

test("transaction pages import state-owned helpers directly", () => {
  const directVarsPanel = read(
    "frontend/src/pages/orchestrated/TxDirectVarsPanel.svelte",
  );

  assert.match(
    directVarsPanel,
    /createTxDirectVarsPanelWorkspace \} from "\$domains\/transactions\/index\.js"/,
  );
});
