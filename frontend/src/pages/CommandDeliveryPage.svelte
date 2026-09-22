<script lang="ts">
  import DeliveryWorkspace from "$domains/standard/presentation/components/DeliveryWorkspace.svelte";
  import CommandExecutionPanel from "$domains/standard/presentation/components/CommandExecutionPanel.svelte";

  let { active }: { active: boolean } = $props();
</script>

<DeliveryWorkspace {active} kind="command">
  {#snippet singlePanel(panelActive: boolean)}
    <CommandExecutionPanel active={panelActive} />
  {/snippet}
  {#snippet batchPanel(panelActive: boolean)}
    <CommandExecutionPanel active={panelActive} batch />
  {/snippet}
</DeliveryWorkspace>
