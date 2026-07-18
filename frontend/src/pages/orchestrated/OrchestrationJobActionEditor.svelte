<script>
  import OrchestrationTxWorkflowActionEditor from "./OrchestrationTxWorkflowActionEditor.svelte";

  let {
    model,
    stageIndex,
    jobIndex,
    jobRow,
    visualDisplay,
    onChange,
    onErrorChange,
  } = $props();
</script>

<OrchestrationTxWorkflowActionEditor
  {model}
  {stageIndex}
  {jobIndex}
  {jobRow}
  {visualDisplay}
  {onChange}
  {onErrorChange}
  settingsOnly={true}
/>
