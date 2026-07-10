<script>
  import { createOrchestrationTxWorkflowActionEditorWorkspace } from "../../modules/orchestrationTxWorkflowActions.js";
  import OrchestrationTxWorkflowActionSettingsEditor from "./OrchestrationTxWorkflowActionSettingsEditor.svelte";
  import OrchestrationTxWorkflowSourceEditor from "./OrchestrationTxWorkflowSourceEditor.svelte";

  let {
    model,
    stageIndex,
    jobIndex,
    jobRow,
    visualDisplay,
    onChange,
    onErrorChange,
  } = $props();
  const orchestrationTxWorkflowActionEditorWorkspace =
    createOrchestrationTxWorkflowActionEditorWorkspace();
  const { actionCallbacksStateStore, setTxWorkflowActionContext } =
    orchestrationTxWorkflowActionEditorWorkspace;
  let actionEditorCallbacks = $derived($actionCallbacksStateStore);
  let txWorkflow = $derived(jobRow?.job?.action?.txWorkflow || {});
  let txWorkflowRows = $derived(jobRow?.txWorkflowRows || {});

  $effect(() => {
    setTxWorkflowActionContext({
      jobIndex,
      model,
      onChange,
      onErrorChange,
      stageIndex,
    });
  });
</script>

<div class="grid gap-3 md:grid-cols-2">
  <OrchestrationTxWorkflowActionSettingsEditor
    {txWorkflow}
    {txWorkflowRows}
    {visualDisplay}
    onSourceChange={actionEditorCallbacks.sourceChange}
    onExtraChange={actionEditorCallbacks.extraChange}
  />
  <OrchestrationTxWorkflowSourceEditor
    sourceValue={txWorkflowRows.sourceValue}
    {txWorkflow}
    {visualDisplay}
    sourceBindings={actionEditorCallbacks.sourceBindings}
  />
</div>
