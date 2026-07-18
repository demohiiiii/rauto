<script>
  import OrchestrationFlowCanvas from "./OrchestrationFlowCanvas.svelte";

  let {
    active,
    model,
    visualDisplay,
    onChange,
    onErrorChange,
    onOpenView,
    onExecute,
    runButtonDisplay,
  } = $props();
</script>

<OrchestrationFlowCanvas
  {active}
  {model}
  {visualDisplay}
  {onChange}
  {onErrorChange}
  {onOpenView}
  {onExecute}
  {runButtonDisplay}
/>
