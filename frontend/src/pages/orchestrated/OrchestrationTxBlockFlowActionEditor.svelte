<script>
  import { createOrchestrationTxBlockFlowActionEditorWorkspace } from "../../modules/orchestrationTxBlockActionEditors.js";
  import OrchestrationTxBlockFlowSourceEditor from "./OrchestrationTxBlockFlowSourceEditor.svelte";

  let {
    model,
    stageIndex,
    jobIndex,
    jobRow,
    visualDisplay,
    onChange,
    onErrorChange,
  } = $props();
  const orchestrationTxBlockFlowActionEditorWorkspace =
    createOrchestrationTxBlockFlowActionEditorWorkspace();
  const { actionCallbacksStateStore, setActionContext } =
    orchestrationTxBlockFlowActionEditorWorkspace;
  let actionEditorCallbacks = $derived($actionCallbacksStateStore);
  let txBlock = $derived(jobRow?.job?.action?.txBlock || {});
  let txBlockRows = $derived(jobRow?.txBlockRows || {});

  $effect(() => {
    setActionContext({
      jobIndex,
      model,
      onChange,
      onErrorChange,
      stageIndex,
    });
  });
</script>

<OrchestrationTxBlockFlowSourceEditor
  sourceValue={txBlockRows.sourceValue}
  {txBlock}
  {txBlockRows}
  {visualDisplay}
  sourceBindings={actionEditorCallbacks.sourceBindings}
/>
