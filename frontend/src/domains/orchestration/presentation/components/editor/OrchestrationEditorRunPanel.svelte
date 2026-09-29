<script lang="ts">
  import { onDestroy } from "svelte";
  import { get } from "svelte/store";
  import { listInventoryGroups, listInventoryLabels } from "$api/client.js";
  import { browserConfirm } from "$lib/browser.js";
  import { t } from "$lib/i18n.js";
  import {
    createOrchestrationEditorPanelWorkspace,
    orchestrationJsonPlaceholder,
  } from "$domains/orchestration/index.js";
  import { orchestrationPlanFormModelFromJsonText } from "$domains/orchestration/index.js";
  import { setConnectionInventorySnapshots } from "$domains/connections/index.js";
  import { createExecutionTemplateWorkspace } from "$domains/templates/index.js";
  import OrchestrationEditorSurface from "$domains/orchestration/presentation/components/editor/OrchestrationEditorSurface.svelte";

  import type {
    OrchestrationEditorTextFile,
    OrchestrationPlanFormModel,
    OrchestrationRunButtonDisplay,
  } from "$domains/orchestration/index.js";

  interface Props {
    active?: boolean;
    editorSyncVersion?: number;
    onEditorInput?: (text: string) => void;
    onExecute?: () => Promise<void> | void;
    orchestrationEditorRunButtonDisplay: OrchestrationRunButtonDisplay;
  }

  let {
    active,
    onEditorInput,
    onExecute,
    orchestrationEditorRunButtonDisplay,
    editorSyncVersion = 0,
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

  function changeCurrentFormModel(
    nextModel: OrchestrationPlanFormModel,
    options?: { notify?: boolean },
  ): void {
    if (!orchestrationTemplateWorkspace.canEdit()) return;
    changeFormModel(nextModel, options);
    orchestrationTemplateWorkspace.markEdited();
  }

  function handleCurrentEditorInput(jsonText: string): void {
    if (!orchestrationTemplateWorkspace.canEdit()) return;
    handleEditorJsonInput(jsonText);
    orchestrationTemplateWorkspace.markEdited();
  }

  const orchestrationTemplateWorkspace = createExecutionTemplateWorkspace({
    apiBase: "/api/orchestration-templates",
    confirmReplace: () =>
      browserConfirm(t("orchestrationDiscardChangesConfirm")),
    createDraft: createJsonDraft,
    getCurrentJson: () => get(jsonTextStateStore),
    replaceJson: handleEditorJsonInput,
    validateContent: (text) => {
      const parsed = orchestrationPlanFormModelFromJsonText(text);
      if (parsed.error || !parsed.model)
        throw new Error(parsed.error || t("orchestrationJsonRequired"));
    },
  });
  const {
    changeNameDialogValue,
    closeNameDialog,
    displayStateStore: templateDisplayStateStore,
    initialize: initializeTemplates,
    startEditing,
    copyToManual,
    cancelEditing,
    saveTemplate,
    selectTemplate,
    submitNameDialog,
  } = orchestrationTemplateWorkspace;
  let templateDisplay = $derived($templateDisplayStateStore);

  async function importManualFile(
    file: OrchestrationEditorTextFile,
  ): Promise<boolean> {
    return orchestrationTemplateWorkspace.importContent(() => file.text());
  }

  $effect(() => {
    setEditorPanelContext({
      editorSyncVersion,
      jsonPlaceholder: orchestrationJsonPlaceholder,
      onCreateDraft: null,
      onEditorInput,
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
  onDestroy(orchestrationTemplateWorkspace.destroy);
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
  {startEditing}
  {copyToManual}
  {cancelEditing}
  {saveTemplate}
  {changeNameDialogValue}
  {closeNameDialog}
  {submitNameDialog}
  runButtonDisplay={orchestrationEditorRunButtonDisplay}
/>
