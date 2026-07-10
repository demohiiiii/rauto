<script>
  import OrchestrationTxBlockActionEditor from "./OrchestrationTxBlockActionEditor.svelte";
  import OrchestrationTxWorkflowActionEditor from "./OrchestrationTxWorkflowActionEditor.svelte";
  import PlainSelectField from "../../components/fragments/PlainSelectField.svelte";
  import { createOrchestrationJobActionEditorWorkspace } from "../../modules/orchestrationStageState.js";

  let {
    model,
    stageIndex,
    jobIndex,
    jobRow,
    visualDisplay,
    onChange,
    onErrorChange,
  } = $props();
  const orchestrationJobActionEditorWorkspace =
    createOrchestrationJobActionEditorWorkspace();
  const {
    actionEditorCallbacksStateStore,
    actionEditorDisplayStateStore,
    jobRowStateStore,
    setJobActionContext,
  } = orchestrationJobActionEditorWorkspace;
  let actionEditorCallbacks = $derived($actionEditorCallbacksStateStore);
  let actionEditorDisplay = $derived($actionEditorDisplayStateStore);
  let syncedJobRow = $derived($jobRowStateStore);

  $effect(() => {
    setJobActionContext({
      jobIndex,
      jobRow,
      model,
      onChange,
      stageIndex,
      visualDisplay,
    });
  });
</script>

<div class="grid gap-3 rounded-lg border border-border p-3">
  <label class="flex flex-col gap-2">
    <span class="text-sm font-medium text-foreground"
      >{actionEditorDisplay.actionKindField.labelText}</span
    >
    <PlainSelectField
      value={actionEditorDisplay.actionKindField.valueText}
      optionRows={actionEditorDisplay.actionKindField.optionRows}
      onChange={actionEditorCallbacks.actionKindChange}
    />
  </label>

  {#if actionEditorDisplay.showTxBlockAction}
    <OrchestrationTxBlockActionEditor
      {model}
      {stageIndex}
      {jobIndex}
      jobRow={syncedJobRow}
      {visualDisplay}
      {onChange}
      {onErrorChange}
    />
  {:else if actionEditorDisplay.showTxWorkflowAction}
    <OrchestrationTxWorkflowActionEditor
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
