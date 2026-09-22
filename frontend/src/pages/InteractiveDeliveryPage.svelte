<script lang="ts">
  import DeliveryWorkspace from "$domains/standard/presentation/components/DeliveryWorkspace.svelte";
  import InteractiveExecutionPanel from "$domains/standard/presentation/components/InteractiveExecutionPanel.svelte";

  let { active }: { active: boolean } = $props();
</script>

<DeliveryWorkspace {active} kind="interactive">
  {#snippet singlePanel(panelActive: boolean)}
    <InteractiveExecutionPanel active={panelActive} />
  {/snippet}
  {#snippet batchPanel(panelActive: boolean)}
    <InteractiveExecutionPanel active={panelActive} batch />
  {/snippet}
</DeliveryWorkspace>
