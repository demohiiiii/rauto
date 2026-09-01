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

test("legacy modules root stays removed after domain migration", () => {
  assert.equal(existsSync("frontend/src/modules"), false);
  assert.equal(existsSync("frontend/src/domains/orchestration"), true);
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

test("orchestration models use the typed domain boundary", () => {
  const planModels = read(
    "frontend/src/domains/orchestration/model/orchestrationPlanFormModels.ts",
  );
  const stageMutations = read(
    "frontend/src/domains/orchestration/model/orchestrationStageMutations.ts",
  );
  const targetModels = read(
    "frontend/src/domains/orchestration/model/orchestrationTargetFormModels.ts",
  );
  const formState = read(
    "frontend/src/domains/orchestration/application/orchestrationFormState.ts",
  );
  const editorSourceState = read(
    "frontend/src/domains/orchestration/application/orchestrationEditorSourceState.ts",
  );
  const editorState = read(
    "frontend/src/domains/orchestration/application/orchestrationEditorState.ts",
  );
  const editorDisplay = read(
    "frontend/src/domains/orchestration/presentation/orchestrationEditorDisplayState.ts",
  );
  const executionPayloads = read(
    "frontend/src/domains/orchestration/model/orchestratedExecutionPayloads.ts",
  );
  const executionState = read(
    "frontend/src/domains/orchestration/application/orchestratedExecutionState.ts",
  );
  const orchestratedWorkspace = read(
    "frontend/src/domains/orchestration/application/orchestratedWorkspace.ts",
  );
  const orchestrationPanelState = read(
    "frontend/src/domains/orchestration/application/orchestrationPanelState.ts",
  );
  const orchestrationPanelDisplay = read(
    "frontend/src/domains/orchestration/presentation/orchestrationPanelDisplayState.ts",
  );
  const executionApi = read(
    "frontend/src/domains/orchestration/infrastructure/orchestrationExecutionApi.ts",
  );
  const templateWorkspace = read(
    "frontend/src/domains/orchestration/application/createOrchestrationTemplateWorkspace.ts",
  );
  const stageEditorsState = read(
    "frontend/src/domains/orchestration/application/orchestrationStageEditorsState.ts",
  );
  const stageTargetsState = read(
    "frontend/src/domains/orchestration/application/orchestrationStageTargetsState.ts",
  );
  const txWorkflowActionState = read(
    "frontend/src/domains/orchestration/application/orchestrationTxWorkflowActionState.ts",
  );
  const txWorkflowActions = read(
    "frontend/src/domains/orchestration/model/orchestrationTxWorkflowActions.ts",
  );
  const templateApi = read(
    "frontend/src/domains/orchestration/infrastructure/orchestrationTemplateApi.ts",
  );
  const workflowPreviewWorkspace = read(
    "frontend/src/domains/orchestration/application/createOrchestrationWorkflowPreviewWorkspace.ts",
  );
  const actionDisplay = read(
    "frontend/src/domains/orchestration/presentation/orchestrationActionDisplayState.ts",
  );
  const formFields = read(
    "frontend/src/domains/orchestration/presentation/orchestrationFormFieldState.ts",
  );
  const formStructure = read(
    "frontend/src/domains/orchestration/presentation/orchestrationFormStructureState.ts",
  );
  const workflowPreview = read(
    "frontend/src/domains/orchestration/model/orchestrationWorkflowPreview.ts",
  );
  const flowCanvas = read(
    "frontend/src/domains/orchestration/presentation/orchestrationFlowCanvasState.ts",
  );
  const resultPreview = read(
    "frontend/src/domains/orchestration/presentation/orchestrationResultPreviewState.ts",
  );
  const resultDetail = read(
    "frontend/src/domains/orchestration/presentation/orchestrationResultDetailState.ts",
  );
  const resultDisplay = read(
    "frontend/src/domains/orchestration/presentation/orchestrationResultDisplayState.ts",
  );
  const resultState = read(
    "frontend/src/domains/orchestration/application/orchestrationResultState.ts",
  );
  const detailRuntime = read(
    "frontend/src/domains/orchestration/infrastructure/orchestrationDetailRuntime.ts",
  );
  const types = read("frontend/src/domains/orchestration/model/types.ts");
  const domainEntry = read("frontend/src/domains/orchestration/index.ts");
  const viteConfig = read("vite.config.js");

  for (const source of [
    planModels,
    stageMutations,
    targetModels,
    formState,
    workflowPreviewWorkspace,
    actionDisplay,
    editorDisplay,
    executionPayloads,
    orchestrationPanelDisplay,
    formFields,
    formStructure,
    workflowPreview,
    flowCanvas,
    resultPreview,
    resultDetail,
    resultDisplay,
    txWorkflowActions,
    types,
  ]) {
    assert.doesNotMatch(source, /\bany\b|@ts-(?:ignore|nocheck)/);
    assert.doesNotMatch(
      source,
      /api\/client\.js|svelte\/store|lib\/browser\.js/,
    );
  }
  for (const source of [
    editorSourceState,
    editorState,
    executionState,
    orchestratedWorkspace,
    orchestrationPanelState,
    templateWorkspace,
    resultState,
    stageEditorsState,
    stageTargetsState,
    txWorkflowActionState,
  ]) {
    assert.doesNotMatch(source, /\bany\b|@ts-(?:ignore|nocheck)/);
    assert.doesNotMatch(
      source,
      /api\/client\.js|lib\/browser\.js|modules\/orchestration/,
    );
  }
  assert.match(templateApi, /api\/client\.js/);
  assert.match(executionApi, /api\/client\.js/);
  assert.doesNotMatch(executionApi, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(templateApi, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(detailRuntime, /\bany\b|@ts-(?:ignore|nocheck)/);
  assert.doesNotMatch(detailRuntime, /api\/client\.js|lib\/browser\.js/);
  assert.match(domainEntry, /model\/orchestrationPlanFormModels\.js/);
  assert.match(domainEntry, /model\/orchestrationStageMutations\.js/);
  assert.match(domainEntry, /model\/orchestrationTargetFormModels\.js/);
  assert.match(domainEntry, /application\/orchestrationFormState\.js/);
  assert.match(domainEntry, /application\/orchestrationEditorSourceState\.js/);
  assert.match(domainEntry, /application\/orchestrationEditorState\.js/);
  assert.match(domainEntry, /application\/orchestratedExecutionState\.js/);
  assert.match(domainEntry, /application\/orchestratedWorkspace\.js/);
  assert.match(domainEntry, /application\/orchestrationPanelState\.js/);
  assert.match(domainEntry, /presentation\/orchestrationPanelDisplayState\.js/);
  assert.match(domainEntry, /model\/orchestratedExecutionPayloads\.js/);
  assert.match(
    domainEntry,
    /application\/createOrchestrationTemplateWorkspace\.js/,
  );
  assert.match(domainEntry, /application\/orchestrationStageEditorsState\.js/);
  assert.match(domainEntry, /application\/orchestrationStageTargetsState\.js/);
  assert.match(
    domainEntry,
    /application\/orchestrationTxWorkflowActionState\.js/,
  );
  assert.match(
    domainEntry,
    /application\/createOrchestrationWorkflowPreviewWorkspace\.js/,
  );
  assert.match(
    domainEntry,
    /presentation\/orchestrationActionDisplayState\.js/,
  );
  assert.match(domainEntry, /presentation\/orchestrationFormFieldState\.js/);
  assert.match(
    domainEntry,
    /presentation\/orchestrationFormStructureState\.js/,
  );
  assert.match(domainEntry, /model\/orchestrationWorkflowPreview\.js/);
  assert.match(domainEntry, /model\/orchestrationTxWorkflowActions\.js/);
  assert.match(domainEntry, /presentation\/orchestrationFlowCanvasState\.js/);
  assert.match(
    domainEntry,
    /presentation\/orchestrationEditorDisplayState\.js/,
  );
  assert.match(
    domainEntry,
    /presentation\/orchestrationResultPreviewState\.js/,
  );
  assert.match(domainEntry, /presentation\/orchestrationResultDetailState\.js/);
  assert.match(
    domainEntry,
    /presentation\/orchestrationResultDisplayState\.js/,
  );
  assert.match(domainEntry, /application\/orchestrationResultState\.js/);
  assert.match(viteConfig, /domains\/orchestration\/.*feature-orchestrated/s);
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
    "frontend/src/modules/orchestration/orchestrationActionDisplayState.js",
    "frontend/src/modules/orchestration/orchestrationFormFieldState.js",
    "frontend/src/modules/orchestration/orchestrationFormState.js",
    "frontend/src/modules/orchestration/orchestrationFormStructureState.js",
    "frontend/src/modules/orchestration/orchestrationEditorSourceState.js",
    "frontend/src/modules/orchestration/orchestrationEditorState.js",
    "frontend/src/modules/orchestration/orchestratedExecutionState.js",
    "frontend/src/modules/orchestration/orchestratedWorkspace.js",
    "frontend/src/modules/orchestration/orchestrationPanelState.js",
    "frontend/src/modules/orchestration/orchestrationFlowCanvasState.js",
    "frontend/src/modules/orchestration/orchestrationWorkflowPreviewState.js",
    "frontend/src/modules/orchestration/orchestrationPlanFormModels.js",
    "frontend/src/modules/orchestration/orchestrationStageMutations.js",
    "frontend/src/modules/orchestration/orchestrationStageEditorsState.js",
    "frontend/src/modules/orchestration/orchestrationStageTargetsState.js",
    "frontend/src/modules/orchestration/orchestrationTargetFormModels.js",
    "frontend/src/modules/orchestration/orchestrationTxWorkflowActions.js",
    "frontend/src/modules/orchestration/orchestrationTemplateWorkspace.js",
    "frontend/src/modules/orchestration/orchestrationResultPreviewState.js",
    "frontend/src/modules/orchestration/orchestrationResultDetailState.js",
    "frontend/src/modules/orchestration/orchestrationResultDisplayState.js",
    "frontend/src/modules/orchestration/orchestrationResultState.js",
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
    "frontend/src/domains/orchestration/presentation/orchestrationFormFieldState.ts":
      [
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
    "frontend/src/domains/orchestration/application/orchestrationFormState.ts":
      [
        "orchestrationExtraStringPresenceChangeHandler",
        "orchestrationExtraStringValueChangeHandler",
        "orchestrationPatchPresenceChangeHandler",
      ],
    "frontend/src/domains/orchestration/model/orchestrationPlanFormModels.ts": [
      "orchestrationDefaultPlanJson",
    ],
    "frontend/src/domains/orchestration/model/orchestrationTargetFormModels.ts":
      [
        "orchestrationJsonObjectPatchResult",
        "orchestrationNullableFieldModePatch",
        "orchestrationNullableTextValue",
        "orchestrationToggleNullableFieldPresence",
        "orchestrationToggleObjectFieldPresence",
      ],
    "frontend/src/domains/orchestration/model/orchestrationStageMutations.ts": [
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
    "frontend/src/domains/orchestration/presentation/orchestrationFormStructureState.ts",
    "frontend/src/domains/orchestration/application/orchestrationEditorState.ts",
    "frontend/src/domains/orchestration/application/orchestratedWorkspace.ts",
    "frontend/src/domains/orchestration/application/orchestrationFormState.ts",
    "frontend/src/domains/orchestration/application/orchestrationPanelState.ts",
    "frontend/src/domains/orchestration/presentation/orchestrationResultDisplayState.ts",
    "frontend/src/domains/orchestration/application/orchestrationResultState.ts",
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
    read(
      "frontend/src/domains/orchestration/application/orchestrationFormState.ts",
    ),
    /^export \{/m,
    "orchestrationFormState.ts",
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
