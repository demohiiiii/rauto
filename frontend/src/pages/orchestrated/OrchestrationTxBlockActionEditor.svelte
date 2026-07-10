<script>
  import { createOrchestrationTxBlockActionEditorWorkspace } from "../../modules/orchestrationTxBlockActionEditors.js";
  import OrchestrationTxBlockActionSettingsEditor from "./OrchestrationTxBlockActionSettingsEditor.svelte";
  import OrchestrationTxBlockDirectActionEditor from "./OrchestrationTxBlockDirectActionEditor.svelte";
  import OrchestrationTxBlockFlowActionEditor from "./OrchestrationTxBlockFlowActionEditor.svelte";
  import OrchestrationTxBlockTemplateActionEditor from "./OrchestrationTxBlockTemplateActionEditor.svelte";

  let {
    model,
    stageIndex,
    jobIndex,
    jobRow,
    visualDisplay,
    onChange,
    onErrorChange,
  } = $props();
  const orchestrationTxBlockActionEditorWorkspace =
    createOrchestrationTxBlockActionEditorWorkspace();
  const {
    actionCallbacksStateStore,
    jobRowStateStore,
    setTxBlockActionContext,
    txBlockActionDisplayStateStore,
  } = orchestrationTxBlockActionEditorWorkspace;
  let actionCallbacks = $derived($actionCallbacksStateStore);
  let syncedJobRow = $derived($jobRowStateStore);
  let syncedTxBlock = $derived(syncedJobRow?.job?.action?.txBlock || {});
  let syncedTxBlockRows = $derived(syncedJobRow?.txBlockRows || {});
  let txBlockActionDisplay = $derived($txBlockActionDisplayStateStore);

  $effect(() => {
    setTxBlockActionContext({ jobIndex, jobRow, model, onChange, stageIndex });
  });
</script>

<div class="grid gap-3 md:grid-cols-2">
  <OrchestrationTxBlockActionSettingsEditor
    txBlock={syncedTxBlock}
    txBlockRows={syncedTxBlockRows}
    {visualDisplay}
    onSourceChange={actionCallbacks.sourceValueChange}
    onNameInput={actionCallbacks.nameValueChange}
    onSetFieldPresence={actionCallbacks.fieldPresenceChange}
    onExtraChange={actionCallbacks.extraChange}
  />
  {#if txBlockActionDisplay.showDirectEditor}
    <OrchestrationTxBlockDirectActionEditor
      {model}
      {stageIndex}
      {jobIndex}
      jobRow={syncedJobRow}
      {visualDisplay}
      {onChange}
      {onErrorChange}
    />
  {:else if txBlockActionDisplay.showTemplateEditor}
    <OrchestrationTxBlockTemplateActionEditor
      {model}
      {stageIndex}
      {jobIndex}
      jobRow={syncedJobRow}
      {visualDisplay}
      {onChange}
      {onErrorChange}
    />
  {:else if txBlockActionDisplay.showFlowEditor}
    <OrchestrationTxBlockFlowActionEditor
      {model}
      {stageIndex}
      {jobIndex}
      jobRow={syncedJobRow}
      {visualDisplay}
      {onChange}
      {onErrorChange}
    />
  {/if}
</div>
