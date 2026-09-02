<script lang="ts">
  import BlacklistWorkspace from "$domains/blacklist/presentation/components/BlacklistWorkspace.svelte";

  let { active }: { active: boolean } = $props();
</script>

<BlacklistWorkspace {active} />
