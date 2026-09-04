<script lang="ts">
  import { tick } from "svelte";
  import { listInventoryGroups, listInventoryLabels } from "$api/client.js";
  import { browserConfirm } from "$lib/browser.js";
  import { t } from "$lib/i18n.js";
  import {
    createOrchestrationEditorPanelWorkspace,
    orchestrationJsonPlaceholder,
  } from "$domains/orchestration/index.js";
  import { orchestrationPlanFormModelFromJsonText } from "$domains/orchestration/index.js";
  import { setConnectionInventorySnapshots } from "$domains/connections/index.js";
  import { createOrchestrationTemplateWorkspace } from "$domains/orchestration/index.js";
  import OrchestrationEditorSurface from "$domains/orchestration/presentation/components/editor/OrchestrationEditorSurface.svelte";

  import type {
    OrchestrationEditorActionContext,
    OrchestrationEditorTextFile,
    OrchestrationPlanFormModel,
    OrchestrationRunButtonDisplay,
    OrchestrationTemplateReplacementReason,
    orchestrationExecutionPanelDisplay,
  } from "$domains/orchestration/index.js";

  type ExecutionPanelDisplay = ReturnType<
    typeof orchestrationExecutionPanelDisplay
  >;

  interface Props {
    active?: boolean;
    editorSyncVersion?: number;
    executionPanelDisplay: ExecutionPanelDisplay;
    onEditorInput?: (text: string) => void;
    onExecute?: () => Promise<void> | void;
    onImportFile?: (
      file: OrchestrationEditorTextFile,
      actionContext: OrchestrationEditorActionContext,
    ) => Promise<void> | void;
    orchestrationEditorRunButtonDisplay: OrchestrationRunButtonDisplay;
  }

  let {
    active,
    onEditorInput,
    onExecute,
    onImportFile,
    orchestrationEditorRunButtonDisplay,
    editorSyncVersion = 0,
    executionPanelDisplay,
  }: Props = $props();

  const orchestrationEditorWorkspace =
    createOrchestrationEditorPanelWorkspace();
  const {
    changeFormModel,
    createJsonDraft,
    editorDisplayStateStore,
    ensureInitialized,
    formErrorStateStore,
    formModelStateStore,
    handleEditorJsonInput,
    importFile,
    jsonTextStateStore,
    setEditorPanelContext,
    setFormError,
    visualDisplayStateStore,
  } = orchestrationEditorWorkspace;
  let editorDisplay = $derived($editorDisplayStateStore);
  let orchestrationFormModel = $derived($formModelStateStore);
  let orchestrationFormError = $derived($formErrorStateStore);
  let orchestrationJsonText = $derived($jsonTextStateStore);
  let visualDisplay = $derived($visualDisplayStateStore);
  let templateInitialized = false;
  let targetOptionsInitialized = false;

  async function initializeTargetOptions(): Promise<void> {
    const [groups, labels] = await Promise.all([
      listInventoryGroups().catch(() => []),
      listInventoryLabels().catch(() => []),
    ]);
    setConnectionInventorySnapshots({
      groups: Array.isArray(groups) ? groups : [],
      labels: Array.isArray(labels) ? labels : [],
    });
  }

  function confirmTemplateReplacement({
    reason,
  }: {
    reason?: OrchestrationTemplateReplacementReason;
  } = {}): boolean {
    return browserConfirm(
      t(
        reason === "delete"
          ? "orchestrationTemplateDeleteConfirm"
          : "orchestrationDiscardChangesConfirm",
      ),
    );
  }

  function changeCurrentFormModel(
    nextModel: OrchestrationPlanFormModel,
    options?: { notify?: boolean },
  ): void {
    changeFormModel(nextModel, options);
    orchestrationTemplateWorkspace.markEdited();
  }

  function handleCurrentEditorInput(jsonText: string): void {
    handleEditorJsonInput(jsonText);
    orchestrationTemplateWorkspace.markEdited();
  }

  function replaceTemplateJson(jsonText: string): void {
    const parsed = orchestrationPlanFormModelFromJsonText(jsonText);
    if (parsed.error || !parsed.model) {
      throw new Error(parsed.error || t("orchestrationJsonRequired"));
    }
    handleCurrentEditorInput(jsonText);
  }

  const orchestrationTemplateWorkspace = createOrchestrationTemplateWorkspace({
    confirmReplace: confirmTemplateReplacement,
    createDraft: createJsonDraft,
    getCurrentJson: () => orchestrationJsonText,
    replaceJson: replaceTemplateJson,
  });
  const {
    adoptManualSnapshot,
    changeNameDialogValue,
    closeNameDialog,
    displayStateStore: templateDisplayStateStore,
    initialize: initializeTemplates,
    openNewDialog,
    openSaveAsDialog,
    saveTemplate,
    selectTemplate,
    submitNameDialog,
  } = orchestrationTemplateWorkspace;
  let templateDisplay = $derived($templateDisplayStateStore);

  async function importManualFile(
    file: OrchestrationEditorTextFile,
  ): Promise<boolean | void> {
    if (
      templateDisplay.dirty &&
      !browserConfirm(t("orchestrationDiscardChangesConfirm"))
    ) {
      return false;
    }
    await importFile(file);
    await tick();
    adoptManualSnapshot({ statusKind: "imported" });
  }

  $effect(() => {
    setEditorPanelContext({
      editorSyncVersion,
      jsonPlaceholder: orchestrationJsonPlaceholder,
      onCreateDraft: null,
      onEditorInput,
      onImportFile,
    });
    ensureInitialized();
  });

  $effect(() => {
    if (!active || templateInitialized) return;
    templateInitialized = true;
    void initializeTemplates();
  });

  $effect(() => {
    if (!active || targetOptionsInitialized) return;
    targetOptionsInitialized = true;
    void initializeTargetOptions();
  });
</script>

<OrchestrationEditorSurface
  {active}
  {editorDisplay}
  editorValue={orchestrationJsonText}
  {orchestrationFormError}
  {orchestrationFormModel}
  {visualDisplay}
  onFormChange={changeCurrentFormModel}
  onEditorErrorChange={setFormError}
  onEditorInput={handleCurrentEditorInput}
  {onExecute}
  onImportFile={importManualFile}
  {templateDisplay}
  onTemplateChange={selectTemplate}
  {openNewDialog}
  {saveTemplate}
  {openSaveAsDialog}
  {changeNameDialogValue}
  {closeNameDialog}
  {submitNameDialog}
  runButtonDisplay={orchestrationEditorRunButtonDisplay}
  {executionPanelDisplay}
/>
