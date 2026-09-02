<script lang="ts">
  import TransferWorkspace from "$domains/transfer/presentation/components/TransferWorkspace.svelte";

  let { active }: { active: boolean } = $props();
</script>

<TransferWorkspace {active} />
