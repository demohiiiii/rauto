<script>
  import { txTemplateModeTabs } from "../../config/dashboardModes.js";
  import TxWorkflowInputPanel from "./TxWorkflowInputPanel.svelte";
  import TxWorkflowRunPanel from "./TxWorkflowRunPanel.svelte";
  import { createTxWorkflowStageWorkspace } from "../../modules/transactionPanelState.js";

  let {
    active,
    onCreateJsonTemplateDraft,
    onDeleteJsonTemplate,
    onDirectMode,
    onTemplateMode,
    onPreview,
    onExecute,
    onImportFile,
    onEditorInput,
    onLoadJsonTemplate,
    onSaveJsonTemplate,
  } = $props();
  const txWorkflowStageWorkspace = createTxWorkflowStageWorkspace();
  const {
    createDirectDraft,
    executeWorkflow,
    importFile,
    jsonNewLoadingStateStore,
    previewWorkflow,
    selectMode,
    setTxWorkflowStageContext,
    stageDisplayStateStore,
    workflowOutputPanelDisplayStateStore,
  } = txWorkflowStageWorkspace;
  let stageDisplay = $derived($stageDisplayStateStore);
  let jsonNewLoading = $derived($jsonNewLoadingStateStore);
  let workflowOutputPanelDisplay = $derived(
    $workflowOutputPanelDisplayStateStore,
  );

  $effect(() => {
    setTxWorkflowStageContext({
      active,
      onCreateJsonTemplateDraft,
      onDirectMode,
      onExecute,
      onImportFile,
      onPreview,
      onTemplateMode,
    });
  });
</script>

<div class="grid gap-2" hidden={!active}>
  <div class="grid gap-2">
    <TxWorkflowInputPanel
      {active}
      activeMode={stageDisplay.activeMode}
      {jsonNewLoading}
      modeTabs={txTemplateModeTabs}
      onCreateDirectDraft={createDirectDraft}
      {onCreateJsonTemplateDraft}
      {onDeleteJsonTemplate}
      {onEditorInput}
      onImportFile={importFile}
      {onLoadJsonTemplate}
      {onSaveJsonTemplate}
      onSelectMode={selectMode}
    />
    <TxWorkflowRunPanel
      panelDisplay={workflowOutputPanelDisplay}
      onPreview={previewWorkflow}
      onExecute={executeWorkflow}
    />
  </div>
</div>
