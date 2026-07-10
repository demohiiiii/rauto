<script>
  import { createOrchestrationTxBlockDirectActionEditorWorkspace } from "../../modules/orchestrationTxBlockActionEditors.js";
  import OrchestrationTxBlockDirectSourceEditor from "./OrchestrationTxBlockDirectSourceEditor.svelte";

  let {
    model,
    stageIndex,
    jobIndex,
    jobRow,
    visualDisplay,
    onChange,
    onErrorChange,
  } = $props();
  const orchestrationTxBlockDirectActionEditorWorkspace =
    createOrchestrationTxBlockDirectActionEditorWorkspace();
  const { actionCallbacksStateStore, setActionContext } =
    orchestrationTxBlockDirectActionEditorWorkspace;
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

<OrchestrationTxBlockDirectSourceEditor
  {txBlock}
  {txBlockRows}
  {visualDisplay}
  sourceBindings={actionEditorCallbacks.sourceBindings}
/>
