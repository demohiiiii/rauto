<script>
  import { createOrchestrationTxBlockTemplateActionEditorWorkspace } from "../../modules/orchestrationTxBlockActionEditors.js";
  import OrchestrationTxBlockTemplateSourceEditor from "./OrchestrationTxBlockTemplateSourceEditor.svelte";

  let {
    model,
    stageIndex,
    jobIndex,
    jobRow,
    visualDisplay,
    onChange,
    onErrorChange,
  } = $props();
  const orchestrationTxBlockTemplateActionEditorWorkspace =
    createOrchestrationTxBlockTemplateActionEditorWorkspace();
  const { actionCallbacksStateStore, setActionContext } =
    orchestrationTxBlockTemplateActionEditorWorkspace;
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

<OrchestrationTxBlockTemplateSourceEditor
  sourceValue={txBlockRows.sourceValue}
  {txBlock}
  {txBlockRows}
  {visualDisplay}
  sourceBindings={actionEditorCallbacks.sourceBindings}
/>
