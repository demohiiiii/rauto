<script lang="ts">
  import InventoryWorkspace from "$domains/inventory/presentation/components/InventoryWorkspace.svelte";

  let { active }: { active: boolean } = $props();
</script>

<InventoryWorkspace {active} />
