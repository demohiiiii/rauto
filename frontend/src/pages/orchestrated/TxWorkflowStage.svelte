<script>
  import TxWorkflowInputPanel from "./TxWorkflowInputPanel.svelte";
  import TxWorkflowRunPanel from "./TxWorkflowRunPanel.svelte";
  import { createTxWorkflowStageWorkspace } from "../../modules/transactionPanelState.js";

  let {
    active,
    onCreateJsonTemplateDraft,
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
    setTxWorkflowStageContext,
    workflowOutputPanelDisplayStateStore,
  } = txWorkflowStageWorkspace;
  let jsonNewLoading = $derived($jsonNewLoadingStateStore);
  let workflowOutputPanelDisplay = $derived(
    $workflowOutputPanelDisplayStateStore,
  );

  $effect(() => {
    setTxWorkflowStageContext({
      active,
      onCreateJsonTemplateDraft,
      onExecute,
      onImportFile,
      onPreview,
    });
  });
</script>

<div class="grid gap-2" hidden={!active}>
  <div class="grid gap-2">
    <TxWorkflowInputPanel
      {active}
      {jsonNewLoading}
      onCreateDirectDraft={createDirectDraft}
      {onCreateJsonTemplateDraft}
      {onEditorInput}
      onImportFile={importFile}
      {onLoadJsonTemplate}
      {onSaveJsonTemplate}
    />
    <TxWorkflowRunPanel
      panelDisplay={workflowOutputPanelDisplay}
      onExecute={executeWorkflow}
    />
  </div>
</div>
